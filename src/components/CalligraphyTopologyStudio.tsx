import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CALLIGRAPHY_GESTURE_BY_KEY,
  CALLIGRAPHY_GESTURES,
  CALLIGRAPHY_PRACTICE_PHRASES,
  CalligraphyGestureSpec,
} from '../data/calligraphyTopology';
import { encodeLingmingRoots, LINGMING_ROOT_MAP } from '../data/lingming';
import { runKineticSimulation } from '../data/kineticCodeSystem';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { synth } from '../audio/synth';
import { CalligraphyInkCanvas, InkTraceGhost } from './CalligraphyInkCanvas';

interface CalligraphyTopologyStudioProps {
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
}

type StudioMode = 'gallery' | 'practice' | 'free';

const QWERTY_ROWS: Array<Array<{ key: string; hand: 'L' | 'R' }>> = [
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

interface PracticeCharModel {
  char: string;
  parts: string[];
  code: string; // e.g. 'hrle'
  roles: string[]; // 'da' | 'xiao' | ...
  consonantGestures: CalligraphyGestureSpec[];
}

// Compact Finger-Reach Vector Compass SVG (links ASDF/JKL; finger travel direction to brush energy)
const FingerReachCompass: React.FC<{
  gesture: CalligraphyGestureSpec;
}> = ({ gesture }) => {
  const { dx, dy } = gesture.reachVector;
  const cx = 36;
  const cy = 36;
  const len = 21;
  const tx = cx + dx * len;
  const ty = cy + dy * len;
  const isHome = dx === 0 && dy === 0;

  return (
    <div className="flex items-center gap-3">
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        className="shrink-0 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]"
        aria-hidden="true"
      >
        {/* Crosshair */}
        <line
          x1="12"
          y1="36"
          x2="60"
          y2="36"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeDasharray="2 3"
        />
        <line
          x1="36"
          y1="12"
          x2="36"
          y2="60"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeDasharray="2 3"
        />
        {/* Home baseline ring */}
        <circle
          cx={cx}
          cy={cy}
          r={isHome ? 13 : 4}
          fill={isHome ? 'var(--dojo-crimson-wash)' : 'none'}
          stroke="var(--dojo-crimson)"
          strokeWidth={isHome ? 1.8 : 1.2}
          strokeOpacity={isHome ? 0.9 : 0.45}
        />
        {isHome ? (
          <circle cx={cx} cy={cy} r="4.5" fill="var(--dojo-crimson)" />
        ) : (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={tx}
              y2={ty}
              stroke="var(--dojo-crimson)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx={tx} cy={ty} r="4" fill="var(--dojo-crimson)" />
          </>
        )}
      </svg>
      <div className="space-y-0.5 text-xs">
        <div className="font-medium text-[var(--dojo-text-bright)]">
          {gesture.fingerLabel} · {gesture.reachLabel}
        </div>
        <div className="text-[var(--dojo-text-muted)]">
          相对标准位 {gesture.hand === 'L' ? 'ASDF' : 'JKL;'}
        </div>
      </div>
    </div>
  );
};

export const CalligraphyTopologyStudio: React.FC<CalligraphyTopologyStudioProps> = ({
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBack,
}) => {
  const [studioMode, setStudioMode] = useState<StudioMode>('gallery');

  // === Gallery Mode State ===
  const [activeKey, setActiveKey] = useState<string>('r');
  const [playTick, setPlayTick] = useState(1);
  const [slowMotion, setSlowMotion] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [autoTour, setAutoTour] = useState(false);

  const activeGesture = CALLIGRAPHY_GESTURE_BY_KEY.get(activeKey) ?? CALLIGRAPHY_GESTURES[0];

  // === Practice Mode (临帖行气) Data & State ===
  const charSplitMap = useMemo(() => {
    const sim = runKineticSimulation(
      'three_row_dir8',
      'bidirectional',
      'full1448',
      'simp',
      'yuhao',
      'event_stream'
    );
    const map = new Map<string, string[]>();
    for (const c of sim.chars) map.set(c.char, c.parts);
    return map;
  }, []);

  const [phraseIdx, setPhraseIdx] = useState(0);
  const currentPhrase = CALLIGRAPHY_PRACTICE_PHRASES[phraseIdx];

  const practiceModels = useMemo<PracticeCharModel[]>(() => {
    return currentPhrase.chars.map((ch) => {
      const parts = charSplitMap.get(ch) ?? [ch];
      const enc = encodeLingmingRoots(parts);
      const code = enc?.code ?? parts.map((p) => LINGMING_ROOT_MAP.get(p)?.chamberKey ?? 'f').join('');
      const roles = enc?.roles ?? code.split('').map((k) => (VOWELS_SET.has(k) ? 'xiao' : 'da'));
      const consonantGestures: CalligraphyGestureSpec[] = [];
      for (const p of parts) {
        const ck = LINGMING_ROOT_MAP.get(p)?.chamberKey;
        const g = ck ? CALLIGRAPHY_GESTURE_BY_KEY.get(ck) : undefined;
        if (g) consonantGestures.push(g);
      }
      return { char: ch, parts, code, roles, consonantGestures };
    });
  }, [charSplitMap, currentPhrase.chars]);

  const [practiceCharIdx, setPracticeCharIdx] = useState(0);
  const [practiceStepIdx, setPracticeStepIdx] = useState(0);
  const [practiceGesture, setPracticeGesture] = useState<CalligraphyGestureSpec | null>(
    () => practiceModels[0]?.consonantGestures[0] ?? CALLIGRAPHY_GESTURES[0]
  );
  const [practicePlayTick, setPracticePlayTick] = useState(1);
  const [practiceGhosts, setPracticeGhosts] = useState<InkTraceGhost[]>([]);
  const [vowelPulseTick, setVowelPulseTick] = useState(0);
  const [vowelLabel, setVowelLabel] = useState<string | null>(null);
  const [mistakeKey, setMistakeKey] = useState<string | null>(null);
  const [lastStruckKey, setLastStruckKey] = useState<string | null>(null);

  const practiceDone = practiceCharIdx >= practiceModels.length;
  const activePracticeModel = practiceDone ? null : practiceModels[practiceCharIdx];

  // === Free Brush Mode (自由挥毫) State ===
  const [freeGesture, setFreeGesture] = useState<CalligraphyGestureSpec | null>(
    CALLIGRAPHY_GESTURE_BY_KEY.get('f') ?? CALLIGRAPHY_GESTURES[0]
  );
  const [freePlayTick, setFreePlayTick] = useState(1);
  const [freeGhosts, setFreeGhosts] = useState<InkTraceGhost[]>([]);
  const [freeHistory, setFreeHistory] = useState<CalligraphyGestureSpec[]>([]);
  const traceIdRef = useRef(1);

  const resetPractice = useCallback(
    (nextIdx?: number) => {
      const targetIdx = typeof nextIdx === 'number' ? nextIdx : phraseIdx;
      if (typeof nextIdx === 'number') setPhraseIdx(nextIdx);
      setPracticeCharIdx(0);
      setPracticeStepIdx(0);
      setPracticeGhosts([]);
      setMistakeKey(null);
      setVowelLabel(null);
      // Preview first gesture of first character
      const firstChar = CALLIGRAPHY_PRACTICE_PHRASES[targetIdx]?.chars[0];
      const parts = firstChar ? charSplitMap.get(firstChar) ?? [firstChar] : [];
      const ck = parts[0] ? LINGMING_ROOT_MAP.get(parts[0])?.chamberKey : 'h';
      setPracticeGesture((ck && CALLIGRAPHY_GESTURE_BY_KEY.get(ck)) || CALLIGRAPHY_GESTURES[0]);
      setPracticePlayTick((n) => n + 1);
    },
    [charSplitMap, phraseIdx]
  );

  // Auto-tour timer in Gallery mode
  useEffect(() => {
    if (studioMode !== 'gallery' || !autoTour) return;
    const intervalMs = slowMotion ? 2100 : 1350;
    const timer = window.setInterval(() => {
      setActiveKey((prev) => {
        const idx = CALLIGRAPHY_GESTURES.findIndex((g) => g.key === prev);
        const next = CALLIGRAPHY_GESTURES[(idx + 1) % CALLIGRAPHY_GESTURES.length];
        return next.key;
      });
      setPlayTick((n) => n + 1);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [autoTour, slowMotion, studioMode]);

  const flashKey = useCallback((k: string) => {
    setLastStruckKey(k);
    window.setTimeout(() => {
      setLastStruckKey((prev) => (prev === k ? null : prev));
    }, 170);
  }, []);

  const triggerGalleryKey = useCallback(
    (key: string) => {
      const g = CALLIGRAPHY_GESTURE_BY_KEY.get(key);
      if (!g) return;
      setAutoTour(false);
      setActiveKey(key);
      setPlayTick((n) => n + 1);
      flashKey(key);
      synth.playKeyHit(0, false);
    },
    [flashKey]
  );

  const pushGhost = useCallback(
    (
      prev: InkTraceGhost[],
      incoming: CalligraphyGestureSpec | null
    ): InkTraceGhost[] => {
      if (!incoming) return prev;
      const next: InkTraceGhost[] = [
        ...prev.slice(-2).map((item, idx, arr) => ({
          ...item,
          offsetX: item.offsetX - 0.055,
          opacity: idx === arr.length - 1 ? 0.14 : 0.07,
        })),
        {
          id: traceIdRef.current++,
          gesture: incoming,
          offsetX: -0.045,
          opacity: 0.24,
        },
      ];
      return next;
    },
    []
  );

  const handleKeyInput = useCallback(
    (rawKey: string) => {
      const key = rawKey.toLowerCase();
      if (!/^[a-z]$/.test(key)) return;

      if (studioMode === 'gallery') {
        if (CALLIGRAPHY_GESTURE_BY_KEY.has(key)) {
          triggerGalleryKey(key);
        }
        return;
      }

      if (studioMode === 'free') {
        flashKey(key);
        const g = CALLIGRAPHY_GESTURE_BY_KEY.get(key);
        if (g) {
          synth.playKeyHit(0, false);
          setFreeGhosts((prev) => pushGhost(prev, freeGesture));
          setFreeGesture(g);
          setFreePlayTick((n) => n + 1);
          setFreeHistory((prev) => [...prev.slice(-11), g]);
        } else if (VOWELS_SET.has(key)) {
          synth.playClick();
          setVowelLabel(key);
          setVowelPulseTick((n) => n + 1);
        }
        return;
      }

      // === Practice Mode (临帖行气) ===
      if (practiceDone || !activePracticeModel) return;
      const expected = activePracticeModel.code[practiceStepIdx];
      if (!expected) return;

      flashKey(key);
      if (key === expected) {
        setMistakeKey(null);
        const isLastStepOfChar = practiceStepIdx + 1 >= activePracticeModel.code.length;
        synth.playKeyHit(0, isLastStepOfChar);

        const g = CALLIGRAPHY_GESTURE_BY_KEY.get(key);
        if (g) {
          setPracticeGhosts((prev) => pushGhost(prev, practiceGesture));
          setPracticeGesture(g);
          setPracticePlayTick((n) => n + 1);
        } else if (VOWELS_SET.has(key)) {
          setVowelLabel(key);
          setVowelPulseTick((n) => n + 1);
        }

        if (isLastStepOfChar) {
          const nextCharIdx = practiceCharIdx + 1;
          setPracticeCharIdx(nextCharIdx);
          setPracticeStepIdx(0);
          if (nextCharIdx < practiceModels.length) {
            // Keep ghost continuity across characters of the phrase
          }
        } else {
          setPracticeStepIdx((s) => s + 1);
        }
      } else {
        synth.playKeyMiss();
        setMistakeKey(key);
        window.setTimeout(() => {
          setMistakeKey((prev) => (prev === key ? null : prev));
        }, 260);
      }
    },
    [
      activePracticeModel,
      flashKey,
      freeGesture,
      practiceCharIdx,
      practiceDone,
      practiceGesture,
      practiceModels.length,
      practiceStepIdx,
      pushGhost,
      studioMode,
      triggerGalleryKey,
    ]
  );

  // Physical keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.isContentEditable)
      ) {
        return;
      }

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleKeyInput(e.key);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (studioMode === 'gallery') {
          setPlayTick((n) => n + 1);
        } else if (studioMode === 'free') {
          setFreeGhosts([]);
          setFreeHistory([]);
        }
      } else if (e.key === 'Enter' && studioMode === 'practice' && practiceDone) {
        e.preventDefault();
        resetPractice((phraseIdx + 1) % CALLIGRAPHY_PRACTICE_PHRASES.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyInput, phraseIdx, practiceDone, resetPractice, studioMode]);

  const expectedPracticeKey =
    studioMode === 'practice' && activePracticeModel && !practiceDone
      ? activePracticeModel.code[practiceStepIdx]
      : null;

  return (
    <div className="relative z-10 w-full h-full flex flex-col bg-[var(--dojo-canvas)] text-[var(--dojo-text)] overflow-hidden">
      {/* ==================== TOP BAR (Strict 3-Zone Contract) ==================== */}
      <header className="shrink-0 h-14 px-6 sm:px-10 border-b border-[var(--dojo-border)] bg-[var(--dojo-header)]/95 backdrop-blur-sm flex items-center justify-between gap-8">
        {/* Zone 1: Back + Wordmark */}
        <div className="flex items-center gap-4 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回道场</span>
          </button>
          <span aria-hidden="true" className="text-[var(--dojo-border-strong)]">
            /
          </span>
          <span className="font-display text-base font-bold tracking-wide text-[var(--dojo-text-bright)] whitespace-nowrap shrink-0">
            二十笔势
          </span>
        </div>

        {/* Zone 2: 3 Quiet Mode Tabs */}
        <nav aria-label="书法拓扑运指模式" className="flex items-center gap-6 text-sm font-medium">
          {(
            [
              { id: 'gallery', label: '逐键观势' },
              { id: 'practice', label: '临帖行气' },
              { id: 'free', label: '自由挥毫' },
            ] as const
          ).map((tab) => {
            const active = studioMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setAutoTour(false);
                  setStudioMode(tab.id);
                }}
                className={`relative py-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {tab.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--dojo-crimson)]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme + Sound Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="纸墨色系"
            className="hidden sm:inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]"
          >
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeThemeMode(opt.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  {opt.short}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? '开启运笔音效' : '静音'}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* ==================== MAIN WORKSPACE ==================== */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-7 space-y-6">
          {/* ==================== MODE 1: 逐键观势 (20-KEY BRUSH GALLERY) ==================== */}
          {studioMode === 'gallery' && (
            <section
              aria-label="二十键书法笔势动画剧场"
              className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 sm:p-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8 items-center">
                {/* Left Focal Anchor: Living Ink Brush Canvas */}
                <div className="flex flex-col items-center gap-3.5">
                  <CalligraphyInkCanvas
                    gesture={activeGesture}
                    playTick={playTick}
                    speedMultiplier={slowMotion ? 0.48 : 1.0}
                    themeMode={themeMode}
                    showGuide={showGuide}
                    size={320}
                  />

                  {/* Quiet Playback Controls */}
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setPlayTick((n) => n + 1);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:border-[var(--dojo-border-strong)] text-[var(--dojo-text)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>重演 (Space)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setSlowMotion((s) => !s);
                        setPlayTick((n) => n + 1);
                      }}
                      className={`px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        slowMotion
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] font-medium'
                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {slowMotion ? '慢观 0.5×' : '常速 1×'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setShowGuide((g) => !g);
                      }}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        showGuide
                          ? 'border-[var(--dojo-border-strong)] bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)]'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>笔序</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setAutoTour((t) => !t);
                      }}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        autoTour
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson)] text-white'
                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text)] hover:border-[var(--dojo-border-strong)]'
                      }`}
                    >
                      {autoTour ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>{autoTour ? '暂停巡礼' : '巡礼 20 势'}</span>
                    </button>
                  </div>
                </div>

                {/* Right Editorial Typography & Topological Notes */}
                <div className="space-y-6 min-w-0">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-xs font-mono-tabular text-[var(--dojo-text-muted)]">
                      <span>
                        {activeGesture.key.toUpperCase()} 键大码
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {activeGesture.row === 'top'
                          ? '上排抬指起势'
                          : activeGesture.row === 'home'
                            ? '中排原位立骨'
                            : '下排缩指收锋'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>拓扑 {activeGesture.topoSymbol}</span>
                    </div>

                    <div className="flex items-baseline gap-4">
                      <h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--dojo-text-bright)] tracking-wider">
                        {activeGesture.techniqueName}
                      </h1>
                      <span className="font-display text-2xl text-[var(--dojo-ochre)]">
                        {activeGesture.primaryAnchor}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base leading-relaxed text-[var(--dojo-text)]">
                    {activeGesture.brushEssence}
                  </p>

                  <FingerReachCompass gesture={activeGesture} />

                  {/* Unified Topological Essence + Simplified Radicals */}
                  <div className="pt-4 border-t border-[var(--dojo-border)] space-y-3">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="text-[var(--dojo-text-sub)]">
                        拓扑共性：{activeGesture.topoBrief}
                      </span>
                      <span className="font-mono-tabular text-[var(--dojo-text-muted)] shrink-0">
                        {activeGesture.simpRadicals.length} 个简体字根
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 font-display text-xl text-[var(--dojo-text-bright)]">
                      {activeGesture.simpRadicals.map((rad, idx) => (
                        <span
                          key={rad}
                          className={`px-2.5 py-1 rounded-md border ${
                            idx === 0
                              ? 'border-[var(--dojo-crimson)]/50 bg-[var(--dojo-crimson-wash)] text-[var(--dojo-text-bright)] font-bold'
                              : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]'
                          }`}
                        >
                          {rad}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-[var(--dojo-text-muted)]">
                    直接敲击实体键盘任意辅音键（Q–P / S–L / X–M），即时观摩对应笔势运笔。
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ==================== MODE 2: 临帖行气 (LIVE LINGMING CALLIGRAPHY TYPING) ==================== */}
          {studioMode === 'practice' && (
            <section
              aria-label="临帖行气实时打字生墨"
              className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 sm:p-8 space-y-6"
            >
              {/* Phrase Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--dojo-border)]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {CALLIGRAPHY_PRACTICE_PHRASES.map((ph, idx) => (
                    <button
                      key={ph.id}
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        resetPractice(idx);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        idx === phraseIdx
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {ph.title}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    resetPractice();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] rounded-md border border-[var(--dojo-border)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>重临本帖</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 items-center">
                {/* Left: Living Multi-Stroke Running-Script Ink Canvas */}
                <div className="flex flex-col items-center gap-2.5">
                  <CalligraphyInkCanvas
                    gesture={practiceGesture}
                    playTick={practicePlayTick}
                    speedMultiplier={1.15}
                    themeMode={themeMode}
                    showGuide={false}
                    ghostTraces={practiceGhosts}
                    vowelPulseTick={vowelPulseTick}
                    vowelLabel={vowelLabel}
                    size={308}
                  />
                  <div className="text-xs text-[var(--dojo-text-muted)]">
                    {practiceGesture
                      ? `当下笔势：${practiceGesture.key.toUpperCase()} · ${practiceGesture.techniqueName}`
                      : '敲击实体键盘起笔生墨'}
                  </div>
                </div>

                {/* Right: Scroll of 4 Characters + Real Lingming Brush Choreography */}
                <div className="space-y-6 min-w-0">
                  <p className="text-xs text-[var(--dojo-text-sub)]">
                    {currentPhrase.subtitle}
                  </p>

                  {/* 4-Character Scroll Strip */}
                  <div className="flex items-center gap-5 sm:gap-7">
                    {practiceModels.map((model, idx) => {
                      const done = idx < practiceCharIdx;
                      const current = idx === practiceCharIdx;
                      return (
                        <div
                          key={`${currentPhrase.id}-${idx}`}
                          className={`flex flex-col items-center gap-2 transition-opacity ${
                            current
                              ? 'opacity-100'
                              : done
                                ? 'opacity-90'
                                : 'opacity-40'
                          }`}
                        >
                          <span
                            className={`font-display text-5xl sm:text-6xl leading-none pb-1.5 ${
                              current
                                ? 'text-[var(--dojo-text-bright)] border-b-2 border-[var(--dojo-crimson)]'
                                : 'text-[var(--dojo-text-bright)]'
                            }`}
                          >
                            {model.char}
                          </span>
                          <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                            {model.code.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Step-by-Step Lingming Brush Choreography */}
                  {!practiceDone && activePracticeModel ? (
                    <div className="space-y-3 pt-4 border-t border-[var(--dojo-border)]">
                      <div className="text-xs text-[var(--dojo-text-sub)]">
                        「{activePracticeModel.char}」拆根：{activePracticeModel.parts.join(' · ')}
                        <span aria-hidden="true" className="mx-2 text-[var(--dojo-text-muted)]">
                          ·
                        </span>
                        大码挥毫成势，元音小码润墨收气
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {activePracticeModel.code.split('').map((k, sIdx) => {
                          const typed = sIdx < practiceStepIdx;
                          const isCurr = sIdx === practiceStepIdx;
                          const g = CALLIGRAPHY_GESTURE_BY_KEY.get(k);
                          const isVowel = VOWELS_SET.has(k);

                          return (
                            <div
                              key={sIdx}
                              className={`rounded-lg px-3 py-2.5 border transition-colors ${
                                typed
                                  ? 'border-[var(--dojo-pine)]/45 bg-[var(--dojo-pine-wash)]'
                                  : isCurr
                                    ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-surface-inset)]'
                                    : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]/60'
                              }`}
                            >
                              <div className="flex items-baseline justify-between">
                                <span
                                  className={`font-mono-tabular text-lg font-bold ${
                                    typed
                                      ? 'text-[var(--dojo-pine-text)]'
                                      : isCurr
                                        ? 'text-[var(--dojo-text-bright)]'
                                        : 'text-[var(--dojo-text-sub)]'
                                  }`}
                                >
                                  {k.toUpperCase()}
                                </span>
                                <span className="text-[11px] text-[var(--dojo-text-muted)]">
                                  {g ? g.topoSymbol : '润'}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-[var(--dojo-text-bright)] truncate">
                                {g ? g.techniqueName : isVowel ? '润墨收气' : '辅码'}
                              </div>
                              <div className="text-[11px] text-[var(--dojo-text-muted)] truncate">
                                {g ? `${g.fingerLabel}·${g.reachLabel}` : '音托小码'}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {mistakeKey && (
                        <div className="text-xs text-[var(--dojo-crimson-text)]">
                          误触 {mistakeKey.toUpperCase()}，请按{' '}
                          {expectedPracticeKey?.toUpperCase()} 延续笔势
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-4">
                      <div className="text-sm text-[var(--dojo-text-bright)]">
                        「{currentPhrase.title}」行气圆满 · 按 Enter 临写下一帖。
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          resetPractice((phraseIdx + 1) % CALLIGRAPHY_PRACTICE_PHRASES.length);
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        下一帖
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ==================== MODE 3: 自由挥毫 (OPEN BRUSH SANDBOX) ==================== */}
          {studioMode === 'free' && (
            <section
              aria-label="自由挥毫宣纸画布"
              className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 sm:p-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8 items-center">
                <div className="flex flex-col items-center gap-3">
                  <CalligraphyInkCanvas
                    gesture={freeGesture}
                    playTick={freePlayTick}
                    speedMultiplier={1.1}
                    themeMode={themeMode}
                    showGuide={false}
                    ghostTraces={freeGhosts}
                    vowelPulseTick={vowelPulseTick}
                    vowelLabel={vowelLabel}
                    size={320}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setFreeGhosts([]);
                      setFreeHistory([]);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>换一张新宣纸 (Space)</span>
                  </button>
                </div>

                <div className="space-y-5 min-w-0">
                  <div className="space-y-1.5">
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--dojo-text-bright)]">
                      自由挥毫 · 十指即狼毫
                    </h1>
                    <p className="text-sm text-[var(--dojo-text-sub)]">
                      随意敲击键盘上的 20 个大码键，感受上排扬锋、中排立骨、下排回锋的连绵墨迹；敲击元音 A E I O U 可落一滴润墨收气。
                    </p>
                  </div>

                  {freeGesture && (
                    <div className="py-3 border-y border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-[var(--dojo-text-muted)]">当前落笔</div>
                        <div className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]">
                          {freeGesture.key.toUpperCase()} · {freeGesture.techniqueName}
                        </div>
                      </div>
                      <FingerReachCompass gesture={freeGesture} />
                    </div>
                  )}

                  {/* Running-Script Choreography Trail */}
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--dojo-text-muted)]">
                      刚刚走过的笔势序列
                    </div>
                    {freeHistory.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
                        {freeHistory.map((item, idx) => (
                          <React.Fragment key={idx}>
                            {idx > 0 && (
                              <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">
                                →
                              </span>
                            )}
                            <span className="font-display text-[var(--dojo-text-bright)]">
                              {item.techniqueName}
                              <span className="ml-1 font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                                {item.key.toUpperCase()}
                              </span>
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--dojo-text-muted)]">
                        试着连敲 G M（藏锋回环 → 磔锋外趯）或 H L（平顶垂露 → 悬针贯立）。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ==================== INTERACTIVE 20-BRUSH QWERTY DECK ==================== */}
          <section
            aria-label="二十笔势实体键位图"
            className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-5 sm:p-6 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--dojo-text-muted)]">
              <span>上排起势扬锋 · 中排沉落立骨 · 下排缩指收锋</span>
              <span>点击或直接按键触发运笔动画 · A E I O U 为灵明润墨小码</span>
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="min-w-[650px] flex flex-col gap-2">
                {QWERTY_ROWS.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    className="flex items-center justify-center gap-1.5"
                    style={{
                      paddingLeft: rIdx === 1 ? '18px' : rIdx === 2 ? '40px' : '0px',
                    }}
                  >
                    {row.map((cell, cIdx) => {
                      const g = CALLIGRAPHY_GESTURE_BY_KEY.get(cell.key);
                      const isVowel = VOWELS_SET.has(cell.key);
                      const isSelectedGallery =
                        studioMode === 'gallery' && activeKey === cell.key;
                      const isExpectedPractice = expectedPracticeKey === cell.key;
                      const isStruck = lastStruckKey === cell.key;
                      const isMistake = mistakeKey === cell.key;
                      const addCenterGap =
                        cIdx > 0 && row[cIdx - 1].hand === 'L' && cell.hand === 'R';

                      return (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => handleKeyInput(cell.key)}
                          disabled={!g && !isVowel}
                          style={{ marginLeft: addCenterGap ? '18px' : undefined }}
                          className={`keycap-surface w-[58px] h-[54px] rounded-lg border flex flex-col items-center justify-center select-none ${
                            !g && !isVowel
                              ? 'border-dashed border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]/35 text-[var(--dojo-text-muted)]/40 cursor-default'
                              : isMistake
                                ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] scale-95 cursor-pointer'
                                : isSelectedGallery || isExpectedPractice
                                  ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson)] text-white shadow-sm cursor-pointer'
                                  : isStruck
                                    ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)] scale-95 cursor-pointer'
                                    : isVowel
                                      ? 'border-dashed border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]/60 text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)] cursor-pointer'
                                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:border-[var(--dojo-border-strong)] text-[var(--dojo-text)] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-baseline gap-1 leading-none">
                            <span className="font-mono-tabular text-xs font-bold">
                              {cell.key.toUpperCase()}
                            </span>
                            {g && (
                              <span
                                className={`text-[11px] ${
                                  isSelectedGallery || isExpectedPractice
                                    ? 'text-white/85'
                                    : 'text-[var(--dojo-ochre)]'
                                }`}
                              >
                                {g.primaryAnchor}
                              </span>
                            )}
                          </div>
                          <span
                            className={`mt-1 text-[10px] leading-none truncate max-w-[50px] ${
                              isSelectedGallery || isExpectedPractice
                                ? 'text-white/95'
                                : 'text-[var(--dojo-text-muted)]'
                            }`}
                          >
                            {g
                              ? g.techniqueName.slice(0, 2)
                              : isVowel
                                ? '润墨'
                                : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
