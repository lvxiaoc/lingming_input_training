import { MorphBrushStroke, MorphPt } from './twentyKeysMorphTypes';

const clampP = (p: number) => Math.max(0.14, Math.min(1.0, p));

export function poly(
  pts: Array<[number, number, number]>,
  dunbiStart = true,
  flickEnd = false
): MorphBrushStroke {
  return {
    dunbiStart,
    flickEnd,
    points: pts.map(([x, y, p]) => ({ x, y, p: clampP(p) })),
  };
}

// 横 (Horizontal with authentic slight upward Kangjian tilt & dunbi terminals)
export function heng(
  x1: number,
  x2: number,
  y: number,
  lift = 0.02,
  w = 1
): MorphBrushStroke {
  const xm = (x1 + x2) * 0.5;
  return {
    dunbiStart: true,
    flickEnd: false,
    points: [
      { x: x1, y: y + lift * 0.5, p: clampP(0.8 * w) },
      { x: xm, y: y - lift * 0.05, p: clampP(0.56 * w) },
      { x: x2, y: y - lift * 0.5, p: clampP(0.84 * w) },
    ],
  };
}

// 竖 (Vertical: Chuilu blunt end or Xuanzhen needle flick)
export function shu(
  x: number,
  y1: number,
  y2: number,
  flick = false,
  w = 1
): MorphBrushStroke {
  const ym = (y1 + y2) * 0.5;
  return {
    dunbiStart: true,
    flickEnd: flick,
    points: [
      { x, y: y1, p: clampP(0.84 * w) },
      { x, y: ym, p: clampP(0.62 * w) },
      { x, y: y2, p: clampP((flick ? 0.2 : 0.78) * w) },
    ],
  };
}

// 撇 (Left-downward sweeping curve)
export function pie(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curve = 0.04,
  w = 1
): MorphBrushStroke {
  const xm = (x1 + x2) * 0.5 + curve;
  const ym = (y1 + y2) * 0.5 - curve * 0.35;
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1, p: clampP(0.78 * w) },
      { x: xm, y: ym, p: clampP(0.54 * w) },
      { x: x2, y: y2, p: clampP(0.18 * w) },
    ],
  };
}

// 捺 (Right-downward sweeping press with bold wave belly)
export function na(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curve = 0.04,
  w = 1
): MorphBrushStroke {
  const xMid = x1 + (x2 - x1) * 0.45 - curve * 0.5;
  const yMid = y1 + (y2 - y1) * 0.5 + curve * 0.4;
  const xBelly = x1 + (x2 - x1) * 0.78;
  const yBelly = y1 + (y2 - y1) * 0.86;
  return {
    dunbiStart: false,
    flickEnd: true,
    points: [
      { x: x1, y: y1, p: clampP(0.38 * w) },
      { x: xMid, y: yMid, p: clampP(0.64 * w) },
      { x: xBelly, y: yBelly, p: clampP(0.92 * w) },
      { x: x2, y: y2, p: clampP(0.2 * w) },
    ],
  };
}

// 点 (Calligraphic teardrop dot)
export function dian(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: false,
    flickEnd: false,
    points: [
      { x: x1, y: y1, p: clampP(0.28 * w) },
      { x: (x1 + x2) * 0.52, y: (y1 + y2) * 0.52, p: clampP(0.66 * w) },
      { x: x2, y: y2, p: clampP(0.92 * w) },
    ],
  };
}

// 提 (Brisk up-right flick)
export function ti(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1, p: clampP(0.86 * w) },
      { x: (x1 + x2) * 0.5, y: (y1 + y2) * 0.5, p: clampP(0.56 * w) },
      { x: x2, y: y2, p: clampP(0.18 * w) },
    ],
  };
}

// 横折 (Horizontal + sharp shoulder turn + vertical drop)
export function hengZhe(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  inward = 0.015,
  w = 1
): MorphBrushStroke {
  const pts: MorphPt[] = [
    { x: x1, y: y1 + 0.01, p: clampP(0.74 * w) },
    { x: (x1 + x2) * 0.55, y: y1 - 0.005, p: clampP(0.56 * w) },
    { x: x2, y: y1 - 0.01, p: clampP(0.88 * w) },
    { x: x2 - inward * 0.5, y: (y1 + y2) * 0.52, p: clampP(0.62 * w) },
    { x: x2 - inward, y: y2, p: clampP(0.76 * w) },
  ];
  return { dunbiStart: true, flickEnd: false, points: pts };
}

// 横折钩 (Horizontal + shoulder turn + drop + left-up hook)
export function hengZheGou(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  hookDx = -0.1,
  hookDy = -0.05,
  inward = 0.02,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1 + 0.01, p: clampP(0.74 * w) },
      { x: (x1 + x2) * 0.55, y: y1 - 0.005, p: clampP(0.56 * w) },
      { x: x2, y: y1 - 0.01, p: clampP(0.88 * w) },
      { x: x2 - inward * 0.5, y: (y1 + y2) * 0.55, p: clampP(0.64 * w) },
      { x: x2 - inward, y: y2, p: clampP(0.84 * w) },
      { x: x2 - inward + hookDx, y: y2 + hookDy, p: clampP(0.2 * w) },
    ],
  };
}

// 竖钩 (Vertical + bottom press + sharp flick hook)
export function shuGou(
  x: number,
  y1: number,
  y2: number,
  hookDx = -0.1,
  hookDy = -0.06,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x, y: y1, p: clampP(0.84 * w) },
      { x, y: (y1 + y2) * 0.52, p: clampP(0.62 * w) },
      { x, y: y2, p: clampP(0.86 * w) },
      { x: x + hookDx, y: y2 + hookDy, p: clampP(0.2 * w) },
    ],
  };
}

// 竖提 (Vertical + bottom turn + up-right flick)
export function shuTi(
  x: number,
  y1: number,
  y2: number,
  tx: number,
  ty: number,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x, y: y1, p: clampP(0.82 * w) },
      { x, y: (y1 + y2) * 0.55, p: clampP(0.6 * w) },
      { x, y: y2, p: clampP(0.86 * w) },
      { x: tx, y: ty, p: clampP(0.2 * w) },
    ],
  };
}

// 竖弯钩 (Vertical drop + smooth bottom bend + upward flick)
export function shuWanGou(
  x1: number,
  y1: number,
  y2: number,
  x2: number,
  hookDy = -0.11,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1, p: clampP(0.82 * w) },
      { x: x1, y: y1 + (y2 - y1) * 0.65, p: clampP(0.62 * w) },
      { x: x1 + (x2 - x1) * 0.25, y: y2, p: clampP(0.66 * w) },
      { x: x2, y: y2 - 0.01, p: clampP(0.84 * w) },
      { x: x2 + 0.015, y: y2 + hookDy, p: clampP(0.2 * w) },
    ],
  };
}

// 竖折 (Vertical drop + bottom bend right)
export function shuZhe(
  x1: number,
  y1: number,
  y2: number,
  x2: number,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: false,
    points: [
      { x: x1, y: y1, p: clampP(0.8 * w) },
      { x: x1, y: (y1 + y2) * 0.55, p: clampP(0.6 * w) },
      { x: x1, y: y2, p: clampP(0.82 * w) },
      { x: (x1 + x2) * 0.55, y: y2 - 0.005, p: clampP(0.6 * w) },
      { x: x2, y: y2 - 0.015, p: clampP(0.8 * w) },
    ],
  };
}

// 横撇 (Horizontal + turn + left sweep)
export function hengPie(
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  y3: number,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1 + 0.01, p: clampP(0.74 * w) },
      { x: x2, y: y1 - 0.01, p: clampP(0.84 * w) },
      { x: (x2 + x3) * 0.54, y: (y1 + y3) * 0.5, p: clampP(0.56 * w) },
      { x: x3, y: y3, p: clampP(0.18 * w) },
    ],
  };
}

// 撇折 (Left sweep + crisp corner fold + rising horizontal)
export function pieZhe(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: false,
    points: [
      { x: x1, y: y1, p: clampP(0.78 * w) },
      { x: (x1 + x2) * 0.5, y: (y1 + y2) * 0.5, p: clampP(0.54 * w) },
      { x: x2, y: y2, p: clampP(0.84 * w) },
      { x: x3, y: y3, p: clampP(0.72 * w) },
    ],
  };
}

// 斜钩 (Curved diagonal rightward thrust + upward kick)
export function xieGou(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  hookDx = 0.03,
  hookDy = -0.12,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1, p: clampP(0.82 * w) },
      { x: x1 + (x2 - x1) * 0.34, y: y1 + (y2 - y1) * 0.44, p: clampP(0.62 * w) },
      { x: x1 + (x2 - x1) * 0.72, y: y1 + (y2 - y1) * 0.82, p: clampP(0.74 * w) },
      { x: x2, y: y2, p: clampP(0.9 * w) },
      { x: x2 + hookDx, y: y2 + hookDy, p: clampP(0.2 * w) },
    ],
  };
}

// 弯钩 (Arched downward spine + crisp inward hook)
export function wanGou(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bow = 0.07,
  hookDx = -0.1,
  hookDy = -0.06,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1, p: clampP(0.76 * w) },
      { x: (x1 + x2) * 0.5 + bow, y: (y1 + y2) * 0.48, p: clampP(0.64 * w) },
      { x: x2, y: y2, p: clampP(0.88 * w) },
      { x: x2 + hookDx, y: y2 + hookDy, p: clampP(0.2 * w) },
    ],
  };
}

// 横折弯钩 (Horizontal + drop + bottom bend right + upward hook)
export function hengZheWanGou(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  x3: number,
  hookDy = -0.1,
  w = 1
): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: true,
    points: [
      { x: x1, y: y1 + 0.01, p: clampP(0.74 * w) },
      { x: x2, y: y1 - 0.01, p: clampP(0.86 * w) },
      { x: x2 - 0.03, y: (y1 + y2) * 0.55, p: clampP(0.6 * w) },
      { x: x2 + (x3 - x2) * 0.35, y: y2, p: clampP(0.68 * w) },
      { x: x3, y: y2 - 0.01, p: clampP(0.86 * w) },
      { x: x3 + 0.01, y: y2 + hookDy, p: clampP(0.2 * w) },
    ],
  };
}
