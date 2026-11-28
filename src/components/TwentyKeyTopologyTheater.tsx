import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Compass,
  Feather,
  FileText,
  Pause,
  Play,
  Printer,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getSimpRadicalsForMorphKey,
  KeyTopologyMorphSpec,
  RadicalMorphNode,
  TOTAL_MORPH_RADICAL_COUNT,
  TWENTY_KEY_MORPH_BY_KEY,
  TWENTY_KEY_MORPHS,
} from '../data/twentyKeysMorph';
import {
  buildTwoBeatDecomposition,
  KEY_MOTOR_PROFILES,
  TwoBeatDecomposition,
} from '../data/kineticTwoBeat';
import {
  buildCornerConvergenceData,
  CornerConvergenceData,
} from '../data/cornerConvergence';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { synth } from '../audio/synth';
import {
  drawBrushSampled,
  drawCalligraphyBrushTip,
  drawCoreBloomDiffusion,
  drawCrystallizedCornerMark,
  drawDecayingPillarStroke,
  drawFingerVectorGuide,
  drawInwardPillarLightStreams,
  drawMiZiPaper,
  drawReboundBounceGuide,
  drawResonanceField,
  drawStopImpactRipple,
  easeInOutCubic,
  lerpSampled,
  Sampled,
  sampleCatmullRom,
} from '../utils/topologyBrushRenderer';
import { TopologyCloudPdfModal } from './TopologyCloudPdfModal';
import { useTopologyAtlasPrint } from '../hooks/useTopologyAtlasPrint';
import { PrintableTopologySheets } from './PrintableTopologySheets';

interface TwentyKeyTopologyTheaterProps {
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  initialKey?: string;
  onOpenMuscleTrainer?: (key: string, order?: 'sequential' | 'cross_key_jump') => void;
  onOpenTopologicalPalace?: (key: string) => void;
  onOpenPracticeStudio: () => void;
  onBackToDojo: () => void;
}

const QWERTY_DECK: Array<Array<{ key: string; hand: 'L' | 'R' }>> = [
  [
    { key: 'q', hand: 'L' },
    { key: 'w', hand: 'L' },
    { key: 'e', hand: 'L' },
    { key: 'r', hand: 'L' },
    { key: 't', hand: 'L' },
    { key: 'y', hand: 'R' },
    { key: 'u', hand: 'R' },
    { key: 'i', hand: 'R' },
    { key: 'o', hand: 'R' },
    { key: 'p', hand: 'R' },
  ],
  [
    { key: 'a', hand: 'L' },
    { key: 's', hand: 'L' },
    { key: 'd', hand: 'L' },
    { key: 'f', hand: 'L' },
    { key: 'g', hand: 'L' },
    { key: 'h', hand: 'R' },
    { key: 'j', hand: 'R' },
    { key: 'k', hand: 'R' },
    { key: 'l', hand: 'R' },
  ],
  [
    { key: 'z', hand: 'L' },
    { key: 'x', hand: 'L' },
    { key: 'c', hand: 'L' },
    { key: 'v', hand: 'L' },
    { key: 'b', hand: 'L' },
    { key: 'n', hand: 'R' },
    { key: 'm', hand: 'R' },
  ],
];

const VOWELS_SET = new Set(['a', 'e', 'i', 'o', 'u']);

// Left & Right hand mini-keyboard geometry for the tactile reach diagram
const LEFT_HAND_KEYS: Array<{ k: string; x: number; y: number }> = [
  { k: 'Q', x: 6, y: 6 },
  { k: 'W', x: 38, y: 6 },
  { k: 'E', x: 70, y: 6 },
  { k: 'R', x: 102, y: 6 },
  { k: 'T', x: 134, y: 6 },
  { k: 'A', x: 13, y: 40 },
  { k: 'S', x: 45, y: 40 },
  { k: 'D', x: 77, y: 40 },
  { k: 'F', x: 109, y: 40 },
  { k: 'G', x: 141, y: 40 },
  { k: 'Z', x: 24, y: 74 },
  { k: 'X', x: 56, y: 74 },
  { k: 'C', x: 88, y: 74 },
  { k: 'V', x: 120, y: 74 },
  { k: 'B', x: 152, y: 74 },
];

const RIGHT_HAND_KEYS: Array<{ k: string; x: number; y: number }> = [
  { k: 'Y', x: 6, y: 6 },
  { k: 'U', x: 38, y: 6 },
  { k: 'I', x: 70, y: 6 },
  { k: 'O', x: 102, y: 6 },
  { k: 'P', x: 134, y: 6 },
  { k: 'H', x: 13, y: 40 },
  { k: 'J', x: 45, y: 40 },
  { k: 'K', x: 77, y: 40 },
  { k: 'L', x: 109, y: 40 },
  { k: ';', x: 141, y: 40 },
  { k: 'N', x: 24, y: 74 },
  { k: 'M', x: 56, y: 74 },
];

// Adaptive Left/Right Hand Finger-Reach Mini Diagram synchronized with 3-Beat Kinetic Phase
const HandReachDiagram: React.FC<{
  spec: KeyTopologyMorphSpec;
  isWash: boolean;
  syncBeat?: 'travel' | 'impact' | 'rebound' | 'hold' | null;
}> = ({ spec, isWash, syncBeat = null }) => {
  const keys = spec.hand === 'L' ? LEFT_HAND_KEYS : RIGHT_HAND_KEYS;
  const targetChar = spec.key.toUpperCase();
  const homeChar = spec.homeKey;
  const homePos = keys.find((item) => item.k === homeChar);
  const targetPos = keys.find((item) => item.k === targetChar);
  const isHomePress = homeChar === targetChar;

  // Arrow endpoints (center of keycaps)
  const hx = homePos ? homePos.x + 14 : 0;
  const hy = homePos ? homePos.y + 14 : 0;
  const tx = targetPos ? targetPos.x + 14 : 0;
  const ty = targetPos ? targetPos.y + 14 : 0;
  const ang = Math.atan2(ty - hy, tx - hx);
  const dist = Math.hypot(tx - hx, ty - hy);
  const startX = hx + Math.cos(ang) * 9;
  const startY = hy + Math.sin(ang) * 9;
  const endX = tx - Math.cos(ang) * 10;
  const endY = ty - Math.sin(ang) * 10;
  const headSize = 5.5;
  const p1x = endX - headSize * Math.cos(ang - 0.55);
  const p1y = endY - headSize * Math.sin(ang - 0.55);
  const p2x = endX - headSize * Math.cos(ang + 0.55);
  const p2y = endY - headSize * Math.sin(ang + 0.55);

  return (
    <svg
      width="186"
      height="108"
      viewBox="0 0 186 108"
      className="shrink-0"
      aria-label={`${spec.fingerLabel} ${spec.reachLabel} 到达 ${targetChar} 键`}
    >
      {keys.map((item) => {
        const isTarget = item.k === targetChar;
        const isHome = item.k === homeChar;
        const isHomingBump = item.k === 'F' || item.k === 'J';
        return (
          <g key={item.k}>
            <rect
              x={item.x}
              y={item.y}
              width="28"
              height="28"
              rx="6"
              fill={
                isTarget
                  ? isWash
                    ? 'rgba(176, 46, 36, 0.16)'
                    : 'rgba(232, 92, 68, 0.22)'
                  : isHome
                    ? 'var(--dojo-surface-inset)'
                    : 'transparent'
              }
              stroke={
                isTarget
                  ? 'var(--dojo-crimson)'
                  : isHome
                    ? 'var(--dojo-text-sub)'
                    : 'var(--dojo-border)'
              }
              strokeWidth={isTarget ? 1.8 : isHome ? 1.3 : 1}
              strokeDasharray={!isTarget && isHome ? '3 2' : undefined}
            />
            <text
              x={item.x + 14}
              y={item.y + 18}
              textAnchor="middle"
              fontSize="11"
              fontWeight={isTarget ? '700' : '500'}
              fontFamily="JetBrains Mono, monospace"
              fill={isTarget ? 'var(--dojo-crimson-text)' : 'var(--dojo-text-sub)'}
            >
              {item.k}
            </text>
            {isHomingBump && (
              <line
                x1={item.x + 9}
                y1={item.y + 23}
                x2={item.x + 19}
                y2={item.y + 23}
                stroke={isTarget ? 'var(--dojo-crimson)' : 'var(--dojo-text-sub)'}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}

      {/* Reach Vector Arrow, Return Rebound Arrow, or Steady-Home Concentric Halo */}
      {homePos && targetPos && !isHomePress && dist > 6 && (
        <g>
          {syncBeat === 'rebound' ? (
            <>
              <line
                x1={endX}
                y1={endY}
                x2={startX}
                y2={startY}
                stroke={isWash ? '#C4791C' : '#F3B248'}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <polygon
                points={`${startX - Math.cos(ang) * 3},${startY - Math.sin(ang) * 3} ${startX + headSize * Math.cos(ang - 0.55)},${startY + headSize * Math.sin(ang - 0.55)} ${startX + headSize * Math.cos(ang + 0.55)},${startY + headSize * Math.sin(ang + 0.55)}`}
                fill={isWash ? '#C4791C' : '#F3B248'}
              />
            </>
          ) : (
            <>
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={syncBeat === 'travel' ? 'var(--dojo-pine)' : 'var(--dojo-crimson)'}
                strokeWidth={syncBeat === 'travel' ? '2.8' : '2.2'}
                strokeLinecap="round"
              />
              <polygon
                points={`${endX + Math.cos(ang) * 3},${endY + Math.sin(ang) * 3} ${p1x},${p1y} ${p2x},${p2y}`}
                fill={syncBeat === 'travel' ? 'var(--dojo-pine)' : 'var(--dojo-crimson)'}
              />
            </>
          )}
        </g>
      )}

      {homePos && isHomePress && (
        <circle
          cx={hx}
          cy={hy}
          r={syncBeat === 'impact' ? '20' : syncBeat === 'rebound' ? '15' : '17'}
          fill="none"
          stroke={
            syncBeat === 'rebound'
              ? isWash
                ? '#C4791C'
                : '#F3B248'
              : 'var(--dojo-crimson)'
          }
          strokeWidth={syncBeat === 'impact' ? '2.4' : '1.5'}
          strokeDasharray={syncBeat === 'impact' ? undefined : '3 3'}
          strokeOpacity={syncBeat === 'impact' ? '0.94' : '0.75'}
        />
      )}

      {/* Beat 2 Keypress Impact Ring on target keycap */}
      {targetPos && !isHomePress && syncBeat === 'impact' && (
        <rect
          x={targetPos.x - 3}
          y={targetPos.y - 3}
          width="34"
          height="34"
          rx="8"
          fill="none"
          stroke="var(--dojo-crimson)"
          strokeWidth="2"
          strokeOpacity="0.85"
        />
      )}
    </svg>
  );
};

export const TwentyKeyTopologyTheater: React.FC<TwentyKeyTopologyTheaterProps> = ({
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  initialKey = 'h',
  onOpenMuscleTrainer,
  onOpenTopologicalPalace,
  onOpenPracticeStudio,
  onBackToDojo,
}) => {
  const [activeKey, setActiveKey] = useState<string>(() =>
    TWENTY_KEY_MORPH_BY_KEY.has(initialKey) ? initialKey : 'h'
  );
  const [nodeIdx, setNodeIdx] = useState(0);
  const [prevNodeSnapshot, setPrevNodeSnapshot] = useState<RadicalMorphNode | null>(null);
  const [playTick, setPlayTick] = useState(1);
  const [autoMode, setAutoMode] = useState<'key_loop' | 'all_tour' | 'paused'>('key_loop');
  const [slowMotion, setSlowMotion] = useState(false);
  const [skeletonOnly, setSkeletonOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'converge' | 'two_beat' | 'calligraphy'>('converge');
  const [phaseLabel, setPhaseLabel] = useState<'morph' | 'core' | 'bloom' | 'hold'>('core');
  const [twoBeatPhase, setTwoBeatPhase] = useState<'travel' | 'impact' | 'rebound' | 'hold'>('travel');
  const [convergePhase, setConvergePhase] = useState<'whole' | 'converge' | 'lock' | 'hold'>('whole');
  const [lastStruckKey, setLastStruckKey] = useState<string | null>(null);
  const [cloudPdfOpen, setCloudPdfOpen] = useState<boolean>(false);

  const { printUrls, isPreparingPrint, triggerPrint } = useTopologyAtlasPrint({
    showGhostGlyph: !skeletonOnly,
    showWatermark: false,
    showFingerVector: true,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isWash = themeMode === 'wash';

  const activeSpec = TWENTY_KEY_MORPH_BY_KEY.get(activeKey) ?? TWENTY_KEY_MORPHS[0];
  const activeKeyPosition = TWENTY_KEY_MORPHS.findIndex((s) => s.key === activeSpec.key);
  const currentNode = activeSpec.nodes[nodeIdx] ?? activeSpec.nodes[0];
  const activeMotor = KEY_MOTOR_PROFILES[activeSpec.key] ?? KEY_MOTOR_PROFILES.q;
  const twoBeatData: TwoBeatDecomposition = useMemo(
    () => buildTwoBeatDecomposition(activeSpec.key, currentNode),
    [activeSpec.key, currentNode]
  );
  const convergenceData: CornerConvergenceData = useMemo(
    () => buildCornerConvergenceData(activeSpec.key, currentNode),
    [activeSpec.key, currentNode]
  );
  const allSimpRadicals = useMemo(
    () => getSimpRadicalsForMorphKey(activeSpec.key),
    [activeSpec.key]
  );

  const flashDeckKey = useCallback((k: string) => {
    setLastStruckKey(k);
    window.setTimeout(() => {
      setLastStruckKey((prev) => (prev === k ? null : prev));
    }, 180);
  }, []);

  const selectKey = useCallback(
    (nextKey: string, fromUser = true) => {
      const target = TWENTY_KEY_MORPH_BY_KEY.get(nextKey);
      if (!target) return;
      flashDeckKey(nextKey);
      if (nextKey === activeSpec.key) {
        // Same key pressed again -> morph smoothly to next radical of this key!
        const nextNodeIdx = (nodeIdx + 1) % target.nodes.length;
        setPrevNodeSnapshot(currentNode);
        setNodeIdx(nextNodeIdx);
        setPlayTick((t) => t + 1);
        if (fromUser) synth.playKeyHit(nextNodeIdx + 1, nextNodeIdx === target.nodes.length - 1);
      } else {
        // Different key -> smoothly transition to its mother archetype
        setPrevNodeSnapshot(currentNode);
        setActiveKey(nextKey);
        setNodeIdx(0);
        setPlayTick((t) => t + 1);
        if (fromUser) synth.playKeyHit(1, false);
      }
    },
    [activeSpec.key, currentNode, flashDeckKey, nodeIdx]
  );

  const selectRadicalNode = useCallback(
    (idx: number) => {
      setPrevNodeSnapshot(currentNode);
      setNodeIdx(idx);
      setPlayTick((t) => t + 1);
      synth.playKeyHit(idx + 1, idx === activeSpec.nodes.length - 1);
    },
    [activeSpec.nodes.length, currentNode]
  );

  const stepAdjacentKey = useCallback(
    (delta: number) => {
      const nextPos =
        (activeKeyPosition + delta + TWENTY_KEY_MORPHS.length) % TWENTY_KEY_MORPHS.length;
      const nextSpec = TWENTY_KEY_MORPHS[nextPos];
      setPrevNodeSnapshot(currentNode);
      setActiveKey(nextSpec.key);
      setNodeIdx(0);
      setPlayTick((t) => t + 1);
      flashDeckKey(nextSpec.key);
      synth.playClick();
    },
    [activeKeyPosition, currentNode, flashDeckKey]
  );

  // Physical keyboard listener: press ANY of the 20 consonant keys directly!
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (cloudPdfOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (TWENTY_KEY_MORPH_BY_KEY.has(k)) {
        e.preventDefault();
        selectKey(k, true);
      } else if (k === ' ') {
        e.preventDefault();
        setPrevNodeSnapshot(currentNode);
        setPlayTick((t) => t + 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepAdjacentKey(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepAdjacentKey(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cloudPdfOpen, currentNode, selectKey, stepAdjacentKey]);

  // Auto-cycle timer ('key_loop' loops radicals inside current key; 'all_tour' walks all 20 keys!)
  useEffect(() => {
    if (autoMode === 'paused') return;
    const cycleMs = slowMotion ? 4500 : 3000;
    const timer = window.setTimeout(() => {
      if (autoMode === 'key_loop') {
        const nextIdx = (nodeIdx + 1) % activeSpec.nodes.length;
        setPrevNodeSnapshot(currentNode);
        setNodeIdx(nextIdx);
        setPlayTick((t) => t + 1);
      } else if (autoMode === 'all_tour') {
        // Show 2 exemplars per key, then glide to the next key in QWERTY order
        if (nodeIdx < Math.min(1, activeSpec.nodes.length - 1)) {
          setPrevNodeSnapshot(currentNode);
          setNodeIdx(nodeIdx + 1);
          setPlayTick((t) => t + 1);
        } else {
          const nextPos = (activeKeyPosition + 1) % TWENTY_KEY_MORPHS.length;
          setPrevNodeSnapshot(currentNode);
          setActiveKey(TWENTY_KEY_MORPHS[nextPos].key);
          setNodeIdx(0);
          setPlayTick((t) => t + 1);
        }
      }
    }, cycleMs);
    return () => window.clearTimeout(timer);
  }, [autoMode, slowMotion, nodeIdx, playTick, activeSpec, activeKeyPosition, currentNode]);

  // Living 60fps HTML5 Canvas Engine: supports BOTH Two-Beat Kinetic Mode & Calligraphic Morph Mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 410;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const coreRgb = isWash ? '176, 46, 36' : '232, 92, 68';
    const pineRgb = isWash ? '28, 114, 94' : '68, 210, 174';
    const amberRgb = isWash ? '194, 118, 24' : '244, 178, 72';
    const inkRgb = isWash ? '22, 22, 20' : '242, 236, 226';
    const speed = slowMotion ? 0.56 : 1;
    const startTime = performance.now();
    let rafId = 0;

    if (viewMode === 'converge') {
      // === WHOLE-GLYPH LUMINOUS DECAY CONVERGENCE ENGINE ===
      //   1. Whole glyph is immediately visible (we already know its shape!)
      //   2. Outer stroke pillars rapidly decay & drain luminous streams inward toward the key's corner/wing
      //   3. Decisive little corner/wing (┌ or <) locks in glowing Vermilion!
      const cornerArmSampled = convergenceData.cornerArms.map((s) =>
        sampleCatmullRom(s.points, 36)
      );
      const wholeDur = Math.round(280 / speed);
      const decayDur = Math.round(880 / speed);
      const lockDur = Math.round(420 / speed);
      const decayEnd = wholeDur + decayDur;
      const lockEnd = decayEnd + lockDur;
      let lastCPhase: 'whole' | 'converge' | 'lock' | 'hold' | null = null;

      const reportCPhase = (p: 'whole' | 'converge' | 'lock' | 'hold') => {
        if (lastCPhase !== p) {
          lastCPhase = p;
          setConvergePhase(p);
        }
      };

      const drawConverge = (now: number) => {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, size, size);
        drawMiZiPaper(ctx, size, isWash);

        // Subtle watermark of known radical on Xuan paper
        ctx.save();
        ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.04)' : 'rgba(244, 239, 230, 0.04)';
        ctx.font = '700 268px "Noto Serif SC", "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentNode.radical, size * 0.5, size * 0.53);
        ctx.restore();

        if (elapsed < wholeDur) {
          reportCPhase('whole');
          const wt = elapsed / Math.max(1, wholeDur);
          convergenceData.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              coreRgb,
              amberRgb,
              0,
              isWash,
              skeletonOnly
            );
          });
          // Subtle anticipatory cue before light decay begins
          const pad = size * 0.09;
          const inner = size - pad * 2;
          if (convergenceData.targetMode === 'point_corner') {
            const vx = pad + convergenceData.cornerVertex.x * inner;
            const vy = pad + convergenceData.cornerVertex.y * inner;
            ctx.save();
            ctx.strokeStyle = `rgba(${coreRgb}, ${0.24 + wt * 0.36})`;
            ctx.lineWidth = 1.4;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(vx, vy, 20 - wt * 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          } else {
            ctx.save();
            ctx.strokeStyle = `rgba(${coreRgb}, ${0.14 + wt * 0.22})`;
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            cornerArmSampled.forEach((sampled) => {
              if (sampled.length < 2) return;
              ctx.beginPath();
              sampled.forEach((pt, idx) => {
                const px = pad + pt.x * inner;
                const py = pad + pt.y * inner;
                if (idx === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              });
              ctx.stroke();
            });
            if (convergenceData.virtualLinks?.length) {
              ctx.strokeStyle = `rgba(${coreRgb}, ${0.28 + wt * 0.32})`;
              ctx.lineWidth = 2.6;
              ctx.setLineDash([5, 5]);
              convergenceData.virtualLinks.forEach((link) => {
                ctx.beginPath();
                ctx.moveTo(pad + link.from.x * inner, pad + link.from.y * inner);
                ctx.lineTo(pad + link.to.x * inner, pad + link.to.y * inner);
                ctx.stroke();
              });
              ctx.setLineDash([]);
            }
            if (convergenceData.negativeBox) {
              const nb = convergenceData.negativeBox;
              ctx.fillStyle = `rgba(${amberRgb}, ${0.08 + wt * 0.1})`;
              ctx.fillRect(pad + nb.x * inner, pad + nb.y * inner, nb.w * inner, nb.h * inner);
              ctx.strokeStyle = `rgba(${coreRgb}, ${0.26 + wt * 0.34})`;
              ctx.lineWidth = 1.6;
              ctx.setLineDash([5, 4]);
              ctx.strokeRect(pad + nb.x * inner, pad + nb.y * inner, nb.w * inner, nb.h * inner);
              ctx.setLineDash([]);
            }
            if (convergenceData.accentBeads?.length) {
              ctx.fillStyle = `rgba(${coreRgb}, ${0.32 + wt * 0.36})`;
              convergenceData.accentBeads.forEach((b) => {
                ctx.beginPath();
                ctx.arc(pad + b.x * inner, pad + b.y * inner, 5.2, 0, Math.PI * 2);
                ctx.fill();
              });
            }
            if (convergenceData.embraceArc) {
              const ea = convergenceData.embraceArc;
              ctx.strokeStyle = `rgba(${coreRgb}, ${0.26 + wt * 0.34})`;
              ctx.lineWidth = 2.6;
              ctx.setLineDash([7, 5]);
              ctx.beginPath();
              ctx.moveTo(pad + ea.start.x * inner, pad + ea.start.y * inner);
              ctx.quadraticCurveTo(
                pad + ea.ctrl.x * inner,
                pad + ea.ctrl.y * inner,
                pad + ea.end.x * inner,
                pad + ea.end.y * inner
              );
              ctx.stroke();
              ctx.setLineDash([]);
            }
            ctx.restore();
          }
        } else if (elapsed < decayEnd) {
          reportCPhase('converge');
          const rawT = (elapsed - wholeDur) / Math.max(1, decayDur);
          // Smooth acceleration curve so outer light drains swiftly into the corner
          const convP = Math.max(0, Math.min(1, Math.pow(rawT, 1.25)));

          convergenceData.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              coreRgb,
              amberRgb,
              convP,
              isWash,
              skeletonOnly
            );
          });

          drawInwardPillarLightStreams(
            ctx,
            convergenceData,
            size,
            coreRgb,
            amberRgb,
            convP,
            isWash
          );

          drawCrystallizedCornerMark(
            ctx,
            convergenceData,
            cornerArmSampled,
            size,
            coreRgb,
            amberRgb,
            convP - 1, // ramps smoothly from -1..0 as energy concentrates
            isWash
          );
        } else if (elapsed < lockEnd) {
          reportCPhase('lock');
          const lt = (elapsed - decayEnd) / Math.max(1, lockDur);
          convergenceData.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              coreRgb,
              amberRgb,
              1,
              isWash,
              skeletonOnly
            );
          });
          drawCrystallizedCornerMark(
            ctx,
            convergenceData,
            cornerArmSampled,
            size,
            coreRgb,
            amberRgb,
            lt,
            isWash
          );
        } else {
          reportCPhase('hold');
          const holdSec = (elapsed - lockEnd) / 1000;
          convergenceData.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              coreRgb,
              amberRgb,
              1,
              isWash,
              skeletonOnly
            );
          });
          drawCrystallizedCornerMark(
            ctx,
            convergenceData,
            cornerArmSampled,
            size,
            coreRgb,
            amberRgb,
            1.1 + holdSec,
            isWash
          );
        }

        // Top-left crisp focus anchor label inside Xuan paper
        ctx.save();
        ctx.fillStyle = `rgba(${coreRgb}, 0.9)`;
        ctx.font = '700 11px "JetBrains Mono", "Noto Serif SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
          `${activeSpec.key.toUpperCase()} 键定形 · ${convergenceData.shapeLabel}`,
          size * 0.11,
          size * 0.105
        );
        ctx.restore();

        // Personalized 2-character vertical red seal stamp
        ctx.save();
        const sx = size - 42;
        const sy = size - 54;
        ctx.strokeStyle = `rgba(${coreRgb}, 0.72)`;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(sx, sy, 22, 34);
        ctx.fillStyle = `rgba(${coreRgb}, 0.86)`;
        ctx.font = '700 12px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeSpec.sealText[0], sx + 11, sy + 10);
        ctx.fillText(activeSpec.sealText[1], sx + 11, sy + 24);
        ctx.restore();

        rafId = window.requestAnimationFrame(drawConverge);
      };

      rafId = window.requestAnimationFrame(drawConverge);
      return () => window.cancelAnimationFrame(rafId);
    }

    if (viewMode === 'two_beat') {
      // === 3-BEAT KINEMATIC ENGINE ===
      //   - Home-Row Vertical Keys (S D F J K L): core_bloom -> ① 原位定核 -> ② 由核扩散 -> ③ 垂立归位
      //   - 14 Travel Keys: stroke_sweep / motif_glide -> ① 起势外移 -> ② 击键遇阻 -> ③ 廓阻弹回
      const isCoreBloom =
        twoBeatData.kineticMode === 'core_bloom' && Boolean(twoBeatData.coreBloom);
      const isMotifGlide =
        twoBeatData.kineticMode === 'motif_glide' && Boolean(twoBeatData.motifGlide);

      const trajSampled = sampleCatmullRom(twoBeatData.trajectoryStroke.points, 64);
      const stopSampled = twoBeatData.stopStrokes.map((s) => ({
        stroke: s,
        sampled: sampleCatmullRom(s.points, 54),
      }));
      const coreBloomSampled = isCoreBloom
        ? {
            cores: twoBeatData.coreBloom!.coreStrokes.map((s) => ({
              stroke: s,
              sampled: sampleCatmullRom(s.points, 58),
            })),
            outers: twoBeatData.coreBloom!.outerStrokes.map((s) => ({
              stroke: s,
              sampled: sampleCatmullRom(s.points, 52),
            })),
            anchor: twoBeatData.coreBloom!.anchorPoint,
            shapeKind: twoBeatData.coreBloom!.shapeKind,
          }
        : null;
      const glideSampled = isMotifGlide
        ? twoBeatData.motifGlide!.movingStrokes.map((s) => ({
            stroke: s,
            sampled: sampleCatmullRom(s.points, 54),
          }))
        : [];
      const shiftSampled = (pts: Sampled[], dx: number, dy: number): Sampled[] =>
        pts.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy }));

      const beat1Dur = Math.round((isCoreBloom ? 640 : 720) / speed);
      const beat2Dur = skeletonOnly ? 0 : Math.round((isCoreBloom ? 620 : 420) / speed);
      const beat3Dur = skeletonOnly ? 0 : Math.round((isCoreBloom ? 360 : 480) / speed);
      const beat1End = beat1Dur;
      const beat2End = beat1End + beat2Dur;
      const totalMs = beat2End + beat3Dur;
      let lastBeat: 'travel' | 'impact' | 'rebound' | 'hold' | null = null;

      const reportBeat = (b: 'travel' | 'impact' | 'rebound' | 'hold') => {
        if (lastBeat !== b) {
          lastBeat = b;
          setTwoBeatPhase(b);
        }
      };

      const drawTwoBeat = (now: number) => {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, size, size);
        drawMiZiPaper(ctx, size, isWash);

        // Subtle watermark of current radical on Xuan paper
        ctx.save();
        ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.042)' : 'rgba(244, 239, 230, 0.042)';
        ctx.font = '700 268px "Noto Serif SC", "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentNode.radical, size * 0.5, size * 0.53);
        ctx.restore();

        let brushTip: { x: number; y: number; pressure: number; tone: 'pine' | 'crimson' } | null =
          null;

        if (isCoreBloom && coreBloomSampled) {
          // === HOME-ROW VERTICAL KEY CHOREOGRAPHY (S, D, F, J, K, L): Core Anchor -> Outward Diffusion -> Upright Return ===
          if (elapsed < beat1End) {
            reportBeat('travel');
            const p = Math.max(0, Math.min(1, elapsed / Math.max(1, beat1Dur)));

            if (!skeletonOnly) {
              coreBloomSampled.outers.forEach((o) => {
                drawBrushSampled(
                  ctx,
                  o.sampled,
                  1,
                  size,
                  inkRgb,
                  0.07,
                  Boolean(o.stroke.dunbiStart),
                  Boolean(o.stroke.flickEnd)
                );
              });
            }

            const nC = coreBloomSampled.cores.length;
            coreBloomSampled.cores.forEach((c, idx) => {
              const slotStart = nC <= 1 ? 0 : idx * 0.42;
              const slotDur = nC <= 1 ? 1 : idx === 0 ? 0.54 : 0.58;
              const localP = Math.max(0, Math.min(1, (p - slotStart) / slotDur));
              if (localP > 0) {
                const h = drawBrushSampled(
                  ctx,
                  c.sampled,
                  localP,
                  size,
                  coreRgb,
                  0.98,
                  Boolean(c.stroke.dunbiStart),
                  Boolean(c.stroke.flickEnd)
                );
                if (localP < 0.995 && h) {
                  brushTip = { x: h.headX, y: h.headY, pressure: h.pressure, tone: 'crimson' };
                }
              }
            });

            drawCoreBloomDiffusion(
              ctx,
              coreBloomSampled.anchor,
              coreBloomSampled.shapeKind,
              size,
              coreRgb,
              0,
              0.55 + p * 0.45
            );
          } else if (elapsed < beat2End) {
            reportBeat('impact');
            const it = Math.max(0, Math.min(1, (elapsed - beat1End) / Math.max(1, beat2Dur)));

            drawCoreBloomDiffusion(
              ctx,
              coreBloomSampled.anchor,
              coreBloomSampled.shapeKind,
              size,
              coreRgb,
              it,
              0.95
            );

            // Outer strokes expand outward from core sequentially-smoothly
            const nOut = coreBloomSampled.outers.length;
            if (nOut > 0) {
              const perSlot = 1 / nOut;
              coreBloomSampled.outers.forEach((o, i) => {
                const startF = i * perSlot * 0.55;
                const durF = Math.max(0.35, perSlot * 1.3);
                const localP = Math.max(0, Math.min(1, (it - startF) / durF));
                if (localP > 0) {
                  drawBrushSampled(
                    ctx,
                    o.sampled,
                    localP,
                    size,
                    inkRgb,
                    0.92,
                    Boolean(o.stroke.dunbiStart),
                    Boolean(o.stroke.flickEnd)
                  );
                }
              });
            }

            // Shared core invariant stays locked in luminous Vermilion
            coreBloomSampled.cores.forEach((c) => {
              drawBrushSampled(
                ctx,
                c.sampled,
                1,
                size,
                coreRgb,
                0.98,
                Boolean(c.stroke.dunbiStart),
                Boolean(c.stroke.flickEnd)
              );
            });
          } else if (elapsed < totalMs) {
            reportBeat('rebound');
            const rt = Math.max(0, Math.min(1, (elapsed - beat2End) / Math.max(1, beat3Dur)));

            if (!skeletonOnly) {
              coreBloomSampled.outers.forEach((o) => {
                drawBrushSampled(
                  ctx,
                  o.sampled,
                  1,
                  size,
                  inkRgb,
                  0.92,
                  Boolean(o.stroke.dunbiStart),
                  Boolean(o.stroke.flickEnd)
                );
              });
            }
            coreBloomSampled.cores.forEach((c) => {
              drawBrushSampled(
                ctx,
                c.sampled,
                1,
                size,
                coreRgb,
                0.98,
                Boolean(c.stroke.dunbiStart),
                Boolean(c.stroke.flickEnd)
              );
            });
            drawCoreBloomDiffusion(
              ctx,
              coreBloomSampled.anchor,
              coreBloomSampled.shapeKind,
              size,
              coreRgb,
              1.5,
              0.8
            );
            // Gentle vertical rebound lift confirmation at the anchor
            drawReboundBounceGuide(
              ctx,
              twoBeatData.reboundPoint,
              twoBeatData.reboundTarget,
              size,
              amberRgb,
              rt,
              0.78
            );
          } else {
            reportBeat('hold');
            if (!skeletonOnly) {
              coreBloomSampled.outers.forEach((o) => {
                drawBrushSampled(
                  ctx,
                  o.sampled,
                  1,
                  size,
                  inkRgb,
                  0.92,
                  Boolean(o.stroke.dunbiStart),
                  Boolean(o.stroke.flickEnd)
                );
              });
              drawCoreBloomDiffusion(
                ctx,
                coreBloomSampled.anchor,
                coreBloomSampled.shapeKind,
                size,
                coreRgb,
                1.5,
                0.75
              );
            }
            coreBloomSampled.cores.forEach((c) => {
              drawBrushSampled(
                ctx,
                c.sampled,
                1,
                size,
                coreRgb,
                0.98,
                Boolean(c.stroke.dunbiStart),
                Boolean(c.stroke.flickEnd)
              );
            });
          }
        } else if (elapsed < beat1End) {
          // === TRAVEL KEYS BEAT 1: Finger Outreach (Pine-Jade) ===
          reportBeat('travel');
          const p = Math.max(0, Math.min(1, elapsed / Math.max(1, beat1Dur)));

          if (!skeletonOnly) {
            stopSampled.forEach((st) => {
              drawBrushSampled(
                ctx,
                st.sampled,
                1,
                size,
                coreRgb,
                0.08,
                Boolean(st.stroke.dunbiStart),
                Boolean(st.stroke.flickEnd)
              );
            });
          }

          drawFingerVectorGuide(ctx, trajSampled, size, pineRgb, 0.92);

          if (isMotifGlide && twoBeatData.motifGlide) {
            const { fromOffset, toOffset } = twoBeatData.motifGlide;
            const ep = easeInOutCubic(p);
            const curDx = fromOffset.x + (toOffset.x - fromOffset.x) * ep;
            const curDy = fromOffset.y + (toOffset.y - fromOffset.y) * ep;

            glideSampled.forEach((g) => {
              drawBrushSampled(
                ctx,
                shiftSampled(g.sampled, fromOffset.x, fromOffset.y),
                1,
                size,
                pineRgb,
                0.2,
                Boolean(g.stroke.dunbiStart),
                Boolean(g.stroke.flickEnd)
              );
            });

            glideSampled.forEach((g, gIdx) => {
              const shifted = shiftSampled(g.sampled, curDx, curDy);
              const head = drawBrushSampled(
                ctx,
                shifted,
                1,
                size,
                pineRgb,
                0.96,
                Boolean(g.stroke.dunbiStart),
                Boolean(g.stroke.flickEnd)
              );
              if (gIdx === 0 && head && p < 0.995) {
                brushTip = {
                  x: head.headX,
                  y: head.headY,
                  pressure: head.pressure,
                  tone: 'pine',
                };
              }
            });
          } else {
            const head = drawBrushSampled(
              ctx,
              trajSampled,
              p,
              size,
              pineRgb,
              0.98,
              Boolean(twoBeatData.trajectoryStroke.dunbiStart),
              Boolean(twoBeatData.trajectoryStroke.flickEnd)
            );
            if (head && p < 0.995) {
              brushTip = { x: head.headX, y: head.headY, pressure: head.pressure, tone: 'pine' };
            }
          }
        } else if (elapsed < beat2End) {
          // === TRAVEL KEYS BEAT 2: Strike & Resistance Lock (Vermilion) ===
          reportBeat('impact');
          const it = Math.max(0, Math.min(1, (elapsed - beat1End) / Math.max(1, beat2Dur)));
          const snapEase = 1 - Math.pow(1 - it, 3);

          drawFingerVectorGuide(ctx, trajSampled, size, pineRgb, 0.45 * (1 - it * 0.4));

          if (isMotifGlide && twoBeatData.motifGlide) {
            const { fromOffset } = twoBeatData.motifGlide;
            glideSampled.forEach((g) => {
              drawBrushSampled(
                ctx,
                shiftSampled(g.sampled, fromOffset.x, fromOffset.y),
                1,
                size,
                pineRgb,
                0.22 * (1 - it * 0.45),
                Boolean(g.stroke.dunbiStart),
                Boolean(g.stroke.flickEnd)
              );
            });

            stopSampled.forEach((st) => {
              drawBrushSampled(
                ctx,
                st.sampled,
                Math.min(1, 0.35 + snapEase * 0.65),
                size,
                coreRgb,
                0.42 + snapEase * 0.56,
                Boolean(st.stroke.dunbiStart),
                Boolean(st.stroke.flickEnd)
              );
            });
          } else {
            stopSampled.forEach((st) => {
              drawBrushSampled(
                ctx,
                st.sampled,
                Math.min(1, 0.25 + snapEase * 0.75),
                size,
                coreRgb,
                0.35 + snapEase * 0.62,
                Boolean(st.stroke.dunbiStart),
                Boolean(st.stroke.flickEnd)
              );
            });

            drawBrushSampled(
              ctx,
              trajSampled,
              1,
              size,
              pineRgb,
              0.98,
              Boolean(twoBeatData.trajectoryStroke.dunbiStart),
              Boolean(twoBeatData.trajectoryStroke.flickEnd)
            );
          }

          drawStopImpactRipple(ctx, twoBeatData.impactPoint, size, coreRgb, it);
        } else if (elapsed < totalMs) {
          // === TRAVEL KEYS BEAT 3: Contour Elastic Rebound Homeward (Amber-Gold) ===
          reportBeat('rebound');
          const rt = Math.max(0, Math.min(1, (elapsed - beat2End) / Math.max(1, beat3Dur)));

          drawFingerVectorGuide(ctx, trajSampled, size, pineRgb, 0.28);

          if (isMotifGlide && twoBeatData.motifGlide) {
            const { fromOffset } = twoBeatData.motifGlide;
            glideSampled.forEach((g) => {
              drawBrushSampled(
                ctx,
                shiftSampled(g.sampled, fromOffset.x, fromOffset.y),
                1,
                size,
                pineRgb,
                0.16,
                Boolean(g.stroke.dunbiStart),
                Boolean(g.stroke.flickEnd)
              );
            });
            stopSampled.forEach((st) => {
              drawBrushSampled(
                ctx,
                st.sampled,
                1,
                size,
                coreRgb,
                0.95,
                Boolean(st.stroke.dunbiStart),
                Boolean(st.stroke.flickEnd)
              );
            });
          } else {
            stopSampled.forEach((st) => {
              drawBrushSampled(
                ctx,
                st.sampled,
                1,
                size,
                coreRgb,
                0.94,
                Boolean(st.stroke.dunbiStart),
                Boolean(st.stroke.flickEnd)
              );
            });
            drawBrushSampled(
              ctx,
              trajSampled,
              1,
              size,
              pineRgb,
              0.98,
              Boolean(twoBeatData.trajectoryStroke.dunbiStart),
              Boolean(twoBeatData.trajectoryStroke.flickEnd)
            );
          }

          // Highlight outer wall contour bouncing finger back toward home key!
          drawReboundBounceGuide(
            ctx,
            twoBeatData.reboundPoint,
            twoBeatData.reboundTarget,
            size,
            amberRgb,
            rt,
            1
          );
        } else {
          // === TRAVEL KEYS RESTING HOLD ===
          reportBeat('hold');
          const holdSec = (elapsed - totalMs) / 1000;

          drawFingerVectorGuide(ctx, trajSampled, size, pineRgb, 0.28);

          if (isMotifGlide && twoBeatData.motifGlide) {
            const { fromOffset } = twoBeatData.motifGlide;
            glideSampled.forEach((g) => {
              drawBrushSampled(
                ctx,
                shiftSampled(g.sampled, fromOffset.x, fromOffset.y),
                1,
                size,
                pineRgb,
                skeletonOnly ? 0.88 : 0.16,
                Boolean(g.stroke.dunbiStart),
                Boolean(g.stroke.flickEnd)
              );
            });

            if (skeletonOnly) {
              glideSampled.forEach((g) => {
                drawBrushSampled(
                  ctx,
                  g.sampled,
                  1,
                  size,
                  pineRgb,
                  0.96,
                  Boolean(g.stroke.dunbiStart),
                  Boolean(g.stroke.flickEnd)
                );
              });
            } else {
              stopSampled.forEach((st) => {
                drawBrushSampled(
                  ctx,
                  st.sampled,
                  1,
                  size,
                  coreRgb,
                  0.95,
                  Boolean(st.stroke.dunbiStart),
                  Boolean(st.stroke.flickEnd)
                );
              });
              drawStopImpactRipple(ctx, twoBeatData.impactPoint, size, coreRgb, 1.2 + holdSec);
              drawReboundBounceGuide(
                ctx,
                twoBeatData.reboundPoint,
                twoBeatData.reboundTarget,
                size,
                amberRgb,
                1.5,
                0.55
              );
            }
          } else {
            if (!skeletonOnly) {
              stopSampled.forEach((st) => {
                drawBrushSampled(
                  ctx,
                  st.sampled,
                  1,
                  size,
                  coreRgb,
                  0.94,
                  Boolean(st.stroke.dunbiStart),
                  Boolean(st.stroke.flickEnd)
                );
              });
              drawStopImpactRipple(ctx, twoBeatData.impactPoint, size, coreRgb, 1.2 + holdSec);
              drawReboundBounceGuide(
                ctx,
                twoBeatData.reboundPoint,
                twoBeatData.reboundTarget,
                size,
                amberRgb,
                1.5,
                0.55
              );
            }

            drawBrushSampled(
              ctx,
              trajSampled,
              1,
              size,
              pineRgb,
              0.98,
              Boolean(twoBeatData.trajectoryStroke.dunbiStart),
              Boolean(twoBeatData.trajectoryStroke.flickEnd)
            );
          }
        }

        if (brushTip) {
          drawCalligraphyBrushTip(
            ctx,
            brushTip.x,
            brushTip.y,
            brushTip.pressure,
            brushTip.tone,
            isWash
          );
        }

        // Top-left tactile vector badge right inside Xuan paper corner
        ctx.save();
        ctx.fillStyle = `rgba(${isCoreBloom ? coreRgb : pineRgb}, 0.88)`;
        ctx.font = '700 11px "JetBrains Mono", "Noto Serif SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(
          isCoreBloom
            ? `${activeSpec.key.toUpperCase()} 原位垂直 · ${twoBeatData.originCornerText}`
            : `${activeSpec.homeKey}→${activeSpec.key.toUpperCase()} ${activeMotor.arrowSymbol}`,
          size * 0.11,
          size * 0.105
        );
        ctx.restore();

        // Personalized 2-character vertical red seal stamp
        ctx.save();
        const sx = size - 42;
        const sy = size - 54;
        ctx.strokeStyle = `rgba(${coreRgb}, 0.72)`;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(sx, sy, 22, 34);
        ctx.fillStyle = `rgba(${coreRgb}, 0.86)`;
        ctx.font = '700 12px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeSpec.sealText[0], sx + 11, sy + 10);
        ctx.fillText(activeSpec.sealText[1], sx + 11, sy + 24);
        ctx.restore();

        rafId = window.requestAnimationFrame(drawTwoBeat);
      };

      rafId = window.requestAnimationFrame(drawTwoBeat);
      return () => window.cancelAnimationFrame(rafId);
    }

    // === CLASSIC CALLIGRAPHY MORPH MODE (Vermilion Core + Sumi Extras) ===
    const currCores = currentNode.coreStrokes.map((s) => ({
      stroke: s,
      sampled: sampleCatmullRom(s.points, 64),
    }));
    const prevSource = prevNodeSnapshot ?? currentNode;
    const prevCores = prevSource.coreStrokes.map((s) => sampleCatmullRom(s.points, 64));
    const currExtras = currentNode.extraStrokes.map((s) => ({
      stroke: s,
      sampled: sampleCatmullRom(s.points, 54),
    }));

    const isMorphingFromDifferent = prevSource.id !== currentNode.id;

    const morphDur = isMorphingFromDifferent ? Math.round(580 / speed) : 0;
    const coreDur = Math.round((currCores.length > 1 ? 820 : 620) / speed);
    const extraDur =
      !skeletonOnly && currExtras.length > 0
        ? Math.round((380 + currExtras.length * 185) / speed)
        : 0;
    const totalAnimMs = morphDur + coreDur + extraDur;

    let lastPhase: 'morph' | 'core' | 'bloom' | 'hold' | null = null;

    const reportPhase = (p: 'morph' | 'core' | 'bloom' | 'hold') => {
      if (lastPhase !== p) {
        lastPhase = p;
        setPhaseLabel(p);
      }
    };

    const draw = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, size, size);
      drawMiZiPaper(ctx, size, isWash);

      // Subtle watermark of current radical on Xuan paper
      ctx.save();
      ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.045)' : 'rgba(244, 239, 230, 0.045)';
      ctx.font = '700 268px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(currentNode.radical, size * 0.5, size * 0.53);
      ctx.restore();

      let brushTip: { x: number; y: number; pressure: number; tone: 'crimson' | 'ink' } | null =
        null;

      if (elapsed < morphDur) {
        reportPhase('morph');
        const mt = easeInOutCubic(elapsed / morphDur);
        const morphedList: Sampled[][] = currCores.map((c, idx) => {
          const from = prevCores[Math.min(idx, prevCores.length - 1)] ?? c.sampled;
          return lerpSampled(from, c.sampled, mt);
        });
        drawResonanceField(ctx, morphedList, 0.9, size, coreRgb);
        morphedList.forEach((m, idx) => {
          drawBrushSampled(
            ctx,
            m,
            1,
            size,
            coreRgb,
            0.4 + mt * 0.28,
            Boolean(currCores[idx].stroke.dunbiStart),
            Boolean(currCores[idx].stroke.flickEnd)
          );
        });
      } else if (elapsed < morphDur + coreDur) {
        reportPhase('core');
        const ct = (elapsed - morphDur) / coreDur;
        drawResonanceField(
          ctx,
          currCores.map((c) => c.sampled),
          0.8,
          size,
          coreRgb
        );

        const nCore = currCores.length;
        for (let i = 0; i < nCore; i++) {
          const slotStart = nCore === 1 ? 0 : i * 0.44;
          const slotDur = nCore === 1 ? 1 : i === 0 ? 0.5 : 0.56;
          const localP = Math.max(0, Math.min(1, (ct - slotStart) / slotDur));
          if (localP > 0) {
            const h = drawBrushSampled(
              ctx,
              currCores[i].sampled,
              localP,
              size,
              coreRgb,
              1,
              Boolean(currCores[i].stroke.dunbiStart),
              Boolean(currCores[i].stroke.flickEnd)
            );
            if (localP < 0.995 && h) {
              brushTip = { x: h.headX, y: h.headY, pressure: h.pressure, tone: 'crimson' };
            }
          }
        }
      } else if (elapsed < totalAnimMs) {
        reportPhase('bloom');
        const bt = (elapsed - morphDur - coreDur) / Math.max(1, extraDur);
        drawResonanceField(
          ctx,
          currCores.map((c) => c.sampled),
          0.5 * (1 - bt * 0.5),
          size,
          coreRgb
        );

        const nEx = currExtras.length;
        const perSlot = 1 / nEx;
        for (let i = 0; i < nEx; i++) {
          const startF = i * perSlot * 0.82;
          const durF = perSlot * 1.15;
          const localP = Math.max(0, Math.min(1, (bt - startF) / durF));
          if (localP > 0) {
            const h = drawBrushSampled(
              ctx,
              currExtras[i].sampled,
              localP,
              size,
              inkRgb,
              0.92,
              Boolean(currExtras[i].stroke.dunbiStart),
              Boolean(currExtras[i].stroke.flickEnd)
            );
            if (localP < 0.99 && h) {
              brushTip = { x: h.headX, y: h.headY, pressure: h.pressure, tone: 'ink' };
            }
          }
        }

        currCores.forEach((c) => {
          drawBrushSampled(
            ctx,
            c.sampled,
            1,
            size,
            coreRgb,
            1,
            Boolean(c.stroke.dunbiStart),
            Boolean(c.stroke.flickEnd)
          );
        });
      } else {
        reportPhase('hold');
        const breathe = 0.25 + 0.14 * Math.sin((elapsed - totalAnimMs) / 420);
        drawResonanceField(
          ctx,
          currCores.map((c) => c.sampled),
          breathe,
          size,
          coreRgb
        );

        if (!skeletonOnly) {
          currExtras.forEach((ex) => {
            drawBrushSampled(
              ctx,
              ex.sampled,
              1,
              size,
              inkRgb,
              0.92,
              Boolean(ex.stroke.dunbiStart),
              Boolean(ex.stroke.flickEnd)
            );
          });
        }

        currCores.forEach((c) => {
          drawBrushSampled(
            ctx,
            c.sampled,
            1,
            size,
            coreRgb,
            1,
            Boolean(c.stroke.dunbiStart),
            Boolean(c.stroke.flickEnd)
          );
        });
      }

      if (brushTip) {
        drawCalligraphyBrushTip(
          ctx,
          brushTip.x,
          brushTip.y,
          brushTip.pressure,
          brushTip.tone,
          isWash
        );
      }

      // Personalized 2-character vertical red seal stamp
      ctx.save();
      const sx = size - 42;
      const sy = size - 54;
      ctx.strokeStyle = `rgba(${coreRgb}, 0.72)`;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(sx, sy, 22, 34);
      ctx.fillStyle = `rgba(${coreRgb}, 0.86)`;
      ctx.font = '700 12px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(activeSpec.sealText[0], sx + 11, sy + 10);
      ctx.fillText(activeSpec.sealText[1], sx + 11, sy + 24);
      ctx.restore();

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    activeMotor.arrowSymbol,
    activeSpec.homeKey,
    activeSpec.key,
    activeSpec.sealText,
    convergenceData,
    currentNode,
    prevNodeSnapshot,
    playTick,
    slowMotion,
    skeletonOnly,
    twoBeatData,
    viewMode,
    isWash,
  ]);

  const phaseCaption =
    viewMode === 'converge'
      ? convergePhase === 'whole'
        ? `① 全字既明 · 「${currentNode.radical}」全形在胸`
        : convergePhase === 'converge'
          ? `② 光退敛形 · 四方笔柱光流涌向「${convergenceData.shapeSymbol}」`
          : convergePhase === 'lock'
            ? `③ 击键定形 · 唯余「${convergenceData.shapeLabel}」锁定手感`
            : `④ 识形定键 · 再按 ${activeSpec.key.toUpperCase()} 演下一字根`
      : viewMode === 'two_beat'
        ? twoBeatData.kineticMode === 'core_bloom'
          ? twoBeatPhase === 'travel'
            ? `① 原位定核 · ${activeSpec.key.toUpperCase()} 键中位共同特征「${twoBeatData.originCornerText}」`
            : twoBeatPhase === 'impact'
              ? '② 由核扩散 · 依共同特征向外展成全形'
              : twoBeatPhase === 'rebound'
                ? '③ 垂立归位 · 记住中位核心边界感'
                : `④ 核形合一 · 再按 ${activeSpec.key.toUpperCase()} 演下一字根`
          : twoBeatPhase === 'travel'
            ? twoBeatData.kineticMode === 'motif_glide'
              ? `① 起势移形 · ${activeSpec.homeKey}→${activeSpec.key.toUpperCase()} ${activeMotor.arrowSymbol} ${twoBeatData.originCornerText}`
              : `① 起势外移 · ${activeSpec.homeKey}→${activeSpec.key.toUpperCase()} ${activeMotor.arrowSymbol} 青锋去势`
            : twoBeatPhase === 'impact'
              ? twoBeatData.kineticMode === 'motif_glide'
                ? '② 击键定型 · 朱砂全构合定'
                : '② 击键遇阻 · 朱砂轮廓瞬间锁停'
              : twoBeatPhase === 'rebound'
                ? '③ 廓阻弹回 · 顺轮廓回弹归位'
                : `④ 三势合一 · 再按 ${activeSpec.key.toUpperCase()} 演下一字根`
        : phaseLabel === 'morph'
          ? '① 拓扑牵丝 · 移形换势'
          : phaseLabel === 'core'
            ? `② 朱砂落墨 · ${activeSpec.techniqueName}`
            : phaseLabel === 'bloom'
              ? '③ 焦墨生根 · 演化成形'
              : `④ 势成气定 · 再按 ${activeSpec.key.toUpperCase()} 演下一变`;

  return (
    <>
      <div className="no-print min-h-screen w-full flex flex-col bg-[var(--dojo-bg)] text-[var(--dojo-text)] overflow-y-auto">
      {/* 3-Zone Editorial Top Bar */}
      <header className="shrink-0 h-14 px-4 sm:px-6 border-b border-[var(--dojo-border)] bg-[var(--dojo-header)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBackToDojo();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-xs font-medium text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>道场主页</span>
          </button>

          <div className="hidden md:flex items-baseline gap-2.5 min-w-0">
            <h1 className="font-display text-base font-bold text-[var(--dojo-text-bright)] truncate">
              二十笔势 · 灵明书法拓扑演变剧场
            </h1>
            <span className="hidden 2xl:inline text-xs font-mono-tabular text-[var(--dojo-text-sub)] whitespace-nowrap">
              20 键独立笔法 · {TOTAL_MORPH_RADICAL_COUNT} 组全量字根拓扑演变
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenMuscleTrainer && (
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                onOpenMuscleTrainer(activeSpec.key, 'sequential');
              }}
              title="进入沉浸式拓扑肌肉记忆练习（支持敛锋导引、全字盲打、实字捕形与 20 键跨跳）"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--dojo-crimson)] bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <Target className="w-3.5 h-3.5" />
              <span>肌肉记忆练习</span>
            </button>
          )}

          <button
            type="button"
            disabled={isPreparingPrint}
            onClick={() => {
              synth.playClick();
              void triggerPrint({
                showGhostGlyph: !skeletonOnly,
                showWatermark: false,
                showFingerVector: true,
              });
            }}
            title="使用 A4 横向排版直接打印当前 20 键书法拓扑图谱"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] disabled:opacity-60 text-xs font-semibold text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-[var(--dojo-crimson)]" />
            <span>
              {isPreparingPrint ? '生成打印版中...' : '打印当前 20 键书法拓扑图谱'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setCloudPdfOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-xs font-semibold text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--dojo-crimson)]" />
            <span>新云图 PDF</span>
          </button>

          {onOpenTopologicalPalace && (
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                onOpenTopologicalPalace(activeSpec.key);
              }}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-xs font-semibold text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Compass className="w-3.5 h-3.5 text-[var(--dojo-crimson)]" />
              <span>笔势宫殿</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onOpenPracticeStudio();
            }}
            className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-xs font-semibold text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Feather className="w-3.5 h-3.5 text-[var(--dojo-crimson)]" />
            <span>实打练字</span>
          </button>

          <div className="hidden sm:flex items-center rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] p-0.5">
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeThemeMode(opt.id)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? '开启声音' : '静音'}
            className="p-2 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Exhibition Body */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
        {/* Top Two-Column Exhibition Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Living Xuan-Paper Brush Morph Canvas */}
          <section className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[410px]">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-mono-tabular font-semibold text-[var(--dojo-crimson-text)]">
                  {phaseCaption}
                </span>
                <span className="font-mono-tabular text-[var(--dojo-text-sub)]">
                  {activeKeyPosition + 1} / 20 键 · {nodeIdx + 1} / {activeSpec.nodes.length}
                </span>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-[var(--dojo-border)] shadow-sm bg-[var(--dojo-surface)]">
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1' }}
                  className="block"
                  aria-label={`${activeSpec.key.toUpperCase()} 键 ${activeSpec.techniqueName} 书法拓扑演变动画，当前字根 ${currentNode.radical}`}
                />
              </div>

              {/* Mode Segmented Toggle: Light-Decay Convergence vs Three-Beat Motion vs Classic Calligraphy Morph */}
              <div className="mt-3 flex items-center rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('converge');
                    setPlayTick((t) => t + 1);
                  }}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'converge'
                      ? 'bg-[var(--dojo-surface)] text-[var(--dojo-crimson-text)] shadow-xs'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  四方敛锋 · 归角定键
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('two_beat');
                    setPlayTick((t) => t + 1);
                  }}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'two_beat'
                      ? 'bg-[var(--dojo-surface)] text-[var(--dojo-pine-text)] shadow-xs'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  动觉三势
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('calligraphy');
                    setPlayTick((t) => t + 1);
                  }}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'calligraphy'
                      ? 'bg-[var(--dojo-surface)] text-[var(--dojo-text-bright)] shadow-xs'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  笔势母体
                </button>
              </div>

              {/* Compact Playback Controls */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setAutoMode((m) => (m === 'paused' ? 'key_loop' : 'paused'))
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-xs font-semibold text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
                  >
                    {autoMode === 'paused' ? (
                      <Play className="w-3.5 h-3.5" />
                    ) : (
                      <Pause className="w-3.5 h-3.5" />
                    )}
                    <span>{autoMode === 'paused' ? '续演' : '暂停'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setAutoMode((m) => (m === 'all_tour' ? 'key_loop' : 'all_tour'))
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      autoMode === 'all_tour'
                        ? 'border-[var(--dojo-crimson)]/50 bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{autoMode === 'all_tour' ? '巡礼全键中' : '20 键巡礼'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrevNodeSnapshot(currentNode);
                      setPlayTick((t) => t + 1);
                    }}
                    title="重演当前运笔 (Space)"
                    className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSlowMotion((s) => !s)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-mono-tabular font-medium transition-colors cursor-pointer ${
                      slowMotion
                        ? 'border-[var(--dojo-crimson)]/50 bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    {slowMotion ? '0.5×' : '1.0×'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSkeletonOnly((s) => !s)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      skeletonOnly
                        ? 'border-[var(--dojo-crimson)]/50 bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    {viewMode === 'converge'
                      ? skeletonOnly
                        ? '仅余焦形'
                        : '全形+敛焦'
                      : viewMode === 'two_beat'
                        ? skeletonOnly
                          ? twoBeatData.kineticMode === 'core_bloom'
                            ? '仅看核心特征'
                            : '仅看起势笔'
                          : twoBeatData.kineticMode === 'core_bloom'
                            ? '核心+扩散'
                            : '起势+击键+弹回'
                        : skeletonOnly
                          ? '仅朱砂主势'
                          : '骨架+字根'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Right: Editorial Key Specification, Morph Selector, Hand Reach & Radical Family */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            {/* Key Header + Prev/Next Key Stepper */}
            <div className="pb-3.5 border-b border-[var(--dojo-border)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono-tabular text-4xl font-bold text-[var(--dojo-crimson-text)] leading-none">
                    {activeSpec.key.toUpperCase()}
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--dojo-text-bright)] truncate">
                    {activeSpec.techniqueName}
                  </h2>
                  <span className="hidden sm:inline font-mono-tabular text-sm text-[var(--dojo-text-sub)]">
                    {activeSpec.topoSymbol} · {activeSpec.topoInvariant}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onOpenMuscleTrainer && (
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        onOpenMuscleTrainer(activeSpec.key, 'cross_key_jump');
                      }}
                      title="直接进入全 20 键随机跳跃肌肉记忆反射训练"
                      className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-pine)]/40 bg-[var(--dojo-pine-wash)] hover:opacity-90 text-xs font-semibold text-[var(--dojo-pine-text)] transition-opacity cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>20 键跨跳测验</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => stepAdjacentKey(-1)}
                    aria-label="上一键"
                    className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepAdjacentKey(1)}
                    aria-label="下一键"
                    className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Active Radical Story, Convergence Breakdown, or Two-Beat Embodied Breakdown */}
              <div className="mt-3 flex items-baseline justify-between gap-4">
                <p className="text-sm font-semibold text-[var(--dojo-text-bright)]">
                  {viewMode === 'converge'
                    ? `${convergenceData.shapeLabel} · ${currentNode.title}`
                    : viewMode === 'two_beat'
                      ? twoBeatData.kineticMode === 'core_bloom'
                        ? `${activeSpec.key.toUpperCase()} 原位垂直 · ${twoBeatData.originCornerText} · ${currentNode.title}`
                        : `${activeSpec.homeKey}→${activeSpec.key.toUpperCase()} ${activeMotor.arrowSymbol} · ${currentNode.title}`
                      : currentNode.title}
                </p>
                <div className="shrink-0 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]">
                    {currentNode.radical}
                  </span>
                  <span className="font-mono-tabular text-xs text-[var(--dojo-text-sub)]">
                    {currentNode.code}
                  </span>
                </div>
              </div>

              {viewMode === 'converge' ? (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    className={`p-2.5 rounded-xl border transition-colors ${
                      convergePhase === 'whole'
                        ? 'border-[var(--dojo-text-bright)]/50 bg-[var(--dojo-surface-2)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--dojo-text-bright)]">
                      <span>① 全字既明（不描笔画）</span>
                      <span className="font-mono-tabular opacity-75">{convergenceData.fullStrokes.length} 笔</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--dojo-text)]">
                      「{currentNode.radical}」已烂熟于胸，全形直接完整显现，无需分笔慢写。
                    </p>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border transition-colors ${
                      convergePhase === 'converge'
                        ? 'border-amber-500/80 bg-amber-500/12'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <span>② 四方敛锋（光线衰退）</span>
                      <span className="font-mono-tabular opacity-80">{convergenceData.flowStreams.length} 路</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--dojo-text)]">
                      外围笔画光线迅速衰退，沿各条笔柱从四面八方收束到目标焦形上。
                    </p>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border transition-colors ${
                      convergePhase === 'lock' || convergePhase === 'hold'
                        ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--dojo-crimson-text)]">
                      <span>③ 唯余焦形（按键手感）</span>
                      <span className="font-mono-tabular font-bold">{convergenceData.shapeSymbol}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--dojo-text)]">
                      确定按 {activeSpec.key.toUpperCase()} 键刹那，肌肉记忆只锁定唯一「{convergenceData.shapeLabel}」。
                    </p>
                  </div>
                </div>
              ) : viewMode === 'two_beat' ? (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div
                    className={`p-2.5 rounded-xl border transition-colors ${
                      twoBeatPhase === 'travel'
                        ? twoBeatData.kineticMode === 'core_bloom'
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)]'
                          : 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between text-[11px] font-semibold ${
                        twoBeatData.kineticMode === 'core_bloom'
                          ? 'text-[var(--dojo-crimson-text)]'
                          : 'text-[var(--dojo-pine-text)]'
                      }`}
                    >
                      <span>
                        {twoBeatData.kineticMode === 'core_bloom'
                          ? '① 原位定核（中位共性）'
                          : twoBeatData.kineticMode === 'motif_glide'
                            ? '① 起势移形（青锋动势）'
                            : '① 起势外移（青锋 1 笔）'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--dojo-text)]">
                      {twoBeatData.travelHint}
                    </p>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border transition-colors ${
                      twoBeatPhase === 'impact'
                        ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--dojo-crimson-text)]">
                      <span>
                        {twoBeatData.kineticMode === 'core_bloom'
                          ? '② 由核扩散（外延成字）'
                          : twoBeatData.kineticMode === 'motif_glide'
                            ? '② 击键定型（朱砂合定）'
                            : '② 击键遇阻（朱砂阻块）'}
                      </span>
                      <span className="font-mono-tabular">
                        {twoBeatData.kineticMode === 'core_bloom'
                          ? `扩 ${twoBeatData.stopStrokes.length} 笔`
                          : twoBeatData.kineticMode === 'motif_glide'
                            ? `${twoBeatData.stopStrokes.length} 笔定型`
                            : twoBeatData.isSingleStrokeSplit
                              ? '末段顿锋'
                              : `余 ${twoBeatData.stopStrokes.length} 笔`}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--dojo-text)]">
                      {twoBeatData.stopHint}
                    </p>
                  </div>

                  <div
                    className={`p-2.5 rounded-xl border transition-colors ${
                      twoBeatPhase === 'rebound'
                        ? 'border-amber-500/80 bg-amber-500/12'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <span>
                        {twoBeatData.kineticMode === 'core_bloom'
                          ? '③ 垂立归位（基准回弹）'
                          : '③ 廓阻弹回（顺势归位）'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--dojo-text)]">
                      {twoBeatData.reboundHint}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm leading-relaxed text-[var(--dojo-text-sub)]">
                  {currentNode.insight}
                </p>
              )}
            </div>

            {/* Radical Morph Stations for the Active Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--dojo-text-sub)]">
                  本键拓扑移形 · 点击任一字根或连续敲击{' '}
                  <span className="font-mono-tabular text-[var(--dojo-crimson-text)]">
                    {activeSpec.key.toUpperCase()}
                  </span>{' '}
                  键演下一变
                </span>
                <span className="hidden sm:inline text-[11px] font-mono-tabular text-[var(--dojo-text-sub)]">
                  {viewMode === 'converge'
                    ? `墨 = 既知全形 · 流光 = 笔柱退敛 · 朱砂 = 键位焦形「${convergenceData.shapeSymbol}」`
                    : viewMode === 'two_beat'
                      ? twoBeatData.kineticMode === 'core_bloom'
                        ? '朱砂 = 键位根本共同特征 · 焦墨 = 由核向外扩散'
                        : '青锋 = 起势移位 · 朱砂 = 击键阻定 · 琥珀 = 轮廓弹回'
                      : '朱砂 = 拓扑主势 · 焦墨 = 附生笔画'}
                </span>
              </div>

              <div
                className={`grid gap-1.5 ${
                  activeSpec.nodes.length >= 13
                    ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6'
                    : activeSpec.nodes.length >= 7
                      ? 'grid-cols-4 sm:grid-cols-5'
                      : 'grid-cols-3 sm:grid-cols-6'
                }`}
              >
                {activeSpec.nodes.map((node, idx) => {
                  const active = idx === nodeIdx;
                  const compact = activeSpec.nodes.length >= 10;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => selectRadicalNode(idx)}
                      className={`flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer ${
                        compact ? 'py-1.5 px-1' : 'py-2.5 px-1.5'
                      } ${
                        active
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] shadow-xs'
                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)]'
                      }`}
                    >
                      <span
                        className={`font-display font-bold leading-none ${
                          compact ? 'text-xl' : 'text-2xl'
                        }`}
                      >
                        {node.radical}
                      </span>
                      <span className="mt-1 text-[10px] font-mono-tabular opacity-80 whitespace-nowrap">
                        {node.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tactile Finger-Reach Panel + Complete Simplified Key Family */}
            <div className="p-4 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] flex flex-col sm:flex-row items-center gap-4">
              <HandReachDiagram
                spec={activeSpec}
                isWash={isWash}
                syncBeat={
                  viewMode === 'two_beat'
                    ? twoBeatPhase
                    : viewMode === 'converge'
                      ? convergePhase === 'whole'
                        ? 'travel'
                        : convergePhase === 'converge'
                          ? 'impact'
                          : 'hold'
                      : null
                }
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--dojo-text-bright)]">
                    {activeSpec.fingerLabel} · {activeSpec.reachLabel}
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[var(--dojo-text-sub)]">
                    {activeSpec.hand === 'L' ? '左手区' : '右手区'} ·{' '}
                    {activeSpec.row === 'top'
                      ? '上排抬探'
                      : activeSpec.row === 'home'
                        ? '中排基准'
                        : '下排收扣'}
                  </span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-[var(--dojo-border)]">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--dojo-text-sub)] mb-1.5">
                    <span>
                      {activeSpec.key.toUpperCase()} 键全部简体灵明字根（{allSimpRadicals.length} 个 · 全部已入局部笔法演变）
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-2.5 gap-y-1 font-display text-base text-[var(--dojo-text)]">
                    {allSimpRadicals.map((rad) => {
                      const matchIdx = activeSpec.nodes.findIndex((n) => n.radical === rad);
                      const isCurrent = currentNode.radical === rad;
                      return (
                        <button
                          key={rad}
                          type="button"
                          onClick={() => {
                            if (matchIdx >= 0) selectRadicalNode(matchIdx);
                          }}
                          className={`transition-colors ${
                            isCurrent
                              ? 'text-[var(--dojo-crimson-text)] font-bold underline underline-offset-4 cursor-pointer'
                              : matchIdx >= 0
                                ? 'text-[var(--dojo-text-bright)] font-semibold hover:text-[var(--dojo-crimson-text)] cursor-pointer'
                                : 'text-[var(--dojo-text-sub)] cursor-default'
                          }`}
                        >
                          {rad}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Full 26-Key Interactive QWERTY Calligraphy Deck */}
        <section
          aria-label="二十笔势全键盘导航"
          className="pt-4 border-t border-[var(--dojo-border)]"
        >
          <div className="flex items-center justify-between mb-2.5 text-xs">
            <span className="font-semibold text-[var(--dojo-text-bright)]">
              二十笔势全键图谱 · 直接敲击键盘任意辅音键（或点击键帽）即可切换演变动画
            </span>
            <span className="hidden sm:inline font-mono-tabular text-[var(--dojo-text-sub)]">
              A E I O U = 润墨小码 · ← / → 切换键位 · Space 重演
            </span>
          </div>

          <div className="flex flex-col gap-1.5 select-none">
            {QWERTY_DECK.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className="flex justify-center gap-1 sm:gap-1.5"
                style={{
                  paddingLeft: rowIdx === 1 ? '1.25rem' : rowIdx === 2 ? '2.5rem' : '0',
                }}
              >
                {row.map(({ key }) => {
                  const spec = TWENTY_KEY_MORPH_BY_KEY.get(key);
                  const isVowel = VOWELS_SET.has(key);
                  const isSelected = key === activeSpec.key;
                  const isStruck = key === lastStruckKey;

                  if (!spec) {
                    return (
                      <div
                        key={key}
                        className="w-[9.2%] max-w-[96px] min-w-[44px] py-1.5 px-1 rounded-lg border border-dashed border-[var(--dojo-border)]/70 bg-[var(--dojo-surface-inset)]/50 flex flex-col items-center justify-center opacity-55"
                      >
                        <span className="font-mono-tabular text-xs font-semibold text-[var(--dojo-text-sub)]">
                          {key.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-[var(--dojo-text-sub)] truncate">
                          {isVowel ? '润墨' : '留白'}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectKey(key, true)}
                      className={`w-[9.2%] max-w-[96px] min-w-[44px] py-1.5 px-1 rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] shadow-xs'
                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)]'
                      } ${isStruck ? 'scale-95' : ''}`}
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono-tabular text-xs font-bold">
                          {key.toUpperCase()}
                        </span>
                        <span className="font-display text-xs opacity-90">
                          {spec.nodes[0].radical}
                        </span>
                      </div>
                      <span className="mt-0.5 text-[10px] leading-tight truncate max-w-full opacity-80">
                        {spec.techniqueName}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>

      <TopologyCloudPdfModal
        open={cloudPdfOpen}
        activeKey={activeSpec.key}
        onClose={() => setCloudPdfOpen(false)}
        onRequestPrint={triggerPrint}
        isPrintingExternal={isPreparingPrint}
        onSelectKeyAndClose={(k) => {
          setCloudPdfOpen(false);
          setPrevNodeSnapshot(currentNode);
          setActiveKey(k);
          setNodeIdx(0);
          setPlayTick((t) => t + 1);
          flashDeckKey(k);
          synth.playClick();
        }}
      />

      <PrintableTopologySheets urls={printUrls} />
    </>
  );
};
