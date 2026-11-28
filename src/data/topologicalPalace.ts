import { LINGMING_ROOT_MAP, getLingmingRadicalScript } from './lingming';
import {
  KeyTopologyMorphSpec,
  MorphBrushStroke,
  MorphPt,
  TWENTY_KEY_MORPH_BY_KEY,
  TWENTY_KEY_MORPHS,
} from './twentyKeysMorph';

export type FrequencyTier = 'high' | 'mid' | 'low';

export interface JourneyStation {
  index: number; // 0-based strict frequency order along the master glyph's stroke direction
  rank: number; // Original Lingming frequency rank inside this key
  char: string;
  ma: string; // exact Lingming code, e.g. 'rje', 'ra', 'rya'
  daKey: string; // Step 1: topological finger onset key (1st letter)
  shengKey: string | null; // Step 2: consonant sound key (2nd letter if 3-code, else null)
  yunKey: string; // Step 3: vowel rhyme key (last letter)
  note: string;
  tier: FrequencyTier;
  tierLabel: string;
  // Position DIRECTLY ON the brushstroke spine (0..1 normalized canvas coordinates)
  x: number;
  y: number;
  // Exact normalized progress 0..1 along the unified continuous brush route
  pathT: number;
  // Subtle calligraphic scale tapering from high-frequency entry to low-frequency tail
  scale: number;
  isFeaturedMorph: boolean;
}

export interface ContinuousPathPoint {
  x: number;
  y: number;
  p: number;
  strokeIndex: number;
  isBridge: boolean; // true for gossamer "牵丝" linking between strokes
}

export interface TopologicalPalaceModel {
  key: string;
  spec: KeyTopologyMorphSpec;
  monumentRadical: string;
  routeStrokes: MorphBrushStroke[];
  unifiedPath: ContinuousPathPoint[];
  stations: JourneyStation[];
  isBraidedStroke: boolean; // true only on ultra-dense 1-stroke pillar like K (20 rads on 丨)
  counts: {
    total: number;
    high: number;
    mid: number;
    low: number;
  };
}

// Smooth Catmull-Rom sampling for a single stroke
function sampleStrokeRaw(
  points: MorphPt[],
  stepsPerSeg = 22
): Array<{ x: number; y: number; p: number }> {
  if (points.length < 2) return [];
  const out: Array<{ x: number; y: number; p: number }> = [];
  const n = points.length;
  const get = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const lim = i === n - 2 ? stepsPerSeg + 1 : stepsPerSeg;
    for (let s = 0; s < lim; s++) {
      const t = s / stepsPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      const p = p1.p + (p2.p - p1.p) * t;
      out.push({ x, y, p });
    }
  }
  return out;
}

// Pick the most iconic, authentic full-stroke-order monumental shape for each key
// so that arranging all small radicals directly along its strokes unmistakably forms that shape!
function getMonumentStrokes(spec: KeyTopologyMorphSpec): {
  monumentRadical: string;
  strokes: MorphBrushStroke[];
} {
  // For W, use #1 highest-frequency radical 辶 (dot + sinuous Z-tail) in true calligraphy order
  if (spec.key === 'w') {
    const chuo = spec.nodes.find((n) => n.radical === '辶');
    if (chuo) {
      return {
        monumentRadical: '辶',
        strokes: [...chuo.extraStrokes, ...chuo.coreStrokes],
      };
    }
  }

  // For Y (大), draw Horizontal shoulder first, then Pie, then Na (authentic stroke order)
  if (spec.key === 'y') {
    const da = spec.nodes[0];
    return {
      monumentRadical: da.radical,
      strokes: [...da.extraStrokes, ...da.coreStrokes],
    };
  }

  // For S (土), draw Short Upper Bar -> Center Vertical -> Wide Bottom Bar (authentic stroke order)
  if (spec.key === 's') {
    const tu = spec.nodes[0];
    return {
      monumentRadical: tu.radical,
      strokes: [tu.extraStrokes[0], tu.coreStrokes[0], tu.coreStrokes[1]],
    };
  }

  // For M (戈), draw Horizontal -> Slanted Hook -> Pie -> Dot (authentic stroke order)
  if (spec.key === 'm') {
    const ge = spec.nodes[0];
    return {
      monumentRadical: ge.radical,
      strokes: [ge.extraStrokes[0], ge.coreStrokes[0], ge.extraStrokes[1], ge.extraStrokes[2]],
    };
  }

  // For T (丶), give the diagonal drop generous monumental span so all 6 radicals form a grand calligraphic dot!
  if (spec.key === 't') {
    return {
      monumentRadical: '丶',
      strokes: [
        {
          dunbiStart: false,
          points: [
            { x: 0.22, y: 0.18, p: 0.28 },
            { x: 0.42, y: 0.4, p: 0.65 },
            { x: 0.64, y: 0.66, p: 0.92 },
            { x: 0.78, y: 0.82, p: 1.0 },
          ],
        },
      ],
    };
  }

  // For F (一), span wide across the full paper so all 14 radicals sit cleanly on ONE majestic horizontal bar!
  if (spec.key === 'f') {
    return {
      monumentRadical: '一',
      strokes: [
        {
          dunbiStart: true,
          points: [
            { x: 0.06, y: 0.52, p: 0.92 },
            { x: 0.34, y: 0.49, p: 0.64 },
            { x: 0.66, y: 0.48, p: 0.72 },
            { x: 0.94, y: 0.49, p: 0.98 },
          ],
        },
      ],
    };
  }

  // For K (丨), span full height so all 20 radicals braid tightly into ONE monumental vertical pillar!
  if (spec.key === 'k') {
    return {
      monumentRadical: '丨',
      strokes: [
        {
          dunbiStart: true,
          flickEnd: true,
          points: [
            { x: 0.5, y: 0.08, p: 0.92 },
            { x: 0.5, y: 0.38, p: 0.72 },
            { x: 0.5, y: 0.68, p: 0.64 },
            { x: 0.5, y: 0.92, p: 0.24 },
          ],
        },
      ],
    };
  }

  // Default: combine mother archetype's coreStrokes + extraStrokes so the complete master radical silhouette appears!
  const mother = spec.nodes[0];
  return {
    monumentRadical: mother.radical,
    strokes: [...mother.coreStrokes, ...mother.extraStrokes],
  };
}

// Build a unified continuous monumental brush route filling [0.09..0.91] cleanly
function buildMonumentalRoute(strokes: MorphBrushStroke[]): ContinuousPathPoint[] {
  // Check if the strokes already use extreme bounds (like F 0.06..0.94 or K 0.08..0.92)
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const s of strokes) {
    for (const pt of s.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // Uniformly expand modest-span glyphs into the heroic [0.11..0.89] paper stage without distorting proportions
  const padX = 0.095;
  const padY = 0.11;
  const availW = 1 - padX * 2;
  const availH = 1 - padY * 2;
  const scale =
    spanX > 0.05 || spanY > 0.05
      ? Math.min(
          spanX > 0.05 ? availW / spanX : 1.15,
          spanY > 0.05 ? availH / spanY : 1.15,
          1.22
        )
      : 1;
  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;

  const mapPt = (pt: { x: number; y: number; p: number }) => ({
    x: Math.max(0.065, Math.min(0.935, 0.5 + (pt.x - cx) * scale)),
    y: Math.max(0.09, Math.min(0.91, 0.5 + (pt.y - cy) * scale)),
    p: pt.p,
  });

  const unified: ContinuousPathPoint[] = [];

  strokes.forEach((stroke, sIdx) => {
    const sampled = sampleStrokeRaw(stroke.points, 24).map(mapPt);
    if (sampled.length === 0) return;

    // Gossamer "牵丝" silk-thread bridge between consecutive strokes
    if (unified.length > 0) {
      const prev = unified[unified.length - 1];
      const next = sampled[0];
      const midX = (prev.x + next.x) * 0.5 + (next.y - prev.y) * 0.05;
      const midY = (prev.y + next.y) * 0.5 - (next.x - prev.x) * 0.05;
      const bridgeSteps = 12;
      for (let b = 1; b < bridgeSteps; b++) {
        const t = b / bridgeSteps;
        const omt = 1 - t;
        const x = omt * omt * prev.x + 2 * omt * t * midX + t * t * next.x;
        const y = omt * omt * prev.y + 2 * omt * t * midY + t * t * next.y;
        unified.push({ x, y, p: 0.14, strokeIndex: sIdx, isBridge: true });
      }
    }

    for (const pt of sampled) {
      unified.push({ ...pt, strokeIndex: sIdx, isBridge: false });
    }
  });

  return unified;
}

// Compute pixel-true inked arc length on our 640x480 stage (bridges have weight 0 so NO radical floats off-stroke!)
const STAGE_W = 640;
const STAGE_H = 480;

function computeInkedArcTable(path: ContinuousPathPoint[]): {
  cum: number[];
  totalPx: number;
} {
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const segPx = path[i].isBridge || path[i - 1].isBridge
      ? 0
      : Math.hypot((path[i].x - path[i - 1].x) * STAGE_W, (path[i].y - path[i - 1].y) * STAGE_H);
    cum.push(cum[i - 1] + segPx);
  }
  return { cum, totalPx: cum[cum.length - 1] || 1 };
}

function sampleDirectOnStroke(
  path: ContinuousPathPoint[],
  cum: number[],
  totalPx: number,
  t: number
): { x: number; y: number; nx: number; ny: number } {
  if (path.length === 0) return { x: 0.5, y: 0.5, nx: 0, ny: -1 };
  if (path.length === 1) return { x: path[0].x, y: path[0].y, nx: 0, ny: -1 };

  const target = Math.max(0, Math.min(1, t)) * totalPx;
  let idx = 0;
  while (idx < cum.length - 2 && cum[idx + 1] < target) {
    idx++;
  }
  // Skip zero-length bridge spans so we always land on an actual inked stroke segment
  while (idx < path.length - 2 && (path[idx].isBridge || path[idx + 1].isBridge)) {
    idx++;
  }
  const segLen = Math.max(1e-6, cum[idx + 1] - cum[idx]);
  const frac = Math.max(0, Math.min(1, (target - cum[idx]) / segLen));
  const a = path[idx];
  const b = path[idx + 1] ?? a;
  const x = a.x + (b.x - a.x) * frac;
  const y = a.y + (b.y - a.y) * frac;

  const pPrev = path[Math.max(0, idx - 2)];
  const pNext = path[Math.min(path.length - 1, idx + 3)];
  const dx = (pNext.x - pPrev.x) * STAGE_W;
  const dy = (pNext.y - pPrev.y) * STAGE_H;
  const len = Math.hypot(dx, dy) || 1;
  // Normalized perpendicular in normalized (0..1) coordinates
  const nx = -dy / len;
  const ny = dx / len;
  return { x, y, nx, ny };
}

const palaceCache = new Map<string, TopologicalPalaceModel>();

export function buildTopologicalPalace(key: string): TopologicalPalaceModel {
  const normalizedKey = key.toLowerCase();
  const cached = palaceCache.get(normalizedKey);
  if (cached) return cached;

  const spec = TWENTY_KEY_MORPH_BY_KEY.get(normalizedKey) ?? TWENTY_KEY_MORPHS[0];
  const featuredSet = new Set(spec.nodes.map((n) => n.radical));
  const { monumentRadical, strokes: routeStrokes } = getMonumentStrokes(spec);
  const unifiedPath = buildMonumentalRoute(routeStrokes);
  const { cum, totalPx } = computeInkedArcTable(unifiedPath);

  // Collect ALL Simplified Lingming radicals on this key sorted STRICTLY by frequency rank!
  const rawMeta: Array<{
    char: string;
    ma: string;
    rank: number;
    note: string;
  }> = [];

  for (const [rad, meta] of LINGMING_ROOT_MAP.entries()) {
    if (meta.chamberKey !== spec.key) continue;
    if (getLingmingRadicalScript(rad) === 'trad') continue;
    rawMeta.push({
      char: rad,
      ma: meta.ma.toLowerCase(),
      rank: meta.rank,
      note: meta.note || '',
    });
  }

  rawMeta.sort((a, b) => a.rank - b.rank);

  const total = rawMeta.length;
  const highCut = Math.max(2, Math.min(6, Math.ceil(total * 0.34)));
  const midCut = Math.max(highCut + 1, Math.ceil(total * 0.68));

  // Decide if a dense single stroke needs tiny inside-the-brush micro-braid to prevent glyph overlap
  // while keeping the monumental silhouette 100% intact!
  const avgStepPx = total > 1 ? totalPx / (total - 1) : totalPx;
  const isBraidedStroke = avgStepPx < 30;
  // Tight perpendicular offset INSIDE the thick brush body (only ~17px–21px on a 640x480 canvas)
  const braidPx = avgStepPx < 20 ? 21 : isBraidedStroke ? 15 : 0;

  // Slide any intersecting-stroke stations purely TANGENTIALLY along the inked brushstroke spine
  // (zero off-stroke scatter!) so stroke crossings (十, 木, 又, 戈, 人, 口) never overlap two glyphs.
  const rawTs = rawMeta.map((_, idx) => (total <= 1 ? 0.5 : 0.02 + (idx / (total - 1)) * 0.96));
  const optimizedTs = (() => {
    if (total <= 1) return rawTs;
    const ts = [...rawTs];
    const minGapT = Math.min(0.018, 0.55 / Math.max(1, total));
    const targetClearPx = 38;

    const posOf = (idx: number, tVal: number) => {
      const pt = sampleDirectOnStroke(unifiedPath, cum, totalPx, tVal);
      const side = idx % 2 === 0 ? -1 : 1;
      return {
        x: Math.max(0.055, Math.min(0.945, pt.x + (pt.nx * side * braidPx) / STAGE_W)) * STAGE_W,
        y: Math.max(0.08, Math.min(0.92, pt.y + (pt.ny * side * braidPx) / STAGE_H)) * STAGE_H,
      };
    };

    const minDistFor = (idx: number, candT: number) => {
      const p = posOf(idx, candT);
      let best = 9999;
      for (let k = 0; k < total; k++) {
        if (k === idx) continue;
        const pk = posOf(k, ts[k]);
        const dk = Math.hypot(p.x - pk.x, p.y - pk.y);
        if (dk < best) best = dk;
      }
      return best;
    };

    for (let iter = 0; iter < 22; iter++) {
      let anyMoved = false;
      for (let i = 0; i < total; i++) {
        for (let j = i + 1; j < total; j++) {
          const pi = posOf(i, ts[i]);
          const pj = posOf(j, ts[j]);
          if (Math.hypot(pi.x - pj.x, pi.y - pj.y) >= targetClearPx) continue;

          for (const idx of [j, i]) {
            const lo = idx > 0 ? ts[idx - 1] + minGapT : 0.015;
            const hi = idx < total - 1 ? ts[idx + 1] - minGapT : 0.985;
            const curScore = minDistFor(idx, ts[idx]);
            let bestT = ts[idx];
            let bestScore = curScore;
            for (const step of [0.012, -0.012, 0.026, -0.026]) {
              const cand = Math.max(lo, Math.min(hi, ts[idx] + step));
              const score = minDistFor(idx, cand);
              if (score > bestScore + 0.4) {
                bestScore = score;
                bestT = cand;
              }
            }
            if (bestT !== ts[idx]) {
              ts[idx] = bestT;
              anyMoved = true;
            }
          }
        }
      }
      if (!anyMoved) break;
    }
    return ts;
  })();

  let highCount = 0;
  let midCount = 0;
  let lowCount = 0;

  const stations: JourneyStation[] = rawMeta.map((item, idx) => {
    const ma = item.ma;
    const daKey = ma[0] ?? spec.key;
    const shengKey = ma.length >= 3 ? ma[1] : null;
    const yunKey = ma[ma.length - 1] ?? 'a';

    // Distribute strictly along the inked brushstroke spine from start to finish
    const pathT = optimizedTs[idx];
    const pt = sampleDirectOnStroke(unifiedPath, cum, totalPx, pathT);

    // Zero offset on normal strokes; tiny inside-brush braid only on ultra-dense vertical/single bars (e.g. K)
    const side = idx % 2 === 0 ? -1 : 1;
    const x = Math.max(0.055, Math.min(0.945, pt.x + (pt.nx * side * braidPx) / STAGE_W));
    const y = Math.max(0.08, Math.min(0.92, pt.y + (pt.ny * side * braidPx) / STAGE_H));

    let tier: FrequencyTier;
    let tierLabel: string;
    let scale: number;
    if (idx < highCut) {
      tier = 'high';
      tierLabel = '高频起势';
      scale = idx === 0 ? 1.14 : 1.05;
      highCount++;
    } else if (idx < midCut) {
      tier = 'mid';
      tierLabel = '中频行笔';
      scale = 0.96;
      midCount++;
    } else {
      tier = 'low';
      tierLabel = '低频收尾';
      scale = 0.89;
      lowCount++;
    }

    return {
      index: idx,
      rank: item.rank,
      char: item.char,
      ma,
      daKey,
      shengKey,
      yunKey,
      note: item.note,
      tier,
      tierLabel,
      x,
      y,
      pathT,
      scale,
      isFeaturedMorph: featuredSet.has(item.char),
    };
  });

  const model: TopologicalPalaceModel = {
    key: spec.key,
    spec,
    monumentRadical,
    routeStrokes,
    unifiedPath,
    stations,
    isBraidedStroke,
    counts: {
      total,
      high: highCount,
      mid: midCount,
      low: lowCount,
    },
  };

  palaceCache.set(spec.key, model);
  return model;
}

export function getAllTopologicalPalaces(): TopologicalPalaceModel[] {
  return TWENTY_KEY_MORPHS.map((s) => buildTopologicalPalace(s.key));
}
