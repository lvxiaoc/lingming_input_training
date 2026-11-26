import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PALACE_PDF_CHAMBERS,
  PdfMonumentGlyph,
  PdfRadicalGlyph,
  PdfStrokeTier,
} from '../data/palacePdfData';
import {
  loadPalaceOverrides,
  PALACE_OVERRIDES_EVENT,
  PalaceNodeOverride,
  PalaceOverridesMap,
} from '../data/palaceEditor';
import { getLingmingRadicalScript, LINGMING_ROOT_MAP } from '../data/lingming';
import { FrequencyTier } from '../data/palaceStrokes';
import { matchesScript, ScriptMode } from '../data/scriptFilter';
import { buildChamberStrokeFlow, ChamberStrokeFlow } from '../data/palaceStrokePaths';
import { resolvePdfRadicalInfo } from '../data/palaceCloudTraining';
import { useUiText } from '../data/uiScript';
import { useThemeMode } from '../data/theme';

export interface StrokeCloudSelection {
  id: string;
  char: string;
  rawChar: string;
  parentChar: string;
  ma: string;
  isXiao: boolean;
  rank: number;
  tier: PdfStrokeTier;
  isVariant: boolean;
  isPua: boolean;
  path: string;
  cx: number;
  cy: number;
  r: number;
  pinyin: string;
  note?: string;
}

interface StrokeCloudStageProps {
  chamberKey: string;
  activeChar?: string | null;
  completedChars?: Set<string>;
  selectedChar?: string | null;
  selectedNodeId?: string | null;
  onSelectNode?: (node: StrokeCloudSelection) => void;
  /**
   * 'palace'    = 1:1 A4 Memory Palace viewer (vibrant PDF tier colors + interactive click/edit)
   * 'midground' = translucent depth plane behind active typing
   * 'echo'      = reactive Key-1 background stimulus (calm atmospheric tones, gently glows target radical)
   */
  variant?: 'palace' | 'midground' | 'echo';
  /** 0 = full visibility, 1 = soft, 2 = faint ghost, 3 = nearly invisible blind */
  scaffoldLevel?: 0 | 1 | 2 | 3;
  /** Optional overrides passed from Editor; otherwise synced automatically from localStorage */
  overrides?: PalaceOverridesMap;
  /** Enables pointer drag-to-reposition on any glyph/monument */
  editMode?: boolean;
  onDragNode?: (id: string, patch: Partial<PalaceNodeOverride>) => void;
  /** Shift the entire palace cloud so activeChar lands at SVG (50,50), coinciding with foreground target */
  anchorOnActive?: boolean;
  /** Smoothly center selectedNode/selectedChar at SVG (50,50) with a meditative breathing enlargement */
  centerSelected?: boolean;
  /** Active Trad/Simp script mode; out-of-script radicals are visually dimmed rather than removed */
  scriptMode?: ScriptMode;
  /** Overlay the Memory Palace calligraphic stroke-association path tracing brush order */
  showStrokeFlow?: boolean;
}

// 4 core frequency-tier colors exported for cluster cards & legend swatches
export const FREQUENCY_TIER_COLORS: Record<FrequencyTier, string> = {
  primary: '#DCE8E3',
  rank2_5: '#22B8CF', // 第 2–5 高頻（PDF 天青青碧）
  rank6_9: '#D65DB1', // 第 6–9 中頻（PDF 紫紅靛粉）
  rest: '#EB5368', // 其餘字根（PDF 硃砂赤紅）
};

// Full 7-role PDF-faithful color palette for the Palace viewer (dark ink optimized)
export const PDF_TIER_COLORS: Record<PdfStrokeTier, string> = {
  primary: '#DCE8E3',
  var_primary: '#8EB548', // 主根變體（PDF 橄欖青綠）
  rank2_5: '#22B8CF', // 第 2–5（PDF 湖青）
  var_2_5: '#20B584', // 第 2–5 變體（PDF 翠綠）
  rank6_9: '#D65DB1', // 第 6–9（PDF 紫紅）
  var_6_9: '#8E6BE8', // 第 6–9 變體（PDF 堇紫）
  rest: '#EB5368', // 其餘（PDF 硃紅）
};

// Calm, desaturated atmospheric palette for reactive Key-1 background stimulus ('echo')
// Preserves the exact visual hierarchy of the original A4 Memory Palace while keeping the foreground #FFF9EE target crisp
const ECHO_PDF_TIER_COLORS: Record<PdfStrokeTier, string> = {
  primary: '#5C988E',
  var_primary: '#6B8848',
  rank2_5: '#3B8FA2',
  var_2_5: '#368D72',
  rank6_9: '#8F5584',
  var_6_9: '#6B5BA8',
  rest: '#A1525D',
};

// 宣紙水墨 (Pure Monochromatic Five-Tone Sumi Ink: 焦 · 濃 · 重 · 淡 · 清)
export const WASH_FREQUENCY_TIER_COLORS: Record<FrequencyTier, string> = {
  primary: '#111110',
  rank2_5: '#353532',
  rank6_9: '#61615B',
  rest: '#8D8C85',
};

export const WASH_PDF_TIER_COLORS: Record<PdfStrokeTier, string> = {
  primary: '#111110',
  var_primary: '#2A2A27',
  rank2_5: '#383835',
  var_2_5: '#4E4E4A',
  rank6_9: '#64645E',
  var_6_9: '#7A7A73',
  rest: '#908F88',
};

const WASH_ECHO_PDF_TIER_COLORS: Record<PdfStrokeTier, string> = {
  primary: '#363633',
  var_primary: '#4A4A46',
  rank2_5: '#5A5A55',
  var_2_5: '#6C6C66',
  rank6_9: '#7C7C75',
  var_6_9: '#8C8B84',
  rest: '#9C9B94',
};

const NIGHT_STROKE_FLOW_TONES = ['#5CE1B8', '#38BDF8', '#E8A94B', '#D67DD4', '#F07A8B'];
const WASH_STROKE_FLOW_TONES = ['#151513', '#2F2F2C', '#4B4B46', '#676760', '#7E7D76'];

export function getStrokeFlowTone(strokeIndex0: number, isWash: boolean): string {
  const palette = isWash ? WASH_STROKE_FLOW_TONES : NIGHT_STROKE_FLOW_TONES;
  return palette[strokeIndex0 % palette.length];
}

export const PalaceStrokeFlowOverlay: React.FC<{
  flow: ChamberStrokeFlow;
  isWash: boolean;
  compact?: boolean;
  animate?: boolean;
}> = ({ flow, isWash, compact = false, animate = false }) => {
  const ribbonWidth = compact ? 3.1 : 2.5;
  const lineWidth = compact ? 1.25 : 0.95;
  const arrowWidth = compact ? 1.3 : 1.0;
  const numSize = compact ? 5.6 : 4.6;
  const haloColor = isWash ? '#F7F5EE' : '#0E131D';

  return (
    <g className="pointer-events-none" aria-hidden="true">
      {/* Subtle brush-lift transitions connecting end of stroke N to start of stroke N+1 */}
      {flow.bridges.map((b) => (
        <path
          key={`bridge_${b.fromIndex}_${b.toIndex}`}
          d={b.d}
          fill="none"
          stroke={isWash ? '#2E2E2A' : '#94A3B8'}
          strokeWidth={compact ? 0.65 : 0.52}
          strokeOpacity={isWash ? 0.22 : 0.28}
          strokeLinecap="round"
        />
      ))}

      {/* Ordered calligraphic stroke-association curves */}
      {flow.strokes.map((st, idx) => {
        const tone = getStrokeFlowTone(idx, isWash);
        const delayMs = animate ? idx * 95 : 0;
        return (
          <g key={`stroke_flow_${st.index}`}>
            {/* Soft ink-wash / glow aura ribbon */}
            <path
              d={st.d}
              fill="none"
              stroke={tone}
              strokeWidth={ribbonWidth}
              strokeOpacity={isWash ? 0.11 : 0.17}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Core directional brush-flow trace */}
            <path
              d={st.d}
              pathLength={animate ? 1 : undefined}
              fill="none"
              stroke={tone}
              strokeWidth={lineWidth}
              strokeOpacity={isWash ? 0.72 : 0.86}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={animate ? 'palace-stroke-draw' : undefined}
              style={animate ? { animationDelay: `${delayMs}ms` } : undefined}
            />
            {/* Calligraphic brush-nib directional arrowhead */}
            <path
              d={st.arrowPath}
              fill="none"
              stroke={tone}
              strokeWidth={arrowWidth}
              strokeOpacity={isWash ? 0.78 : 0.92}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Clean typographic stroke-order numeral at stroke origin (zero artificial circle ring) */}
            <text
              x={st.start.x - (compact ? 2.4 : 2.1)}
              y={st.start.y - (compact ? 2.2 : 1.9)}
              fontSize={numSize}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              fill={tone}
              stroke={haloColor}
              strokeWidth={compact ? 2.4 : 2.1}
              paintOrder="stroke"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {st.index}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export const StrokeCloudStage: React.FC<StrokeCloudStageProps> = ({
  chamberKey,
  activeChar,
  completedChars,
  selectedChar,
  selectedNodeId,
  onSelectNode,
  variant = 'palace',
  scaffoldLevel = 0,
  overrides: externalOverrides,
  editMode = false,
  onDragNode,
  anchorOnActive,
  centerSelected = false,
  scriptMode = 'both',
  showStrokeFlow = false,
}) => {
  const t = useUiText();
  const isWash = useThemeMode() === 'wash';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [internalOverrides, setInternalOverrides] = useState<PalaceOverridesMap>(() =>
    loadPalaceOverrides()
  );

  useEffect(() => {
    if (externalOverrides !== undefined) return;
    const sync = () => setInternalOverrides(loadPalaceOverrides());
    window.addEventListener(PALACE_OVERRIDES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PALACE_OVERRIDES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [externalOverrides]);

  const overrides = externalOverrides ?? internalOverrides;

  const pdfChamber = useMemo(
    () => PALACE_PDF_CHAMBERS[chamberKey.toLowerCase()],
    [chamberKey]
  );

  const strokeFlow = useMemo(
    () => (showStrokeFlow ? buildChamberStrokeFlow(chamberKey, overrides) : null),
    [showStrokeFlow, chamberKey, overrides]
  );

  const [dragState, setDragState] = useState<{
    id: string;
    startClientX: number;
    startClientY: number;
    origDx: number;
    origDy: number;
    scale: number;
  } | null>(null);

  useEffect(() => {
    if (!dragState || !editMode || !onDragNode) return;

    const handleMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const deltaX = ((e.clientX - dragState.startClientX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragState.startClientY) / rect.height) * 100;
      onDragNode(dragState.id, {
        dx: dragState.origDx + deltaX,
        dy: dragState.origDy + deltaY,
        scale: dragState.scale,
      });
    };

    const handleUp = () => setDragState(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragState, editMode, onDragNode]);

  if (!pdfChamber) {
    return null;
  }

  const monument = pdfChamber.monument;
  const monumentOverride = overrides[monument.id];
  const mDx = monumentOverride?.dx ?? 0;
  const mDy = monumentOverride?.dy ?? 0;
  const mScale = monumentOverride?.scale ?? 1;

  const isMidground = variant === 'midground';
  const isEcho = variant === 'echo';
  const isBackgroundPlane = isMidground || isEcho;

  const isPdfGlyphInScript = (disp: string, parent: string, ma: string): boolean => {
    if (scriptMode === 'both') return true;
    const dispScript = getLingmingRadicalScript(disp, chamberKey, ma);
    const effective =
      dispScript !== 'common'
        ? dispScript
        : getLingmingRadicalScript(parent, chamberKey, ma);
    return matchesScript(effective, scriptMode);
  };

  const isMonumentInScript = isPdfGlyphInScript(
    monument.displayChar,
    monument.displayChar,
    monument.ma
  );

  const isMonumentActive = Boolean(
    activeChar && (activeChar === monument.displayChar || activeChar === monument.rawChar)
  );
  const isMonumentSelected =
    selectedNodeId === monument.id ||
    (!selectedNodeId &&
      Boolean(selectedChar && (selectedChar === monument.displayChar || selectedChar === monument.rawChar)));

  // Identify exact target node to glow when activeChar matches a non-monument node
  const exactActiveNodeId = useMemo(() => {
    if (!activeChar) return null;
    if (activeChar === monument.displayChar || activeChar === monument.rawChar) return null;
    const direct = pdfChamber.nodes.find(
      (n) => n.displayChar === activeChar || n.rawChar === activeChar
    );
    if (direct) return direct.id;
    const parentFallback = pdfChamber.nodes.find((n) => n.parentChar === activeChar);
    return parentFallback?.id ?? null;
  }, [activeChar, monument.displayChar, monument.rawChar, pdfChamber.nodes]);

  const exactSelectedNodeId = useMemo(() => {
    if (selectedNodeId) return selectedNodeId;
    if (!selectedChar) return null;
    if (selectedChar === monument.displayChar || selectedChar === monument.rawChar) {
      return monument.id;
    }
    const direct = pdfChamber.nodes.find(
      (n) => n.displayChar === selectedChar || n.rawChar === selectedChar
    );
    return direct?.id ?? null;
  }, [selectedNodeId, selectedChar, monument.displayChar, monument.rawChar, monument.id, pdfChamber.nodes]);

  const shouldAnchor = anchorOnActive ?? isEcho;
  const shouldAnchorSelected = Boolean(centerSelected && !editMode && !shouldAnchor);
  const anchorPoint = useMemo(() => {
    if (shouldAnchor) {
      if (isMonumentActive) {
        return { x: monument.cx + mDx, y: monument.cy + mDy, active: true, kind: 'active' as const };
      }
      if (exactActiveNodeId) {
        const targetNode = pdfChamber.nodes.find((n) => n.id === exactActiveNodeId);
        if (targetNode) {
          const ov = overrides[targetNode.id];
          return {
            x: targetNode.cx + (ov?.dx ?? 0),
            y: targetNode.cy + (ov?.dy ?? 0),
            active: true,
            kind: 'active' as const,
          };
        }
      }
    }
    if (shouldAnchorSelected) {
      if (isMonumentSelected) {
        return { x: monument.cx + mDx, y: monument.cy + mDy, active: true, kind: 'selected' as const };
      }
      if (exactSelectedNodeId) {
        const targetNode = pdfChamber.nodes.find((n) => n.id === exactSelectedNodeId);
        if (targetNode) {
          const ov = overrides[targetNode.id];
          return {
            x: targetNode.cx + (ov?.dx ?? 0),
            y: targetNode.cy + (ov?.dy ?? 0),
            active: true,
            kind: 'selected' as const,
          };
        }
      }
    }
    return { x: 50, y: 50, active: false, kind: 'none' as const };
  }, [
    shouldAnchor,
    shouldAnchorSelected,
    isMonumentActive,
    isMonumentSelected,
    monument.cx,
    monument.cy,
    mDx,
    mDy,
    exactActiveNodeId,
    exactSelectedNodeId,
    pdfChamber.nodes,
    overrides,
  ]);

  const cameraDx = anchorPoint.active ? 50 - anchorPoint.x : 0;
  const cameraDy = anchorPoint.active ? 50 - anchorPoint.y : 0;
  const cameraTransform =
    anchorPoint.active && anchorPoint.kind === 'active'
      ? `translate(${cameraDx.toFixed(2)} ${cameraDy.toFixed(2)})`
      : undefined;
  const smoothCameraStyle =
    shouldAnchorSelected
      ? {
          transform: `translate(${cameraDx.toFixed(2)}px, ${cameraDy.toFixed(2)}px)`,
          transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'transform',
        }
      : undefined;
  const isMonumentCentered =
    anchorPoint.active &&
    ((anchorPoint.kind === 'active' && isMonumentActive) ||
      (anchorPoint.kind === 'selected' && isMonumentSelected));

  const layerOpacity = isEcho
    ? 1
    : !isMidground
      ? 1
      : scaffoldLevel === 0
        ? 0.94
        : scaffoldLevel === 1
          ? 0.56
          : scaffoldLevel === 2
            ? 0.24
            : 0.08;

  const monumentOpacity = !isMonumentInScript
    ? isMonumentSelected
      ? 0.36
      : 0.08
    : isEcho
      ? isMonumentActive
        ? 0.34
        : 0.14
      : !isMidground
        ? isMonumentSelected
          ? 0.42
          : 0.25
        : scaffoldLevel === 0
          ? 0.16
          : scaffoldLevel === 1
            ? 0.11
            : 0.05;

  const monumentColor = isWash
    ? isEcho
      ? isMonumentActive
        ? '#141413'
        : '#54544F'
      : !isMidground && isMonumentSelected
        ? '#141413'
        : isMidground
          ? '#383834'
          : '#161615'
    : isEcho
      ? isMonumentActive
        ? '#8DF5D0'
        : '#5C988E'
      : !isMidground && isMonumentSelected
        ? '#F7D286'
        : isMidground
          ? '#7BC4B2'
          : '#DCE8E3';

  const makeMonumentSelection = (m: PdfMonumentGlyph): StrokeCloudSelection => {
    const lm = LINGMING_ROOT_MAP.get(m.displayChar);
    return {
      id: m.id,
      char: m.displayChar,
      rawChar: m.rawChar,
      parentChar: m.displayChar,
      ma: lm?.ma || m.ma,
      isXiao: (lm?.ma || m.ma).length === 2,
      rank: 1,
      tier: 'primary',
      isVariant: false,
      isPua: false,
      path: m.path,
      cx: m.cx,
      cy: m.cy,
      r: m.r,
      pinyin: m.pinyin,
      note: t(lm?.note || '主根 · 骨架'),
    };
  };

  const makeNodeSelection = (n: PdfRadicalGlyph): StrokeCloudSelection => {
    const resolved = resolvePdfRadicalInfo(n, chamberKey, '');
    const ma = resolved.ma;
    const effectiveParentChar = resolved.effectiveParentChar;
    const canonical =
      resolved.directCanonical ||
      (effectiveParentChar ? LINGMING_ROOT_MAP.get(effectiveParentChar) : undefined);
    return {
      id: n.id,
      char: n.displayChar,
      rawChar: n.rawChar,
      parentChar: effectiveParentChar,
      ma,
      isXiao: ma.length === 2,
      rank: canonical?.rank ?? (n.tier.includes('2_5') ? 2 : n.tier.includes('6_9') ? 6 : 10),
      tier: n.tier,
      isVariant: n.isVariant,
      isPua: n.isPua,
      path: n.path,
      cx: n.cx,
      cy: n.cy,
      r: n.r,
      pinyin: n.pinyin,
      note:
        n.isVariant && effectiveParentChar && effectiveParentChar !== n.displayChar
          ? `「${effectiveParentChar}」${t('變體')}`
          : canonical?.note
            ? t(canonical.note)
            : undefined,
    };
  };

  const beginDrag = (e: React.PointerEvent<SVGGElement>, id: string, ov?: PalaceNodeOverride) => {
    if (!editMode || !onDragNode) return;
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origDx: ov?.dx ?? 0,
      origDy: ov?.dy ?? 0,
      scale: ov?.scale ?? 1,
    });
  };

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none ${
        isBackgroundPlane ? 'pointer-events-none' : ''
      }`}
      style={{
        opacity: layerOpacity,
        transition: 'opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className={`w-full h-full overflow-visible ${
          isEcho
            ? ''
            : isMidground
              ? 'max-w-[340px] max-h-[340px]'
              : 'max-w-[440px] max-h-[440px]'
        } ${editMode ? 'touch-none' : ''}`}
        role="img"
        aria-label={`${chamberKey.toUpperCase()} ${t('鍵最高頻主根')}「${monument.displayChar}」${t('筆畫頻率記憶宮殿壁畫')}`}
      >
        <defs>
          <radialGradient id={`palaceGlow_${chamberKey}_${variant}`} cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor={
                isWash
                  ? isEcho && isMonumentActive ? '#141413' : '#2E2E2B'
                  : isEcho && isMonumentActive ? '#34D399' : '#3E9C8A'
              }
              stopOpacity={
                isWash
                  ? isEcho ? (isMonumentActive ? '0.14' : '0.08') : '0.10'
                  : isEcho ? (isMonumentActive ? '0.14' : '0.09') : isMidground ? '0.12' : '0.14'
              }
            />
            <stop
              offset="52%"
              stopColor={isWash ? '#7A7A73' : '#1D3E3D'}
              stopOpacity={isWash ? (isEcho ? '0.045' : '0.055') : (isEcho ? '0.025' : '0.04')}
            />
            <stop offset="100%" stopColor={isWash ? '#F3F1EC' : '#0B0F17'} stopOpacity="0" />
          </radialGradient>

          {isWash && (
            <>
              <radialGradient id={`palaceMistCloud_${chamberKey}_${variant}`} cx="38%" cy="40%" r="52%">
                <stop offset="0%" stopColor="#141413" stopOpacity={isEcho ? '0.06' : '0.075'} />
                <stop offset="60%" stopColor="#565650" stopOpacity={isEcho ? '0.025' : '0.032'} />
                <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
              </radialGradient>

              <filter id={`washInkBleed_${chamberKey}_${variant}`} x="-12%" y="-12%" width="124%" height="124%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="0.42" result="bleed" />
                <feComponentTransfer in="bleed" result="softBleed">
                  <feFuncA type="linear" slope="0.34" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="softBleed" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <radialGradient id={`washNodePool_${chamberKey}_${variant}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#141413" stopOpacity="0.22" />
                <stop offset="52%" stopColor="#3A3A36" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
              </radialGradient>
            </>
          )}

          {isEcho && (
            <filter id={`echoNodeGlow_${chamberKey}`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={isWash ? '0.75' : '0.55'} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        <g transform={cameraTransform} style={smoothCameraStyle}>
        <circle
          cx="50"
          cy="50"
          r="49"
          fill={`url(#palaceGlow_${chamberKey}_${variant})`}
        />
        {isWash && (
          <ellipse
            cx="42"
            cy="44"
            rx="44"
            ry="36"
            fill={`url(#palaceMistCloud_${chamberKey}_${variant})`}
          />
        )}

        {editMode && (
          <rect
            x="0"
            y="0"
            width="100"
            height="100"
            rx="4"
            fill="none"
            stroke={isWash ? 'rgba(20, 20, 18, 0.25)' : 'rgba(216, 155, 60, 0.25)'}
            strokeWidth="0.45"
            strokeDasharray="1.8 1.4"
          />
        )}

        {/* Monumental #1 Highest-Frequency 主根 Silhouette — Exact 1:1 PDF Vector Brush Path */}
        <g
          transform={`translate(${(monument.cx + mDx).toFixed(2)} ${(monument.cy + mDy).toFixed(2)})`}
          onClick={
            onSelectNode
              ? () => onSelectNode(makeMonumentSelection(monument))
              : undefined
          }
          onPointerDown={(e) => {
            if (onSelectNode) onSelectNode(makeMonumentSelection(monument));
            beginDrag(e, monument.id, monumentOverride);
          }}
          className={
            editMode ? 'cursor-grab active:cursor-grabbing' : onSelectNode ? 'cursor-pointer' : ''
          }
        >
          {isEcho && isMonumentActive && (
            isWash ? (
              <circle
                cx={0}
                cy={0}
                r={9.5}
                fill={`url(#washNodePool_${chamberKey}_${variant})`}
                className={isMonumentCentered ? 'palace-cushion-breathe' : undefined}
              />
            ) : (
              <circle
                cx={0}
                cy={0}
                r={5.8}
                fill="rgba(52, 211, 153, 0.07)"
                stroke="rgba(141, 245, 208, 0.45)"
                strokeWidth="0.28"
                className={isMonumentCentered ? 'palace-cushion-breathe' : undefined}
              />
            )
          )}
          {editMode && isMonumentSelected && (
            <circle
              cx={0}
              cy={0}
              r={Math.min(46, monument.r * mScale * 0.96)}
              fill="none"
              stroke={isWash ? 'rgba(20, 20, 18, 0.45)' : 'rgba(247, 210, 134, 0.45)'}
              strokeWidth="0.55"
              strokeDasharray="1.8 1.5"
            />
          )}
          <g
            key={isMonumentCentered ? `mon_centered_${monument.id}` : monument.id}
            className={isMonumentCentered ? 'palace-monument-breathe' : undefined}
          >
            <path
              d={monument.path}
              fill={monumentColor}
              fillOpacity={monumentOpacity}
              transform={`scale(${mScale.toFixed(3)}) translate(${(-monument.cx).toFixed(2)} ${(-monument.cy).toFixed(2)})`}
              shapeRendering="geometricPrecision"
              filter={
                isEcho && isMonumentActive
                  ? `url(#echoNodeGlow_${chamberKey})`
                  : isWash
                    ? `url(#washInkBleed_${chamberKey}_${variant})`
                    : undefined
              }
            />
          </g>
        </g>

        {/* Optional Memory Palace calligraphic stroke-association path overlay */}
        {strokeFlow && (
          <PalaceStrokeFlowOverlay flow={strokeFlow} isWash={isWash} animate />
        )}

        {/* ALL 379 Non-Primary Radicals & 变体 Variants in Harmonized Positions & Brush Outlines */}
        {pdfChamber.nodes.map((node) => {
          const ov = overrides[node.id];
          const dx = ov?.dx ?? 0;
          const dy = ov?.dy ?? 0;
          const scale = ov?.scale ?? 1;

          const isCurrent = exactActiveNodeId === node.id;
          const isSelected = exactSelectedNodeId === node.id;
          const isDone = Boolean(
            completedChars &&
              (completedChars.has(node.displayChar) ||
                (!node.isVariant && completedChars.has(node.parentChar)))
          );

          const baseColor = isWash
            ? isEcho
              ? WASH_ECHO_PDF_TIER_COLORS[node.tier]
              : WASH_PDF_TIER_COLORS[node.tier]
            : isEcho
              ? ECHO_PDF_TIER_COLORS[node.tier]
              : PDF_TIER_COLORS[node.tier];

          const fillColor = isWash
            ? isEcho
              ? isCurrent
                ? '#111110'
                : baseColor
              : isCurrent
                ? '#0D0D0C'
                : isDone
                  ? '#242422'
                  : isSelected
                    ? '#141413'
                    : baseColor
            : isEcho
              ? isCurrent
                ? '#8DF5D0' // Soft celadon-mint focus glow during Key-1 stimulus
                : baseColor
              : isCurrent
                ? '#FFF7E6'
                : isDone
                  ? '#4CD4A4'
                  : isSelected
                    ? '#F7D286'
                    : baseColor;

          const resolvedNode = resolvePdfRadicalInfo(node, chamberKey, '');
          const inScript = isPdfGlyphInScript(
            node.displayChar,
            resolvedNode.effectiveParentChar,
            resolvedNode.ma
          );

          const baseOpacity = node.isVariant ? 0.88 : 0.97;
          const fillOpacity = !inScript
            ? isEcho
              ? isCurrent
                ? 0.32
                : 0.08
              : isCurrent || isSelected
                ? 0.92
                : isMidground
                  ? baseOpacity * 0.2
                  : 0.16
            : isEcho
              ? isCurrent
                ? 0.32
                : node.isVariant
                  ? 0.34
                  : 0.44
              : isCurrent || isSelected
                ? 1
                : isDone
                  ? 0.94
                  : isMidground
                    ? baseOpacity * 0.72
                    : baseOpacity;

          const effCx = node.cx + dx;
          const effCy = node.cy + dy;
          const haloRadius = isEcho
            ? Math.max(5.2, node.r * scale * 1.48)
            : Math.max(4.4, node.r * scale * 1.42);
          const hitRadius = Math.max(4.8, node.r * scale * 1.45);
          const isNodeCentered =
            anchorPoint.active &&
            ((anchorPoint.kind === 'active' && isCurrent) ||
              (anchorPoint.kind === 'selected' && isSelected));

          return (
            <g
              key={node.id}
              transform={`translate(${effCx.toFixed(2)} ${effCy.toFixed(2)})`}
              onClick={
                onSelectNode
                  ? () => onSelectNode(makeNodeSelection(node))
                  : undefined
              }
              onPointerDown={(e) => {
                if (onSelectNode) onSelectNode(makeNodeSelection(node));
                beginDrag(e, node.id, ov);
              }}
              className={
                editMode
                  ? 'cursor-grab active:cursor-grabbing'
                  : onSelectNode
                    ? 'cursor-pointer'
                    : ''
              }
            >
              {(isCurrent || isSelected) && (
                isWash && !(editMode && isSelected) ? (
                  <circle
                    cx={0}
                    cy={0}
                    r={haloRadius * 1.45}
                    fill={`url(#washNodePool_${chamberKey}_${variant})`}
                    className={isNodeCentered ? 'palace-cushion-breathe' : undefined}
                  />
                ) : (
                  <circle
                    cx={0}
                    cy={0}
                    r={haloRadius}
                    fill={
                      isWash
                        ? 'rgba(20, 20, 18, 0.10)'
                        : isEcho
                          ? 'rgba(52, 211, 153, 0.07)'
                          : isCurrent
                            ? 'rgba(216, 155, 60, 0.20)'
                            : 'rgba(247, 210, 134, 0.16)'
                    }
                    stroke={
                      isWash
                        ? '#181817'
                        : isEcho
                          ? 'rgba(141, 245, 208, 0.45)'
                          : isCurrent
                            ? '#E5AE4E'
                            : '#F7D286'
                    }
                    strokeWidth={isEcho ? '0.28' : editMode && isSelected ? '0.65' : '0.45'}
                    strokeDasharray={editMode && isSelected ? '1.6 1.1' : undefined}
                    className={isNodeCentered ? 'palace-cushion-breathe' : undefined}
                  />
                )
              )}

              {isNodeCentered && !isEcho && (
                <circle
                  key={`stage_ring_${node.id}`}
                  cx={0}
                  cy={0}
                  r={haloRadius * 1.28}
                  fill="none"
                  stroke={isWash ? '#181817' : '#F7D286'}
                  strokeWidth="0.34"
                  className="palace-breath-ring pointer-events-none"
                />
              )}

              {/* Generous invisible hit circle so thin strokes like 一/丨/丿 are easy to click & drag */}
              {!isBackgroundPlane && (
                <circle cx={0} cy={0} r={hitRadius} fill="transparent" />
              )}

              <g
                key={isNodeCentered ? `node_breathe_${node.id}` : `node_still_${node.id}`}
                className={isNodeCentered ? 'palace-radical-breathe' : undefined}
              >
                <g transform={`scale(${scale.toFixed(3)}) translate(${(-node.cx).toFixed(2)} ${(-node.cy).toFixed(2)})`}>
                  <path
                    d={node.path}
                    fill={fillColor}
                    fillOpacity={fillOpacity}
                    shapeRendering="geometricPrecision"
                    filter={
                      isEcho && isCurrent
                        ? `url(#echoNodeGlow_${chamberKey})`
                        : isWash && (isCurrent || isSelected || isDone)
                          ? `url(#washInkBleed_${chamberKey}_${variant})`
                          : undefined
                    }
                  />
                </g>
              </g>
            </g>
          );
        })}
        </g>
      </svg>
    </div>
  );
};
