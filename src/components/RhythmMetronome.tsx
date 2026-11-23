import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  getLast7DaysGrowthSeries,
  SchemeMasteryStore,
  TrainingScope,
} from '../engine/mastery';
import { synth } from '../audio/synth';
import { useUiText } from '../data/uiScript';
import { useThemeMode } from '../data/theme';

interface RhythmMetronomeProps {
  mastery: SchemeMasteryStore;
  liveCpm: number;
  trainingScope: TrainingScope;
  paused: boolean;
  lastStrikeTick: number;
  lastStrikeCorrect: boolean;
}

type StrikeAlignState = 'idle' | 'locked' | 'early' | 'late';

interface MetronomePlan {
  baselineCpm: number;
  targetCpm: number;
  autoBpm: number;
  keysPerChar: number;
  trendKind: 'rising' | 'steady' | 'stabilizing' | 'starter';
  sparkValues: number[];
}

const STORAGE_ENABLED = 'inkkey_metronome_enabled_v1';
const STORAGE_AUDIO = 'inkkey_metronome_audio_v1';
const STORAGE_COLLAPSED = 'inkkey_metronome_collapsed_v1';

function readBoolPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
  } catch {
    return fallback;
  }
}

function writeBoolPref(key: string, val: boolean): void {
  try {
    localStorage.setItem(key, String(val));
  } catch {
    // Ignore storage quota errors
  }
}

function deriveMetronomePlan(
  mastery: SchemeMasteryStore,
  liveCpm: number,
  trainingScope: TrainingScope
): MetronomePlan {
  const series = getLast7DaysGrowthSeries(mastery);
  const sparkValues = series.days.map((d) => d.cpm ?? 0);
  const hasCurve = series.latestCpm !== null || series.avgCpm7d !== null;

  let baselineCpm = 24;
  let trendKind: MetronomePlan['trendKind'] = 'starter';

  if (series.latestCpm !== null && series.avgCpm7d !== null) {
    baselineCpm = Math.round(series.latestCpm * 0.65 + series.avgCpm7d * 0.35);
  } else if (series.latestCpm !== null) {
    baselineCpm = series.latestCpm;
  } else if (series.avgCpm7d !== null) {
    baselineCpm = series.avgCpm7d;
  } else if (liveCpm > 0) {
    baselineCpm = Math.round(liveCpm);
  }

  let targetCpm = baselineCpm;
  if (!hasCurve) {
    trendKind = 'starter';
    targetCpm = Math.max(22, baselineCpm);
  } else if (series.cpmDelta !== null && series.cpmDelta >= 3) {
    // User's 7-day CPM curve is climbing: set a gentle +7% stretch cadence
    trendKind = 'rising';
    const boost = Math.min(8, Math.max(2, Math.round(baselineCpm * 0.07)));
    targetCpm = baselineCpm + boost;
  } else if (series.cpmDelta !== null && series.cpmDelta <= -4 && series.avgCpm7d !== null) {
    // Slight dip in recent speed: anchor on 7-day average to rebuild smooth uniformity
    trendKind = 'stabilizing';
    targetCpm = Math.max(20, series.avgCpm7d);
  } else {
    trendKind = 'steady';
    const nudge = Math.min(4, Math.max(1, Math.round(baselineCpm * 0.04)));
    targetCpm = baselineCpm + nudge;
  }

  const keysPerChar =
    trainingScope === 'da'
      ? 1.5
      : trainingScope === 'root'
        ? 2.0
        : trainingScope === 'char'
          ? 3.2
          : 2.8;

  // Blend CPM-derived stroke pace with observed keystroke latency when available
  const cpmBpm = targetCpm * keysPerChar;
  const latencyBpm =
    series.latestLatencyMs && series.latestLatencyMs >= 140 && series.latestLatencyMs <= 1600
      ? 60000 / series.latestLatencyMs
      : null;

  const blendedBpm = latencyBpm ? cpmBpm * 0.72 + latencyBpm * 0.28 : cpmBpm;
  const autoBpm = Math.max(52, Math.min(200, Math.round(blendedBpm)));

  return {
    baselineCpm,
    targetCpm: Math.max(18, Math.min(180, targetCpm)),
    autoBpm,
    keysPerChar,
    trendKind,
    sparkValues,
  };
}

export const RhythmMetronome: React.FC<RhythmMetronomeProps> = ({
  mastery,
  liveCpm,
  trainingScope,
  paused,
  lastStrikeTick,
  lastStrikeCorrect,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';

  const [enabled, setEnabled] = useState<boolean>(() => readBoolPref(STORAGE_ENABLED, true));
  const [audioTrackOn, setAudioTrackOn] = useState<boolean>(() =>
    readBoolPref(STORAGE_AUDIO, true)
  );
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readBoolPref(STORAGE_COLLAPSED, false)
  );
  const [bpmOffset, setBpmOffset] = useState<number>(0);

  const [alignState, setAlignState] = useState<StrikeAlignState>('idle');
  const [syncPct, setSyncPct] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Derived cadence from user's 7-day CPM growth curve
  const plan = useMemo(
    () => deriveMetronomePlan(mastery, liveCpm, trainingScope),
    [mastery, liveCpm, trainingScope]
  );

  const activeBpm = Math.max(44, Math.min(220, plan.autoBpm + bpmOffset));
  const activeTargetCpm = Math.max(14, Math.round(activeBpm / plan.keysPerChar));
  const beatMs = 60000 / activeBpm;

  // Refs for zero-re-render 60fps visual cadence + drift-free Web Audio lookahead
  const beatAnchorMsRef = useRef<number>(performance.now());
  const nextAudioTimeRef = useRef<number | null>(null);
  const nextBeatIndexRef = useRef<number>(0);
  const lastHandledStrikeRef = useRef<number>(0);
  const alignHistoryRef = useRef<number[]>([]);
  const strikeMarkerRef = useRef<{ ratio: number; at: number; state: StrikeAlignState }>({
    ratio: 0.5,
    at: 0,
    state: 'idle',
  });

  const orbRef = useRef<HTMLDivElement | null>(null);
  const strikeTickElRef = useRef<HTMLDivElement | null>(null);
  const notchRefs = useRef<Array<HTMLSpanElement | null>>([null, null, null, null]);

  // Respect system prefers-reduced-motion
  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mql) return;
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  // Re-anchor smoothly when BPM or active state changes
  useEffect(() => {
    beatAnchorMsRef.current = performance.now();
    nextAudioTimeRef.current = null;
    nextBeatIndexRef.current = 0;
  }, [activeBpm, enabled, paused]);

  // Drift-free lookahead scheduler for the invisible beat audio track
  useEffect(() => {
    if (!enabled || paused || !audioTrackOn) {
      nextAudioTimeRef.current = null;
      return;
    }

    const beatSec = 60 / activeBpm;
    const scheduleAheadSec = 0.09;

    // Ensure Web Audio unlocks cleanly on the player's first physical keystroke
    const unlockOnKey = () => {
      synth.getMetronomeAudioTime();
    };
    window.addEventListener('keydown', unlockOnKey, { passive: true });

    const timer = window.setInterval(() => {
      const audioNow = synth.getMetronomeAudioTime();
      if (audioNow === null) {
        // AudioContext will auto-unlock on the user's next keypress or click
        nextAudioTimeRef.current = null;
        return;
      }

      if (nextAudioTimeRef.current === null || nextAudioTimeRef.current < audioNow - 0.15) {
        // Align first audio beat cleanly to the next visual phase boundary
        const perfNow = performance.now();
        const elapsedMs = Math.max(0, perfNow - beatAnchorMsRef.current);
        const beatPos = elapsedMs / (beatSec * 1000);
        const nextIdx = Math.ceil(beatPos);
        const delaySec = Math.max(0.012, (nextIdx - beatPos) * beatSec);
        nextAudioTimeRef.current = audioNow + delaySec;
        nextBeatIndexRef.current = nextIdx;
      }

      while (nextAudioTimeRef.current < audioNow + scheduleAheadSec) {
        const beatIdx = nextBeatIndexRef.current;
        const isDownbeat = beatIdx % 4 === 0;
        synth.playMetronomeTick(isDownbeat, 1, nextAudioTimeRef.current);

        // Keep visual clock softly phase-locked to the Web Audio clock
        const deltaSec = nextAudioTimeRef.current - audioNow;
        const predictedBeatPerfMs = performance.now() + deltaSec * 1000;
        const targetAnchor = predictedBeatPerfMs - beatIdx * beatSec * 1000;
        beatAnchorMsRef.current = beatAnchorMsRef.current * 0.8 + targetAnchor * 0.2;

        nextAudioTimeRef.current += beatSec;
        nextBeatIndexRef.current += 1;
      }
    }, 25);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', unlockOnKey);
    };
  }, [enabled, paused, audioTrackOn, activeBpm]);

  // Measure real-time keystroke phase alignment against the invisible beat grid
  useEffect(() => {
    if (!enabled || paused || lastStrikeTick <= 0) return;
    if (lastStrikeTick === lastHandledStrikeRef.current) return;
    lastHandledStrikeRef.current = lastStrikeTick;

    if (!lastStrikeCorrect) {
      setAlignState('idle');
      return;
    }

    const elapsed = lastStrikeTick - beatAnchorMsRef.current;
    const rawPhase = ((elapsed % beatMs) + beatMs) % beatMs; // [0, beatMs)
    const signedOffset = rawPhase > beatMs / 2 ? rawPhase - beatMs : rawPhase; // [-beatMs/2, +beatMs/2]
    const normError = Math.min(1, Math.abs(signedOffset) / (beatMs * 0.5)); // 0 = dead on beat, 1 = off-beat
    const strikeScore = Math.max(0, Math.round((1 - normError * 0.92) * 100));

    let nextState: StrikeAlignState = 'locked';
    if (Math.abs(signedOffset) > beatMs * 0.23) {
      nextState = signedOffset < 0 ? 'early' : 'late';
    }

    const barPos = (((elapsed % (beatMs * 4)) + beatMs * 4) % (beatMs * 4)) / (beatMs * 4);
    strikeMarkerRef.current = {
      ratio: barPos,
      at: performance.now(),
      state: nextState,
    };

    const hist = alignHistoryRef.current;
    hist.push(strikeScore);
    if (hist.length > 12) hist.shift();
    const avg = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);
    setSyncPct(avg);
    setAlignState(nextState);
  }, [lastStrikeTick, lastStrikeCorrect, enabled, paused, beatMs]);

  // 60fps compositor-only animation loop for the 4-beat Zen pulse rail
  useEffect(() => {
    if (!enabled || paused || collapsed) return;
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - beatAnchorMsRef.current);
      const barDur = beatMs * 4;
      const barPhase = (elapsed % barDur) / barDur; // 0..1 across 4 beats
      const exactBeat = barPhase * 4; // 0..4

      // Update gliding luminous phase orb along the 4-beat track
      if (orbRef.current) {
        if (reducedMotion) {
          const snappedIdx = Math.floor(exactBeat) % 4;
          const pct = snappedIdx * 25;
          orbRef.current.style.left = `${pct}%`;
          orbRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
        } else {
          // Smooth travel across the 4 evenly spaced beat notches (0% -> 100%)
          const pct = (exactBeat / 4) * 100;
          const distToNearestBeat = Math.min(
            exactBeat - Math.floor(exactBeat),
            Math.ceil(exactBeat) - exactBeat
          );
          const beatBloom = Math.max(0, 1 - distToNearestBeat * 5.2);
          const scale = 1 + beatBloom * 0.34;
          orbRef.current.style.left = `${pct.toFixed(2)}%`;
          orbRef.current.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        }
      }

      // Pulse each of the 4 beat notches as phase passes through it
      for (let i = 0; i < 4; i++) {
        const el = notchRefs.current[i];
        if (!el) continue;
        let dist = Math.abs(exactBeat - i);
        if (i === 0) dist = Math.min(dist, Math.abs(exactBeat - 4));
        const glow = Math.max(0, 1 - dist * 3.4);
        const scale = 1 + glow * (i === 0 ? 0.52 : 0.36);
        el.style.transform = `scale(${scale.toFixed(3)})`;
        el.style.opacity = (0.32 + glow * 0.68).toFixed(3);
      }

      // Fade strike alignment tick over 750ms
      if (strikeTickElRef.current) {
        const age = now - strikeMarkerRef.current.at;
        if (strikeMarkerRef.current.at > 0 && age < 750) {
          const alpha = Math.pow(1 - age / 750, 1.4);
          strikeTickElRef.current.style.left = `${(strikeMarkerRef.current.ratio * 100).toFixed(2)}%`;
          strikeTickElRef.current.style.opacity = alpha.toFixed(3);
        } else {
          strikeTickElRef.current.style.opacity = '0';
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [enabled, paused, collapsed, beatMs, reducedMotion]);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    writeBoolPref(STORAGE_ENABLED, next);
    if (next) {
      // Unlock audio context immediately on user gesture
      synth.getMetronomeAudioTime();
    }
  };

  const toggleAudioTrack = () => {
    const next = !audioTrackOn;
    setAudioTrackOn(next);
    writeBoolPref(STORAGE_AUDIO, next);
    if (next) {
      synth.playMetronomeTick(true, 0.9);
    }
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeBoolPref(STORAGE_COLLAPSED, next);
  };

  const nudgeBpm = (delta: number) => {
    setBpmOffset((prev) => Math.max(-48, Math.min(60, prev + delta)));
  };

  // Build mini 7-day CPM curve sparkline SVG path
  const sparkPath = useMemo(() => {
    const vals = plan.sparkValues;
    const maxV = Math.max(30, ...vals);
    const minV = Math.min(...vals.filter((v) => v > 0), maxV);
    const span = Math.max(8, maxV - minV);
    const w = 32;
    const h = 12;
    return vals
      .map((v, idx) => {
        const x = (idx / Math.max(1, vals.length - 1)) * w;
        const norm = v > 0 ? (v - minV) / span : 0.15;
        const y = h - 1.5 - norm * (h - 3);
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [plan.sparkValues]);

  const trendLabel =
    bpmOffset !== 0
      ? t('手動微調')
      : plan.trendKind === 'rising'
        ? t('成長曲線領跑')
        : plan.trendKind === 'stabilizing'
          ? t('穩速校準')
          : plan.trendKind === 'steady'
            ? t('曲線勻速')
            : t('入門勻速');

  const alignLabel =
    alignState === 'locked'
      ? t('合拍')
      : alignState === 'early'
        ? t('略快')
        : alignState === 'late'
          ? t('略緩')
          : t('待擊鍵');

  const alignToneClass =
    alignState === 'locked'
      ? isWash
        ? 'text-[#12798F]'
        : 'text-[#4CD6E2]'
      : alignState === 'early' || alignState === 'late'
        ? 'text-[var(--dojo-ochre)]'
        : 'text-[var(--dojo-text-muted)]';

  const preventFocusSteal = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Collapsed whisper-quiet anchor in bottom-right corner
  if (collapsed) {
    return (
      <div className="pointer-events-auto absolute bottom-3 right-4 z-30">
        <button
          type="button"
          onMouseDown={preventFocusSteal}
          onClick={toggleCollapsed}
          title={t('展開節奏節拍器')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer whitespace-nowrap ${
            isWash
              ? 'bg-[#F5F2EB]/90 hover:bg-[#EFECE3] border-[#141413]/14 text-[#1C1B19] shadow-[0_4px_16px_rgba(20,20,18,0.06)]'
              : 'bg-[#0E131D]/86 hover:bg-[#141B29] border-white/10 text-[#DCE3F0] shadow-[0_6px_22px_rgba(0,0,0,0.34)]'
          }`}
        >
          <Activity
            className={`w-3.5 h-3.5 ${
              enabled
                ? isWash
                  ? 'text-[#12798F]'
                  : 'text-[#4CD6E2]'
                : 'text-[var(--dojo-text-muted)]'
            }`}
          />
          <span className="font-medium">{t('節拍器')}</span>
          <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
          <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-sub)]">
            {activeBpm} BPM
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-[var(--dojo-text-muted)]" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label={t('節奏節拍器')}
      className={`pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-24px)] rounded-xl border backdrop-blur-md transition-colors ${
        isWash
          ? 'bg-[#F6F3EC]/88 border-[#141413]/12 text-[#1A1918] shadow-[0_6px_24px_rgba(20,20,18,0.07)]'
          : 'bg-[#0D121C]/82 border-white/10 text-[#E5EAF4] shadow-[0_10px_30px_rgba(0,0,0,0.38)]'
      }`}
    >
      <div className="flex items-center gap-3 px-3.5 py-2 whitespace-nowrap">
        {/* Zone 1: CPM Growth Curve Sparkline & Auto-Derived Cadence */}
        <button
          type="button"
          onMouseDown={preventFocusSteal}
          onClick={toggleEnabled}
          title={t(enabled ? '點擊暫停節奏節拍器' : '點擊啟用節奏節拍器')}
          className="flex items-center gap-2 text-left cursor-pointer group shrink-0"
        >
          <svg
            width="32"
            height="14"
            viewBox="0 0 32 12"
            aria-hidden="true"
            className="shrink-0 overflow-visible"
          >
            <path
              d={sparkPath}
              fill="none"
              stroke={
                !enabled
                  ? isWash
                    ? 'rgba(20,20,18,0.28)'
                    : 'rgba(226,232,240,0.25)'
                  : isWash
                    ? '#12798F'
                    : '#4CD6E2'
              }
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <span
                className={
                  enabled
                    ? 'text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-muted)] line-through'
                }
              >
                {t('節拍')}
              </span>
              <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
              <span className="text-[var(--dojo-text-muted)] text-[10px]">{trendLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-[var(--dojo-text-sub)]">
              <span>
                {activeTargetCpm} {t('字/分')}
              </span>
              <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">/</span>
              <span
                className={
                  enabled
                    ? isWash
                      ? 'text-[#12798F] font-semibold'
                      : 'text-[#4CD6E2] font-semibold'
                    : 'text-[var(--dojo-text-muted)]'
                }
              >
                {activeBpm} BPM
              </span>
            </div>
          </div>
        </button>

        <span
          aria-hidden="true"
          className="h-6 w-px bg-[var(--dojo-border-strong)] shrink-0"
        />

        {/* Zone 2: 4-Beat Zen Pulse Rail + Gliding Phase Orb + Strike Alignment Tick */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="relative w-28 sm:w-36 h-6 flex items-center select-none"
            aria-hidden="true"
          >
            {/* Base hairline rail */}
            <div
              className={`w-full h-[2px] rounded-full ${
                isWash ? 'bg-[#141413]/12' : 'bg-white/12'
              }`}
            />

            {/* 4 evenly distributed beat notches (Beat 1 downbeat slightly taller/warmer) */}
            {[0, 1, 2, 3].map((idx) => (
              <span
                key={idx}
                ref={(el) => {
                  notchRefs.current[idx] = el;
                }}
                style={{ left: `${idx * 25}%` }}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
                  idx === 0
                    ? isWash
                      ? 'w-2 h-2 bg-[#B87A18]'
                      : 'w-2 h-2 bg-[#F5BA48]'
                    : isWash
                      ? 'w-1.5 h-1.5 bg-[#12798F]'
                      : 'w-1.5 h-1.5 bg-[#4CD6E2]'
                } ${enabled ? '' : 'opacity-20'}`}
              />
            ))}

            {/* Subtle barline return cap at 100% */}
            <span
              style={{ left: '100%' }}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-2 rounded-full ${
                isWash ? 'bg-[#B87A18]/30' : 'bg-[#F5BA48]/30'
              }`}
            />

            {/* Real-time strike phase marker (flashes at the exact bar position where user struck) */}
            <div
              ref={strikeTickElRef}
              style={{ left: '0%', opacity: 0 }}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full pointer-events-none ${
                alignState === 'locked'
                  ? isWash
                    ? 'bg-[#12798F]'
                    : 'bg-[#54E0EC]'
                  : 'bg-[var(--dojo-ochre)]'
              }`}
            />

            {/* Gliding phase orb */}
            {enabled && (
              <div
                ref={orbRef}
                style={{ left: '0%', transform: 'translate(-50%, -50%)' }}
                className={`absolute top-1/2 w-2.5 h-2.5 rounded-full pointer-events-none ${
                  isWash
                    ? 'bg-[#12798F] shadow-[0_0_8px_rgba(18,121,143,0.45)]'
                    : 'bg-[#54E0EC] shadow-[0_0_10px_rgba(84,224,236,0.65)]'
                }`}
              />
            )}
          </div>

          {/* Live Beat-Sync Alignment Telemetry (clean unboxed text) */}
          <div className="hidden md:flex items-baseline gap-1.5 text-[11px] font-mono-tabular min-w-[72px]">
            <span className={`font-sans font-medium ${alignToneClass}`}>{alignLabel}</span>
            {syncPct !== null && (
              <span className="text-[var(--dojo-text-sub)]">{syncPct}%</span>
            )}
          </div>
        </div>

        <span
          aria-hidden="true"
          className="h-6 w-px bg-[var(--dojo-border-strong)] shrink-0"
        />

        {/* Zone 3: Fine-Tune Pace & Invisible Beat Track Audio Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onMouseDown={preventFocusSteal}
            onClick={() => nudgeBpm(-6)}
            title={t('放緩節拍 (-6 BPM)')}
            aria-label={t('放緩節拍')}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
          >
            <Minus className="w-3 h-3" />
          </button>

          {bpmOffset !== 0 && (
            <button
              type="button"
              onMouseDown={preventFocusSteal}
              onClick={() => setBpmOffset(0)}
              title={t('恢復依 CPM 成長曲線自動配速')}
              aria-label={t('恢復自動配速')}
              className="w-6 h-6 flex items-center justify-center rounded text-[var(--dojo-ochre)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onMouseDown={preventFocusSteal}
            onClick={() => nudgeBpm(6)}
            title={t('加快節拍 (+6 BPM)')}
            aria-label={t('加快節拍')}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>

          <button
            type="button"
            onMouseDown={preventFocusSteal}
            onClick={toggleAudioTrack}
            title={t(
              audioTrackOn
                ? '隱形節拍聲軌：開啟（極輕微檀木拍點，點擊靜音僅保留視覺脈衝）'
                : '隱形節拍聲軌：已靜音（點擊開啟輕微拍點聲軌）'
            )}
            aria-label={t(audioTrackOn ? '關閉隱形節拍聲軌' : '開啟隱形節拍聲軌')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              audioTrackOn && enabled
                ? isWash
                  ? 'bg-[#12798F]/12 text-[#12798F]'
                  : 'bg-[#4CD6E2]/14 text-[#6CE6F0]'
                : 'text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)] hover:bg-[var(--dojo-surface-2)]'
            }`}
          >
            {audioTrackOn && enabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{t('聲軌')}</span>
          </button>

          <button
            type="button"
            onMouseDown={preventFocusSteal}
            onClick={toggleCollapsed}
            title={t('收合節拍器至右下角')}
            aria-label={t('收合節拍器')}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
