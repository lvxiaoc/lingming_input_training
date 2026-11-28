import { MorphBrushStroke, MorphPt, RadicalMorphNode } from './twentyKeysMorphTypes';

export type CornerShapeType =
  | 'right_angle'
  | 'wing_angle'
  | 'pivot_segment'
  | 'box_frame'
  | 'half_box'
  | 'inverted_t'
  | 'horizon_bar'
  | 'top_canopy'
  | 'twin_bars'
  | 'cross_lattice'
  | 'silk_curve'
  | 'peck_point'
  | 'wrap_arc'
  | 'loop_turn'
  | 'slant_blade'
  | 'needle_axis'
  | 'fold_hook'
  | 'split_stream'
  | 'a_frame'
  | 'sweep_hook'
  | 'wing_span';

export type ConvergenceTargetMode = 'point_corner' | 'shape_target';

export type ConvergenceBrushStyle =
  | 'default'
  | 'x_square_dun'
  | 'w_silk_flick'
  | 'c_round_cradle'
  | 'v_xuanzhen'
  | 'b_diagonal_light'
  | 'm_heavy_na'
  | 'p_inward_embrace'
  | 't_resistance_block';

export interface GraphSampleNode {
  id: number;
  x: number;
  y: number;
  p: number;
  angle: number;
  strokeIdx: number;
  tInStroke: number;
  distFromCorner: number;
  distNorm: number; // 0 at focus target -> 1 at farthest outer stroke tip
  nextHop: number; // -1 if target seed
}

export interface ConvergenceFlowStream {
  // Ordered polyline from an outer stroke tip along the stroke pillars inward to the focus target
  points: Array<{ x: number; y: number }>;
  startDistNorm: number;
  phaseOffset: number;
}

export interface CornerConvergenceData {
  key: string;
  radical: string;
  targetMode: ConvergenceTargetMode;
  shapeType: CornerShapeType;
  shapeSymbol: string; // e.g. '┌', '<', '□', '⊓', '┻', '━', '冖', '=' ...
  shapeLabel: string; // e.g. '横竖小直角 ┌', '半封闭方框 ⊓', '倒丁小凸座 ┻'
  cornerVertex: { x: number; y: number };
  // Isolated focus strokes (2 arms of ┌/<, or full □/⊓ walls, or ┻ inverted-T, etc.)
  cornerArms: MorphBrushStroke[];
  // Optional virtual guide lines connecting stroke anchor points (e.g. 业 top virtual horizontal across the 2 vertical starts)
  virtualLinks?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  // Optional glowing negative-space window sheltered inside/beneath strokes (B key: ⬚ 留白心窗)
  negativeBox?: { x: number; y: number; w: number; h: number };
  // Optional contrasting luminous jewel beads flanking a central axis (V key: ·│· 中轴分流珠)
  accentBeads?: Array<{ x: number; y: number }>;
  // Optional outer embracing quadratic crescent bracket (P key: ⟯ 右廓外括弧)
  embraceArc?: { start: { x: number; y: number }; ctrl: { x: number; y: number }; end: { x: number; y: number } };
  // Optional calligraphic brush style driven by finger-travel direction + classical brushwork
  brushStyle?: ConvergenceBrushStyle;
  // Optional upward/inward flick cue vector (W key: S→W ↑↖ 末锋挑钩)
  flickTip?: { from: { x: number; y: number }; to: { x: number; y: number } };
  // Optional muscle-resistance collision cue (T key: thrust force slamming into a blocking barrier wall)
  resistanceCue?: {
    thrustFrom: { x: number; y: number };
    thrustTo: { x: number; y: number };
    deflectTo: { x: number; y: number };
    // Normal direction pointing back toward the blocked thrust side for drawing the curved shield shock-arc
    shieldNormal: { x: number; y: number };
    strength: number; // 1.0 normal barrier, 1.45 heavy full-bow shield like 匕
    hasOwnStroke: boolean;
    // Optional reference strokes (e.g. 撇/提) tinted softly in cool blue-green as non-primary visual anchors
    referenceStrokes?: MorphBrushStroke[];
  };
  // Full glyph strokes (already visible in full at t=0)
  fullStrokes: MorphBrushStroke[];
  // Sampled strokes indexed identically to fullStrokes, each sample paired with geodesic distance `distNorm`
  sampledStrokes: Array<{
    stroke: MorphBrushStroke;
    points: GraphSampleNode[];
  }>;
  // Geodesic light paths flowing along the stroke pillars from all outer directions into the focus target
  flowStreams: ConvergenceFlowStream[];
  cueTitle: string;
  cueSummary: string;
}

interface Pt2 {
  x: number;
  y: number;
  p: number;
}

interface CornerCandidate {
  vertex: { x: number; y: number };
  arm1Pts: Pt2[];
  arm2Pts: Pt2[];
  shapeType: CornerShapeType;
  shapeSymbol: string;
  shapeLabel: string;
  score: number;
}

function norm2(dx: number, dy: number): { x: number; y: number; len: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 1, y: 0, len: 0 };
  return { x: dx / len, y: dy / len, len };
}

function sampleStrokeDense(points: MorphPt[], spacing = 0.024): Pt2[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y, p: points[0].p }];

  const raw: Pt2[] = [];
  const n = points.length;
  const get = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  const segSteps = 18;

  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const lim = i === n - 2 ? segSteps + 1 : segSteps;
    for (let s = 0; s < lim; s++) {
      const t = s / segSteps;
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
      raw.push({ x, y, p });
    }
  }

  const cum: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
  }
  const totalLen = cum[cum.length - 1] || 0.01;
  const count = Math.max(10, Math.min(40, Math.round(totalLen / spacing) + 1));

  const out: Pt2[] = [];
  let cursor = 0;
  for (let k = 0; k < count; k++) {
    const targetD = (k / (count - 1)) * totalLen;
    while (cursor < cum.length - 2 && cum[cursor + 1] < targetD) {
      cursor++;
    }
    const segLen = Math.max(1e-6, cum[cursor + 1] - cum[cursor]);
    const frac = Math.max(0, Math.min(1, (targetD - cum[cursor]) / segLen));
    const a = raw[cursor];
    const b = raw[cursor + 1] ?? a;
    out.push({
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
      p: a.p + (b.p - a.p) * frac,
    });
  }
  return out;
}

function classifyCornerRays(
  u1: { x: number; y: number },
  u2: { x: number; y: number }
): { shapeType: CornerShapeType; shapeSymbol: string; shapeLabel: string } {
  const bx = u1.x + u2.x;
  const by = u1.y + u2.y;
  const isAxisAligned =
    (Math.abs(u1.x) < 0.38 || Math.abs(u1.y) < 0.38) &&
    (Math.abs(u2.x) < 0.38 || Math.abs(u2.y) < 0.38);

  if (isAxisAligned) {
    if (bx >= 0 && by >= 0) {
      return { shapeType: 'right_angle', shapeSymbol: '┌', shapeLabel: '横竖小直角 ┌' };
    }
    if (bx < 0 && by >= 0) {
      return { shapeType: 'right_angle', shapeSymbol: '┐', shapeLabel: '顶折小直角 ┐' };
    }
    if (bx >= 0 && by < 0) {
      return { shapeType: 'right_angle', shapeSymbol: '└', shapeLabel: '折底小直角 └' };
    }
    return { shapeType: 'right_angle', shapeSymbol: '┘', shapeLabel: '收角小直角 ┘' };
  }

  if (Math.abs(bx) >= Math.abs(by) * 0.72) {
    if (bx >= 0) {
      return { shapeType: 'wing_angle', shapeSymbol: '<', shapeLabel: '倾角小翅膀 <' };
    }
    return { shapeType: 'wing_angle', shapeSymbol: '>', shapeLabel: '折锋小翅膀 >' };
  }
  if (by >= 0) {
    return { shapeType: 'wing_angle', shapeSymbol: '∧', shapeLabel: '人字聚角 ∧' };
  }
  return { shapeType: 'wing_angle', shapeSymbol: '∨', shapeLabel: '折翼承角 ∨' };
}

function trimRayPoints(
  pts: Pt2[],
  startIdx: number,
  step: 1 | -1,
  maxArmLen = 0.24
): Pt2[] {
  const result: Pt2[] = [pts[startIdx]];
  let acc = 0;
  let i = startIdx;
  while (true) {
    const nextIdx = i + step;
    if (nextIdx < 0 || nextIdx >= pts.length) break;
    const prev = pts[i];
    const cur = pts[nextIdx];
    const seg = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (acc + seg > maxArmLen && result.length >= 2) {
      const remain = Math.max(0, maxArmLen - acc);
      const frac = seg > 1e-6 ? remain / seg : 0;
      result.push({
        x: prev.x + (cur.x - prev.x) * frac,
        y: prev.y + (cur.y - prev.y) * frac,
        p: prev.p + (cur.p - prev.p) * frac,
      });
      break;
    }
    acc += seg;
    result.push(cur);
    i = nextIdx;
  }
  return result;
}

function toMorphStroke(pts: Pt2[], minP = 0.76): MorphBrushStroke {
  return {
    dunbiStart: false,
    flickEnd: false,
    points: pts.map((pt) => ({ x: pt.x, y: pt.y, p: Math.max(minP, pt.p) })),
  };
}

function centroidOfStrokes(strokes: MorphBrushStroke[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let cnt = 0;
  strokes.forEach((st) => {
    st.points.forEach((pt) => {
      sx += pt.x;
      sy += pt.y;
      cnt++;
    });
  });
  return cnt > 0 ? { x: sx / cnt, y: sy / cnt } : { x: 0.5, y: 0.5 };
}

function closestJoinIndices(listA: Pt2[], listB: Pt2[]): { ia: number; ib: number; dist: number } {
  let minD = Infinity;
  let ia = 0;
  let ib = 0;
  for (let a = 0; a < listA.length; a++) {
    for (let b = 0; b < listB.length; b++) {
      const d = Math.hypot(listA[a].x - listB[b].x, listA[a].y - listB[b].y);
      if (d < minD) {
        minD = d;
        ia = a;
        ib = b;
      }
    }
  }
  return { ia, ib, dist: minD };
}

interface FocusSpecResult {
  targetMode: ConvergenceTargetMode;
  vertex: { x: number; y: number };
  cornerArms: MorphBrushStroke[];
  virtualLinks?: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }>;
  negativeBox?: { x: number; y: number; w: number; h: number };
  accentBeads?: Array<{ x: number; y: number }>;
  embraceArc?: { start: { x: number; y: number }; ctrl: { x: number; y: number }; end: { x: number; y: number } };
  brushStyle?: ConvergenceBrushStyle;
  flickTip?: { from: { x: number; y: number }; to: { x: number; y: number } };
  resistanceCue?: CornerConvergenceData['resistanceCue'];
  shapeType: CornerShapeType;
  shapeSymbol: string;
  shapeLabel: string;
}

// 1. H-key Point Corner / Wing Detector (user-tuned for H: ┌ or <, including exact overrides on 文/子/予/身)
const H_CORNER_PAIR_OVERRIDES: Record<
  string,
  { strokeA: number; stepA: 1 | -1; strokeB: number; stepB: 1 | -1; armLen?: number }
> = {
  'h-wen': { strokeA: 1, stepA: -1, strokeB: 3, stepB: 1, armLen: 0.17 },
  'h-zi': { strokeA: 2, stepA: -1, strokeB: 1, stepB: 1, armLen: 0.21 },
  'h-yu': { strokeA: 0, stepA: 1, strokeB: 1, stepB: 1, armLen: 0.15 },
  'h-shen': { strokeA: 0, stepA: 1, strokeB: 3, stepB: 1, armLen: 0.17 },
};

function detectHCorners(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const pairOverride = H_CORNER_PAIR_OVERRIDES[node.id];
  if (
    pairOverride &&
    pairOverride.strokeA < sampledLists.length &&
    pairOverride.strokeB < sampledLists.length
  ) {
    const listA = sampledLists[pairOverride.strokeA];
    const listB = sampledLists[pairOverride.strokeB];
    const { ia, ib } = closestJoinIndices(listA, listB);
    const vertex = {
      x: (listA[ia].x + listB[ib].x) * 0.5,
      y: (listA[ia].y + listB[ib].y) * 0.5,
    };
    const armLimit = pairOverride.armLen ?? 0.18;
    const armA = trimRayPoints(listA, ia, pairOverride.stepA, armLimit);
    const armB = trimRayPoints(listB, ib, pairOverride.stepB, armLimit);
    if (armA.length >= 2 && armB.length >= 2) {
      const tipA = armA[armA.length - 1];
      const tipB = armB[armB.length - 1];
      const u1 = norm2(tipA.x - vertex.x, tipA.y - vertex.y);
      const u2 = norm2(tipB.x - vertex.x, tipB.y - vertex.y);
      const classified = classifyCornerRays(u1, u2);
      return {
        targetMode: 'point_corner',
        vertex,
        cornerArms: [toMorphStroke([...armA].reverse()), toMorphStroke(armB)],
        shapeType: classified.shapeType,
        shapeSymbol: classified.shapeSymbol,
        shapeLabel: classified.shapeLabel,
      };
    }
  }

  const coreCount = node.coreStrokes.length;
  const candidates: CornerCandidate[] = [];

  allStrokes.forEach((st, sIdx) => {
    const pts = st.points;
    if (pts.length < 3) return;
    const dense = sampledLists[sIdx];
    const isCore = sIdx < coreCount;

    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const next = pts[i + 1];
      const v1 = norm2(prev.x - cur.x, prev.y - cur.y);
      const v2 = norm2(next.x - cur.x, next.y - cur.y);
      if (v1.len < 0.085 || v2.len < 0.085) continue;

      const cos = v1.x * v2.x + v1.y * v2.y;
      if (cos < -0.64 || cos > 0.64) continue;

      let nearIdx = 0;
      let nearDist = Infinity;
      dense.forEach((dp, di) => {
        const d = Math.hypot(dp.x - cur.x, dp.y - cur.y);
        if (d < nearDist) {
          nearDist = d;
          nearIdx = di;
        }
      });

      const arm1Out = trimRayPoints(dense, nearIdx, -1, 0.22);
      const arm2Out = trimRayPoints(dense, nearIdx, 1, 0.22);
      if (arm1Out.length < 2 || arm2Out.length < 2) continue;

      const classified = classifyCornerRays(v1, v2);
      const rightAngleCloseness = 1 - Math.abs(cos) * 1.1;
      const lenBonus = Math.min(0.32, Math.min(v1.len, v2.len) * 0.9);
      const coreBonus = isCore ? 0.42 : 0;
      const hBonus =
        (cur.y <= 0.56 ? 0.34 : 0) +
        (classified.shapeSymbol === '┌' || classified.shapeSymbol === '<' ? 0.28 : 0.14);

      candidates.push({
        vertex: { x: cur.x, y: cur.y },
        arm1Pts: [...arm1Out].reverse(),
        arm2Pts: arm2Out,
        shapeType: classified.shapeType,
        shapeSymbol: classified.shapeSymbol,
        shapeLabel: classified.shapeLabel,
        score: rightAngleCloseness + lenBonus + coreBonus + hBonus,
      });
    }
  });

  for (let a = 0; a < sampledLists.length; a++) {
    for (let b = a + 1; b < sampledLists.length; b++) {
      const listA = sampledLists[a];
      const listB = sampledLists[b];
      const { ia, ib, dist: minD } = closestJoinIndices(listA, listB);
      if (minD > 0.085) continue;

      const vertex = {
        x: (listA[ia].x + listB[ib].x) * 0.5,
        y: (listA[ia].y + listB[ib].y) * 0.5,
      };
      const isCorePair = a < coreCount && b < coreCount;
      const oneCore = a < coreCount || b < coreCount;

      const getRays = (
        list: Pt2[],
        idx: number
      ): Array<{ pts: Pt2[]; vec: { x: number; y: number } }> => {
        const rays: Array<{ pts: Pt2[]; vec: { x: number; y: number } }> = [];
        if (idx >= 2) {
          const arm = trimRayPoints(list, idx, -1, 0.22);
          const tip = arm[arm.length - 1];
          const n = norm2(tip.x - list[idx].x, tip.y - list[idx].y);
          if (n.len >= 0.09) rays.push({ pts: arm, vec: { x: n.x, y: n.y } });
        }
        if (idx <= list.length - 3) {
          const arm = trimRayPoints(list, idx, 1, 0.22);
          const tip = arm[arm.length - 1];
          const n = norm2(tip.x - list[idx].x, tip.y - list[idx].y);
          if (n.len >= 0.09) rays.push({ pts: arm, vec: { x: n.x, y: n.y } });
        }
        return rays;
      };

      const raysA = getRays(listA, ia);
      const raysB = getRays(listB, ib);

      for (const ra of raysA) {
        for (const rb of raysB) {
          const cos = ra.vec.x * rb.vec.x + ra.vec.y * rb.vec.y;
          if (cos < -0.58 || cos > 0.62) continue;

          const classified = classifyCornerRays(ra.vec, rb.vec);
          const rightAngleCloseness = 1 - Math.abs(cos) * 1.1;
          const joinTightness = Math.max(0, 0.24 - minD * 2.4);
          const coreBonus = isCorePair ? 0.48 : oneCore ? 0.24 : 0;
          const hBonus =
            (vertex.y <= 0.56 ? 0.34 : 0) +
            (classified.shapeSymbol === '┌' || classified.shapeSymbol === '<' ? 0.28 : 0.14);

          candidates.push({
            vertex,
            arm1Pts: [...ra.pts].reverse(),
            arm2Pts: rb.pts,
            shapeType: classified.shapeType,
            shapeSymbol: classified.shapeSymbol,
            shapeLabel: classified.shapeLabel,
            score: rightAngleCloseness + joinTightness + coreBonus + hBonus,
          });
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((x, y) => y.score - x.score);
    const best = candidates[0];
    return {
      targetMode: 'point_corner',
      vertex: best.vertex,
      cornerArms: [toMorphStroke(best.arm1Pts), toMorphStroke(best.arm2Pts)],
      shapeType: best.shapeType,
      shapeSymbol: best.shapeSymbol,
      shapeLabel: best.shapeLabel,
    };
  }

  return {
    targetMode: 'point_corner',
    vertex: centroidOfStrokes(allStrokes),
    cornerArms: node.coreStrokes.length > 0 ? node.coreStrokes : allStrokes.slice(0, 1),
    shapeType: 'right_angle',
    shapeSymbol: '┌',
    shapeLabel: '横竖小直角 ┌',
  };
}

// 2a. D Key Unified Bottom-Open Frame (冂 — 同字外框，口不封底)
function detectDOpenFrame(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const dropHookTail = (st: MorphBrushStroke): MorphBrushStroke =>
    st.points.length >= 6
      ? {
          dunbiStart: false,
          flickEnd: false,
          points: st.points.slice(0, 5).map((p) => ({ ...p, p: Math.max(0.76, p.p) })),
        }
      : st;

  let arms: MorphBrushStroke[] = [];

  if (node.id === 'd-er' && allStrokes.length >= 3) {
    const topPts = sampledLists[0].filter((pt) => pt.x >= 0.31 && pt.x <= 0.69);
    arms = [
      allStrokes[2],
      topPts.length >= 2 ? toMorphStroke(topPts) : allStrokes[0],
      allStrokes[1],
    ];
  } else if (node.id === 'd-jin' && allStrokes.length >= 4) {
    const leftPts = sampledLists[3].filter((pt) => pt.y >= 0.455);
    const topPts = sampledLists[0].filter((pt) => pt.x <= 0.635);
    arms = [
      leftPts.length >= 2 ? toMorphStroke(leftPts) : allStrokes[3],
      topPts.length >= 2 ? toMorphStroke(topPts) : allStrokes[0],
      allStrokes[1],
    ];
  } else if (node.id === 'd-ling' && sampledLists.length >= 2) {
    const leftArc = sampledLists[0].filter((pt) => pt.y <= 0.73);
    const rightArc = sampledLists[1].filter((pt) => pt.y <= 0.73);
    arms = [
      leftArc.length >= 2 ? toMorphStroke(leftArc) : allStrokes[0],
      rightArc.length >= 2 ? toMorphStroke(rightArc) : allStrokes[1],
    ];
  } else if (['d-yu', 'd-er2', 'd-zhou', 'd-pi'].includes(node.id) && allStrokes.length >= 2) {
    arms = [allStrokes[0], dropHookTail(allStrokes[1])];
  } else if (allStrokes.length >= 2) {
    // 口, 目, 早, 面, 曲 -> left vertical + top-right ┐ (leaving bottom open!)
    arms = [allStrokes[0], allStrokes[1]];
  } else {
    arms = allStrokes.slice(0, 1);
  }

  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(arms),
    cornerArms: arms,
    shapeType: 'half_box',
    shapeSymbol: '冂',
    shapeLabel: '同字外框 冂',
  };
}

// 2b. K Key Unified Vertical / Pie Single-Axis Focus (只保留 竖 │ 和 竖撇 丿)
function detectKVertOrPie(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[]
): FocusSpecResult {
  const slicePoints = (st: MorphBrushStroke, start: number, end: number): MorphBrushStroke => {
    const pts = st.points.slice(start, end);
    return pts.length >= 2
      ? { dunbiStart: false, flickEnd: false, points: pts.map((p) => ({ ...p, p: Math.max(0.76, p.p) })) }
      : st;
  };

  // Radicals anchored on a crisp 竖撇 / 长撇 (丿)
  const pieIdxMap: Record<string, number> = {
    'k-pie': 0,
    'k-li': 0,
    'k-ji': 0,
    'k-sanpie': 0,
    'k-shu': 0,
    'k-shi': 0,
    'k-xue': 3,
  };
  if (node.id in pieIdxMap) {
    const st = allStrokes[pieIdxMap[node.id]] ?? allStrokes[0];
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes([st]),
      cornerArms: [st],
      shapeType: 'needle_axis',
      shapeSymbol: '丿',
      shapeLabel: '中锋竖撇 丿',
    };
  }

  // Pure vertical (竖 │) selection — slicing off hooks/turns so only the straight upright shaft remains
  let vertStroke = allStrokes[0];
  if (node.id === 'k-bai' && allStrokes.length > 1) {
    vertStroke = allStrokes[1];
  } else if (node.id === 'k-gu' && allStrokes.length > 5) {
    vertStroke = allStrokes[5];
  } else if (node.id === 'k-chang' && allStrokes.length > 0) {
    vertStroke = slicePoints(allStrokes[0], 0, 3);
  } else if (node.id === 'k-wang' && allStrokes.length > 2) {
    vertStroke = slicePoints(allStrokes[2], 0, 3);
  } else if (node.id === 'k-chu' && allStrokes.length > 0) {
    vertStroke = slicePoints(allStrokes[0], 0, 3);
  } else if (node.coreStrokes.length > 0) {
    vertStroke = node.coreStrokes[0];
  }

  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes([vertStroke]),
    cornerArms: [vertStroke],
    shapeType: 'needle_axis',
    shapeSymbol: '│',
    shapeLabel: '中锋直竖 │',
  };
}

// 3. S Key: Compact Inverted-T Pedestal (┻ — horizontal bar + short upward protrusion!)
function detectSInvertedT(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  // Special S-key tuning: 豕 uses its curved bow (stroke 0, 弯钩/反弓) + the right-side 撇 (stroke 6) to form a tilted inverted-T (┻)
  if (node.id === 's-shizhu' && sampledLists.length >= 7) {
    const bowPts = sampledLists[0];
    const piePts = sampledLists[6];
    const { ia, ib } = closestJoinIndices(bowPts, piePts);
    const vertex = {
      x: (bowPts[ia].x + piePts[ib].x) * 0.5,
      y: (bowPts[ia].y + piePts[ib].y) * 0.5,
    };
    const bowUp = trimRayPoints(bowPts, ia, -1, 0.19);
    const bowDown = trimRayPoints(bowPts, ia, 1, 0.19);
    const bowCombined: Pt2[] = [...[...bowUp].reverse(), ...bowDown.slice(1)];
    const pieSpur = trimRayPoints(piePts, ib, -1, 0.2);
    const arms: MorphBrushStroke[] = [];
    if (bowCombined.length >= 2) arms.push(toMorphStroke(bowCombined));
    if (pieSpur.length >= 2) arms.push(toMorphStroke([...pieSpur].reverse()));
    if (arms.length >= 2) {
      return {
        targetMode: 'shape_target',
        vertex,
        cornerArms: arms,
        shapeType: 'inverted_t',
        shapeSymbol: '┻',
        shapeLabel: '倒丁小凸座 ┻',
      };
    }
  }

  const coreCount = node.coreStrokes.length;
  let bestScore = -Infinity;
  let bestBaseIdx = coreCount >= 2 ? 1 : 0;
  let bestStemIdx = coreCount >= 2 ? 0 : Math.min(1, allStrokes.length - 1);
  let bestBaseJoin = 0;
  let bestStemJoin = 0;

  for (let b = 0; b < sampledLists.length; b++) {
    const bPts = sampledLists[b];
    if (bPts.length < 2) continue;
    for (let s = 0; s < sampledLists.length; s++) {
      if (b === s) continue;
      const sPts = sampledLists[s];
      if (sPts.length < 2) continue;

      const { ia, ib, dist } = closestJoinIndices(bPts, sPts);
      if (dist > 0.11) continue;

      const leftW = trimRayPoints(bPts, ia, -1, 0.16);
      const rightW = trimRayPoints(bPts, ia, 1, 0.16);
      const lEnd = leftW[leftW.length - 1];
      const rEnd = rightW[rightW.length - 1];
      const baseDx = Math.abs(rEnd.x - lEnd.x);
      const baseDy = Math.abs(rEnd.y - lEnd.y);
      const baseSpan = Math.hypot(baseDx, baseDy);
      if (baseSpan < 0.14) continue;
      const horizontality = (baseDx - baseDy) / Math.max(0.05, baseSpan);

      // Measure how cleanly sPts rises upward above the join point
      const upFromStart = sPts[ib].y - sPts[0].y;
      const upFromEnd = sPts[ib].y - sPts[sPts.length - 1].y;
      const maxUpward = Math.max(upFromStart, upFromEnd);
      if (maxUpward < 0.08) continue;

      const bothSidesBonus = leftW.length >= 2 && rightW.length >= 2 ? 0.42 : 0;
      const coreBonus = (b < coreCount ? 0.25 : 0) + (s < coreCount ? 0.25 : 0);
      const lowerBonus = bPts[ia].y * 0.28;
      const score = horizontality * 1.15 + Math.min(0.45, maxUpward) + bothSidesBonus + coreBonus + lowerBonus - dist * 2;

      if (score > bestScore) {
        bestScore = score;
        bestBaseIdx = b;
        bestStemIdx = s;
        bestBaseJoin = ia;
        bestStemJoin = ib;
      }
    }
  }

  const basePts = sampledLists[bestBaseIdx] ?? sampledLists[0];
  const stemPts = sampledLists[bestStemIdx] ?? basePts;

  if (bestBaseIdx === bestStemIdx || basePts.length < 2 || stemPts.length < 2) {
    const strokes = node.coreStrokes.length ? node.coreStrokes : allStrokes.slice(0, 1);
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes(strokes),
      cornerArms: strokes,
      shapeType: 'inverted_t',
      shapeSymbol: '┻',
      shapeLabel: '倒丁小凸座 ┻',
    };
  }

  const joinFallback =
    bestScore > -Infinity
      ? { ia: bestBaseJoin, ib: bestStemJoin }
      : closestJoinIndices(basePts, stemPts);
  const baseJoinIdx = joinFallback.ia;
  const stemJoinIdx = joinFallback.ib;
  const vertex = {
    x: (basePts[baseJoinIdx].x + stemPts[stemJoinIdx].x) * 0.5,
    y: (basePts[baseJoinIdx].y + stemPts[stemJoinIdx].y) * 0.5,
  };

  // Horizontal base segment spanning smoothly left + right around the junction (`~0.17` each side)
  const leftWing = trimRayPoints(basePts, baseJoinIdx, -1, 0.17);
  const rightWing = trimRayPoints(basePts, baseJoinIdx, 1, 0.17);
  const baseCombined: Pt2[] = [...[...leftWing].reverse(), ...rightWing.slice(1)];

  // Upward vertical/rising protrusion above the horizontal base (`~0.18` upward!)
  const stemStartY = stemPts[0].y;
  const stemEndY = stemPts[stemPts.length - 1].y;
  const upStep: 1 | -1 =
    stemJoinIdx > 1 && stemStartY < stemPts[stemJoinIdx].y
      ? -1
      : stemJoinIdx < stemPts.length - 2 && stemEndY < stemPts[stemJoinIdx].y
        ? 1
        : stemJoinIdx > 0
          ? -1
          : 1;
  const upSpur = trimRayPoints(stemPts, stemJoinIdx, upStep, 0.18);

  const arms: MorphBrushStroke[] = [];
  if (baseCombined.length >= 2) arms.push(toMorphStroke(baseCombined));
  if (upSpur.length >= 2) arms.push(toMorphStroke([...upSpur].reverse()));

  return {
    targetMode: 'shape_target',
    vertex,
    cornerArms: arms.length > 0 ? arms : node.coreStrokes,
    shapeType: 'inverted_t',
    shapeSymbol: '┻',
    shapeLabel: '倒丁小凸座 ┻',
  };
}

// 3b. L Key: Right-Pointing Rotated-T (┣ — 丁字旋转朝右：竖脊 + 向右凸出短横)
function detectLRightT(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  // Special handling for 八 (no horizontal stroke -> left spine + virtual rightward bar to right stroke midpoint)
  if (node.id === 'l-ba' && sampledLists.length >= 2) {
    const leftPts = sampledLists[0];
    const rightPts = sampledLists[1];
    const leftMidIdx = Math.floor(leftPts.length * 0.48);
    const leftMid = leftPts[leftMidIdx];
    let rightMid = rightPts[Math.floor(rightPts.length * 0.5)];
    let bestDy = Infinity;
    for (const pt of rightPts) {
      const dy = Math.abs(pt.y - leftMid.y);
      if (dy < bestDy) {
        bestDy = dy;
        rightMid = pt;
      }
    }
    const spineUp = trimRayPoints(leftPts, leftMidIdx, -1, 0.2);
    const spineDown = trimRayPoints(leftPts, leftMidIdx, 1, 0.2);
    const spineCombined: Pt2[] = [...[...spineUp].reverse(), ...spineDown.slice(1)];
    const arms = [toMorphStroke(spineCombined.length >= 2 ? spineCombined : leftPts)];
    return {
      targetMode: 'shape_target',
      vertex: { x: leftMid.x, y: leftMid.y },
      cornerArms: arms,
      virtualLinks: [
        {
          from: { x: leftMid.x, y: leftMid.y },
          to: { x: rightMid.x, y: rightMid.y },
        },
      ],
      shapeType: 'needle_axis',
      shapeSymbol: '┣',
      shapeLabel: '右向丁字 ┣',
    };
  }

  // Special handling for 冂 (left vertical + rightward top bar from top-left)
  if (node.id === 'l-tong' && sampledLists.length >= 2) {
    const leftSpine = trimRayPoints(sampledLists[0], 0, 1, 0.36);
    const topRight = trimRayPoints(sampledLists[1], 0, 1, 0.24);
    const arms = [toMorphStroke(leftSpine), toMorphStroke(topRight)];
    return {
      targetMode: 'shape_target',
      vertex: { x: leftSpine[0].x, y: leftSpine[0].y },
      cornerArms: arms,
      shapeType: 'needle_axis',
      shapeSymbol: '┣',
      shapeLabel: '右向丁字 ┣',
    };
  }

  const coreCount = node.coreStrokes.length;
  let bestScore = -Infinity;
  let bestVertIdx = -1;
  let bestBarIdx = -1;
  let bestVertJoin = 0;
  let bestBarJoin = 0;
  let bestRightStep: 1 | -1 = 1;

  for (let v = 0; v < sampledLists.length; v++) {
    const vPts = sampledLists[v];
    if (vPts.length < 3) continue;
    for (let r = 0; r < sampledLists.length; r++) {
      if (v === r) continue;
      const rPts = sampledLists[r];
      if (rPts.length < 2) continue;

      const { ia, ib, dist } = closestJoinIndices(vPts, rPts);
      if (dist > 0.12) continue;

      // Measure vertical spine segment above & below join
      const upSeg = trimRayPoints(vPts, ia, -1, 0.17);
      const downSeg = trimRayPoints(vPts, ia, 1, 0.17);
      const uEnd = upSeg[upSeg.length - 1];
      const dEnd = downSeg[downSeg.length - 1];
      const vDx = Math.abs(dEnd.x - uEnd.x);
      const vDy = Math.abs(dEnd.y - uEnd.y);
      const vSpan = Math.hypot(vDx, vDy);
      if (vSpan < 0.16) continue;
      const verticality = (vDy - vDx) / Math.max(0.05, vSpan);
      if (verticality < 0.15) continue;

      // Check which direction along rPts goes RIGHT (+x) from ib
      const rForward = trimRayPoints(rPts, ib, 1, 0.2);
      const rBackward = trimRayPoints(rPts, ib, -1, 0.2);
      const fwdDx = rForward[rForward.length - 1].x - rPts[ib].x;
      const bwdDx = rBackward[rBackward.length - 1].x - rPts[ib].x;

      let step: 1 | -1 = 1;
      let spur = rForward;
      let spurDx = fwdDx;
      if (bwdDx > fwdDx) {
        step = -1;
        spur = rBackward;
        spurDx = bwdDx;
      }
      if (spur.length < 2 || spurDx < 0.1) continue;
      const spurDy = Math.abs(spur[spur.length - 1].y - rPts[ib].y);
      const spurLen = Math.hypot(spurDx, spurDy);
      const rightwardness = (spurDx - spurDy * 0.7) / Math.max(0.05, spurLen);

      const bothUpDownBonus = upSeg.length >= 3 && downSeg.length >= 3 ? 0.65 : 0;
      const coreBonus = (v < coreCount ? 0.28 : 0) + (r < coreCount ? 0.28 : 0);
      const centerBonus = 1 - Math.abs(vPts[ia].y - 0.46) * 0.8;
      const score =
        verticality * 1.1 +
        rightwardness * 1.15 +
        bothUpDownBonus +
        coreBonus +
        centerBonus * 0.25 -
        dist * 2.5;

      if (score > bestScore) {
        bestScore = score;
        bestVertIdx = v;
        bestBarIdx = r;
        bestVertJoin = ia;
        bestBarJoin = ib;
        bestRightStep = step;
      }
    }
  }

  if (bestVertIdx !== -1 && bestBarIdx !== -1) {
    const vPts = sampledLists[bestVertIdx];
    const rPts = sampledLists[bestBarIdx];
    const vertex = {
      x: (vPts[bestVertJoin].x + rPts[bestBarJoin].x) * 0.5,
      y: (vPts[bestVertJoin].y + rPts[bestBarJoin].y) * 0.5,
    };
    const upWing = trimRayPoints(vPts, bestVertJoin, -1, 0.18);
    const downWing = trimRayPoints(vPts, bestVertJoin, 1, 0.18);
    const vertCombined: Pt2[] = [...[...upWing].reverse(), ...downWing.slice(1)];
    const rightSpur = trimRayPoints(rPts, bestBarJoin, bestRightStep, 0.2);

    const arms: MorphBrushStroke[] = [];
    if (vertCombined.length >= 2) arms.push(toMorphStroke(vertCombined));
    if (rightSpur.length >= 2) arms.push(toMorphStroke(rightSpur));

    if (arms.length >= 2) {
      return {
        targetMode: 'shape_target',
        vertex,
        cornerArms: arms,
        shapeType: 'needle_axis',
        shapeSymbol: '┣',
        shapeLabel: '右向丁字 ┣',
      };
    }
  }

  const fallback = node.coreStrokes.length > 0 ? node.coreStrokes : allStrokes.slice(0, 1);
  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(fallback),
    cornerArms: fallback,
    shapeType: 'needle_axis',
    shapeSymbol: '┣',
    shapeLabel: '右向丁字 ┣',
  };
}

// 4. Q Key & X Key Compact Cross Intersection (╪ / ┼)
function detectCrossFocus(
  key: 'q' | 'x',
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const isQ = key === 'q';
  const shapeType: CornerShapeType = isQ ? 'cross_lattice' : 'pivot_segment';
  const shapeSymbol = isQ ? '╪' : '┼';
  const shapeLabel = isQ ? '绞锋交叉结 ╪' : '十字立桩 ┼';

  if (sampledLists.length >= 2) {
    const listA = sampledLists[0];
    const listB = sampledLists[1];
    const { ia, ib, dist } = closestJoinIndices(listA, listB);
    if (dist < 0.14) {
      const vertex = {
        x: (listA[ia].x + listB[ib].x) * 0.5,
        y: (listA[ia].y + listB[ib].y) * 0.5,
      };
      const armA1 = trimRayPoints(listA, ia, -1, 0.17);
      const armA2 = trimRayPoints(listA, ia, 1, 0.17);
      const armB1 = trimRayPoints(listB, ib, -1, 0.17);
      const armB2 = trimRayPoints(listB, ib, 1, 0.17);
      const crossA = [...[...armA1].reverse(), ...armA2.slice(1)];
      const crossB = [...[...armB1].reverse(), ...armB2.slice(1)];
      const arms: MorphBrushStroke[] = [];
      if (crossA.length >= 2) arms.push(toMorphStroke(crossA));
      if (crossB.length >= 2) arms.push(toMorphStroke(crossB));
      if (arms.length >= 1) {
        return {
          targetMode: isQ ? 'shape_target' : 'point_corner',
          vertex,
          cornerArms: arms,
          shapeType,
          shapeSymbol,
          shapeLabel,
        };
      }
    }
  }

  const strokes = node.coreStrokes.length ? node.coreStrokes : allStrokes.slice(0, 1);
  return {
    targetMode: isQ ? 'shape_target' : 'point_corner',
    vertex: centroidOfStrokes(strokes),
    cornerArms: strokes,
    shapeType,
    shapeSymbol,
    shapeLabel,
  };
}

// 4b. N Key: Dual Parallel / 3D-Perspective Twin Rails (‖ vertical walls or top-separated 八 rails)
function detectNParallelRails(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const sliceDenseFrac = (pts: Pt2[], startFrac: number, endFrac: number): Pt2[] => {
    if (pts.length <= 2) return pts;
    const i0 = Math.max(0, Math.min(pts.length - 2, Math.round((pts.length - 1) * startFrac)));
    const i1 = Math.max(i0 + 1, Math.min(pts.length - 1, Math.round((pts.length - 1) * endFrac)));
    return pts.slice(i0, i1 + 1);
  };

  // Rectangular / dual-pillar radicals on N -> exact parallel left & right vertical rails (‖)
  const verticalPairSpecs: Record<
    string,
    { leftIdx: number; rightIdx: number; rightSliceStart?: number; rightSliceEnd?: number }
  > = {
    'n-zi': { leftIdx: 2, rightIdx: 1, rightSliceStart: 1 },
    'n-wei': { leftIdx: 0, rightIdx: 1, rightSliceStart: 2 },
    'n-xi': { leftIdx: 3, rightIdx: 4, rightSliceStart: 2 },
    'n-you': { leftIdx: 3, rightIdx: 4, rightSliceStart: 2 },
    'n-zhu': { leftIdx: 3, rightIdx: 5, rightSliceStart: 0, rightSliceEnd: 3 },
  };

  const vSpec = verticalPairSpecs[node.id];
  if (vSpec && vSpec.leftIdx < allStrokes.length && vSpec.rightIdx < allStrokes.length) {
    const leftStroke = allStrokes[vSpec.leftIdx];
    const rightOrig = allStrokes[vSpec.rightIdx];
    const startIdx = vSpec.rightSliceStart ?? 0;
    const endIdx = vSpec.rightSliceEnd ?? rightOrig.points.length;
    const rightSlice = rightOrig.points.slice(startIdx, endIdx);
    const rightStroke: MorphBrushStroke =
      rightSlice.length >= 2
        ? { dunbiStart: false, flickEnd: false, points: rightSlice.map((p) => ({ ...p, p: Math.max(0.76, p.p) })) }
        : rightOrig;
    const arms = [leftStroke, rightStroke];
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes(arms),
      cornerArms: arms,
      shapeType: 'a_frame',
      shapeSymbol: '‖',
      shapeLabel: '平行双竖 ‖',
    };
  }

  // Perspective-extending twin rails (八 / 丷): keep tops cleanly separated like 3D receding parallel rails
  if (sampledLists.length >= 2) {
    let leftPts = sampledLists[0];
    let rightPts = sampledLists[1];

    if (node.id === 'n-ren') {
      leftPts = sliceDenseFrac(sampledLists[0], 0.42, 1.0);
      rightPts = sliceDenseFrac(sampledLists[1], 0.18, 1.0);
    } else if (node.id === 'n-he' || node.id === 'n-shi') {
      leftPts = sliceDenseFrac(sampledLists[0], 0.26, 1.0);
      rightPts = sliceDenseFrac(sampledLists[1], 0.26, 1.0);
    } else if (node.id === 'n-wu') {
      rightPts = sliceDenseFrac(sampledLists[1], 0.0, 0.7);
    }

    const arms = [toMorphStroke(leftPts), toMorphStroke(rightPts)];
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes(arms),
      cornerArms: arms,
      shapeType: 'a_frame',
      shapeSymbol: '八',
      shapeLabel: '透视平行轨 八',
    };
  }

  const fallback = node.coreStrokes.length > 0 ? node.coreStrokes : allStrokes.slice(0, 1);
  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(fallback),
    cornerArms: fallback,
    shapeType: 'a_frame',
    shapeSymbol: '‖',
    shapeLabel: '双轨平行 ‖',
  };
}

// 4c. X Key: Bottom-Left L-Pocket Corner (└ — completes ┌ / ┐ / └ corner triad, cleanly distinct from Q ╪)
function detectXBottomLeftCorner(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  if (node.id === 'x-fang' && sampledLists.length >= 2) {
    const dense = sampledLists[1];
    let nearIdx = 0;
    let bestD = Infinity;
    dense.forEach((pt, idx) => {
      const d = Math.hypot(pt.x - 0.23, pt.y - 0.78);
      if (d < bestD) {
        bestD = d;
        nearIdx = idx;
      }
    });
    const armUp = trimRayPoints(dense, nearIdx, -1, 0.24);
    const armRight = trimRayPoints(dense, nearIdx, 1, 0.24);
    if (armUp.length >= 2 && armRight.length >= 2) {
      return {
        targetMode: 'point_corner',
        vertex: { x: dense[nearIdx].x, y: dense[nearIdx].y },
        cornerArms: [toMorphStroke([...armUp].reverse()), toMorphStroke(armRight)],
        brushStyle: 'x_square_dun',
        shapeType: 'right_angle',
        shapeSymbol: '└',
        shapeLabel: '竖折方顿 └',
      };
    }
  }

  if (node.id === 'x-xi' && sampledLists.length >= 3) {
    const s1 = sampledLists[1];
    const startIdx = Math.min(s1.length - 2, Math.max(1, Math.floor(s1.length * 0.14)));
    const vertex = { x: s1[startIdx].x, y: s1[startIdx].y };
    const armRight = trimRayPoints(s1, startIdx, 1, 0.24);
    const dotTop = allStrokes[2].points[0];
    return {
      targetMode: 'point_corner',
      vertex,
      cornerArms: [toMorphStroke(armRight.length >= 2 ? armRight : s1)],
      virtualLinks: [
        {
          from: { x: dotTop.x, y: dotTop.y },
          to: vertex,
        },
      ],
      brushStyle: 'x_square_dun',
      shapeType: 'right_angle',
      shapeSymbol: '└',
      shapeLabel: '竖折方顿 └',
    };
  }

  const pairSpecs: Record<string, { vertIdx: number; horizIdx: number; armLen: number }> = {
    'x-mu': { vertIdx: 1, horizIdx: 0, armLen: 0.22 },
    'x-mu2': { vertIdx: 1, horizIdx: 0, armLen: 0.22 },
    'x-li': { vertIdx: 2, horizIdx: 5, armLen: 0.22 },
    'x-jia': { vertIdx: 2, horizIdx: 4, armLen: 0.22 },
  };
  const spec = pairSpecs[node.id];
  if (spec && spec.vertIdx < sampledLists.length && spec.horizIdx < sampledLists.length) {
    const vList = sampledLists[spec.vertIdx];
    const hList = sampledLists[spec.horizIdx];
    const { ia, ib } = closestJoinIndices(vList, hList);
    const vertex = {
      x: (vList[ia].x + hList[ib].x) * 0.5,
      y: (vList[ia].y + hList[ib].y) * 0.5,
    };
    const armUp = trimRayPoints(vList, ia, -1, spec.armLen);
    const armRight = trimRayPoints(hList, ib, 1, spec.armLen);
    if (armUp.length >= 2 && armRight.length >= 2) {
      return {
        targetMode: 'point_corner',
        vertex,
        cornerArms: [toMorphStroke([...armUp].reverse()), toMorphStroke(armRight)],
        brushStyle: 'x_square_dun',
        shapeType: 'right_angle',
        shapeSymbol: '└',
        shapeLabel: '竖折方顿 └',
      };
    }
  }

  const fallback = allStrokes.slice(0, 1);
  return {
    targetMode: 'point_corner',
    vertex: centroidOfStrokes(fallback),
    cornerArms: fallback,
    brushStyle: 'x_square_dun',
    shapeType: 'right_angle',
    shapeSymbol: '└',
    shapeLabel: '竖折方顿 └',
  };
}

// 4d. B Key: Sheltered Negative-Space Chamber + F→B (↘) Diagonal Light Press (⬚ 黑挤白显)
function detectBNegativeWindow(node: RadicalMorphNode): FocusSpecResult {
  const B_WINDOWS: Record<string, { x: number; y: number; w: number; h: number }> = {
    'b-mi': { x: 0.22, y: 0.37, w: 0.52, h: 0.26 },
    'b-men': { x: 0.30, y: 0.29, w: 0.41, h: 0.51 },
    'b-li': { x: 0.28, y: 0.37, w: 0.44, h: 0.37 },
    'b-chong': { x: 0.29, y: 0.39, w: 0.40, h: 0.16 },
    'b-yi': { x: 0.34, y: 0.21, w: 0.32, h: 0.23 },
    'b-ji': { x: 0.24, y: 0.27, w: 0.49, h: 0.46 },
    'b-yu': { x: 0.28, y: 0.29, w: 0.42, h: 0.32 },
    'b-xin': { x: 0.28, y: 0.27, w: 0.44, h: 0.17 },
    'b-chen': { x: 0.27, y: 0.45, w: 0.45, h: 0.15 },
    'b-lizi': { x: 0.28, y: 0.26, w: 0.42, h: 0.22 },
  };
  const box = B_WINDOWS[node.id] ?? { x: 0.28, y: 0.32, w: 0.44, h: 0.34 };
  return {
    targetMode: 'shape_target',
    vertex: { x: box.x + box.w * 0.5, y: box.y + box.h * 0.5 },
    cornerArms: [],
    negativeBox: box,
    brushStyle: 'b_diagonal_light',
    shapeType: 'top_canopy',
    shapeSymbol: '⬚',
    shapeLabel: '黑挤白显 ⬚',
  };
}

// 4e. V Key: F→V (↓) Xuanzhen Plunging Needle + Flanking Brush-Flick Flecks (·↓· 悬针分流)
function detectVSplitBeads(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[]
): FocusSpecResult {
  const trimHook = (st: MorphBrushStroke, takeCount = 3): MorphBrushStroke =>
    st.points.length > takeCount
      ? {
          dunbiStart: true,
          flickEnd: true,
          points: st.points.slice(0, takeCount).map((p) => ({ ...p, p: Math.max(0.76, p.p) })),
        }
      : { ...st, dunbiStart: true, flickEnd: true };

  if (node.id === 'v-shui' && allStrokes.length >= 1) {
    const spine = trimHook(allStrokes[0], 3);
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.52 },
      cornerArms: [spine],
      accentBeads: [
        { x: 0.26, y: 0.56 },
        { x: 0.74, y: 0.56 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-shuixia' && allStrokes.length >= 1) {
    const spine = trimHook(allStrokes[0], 3);
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.52 },
      cornerArms: [spine],
      accentBeads: [
        { x: 0.29, y: 0.40 },
        { x: 0.71, y: 0.41 },
        { x: 0.29, y: 0.66 },
        { x: 0.72, y: 0.68 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-mi' && allStrokes.length >= 1) {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.5 },
      cornerArms: [{ ...allStrokes[0], dunbiStart: true, flickEnd: true }],
      accentBeads: [
        { x: 0.30, y: 0.31 },
        { x: 0.70, y: 0.30 },
        { x: 0.28, y: 0.72 },
        { x: 0.72, y: 0.73 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-jin' && allStrokes.length >= 1) {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.52 },
      cornerArms: [{ ...allStrokes[0], dunbiStart: true, flickEnd: true }],
      accentBeads: [
        { x: 0.22, y: 0.54 },
        { x: 0.77, y: 0.54 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-fu' && allStrokes.length >= 2) {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.57 },
      cornerArms: [{ ...allStrokes[1], dunbiStart: true, flickEnd: true }],
      accentBeads: [
        { x: 0.35, y: 0.57 },
        { x: 0.65, y: 0.57 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-gui' && allStrokes.length >= 6) {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.44 },
      cornerArms: [{ ...allStrokes[5], dunbiStart: true, flickEnd: true }],
      virtualLinks: [{ from: { x: 0.5, y: 0.55 }, to: { x: 0.5, y: 0.76 } }],
      accentBeads: [
        { x: 0.35, y: 0.41 },
        { x: 0.65, y: 0.41 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-yi') {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.56 },
      cornerArms: [],
      virtualLinks: [{ from: { x: 0.5, y: 0.26 }, to: { x: 0.5, y: 0.86 } }],
      accentBeads: [
        { x: 0.23, y: 0.64 },
        { x: 0.79, y: 0.65 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-qie') {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.5, y: 0.5 },
      cornerArms: [],
      virtualLinks: [{ from: { x: 0.5, y: 0.18 }, to: { x: 0.5, y: 0.84 } }],
      accentBeads: [
        { x: 0.30, y: 0.50 },
        { x: 0.69, y: 0.50 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-lidao' && allStrokes.length >= 1) {
    const spine = trimHook(allStrokes[0], 3);
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.54, y: 0.5 },
      cornerArms: [spine],
      accentBeads: [
        { x: 0.38, y: 0.36 },
        { x: 0.38, y: 0.60 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  if (node.id === 'v-dao' && allStrokes.length >= 2) {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.45, y: 0.54 },
      cornerArms: [{ ...allStrokes[1], dunbiStart: true, flickEnd: true }],
      accentBeads: [
        { x: 0.24, y: 0.44 },
        { x: 0.72, y: 0.54 },
      ],
      brushStyle: 'v_xuanzhen',
      shapeType: 'split_stream',
      shapeSymbol: '·↓·',
      shapeLabel: '悬针分流 ·↓·',
    };
  }
  // v-sandian 氵 -> 3 luminous cascading water flecks along a plunging downward needle
  return {
    targetMode: 'shape_target',
    vertex: { x: 0.41, y: 0.48 },
    cornerArms: [],
    virtualLinks: [{ from: { x: 0.41, y: 0.20 }, to: { x: 0.41, y: 0.78 } }],
    accentBeads: [
      { x: 0.43, y: 0.23 },
      { x: 0.36, y: 0.46 },
      { x: 0.44, y: 0.70 },
    ],
    brushStyle: 'v_xuanzhen',
    shapeType: 'split_stream',
    shapeSymbol: '⋮',
    shapeLabel: '三滴垂针 ⋮',
  };
}

// 4f. C Key: D→C (↓↷) Round-Turn Upward Cradle (⊔ 圆转兜底 — round-bellied floor vs D's square hood 冂!)
function detectCUpwardCradle(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const filterToStroke = (pts: Pt2[], pred: (pt: Pt2) => boolean, fallback: MorphBrushStroke): MorphBrushStroke => {
    const f = pts.filter(pred);
    return f.length >= 2 ? toMorphStroke(f) : fallback;
  };

  let arms: MorphBrushStroke[] = [];
  let virtualLinks: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> | undefined;

  if (node.id === 'c-ji' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
  } else if (node.id === 'c-sizi' && sampledLists.length >= 2) {
    arms = [filterToStroke(sampledLists[1], (pt) => pt.y >= 0.36, allStrokes[1])];
  } else if (node.id === 'c-yi' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
  } else if (node.id === 'c-jie2' && sampledLists.length >= 2) {
    arms = [filterToStroke(sampledLists[1], (pt) => pt.y >= 0.34, allStrokes[1])];
  } else if (node.id === 'c-lu' && allStrokes.length >= 11) {
    arms = [allStrokes[10]];
  } else if (node.id === 'c-gao' && sampledLists.length >= 7) {
    const rightWall = filterToStroke(sampledLists[5], (pt) => pt.x >= 0.62, allStrokes[5]);
    arms = [allStrokes[4], allStrokes[6], rightWall];
  } else if (node.id === 'c-jin' && sampledLists.length >= 8) {
    const base = filterToStroke(sampledLists[7], (pt) => pt.x >= 0.24 && pt.x <= 0.76, allStrokes[7]);
    arms = [allStrokes[0], base, allStrokes[1]];
  } else if (node.id === 'c-ba' && allStrokes.length >= 2) {
    arms = [allStrokes[0], allStrokes[1]];
    virtualLinks = [{ from: { x: 0.40, y: 0.62 }, to: { x: 0.55, y: 0.64 } }];
  } else if (node.id === 'c-bei' && sampledLists.length >= 2) {
    const leftW = filterToStroke(sampledLists[0], (pt) => pt.y >= 0.30, allStrokes[0]);
    const rightW = filterToStroke(sampledLists[1], (pt) => pt.x >= 0.67 && pt.y >= 0.30, allStrokes[1]);
    arms = [leftW, rightW];
    virtualLinks = [{ from: { x: 0.30, y: 0.62 }, to: { x: 0.70, y: 0.61 } }];
  } else if (node.id === 'c-ye' && sampledLists.length >= 2) {
    const rightW = filterToStroke(sampledLists[1], (pt) => pt.x >= 0.68, allStrokes[1]);
    arms = [allStrokes[0], rightW];
    virtualLinks = [{ from: { x: 0.28, y: 0.68 }, to: { x: 0.70, y: 0.68 } }];
  } else if (node.id === 'c-ma' && sampledLists.length >= 9) {
    const leftT = filterToStroke(sampledLists[4], (pt) => pt.y >= 0.44, allStrokes[4]);
    const rightT = filterToStroke(sampledLists[8], (pt) => pt.y >= 0.44, allStrokes[8]);
    arms = [leftT, rightT];
    virtualLinks = [{ from: { x: 0.41, y: 0.86 }, to: { x: 0.70, y: 0.86 } }];
  } else if (node.id === 'c-qi' && sampledLists.length >= 3) {
    const leftL = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.36, allStrokes[1]);
    const rightL = filterToStroke(sampledLists[2], (pt) => pt.y >= 0.36, allStrokes[2]);
    arms = [leftL, rightL];
    virtualLinks = [{ from: { x: 0.24, y: 0.84 }, to: { x: 0.64, y: 0.86 } }];
  } else if (node.id === 'c-si' && allStrokes.length >= 3) {
    arms = [allStrokes[2]];
    virtualLinks = [
      { from: { x: 0.34, y: 0.62 }, to: { x: 0.28, y: 0.82 } },
      { from: { x: 0.64, y: 0.58 }, to: { x: 0.72, y: 0.69 } },
    ];
  } else {
    arms = node.coreStrokes.length ? node.coreStrokes : allStrokes.slice(0, 1);
  }

  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(arms),
    cornerArms: arms,
    virtualLinks,
    brushStyle: 'c_round_cradle',
    shapeType: 'fold_hook',
    shapeSymbol: '⊔',
    shapeLabel: '圆转兜底 ⊔',
  };
}

// 4g. G Key: Right-Wall Rebound Frame (コ 右壁回弹框 — open LEFT, solid RIGHT wall bouncing index back to F!)
function detectGRightRebound(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const filterToStroke = (pts: Pt2[], pred: (pt: Pt2) => boolean, fallback: MorphBrushStroke): MorphBrushStroke => {
    const f = pts.filter(pred);
    return f.length >= 2 ? toMorphStroke(f) : fallback;
  };

  let arms: MorphBrushStroke[] = [];
  let virtualLinks: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> | undefined;

  if (node.id === 'g-gong' && allStrokes.length >= 1) {
    arms = [allStrokes[0]];
  } else if (node.id === 'g-gen' && allStrokes.length >= 2) {
    arms = [allStrokes[0], allStrokes[1]];
  } else if (node.id === 'g-tian' && sampledLists.length >= 2) {
    const bot = filterToStroke(sampledLists[0], (pt) => pt.y >= 0.76, allStrokes[0]);
    arms = [allStrokes[1], bot];
  } else if (node.id === 'g-you' && allStrokes.length >= 5) {
    arms = [allStrokes[1], allStrokes[4]];
  } else if (node.id === 'g-dian' && allStrokes.length >= 4) {
    arms = [allStrokes[1], allStrokes[3]];
  } else if (node.id === 'g-shen' && allStrokes.length >= 4) {
    arms = [allStrokes[1], allStrokes[3]];
  } else if (node.id === 'g-yu' && allStrokes.length >= 7) {
    arms = [allStrokes[1], allStrokes[6]];
  } else if (node.id === 'g-gongzi' && sampledLists.length >= 3) {
    const topL = filterToStroke(sampledLists[0], (pt) => pt.x <= 0.51, allStrokes[0]);
    const botL = filterToStroke(sampledLists[2], (pt) => pt.x <= 0.51, allStrokes[2]);
    arms = [topL, allStrokes[1], botL];
  } else if (node.id === 'g-feng' && sampledLists.length >= 4) {
    const topL = filterToStroke(sampledLists[0], (pt) => pt.x <= 0.51, allStrokes[0]);
    const midV = filterToStroke(sampledLists[3], (pt) => pt.y >= 0.25 && pt.y <= 0.67, allStrokes[3]);
    const botL = filterToStroke(sampledLists[2], (pt) => pt.x <= 0.51, allStrokes[2]);
    arms = [topL, midV, botL];
  } else if (node.id === 'g-erdao' && allStrokes.length >= 1) {
    const upperLoop: MorphBrushStroke = {
      dunbiStart: false,
      flickEnd: false,
      points: allStrokes[0].points.slice(0, 3).map((p) => ({ ...p, p: Math.max(0.76, p.p) })),
    };
    arms = [upperLoop];
    virtualLinks = [{ from: { x: 0.38, y: 0.44 }, to: { x: 0.52, y: 0.44 } }];
  } else if (node.id === 'g-qi' && sampledLists.length >= 4) {
    const topBar = filterToStroke(sampledLists[3], (pt) => pt.x <= 0.74, allStrokes[3]);
    arms = [topBar, allStrokes[0]];
    virtualLinks = [{ from: { x: 0.73, y: 0.25 }, to: { x: 0.72, y: 0.41 } }];
  } else if (node.id === 'g-si' && sampledLists.length >= 2) {
    const botBar = filterToStroke(sampledLists[0], (pt) => pt.y >= 0.65, allStrokes[0]);
    const rightWall = filterToStroke(sampledLists[1], (pt) => pt.y <= 0.68, allStrokes[1]);
    arms = [rightWall, botBar];
    virtualLinks = [{ from: { x: 0.36, y: 0.50 }, to: { x: 0.65, y: 0.50 } }];
  } else if (node.id === 'g-yao' && sampledLists.length >= 2) {
    const topBar = filterToStroke(sampledLists[0], (pt) => pt.y >= 0.40, allStrokes[0]);
    const botBar = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.71, allStrokes[1]);
    arms = [topBar, botBar];
    virtualLinks = [{ from: { x: 0.60, y: 0.42 }, to: { x: 0.74, y: 0.72 } }];
  } else {
    arms = node.coreStrokes.length ? node.coreStrokes : allStrokes.slice(0, 1);
  }

  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(arms),
    cornerArms: arms,
    virtualLinks,
    shapeType: 'loop_turn',
    shapeSymbol: 'コ',
    shapeLabel: '右壁回弹框 コ',
  };
}

// 4h. J Key: Left-Pointing Rotated-T (┫ 左向丁字 — exact mirror of L ┣ across home-row center K │!)
function detectJLeftT(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const filterToStroke = (pts: Pt2[], pred: (pt: Pt2) => boolean, fallback: MorphBrushStroke): MorphBrushStroke => {
    const f = pts.filter(pred);
    return f.length >= 2 ? toMorphStroke(f) : fallback;
  };

  let arms: MorphBrushStroke[] = [];
  let virtualLinks: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> | undefined;

  if (node.id === 'j-cun' && sampledLists.length >= 3) {
    const spine = filterToStroke(sampledLists[1], (pt) => pt.y <= 0.72, allStrokes[1]);
    const leftBar = filterToStroke(sampledLists[2], (pt) => pt.x >= 0.32 && pt.x <= 0.66, allStrokes[2]);
    arms = [spine, leftBar];
  } else if (node.id === 'j-sheng' && sampledLists.length >= 4) {
    const spine = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.36 && pt.y <= 0.78, allStrokes[1]);
    const leftBar = filterToStroke(sampledLists[3], (pt) => pt.x <= 0.52, allStrokes[3]);
    arms = [spine, leftBar];
  } else if (node.id === 'j-jiu' && sampledLists.length >= 2) {
    const spine = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.32 && pt.y <= 0.74, allStrokes[1]);
    const leftSpur = filterToStroke(sampledLists[0], (pt) => pt.x >= 0.32 && pt.y >= 0.51, allStrokes[0]);
    arms = [spine, leftSpur];
  } else if (node.id === 'j-che' && sampledLists.length >= 2) {
    const spine = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.42 && pt.y <= 0.86, allStrokes[1]);
    const leftBar = filterToStroke(sampledLists[0], (pt) => pt.y >= 0.62 && pt.x <= 0.50, allStrokes[0]);
    arms = [spine, leftBar];
  } else if (node.id === 'j-guan' && sampledLists.length >= 3) {
    const spine = filterToStroke(sampledLists[2], (pt) => pt.y >= 0.34 && pt.y <= 0.76, allStrokes[2]);
    const leftBar = filterToStroke(sampledLists[0], (pt) => pt.y >= 0.54 && pt.x <= 0.42, allStrokes[0]);
    arms = [spine, leftBar];
  } else if (node.id === 'j-ren' && sampledLists.length >= 2) {
    const spine = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.43 && pt.y <= 0.84, allStrokes[1]);
    const leftSpur = filterToStroke(sampledLists[0], (pt) => pt.x <= 0.49, allStrokes[0]);
    arms = [spine, leftSpur];
  } else if (node.id === 'j-ru' && sampledLists.length >= 2) {
    const { ia, ib } = closestJoinIndices(sampledLists[1], sampledLists[0]);
    const up = trimRayPoints(sampledLists[1], ia, -1, 0.22);
    const dn = trimRayPoints(sampledLists[1], ia, 1, 0.24);
    const spine = toMorphStroke([...[...up].reverse(), ...dn.slice(1)]);
    const spur = toMorphStroke(trimRayPoints(sampledLists[0], ib, 1, 0.24));
    arms = [spine, spur];
  } else if (['j-zhi', 'j-sui', 'j-fanwen'].includes(node.id) && sampledLists.length >= 3) {
    const naIdx = node.id === 'j-fanwen' ? 3 : 2;
    const pieIdx = 1;
    const { ia, ib } = closestJoinIndices(sampledLists[naIdx], sampledLists[pieIdx]);
    const up = trimRayPoints(sampledLists[naIdx], ia, -1, 0.20);
    const dn = trimRayPoints(sampledLists[naIdx], ia, 1, 0.22);
    const spine = toMorphStroke([...[...up].reverse(), ...dn.slice(1)]);
    const spur = toMorphStroke(trimRayPoints(sampledLists[pieIdx], ib, 1, 0.24));
    arms = [spine, spur];
  } else if (node.id === 'j-jie' && sampledLists.length >= 1) {
    const spine = filterToStroke(sampledLists[0], (pt) => pt.x >= 0.70 && pt.y <= 0.62, allStrokes[0]);
    arms = [spine];
    virtualLinks = [{ from: { x: 0.44, y: 0.41 }, to: { x: 0.73, y: 0.41 } }];
  } else if (node.id === 'j-kan' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
    virtualLinks = [{ from: { x: 0.46, y: 0.53 }, to: { x: 0.76, y: 0.53 } }];
  } else if (node.id === 'j-xiang' && sampledLists.length >= 3) {
    const spine = filterToStroke(sampledLists[2], (pt) => pt.x >= 0.77 && pt.y >= 0.34 && pt.y <= 0.80, allStrokes[2]);
    arms = [spine];
    virtualLinks = [{ from: { x: 0.54, y: 0.58 }, to: { x: 0.79, y: 0.58 } }];
  } else if (node.id === 'j-shipang' && sampledLists.length >= 3) {
    const spine = filterToStroke(sampledLists[2], (pt) => pt.x <= 0.48 && pt.y >= 0.44 && pt.y <= 0.84, allStrokes[2]);
    arms = [spine];
    virtualLinks = [{ from: { x: 0.24, y: 0.64 }, to: { x: 0.46, y: 0.64 } }];
  } else if (node.id === 'j-tou' && sampledLists.length >= 2) {
    const leftBar = filterToStroke(sampledLists[1], (pt) => pt.x >= 0.20 && pt.x <= 0.52, allStrokes[1]);
    arms = [leftBar];
    virtualLinks = [{ from: { x: 0.52, y: 0.30 }, to: { x: 0.52, y: 0.76 } }];
  } else if (node.id === 'j-san' && allStrokes.length >= 3) {
    arms = [allStrokes[2]];
    virtualLinks = [{ from: { x: 0.74, y: 0.26 }, to: { x: 0.74, y: 0.75 } }];
  } else {
    arms = node.coreStrokes.length ? node.coreStrokes : allStrokes.slice(0, 1);
  }

  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(arms),
    cornerArms: arms,
    virtualLinks,
    shapeType: 'slant_blade',
    shapeSymbol: '┫',
    shapeLabel: '左向丁字 ┫',
  };
}

// 4i. M Key: J→M (↘) Weighted Calligraphic Na-Foot / XieGou (㇂ 一波三折·重顿捺脚)
function detectMSweepHook(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[]
): FocusSpecResult {
  if (node.id === 'm-shuxin' && allStrokes.length >= 1) {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.68, y: 0.44 },
      cornerArms: [allStrokes[0]],
      virtualLinks: [{ from: { x: 0.56, y: 0.33 }, to: { x: 0.86, y: 0.60 } }],
      brushStyle: 'm_heavy_na',
      shapeType: 'sweep_hook',
      shapeSymbol: '㇂',
      shapeLabel: '重顿捺锋 ㇂',
    };
  }
  if (node.id === 'm-zuoshou') {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.68, y: 0.28 },
      cornerArms: [],
      virtualLinks: [{ from: { x: 0.50, y: 0.16 }, to: { x: 0.85, y: 0.42 } }],
      brushStyle: 'm_heavy_na',
      shapeType: 'sweep_hook',
      shapeSymbol: '㇂',
      shapeLabel: '重顿捺锋 ㇂',
    };
  }
  if (node.id === 'm-shi') {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.52, y: 0.35 },
      cornerArms: [],
      virtualLinks: [{ from: { x: 0.28, y: 0.23 }, to: { x: 0.78, y: 0.47 } }],
      brushStyle: 'm_heavy_na',
      shapeType: 'sweep_hook',
      shapeSymbol: '㇂',
      shapeLabel: '重顿捺锋 ㇂',
    };
  }
  if (node.id === 'm-che') {
    return {
      targetMode: 'shape_target',
      vertex: { x: 0.54, y: 0.49 },
      cornerArms: [],
      virtualLinks: [{ from: { x: 0.24, y: 0.27 }, to: { x: 0.86, y: 0.72 } }],
      brushStyle: 'm_heavy_na',
      shapeType: 'sweep_hook',
      shapeSymbol: '㇂',
      shapeLabel: '重顿捺锋 ㇂',
    };
  }

  // 戈, 心, 七, 方, 戊, 爪, 弋, 瓜, 癶, 豸 -> stroke 0 IS the sweeping down-right hook/Na!
  const sweepStroke = allStrokes[0];
  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes([sweepStroke]),
    cornerArms: [{ ...sweepStroke, flickEnd: true }],
    brushStyle: 'm_heavy_na',
    shapeType: 'sweep_hook',
    shapeSymbol: '㇂',
    shapeLabel: '重顿捺锋 ㇂',
  };
}

// 4j. W Key: S→W (↑↖) Gossamer Silk-Thread Curve + Upward-Left Hook Flick (∿ 游丝挑钩)
function detectWSilkCurve(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const filterToStroke = (pts: Pt2[], pred: (pt: Pt2) => boolean, fallback: MorphBrushStroke): MorphBrushStroke => {
    const f = pts.filter(pred);
    return f.length >= 2 ? toMorphStroke(f) : fallback;
  };

  let arms: MorphBrushStroke[] = [];
  let virtualLinks: Array<{ from: { x: number; y: number }; to: { x: number; y: number } }> | undefined;
  let flickTip: { from: { x: number; y: number }; to: { x: number; y: number } } | undefined;

  if (['w-yi', 'w-chuo', 'w-nai', 'w-yanp', 'w-fanquan'].includes(node.id)) {
    arms = [{ ...allStrokes[0], flickEnd: true }];
  } else if (node.id === 'w-jue' && sampledLists.length >= 1) {
    arms = [{ ...filterToStroke(sampledLists[0], (pt) => pt.y >= 0.52, allStrokes[0]), flickEnd: true }];
  } else if (node.id === 'w-yin' && sampledLists.length >= 1) {
    arms = [{ ...filterToStroke(sampledLists[0], (pt) => pt.y >= 0.42, allStrokes[0]), flickEnd: true }];
  } else if (node.id === 'w-mao' && sampledLists.length >= 1) {
    arms = [{ ...filterToStroke(sampledLists[0], (pt) => pt.y >= 0.42, allStrokes[0]), flickEnd: true }];
  } else if (node.id === 'w-yu' && sampledLists.length >= 8) {
    const hookTail = filterToStroke(sampledLists[0], (pt) => pt.x >= 0.68 && pt.y >= 0.56, allStrokes[0]);
    arms = [allStrokes[7], { ...hookTail, flickEnd: true }];
  } else if (node.id === 'w-pian' && sampledLists.length >= 4) {
    const leftStep = filterToStroke(sampledLists[0], (pt) => pt.y >= 0.44 && pt.y <= 0.65, allStrokes[0]);
    arms = [leftStep, allStrokes[3]];
    flickTip = { from: { x: 0.69, y: 0.86 }, to: { x: 0.56, y: 0.74 } };
  } else if (node.id === 'w-pan' && sampledLists.length >= 3) {
    const midStep = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.45 && pt.y <= 0.65, allStrokes[1]);
    arms = [allStrokes[0], midStep, allStrokes[2]];
    flickTip = { from: { x: 0.34, y: 0.24 }, to: { x: 0.24, y: 0.14 } };
  } else if (node.id === 'w-ge' && sampledLists.length >= 5) {
    const topLeft = filterToStroke(sampledLists[2], (pt) => pt.y >= 0.22, allStrokes[2]);
    const rightTurn = filterToStroke(sampledLists[0], (pt) => pt.x >= 0.46, allStrokes[0]);
    arms = [topLeft, allStrokes[4], rightTurn];
    flickTip = { from: { x: 0.74, y: 0.60 }, to: { x: 0.62, y: 0.49 } };
  } else if (node.id === 'w-he' && allStrokes.length >= 5) {
    arms = [allStrokes[0], { ...allStrokes[4], flickEnd: true }];
    virtualLinks = [{ from: { x: 0.26, y: 0.27 }, to: { x: 0.52, y: 0.47 } }];
    flickTip = { from: { x: 0.38, y: 0.24 }, to: { x: 0.22, y: 0.28 } };
  } else if (node.id === 'w-yao' && allStrokes.length >= 4) {
    arms = [allStrokes[0], { ...allStrokes[3], flickEnd: true }];
    virtualLinks = [{ from: { x: 0.26, y: 0.28 }, to: { x: 0.51, y: 0.49 } }];
    flickTip = { from: { x: 0.38, y: 0.25 }, to: { x: 0.22, y: 0.29 } };
  } else if (node.id === 'w-quan' && allStrokes.length >= 4) {
    arms = [allStrokes[3], { ...allStrokes[2], flickEnd: true }];
    virtualLinks = [
      { from: { x: 0.64, y: 0.20 }, to: { x: 0.28, y: 0.47 } },
      { from: { x: 0.28, y: 0.47 }, to: { x: 0.50, y: 0.48 } },
    ];
    flickTip = { from: { x: 0.74, y: 0.30 }, to: { x: 0.60, y: 0.16 } };
  } else {
    arms = [{ ...allStrokes[0], flickEnd: true }];
  }

  // Derive natural upward/up-left flick tip from the final hook segment if not explicitly overridden
  if (!flickTip && arms.length > 0) {
    const lastArm = arms[arms.length - 1];
    const pts = lastArm.points;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 0.01;
      const ext = 0.06;
      flickTip = {
        from: { x: a.x, y: a.y },
        to: { x: b.x + (dx / len) * ext, y: b.y + (dy / len) * ext },
      };
    }
  }

  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(arms),
    cornerArms: arms,
    virtualLinks,
    flickTip,
    brushStyle: 'w_silk_flick',
    shapeType: 'silk_curve',
    shapeSymbol: '∿',
    shapeLabel: '游丝挑钩 ∿',
  };
}

// 4k. P Key: ;→P (↑↖) Outer-Right Inward-Embracing Sweep (⟯ 右廓回抱 — bottom-right sweeping UP-LEFT over the crown!)
function detectPEmbraceArc(
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  const filterToStroke = (pts: Pt2[], pred: (pt: Pt2) => boolean, fallback: MorphBrushStroke): MorphBrushStroke => {
    const f = pts.filter(pred);
    return f.length >= 2 ? toMorphStroke(f) : fallback;
  };

  let arms: MorphBrushStroke[] = [];
  // Oriented from bottom-right (;) sweeping UP-LEFT (↑↖) to crown the top-right shoulder (P)!
  let embraceArc = {
    start: { x: 0.56, y: 0.88 },
    ctrl: { x: 0.94, y: 0.50 },
    end: { x: 0.46, y: 0.16 },
  };

  if (node.id === 'p-bao' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
    embraceArc = { start: { x: 0.54, y: 0.86 }, ctrl: { x: 0.92, y: 0.46 }, end: { x: 0.36, y: 0.18 } };
  } else if (node.id === 'p-ba' && sampledLists.length >= 2) {
    const botCurl = filterToStroke(sampledLists[1], (pt) => pt.y >= 0.70, allStrokes[1]);
    arms = [allStrokes[0], botCurl];
    embraceArc = { start: { x: 0.56, y: 0.88 }, ctrl: { x: 0.94, y: 0.50 }, end: { x: 0.40, y: 0.16 } };
  } else if (node.id === 'p-er' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
    embraceArc = { start: { x: 0.62, y: 0.88 }, ctrl: { x: 0.94, y: 0.52 }, end: { x: 0.48, y: 0.16 } };
  } else if (node.id === 'p-huo' && allStrokes.length >= 4) {
    arms = [allStrokes[1], allStrokes[3]];
    embraceArc = { start: { x: 0.66, y: 0.88 }, ctrl: { x: 0.94, y: 0.52 }, end: { x: 0.52, y: 0.18 } };
  } else if (node.id === 'p-sishui' && allStrokes.length >= 2) {
    arms = [allStrokes[0], allStrokes[1]];
    // Sweep from far-right drop inward-up-left cradling the four drops
    embraceArc = { start: { x: 0.88, y: 0.68 }, ctrl: { x: 0.52, y: 0.88 }, end: { x: 0.14, y: 0.64 } };
  } else if (node.id === 'p-shi' && sampledLists.length >= 4) {
    const topRight = filterToStroke(sampledLists[0], (pt) => pt.x >= 0.46, allStrokes[0]);
    const boxRight = filterToStroke(sampledLists[3], (pt) => pt.x >= 0.52, allStrokes[3]);
    arms = [topRight, boxRight];
    embraceArc = { start: { x: 0.60, y: 0.86 }, ctrl: { x: 0.94, y: 0.48 }, end: { x: 0.46, y: 0.16 } };
  } else if (node.id === 'p-chuan' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
    embraceArc = { start: { x: 0.60, y: 0.88 }, ctrl: { x: 0.94, y: 0.48 }, end: { x: 0.48, y: 0.14 } };
  } else if (node.id === 'p-chuan3' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
    embraceArc = { start: { x: 0.62, y: 0.86 }, ctrl: { x: 0.94, y: 0.48 }, end: { x: 0.50, y: 0.15 } };
  } else if (node.id === 'p-jiu' && allStrokes.length >= 2) {
    arms = [allStrokes[1]];
    embraceArc = { start: { x: 0.60, y: 0.88 }, ctrl: { x: 0.94, y: 0.50 }, end: { x: 0.46, y: 0.16 } };
  } else {
    arms = node.coreStrokes.length ? node.coreStrokes : allStrokes.slice(0, 1);
  }

  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(arms),
    cornerArms: arms,
    embraceArc,
    brushStyle: 'p_inward_embrace',
    shapeType: 'wrap_arc',
    shapeSymbol: '⟯',
    shapeLabel: '右廓回抱 ⟯',
  };
}

// 5. Key-by-Key Gesture Focus Dispatcher for ALL 20 KEYS
function detectKeyGestureFocus(
  key: string,
  node: RadicalMorphNode,
  allStrokes: MorphBrushStroke[],
  sampledLists: Pt2[][]
): FocusSpecResult {
  // H: Right-angle ┌ or tilted wing < (user-specified & hand-tuned)
  if (key === 'h') {
    return detectHCorners(node, allStrokes, sampledLists);
  }

  // Y: Right-Hand Mirror Muscle-Memory Resistance (抗阻斜推 ⊢ — J→Y ↖ finger push from bottom-right)
  // Exact mirror of T: bottom-right blue starting segment on 大/夫/糸/瓦, virtual cool green-blue ↖ arrow on 王/非,
  // and 100% of remaining strokes (zero unlit gaps!) glowing vermilion red as the upper-left resistance barrier.
  if (key === 'y') {
    const sliceFrac = (pts: Pt2[], f0: number, f1: number): MorphBrushStroke => {
      if (pts.length < 3) return toMorphStroke(pts, 0.84);
      const i0 = Math.max(0, Math.floor(pts.length * f0));
      const i1 = Math.min(pts.length, Math.max(i0 + 2, Math.ceil(pts.length * f1)));
      return toMorphStroke(pts.slice(i0, i1), 0.86);
    };

    if (node.id === 'y-da' && allStrokes.length >= 3) {
      // 大: Lower-right tail of 捺 is cool blue pushing ↖; upper half of 捺 + 撇 + 横 glow solid red!
      const naSamples = sampledLists[1] ?? sampleStrokeDense(allStrokes[1].points, 0.02);
      const naTopRed = sliceFrac(naSamples, 0, 0.5);
      const naBottomBlue = sliceFrac(naSamples, 0.46, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.52, y: 0.52 },
        cornerArms: [allStrokes[0], naTopRed, allStrokes[2]],
        shapeType: 'slant_blade',
        shapeSymbol: '⊢',
        shapeLabel: '抗阻斜推 ⊢',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.84, y: 0.84 },
          thrustTo: { x: 0.54, y: 0.54 },
          deflectTo: { x: 0.68, y: 0.68 },
          shieldNormal: { x: 0.71, y: 0.71 },
          strength: 1.25,
          hasOwnStroke: true,
          referenceStrokes: [naBottomBlue],
        },
      };
    }

    if (node.id === 'y-fu' && allStrokes.length >= 4) {
      // 夫: Lower-right tail of 捺 is cool blue pushing ↖; upper 捺 + 撇 + 双横 glow solid red!
      const naSamples = sampledLists[1] ?? sampleStrokeDense(allStrokes[1].points, 0.02);
      const naTopRed = sliceFrac(naSamples, 0, 0.5);
      const naBottomBlue = sliceFrac(naSamples, 0.46, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.52, y: 0.53 },
        cornerArms: [allStrokes[0], naTopRed, allStrokes[2], allStrokes[3]],
        shapeType: 'slant_blade',
        shapeSymbol: '⊢',
        shapeLabel: '双横抗阻 ⊢',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.84, y: 0.85 },
          thrustTo: { x: 0.54, y: 0.55 },
          deflectTo: { x: 0.68, y: 0.69 },
          shieldNormal: { x: 0.71, y: 0.71 },
          strength: 1.3,
          hasOwnStroke: true,
          referenceStrokes: [naBottomBlue],
        },
      };
    }

    if (node.id === 'y-mi' && allStrokes.length >= 6) {
      // 糸: Bottom-right dot (右下点) is cool blue pushing ↖; upper coiled 绞丝 + 中竖钩 + 左点 glow solid red!
      const rightDotSamples =
        sampledLists[1] ?? sampleStrokeDense(allStrokes[1].points, 0.02);
      const dotTopRed = sliceFrac(rightDotSamples, 0, 0.36);
      const dotBottomBlue = sliceFrac(rightDotSamples, 0.32, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.53, y: 0.55 },
        cornerArms: [
          allStrokes[0],
          dotTopRed,
          allStrokes[2],
          allStrokes[3],
          allStrokes[4],
          allStrokes[5],
        ],
        shapeType: 'slant_blade',
        shapeSymbol: '⊢',
        shapeLabel: '绞结抗阻 ⊢',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.82, y: 0.84 },
          thrustTo: { x: 0.55, y: 0.57 },
          deflectTo: { x: 0.68, y: 0.7 },
          shieldNormal: { x: 0.71, y: 0.71 },
          strength: 1.25,
          hasOwnStroke: true,
          referenceStrokes: [dotBottomBlue],
        },
      };
    }

    if (node.id === 'y-wa' && allStrokes.length >= 4) {
      // 瓦: Bottom-right sweeping hook tail of 横折弯钩 is cool blue; upper arch + 竖提 + 顶横 + 腹点 glow solid red!
      const wanGouSamples =
        sampledLists[1] ?? sampleStrokeDense(allStrokes[1].points, 0.02);
      const wanGouWallRed = sliceFrac(wanGouSamples, 0, 0.66);
      const wanGouTailBlue = sliceFrac(wanGouSamples, 0.62, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.55, y: 0.54 },
        cornerArms: [allStrokes[0], wanGouWallRed, allStrokes[2], allStrokes[3]],
        shapeType: 'wrap_arc',
        shapeSymbol: '⊢',
        shapeLabel: '弯檐抗阻 ⊢',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.84, y: 0.82 },
          thrustTo: { x: 0.57, y: 0.55 },
          deflectTo: { x: 0.7, y: 0.68 },
          shieldNormal: { x: 0.71, y: 0.71 },
          strength: 1.32,
          hasOwnStroke: true,
          referenceStrokes: [wanGouTailBlue],
        },
      };
    }

    if (node.id === 'y-fei' && allStrokes.length >= 8) {
      // 非: Bottom-right horizontal wing tail (右下横外端) is cool blue starting edge; inner root + dual walls + other 5 wings glow solid red!
      const brWingSamples =
        sampledLists[7] ?? sampleStrokeDense(allStrokes[7].points, 0.02);
      const brWingRed = sliceFrac(brWingSamples, 0, 0.34);
      const brWingBlue = sliceFrac(brWingSamples, 0.28, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.56, y: 0.52 },
        cornerArms: [
          allStrokes[0],
          allStrokes[1],
          allStrokes[2],
          allStrokes[3],
          allStrokes[4],
          allStrokes[5],
          allStrokes[6],
          brWingRed,
        ],
        shapeType: 'slant_blade',
        shapeSymbol: '⊢',
        shapeLabel: '双壁羽栏 ⊢',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.84, y: 0.82 },
          thrustTo: { x: 0.58, y: 0.54 },
          deflectTo: { x: 0.71, y: 0.68 },
          shieldNormal: { x: 0.71, y: 0.71 },
          strength: 1.32,
          hasOwnStroke: false,
          referenceStrokes: [brWingBlue],
        },
      };
    }

    // 王 (and fallback): Bottom-right tail of 底横 is cool blue starting edge; left-center 底横 + 中竖 + 上中双横 glow solid red!
    if (allStrokes.length >= 4) {
      const bottomBarSamples =
        sampledLists[1] ?? sampleStrokeDense(allStrokes[1].points, 0.02);
      const bottomBarRed = sliceFrac(bottomBarSamples, 0, 0.72);
      const bottomBarBlue = sliceFrac(bottomBarSamples, 0.68, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.52, y: 0.5 },
        cornerArms: [allStrokes[0], bottomBarRed, allStrokes[2], allStrokes[3]],
        shapeType: 'slant_blade',
        shapeSymbol: '⊢',
        shapeLabel: '三横阻壁 ⊢',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.84, y: 0.8 },
          thrustTo: { x: 0.54, y: 0.5 },
          deflectTo: { x: 0.68, y: 0.65 },
          shieldNormal: { x: 0.71, y: 0.71 },
          strength: 1.25,
          hasOwnStroke: false,
          referenceStrokes: [bottomBarBlue],
        },
      };
    }

    return {
      targetMode: 'shape_target',
      vertex: { x: 0.52, y: 0.5 },
      cornerArms: allStrokes,
      shapeType: 'slant_blade',
      shapeSymbol: '⊢',
      shapeLabel: '三横阻壁 ⊢',
      brushStyle: 't_resistance_block',
      resistanceCue: {
        thrustFrom: { x: 0.84, y: 0.8 },
        thrustTo: { x: 0.54, y: 0.5 },
        deflectTo: { x: 0.68, y: 0.65 },
        shieldNormal: { x: 0.71, y: 0.71 },
        strength: 1.25,
        hasOwnStroke: false,
      },
    };
  }

  // X: Bottom-left L-pocket corner └ (completes ┌ ┐ └ triad)
  if (key === 'x') {
    return detectXBottomLeftCorner(node, allStrokes, sampledLists);
  }

  // S: Compact Inverted-T pedestal (一横 + 向上凸起 ┻)
  if (key === 's') {
    return detectSInvertedT(node, allStrokes, sampledLists);
  }

  // D: Unified Bottom-Open Frame (冂 — 同字外框，口不封底)
  if (key === 'd') {
    return detectDOpenFrame(node, allStrokes, sampledLists);
  }

  // C: Unified Upward-Open Cradle (⊔ — exact vertical mirror of D's 冂)
  if (key === 'c') {
    return detectCUpwardCradle(node, allStrokes, sampledLists);
  }

  // G: Right-Wall Rebound Frame (コ — left-open, solid right wall bouncing left index back to F)
  if (key === 'g') {
    return detectGRightRebound(node, allStrokes, sampledLists);
  }

  // K: Unified single vertical (竖 │) or vertical-pie (竖撇 丿)
  if (key === 'k') {
    return detectKVertOrPie(node, allStrokes);
  }

  // L: Right-pointing rotated-T (┣ — 丁字旋转朝右)
  if (key === 'l') {
    return detectLRightT(node, allStrokes, sampledLists);
  }

  // J: Left-pointing rotated-T (┫ — mirrors L ┣ across home-row center K │)
  if (key === 'j') {
    return detectJLeftT(node, allStrokes, sampledLists);
  }

  // F: Single Horizontal Datum Bar (━)
  if (key === 'f') {
    let bestH = node.coreStrokes[0] ?? allStrokes[0];
    const p0 = bestH.points[0];
    const pN = bestH.points[bestH.points.length - 1];
    const isCoreHorizontal =
      Math.abs(pN.y - p0.y) < 0.14 && Math.abs(pN.x - p0.x) > 0.22;
    if (!isCoreHorizontal) {
      let bestWidth = 0;
      allStrokes.forEach((st) => {
        const a = st.points[0];
        const b = st.points[st.points.length - 1];
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        if (dy < 0.12 && dx > bestWidth) {
          bestWidth = dx;
          bestH = st;
        }
      });
      // If no standalone horizontal stroke exists (e.g. 衤 has a 横撇), take only its horizontal prefix!
      if (bestWidth === 0 && sampledLists[0] && sampledLists[0].length >= 2) {
        const s0 = sampledLists[0];
        const horizPts: Pt2[] = [];
        for (let i = 0; i < s0.length; i++) {
          if (i > 0 && (s0[i].x < s0[i - 1].x - 0.002 || Math.abs(s0[i].y - s0[0].y) > 0.08)) {
            break;
          }
          horizPts.push(s0[i]);
        }
        if (horizPts.length >= 2) {
          bestH = toMorphStroke(horizPts);
        }
      }
    }
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes([bestH]),
      cornerArms: [bestH],
      shapeType: 'horizon_bar',
      shapeSymbol: '━',
      shapeLabel: '一横定界 ━',
    };
  }

  // B: Sheltered Negative-Space Chamber (⬚ 留白心窗)
  if (key === 'b') {
    return detectBNegativeWindow(node);
  }

  // V: Vertical Parting Axis + Flanking Contrast Beads (·│· 中轴分流珠)
  if (key === 'v') {
    return detectVSplitBeads(node, allStrokes);
  }

  // Q: Crossed Lattice (╪)
  if (key === 'q') {
    return detectCrossFocus('q', node, allStrokes, sampledLists);
  }

  // T: Pure Muscle-Memory Resistance (阻力受阻 ⊣ — full-body resistance wall + blue starting thrust entry)
  // Zero unlit gaps: ALL remaining strokes of the radical form the solid vermilion resistance wall!
  // Radicals with 撇/提 render ONLY their starting segment in cool blue ("hard to push forward");
  // radicals without 撇/提 (丶/乀) render 100% red with a virtual cool green-blue F→T (↗) finger vector.
  if (key === 't') {
    const clamp01 = (v: number) => Math.max(0.05, Math.min(0.95, v));
    const sliceFrac = (pts: Pt2[], f0: number, f1: number): MorphBrushStroke => {
      if (pts.length < 3) return toMorphStroke(pts, 0.82);
      const i0 = Math.max(0, Math.floor(pts.length * f0));
      const i1 = Math.min(pts.length, Math.max(i0 + 2, Math.ceil(pts.length * f1)));
      return toMorphStroke(pts.slice(i0, i1), 0.86);
    };

    if (node.id === 't-shou' && allStrokes.length >= 3) {
      // 扌: Starting half of 提 is cool blue ("pushing in, blocked"); rest of 提 + ALL 横 & 竖钩 glow solid red!
      const tiSamples = sampledLists[0] ?? sampleStrokeDense(allStrokes[0].points, 0.02);
      const tiStartBlue = sliceFrac(tiSamples, 0, 0.54);
      const tiRestRed = sliceFrac(tiSamples, 0.5, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.52, y: 0.5 },
        cornerArms: [tiRestRed, allStrokes[1], allStrokes[2]],
        shapeType: 'slant_blade',
        shapeSymbol: '⊣',
        shapeLabel: '竖壁挡路 ⊣',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.24, y: 0.74 },
          thrustTo: { x: 0.49, y: 0.5 },
          deflectTo: { x: 0.37, y: 0.62 },
          shieldNormal: { x: -0.78, y: 0.62 },
          strength: 1.2,
          hasOwnStroke: true,
          referenceStrokes: [tiStartBlue],
        },
      };
    }

    if (node.id === 't-bi' && allStrokes.length >= 2) {
      // 匕: Embed the compact blue entry segment at the bottom-left heel of 竖弯钩 (乚);
      // the entire upper-right 短撇 + top vertical + right bow wall glow solid red!
      const bowSamples = sampledLists[1] ?? sampleStrokeDense(allStrokes[1].points, 0.02);
      const topVertRed = sliceFrac(bowSamples, 0, 0.38);
      const heelStartBlue = sliceFrac(bowSamples, 0.34, 0.56);
      const rightHookRed = sliceFrac(bowSamples, 0.52, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.46, y: 0.56 },
        cornerArms: [allStrokes[0], topVertRed, rightHookRed],
        shapeType: 'wrap_arc',
        shapeSymbol: '⊣',
        shapeLabel: '强弓阻力壁 ⊣',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.22, y: 0.8 },
          thrustTo: { x: 0.44, y: 0.58 },
          deflectTo: { x: 0.33, y: 0.7 },
          shieldNormal: { x: -0.76, y: 0.65 },
          strength: 1.5,
          hasOwnStroke: true,
          referenceStrokes: [heelStartBlue],
        },
      };
    }

    if (node.id === 't-qian' && allStrokes.length >= 4) {
      // 欠: Embed the compact blue segment at the bottom-left tip of 下撇;
      // ALL upper-right strokes (上短撇, 横钩, 上半下撇, 右捺) glow solid red resistance walls!
      const lowPieSamples = sampledLists[2] ?? sampleStrokeDense(allStrokes[2].points, 0.02);
      const lowPieRestRed = sliceFrac(lowPieSamples, 0, 0.56);
      const lowPieBottomBlue = sliceFrac(lowPieSamples, 0.52, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.52, y: 0.5 },
        cornerArms: [allStrokes[0], allStrokes[1], lowPieRestRed, allStrokes[3]],
        shapeType: 'slant_blade',
        shapeSymbol: '⊣',
        shapeLabel: '斜堤钩壁 ⊣',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.22, y: 0.82 },
          thrustTo: { x: 0.48, y: 0.54 },
          deflectTo: { x: 0.35, y: 0.68 },
          shieldNormal: { x: -0.71, y: 0.71 },
          strength: 1.25,
          hasOwnStroke: true,
          referenceStrokes: [lowPieBottomBlue],
        },
      };
    }

    if (node.id === 't-yong' && allStrokes.length >= 5) {
      // 用: Embed the compact blue segment at the bottom-left tail of 左竖撇;
      // upper-left vertical + ENTIRE 横折钩, 双横 & 中竖 glow solid red resistance walls!
      const leftPieSamples = sampledLists[0] ?? sampleStrokeDense(allStrokes[0].points, 0.02);
      const leftPieTopRed = sliceFrac(leftPieSamples, 0, 0.58);
      const leftPieBottomBlue = sliceFrac(leftPieSamples, 0.54, 1);
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.48, y: 0.52 },
        cornerArms: [
          leftPieTopRed,
          allStrokes[1],
          allStrokes[2],
          allStrokes[3],
          allStrokes[4],
        ],
        shapeType: 'slant_blade',
        shapeSymbol: '⊣',
        shapeLabel: '横栏阻框 ⊣',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.18, y: 0.84 },
          thrustTo: { x: 0.45, y: 0.55 },
          deflectTo: { x: 0.32, y: 0.7 },
          shieldNormal: { x: -0.71, y: 0.71 },
          strength: 1.28,
          hasOwnStroke: true,
          referenceStrokes: [leftPieBottomBlue],
        },
      };
    }

    if (node.id === 't-na') {
      // 乀 (no 撇): 100% of the stroke glows solid red resistance wall + virtual cool blue-green F→T ↗ vector!
      const fullNa = toMorphStroke(
        sampledLists[0] ?? sampleStrokeDense(allStrokes[0].points, 0.02),
        0.88
      );
      return {
        targetMode: 'shape_target',
        vertex: { x: 0.49, y: 0.49 },
        cornerArms: [fullNa],
        shapeType: 'slant_blade',
        shapeSymbol: '⊣',
        shapeLabel: '斜堤挡路 ⊣',
        brushStyle: 't_resistance_block',
        resistanceCue: {
          thrustFrom: { x: 0.26, y: 0.72 },
          thrustTo: { x: 0.47, y: 0.51 },
          deflectTo: { x: 0.37, y: 0.63 },
          shieldNormal: { x: -0.71, y: 0.71 },
          strength: 1.15,
          hasOwnStroke: false,
        },
      };
    }

    // 丶 (no 撇): 100% of the stroke glows solid red resistance wall + virtual cool blue-green F→T ↗ vector!
    const dense =
      sampledLists[0] ?? sampleStrokeDense((node.coreStrokes[0] ?? allStrokes[0]).points, 0.02);
    const fullDian = toMorphStroke(dense, 0.88);
    const midPt = dense[Math.floor(dense.length * 0.46)] ?? { x: 0.47, y: 0.43 };
    return {
      targetMode: 'shape_target',
      vertex: { x: clamp01(midPt.x), y: clamp01(midPt.y) },
      cornerArms: [fullDian],
      shapeType: 'slant_blade',
      shapeSymbol: '⊣',
      shapeLabel: '横斜阻壁 ⊣',
      brushStyle: 't_resistance_block',
      resistanceCue: {
        thrustFrom: { x: clamp01(midPt.x - 0.22), y: clamp01(midPt.y + 0.22) },
        thrustTo: { x: clamp01(midPt.x - 0.02), y: clamp01(midPt.y + 0.02) },
        deflectTo: { x: clamp01(midPt.x - 0.12), y: clamp01(midPt.y + 0.14) },
        shieldNormal: { x: -0.71, y: 0.71 },
        strength: 1.05,
        hasOwnStroke: false,
      },
    };
  }

  // M: Bold Down-Right Sweeping Hook / Na (㇂ / ㇏ ↘)
  if (key === 'm') {
    return detectMSweepHook(node, allStrokes);
  }

  // W: Isolated Curved Inflection / S-Wave / Hook Turn (∿ 游丝弯弧)
  if (key === 'w') {
    return detectWSilkCurve(node, allStrokes, sampledLists);
  }

  // P: Outer Right Crescent Embrace (⟯ 右廓外括弧)
  if (key === 'p') {
    return detectPEmbraceArc(node, allStrokes, sampledLists);
  }

  // R-key specials:
  // 1) 业: bottom horizontal bar + virtual horizontal line across the two vertical start points -> 二
  if (key === 'r' && node.id === 'r-ye' && allStrokes.length >= 5) {
    const leftVertStart = allStrokes[0].points[0];
    const rightVertStart = allStrokes[1].points[0];
    const bottomBar = allStrokes[4];
    const bottomCenter = centroidOfStrokes([bottomBar]);
    return {
      targetMode: 'shape_target',
      vertex: {
        x: ((leftVertStart.x + rightVertStart.x) * 0.5 + bottomCenter.x) * 0.5,
        y: ((leftVertStart.y + rightVertStart.y) * 0.5 + bottomCenter.y) * 0.5,
      },
      cornerArms: [bottomBar],
      virtualLinks: [
        {
          from: { x: leftVertStart.x, y: leftVertStart.y },
          to: { x: rightVertStart.x, y: rightVertStart.y },
        },
      ],
      shapeType: 'twin_bars',
      shapeSymbol: '=',
      shapeLabel: '虚横成二 =',
    };
  }

  // 2) 见: top middle horizontal bar (of 横折) + bottom-right horizontal base (of 竖弯钩) -> 二
  if (key === 'r' && node.id === 'r-jian' && allStrokes.length >= 4) {
    const topPts = sampledLists[1].filter((pt) => pt.y <= 0.21);
    const botPts = sampledLists[3].filter((pt) => pt.y >= 0.805 && pt.x <= 0.875);
    const topBar: MorphBrushStroke =
      topPts.length >= 2
        ? toMorphStroke(topPts)
        : {
            dunbiStart: false,
            flickEnd: false,
            points: allStrokes[1].points.slice(0, 3).map((p) => ({ ...p, p: Math.max(0.76, p.p) })),
          };
    const botBar: MorphBrushStroke =
      botPts.length >= 2
        ? toMorphStroke(botPts)
        : {
            dunbiStart: false,
            flickEnd: false,
            points: allStrokes[3].points.slice(2, 4).map((p) => ({ ...p, p: Math.max(0.76, p.p) })),
          };
    const arms = [topBar, botBar];
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes(arms),
      cornerArms: arms,
      shapeType: 'twin_bars',
      shapeSymbol: '=',
      shapeLabel: '上下双横成二 =',
    };
  }

  // 3) 之: upper horizontal segment (of 横撇) + bottom flat sweeping bar (平捺) -> 二
  if (key === 'r' && node.id === 'r-zhi' && allStrokes.length >= 2) {
    const s0 = sampledLists[0];
    const topPts: Pt2[] = [];
    for (let i = 0; i < s0.length; i++) {
      if (i > 0 && s0[i].x < s0[i - 1].x - 0.002) break;
      topPts.push(s0[i]);
    }
    const topBar: MorphBrushStroke =
      topPts.length >= 2
        ? toMorphStroke(topPts)
        : {
            dunbiStart: false,
            flickEnd: false,
            points: allStrokes[0].points.slice(0, 2).map((p) => ({ ...p, p: Math.max(0.76, p.p) })),
          };
    const botBar = allStrokes[1];
    const arms = [topBar, botBar];
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes(arms),
      cornerArms: arms,
      shapeType: 'twin_bars',
      shapeSymbol: '=',
      shapeLabel: '上下双横成二 =',
    };
  }

  // 4) 卜: no explicit horizontal 二; take only a compact twin middle slice around the center waist (y ≈ 0.44..0.55)
  if (key === 'r' && node.id === 'r-bu' && allStrokes.length >= 2) {
    const stemMidPts = sampledLists[0].filter((pt) => pt.y >= 0.44 && pt.y <= 0.555);
    const dotMidPts = sampledLists[1].filter(
      (pt) => pt.y >= 0.45 && pt.y <= 0.545 && pt.x >= 0.495 && pt.x <= 0.645
    );
    const stemStub: MorphBrushStroke =
      stemMidPts.length >= 2
        ? toMorphStroke(stemMidPts)
        : {
            dunbiStart: false,
            flickEnd: false,
            points: [
              { x: 0.44, y: 0.445, p: 0.78 },
              { x: 0.44, y: 0.5, p: 0.76 },
              { x: 0.44, y: 0.55, p: 0.78 },
            ],
          };
    const dotStub: MorphBrushStroke =
      dotMidPts.length >= 2
        ? toMorphStroke(dotMidPts)
        : {
            dunbiStart: false,
            flickEnd: false,
            points: [
              { x: 0.5, y: 0.46, p: 0.74 },
              { x: 0.57, y: 0.5, p: 0.78 },
              { x: 0.635, y: 0.535, p: 0.8 },
            ],
          };
    const arms = [stemStub, dotStub];
    return {
      targetMode: 'shape_target',
      vertex: centroidOfStrokes(arms),
      cornerArms: arms,
      shapeType: 'twin_bars',
      shapeSymbol: '=',
      shapeLabel: '中腰双影 =',
    };
  }

  // N: Dual Parallel / 3D Perspective Twin Rails (‖ / 八)
  if (key === 'n') {
    return detectNParallelRails(node, allStrokes, sampledLists);
  }

  // R default & fallback
  const strokes = node.coreStrokes.length > 0 ? node.coreStrokes : allStrokes.slice(0, 1);
  return {
    targetMode: 'shape_target',
    vertex: centroidOfStrokes(strokes),
    cornerArms: strokes,
    shapeType: key === 'r' ? 'twin_bars' : 'pivot_segment',
    shapeSymbol: key === 'r' ? '=' : '●',
    shapeLabel: key === 'r' ? '双勒叠锋 =' : '核心焦形',
  };
}

const convergenceCache = new Map<string, CornerConvergenceData>();

export function buildCornerConvergenceData(
  key: string,
  node: RadicalMorphNode
): CornerConvergenceData {
  const cacheKey = `${key}:${node.id}`;
  const cached = convergenceCache.get(cacheKey);
  if (cached) return cached;

  const fullStrokes: MorphBrushStroke[] = [...node.coreStrokes, ...node.extraStrokes];
  const rawDense = fullStrokes.map((st) => sampleStrokeDense(st.points, 0.025));

  const focus = detectKeyGestureFocus(key, node, fullStrokes, rawDense);

  interface RawNode {
    id: number;
    x: number;
    y: number;
    p: number;
    angle: number;
    strokeIdx: number;
    tInStroke: number;
    edges: Array<{ to: number; w: number }>;
  }

  const graphNodes: RawNode[] = [];
  const strokeNodeIds: number[][] = [];

  rawDense.forEach((pts, sIdx) => {
    const ids: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const id = graphNodes.length;
      graphNodes.push({
        id,
        x: pts[i].x,
        y: pts[i].y,
        p: pts[i].p,
        angle: Math.atan2(next.y - prev.y, next.x - prev.x),
        strokeIdx: sIdx,
        tInStroke: pts.length > 1 ? i / (pts.length - 1) : 0,
        edges: [],
      });
      ids.push(id);
    }
    for (let i = 0; i < ids.length - 1; i++) {
      const a = graphNodes[ids[i]];
      const b = graphNodes[ids[i + 1]];
      const w = Math.hypot(b.x - a.x, b.y - a.y);
      a.edges.push({ to: b.id, w });
      b.edges.push({ to: a.id, w });
    }
    strokeNodeIds.push(ids);
  });

  // Connect touching/crossing stroke junctions (`<= 0.088`) so light flows strictly along stroke pillars
  const ufParent = graphNodes.map((_, i) => i);
  const ufFind = (i: number): number => {
    while (ufParent[i] !== i) {
      ufParent[i] = ufParent[ufParent[i]];
      i = ufParent[i];
    }
    return i;
  };
  const ufUnion = (a: number, b: number) => {
    const ra = ufFind(a);
    const rb = ufFind(b);
    if (ra !== rb) ufParent[rb] = ra;
  };

  for (let i = 0; i < graphNodes.length; i++) {
    const a = graphNodes[i];
    for (let j = i + 1; j < graphNodes.length; j++) {
      const b = graphNodes[j];
      if (a.strokeIdx === b.strokeIdx) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d <= 0.088) {
        a.edges.push({ to: b.id, w: d * 0.9 });
        b.edges.push({ to: a.id, w: d * 0.9 });
        ufUnion(a.id, b.id);
      }
    }
  }

  // Determine seed node(s) for multi-source Dijkstra:
  //   - 'point_corner' (H, T, X): single closest apex node so light drains all the way to the corner tip
  //   - 'shape_target' (D, K, S, F, B, R, etc.): EVERY graph node sitting on the target focus strokes (`dist <= 0.042`)
  let apexNodeId = 0;
  let minApexDist = Infinity;
  graphNodes.forEach((gn) => {
    const d = Math.hypot(gn.x - focus.vertex.x, gn.y - focus.vertex.y);
    if (d < minApexDist) {
      minApexDist = d;
      apexNodeId = gn.id;
    }
  });

  const seedNodeIds: number[] = [];
  if (focus.targetMode === 'shape_target') {
    const targetPts: Array<{ x: number; y: number }> = focus.cornerArms.flatMap((st) =>
      sampleStrokeDense(st.points, 0.025)
    );
    if (focus.virtualLinks) {
      for (const link of focus.virtualLinks) {
        targetPts.push(link.from, link.to);
      }
    }
    if (focus.accentBeads) {
      for (const bead of focus.accentBeads) {
        targetPts.push(bead);
      }
    }
    if (focus.negativeBox) {
      const { x, y, w, h } = focus.negativeBox;
      // Seed the 4 corners & edge midpoints of the sheltered negative-space window so outer strokes drain inward into it
      targetPts.push(
        { x, y },
        { x: x + w * 0.5, y },
        { x: x + w, y },
        { x: x + w, y: y + h * 0.5 },
        { x: x + w, y: y + h },
        { x: x + w * 0.5, y: y + h },
        { x, y: y + h },
        { x, y: y + h * 0.5 }
      );
    }
    const seedRadius = focus.negativeBox ? 0.075 : 0.048;
    if (targetPts.length > 0) {
      graphNodes.forEach((gn) => {
        for (const tp of targetPts) {
          if (Math.hypot(gn.x - tp.x, gn.y - tp.y) <= seedRadius) {
            seedNodeIds.push(gn.id);
            break;
          }
        }
      });
    }
  }
  if (seedNodeIds.length === 0 && graphNodes.length > 0) {
    seedNodeIds.push(apexNodeId);
  }

  // Bridge any disconnected components (dots, parallel bars, detached halves) onto the seeded target component!
  if (graphNodes.length > 0) {
    // Union all seeds virtually when finding disconnected islands, or attach disconnected islands to nearest seeded node
    const seedRoots = new Set(seedNodeIds.map((id) => ufFind(id)));
    let safety = 0;
    while (safety++ < 16) {
      let bestA = -1;
      let bestB = -1;
      let bestGap = Infinity;
      for (let i = 0; i < graphNodes.length; i++) {
        if (seedRoots.has(ufFind(i))) continue;
        const a = graphNodes[i];
        for (let j = 0; j < graphNodes.length; j++) {
          if (!seedRoots.has(ufFind(j))) continue;
          const b = graphNodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < bestGap) {
            bestGap = d;
            bestA = i;
            bestB = j;
          }
        }
      }
      if (bestA === -1 || bestB === -1) break;
      graphNodes[bestA].edges.push({ to: bestB, w: bestGap * 1.1 });
      graphNodes[bestB].edges.push({ to: bestA, w: bestGap * 1.1 });
      const mergedRoot = ufFind(bestB);
      ufUnion(mergedRoot, bestA);
      seedRoots.add(mergedRoot);
    }
  }

  // Multi-source Dijkstra outward from all focus target seeds
  const distArr = new Float64Array(graphNodes.length);
  const nextArr = new Int32Array(graphNodes.length);
  const visited = new Uint8Array(graphNodes.length);
  distArr.fill(Infinity);
  nextArr.fill(-1);
  seedNodeIds.forEach((id) => {
    distArr[id] = 0;
  });

  for (let step = 0; step < graphNodes.length; step++) {
    let u = -1;
    let bestD = Infinity;
    for (let i = 0; i < graphNodes.length; i++) {
      if (!visited[i] && distArr[i] < bestD) {
        bestD = distArr[i];
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = 1;
    for (const edge of graphNodes[u].edges) {
      const nd = distArr[u] + edge.w;
      if (nd < distArr[edge.to]) {
        distArr[edge.to] = nd;
        nextArr[edge.to] = u;
      }
    }
  }

  let maxDist = 0.01;
  for (let i = 0; i < graphNodes.length; i++) {
    if (Number.isFinite(distArr[i]) && distArr[i] > maxDist) {
      maxDist = distArr[i];
    }
  }

  const sampledStrokes = fullStrokes.map((stroke, sIdx) => ({
    stroke,
    points: (strokeNodeIds[sIdx] ?? []).map((id) => {
      const g = graphNodes[id];
      const d = Number.isFinite(distArr[id]) ? distArr[id] : maxDist;
      return {
        id: g.id,
        x: g.x,
        y: g.y,
        p: g.p,
        angle: g.angle,
        strokeIdx: g.strokeIdx,
        tInStroke: g.tInStroke,
        distFromCorner: d,
        distNorm: Math.max(0, Math.min(1, d / maxDist)),
        nextHop: nextArr[id],
      };
    }),
  }));

  // Select outer stroke extremities & mid-arc peaks outside the focus target to spawn inward luminous streams
  const candidateStarts: Array<{ id: number; d: number; x: number; y: number }> = [];
  strokeNodeIds.forEach((ids) => {
    if (ids.length === 0) return;
    const sampleIdxs = Array.from(
      new Set([
        ids[0],
        ids[Math.floor(ids.length * 0.25)],
        ids[Math.floor(ids.length * 0.5)],
        ids[Math.floor(ids.length * 0.75)],
        ids[ids.length - 1],
      ])
    );
    sampleIdxs.forEach((nid) => {
      const d = Number.isFinite(distArr[nid]) ? distArr[nid] : 0;
      if (d > maxDist * 0.14) {
        candidateStarts.push({
          id: nid,
          d,
          x: graphNodes[nid].x,
          y: graphNodes[nid].y,
        });
      }
    });
  });

  candidateStarts.sort((a, b) => b.d - a.d);
  const chosenStarts: typeof candidateStarts = [];
  for (const cand of candidateStarts) {
    if (chosenStarts.length >= 16) break;
    const tooClose = chosenStarts.some(
      (picked) => Math.hypot(picked.x - cand.x, picked.y - cand.y) < 0.085
    );
    if (!tooClose) chosenStarts.push(cand);
  }

  const flowStreams: ConvergenceFlowStream[] = chosenStarts.map((st, idx) => {
    const pts: Array<{ x: number; y: number }> = [];
    let cur = st.id;
    let guard = 0;
    while (cur !== -1 && guard++ < 120) {
      pts.push({ x: graphNodes[cur].x, y: graphNodes[cur].y });
      if (distArr[cur] === 0) break;
      cur = nextArr[cur];
    }
    if (pts.length === 1) {
      pts.push({ x: focus.vertex.x, y: focus.vertex.y });
    }
    return {
      points: pts,
      startDistNorm: Math.max(0.12, Math.min(1, st.d / maxDist)),
      phaseOffset: (idx % 4) * 0.035,
    };
  });

  // If the entire glyph already IS the focus shape (or negativeBox/virtual-only focus),
  // spawn balanced inward pulse streams from both ends of each stroke toward its center/focus so energy still gathers crisply.
  if (flowStreams.length === 0) {
    const fallbackStrokes = focus.cornerArms.length > 0 ? focus.cornerArms : fullStrokes;
    fallbackStrokes.slice(0, 4).forEach((arm, armIdx) => {
      const dense = sampleStrokeDense(arm.points, 0.03);
      if (dense.length < 3) return;
      const mid = Math.floor(dense.length / 2);
      const firstHalf = dense.slice(0, mid + 1).map((p) => ({ x: p.x, y: p.y }));
      const secondHalf = dense
        .slice(mid)
        .reverse()
        .map((p) => ({ x: p.x, y: p.y }));
      if (firstHalf.length >= 2) {
        flowStreams.push({
          points: firstHalf,
          startDistNorm: 0.72,
          phaseOffset: ((armIdx * 2) % 4) * 0.035,
        });
      }
      if (secondHalf.length >= 2) {
        flowStreams.push({
          points: secondHalf,
          startDistNorm: 0.72,
          phaseOffset: ((armIdx * 2 + 1) % 4) * 0.035,
        });
      }
    });
  }

  const cueTitle = `已知「${node.radical}」全形 · 光线沿笔柱敛归「${focus.shapeSymbol}」`;
  const cueSummary = `闭眼亦知「${node.radical}」字形，按 ${key.toUpperCase()} 键一瞬外围光脉迅速衰退，沿笔画主柱收敛锁死在「${focus.shapeLabel}」焦点形状上。`;

  const out: CornerConvergenceData = {
    key,
    radical: node.radical,
    targetMode: focus.targetMode,
    shapeType: focus.shapeType,
    shapeSymbol: focus.shapeSymbol,
    shapeLabel: focus.shapeLabel,
    cornerVertex: focus.vertex,
    cornerArms: focus.cornerArms,
    virtualLinks: focus.virtualLinks,
    negativeBox: focus.negativeBox,
    accentBeads: focus.accentBeads,
    embraceArc: focus.embraceArc,
    brushStyle: focus.brushStyle,
    flickTip: focus.flickTip,
    resistanceCue: focus.resistanceCue,
    fullStrokes,
    sampledStrokes,
    flowStreams,
    cueTitle,
    cueSummary,
  };
  convergenceCache.set(cacheKey, out);
  return out;
}
