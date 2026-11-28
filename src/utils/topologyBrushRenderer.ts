import { CornerConvergenceData } from '../data/cornerConvergence';
import { MorphPt } from '../data/twentyKeysMorph';

export interface Sampled {
  x: number;
  y: number;
  p: number;
  angle: number;
}

export function sampleCatmullRom(points: MorphPt[], count = 64): Sampled[] {
  if (points.length < 2) return [];
  const raw: MorphPt[] = [];
  const n = points.length;
  const get = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  const segSteps = 26;

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

  const cumLen: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    cumLen.push(cumLen[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
  }
  const totalLen = cumLen[cumLen.length - 1] || 1;
  const uniform: Sampled[] = [];
  let cursor = 0;

  for (let k = 0; k < count; k++) {
    const targetD = (k / (count - 1)) * totalLen;
    while (cursor < cumLen.length - 2 && cumLen[cursor + 1] < targetD) {
      cursor++;
    }
    const segLen = Math.max(1e-6, cumLen[cursor + 1] - cumLen[cursor]);
    const frac = Math.max(0, Math.min(1, (targetD - cumLen[cursor]) / segLen));
    const a = raw[cursor];
    const b = raw[cursor + 1] ?? a;
    uniform.push({
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
      p: a.p + (b.p - a.p) * frac,
      angle: 0,
    });
  }

  for (let i = 0; i < uniform.length; i++) {
    const prev = uniform[Math.max(0, i - 1)];
    const next = uniform[Math.min(uniform.length - 1, i + 1)];
    uniform[i].angle = Math.atan2(next.y - prev.y, next.x - prev.x);
  }
  return uniform;
}

export function lerpSampled(a: Sampled[], b: Sampled[], t: number): Sampled[] {
  const n = Math.min(a.length, b.length);
  const out: Sampled[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: a[i].x + (b[i].x - a[i].x) * t,
      y: a[i].y + (b[i].y - a[i].y) * t,
      p: a[i].p + (b[i].p - a[i].p) * t,
      angle: 0,
    });
  }
  for (let i = 0; i < n; i++) {
    const prev = out[Math.max(0, i - 1)];
    const next = out[Math.min(n - 1, i + 1)];
    out[i].angle = Math.atan2(next.y - prev.y, next.x - prev.x);
  }
  return out;
}

export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

export function drawBrushSampled(
  ctx: CanvasRenderingContext2D,
  sampled: Sampled[],
  progress: number,
  size: number,
  rgb: string,
  alphaScale: number,
  dunbiStart: boolean,
  flickEnd: boolean
): { headX: number; headY: number; pressure: number } | null {
  if (progress <= 0.002 || sampled.length < 2) return null;
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const baseRadius = size * 0.031;

  const eased = easeInOutCubic(progress);
  const maxIdx = Math.max(1, Math.floor(eased * (sampled.length - 1)));
  const toPx = (pt: Sampled) => ({ x: pad + pt.x * inner, y: pad + pt.y * inner });

  if (dunbiStart && maxIdx >= 2) {
    const s0 = toPx(sampled[0]);
    const bloomR = baseRadius * sampled[0].p * 1.95;
    const g = ctx.createRadialGradient(s0.x, s0.y, bloomR * 0.12, s0.x, s0.y, bloomR);
    g.addColorStop(0, `rgba(${rgb}, ${0.24 * alphaScale})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s0.x, s0.y, bloomR, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i <= maxIdx; i++) {
    const pt = sampled[i];
    const px = toPx(pt);
    const localT = i / (sampled.length - 1);

    let pressure = pt.p;
    if (flickEnd && localT > 0.74) {
      const fade = (localT - 0.74) / 0.26;
      pressure *= Math.max(0.12, 1 - fade * 0.86);
    }

    const rx = Math.max(1.2, baseRadius * pressure * 1.1);
    const ry = Math.max(1.0, baseRadius * pressure * 0.72);
    const tilt = pt.angle * 0.34 - 0.66;
    const feibaiAlpha =
      flickEnd && localT > 0.8 ? Math.max(0.28, 1 - (localT - 0.8) * 3.0) : 0.94;

    ctx.save();
    ctx.translate(px.x, px.y);
    ctx.rotate(tilt);
    ctx.fillStyle = `rgba(${rgb}, ${feibaiAlpha * alphaScale})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    if (flickEnd && localT > 0.72 && i % 2 === 0) {
      ctx.fillStyle = `rgba(${rgb}, ${0.34 * alphaScale})`;
      ctx.beginPath();
      ctx.ellipse(rx * 0.54, ry * 0.42, rx * 0.28, ry * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const head = sampled[maxIdx];
  const headPx = toPx(head);
  return { headX: headPx.x, headY: headPx.y, pressure: head.p };
}

export function drawCalligraphyBrushTip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pressure: number,
  tone: 'crimson' | 'pine' | 'ink',
  isWash: boolean
) {
  ctx.save();
  ctx.translate(x, y);

  const haloR = 10 + pressure * 13;
  const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, haloR);
  const haloRgb =
    tone === 'crimson'
      ? isWash
        ? '178, 52, 40'
        : '229, 92, 68'
      : tone === 'pine'
        ? isWash
          ? '32, 118, 98'
          : '68, 206, 172'
        : isWash
          ? '26, 25, 22'
          : '240, 232, 218';
  halo.addColorStop(0, `rgba(${haloRgb}, 0.42)`);
  halo.addColorStop(1, `rgba(${haloRgb}, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(-0.62);
  const tuftW = 5.2 + pressure * 3.8;
  const tuftLen = 26;
  const tuftGrad = ctx.createLinearGradient(0, 0, 0, -tuftLen);
  if (tone === 'crimson') {
    tuftGrad.addColorStop(0, isWash ? '#9E2A22' : '#E8624B');
    tuftGrad.addColorStop(0.55, isWash ? '#5A2B24' : '#B57B5E');
    tuftGrad.addColorStop(1, isWash ? '#C7B08A' : '#DFC7A0');
  } else if (tone === 'pine') {
    tuftGrad.addColorStop(0, isWash ? '#1C6E5B' : '#45D0AC');
    tuftGrad.addColorStop(0.55, isWash ? '#274E45' : '#589C8A');
    tuftGrad.addColorStop(1, isWash ? '#C7B08A' : '#DFC7A0');
  } else {
    tuftGrad.addColorStop(0, isWash ? '#141412' : '#F4EFE6');
    tuftGrad.addColorStop(0.55, isWash ? '#48423A' : '#B5A894');
    tuftGrad.addColorStop(1, isWash ? '#CBB590' : '#E3D0B0');
  }

  ctx.fillStyle = tuftGrad;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.quadraticCurveTo(tuftW, -tuftLen * 0.42, tuftW * 0.56, -tuftLen);
  ctx.lineTo(-tuftW * 0.56, -tuftLen);
  ctx.quadraticCurveTo(-tuftW, -tuftLen * 0.42, 0, 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isWash ? '#2D2824' : '#3C352E';
  ctx.fillRect(-tuftW * 0.62, -tuftLen - 8, tuftW * 1.24, 9);

  const shaftGrad = ctx.createLinearGradient(0, -tuftLen - 8, 0, -tuftLen - 60);
  shaftGrad.addColorStop(0, isWash ? 'rgba(138, 102, 62, 0.9)' : 'rgba(196, 154, 102, 0.86)');
  shaftGrad.addColorStop(1, 'rgba(138, 102, 62, 0)');
  ctx.fillStyle = shaftGrad;
  ctx.fillRect(-tuftW * 0.5, -tuftLen - 60, tuftW, 52);

  ctx.restore();
}

export function drawResonanceField(
  ctx: CanvasRenderingContext2D,
  cores: Sampled[][],
  alpha: number,
  size: number,
  coreRgb: string
) {
  if (alpha <= 0.01 || cores.length === 0) return;
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const toPx = (pt: Sampled) => ({ x: pad + pt.x * inner, y: pad + pt.y * inner });

  ctx.save();
  ctx.strokeStyle = `rgba(${coreRgb}, ${alpha * 0.34})`;
  ctx.lineWidth = 1.1;
  ctx.setLineDash([3, 5]);

  if (cores.length >= 2) {
    const a = cores[0];
    const b = cores[1];
    for (const f of [0.22, 0.5, 0.78]) {
      const pa = toPx(a[Math.min(a.length - 1, Math.floor(f * (a.length - 1)))]);
      const pb = toPx(b[Math.min(b.length - 1, Math.floor(f * (b.length - 1)))]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  } else {
    const s = cores[0];
    ctx.beginPath();
    s.forEach((pt, idx) => {
      const px = toPx(pt);
      if (idx === 0) ctx.moveTo(px.x + 6, px.y + 6);
      else ctx.lineTo(px.x + 6, px.y + 6);
    });
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMiZiPaper(ctx: CanvasRenderingContext2D, size: number, isWash: boolean) {
  const bg = ctx.createRadialGradient(
    size * 0.5,
    size * 0.44,
    size * 0.06,
    size * 0.5,
    size * 0.5,
    size * 0.68
  );
  if (isWash) {
    bg.addColorStop(0, '#FCFBF7');
    bg.addColorStop(1, '#EFECE2');
  } else {
    bg.addColorStop(0, '#182030');
    bg.addColorStop(1, '#0C1019');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const pad = Math.round(size * 0.085);
  const bw = size - pad * 2;
  ctx.save();
  ctx.strokeStyle = isWash ? 'rgba(166, 52, 42, 0.22)' : 'rgba(216, 155, 60, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 0.5, pad + 0.5, bw - 1, bw - 1);

  ctx.strokeStyle = isWash ? 'rgba(166, 52, 42, 0.11)' : 'rgba(216, 155, 60, 0.1)';
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(pad + bw / 2, pad);
  ctx.lineTo(pad + bw / 2, pad + bw);
  ctx.moveTo(pad, pad + bw / 2);
  ctx.lineTo(pad + bw, pad + bw / 2);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad + bw, pad + bw);
  ctx.moveTo(pad + bw, pad);
  ctx.lineTo(pad, pad + bw);
  ctx.stroke();
  ctx.restore();
}

export function drawFingerVectorGuide(
  ctx: CanvasRenderingContext2D,
  sampled: Sampled[],
  size: number,
  pineRgb: string,
  alpha: number
) {
  if (sampled.length < 2 || alpha <= 0.01) return;
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const start = sampled[0];
  const end = sampled[sampled.length - 1];
  const sx = pad + start.x * inner;
  const sy = pad + start.y * inner;
  const ex = pad + end.x * inner;
  const ey = pad + end.y * inner;
  const ang = Math.atan2(ey - sy, ex - sx);

  ctx.save();
  ctx.fillStyle = `rgba(${pineRgb}, ${alpha * 0.18})`;
  ctx.beginPath();
  ctx.arc(sx, sy, 10.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${pineRgb}, ${alpha * 0.8})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(sx, sy, 10.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `rgba(${pineRgb}, ${Math.min(1, alpha * 1.15)})`;
  ctx.font = '700 9px "Noto Serif SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('起', sx, sy + 0.5);

  ctx.strokeStyle = `rgba(${pineRgb}, ${alpha * 0.45})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);

  const head = 8;
  ctx.fillStyle = `rgba(${pineRgb}, ${alpha * 0.78})`;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - head * Math.cos(ang - 0.5), ey - head * Math.sin(ang - 0.5));
  ctx.lineTo(ex - head * Math.cos(ang + 0.5), ey - head * Math.sin(ang + 0.5));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawStopImpactRipple(
  ctx: CanvasRenderingContext2D,
  pt: { x: number; y: number },
  size: number,
  coreRgb: string,
  impactT: number
) {
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const cx = pad + pt.x * inner;
  const cy = pad + pt.y * inner;

  ctx.save();
  if (impactT <= 1) {
    const eased = 1 - Math.pow(1 - Math.max(0, impactT), 3);
    const r = 7 + eased * 28;
    const a = (1 - eased) * 0.75;
    ctx.strokeStyle = `rgba(${coreRgb}, ${a})`;
    ctx.lineWidth = 2.4 * (1 - eased * 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(${coreRgb}, ${0.85 * (1 - eased * 0.45)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const breathe = 0.24 + 0.1 * Math.sin(impactT * 3);
    ctx.strokeStyle = `rgba(${coreRgb}, ${breathe})`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawReboundBounceGuide(
  ctx: CanvasRenderingContext2D,
  reboundPt: { x: number; y: number },
  reboundTarget: { x: number; y: number },
  size: number,
  amberRgb: string,
  progress: number,
  alphaScale: number
) {
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const wx = pad + reboundPt.x * inner;
  const wy = pad + reboundPt.y * inner;
  const tx = pad + reboundTarget.x * inner;
  const ty = pad + reboundTarget.y * inner;

  const dx = tx - wx;
  const dy = ty - wy;
  const ang = Math.atan2(dy, dx);
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const ctrlX = (wx + tx) * 0.5 + nx * 18;
  const ctrlY = (wy + ty) * 0.5 + ny * 18;

  const clamped = Math.max(0, Math.min(1, progress));
  const eased = progress <= 1 ? 1 - Math.pow(1 - clamped, 3) : 1;

  ctx.save();

  const wallR = progress <= 1 ? 7 + eased * 14 : 11;
  ctx.strokeStyle = `rgba(${amberRgb}, ${alphaScale * (progress <= 1 ? 0.9 - eased * 0.35 : 0.48)})`;
  ctx.lineWidth = progress <= 1 ? 2.4 : 1.5;
  ctx.beginPath();
  ctx.arc(wx, wy, wallR, ang - 1.15, ang + 1.15);
  ctx.stroke();

  ctx.fillStyle = `rgba(${amberRgb}, ${alphaScale * 0.9})`;
  ctx.beginPath();
  ctx.arc(wx, wy, 3.8, 0, Math.PI * 2);
  ctx.fill();

  const steps = 22;
  const endStep = Math.max(1, Math.floor(steps * eased));
  let tipX = wx;
  let tipY = wy;
  let prevX = wx;
  let prevY = wy;

  ctx.strokeStyle = `rgba(${amberRgb}, ${alphaScale * 0.85})`;
  ctx.lineWidth = progress <= 1 ? 2.2 : 1.4;
  if (progress > 1) ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  for (let i = 1; i <= endStep; i++) {
    const t = i / steps;
    const omt = 1 - t;
    const px = omt * omt * wx + 2 * omt * t * ctrlX + t * t * tx;
    const py = omt * omt * wy + 2 * omt * t * ctrlY + t * t * ty;
    ctx.lineTo(px, py);
    prevX = tipX;
    tipY = py;
    tipX = px;
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (endStep >= 2) {
    const tipAng = Math.atan2(tipY - prevY, tipX - prevX);
    const head = 8;
    ctx.fillStyle = `rgba(${amberRgb}, ${alphaScale * 0.95})`;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - head * Math.cos(tipAng - 0.5), tipY - head * Math.sin(tipAng - 0.5));
    ctx.lineTo(tipX - head * Math.cos(tipAng + 0.5), tipY - head * Math.sin(tipAng + 0.5));
    ctx.closePath();
    ctx.fill();

    if (eased > 0.72) {
      ctx.fillStyle = `rgba(${amberRgb}, ${alphaScale * 0.85})`;
      ctx.font = '700 9px "Noto Serif SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('回', tx + (tx - wx) * 0.1, ty + (ty - wy) * 0.1);
    }
  }
  ctx.restore();
}

export function drawCoreBloomDiffusion(
  ctx: CanvasRenderingContext2D,
  anchorPt: { x: number; y: number },
  shapeKind: 'square_corner' | 'cross_axis' | 'datum_bar' | 'base_seat' | 'slant_edge' | 'spine_needle',
  size: number,
  coreRgb: string,
  progress: number,
  alphaScale: number
) {
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const cx = pad + anchorPt.x * inner;
  const cy = pad + anchorPt.y * inner;

  ctx.save();
  ctx.fillStyle = `rgba(${coreRgb}, ${alphaScale * 0.16})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${coreRgb}, ${alphaScale * 0.78})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.stroke();

  if (progress <= 1) {
    const eased = 1 - Math.pow(1 - Math.max(0, progress), 2.5);
    const waveAlpha = (1 - eased * 0.72) * alphaScale;
    ctx.strokeStyle = `rgba(${coreRgb}, ${waveAlpha})`;
    ctx.lineWidth = 2.1 * (1 - eased * 0.45);
    ctx.setLineDash([5, 4]);

    if (shapeKind === 'square_corner') {
      const half = 18 + eased * (inner * 0.34);
      const boxCx = cx + (size * 0.5 - cx) * eased * 0.85;
      const boxCy = cy + (size * 0.5 - cy) * eased * 0.85;
      ctx.strokeRect(boxCx - half, boxCy - half, half * 2, half * 2);
    } else {
      const r = 14 + eased * (inner * 0.36);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = `rgba(${coreRgb}, ${alphaScale * 0.24})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    if (shapeKind === 'square_corner') {
      const half = inner * 0.34;
      ctx.strokeRect(size * 0.5 - half, size * 0.5 - half, half * 2, half * 2);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawDecayingPillarStroke(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number; p: number; angle: number; distNorm: number }>,
  size: number,
  inkRgb: string,
  coreRgb: string,
  amberRgb: string,
  convP: number,
  isWash: boolean,
  skeletonOnly: boolean,
  ghostAlphaOverride?: number
) {
  if (pts.length < 2) return;
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const baseRadius = size * 0.031;
  const ghostAlpha = ghostAlphaOverride ?? (skeletonOnly ? 0.045 : isWash ? 0.135 : 0.145);
  const wave = Math.max(-0.08, 1 - convP * 1.14);

  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const px = pad + pt.x * inner;
    const py = pad + pt.y * inner;

    let alpha = 0.88;
    let rgb = inkRgb;
    let radiusScale = 1.0;

    if (convP > 0.002) {
      if (convP >= 1.0) {
        alpha = ghostAlpha;
        radiusScale = 0.86;
      } else {
        const delta = pt.distNorm - wave;
        if (delta > 0.06) {
          const decayT = Math.min(1, (delta - 0.06) / 0.18);
          alpha = 0.88 - (0.88 - ghostAlpha) * decayT;
          radiusScale = 1.0 - 0.14 * decayT;
        } else if (delta >= -0.1) {
          const band = 1 - Math.abs(delta + 0.02) / 0.12;
          rgb = band > 0.45 ? amberRgb : coreRgb;
          alpha = 0.88 + 0.12 * band;
          radiusScale = 1.0 + 0.14 * band;
        } else if (pt.distNorm < 0.24) {
          const coreHeat = Math.min(1, convP * 1.15) * (1 - pt.distNorm / 0.24);
          if (coreHeat > 0.38) rgb = coreRgb;
          alpha = 0.88 + 0.1 * coreHeat;
        }
      }
    }

    const rx = Math.max(1.1, baseRadius * pt.p * 1.08 * radiusScale);
    const ry = Math.max(0.9, baseRadius * pt.p * 0.7 * radiusScale);
    const tilt = pt.angle * 0.34 - 0.66;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);
    ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawInwardPillarLightStreams(
  ctx: CanvasRenderingContext2D,
  data: CornerConvergenceData,
  size: number,
  coreRgb: string,
  amberRgb: string,
  convP: number,
  isWash: boolean
) {
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const toPx = (pt: { x: number; y: number }) => ({ x: pad + pt.x * inner, y: pad + pt.y * inner });

  ctx.save();

  const vx = pad + data.cornerVertex.x * inner;
  const vy = pad + data.cornerVertex.y * inner;
  const isPointCorner = data.targetMode === 'point_corner';
  for (let ringIdx = 0; ringIdx < 2; ringIdx++) {
    const local = Math.max(0, Math.min(1, convP * 1.15 - ringIdx * 0.16));
    if (local <= 0 || local >= 1) continue;
    const minR = isPointCorner ? 10 : size * 0.16;
    const spanR = isPointCorner ? size * 0.34 : size * 0.28;
    const r = (1 - local) * spanR + minR;
    const ringAlpha = Math.sin(local * Math.PI) * (isPointCorner ? 0.34 : 0.22);
    ctx.strokeStyle = `rgba(${amberRgb}, ${ringAlpha})`;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(vx, vy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const stream of data.flowStreams) {
    const pts = stream.points;
    if (pts.length < 2) continue;

    const u = Math.max(
      0,
      Math.min(1, (convP - stream.phaseOffset) / Math.max(0.25, 1 - stream.phaseOffset * 0.72))
    );
    if (u <= 0.005 || u >= 0.998) continue;

    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    const total = cum[cum.length - 1] || 0.01;

    const sampleAt = (frac: number) => {
      const target = Math.max(0, Math.min(1, frac)) * total;
      let idx = 0;
      while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
      const span = Math.max(1e-6, cum[idx + 1] - cum[idx]);
      const f = Math.max(0, Math.min(1, (target - cum[idx]) / span));
      return toPx({
        x: pts[idx].x + (pts[idx + 1].x - pts[idx].x) * f,
        y: pts[idx].y + (pts[idx + 1].y - pts[idx].y) * f,
      });
    };

    const tailFrac = Math.max(0, u - 0.24);
    const segCount = 10;
    const headPx = sampleAt(u);
    const tailPx = sampleAt(tailFrac);

    const grad = ctx.createLinearGradient(tailPx.x, tailPx.y, headPx.x, headPx.y);
    grad.addColorStop(0, `rgba(${amberRgb}, 0)`);
    grad.addColorStop(0.55, `rgba(${amberRgb}, 0.65)`);
    grad.addColorStop(1, `rgba(${coreRgb}, 0.96)`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let s = 0; s <= segCount; s++) {
      const sp = sampleAt(tailFrac + ((u - tailFrac) * s) / segCount);
      if (s === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    }
    ctx.stroke();

    const fadeOutAtApex = u > 0.88 ? Math.max(0.15, (1 - u) / 0.12) : 1;
    const halo = ctx.createRadialGradient(headPx.x, headPx.y, 0.5, headPx.x, headPx.y, 10);
    halo.addColorStop(
      0,
      isWash ? `rgba(${coreRgb}, ${0.95 * fadeOutAtApex})` : `rgba(255, 240, 210, ${0.95 * fadeOutAtApex})`
    );
    halo.addColorStop(0.42, `rgba(${amberRgb}, ${0.7 * fadeOutAtApex})`);
    halo.addColorStop(1, `rgba(${coreRgb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(headPx.x, headPx.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawExpandingPillarStroke(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number; p: number; angle: number; distNorm: number }>,
  size: number,
  inkRgb: string,
  coreRgb: string,
  amberRgb: string,
  expandP: number,
  isWash: boolean,
  ghostAlphaOverride?: number,
  settleToCore = false
) {
  if (pts.length < 2) return;
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const baseRadius = size * 0.031;
  const unbloomedAlpha = ghostAlphaOverride ?? (isWash ? 0.055 : 0.065);
  const wave = -0.06 + expandP * 1.18;
  const settledRgb = settleToCore ? coreRgb : inkRgb;

  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const px = pad + pt.x * inner;
    const py = pad + pt.y * inner;

    let alpha = unbloomedAlpha;
    let rgb = inkRgb;
    let radiusScale = 0.82;

    if (expandP >= 1.0) {
      alpha = settleToCore ? 0.94 : 0.9;
      rgb = settledRgb;
      radiusScale = 1.0;
    } else if (expandP > 0.002) {
      const delta = wave - pt.distNorm;
      if (delta < -0.06) {
        alpha = unbloomedAlpha;
        radiusScale = 0.82;
      } else if (delta <= 0.12) {
        // Active outward blooming wavefront radiating from topological focal shape
        const band = Math.max(0, 1 - Math.abs(delta - 0.02) / 0.11);
        rgb = band > 0.48 ? amberRgb : coreRgb;
        alpha = unbloomedAlpha + (0.98 - unbloomedAlpha) * Math.min(1, (delta + 0.06) / 0.14);
        radiusScale = 0.94 + 0.24 * band;
      } else {
        // Settled stroke behind the wavefront
        const settleT = Math.min(1, (delta - 0.12) / 0.16);
        rgb = settleToCore ? coreRgb : settleT < 0.35 ? coreRgb : inkRgb;
        alpha = settleToCore ? 0.94 : 0.9;
        radiusScale = 1.04 - 0.04 * settleT;
      }
    }

    if (alpha <= 0.01) continue;

    const rx = Math.max(1.1, baseRadius * pt.p * 1.08 * radiusScale);
    const ry = Math.max(0.9, baseRadius * pt.p * 0.7 * radiusScale);
    const tilt = pt.angle * 0.34 - 0.66;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(tilt);
    ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawOutwardPillarLightStreams(
  ctx: CanvasRenderingContext2D,
  data: CornerConvergenceData,
  size: number,
  coreRgb: string,
  amberRgb: string,
  expandP: number,
  isWash: boolean
) {
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const toPx = (pt: { x: number; y: number }) => ({ x: pad + pt.x * inner, y: pad + pt.y * inner });

  ctx.save();

  const vx = pad + data.cornerVertex.x * inner;
  const vy = pad + data.cornerVertex.y * inner;
  const isPointCorner = data.targetMode === 'point_corner';
  for (let ringIdx = 0; ringIdx < 2; ringIdx++) {
    const local = Math.max(0, Math.min(1, expandP * 1.15 - ringIdx * 0.16));
    if (local <= 0 || local >= 1) continue;
    const minR = isPointCorner ? 10 : size * 0.14;
    const spanR = isPointCorner ? size * 0.34 : size * 0.28;
    const r = local * spanR + minR;
    const ringAlpha = Math.sin(local * Math.PI) * (isPointCorner ? 0.34 : 0.22);
    ctx.strokeStyle = `rgba(${amberRgb}, ${ringAlpha})`;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(vx, vy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const stream of data.flowStreams) {
    const pts = stream.points;
    if (pts.length < 2) continue;

    // Reverse phase: streams radiate outward from the focal core to each stroke tip
    const u = Math.max(
      0,
      Math.min(1, (expandP - stream.phaseOffset * 0.45) / Math.max(0.28, 1 - stream.phaseOffset * 0.45))
    );
    if (u <= 0.005 || u >= 0.998) continue;

    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    const total = cum[cum.length - 1] || 0.01;

    // Sample along reversed polyline (outFrac = 0 at focal core -> 1 at outer tip)
    const sampleOutwardAt = (outFrac: number) => {
      const revFrac = Math.max(0, Math.min(1, 1 - outFrac));
      const target = revFrac * total;
      let idx = 0;
      while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
      const span = Math.max(1e-6, cum[idx + 1] - cum[idx]);
      const f = Math.max(0, Math.min(1, (target - cum[idx]) / span));
      return toPx({
        x: pts[idx].x + (pts[idx + 1].x - pts[idx].x) * f,
        y: pts[idx].y + (pts[idx + 1].y - pts[idx].y) * f,
      });
    };

    const tailFrac = Math.max(0, u - 0.24);
    const segCount = 10;
    const headPx = sampleOutwardAt(u);
    const tailPx = sampleOutwardAt(tailFrac);

    const grad = ctx.createLinearGradient(tailPx.x, tailPx.y, headPx.x, headPx.y);
    grad.addColorStop(0, `rgba(${coreRgb}, 0)`);
    grad.addColorStop(0.5, `rgba(${amberRgb}, 0.68)`);
    grad.addColorStop(1, `rgba(${coreRgb}, 0.95)`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let s = 0; s <= segCount; s++) {
      const sp = sampleOutwardAt(tailFrac + ((u - tailFrac) * s) / segCount);
      if (s === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    }
    ctx.stroke();

    const fadeOutAtTip = u > 0.88 ? Math.max(0.15, (1 - u) / 0.12) : 1;
    const halo = ctx.createRadialGradient(headPx.x, headPx.y, 0.5, headPx.x, headPx.y, 10);
    halo.addColorStop(
      0,
      isWash
        ? `rgba(${coreRgb}, ${0.95 * fadeOutAtTip})`
        : `rgba(255, 240, 210, ${0.95 * fadeOutAtTip})`
    );
    halo.addColorStop(0.42, `rgba(${amberRgb}, ${0.7 * fadeOutAtTip})`);
    halo.addColorStop(1, `rgba(${coreRgb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(headPx.x, headPx.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawCrystallizedCornerMark(
  ctx: CanvasRenderingContext2D,
  data: CornerConvergenceData,
  cornerArmSampled: Sampled[][],
  size: number,
  coreRgb: string,
  amberRgb: string,
  lockT: number,
  isWash: boolean,
  staticMode = false,
  cueFade = 1
) {
  const pad = size * 0.09;
  const inner = size - pad * 2;
  const vx = pad + data.cornerVertex.x * inner;
  const vy = pad + data.cornerVertex.y * inner;
  const isPointCorner = data.targetMode === 'point_corner';
  const style = data.brushStyle ?? 'default';

  const armIntensity = lockT < 0 ? Math.max(0, Math.min(1, (lockT + 1) * 0.85)) : 1;

  const styledArms: Array<{ pts: Sampled[]; dunbi: boolean; flick: boolean }> =
    cornerArmSampled.map((sampled, idx) => {
      const origStroke = data.cornerArms[idx];
      const baseDunbi = Boolean(origStroke?.dunbiStart);
      const baseFlick = Boolean(origStroke?.flickEnd);
      if (style === 'default' || sampled.length < 2) {
        return { pts: sampled, dunbi: baseDunbi, flick: baseFlick };
      }

      const n = sampled.length - 1;
      if (style === 'v_xuanzhen') {
        return {
          dunbi: true,
          flick: true,
          pts: sampled.map((pt, i) => {
            const t = i / n;
            const mult =
              t < 0.14
                ? 1.32 - t * 0.6
                : Math.max(0.18, 1.24 * Math.pow(1 - (t - 0.14) / 0.86, 0.72));
            return { ...pt, p: Math.min(1.5, pt.p * mult) };
          }),
        };
      }

      if (style === 'm_heavy_na') {
        return {
          dunbi: false,
          flick: true,
          pts: sampled.map((pt, i) => {
            const t = i / n;
            let mult = 1;
            if (t < 0.25) {
              mult = 0.52 + (t / 0.25) * 0.28;
            } else if (t < 0.78) {
              mult = 0.8 + ((t - 0.25) / 0.53) * 0.72;
            } else {
              const tail = (t - 0.78) / 0.22;
              mult = Math.max(0.2, 1.52 * (1 - tail * 0.84));
            }
            return { ...pt, p: Math.min(1.62, pt.p * mult) };
          }),
        };
      }

      if (style === 'c_round_cradle') {
        const minY = Math.min(...sampled.map((pt) => pt.y));
        const maxY = Math.max(...sampled.map((pt) => pt.y));
        const spanY = Math.max(0.08, maxY - minY);
        return {
          dunbi: false,
          flick: false,
          pts: sampled.map((pt, i) => {
            const t = i / n;
            const lowFrac = Math.max(0, Math.min(1, (pt.y - minY) / spanY));
            const belly = 0.84 + lowFrac * 0.36;
            const liftTip = t > 0.86 ? 1 - ((t - 0.86) / 0.14) * 0.28 : 1;
            return { ...pt, p: Math.min(1.38, pt.p * belly * liftTip) };
          }),
        };
      }

      if (style === 'w_silk_flick') {
        return {
          dunbi: false,
          flick: true,
          pts: sampled.map((pt, i) => {
            const t = i / n;
            const mult = t > 0.76 ? Math.max(0.22, 0.94 * (1 - ((t - 0.76) / 0.24) * 0.76)) : 0.92;
            return { ...pt, p: pt.p * mult };
          }),
        };
      }

      if (style === 'x_square_dun') {
        return {
          dunbi: false,
          flick: false,
          pts: sampled.map((pt) => {
            const dKnee = Math.hypot(pt.x - data.cornerVertex.x, pt.y - data.cornerVertex.y);
            const kneeBoost = dKnee < 0.085 ? 1 + (1 - dKnee / 0.085) * 0.38 : 0.94;
            return { ...pt, p: Math.min(1.48, pt.p * kneeBoost) };
          }),
        };
      }

      if (style === 't_resistance_block') {
        // Armored resistance barrier (厚重阻壁: stout immovable pressure across the blocking shield/wall)
        return {
          dunbi: true,
          flick: false,
          pts: sampled.map((pt, i) => {
            const t = i / n;
            const belly = 1.06 + Math.sin(t * Math.PI) * 0.24;
            return { ...pt, p: Math.min(1.48, pt.p * belly) };
          }),
        };
      }

      return { pts: sampled, dunbi: baseDunbi, flick: baseFlick };
    });

  if (armIntensity > 0.08) {
    if (isPointCorner) {
      ctx.save();
      const glowR = lockT >= 0 ? 46 : 30 + armIntensity * 14;
      const g = ctx.createRadialGradient(vx, vy, 2, vx, vy, glowR);
      g.addColorStop(0, `rgba(${amberRgb}, ${0.26 * armIntensity})`);
      g.addColorStop(0.55, `rgba(${coreRgb}, ${0.12 * armIntensity})`);
      g.addColorStop(1, `rgba(${coreRgb}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(vx, vy, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const snapBoost =
        !staticMode && lockT >= 0 && lockT <= 1
          ? Math.sin(lockT * Math.PI) * 0.22
          : !staticMode && lockT > 1
            ? 0.06 * Math.sin((lockT - 1) * 3.2)
            : 0;
      const haloAlpha = (0.16 + snapBoost) * armIntensity;
      ctx.save();
      ctx.strokeStyle = `rgba(${amberRgb}, ${haloAlpha})`;
      ctx.lineWidth = !staticMode && lockT >= 0 && lockT <= 1 ? 18 - lockT * 4 : 14;
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
      ctx.restore();
    }

    styledArms.forEach((arm) => {
      drawBrushSampled(
        ctx,
        arm.pts,
        1,
        size,
        coreRgb,
        0.98 * armIntensity,
        arm.dunbi,
        arm.flick
      );
    });

    if (style === 'x_square_dun') {
      const pulse =
        !staticMode && lockT >= 0 && lockT <= 1
          ? Math.sin(lockT * Math.PI) * 0.25
          : !staticMode && lockT > 1
            ? 0.08 * Math.sin((lockT - 1) * 3.0)
            : 0;
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate(-0.56);
      ctx.fillStyle = `rgba(${coreRgb}, ${Math.min(1, (0.94 + pulse) * armIntensity)})`;
      ctx.fillRect(-7.5, -5.2, 15, 10.4);
      ctx.strokeStyle = `rgba(${amberRgb}, ${Math.min(1, (0.72 + pulse) * armIntensity)})`;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-9.2, -6.8, 18.4, 13.6);
      ctx.restore();
    }
  }

  if (isPointCorner) {
    ctx.save();
    if (!staticMode && lockT >= 0 && lockT <= 1) {
      const snap = 1 - Math.pow(1 - lockT, 3);
      const collapseR = 32 * (1 - snap) + 8;
      ctx.strokeStyle = `rgba(${coreRgb}, ${(1 - snap * 0.55) * 0.9})`;
      ctx.lineWidth = 2.2 * (1 - snap * 0.45);
      ctx.beginPath();
      ctx.arc(vx, vy, collapseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = isWash ? `rgba(${coreRgb}, 0.95)` : 'rgba(255, 240, 214, 0.96)';
      ctx.beginPath();
      ctx.arc(vx, vy, 4.4 - snap * 1.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (lockT > 1) {
      const breathe = staticMode ? 0.58 : 0.48 + 0.2 * Math.sin((lockT - 1) * 3.2);
      ctx.strokeStyle = `rgba(${coreRgb}, ${breathe})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(vx, vy, 9.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(${amberRgb}, 0.92)`;
      ctx.beginPath();
      ctx.arc(vx, vy, 3.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (!staticMode && lockT >= 0 && lockT <= 1) {
    const snap = 1 - Math.pow(1 - lockT, 2.5);
    const edgeAlpha = (1 - snap) * 0.65;
    if (edgeAlpha > 0.02) {
      ctx.save();
      ctx.strokeStyle = isWash ? `rgba(${coreRgb}, ${edgeAlpha})` : `rgba(255, 236, 200, ${edgeAlpha})`;
      ctx.lineWidth = 2.6 - snap * 1.4;
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
      ctx.restore();
    }
  }

  if (data.virtualLinks && data.virtualLinks.length > 0 && armIntensity > 0.08) {
    const pulse =
      !staticMode && lockT >= 0 && lockT <= 1
        ? Math.sin(lockT * Math.PI) * 0.28
        : !staticMode && lockT > 1
          ? 0.08 * Math.sin((lockT - 1) * 3.2)
          : 0;
    const lineAlpha = Math.min(1, (0.86 + pulse) * armIntensity);

    ctx.save();
    for (const link of data.virtualLinks) {
      const x1 = pad + link.from.x * inner;
      const y1 = pad + link.from.y * inner;
      const x2 = pad + link.to.x * inner;
      const y2 = pad + link.to.y * inner;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      if (style === 'w_silk_flick') {
        const c1x = x1 + dx * 0.32 + nx * 13;
        const c1y = y1 + dy * 0.32 + ny * 13;
        const c2x = x1 + dx * 0.68 - nx * 11;
        const c2y = y1 + dy * 0.68 - ny * 11;

        ctx.strokeStyle = `rgba(${amberRgb}, ${(0.24 + pulse * 0.3) * armIntensity})`;
        ctx.lineWidth = 7.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
        ctx.stroke();

        const silkGrad = ctx.createLinearGradient(x1, y1, x2, y2);
        silkGrad.addColorStop(0, `rgba(${coreRgb}, ${lineAlpha * 0.92})`);
        silkGrad.addColorStop(0.5, `rgba(${amberRgb}, ${lineAlpha * 0.85})`);
        silkGrad.addColorStop(1, `rgba(${coreRgb}, ${lineAlpha * 0.92})`);
        ctx.strokeStyle = silkGrad;
        ctx.lineWidth = 2.0;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (style === 'c_round_cradle') {
        const isBottomFloor = Math.abs(dx) >= Math.abs(dy);
        const sagX = isBottomFloor ? 0 : nx * 8;
        const sagY = isBottomFloor ? 13 : ny * 8;
        const mx = (x1 + x2) * 0.5 + sagX;
        const my = (y1 + y2) * 0.5 + sagY;

        ctx.strokeStyle = `rgba(${amberRgb}, ${(0.22 + pulse * 0.4) * armIntensity})`;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        const steps = 28;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const omt = 1 - t;
          const px = omt * omt * x1 + 2 * omt * t * mx + t * t * x2;
          const py = omt * omt * y1 + 2 * omt * t * my + t * t * y2;
          const bellyR = 2.6 + Math.sin(t * Math.PI) * 3.8;
          ctx.fillStyle = `rgba(${coreRgb}, ${lineAlpha * (0.78 + Math.sin(t * Math.PI) * 0.2)})`;
          ctx.beginPath();
          ctx.arc(px, py, bellyR, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (style === 'v_xuanzhen') {
        ctx.strokeStyle = `rgba(${amberRgb}, ${(0.22 + pulse * 0.4) * armIntensity})`;
        ctx.lineWidth = 13;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const steps = 26;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const px = x1 + dx * t;
          const py = y1 + dy * t;
          const r = Math.max(1.1, (1 - t * 0.84) * 6.4);
          ctx.fillStyle = `rgba(${coreRgb}, ${lineAlpha * (0.94 - t * 0.16)})`;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (style === 'm_heavy_na') {
        ctx.strokeStyle = `rgba(${amberRgb}, ${(0.22 + pulse * 0.4) * armIntensity})`;
        ctx.lineWidth = 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const steps = 30;
        const ang = Math.atan2(dy, dx);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const wave = Math.sin(t * Math.PI) * 7;
          const px = x1 + dx * t + nx * wave * 0.45;
          const py = y1 + dy * t + ny * wave * 0.45;
          let rx = 3.2;
          if (t < 0.76) {
            rx = 2.0 + Math.pow(t / 0.76, 1.35) * 7.8;
          } else {
            rx = Math.max(1.2, 9.8 * (1 - ((t - 0.76) / 0.24) * 0.88));
          }
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang - 0.45);
          ctx.fillStyle = `rgba(${coreRgb}, ${lineAlpha * (0.86 + t * 0.12)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, rx * 0.66, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.strokeStyle = `rgba(${amberRgb}, ${(0.22 + pulse * 0.5) * armIntensity})`;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(${coreRgb}, ${lineAlpha})`;
        ctx.lineWidth = 4.2;
        ctx.lineCap = 'round';
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.setLineDash([]);
        for (const [ax, ay] of [
          [x1, y1],
          [x2, y2],
        ]) {
          ctx.fillStyle = `rgba(${coreRgb}, ${lineAlpha})`;
          ctx.beginPath();
          ctx.arc(ax, ay, 5.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isWash
            ? `rgba(255, 245, 228, ${0.9 * armIntensity})`
            : `rgba(255, 240, 214, ${0.95 * armIntensity})`;
          ctx.beginPath();
          ctx.arc(ax, ay, 2.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  if (style === 'w_silk_flick' && data.flickTip && armIntensity > 0.15) {
    const fx1 = pad + data.flickTip.from.x * inner;
    const fy1 = pad + data.flickTip.from.y * inner;
    const fx2 = pad + data.flickTip.to.x * inner;
    const fy2 = pad + data.flickTip.to.y * inner;
    const ang = Math.atan2(fy2 - fy1, fx2 - fx1);
    const pulse =
      !staticMode && lockT >= 0 && lockT <= 1
        ? Math.sin(lockT * Math.PI) * 0.35
        : !staticMode && lockT > 1
          ? 0.12 * Math.sin((lockT - 1) * 3.6)
          : 0;

    ctx.save();
    const flickGrad = ctx.createLinearGradient(fx1, fy1, fx2, fy2);
    flickGrad.addColorStop(0, `rgba(${coreRgb}, ${0.72 * armIntensity})`);
    flickGrad.addColorStop(0.65, `rgba(${amberRgb}, ${Math.min(1, (0.9 + pulse) * armIntensity)})`);
    flickGrad.addColorStop(1, isWash ? `rgba(${coreRgb}, 0.96)` : 'rgba(255, 244, 218, 0.98)');

    ctx.strokeStyle = flickGrad;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fx1, fy1);
    ctx.lineTo(fx2, fy2);
    ctx.stroke();

    const head = 9.5;
    ctx.fillStyle = `rgba(${amberRgb}, ${Math.min(1, (0.92 + pulse) * armIntensity)})`;
    ctx.beginPath();
    ctx.moveTo(fx2, fy2);
    ctx.lineTo(fx2 - head * Math.cos(ang - 0.38), fy2 - head * Math.sin(ang - 0.38));
    ctx.lineTo(fx2 - head * 0.55 * Math.cos(ang), fy2 - head * 0.55 * Math.sin(ang));
    ctx.lineTo(fx2 - head * Math.cos(ang + 0.38), fy2 - head * Math.sin(ang + 0.38));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (data.resistanceCue && armIntensity * cueFade > 0.08) {
    const rc = data.resistanceCue;
    const cueIntensity = armIntensity * cueFade;
    const tx1 = pad + rc.thrustFrom.x * inner;
    const ty1 = pad + rc.thrustFrom.y * inner;
    const tx2 = pad + rc.thrustTo.x * inner;
    const ty2 = pad + rc.thrustTo.y * inner;
    const dx = tx2 - tx1;
    const dy = ty2 - ty1;
    const ang = Math.atan2(dy, dx);
    const pulse =
      !staticMode && lockT >= 0 && lockT <= 1
        ? Math.sin(lockT * Math.PI) * 0.35
        : !staticMode && lockT > 1
          ? 0.14 * Math.sin((lockT - 1) * 4.2)
          : 0;
    // Cool jade-teal for unified finger vector (F→T ↗) + clear cobalt blue for the starting segment of 撇/提
    const fingerTealRgb = isWash ? '13, 148, 136' : '45, 212, 191';
    const refBlueRgb = isWash ? '29, 118, 210' : '56, 189, 248';

    // 0) Clear cool-blue starting portion of 撇/提 ("hard to advance into the red resistance wall")
    if (rc.referenceStrokes && rc.referenceStrokes.length > 0) {
      rc.referenceStrokes.forEach((refStroke) => {
        const refSampled = sampleCatmullRom(refStroke.points, 28);
        drawBrushSampled(
          ctx,
          refSampled,
          1,
          size,
          refBlueRgb,
          0.92 * cueIntensity,
          Boolean(refStroke.dunbiStart),
          Boolean(refStroke.flickEnd)
        );
      });
    }

    ctx.save();

    // 1) Unified cool green-blue finger direction vector (F→T ↗: dashed virtual on 丶/乀, crisp on all 6)
    ctx.strokeStyle = `rgba(${fingerTealRgb}, ${0.22 * cueIntensity})`;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx1, ty1);
    ctx.lineTo(tx2, ty2);
    ctx.stroke();

    const grad = ctx.createLinearGradient(tx1, ty1, tx2, ty2);
    grad.addColorStop(0, `rgba(${fingerTealRgb}, ${0.38 * cueIntensity})`);
    grad.addColorStop(1, `rgba(${fingerTealRgb}, ${Math.min(1, (0.92 + pulse) * cueIntensity)})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = rc.hasOwnStroke ? 3.2 : 2.8;
    // Dashed when purely virtual (丶/乀 with no 撇/提), emphasizing "virtual finger vector, not a stroke"
    if (!rc.hasOwnStroke) ctx.setLineDash([6, 5]);
    else ctx.setLineDash([10, 4]);
    ctx.beginPath();
    ctx.moveTo(tx1, ty1);
    ctx.lineTo(tx2, ty2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crisp cool-teal arrowhead indicating finger reach F→T (↗)
    const head = 10.5;
    ctx.fillStyle = `rgba(${fingerTealRgb}, ${Math.min(1, (0.94 + pulse) * cueIntensity)})`;
    ctx.beginPath();
    ctx.moveTo(tx2, ty2);
    ctx.lineTo(tx2 - head * Math.cos(ang - 0.4), ty2 - head * Math.sin(ang - 0.4));
    ctx.lineTo(tx2 - head * 0.5 * Math.cos(ang), ty2 - head * 0.5 * Math.sin(ang));
    ctx.lineTo(tx2 - head * Math.cos(ang + 0.4), ty2 - head * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();

    // 2) Vermilion curved shield shock-arc + rebound deflection at collision point (重点：红色阻力碰撞感)
    const nLen = Math.hypot(rc.shieldNormal.x, rc.shieldNormal.y) || 1;
    const snx = rc.shieldNormal.x / nLen;
    const sny = rc.shieldNormal.y / nLen;
    const normAng = Math.atan2(sny, snx);
    const arcR = 13 + rc.strength * 5 + pulse * 4;

    ctx.strokeStyle = `rgba(${coreRgb}, ${Math.min(1, (0.94 + pulse) * cueIntensity)})`;
    ctx.lineWidth = 2.6 + rc.strength * 0.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(tx2, ty2, arcR, normAng - 0.92, normAng + 0.92);
    ctx.stroke();

    // Subtle red rebound spark trajectory curving off the shield
    const rx = pad + rc.deflectTo.x * inner;
    const ry = pad + rc.deflectTo.y * inner;
    ctx.strokeStyle = `rgba(${coreRgb}, ${0.58 * cueIntensity})`;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(tx2, ty2);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  if (data.negativeBox && armIntensity > 0.08) {
    const { x, y, w, h } = data.negativeBox;
    const bx = pad + x * inner;
    const by = pad + y * inner;
    const bw = w * inner;
    const bh = h * inner;
    const pulse =
      !staticMode && lockT >= 0 && lockT <= 1
        ? Math.sin(lockT * Math.PI) * 0.24
        : !staticMode && lockT > 1
          ? 0.07 * Math.sin((lockT - 1) * 3.0)
          : 0;

    ctx.save();
    const diagGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    if (isWash) {
      diagGrad.addColorStop(0, `rgba(${coreRgb}, ${(0.18 + pulse * 0.2) * armIntensity})`);
      diagGrad.addColorStop(0.45, `rgba(${amberRgb}, ${(0.22 + pulse * 0.35) * armIntensity})`);
      diagGrad.addColorStop(1, `rgba(255, 250, 238, ${(0.72 + pulse * 0.25) * armIntensity})`);
    } else {
      diagGrad.addColorStop(0, `rgba(${coreRgb}, ${(0.22 + pulse * 0.2) * armIntensity})`);
      diagGrad.addColorStop(0.48, `rgba(${amberRgb}, ${(0.26 + pulse * 0.35) * armIntensity})`);
      diagGrad.addColorStop(1, `rgba(255, 236, 198, ${(0.42 + pulse * 0.25) * armIntensity})`);
    }
    ctx.fillStyle = diagGrad;
    ctx.fillRect(bx, by, bw, bh);

    ctx.strokeStyle = `rgba(${coreRgb}, ${Math.min(1, (0.94 + pulse) * armIntensity)})`;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by + bh * 0.82);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + bw * 0.82, by);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${amberRgb}, ${(0.46 + pulse * 0.45) * armIntensity})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.14, by + bh * 0.16);
    ctx.lineTo(bx + bw * 0.84, by + bh * 0.84);
    ctx.stroke();
    ctx.setLineDash([]);

    const tick = Math.min(15, Math.min(bw, bh) * 0.34);
    ctx.strokeStyle = isWash
      ? `rgba(${amberRgb}, ${Math.min(1, (0.95 + pulse) * armIntensity)})`
      : `rgba(255, 230, 178, ${Math.min(1, (0.95 + pulse) * armIntensity)})`;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + bh - tick);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw - tick, by + bh);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${coreRgb}, ${Math.min(1, (0.42 + pulse * 0.5) * armIntensity)})`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + 4);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + 4, by + bh);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (data.accentBeads && data.accentBeads.length > 0 && armIntensity > 0.08) {
    const pulse =
      !staticMode && lockT >= 0 && lockT <= 1
        ? Math.sin(lockT * Math.PI) * 0.28
        : !staticMode && lockT > 1
          ? 0.08 * Math.sin((lockT - 1) * 3.4)
          : 0;
    const axisX = pad + data.cornerVertex.x * inner;
    ctx.save();
    for (const bead of data.accentBeads) {
      const bx = pad + bead.x * inner;
      const by = pad + bead.y * inner;
      const isLeftSide = bx < axisX - 6;
      const isRightSide = bx > axisX + 6;
      const tilt = isLeftSide ? 0.58 : isRightSide ? -0.58 : 0.42;

      const haloR = 16 + pulse * 8;
      const halo = ctx.createRadialGradient(bx, by, 1, bx, by, haloR);
      halo.addColorStop(0, `rgba(${amberRgb}, ${0.38 * armIntensity})`);
      halo.addColorStop(0.55, `rgba(${coreRgb}, ${0.16 * armIntensity})`);
      halo.addColorStop(1, `rgba(${coreRgb}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(bx, by, haloR, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(tilt);

      ctx.fillStyle = `rgba(${coreRgb}, ${Math.min(1, 0.96 * armIntensity)})`;
      ctx.beginPath();
      ctx.moveTo(0, -10.5);
      ctx.quadraticCurveTo(6.4, 0.5, 0, 8.2);
      ctx.quadraticCurveTo(-6.4, 0.5, 0, -10.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isWash
        ? `rgba(255, 246, 232, ${0.88 * armIntensity})`
        : `rgba(255, 242, 218, ${0.95 * armIntensity})`;
      ctx.beginPath();
      ctx.ellipse(0, 2.0, 2.2, 3.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  if (data.embraceArc && armIntensity > 0.08) {
    const { start, ctrl, end } = data.embraceArc;
    const sx = pad + start.x * inner;
    const sy = pad + start.y * inner;
    const cx = pad + ctrl.x * inner;
    const cy = pad + ctrl.y * inner;
    const ex = pad + end.x * inner;
    const ey = pad + end.y * inner;
    const pulse =
      !staticMode && lockT >= 0 && lockT <= 1
        ? Math.sin(lockT * Math.PI) * 0.25
        : !staticMode && lockT > 1
          ? 0.07 * Math.sin((lockT - 1) * 3.0)
          : 0;

    ctx.save();
    ctx.strokeStyle = `rgba(${amberRgb}, ${(0.22 + pulse * 0.4) * armIntensity})`;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();

    const steps = 34;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const omt = 1 - t;
      const px = omt * omt * sx + 2 * omt * t * cx + t * t * ex;
      const py = omt * omt * sy + 2 * omt * t * cy + t * t * ey;
      const r =
        t < 0.35
          ? 2.6 + (t / 0.35) * 2.4
          : Math.max(1.1, 5.0 * (1 - ((t - 0.35) / 0.65) * 0.78));
      ctx.fillStyle = `rgba(${coreRgb}, ${Math.min(1, (0.65 + t * 0.32 + pulse * 0.2) * armIntensity)})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tipDx = ex - cx;
    const tipDy = ey - cy;
    const tipAng = Math.atan2(tipDy, tipDx);
    const head = 10;
    ctx.fillStyle = `rgba(${amberRgb}, ${Math.min(1, (0.94 + pulse) * armIntensity)})`;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - head * Math.cos(tipAng - 0.4), ey - head * Math.sin(tipAng - 0.4));
    ctx.lineTo(ex - head * 0.52 * Math.cos(tipAng), ey - head * 0.52 * Math.sin(tipAng));
    ctx.lineTo(ex - head * Math.cos(tipAng + 0.4), ey - head * Math.sin(tipAng + 0.4));
    ctx.closePath();
    ctx.fill();

    if (!staticMode && lockT >= 0) {
      const u = (lockT * 0.75) % 1;
      const omt = 1 - u;
      const gx = omt * omt * sx + 2 * omt * u * cx + u * u * ex;
      const gy = omt * omt * sy + 2 * omt * u * cy + u * u * ey;
      const glint = ctx.createRadialGradient(gx, gy, 0.5, gx, gy, 11);
      glint.addColorStop(0, isWash ? `rgba(${coreRgb}, 0.92)` : 'rgba(255, 245, 222, 0.96)');
      glint.addColorStop(0.5, `rgba(${amberRgb}, 0.55)`);
      glint.addColorStop(1, `rgba(${amberRgb}, 0)`);
      ctx.fillStyle = glint;
      ctx.beginPath();
      ctx.arc(gx, gy, 11, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export interface StaticStampOptions {
  showPaper?: boolean;
  showGhostGlyph?: boolean;
  showWatermark?: boolean;
  isWash?: boolean;
  ghostAlpha?: number;
}

/**
 * Render a crystal-clear, scale-invariant static snapshot of any key/radical's
 * converged topological focus shape inside `(x, y, targetSize)`.
 * Uses a logical 410x410 coordinate system scaled uniformly so all brush weights,
 * dunbi presses, negative-space windows, and flicks stay razor-sharp at any DPI.
 */
export function renderStaticConvergenceStamp(
  ctx: CanvasRenderingContext2D,
  convergenceData: CornerConvergenceData,
  radicalChar: string,
  x: number,
  y: number,
  targetSize: number,
  opts: StaticStampOptions = {}
) {
  const {
    showPaper = true,
    showGhostGlyph = true,
    showWatermark = false,
    isWash = true,
    ghostAlpha = 0.2,
  } = opts;

  const logical = 410;
  const scale = targetSize / logical;
  const coreRgb = isWash ? '176, 46, 36' : '232, 92, 68';
  const amberRgb = isWash ? '194, 118, 24' : '244, 178, 72';
  const inkRgb = isWash ? '26, 25, 23' : '242, 236, 226';

  const cornerArmSampled = convergenceData.cornerArms.map((s) => sampleCatmullRom(s.points, 36));

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (showPaper) {
    drawMiZiPaper(ctx, logical, isWash);
  }

  if (showWatermark) {
    ctx.save();
    const wmColor = isWash ? 'rgba(20, 20, 18, 0.045)' : 'rgba(244, 239, 230, 0.045)';
    if (radicalChar === '𠂇') {
      ctx.strokeStyle = wmColor;
      ctx.lineWidth = 24;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const cx = logical * 0.5;
      const cy = logical * 0.53;
      const r = 98;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.92, cy - r * 0.24);
      ctx.lineTo(cx + r * 0.92, cy - r * 0.24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.04, cy - r * 0.92);
      ctx.quadraticCurveTo(cx - r * 0.08, cy + r * 0.14, cx - r * 0.86, cy + r * 0.88);
      ctx.stroke();
    } else {
      ctx.fillStyle = wmColor;
      ctx.font = '700 260px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(radicalChar, logical * 0.5, logical * 0.53);
    }
    ctx.restore();
  }

  if (showGhostGlyph) {
    convergenceData.sampledStrokes.forEach((st) => {
      drawDecayingPillarStroke(
        ctx,
        st.points,
        logical,
        inkRgb,
        coreRgb,
        amberRgb,
        1,
        isWash,
        false,
        ghostAlpha
      );
    });
  }

  drawCrystallizedCornerMark(
    ctx,
    convergenceData,
    cornerArmSampled,
    logical,
    coreRgb,
    amberRgb,
    1.4,
    isWash,
    true
  );

  ctx.restore();
}
