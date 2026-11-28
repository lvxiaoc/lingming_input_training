import React, { useEffect, useRef } from 'react';
import {
  BrushControlPoint,
  CalligraphyGestureSpec,
  ParametricBrushStroke,
} from '../data/calligraphyTopology';
import { ThemeMode } from '../data/theme';

export interface InkTraceGhost {
  id: number;
  gesture: CalligraphyGestureSpec;
  offsetX: number; // -0.18..0.18 normalized horizontal drift for running-script flow
  opacity: number;
}

interface CalligraphyInkCanvasProps {
  gesture: CalligraphyGestureSpec | null;
  playTick: number; // Increment to replay the current gesture animation
  speedMultiplier?: number; // 0.5 = slow study, 1.0 = natural brush cadence
  themeMode: ThemeMode;
  showGuide?: boolean;
  ghostTraces?: InkTraceGhost[];
  vowelPulseTick?: number; // Subtle ink-drop settle when typing Lingming vowel small-codes (a e i o u)
  vowelLabel?: string | null;
  size?: number;
  className?: string;
}

interface SampledPoint {
  x: number;
  y: number;
  p: number;
  angle: number;
  speed: number;
}

// Smooth Catmull-Rom interpolation for organic calligraphic brushwork
function sampleCatmullRom(points: BrushControlPoint[], stepsPerSeg = 32): SampledPoint[] {
  if (points.length < 2) return [];
  const out: SampledPoint[] = [];
  const n = points.length;

  const getPt = (idx: number) => points[Math.max(0, Math.min(n - 1, idx))];

  for (let i = 0; i < n - 1; i++) {
    const p0 = getPt(i - 1);
    const p1 = getPt(i);
    const p2 = getPt(i + 1);
    const p3 = getPt(i + 2);

    const count = i === n - 2 ? stepsPerSeg + 1 : stepsPerSeg;
    for (let s = 0; s < count; s++) {
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

      out.push({ x, y, p, angle: 0, speed: 0 });
    }
  }

  for (let i = 0; i < out.length; i++) {
    const prev = out[Math.max(0, i - 1)];
    const next = out[Math.min(out.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    out[i].angle = Math.atan2(dy, dx);
    out[i].speed = Math.hypot(dx, dy);
  }

  return out;
}

function easeBrush(t: number): number {
  // Subtle calligraphy rhythm: slight pause at entry dunbi, fluid glide through belly, crisp finish
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 2 * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
}

function drawParametricStroke(
  ctx: CanvasRenderingContext2D,
  stroke: ParametricBrushStroke,
  progress: number, // 0..1
  w: number,
  h: number,
  offsetX: number,
  inkRgb: string,
  accentRgb: string,
  alphaScale: number,
  isLiveActive: boolean
) {
  if (progress <= 0.001) return;
  const sampled = sampleCatmullRom(stroke.points, 36);
  if (sampled.length < 2) return;

  const eased = easeBrush(progress);
  const maxIndex = Math.max(1, Math.floor(eased * (sampled.length - 1)));
  const baseRadius = Math.min(w, h) * 0.036;
  const padX = w * 0.06;
  const padY = h * 0.06;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const toPx = (pt: SampledPoint) => ({
    x: padX + (pt.x + offsetX) * innerW,
    y: padY + pt.y * innerH,
  });

  // Subtle Xuan-paper ink bleed halo at heavy dunbi entry
  if (stroke.dunbiStart && maxIndex >= 2) {
    const startPx = toPx(sampled[0]);
    const bloomR = baseRadius * sampled[0].p * 1.9;
    const grad = ctx.createRadialGradient(
      startPx.x,
      startPx.y,
      bloomR * 0.15,
      startPx.x,
      startPx.y,
      bloomR
    );
    grad.addColorStop(0, `rgba(${inkRgb}, ${0.26 * alphaScale})`);
    grad.addColorStop(1, `rgba(${inkRgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(startPx.x, startPx.y, bloomR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Paint variable-width elliptical wolf-hair brush footprints along the curve
  for (let i = 0; i <= maxIndex; i++) {
    const pt = sampled[i];
    const px = toPx(pt);
    const localT = i / (sampled.length - 1);

    let pressure = pt.p;
    if (stroke.flickEnd && localT > 0.78) {
      const fade = (localT - 0.78) / 0.22;
      pressure *= Math.max(0.12, 1 - fade * 0.85);
    }

    const rx = Math.max(1.2, baseRadius * pressure * 1.08);
    const ry = Math.max(1.0, baseRadius * pressure * 0.72);
    // Brush held at traditional ~42-degree oblique wrist angle blended with tangent
    const brushTilt = pt.angle * 0.35 - 0.68;

    // Slight dry-brush feibai transparency when gliding fast near exit
    const feibaiAlpha =
      stroke.flickEnd && localT > 0.82
        ? Math.max(0.32, 1 - (localT - 0.82) * 3.1)
        : 0.94;

    ctx.save();
    ctx.translate(px.x, px.y);
    ctx.rotate(brushTilt);
    ctx.fillStyle = `rgba(${inkRgb}, ${feibaiAlpha * alphaScale})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle feibai side bristles on high-velocity tail
    if (stroke.flickEnd && localT > 0.72 && i % 2 === 0) {
      ctx.fillStyle = `rgba(${inkRgb}, ${0.35 * alphaScale})`;
      ctx.beginPath();
      ctx.ellipse(rx * 0.55, ry * 0.45, rx * 0.32, ry * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Living crimson/ochre brush-tip halo while actively drawing
  if (isLiveActive && progress > 0.02 && progress < 0.99) {
    const head = sampled[maxIndex];
    const headPx = toPx(head);
    const glowR = baseRadius * 1.35;
    const tipGrad = ctx.createRadialGradient(
      headPx.x,
      headPx.y,
      1,
      headPx.x,
      headPx.y,
      glowR
    );
    tipGrad.addColorStop(0, `rgba(${accentRgb}, 0.85)`);
    tipGrad.addColorStop(0.45, `rgba(${accentRgb}, 0.25)`);
    tipGrad.addColorStop(1, `rgba(${accentRgb}, 0)`);
    ctx.fillStyle = tipGrad;
    ctx.beginPath();
    ctx.arc(headPx.x, headPx.y, glowR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMiZiGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  isWash: boolean
) {
  const pad = Math.round(Math.min(w, h) * 0.08);
  const x0 = pad;
  const y0 = pad;
  const bw = w - pad * 2;
  const bh = h - pad * 2;

  ctx.save();
  // Outer square frame
  ctx.strokeStyle = isWash
    ? 'rgba(166, 52, 42, 0.22)'
    : 'rgba(216, 155, 60, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, bh - 1);

  // Inner dashed cross & diagonals (米字格)
  ctx.strokeStyle = isWash
    ? 'rgba(166, 52, 42, 0.12)'
    : 'rgba(216, 155, 60, 0.10)';
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  // Vertical & horizontal midlines
  ctx.moveTo(x0 + bw / 2, y0);
  ctx.lineTo(x0 + bw / 2, y0 + bh);
  ctx.moveTo(x0, y0 + bh / 2);
  ctx.lineTo(x0 + bw, y0 + bh / 2);
  // Diagonals
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + bw, y0 + bh);
  ctx.moveTo(x0 + bw, y0);
  ctx.lineTo(x0, y0 + bh);
  ctx.stroke();
  ctx.restore();
}

function drawMotionGuides(
  ctx: CanvasRenderingContext2D,
  gesture: CalligraphyGestureSpec,
  w: number,
  h: number,
  accentRgb: string
) {
  const padX = w * 0.06;
  const padY = h * 0.06;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  ctx.save();
  ctx.strokeStyle = `rgba(${accentRgb}, 0.24)`;
  ctx.fillStyle = `rgba(${accentRgb}, 0.42)`;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 4]);

  gesture.strokes.forEach((stroke, idx) => {
    const pts = sampleCatmullRom(stroke.points, 12);
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const px = padX + pt.x * innerW;
      const py = padY + pt.y * innerH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Start order marker
    const s0 = pts[0];
    const sx = padX + s0.x * innerW;
    const sy = padY + s0.y * innerH;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(String(idx + 1), sx + 6, sy - 5);
    ctx.setLineDash([3, 4]);
  });

  ctx.restore();
}

export const CalligraphyInkCanvas: React.FC<CalligraphyInkCanvasProps> = ({
  gesture,
  playTick,
  speedMultiplier = 1,
  themeMode,
  showGuide = false,
  ghostTraces = [],
  vowelPulseTick = 0,
  vowelLabel = null,
  size = 340,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vowelAnimStartRef = useRef<number>(0);

  useEffect(() => {
    if (vowelPulseTick > 0) {
      vowelAnimStartRef.current = performance.now();
    }
  }, [vowelPulseTick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isWash = themeMode === 'wash';
    const inkRgb = isWash ? '20, 20, 18' : '244, 239, 230';
    const accentRgb = isWash ? '178, 52, 40' : '217, 74, 56';

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const totalDurationMs = Math.round(680 / Math.max(0.25, speedMultiplier));
    const startTime = performance.now();
    let rafId = 0;

    const drawFrame = (now: number) => {
      ctx.clearRect(0, 0, size, size);

      // Subtle paper grain / radial vignette
      const bgGrad = ctx.createRadialGradient(
        size * 0.5,
        size * 0.45,
        size * 0.08,
        size * 0.5,
        size * 0.5,
        size * 0.65
      );
      if (isWash) {
        bgGrad.addColorStop(0, 'rgba(250, 249, 245, 0.95)');
        bgGrad.addColorStop(1, 'rgba(235, 231, 222, 0.85)');
      } else {
        bgGrad.addColorStop(0, 'rgba(22, 29, 42, 0.92)');
        bgGrad.addColorStop(1, 'rgba(11, 15, 23, 0.98)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      drawMiZiGrid(ctx, size, size, isWash);

      // Draw lingering ghost gestures from previous keystrokes (行气连绵)
      for (const ghost of ghostTraces) {
        for (const stroke of ghost.gesture.strokes) {
          drawParametricStroke(
            ctx,
            stroke,
            1,
            size,
            size,
            ghost.offsetX,
            inkRgb,
            accentRgb,
            ghost.opacity,
            false
          );
        }
      }

      const elapsed = now - startTime;
      const globalT = reducedMotion ? 1 : Math.min(1, elapsed / totalDurationMs);

      if (gesture) {
        if (showGuide) {
          drawMotionGuides(ctx, gesture, size, size, accentRgb);
        }

        for (const stroke of gesture.strokes) {
          const localT =
            stroke.duration > 0
              ? (globalT - stroke.delay) / stroke.duration
              : globalT >= stroke.delay
                ? 1
                : 0;
          drawParametricStroke(
            ctx,
            stroke,
            Math.max(0, Math.min(1, localT)),
            size,
            size,
            0,
            inkRgb,
            accentRgb,
            1,
            globalT < 1
          );
        }
      }

      // Subtle vowel ink-drop settle ripple in bottom-right seal corner (收锋落墨)
      const vowelElapsed = now - vowelAnimStartRef.current;
      let keepVowelAnimating = false;
      if (vowelAnimStartRef.current > 0 && vowelElapsed < 520) {
        keepVowelAnimating = true;
        const vt = vowelElapsed / 520;
        const cx = size * 0.84;
        const cy = size * 0.84;
        const r = 6 + vt * 22;
        ctx.save();
        ctx.strokeStyle = `rgba(${accentRgb}, ${(1 - vt) * 0.65})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        if (vowelLabel) {
          ctx.fillStyle = `rgba(${accentRgb}, ${(1 - vt * 0.6) * 0.85})`;
          ctx.font = '600 12px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(vowelLabel.toUpperCase(), cx, cy);
        }
        ctx.restore();
      }

      if (globalT < 1 || keepVowelAnimating) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    rafId = window.requestAnimationFrame(drawFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [gesture, playTick, speedMultiplier, themeMode, showGuide, ghostTraces, vowelPulseTick, vowelLabel, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`block rounded-xl border border-[var(--dojo-border)] shadow-xs ${className}`}
      aria-label={
        gesture
          ? `${gesture.key.toUpperCase()} 键书法笔势动画：${gesture.techniqueName}`
          : '书法拓扑运笔宣纸画布'
      }
    />
  );
};
