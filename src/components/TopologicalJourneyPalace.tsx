import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Feather,
  Pause,
  Play,
  Printer,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  buildTopologicalPalace,
  ContinuousPathPoint,
  JourneyStation,
} from '../data/topologicalPalace';
import { TWENTY_KEY_MORPH_BY_KEY, TWENTY_KEY_MORPHS } from '../data/twentyKeysMorph';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { synth } from '../audio/synth';
import { useTopologyAtlasPrint } from '../hooks/useTopologyAtlasPrint';
import { PrintableTopologySheets } from './PrintableTopologySheets';

interface TopologicalJourneyPalaceProps {
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  initialKey?: string;
  onOpenMorphTheater: (key: string) => void;
  onOpenLegacyPalace: () => void;
  onBackToDojo: () => void;
}

const QWERTY_ROWS: Array<Array<string>> = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const VOWELS_SET = new Set(['a', 'e', 'i', 'o', 'u']);

const STAGE_W = 640;
const STAGE_H = 480;

function computeInkedArc(path: ContinuousPathPoint[]): { cum: number[]; totalPx: number } {
  const cum: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const segPx =
      path[i].isBridge || path[i - 1].isBridge
        ? 0
        : Math.hypot((path[i].x - path[i - 1].x) * STAGE_W, (path[i].y - path[i - 1].y) * STAGE_H);
    cum.push(cum[i - 1] + segPx);
  }
  return { cum, totalPx: cum[cum.length - 1] || 1 };
}

function getPathPointAt(path: ContinuousPathPoint[], t: number): { x: number; y: number } {
  if (path.length === 0) return { x: 0.5, y: 0.5 };
  if (path.length === 1) return { x: path[0].x, y: path[0].y };
  const { cum, totalPx } = computeInkedArc(path);
  const target = Math.max(0, Math.min(1, t)) * totalPx;
  let idx = 0;
  while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
  while (idx < path.length - 2 && (path[idx].isBridge || path[idx + 1].isBridge)) idx++;
  const segLen = Math.max(1e-6, cum[idx + 1] - cum[idx]);
  const frac = Math.max(0, Math.min(1, (target - cum[idx]) / segLen));
  const a = path[idx];
  const b = path[idx + 1] ?? a;
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

function drawXuanPaperBase(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  isWash: boolean
) {
  const grad = ctx.createRadialGradient(
    w * 0.5,
    h * 0.45,
    Math.min(w, h) * 0.08,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.65
  );
  if (isWash) {
    grad.addColorStop(0, '#FCFBF7');
    grad.addColorStop(1, '#EEEAE0');
  } else {
    grad.addColorStop(0, '#182030');
    grad.addColorStop(1, '#0C1019');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle architectural border & Mi-Zi crosshair
  const padX = Math.round(w * 0.045);
  const padY = Math.round(h * 0.055);
  const bw = w - padX * 2;
  const bh = h - padY * 2;
  ctx.save();
  ctx.strokeStyle = isWash ? 'rgba(166, 52, 42, 0.18)' : 'rgba(216, 155, 60, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padX + 0.5, padY + 0.5, bw - 1, bh - 1);

  ctx.strokeStyle = isWash ? 'rgba(166, 52, 42, 0.09)' : 'rgba(216, 155, 60, 0.08)';
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(padX + bw / 2, padY);
  ctx.lineTo(padX + bw / 2, padY + bh);
  ctx.moveTo(padX, padY + bh / 2);
  ctx.lineTo(padX + bw, padY + bh / 2);
  ctx.stroke();
  ctx.restore();
}

export const TopologicalJourneyPalace: React.FC<TopologicalJourneyPalaceProps> = ({
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  initialKey = 'r',
  onOpenMorphTheater,
  onOpenLegacyPalace,
  onBackToDojo,
}) => {
  const [activeKey, setActiveKey] = useState<string>(() =>
    TWENTY_KEY_MORPH_BY_KEY.has(initialKey) ? initialKey : 'r'
  );
  const [stationIdx, setStationIdx] = useState(0);
  const [typedPrefix, setTypedPrefix] = useState('');
  const [wrongKeyFlash, setWrongKeyFlash] = useState<string | null>(null);
  const [blindMode, setBlindMode] = useState(false);
  const [highFreqOnly, setHighFreqOnly] = useState(false);
  const [autoWalk, setAutoWalk] = useState(false);
  const [clearedMap, setClearedMap] = useState<Record<string, Set<number>>>({});
  const [brushPulseTick, setBrushPulseTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFromTRef = useRef<number>(0);
  const animStartMsRef = useRef<number>(0);

  const { printUrls, isPreparingPrint, triggerPrint } = useTopologyAtlasPrint({
    showGhostGlyph: true,
    showWatermark: false,
    showFingerVector: true,
  });

  const isWash = themeMode === 'wash';
  const palace = useMemo(() => buildTopologicalPalace(activeKey), [activeKey]);
  const visibleStations = useMemo(
    () => (highFreqOnly ? palace.stations.filter((s) => s.tier === 'high') : palace.stations),
    [highFreqOnly, palace.stations]
  );
  const activeKeyPos = TWENTY_KEY_MORPHS.findIndex((s) => s.key === palace.key);
  const activeStation: JourneyStation = visibleStations[stationIdx] ?? visibleStations[0] ?? palace.stations[0];
  const clearedSet = clearedMap[palace.key] ?? new Set<number>();

  const goToStation = useCallback(
    (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(visibleStations.length - 1, nextIdx));
      animFromTRef.current = activeStation?.pathT ?? 0;
      animStartMsRef.current = performance.now();
      setStationIdx(clamped);
      setTypedPrefix('');
      setWrongKeyFlash(null);
    },
    [activeStation?.pathT, visibleStations.length]
  );

  const switchPalaceKey = useCallback((nextKey: string) => {
    if (!TWENTY_KEY_MORPH_BY_KEY.has(nextKey)) return;
    animFromTRef.current = 0;
    animStartMsRef.current = performance.now();
    setActiveKey(nextKey);
    setStationIdx(0);
    setTypedPrefix('');
    setWrongKeyFlash(null);
    setAutoWalk(false);
    synth.playClick();
  }, []);

  const stepPalaceKey = useCallback(
    (delta: number) => {
      const nextPos =
        (activeKeyPos + delta + TWENTY_KEY_MORPHS.length) % TWENTY_KEY_MORPHS.length;
      switchPalaceKey(TWENTY_KEY_MORPHS[nextPos].key);
    },
    [activeKeyPos, switchPalaceKey]
  );

  const resetCurrentPalace = useCallback(() => {
    setClearedMap((prev) => ({ ...prev, [palace.key]: new Set<number>() }));
    animFromTRef.current = 0;
    animStartMsRef.current = performance.now();
    setStationIdx(0);
    setTypedPrefix('');
    setWrongKeyFlash(null);
    synth.playClick();
  }, [palace.key]);

  // Auto-walk along the calligraphic brushstroke route
  useEffect(() => {
    if (!autoWalk) return;
    const timer = window.setTimeout(() => {
      const next = (stationIdx + 1) % visibleStations.length;
      goToStation(next);
    }, 1850);
    return () => window.clearTimeout(timer);
  }, [autoWalk, stationIdx, visibleStations.length, goToStation]);

  // Real physical keyboard typing along the stroke-path stations!
  // Type the active station's real Lingming code (大码 + [声码] + 韵码) directly!
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToStation((stationIdx + 1) % visibleStations.length);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToStation((stationIdx - 1 + visibleStations.length) % visibleStations.length);
        return;
      }
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (typedPrefix.length > 0) {
          e.preventDefault();
          setTypedPrefix('');
          setWrongKeyFlash(null);
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (!/^[a-z]$/.test(k)) return;
      e.preventDefault();
      if (autoWalk) setAutoWalk(false);

      const expectedCode = activeStation.ma;
      const expectedChar = expectedCode[typedPrefix.length];

      if (k === expectedChar) {
        const nextPrefix = typedPrefix + k;
        setWrongKeyFlash(null);

        if (nextPrefix.length === 1) {
          // Onset topological stroke struck! Pulse the brush path!
          setBrushPulseTick((n) => n + 1);
        }

        if (nextPrefix === expectedCode) {
          // Station completed!
          const isPalaceDone = stationIdx === visibleStations.length - 1;
          synth.playKeyHit(stationIdx + 1, isPalaceDone);
          setClearedMap((prev) => {
            const nextSet = new Set(prev[palace.key] ?? []);
            nextSet.add(activeStation.index);
            return { ...prev, [palace.key]: nextSet };
          });
          setTypedPrefix('');

          // Advance smoothly along the brush path to the next station
          const nextIdx = (stationIdx + 1) % visibleStations.length;
          animFromTRef.current = activeStation.pathT;
          animStartMsRef.current = performance.now();
          setStationIdx(nextIdx);
        } else {
          synth.playKeyHit(nextPrefix.length, false);
          setTypedPrefix(nextPrefix);
        }
      } else {
        synth.playKeyMiss();
        setWrongKeyFlash(k);
        window.setTimeout(() => {
          setWrongKeyFlash((prev) => (prev === k ? null : prev));
        }, 340);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeStation, autoWalk, goToStation, palace.key, stationIdx, typedPrefix, visibleStations.length]);

  // Living 60fps HTML5 Canvas for the Calligraphic Topological Brush Route + Traveling Brush Beacon
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 640;
    const H = 480;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const coreRgb = isWash ? '176, 46, 36' : '232, 92, 68';
    const inkRgb = isWash ? '28, 27, 24' : '238, 232, 220';

    const targetT = activeStation.pathT;
    const fromT = animFromTRef.current;
    const animStart = animStartMsRef.current || performance.now();
    const glideMs = 460;
    let rafId = 0;

    // Precompute pixel-true inked arc progress matching topologicalPalace.ts (bridges weighted 0)
    const path = palace.unifiedPath;
    const { cum, totalPx } = computeInkedArc(path);
    const pointTs = cum.map((c) => c / totalPx);

    const draw = (now: number) => {
      const rawFrac = Math.min(1, Math.max(0, (now - animStart) / glideMs));
      const eased =
        rawFrac < 0.5 ? 4 * rawFrac * rawFrac * rawFrac : 1 - Math.pow(-2 * rawFrac + 2, 3) / 2;
      const liveT = fromT + (targetT - fromT) * eased;

      ctx.clearRect(0, 0, W, H);
      drawXuanPaperBase(ctx, W, H, isWash);

      // Ultra-faint monumental master glyph watermark reinforcing the calligram silhouette
      ctx.save();
      ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.026)' : 'rgba(244, 239, 230, 0.028)';
      ctx.font = '700 290px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(palace.monumentRadical, W * 0.5, H * 0.51);
      ctx.restore();

      // 1. Delicate gossamer "牵丝" silk-thread bridges connecting strokes in calligraphic order
      ctx.save();
      ctx.strokeStyle = `rgba(${coreRgb}, 0.22)`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      let inBridge = false;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        const px = pt.x * W;
        const py = pt.y * H;
        if (pt.isBridge) {
          if (!inBridge && i > 0) {
            ctx.moveTo(path[i - 1].x * W, path[i - 1].y * H);
          }
          ctx.lineTo(px, py);
          inBridge = true;
        } else if (inBridge) {
          ctx.lineTo(px, py);
          inBridge = false;
        }
      }
      ctx.stroke();
      ctx.restore();

      // 2. Soft, broad translucent vermilion brushstroke backdrop —
      //    thick enough to cradle the borderless small radicals directly on its spine
      //    while keeping high contrast so the radicals themselves form the giant master glyph!
      const baseR = palace.isBraidedStroke ? 23 : 16.5;
      const onsetGlowBoost = typedPrefix.length >= 1 ? 0.08 : 0;

      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        if (pt.isBridge) continue;
        const ptT = pointTs[i];
        const passed = ptT <= liveT + 0.008;
        const px = pt.x * W;
        const py = pt.y * H;
        const prev = path[Math.max(0, i - 1)];
        const next = path[Math.min(path.length - 1, i + 1)];
        const ang = Math.atan2((next.y - prev.y) * H, (next.x - prev.x) * W);

        const rx = Math.max(4, baseR * (0.68 + pt.p * 0.48) * (passed ? 1.05 : 0.96));
        const ry = Math.max(3, rx * 0.72);
        const alpha = passed
          ? Math.min(0.4, (isWash ? 0.25 : 0.28) + onsetGlowBoost)
          : isWash
            ? 0.115
            : 0.135;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang * 0.35 - 0.55);
        ctx.fillStyle = `rgba(${coreRgb}, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Soft traveling brush-tip halo gliding right under the current station
      const tip = getPathPointAt(path, liveT);
      const tx = tip.x * W;
      const ty = tip.y * H;
      const haloR = typedPrefix.length >= 1 ? 34 : 26;
      const halo = ctx.createRadialGradient(tx, ty, 3, tx, ty, haloR);
      halo.addColorStop(0, `rgba(${coreRgb}, 0.42)`);
      halo.addColorStop(0.55, `rgba(${coreRgb}, 0.15)`);
      halo.addColorStop(1, `rgba(${coreRgb}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(tx, ty, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 4. Subtle calligraphic "起" (High-Freq Entry) & "收" (Low-Freq Tail) ink cues
      if (path.length > 1) {
        const startPt = path[0];
        const endPt = path[path.length - 1];
        ctx.save();
        ctx.font = '700 10px "Noto Serif SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${coreRgb}, 0.72)`;
        const sx = Math.max(38, Math.min(W - 38, startPt.x * W - 26));
        const sy = Math.max(20, Math.min(H - 20, startPt.y * H - 22));
        ctx.fillText('起·高频', sx, sy);
        ctx.fillStyle = `rgba(${inkRgb}, 0.45)`;
        const ex = Math.max(40, Math.min(W - 44, endPt.x * W + 26));
        const ey = Math.max(20, Math.min(H - 20, endPt.y * H + 22));
        ctx.fillText('收·低频', ex, ey);
        ctx.restore();
      }

      // Traditional 2-char corner seal stamp
      ctx.save();
      const sealX = W - 38;
      const sealY = H - 52;
      ctx.strokeStyle = `rgba(${coreRgb}, 0.6)`;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(sealX, sealY, 20, 32);
      ctx.fillStyle = `rgba(${coreRgb}, 0.78)`;
      ctx.font = '700 11px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(palace.spec.sealText[0], sealX + 10, sealY + 9);
      ctx.fillText(palace.spec.sealText[1], sealX + 10, sealY + 23);
      ctx.restore();

      if (rawFrac < 1) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    activeStation.pathT,
    brushPulseTick,
    isWash,
    palace.isBraidedStroke,
    palace.monumentRadical,
    palace.spec.sealText,
    palace.unifiedPath,
    typedPrefix.length,
  ]);

  const visibleClearedCount = visibleStations.filter((st) => clearedSet.has(st.index)).length;
  const palaceProgressPct = Math.round(
    (visibleClearedCount / Math.max(1, visibleStations.length)) * 100
  );

  // Determine which of the 3 cognitive steps is currently active for typing
  const daTyped = typedPrefix.length >= 1;
  const shengTyped = activeStation.shengKey ? typedPrefix.length >= 2 : daTyped;

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
              笔势行径 · 新拓扑记忆宫殿
            </h1>
            <span className="hidden 2xl:inline text-xs font-mono-tabular text-[var(--dojo-text-sub)] whitespace-nowrap">
              20 宫 · 249 简体字根 · 起势 + 声韵定驿
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isPreparingPrint}
            onClick={() => {
              synth.playClick();
              void triggerPrint();
            }}
            title="使用 A4 横向排版直接打印当前 20 键书法拓扑图谱"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--dojo-crimson)] bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] disabled:opacity-60 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>
              {isPreparingPrint ? '生成打印版中...' : '打印当前 20 键书法拓扑图谱'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onOpenMorphTheater(palace.key);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-xs font-semibold text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Feather className="w-3.5 h-3.5 text-[var(--dojo-crimson)]" />
            <span>观本键演变动画</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onOpenLegacyPalace();
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>对照旧版云图宫殿</span>
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

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT (7 cols): Xuan-Paper Topological Brush-Path Palace Map */}
          <section className="lg:col-span-7 flex flex-col">
            {/* Map Header Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="font-mono-tabular font-semibold text-[var(--dojo-crimson-text)]">
                  主形「{palace.monumentRadical}」· {palace.spec.techniqueName}
                </span>
                <span className="text-[var(--dojo-text-sub)]">
                  高频 {palace.counts.high} · 中频 {palace.counts.mid} · 低频 {palace.counts.low}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setHighFreqOnly((v) => !v);
                    setStationIdx(0);
                    setTypedPrefix('');
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    highFreqOnly
                      ? 'border-[var(--dojo-crimson)]/50 bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  {highFreqOnly ? `仅高频前 ${palace.counts.high} 驿` : `全宫 ${palace.counts.total} 驿`}
                </button>

                <button
                  type="button"
                  onClick={() => setAutoWalk((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-xs font-medium text-[var(--dojo-text)] transition-colors cursor-pointer"
                >
                  {autoWalk ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{autoWalk ? '暂停巡驿' : '沿笔巡游'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBlindMode((b) => !b)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    blindMode
                      ? 'border-[var(--dojo-crimson)]/50 bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  {blindMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{blindMode ? '盲打' : '声韵码'}</span>
                </button>

                <button
                  type="button"
                  onClick={resetCurrentPalace}
                  title="重走本宫"
                  className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Hybrid Canvas + Interactive Station Overlay */}
            <div
              className="relative w-full rounded-2xl overflow-hidden border border-[var(--dojo-border)] shadow-sm bg-[var(--dojo-surface)] select-none"
              style={{ aspectRatio: '4 / 3' }}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full block"
                aria-label={`${palace.key.toUpperCase()} 键 ${palace.spec.techniqueName} 频次顺笔记忆宫殿路线图`}
              />

              {/* Pure Borderless Calligraphic Radicals Directly Forming the Giant Master Radical Shape */}
              {visibleStations.map((st, idxInView) => {
                const isCurrent = idxInView === stationIdx;
                const isCleared = clearedSet.has(st.index);
                const dense = visibleStations.length >= 16;
                const glyphPx = Math.round((dense ? 22 : 27) * st.scale);

                return (
                  <button
                    key={`${palace.key}-${st.char}-${st.index}`}
                    type="button"
                    onClick={() => {
                      setAutoWalk(false);
                      goToStation(idxInView);
                    }}
                    title={`#${st.index + 1} ${st.char} (${st.ma.toUpperCase()}) · ${st.tierLabel}`}
                    className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                      isCurrent
                        ? 'z-30 rounded-full border-2 border-[var(--dojo-crimson)] bg-[var(--dojo-surface)]/92 shadow-md px-2.5 py-1.5 min-w-[48px] min-h-[48px] scale-110'
                        : 'z-10 hover:z-25 rounded-full border border-transparent hover:border-[var(--dojo-crimson)]/45 hover:bg-[var(--dojo-surface)]/75 px-1 py-0.5'
                    }`}
                    style={{
                      left: `${st.x * 100}%`,
                      top: `${st.y * 100}%`,
                    }}
                  >
                    {/* Tiny locus rank cue — shown only on active station or hover to keep the calligram pure */}
                    <span
                      className={`absolute -top-2 -right-2 px-1 rounded-full text-[8px] font-mono-tabular leading-tight transition-opacity ${
                        isCurrent
                          ? 'opacity-100 bg-[var(--dojo-crimson)] text-white'
                          : 'opacity-0 group-hover:opacity-100 bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)] border border-[var(--dojo-border)]'
                      }`}
                    >
                      {String(st.index + 1).padStart(2, '0')}
                    </span>

                    {/* Borderless Calligraphic Radical Glyph */}
                    <span
                      style={{ fontSize: `${glyphPx}px` }}
                      className={`font-display font-bold leading-none transition-colors ${
                        isWash
                          ? '[text-shadow:0_0_6px_rgba(252,251,247,0.92),0_0_2px_rgba(252,251,247,0.98)]'
                          : '[text-shadow:0_0_7px_rgba(12,16,25,0.94),0_0_2px_rgba(12,16,25,0.98)]'
                      } ${
                        isCurrent
                          ? 'text-[var(--dojo-crimson-text)]'
                          : isCleared
                            ? 'text-[var(--dojo-pine-text)]'
                            : st.tier === 'high'
                              ? 'text-[var(--dojo-text-bright)]'
                              : st.tier === 'mid'
                                ? 'text-[var(--dojo-text)]'
                                : 'text-[var(--dojo-text)] opacity-85'
                      }`}
                    >
                      {st.char}
                    </span>

                    {/* Ultra-tight borderless color-coded Lingming code tucked directly beneath the glyph */}
                    <span
                      className={`mt-0.5 font-mono-tabular text-[9px] sm:text-[10px] font-bold tracking-wider leading-none flex items-center gap-[0.5px] ${
                        isWash
                          ? '[text-shadow:0_0_5px_rgba(252,251,247,0.95)]'
                          : '[text-shadow:0_0_6px_rgba(12,16,25,0.95)]'
                      }`}
                    >
                      <span className="text-[var(--dojo-crimson-text)]">
                        {st.daKey.toUpperCase()}
                      </span>
                      {!blindMode || isCleared ? (
                        <>
                          {st.shengKey && (
                            <span className="text-[var(--dojo-pine-text)]">
                              {st.shengKey.toUpperCase()}
                            </span>
                          )}
                          <span className="text-[var(--dojo-ochre-text)]">
                            {st.yunKey.toUpperCase()}
                          </span>
                        </>
                      ) : (
                        <span className="text-[var(--dojo-text-sub)] opacity-55">
                          {st.shengKey ? '··' : '·'}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* RIGHT (5 cols): 3-Step Cognitive Formula Panel ("手指起势 + 声码 + 韵码") */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            {/* Palace Header + Key Stepper */}
            <div className="pb-3.5 border-b border-[var(--dojo-border)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <span className="font-mono-tabular text-4xl font-bold text-[var(--dojo-crimson-text)] leading-none">
                    {palace.key.toUpperCase()}
                  </span>
                  <h2 className="font-display text-2xl font-bold text-[var(--dojo-text-bright)] truncate">
                    {palace.spec.techniqueName}宫
                  </h2>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => stepPalaceKey(-1)}
                    aria-label="上一宫"
                    className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepPalaceKey(1)}
                    aria-label="下一宫"
                    className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-[var(--dojo-text-sub)]">
                <strong className="text-[var(--dojo-text-bright)]">
                  {palace.spec.fingerLabel} · {palace.spec.reachLabel}
                </strong>{' '}
                — 先以手指起势锁定「{palace.spec.topoInvariant}」之共性路径，再随声韵落键定字。
              </p>
            </div>

            {/* Active Station Focus Card: Direct Keyboard Entry */}
            <div className="p-4 rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono-tabular text-[var(--dojo-crimson-text)] font-semibold">
                    频次顺位 #{String(activeStation.index + 1).padStart(2, '0')} /{' '}
                    {String(visibleStations.length).padStart(2, '0')} · {activeStation.tierLabel}
                  </div>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="font-display text-5xl font-bold text-[var(--dojo-text-bright)] leading-none">
                      {activeStation.char}
                    </span>
                    <span className="text-xs text-[var(--dojo-text-sub)]">
                      {activeStation.note || (activeStation.shengKey ? '三码全拼定形' : '二码简韵速出')}
                    </span>
                  </div>
                </div>

                {/* Live typed echo */}
                <div className="text-right">
                  <div className="text-[11px] text-[var(--dojo-text-sub)]">直接敲击实体键盘</div>
                  <div
                    className={`mt-1 font-mono-tabular text-xl font-bold tracking-widest min-h-[28px] ${
                      wrongKeyFlash
                        ? 'text-[var(--dojo-crimson)]'
                        : 'text-[var(--dojo-text-bright)]'
                    }`}
                  >
                    {wrongKeyFlash
                      ? `× ${wrongKeyFlash.toUpperCase()}`
                      : typedPrefix
                        ? typedPrefix.toUpperCase()
                        : '—'}
                  </div>
                </div>
              </div>

              {/* The 3-Step Cognitive Lock Formula: 起势大码 -> 声码 -> 韵码 */}
              <div className="grid grid-cols-3 gap-2">
                {/* Step 1: Da Key (Topological Finger Onset) */}
                <div
                  className={`p-2.5 rounded-xl border transition-colors ${
                    daTyped
                      ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)]'
                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                  }`}
                >
                  <div className="text-[10px] text-[var(--dojo-text-sub)]">① 指势大码</div>
                  <div className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--dojo-crimson-text)]">
                    {activeStation.daKey.toUpperCase()}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--dojo-text-sub)] truncate">
                    {palace.spec.techniqueName}
                  </div>
                </div>

                {/* Step 2: Sheng Key (Phonetic Onset, if 3-code) */}
                <div
                  className={`p-2.5 rounded-xl border transition-colors ${
                    !activeStation.shengKey
                      ? 'border-dashed border-[var(--dojo-border)] bg-transparent opacity-65'
                      : shengTyped
                        ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                  }`}
                >
                  <div className="text-[10px] text-[var(--dojo-text-sub)]">② 声码定音</div>
                  <div className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--dojo-pine-text)]">
                    {!activeStation.shengKey
                      ? '直跃'
                      : blindMode && !shengTyped
                        ? '?'
                        : activeStation.shengKey.toUpperCase()}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--dojo-text-sub)] truncate">
                    {activeStation.shengKey ? '首音声母' : '二码免声'}
                  </div>
                </div>

                {/* Step 3: Yun Key (Vowel Final A E I O U) */}
                <div className="p-2.5 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]">
                  <div className="text-[10px] text-[var(--dojo-text-sub)]">③ 韵码落定</div>
                  <div className="mt-1 font-mono-tabular text-2xl font-bold text-[var(--dojo-ochre-text)]">
                    {blindMode ? '?' : activeStation.yunKey.toUpperCase()}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--dojo-text-sub)] truncate">
                    元音收锋
                  </div>
                </div>
              </div>

              {/* Station Journey Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[var(--dojo-text-sub)] mb-1">
                  <span>{highFreqOnly ? '高频起势通关进度' : '本宫全线通关进度'}</span>
                  <span>
                    {visibleClearedCount} / {visibleStations.length} 驿 ({palaceProgressPct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--dojo-surface-inset)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--dojo-crimson)] transition-all duration-300"
                    style={{ width: `${palaceProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Frequency-Ordered Walking Trail Roster */}
            <div className="p-3.5 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--dojo-text-bright)]">
                  顺笔频次路线（高频起笔 → 低频收锋）
                </span>
                <span className="text-[11px] text-[var(--dojo-text-sub)]">
                  ← / → 沿线移动
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {visibleStations.map((st, idxInView) => {
                  const isCurrent = idxInView === stationIdx;
                  const isCleared = clearedSet.has(st.index);
                  return (
                    <button
                      key={`trail-${st.index}`}
                      type="button"
                      onClick={() => {
                        setAutoWalk(false);
                        goToStation(idxInView);
                      }}
                      className={`inline-flex items-baseline gap-1 px-2 py-1 rounded-lg border text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] font-bold'
                          : isCleared
                            ? 'border-[var(--dojo-pine)]/45 bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)]'
                            : st.tier === 'high'
                              ? 'border-[var(--dojo-crimson)]/30 bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                              : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)]'
                      }`}
                    >
                      <span className="text-[9px] font-mono-tabular opacity-60">
                        {st.index + 1}
                      </span>
                      <span className="font-display text-sm">{st.char}</span>
                      {(!blindMode || isCleared) && (
                        <span className="font-mono-tabular text-[10px] opacity-80">
                          {st.ma.toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom 20-Palace QWERTY Selector */}
        <section
          aria-label="二十笔势宫殿切换"
          className="pt-4 border-t border-[var(--dojo-border)]"
        >
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-[var(--dojo-text-bright)]">
              二十拓扑行笔宫殿 · 点击任意辅音键切换宫殿（实体键盘专用于输入当前驿站字根码）
            </span>
            <span className="hidden sm:inline font-mono-tabular text-[var(--dojo-text-sub)]">
              数字 = 该宫简体字根驿数
            </span>
          </div>

          <div className="flex flex-col gap-1.5 select-none">
            {QWERTY_ROWS.map((row, rIdx) => (
              <div
                key={rIdx}
                className="flex justify-center gap-1 sm:gap-1.5"
                style={{
                  paddingLeft: rIdx === 1 ? '1.25rem' : rIdx === 2 ? '2.5rem' : '0',
                }}
              >
                {row.map((k) => {
                  const spec = TWENTY_KEY_MORPH_BY_KEY.get(k);
                  const isVowel = VOWELS_SET.has(k);
                  if (!spec) {
                    return (
                      <div
                        key={k}
                        className="w-[9.2%] max-w-[96px] min-w-[44px] py-1.5 px-1 rounded-lg border border-dashed border-[var(--dojo-border)]/70 bg-[var(--dojo-surface-inset)]/45 flex flex-col items-center justify-center opacity-55"
                      >
                        <span className="font-mono-tabular text-xs font-semibold text-[var(--dojo-text-sub)]">
                          {k.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-[var(--dojo-text-sub)]">
                          {isVowel ? '韵码' : '留白'}
                        </span>
                      </div>
                    );
                  }

                  const pModel = buildTopologicalPalace(k);
                  const isSelected = k === palace.key;
                  const doneCount = clearedMap[k]?.size ?? 0;
                  const allDone = doneCount > 0 && doneCount >= pModel.stations.length;

                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => switchPalaceKey(k)}
                      className={`w-[9.2%] max-w-[96px] min-w-[44px] py-1.5 px-1 rounded-lg border flex flex-col items-center justify-center transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                          : allDone
                            ? 'border-[var(--dojo-pine)]/55 bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)]'
                            : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)]'
                      }`}
                    >
                      <div className="flex items-baseline gap-1">
                        <span className="font-mono-tabular text-xs font-bold">
                          {k.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono-tabular opacity-75">
                          {pModel.counts.total}
                        </span>
                      </div>
                      <span className="mt-0.5 text-[10px] leading-tight truncate max-w-full opacity-85">
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
    <PrintableTopologySheets urls={printUrls} />
    </>
  );
};
