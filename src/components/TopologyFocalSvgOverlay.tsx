import React from 'react';
import { CornerConvergenceData } from '../data/cornerConvergence';
import { TWENTY_KEY_MORPH_BY_KEY } from '../data/twentyKeysMorph';
import { getCachedConvergence } from '../data/topologyMuscleTraining';

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResolvedCloudFocal {
  convergence: CornerConvergenceData;
  isExactRadicalMatch: boolean;
  fullBBox: NormRect;
  focalBBox: NormRect;
}

const RADICAL_NORMALIZE_MAP: Record<string, string[]> = {
  '⺾': ['艹'],
  '⺿': ['艹'],
  '⻀': ['艹'],
  '⺡': ['氵', '水'],
  '⺘': ['扌', '手'],
  '⺖': ['忄', '心'],
  '⺨': ['犭', '犬'],
  '⺙': ['攵'],
  '⻍': ['辶'],
  '⻌': ['辶'],
  '⺮': ['竹', '⺮'],
  '⺬': ['礻', '示'],
  '⺭': ['礻', '示'],
  '⻂': ['衤', '衣'],
  '⻠': ['饣', '食'],
  '⻟': ['饣', '食'],
  '⺳': ['罒'],
  '⻈': ['讠', '言'],
  '⻉': ['贝'],
  '⻋': ['车'],
  '⻔': ['门'],
  '⻖': ['阝'],
  '⻏': ['阝'],
  '⻕': ['阝'],
  '⻛': ['风'],
  '⻢': ['马'],
  '⻥': ['鱼'],
  '⻦': ['鸟'],
  '⺩': ['王', '玉'],
  '⺫': ['目'],
  '⺜': ['日'],
  '⺝': ['月'],
  '⺧': ['牜', '牛'],
  '⺦': ['丬'],
  '⻊': ['足'],
  '⻗': ['雨'],
  '⺋': ['卩'],
  '⺈': ['刀'],
  '⺁': ['厂'],
  '⺆': ['冂'],
  '⺇': ['几'],
  '⺍': ['小'],
  '⺓': ['幺'],
  '⺔': ['彐'],
  '⺕': ['彐'],
  '⺶': ['羊'],
  '⺷': ['羊'],
  '⺸': ['羊'],
  '⺹': ['耂', '老'],
  '龴': ['又'],
  '糹': ['纟', '糸'],
  '釒': ['钅', '金'],
  '戸': ['户'],
  '戶': ['户'],
};

const focalCache = new Map<string, ResolvedCloudFocal | null>();
const makeMeAHanziBBoxCache = new Map<string, NormRect>();

function computePointsBBox(pts: Array<{ x: number; y: number }>): NormRect {
  if (pts.length === 0) return { x: 0.15, y: 0.15, w: 0.7, h: 0.7 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(0.16, maxX - minX);
  const h = Math.max(0.16, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function collectFocalPoints(conv: CornerConvergenceData): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (const arm of conv.cornerArms) {
    for (const p of arm.points) pts.push({ x: p.x, y: p.y });
  }
  if (conv.virtualLinks) {
    for (const l of conv.virtualLinks) {
      pts.push(l.from, l.to);
    }
  }
  if (conv.negativeBox) {
    const nb = conv.negativeBox;
    pts.push({ x: nb.x, y: nb.y }, { x: nb.x + nb.w, y: nb.y + nb.h });
  }
  if (conv.accentBeads) {
    for (const b of conv.accentBeads) pts.push(b);
  }
  if (conv.embraceArc) {
    pts.push(conv.embraceArc.start, conv.embraceArc.ctrl, conv.embraceArc.end);
  }
  if (conv.flickTip) {
    pts.push(conv.flickTip.from, conv.flickTip.to);
  }
  if (pts.length === 0) {
    pts.push(
      { x: conv.cornerVertex.x - 0.12, y: conv.cornerVertex.y - 0.12 },
      { x: conv.cornerVertex.x + 0.12, y: conv.cornerVertex.y + 0.12 }
    );
  }
  return pts;
}

/**
 * Resolves the exact CornerConvergenceData for a PalaceCloudTrainer step.
 * Falls back gracefully to the key's canonical mother archetype so every node
 * displays its key's unmistakable topological focal invariant.
 */
export function resolveCloudStepFocal(
  chamberKey: string,
  char: string,
  parentChar: string,
  ma: string
): ResolvedCloudFocal | null {
  const key = chamberKey.toLowerCase();
  const cacheKey = `${key}|${char}|${parentChar}|${ma}`;
  if (focalCache.has(cacheKey)) {
    return focalCache.get(cacheKey) ?? null;
  }

  const spec = TWENTY_KEY_MORPH_BY_KEY.get(key);
  if (!spec || spec.nodes.length === 0) {
    focalCache.set(cacheKey, null);
    return null;
  }

  const candidateChars = new Set<string>();
  if (char) {
    candidateChars.add(char);
    for (const a of RADICAL_NORMALIZE_MAP[char] ?? []) candidateChars.add(a);
  }
  if (parentChar) {
    candidateChars.add(parentChar);
    for (const a of RADICAL_NORMALIZE_MAP[parentChar] ?? []) candidateChars.add(a);
  }

  let matched = spec.nodes.find((n) => candidateChars.has(n.radical));
  let isExactRadicalMatch = Boolean(matched);

  if (!matched && ma) {
    const cleanMa = ma.toLowerCase().replace(/\s+/g, '');
    matched = spec.nodes.find((n) => n.code.toLowerCase().replace(/\s+/g, '') === cleanMa);
    isExactRadicalMatch = Boolean(matched);
  }

  if (!matched) {
    matched = spec.nodes[0];
    isExactRadicalMatch = false;
  }

  const convergence = getCachedConvergence(spec.key, matched);
  const fullPts: Array<{ x: number; y: number }> = [];
  for (const s of convergence.fullStrokes) {
    for (const p of s.points) fullPts.push({ x: p.x, y: p.y });
  }
  const fullBBox = computePointsBBox(fullPts);
  const focalBBox = computePointsBBox(collectFocalPoints(convergence));

  const resolved: ResolvedCloudFocal = {
    convergence,
    isExactRadicalMatch,
    fullBBox,
    focalBBox,
  };
  focalCache.set(cacheKey, resolved);
  return resolved;
}

/**
 * Computes the normalized [0..1] screen-space bounding box of the highlighted
 * radical strokes inside a MakeMeAHanzi 1024x1024 glyph (transformed via
 * `translate(0 900) scale(1 -1)`).
 */
export function computeHighlightedRadicalNormRect(
  charKey: string,
  strokes: string[],
  highlightIndices: number[]
): NormRect {
  const cacheKey = `${charKey}|${highlightIndices.join(',')}`;
  const cached = makeMeAHanziBBoxCache.get(cacheKey);
  if (cached) return cached;

  const indices =
    highlightIndices.length > 0
      ? highlightIndices
      : strokes.map((_, idx) => idx);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const numRe = /-?\d+(?:\.\d+)?/g;
  for (const idx of indices) {
    const d = strokes[idx];
    if (!d) continue;
    const nums = d.match(numRe);
    if (!nums || nums.length < 2) continue;
    // MakeMeAHanzi paths use absolute M/L/Q/C/Z commands with alternating (x, y) pairs
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const gx = Number(nums[i]);
      const gy = Number(nums[i + 1]);
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
      if (gx < -200 || gx > 1224 || gy < -324 || gy > 1100) continue;
      const nx = gx / 1024;
      const ny = (900 - gy) / 1024;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx > maxX) maxX = nx;
      if (ny > maxY) maxY = ny;
    }
  }

  let rect: NormRect;
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    rect = { x: 0.14, y: 0.14, w: 0.72, h: 0.72 };
  } else {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Ensure thin horizontal/vertical radicals keep enough visual room for the tiny focal mark
    const w = Math.max(0.36, Math.min(0.92, (maxX - minX) * 1.06));
    const h = Math.max(0.36, Math.min(0.92, (maxY - minY) * 1.06));
    rect = {
      x: Math.max(0.02, Math.min(0.98 - w, cx - w / 2)),
      y: Math.max(0.02, Math.min(0.98 - h, cy - h / 2)),
      w,
      h,
    };
  }

  makeMeAHanziBBoxCache.set(cacheKey, rect);
  return rect;
}

interface TopologyFocalSvgOverlayProps {
  focal: ResolvedCloudFocal;
  /** Target rectangle in the parent SVG's local coordinate system */
  targetRect: NormRect;
  /** Accent stroke color (e.g. vermilion #C43125 or bright coral #FF6B57) */
  strokeColor: string;
  /** Protective backdrop halo color matching paper/obsidian canvas */
  haloColor: string;
  /** Stroke width in SVG user units */
  strokeWidth: number;
  /** Overall opacity */
  opacity?: number;
  /** When true, always center the focal geometry proportionally inside targetRect */
  forceCentered?: boolean;
}

/**
 * Pure vector SVG projection of a key's final converged topological focus
 * (little cross ✕/╪, square □/⊓, corner ┌, wing <, negative-space box ⬚,
 * flanking beads ·│·, outer embrace arc ⟯, flick tip ↗).
 */
export const TopologyFocalSvgOverlay: React.FC<TopologyFocalSvgOverlayProps> = ({
  focal,
  targetRect,
  strokeColor,
  haloColor,
  strokeWidth,
  opacity = 1,
  forceCentered = false,
}) => {
  const { convergence, isExactRadicalMatch, fullBBox, focalBBox } = focal;

  // Map normalized (0..1) focal coordinates cleanly into targetRect:
  // - Exact radical match: align fullBBox -> targetRect so the tiny cross/corner lands
  //   right on the true stroke intersection inside the radical or small Hanzi!
  // - Fallback/monument: preserve aspect ratio centered inside targetRect so the key's
  //   signature shape (□, ✕, ┌, <) never distorts.
  const mapPoint = (px: number, py: number): { x: number; y: number } => {
    if (isExactRadicalMatch && !forceCentered) {
      const u = (px - fullBBox.x) / Math.max(0.001, fullBBox.w);
      const v = (py - fullBBox.y) / Math.max(0.001, fullBBox.h);
      return {
        x: targetRect.x + u * targetRect.w,
        y: targetRect.y + v * targetRect.h,
      };
    }

    const scale = Math.min(
      (targetRect.w * 0.72) / Math.max(0.18, focalBBox.w),
      (targetRect.h * 0.72) / Math.max(0.18, focalBBox.h)
    );
    const fcx = focalBBox.x + focalBBox.w / 2;
    const fcy = focalBBox.y + focalBBox.h / 2;
    const tcx = targetRect.x + targetRect.w / 2;
    const tcy = targetRect.y + targetRect.h / 2;
    return {
      x: tcx + (px - fcx) * scale,
      y: tcy + (py - fcy) * scale,
    };
  };

  const armPaths = convergence.cornerArms
    .filter((arm) => arm.points.length >= 2)
    .map((arm) => {
      const mapped = arm.points.map((pt) => mapPoint(pt.x, pt.y));
      return mapped
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
        .join(' ');
    });

  const haloW = strokeWidth * 2.15;

  return (
    <g
      className="pointer-events-none"
      opacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Negative-space sheltered window (B key: ⬚) */}
      {convergence.negativeBox && (() => {
        const tl = mapPoint(convergence.negativeBox.x, convergence.negativeBox.y);
        const br = mapPoint(
          convergence.negativeBox.x + convergence.negativeBox.w,
          convergence.negativeBox.y + convergence.negativeBox.h
        );
        const rx = Math.min(tl.x, br.x);
        const ry = Math.min(tl.y, br.y);
        const rw = Math.max(0.4, Math.abs(br.x - tl.x));
        const rh = Math.max(0.4, Math.abs(br.y - tl.y));
        return (
          <g>
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              rx={strokeWidth * 0.6}
              fill={strokeColor}
              fillOpacity={0.14}
              stroke={haloColor}
              strokeWidth={haloW * 0.72}
              strokeOpacity={0.8}
            />
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              rx={strokeWidth * 0.6}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 0.85}
              strokeDasharray={`${(strokeWidth * 2.2).toFixed(2)} ${(strokeWidth * 1.4).toFixed(2)}`}
            />
          </g>
        );
      })()}

      {/* Outer embracing crescent arc (P key: ⟯) */}
      {convergence.embraceArc && (() => {
        const s = mapPoint(convergence.embraceArc.start.x, convergence.embraceArc.start.y);
        const c = mapPoint(convergence.embraceArc.ctrl.x, convergence.embraceArc.ctrl.y);
        const e = mapPoint(convergence.embraceArc.end.x, convergence.embraceArc.end.y);
        const d = `M${s.x.toFixed(2)} ${s.y.toFixed(2)} Q${c.x.toFixed(2)} ${c.y.toFixed(2)} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
        return (
          <g>
            <path d={d} fill="none" stroke={haloColor} strokeWidth={haloW * 0.85} strokeOpacity={0.82} />
            <path
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 0.9}
              strokeDasharray={`${(strokeWidth * 2.2).toFixed(2)} ${(strokeWidth * 1.4).toFixed(2)}`}
            />
          </g>
        );
      })()}

      {/* Virtual closure dashed links (e.g. top horizontal closure across twin verticals) */}
      {convergence.virtualLinks?.map((link, idx) => {
        const a = mapPoint(link.from.x, link.from.y);
        const b = mapPoint(link.to.x, link.to.y);
        return (
          <g key={`vl_${idx}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={haloColor}
              strokeWidth={haloW * 0.72}
              strokeOpacity={0.78}
            />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth * 0.78}
              strokeDasharray={`${(strokeWidth * 1.8).toFixed(2)} ${(strokeWidth * 1.4).toFixed(2)}`}
            />
          </g>
        );
      })}

      {/* Core crystallized topological arms (the crisp little ✕ / □ / ┌ / < / 丁→) */}
      {armPaths.map((d, idx) => (
        <g key={`arm_${idx}`}>
          <path
            d={d}
            fill="none"
            stroke={haloColor}
            strokeWidth={haloW}
            strokeOpacity={0.86}
          />
          <path
            d={d}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </g>
      ))}

      {/* Point-corner subtle vertex jewel (when targetMode === 'point_corner') */}
      {convergence.targetMode === 'point_corner' && (() => {
        const v = mapPoint(convergence.cornerVertex.x, convergence.cornerVertex.y);
        return (
          <circle
            cx={v.x}
            cy={v.y}
            r={strokeWidth * 0.78}
            fill={strokeColor}
            stroke={haloColor}
            strokeWidth={strokeWidth * 0.4}
          />
        );
      })()}

      {/* Flanking jewel beads (V key: ·│·) */}
      {convergence.accentBeads?.map((bead, idx) => {
        const b = mapPoint(bead.x, bead.y);
        return (
          <circle
            key={`bead_${idx}`}
            cx={b.x}
            cy={b.y}
            r={strokeWidth * 0.92}
            fill={strokeColor}
            stroke={haloColor}
            strokeWidth={strokeWidth * 0.45}
          />
        );
      })}

      {/* Flick tip cue (W key: ↗) */}
      {convergence.flickTip && (() => {
        const f = mapPoint(convergence.flickTip.from.x, convergence.flickTip.from.y);
        const to = mapPoint(convergence.flickTip.to.x, convergence.flickTip.to.y);
        return (
          <g>
            <line
              x1={f.x}
              y1={f.y}
              x2={to.x}
              y2={to.y}
              stroke={haloColor}
              strokeWidth={haloW * 0.8}
              strokeOpacity={0.82}
            />
            <line
              x1={f.x}
              y1={f.y}
              x2={to.x}
              y2={to.y}
              stroke={strokeColor}
              strokeWidth={strokeWidth * 0.9}
            />
          </g>
        );
      })()}
    </g>
  );
};
