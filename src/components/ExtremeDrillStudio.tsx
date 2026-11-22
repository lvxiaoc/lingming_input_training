import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ClipboardPaste,
  Eye,
  Flame,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ALL_DRILL_CHARS,
  buildChamberTargetDeck,
  buildHardSplitDeck,
  DRILL_PASSAGES,
  DrillCharEntry,
  getChamberSummaryForKey,
  getDrillEntry,
  parseTextForDrill,
} from '../data/drillLexicon';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { LINGMING_SCHEME } from '../data/schemes';
import {
  matchesScript,
  SCRIPT_MODE_OPTIONS,
  ScriptMode,
} from '../data/scriptFilter';
import { useUiText } from '../data/uiScript';
import {
  getWeakestKeys,
  recordGlyphCompletion,
  recordKeyResult,
  recordSlowPoolOutcome,
  SchemeMasteryStore,
  SLOW_POOL_GRADUATE_STREAK,
  SlowGlyphRecord,
} from '../engine/mastery';
import { synth } from '../audio/synth';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';

type DrillTab = 'passage' | 'hardsplit' | 'slowhell' | 'bottleneck';

interface ExtremeDrillStudioProps {
  mastery: SchemeMasteryStore;
  onMasteryChange: (next: SchemeMasteryStore) => void;
  scriptMode: ScriptMode;
  onChangeScriptMode: (next: ScriptMode) => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
}

interface CompletedMarker {
  index: number;
  status: 'clean' | 'slow' | 'error';
  latencyMs: number;
}

const THRESHOLD_OPTIONS = [1000, 1500, 2000] as const;

const NIGHT_ROOT_COLORS = ['#2EA87E', '#D89B3C', '#9B75C2', '#D94A38'];
const WASH_ROOT_COLORS = ['#141413', '#444440', '#6E6E68', '#96958E'];

export const ExtremeDrillStudio: React.FC<ExtremeDrillStudioProps> = ({
  mastery,
  onMasteryChange,
  scriptMode,
  onChangeScriptMode,
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBack,
}) => {
  const t = useUiText();
  const isWash = themeMode === 'wash';
  const rootColors = isWash ? WASH_ROOT_COLORS : NIGHT_ROOT_COLORS;

  const [tab, setTab] = useState<DrillTab>('passage');
  const [thresholdMs, setThresholdMs] = useState<number>(1500);
  const [passageIdx, setPassageIdx] = useState<number>(0);
  const [customText, setCustomText] = useState<string>('');
  const [usingCustomText, setUsingCustomText] = useState<boolean>(false);
  const [pasteOpen, setPasteOpen] = useState<boolean>(false);
  const [pasteDraft, setPasteDraft] = useState<string>('');
  const [bottleneckKey, setBottleneckKey] = useState<string | null>(null);
  const [deckVersion, setDeckVersion] = useState<number>(1);

  // Active typing state
  const [cursor, setCursor] = useState<number>(0);
  const [typed, setTyped] = useState<string>('');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState<number>(0);
  const [hadErrorOnChar, setHadErrorOnChar] = useState<boolean>(false);
  const [manualReveal, setManualReveal] = useState<boolean>(false);
  const [errorCue, setErrorCue] = useState<string | null>(null);
  const [imeWarning, setImeWarning] = useState<boolean>(false);
  const [inspectedChar, setInspectedChar] = useState<string | null>(null);

  // Session metrics
  const [results, setResults] = useState<Record<number, CompletedMarker>>({});
  const [combo, setCombo] = useState<number>(0);
  const [sessionSlowAdded, setSessionSlowAdded] = useState<number>(0);
  const [sessionGraduated, setSessionGraduated] = useState<number>(0);
  const [graduatedBanner, setGraduatedBanner] = useState<string | null>(null);

  const masteryRef = useRef(mastery);
  masteryRef.current = mastery;
  const charStartRef = useRef<number>(performance.now());
  const lastKeyTimeRef = useRef<number>(performance.now());
  const pasteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Slow pool filtered by active scriptMode
  const slowPool: SlowGlyphRecord[] = useMemo(() => {
    const raw = Object.values(mastery.slowGlyphs || {});
    return raw
      .filter((item) => {
        const entry = getDrillEntry(item.char);
        return !entry || matchesScript(entry.script, scriptMode);
      })
      .sort((a, b) => {
        // Prioritize error items & highest latency
        if (a.reason !== b.reason) return a.reason === 'error' ? -1 : 1;
        if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
        return b.lastLatencyMs - a.lastLatencyMs;
      });
  }, [mastery.slowGlyphs, scriptMode]);

  // Top 3 bottleneck consonant chambers
  const bottleneckKeys = useMemo(
    () => getWeakestKeys(LINGMING_SCHEME, mastery, 3, scriptMode),
    [mastery, scriptMode]
  );

  // Active passage / deck construction
  const parsedPassage = useMemo(() => {
    if (tab !== 'passage') return null;
    const p = DRILL_PASSAGES[passageIdx % DRILL_PASSAGES.length];
    const sourceText = usingCustomText && customText.trim().length > 0
      ? customText
      : scriptMode === 'simp'
        ? p.simpText
        : p.tradText;
    return parseTextForDrill(sourceText, scriptMode);
  }, [tab, passageIdx, usingCustomText, customText, scriptMode]);

  const deck: DrillCharEntry[] = useMemo(() => {
    void deckVersion; // trigger intentional reshuffle
    if (tab === 'passage') {
      return parsedPassage?.drillableEntries || [];
    }
    if (tab === 'hardsplit') {
      return buildHardSplitDeck(scriptMode, 30);
    }
    if (tab === 'bottleneck' && bottleneckKey) {
      return buildChamberTargetDeck(bottleneckKey, scriptMode, 16);
    }
    // tab === 'slowhell'
    const slowEntries = slowPool
      .map((s) => getDrillEntry(s.char))
      .filter((e): e is DrillCharEntry => Boolean(e));
    if (slowEntries.length === 0) {
      return buildHardSplitDeck(scriptMode, 16);
    }
    // Repeat/interleave up to 20 high-pressure repetitions
    const loop: DrillCharEntry[] = [];
    const targetLen = Math.max(12, Math.min(24, slowEntries.length * 3));
    for (let i = 0; i < targetLen; i++) {
      loop.push(slowEntries[i % slowEntries.length]);
    }
    return loop;
  }, [tab, parsedPassage, scriptMode, bottleneckKey, slowPool, deckVersion]);

  const pastePreview = useMemo(
    () => parseTextForDrill(pasteDraft, scriptMode),
    [pasteDraft, scriptMode]
  );

  const isFinished = deck.length > 0 && cursor >= deck.length;
  const activeEntry: DrillCharEntry | undefined = !isFinished ? deck[cursor] : undefined;

  const resetRound = useCallback(() => {
    setCursor(0);
    setTyped('');
    setElapsedMs(0);
    setConsecutiveErrors(0);
    setHadErrorOnChar(false);
    setManualReveal(false);
    setErrorCue(null);
    setResults({});
    setCombo(0);
    setSessionSlowAdded(0);
    setSessionGraduated(0);
    const now = performance.now();
    charStartRef.current = now;
    lastKeyTimeRef.current = now;
  }, []);

  // Reset round on mode/script/passage change
  useEffect(() => {
    resetRound();
  }, [tab, passageIdx, usingCustomText, customText, scriptMode, bottleneckKey, deckVersion, resetRound]);

  // Real-time latency stopwatch for the active glyph
  useEffect(() => {
    if (isFinished || !activeEntry || pasteOpen) return;
    const id = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - charStartRef.current));
    }, 60);
    return () => window.clearInterval(id);
  }, [cursor, isFinished, activeEntry, pasteOpen]);

  // Focus textarea when paste drawer opens
  useEffect(() => {
    if (pasteOpen) {
      window.setTimeout(() => pasteTextareaRef.current?.focus(), 40);
    }
  }, [pasteOpen]);

  // Effective reveal threshold: in 'hardsplit' mode, flash X-ray faster (min(thresholdMs, 950ms)) if no key typed yet
  const effectiveFlashMs = tab === 'hardsplit' && typed.length === 0
    ? Math.min(thresholdMs, 950)
    : thresholdMs;
  const isOverThreshold = elapsedMs > thresholdMs;
  const showXrayRescue =
    Boolean(activeEntry) &&
    (manualReveal || elapsedMs > effectiveFlashMs || consecutiveErrors >= 2);

  // Physical keyboard handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pasteOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPasteOpen(false);
        }
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setTyped('');
        setErrorCue(null);
        setInspectedChar(null);
        return;
      }

      if (isFinished || !activeEntry) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setDeckVersion((v) => v + 1);
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setManualReveal((prev) => !prev);
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        setTyped((prev) => prev.slice(0, -1));
        setConsecutiveErrors(0);
        setErrorCue(null);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (typed.length > 0) {
          setTyped('');
          setConsecutiveErrors(0);
          setErrorCue(null);
        }
        return;
      }

      // Resolve key a-y including Process fallback if OS IME is on
      let letter = '';
      if (/^[a-zA-Z]$/.test(e.key)) {
        letter = e.key.toLowerCase();
        if (imeWarning) setImeWarning(false);
      } else if (e.key === 'Process' && /^Key[A-Z]$/.test(e.code)) {
        letter = e.code.slice(3).toLowerCase();
        setImeWarning(true);
      } else {
        return;
      }

      if (letter === 'z') return;
      e.preventDefault();

      const now = performance.now();
      const keyDelta = Math.max(80, Math.round(now - lastKeyTimeRef.current));
      lastKeyTimeRef.current = now;

      const expected = activeEntry.code[typed.length];
      if (!expected) return;

      const isCorrect = letter === expected;
      let nextStore = recordKeyResult(masteryRef.current, expected, isCorrect, keyDelta);

      if (!isCorrect) {
        synth.playKeyMiss();
        setHadErrorOnChar(true);
        setCombo(0);
        setConsecutiveErrors((prev) => prev + 1);
        const palaceInfo = LINGMING_CHAMBER_BY_KEY[expected];
        setErrorCue(
          palaceInfo
            ? `${t('應按')} ${expected.toUpperCase()}（${palaceInfo.primaryAnchor}）`
            : `${t('應按')} ${expected.toUpperCase()}`
        );
        onMasteryChange(nextStore);
        return;
      }

      // Correct keystroke
      const nextTyped = typed + letter;
      synth.playKeyHit(combo + 1, nextTyped.length >= activeEntry.code.length);
      setConsecutiveErrors(0);
      setErrorCue(null);

      if (nextTyped.length < activeEntry.code.length) {
        setTyped(nextTyped);
        onMasteryChange(nextStore);
        return;
      }

      // Full character completed!
      const totalCharMs = Math.max(90, Math.round(now - charStartRef.current));
      const glyphHadIssue = hadErrorOnChar;

      const glyphOutcome = recordGlyphCompletion(
        nextStore,
        `drill_${activeEntry.char}`,
        glyphHadIssue,
        totalCharMs,
        activeEntry.code.length
      );
      nextStore = glyphOutcome.nextStore;

      const slowOutcome = recordSlowPoolOutcome(nextStore, {
        char: activeEntry.char,
        parts: activeEntry.parts,
        code: activeEntry.code,
        latencyMs: totalCharMs,
        hadError: glyphHadIssue,
        thresholdMs,
      });
      nextStore = slowOutcome.nextStore;
      onMasteryChange(nextStore);

      if (slowOutcome.status === 'clean') {
        setCombo((c) => c + 1);
        if (slowOutcome.graduated) {
          setSessionGraduated((g) => g + 1);
          setGraduatedBanner(`${activeEntry.char} ${t('已連續 3 次高速直出，移出慢字池')}`);
          window.setTimeout(() => setGraduatedBanner(null), 2200);
        }
      } else {
        setCombo(0);
        setSessionSlowAdded((s) => s + 1);
      }

      setResults((prev) => ({
        ...prev,
        [cursor]: {
          index: cursor,
          status: slowOutcome.status,
          latencyMs: totalCharMs,
        },
      }));

      // Advance cleanly to next glyph
      setTyped('');
      setElapsedMs(0);
      setHadErrorOnChar(false);
      setManualReveal(false);
      setErrorCue(null);
      setCursor((c) => c + 1);
      const nextNow = performance.now();
      charStartRef.current = nextNow;
      lastKeyTimeRef.current = nextNow;
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    pasteOpen,
    isFinished,
    activeEntry,
    typed,
    combo,
    hadErrorOnChar,
    cursor,
    thresholdMs,
    imeWarning,
    onMasteryChange,
    t,
  ]);

  // Session telemetry
  const completedList = useMemo(() => Object.values(results), [results]);
  const cleanCount = completedList.filter((r) => r.status === 'clean').length;
  const cleanRate = completedList.length > 0
    ? Math.round((cleanCount / completedList.length) * 100)
    : 100;
  const avgCharMs = completedList.length > 0
    ? Math.round(
        completedList.reduce((sum, r) => sum + r.latencyMs, 0) / completedList.length
      )
    : 0;

  // Displayed inspected entry (either manually clicked from slow pool or currently active target)
  const inspectedEntry: DrillCharEntry | undefined = useMemo(() => {
    if (inspectedChar) return getDrillEntry(inspectedChar);
    return activeEntry;
  }, [inspectedChar, activeEntry]);

  // Windowed passage/sequence ribbon for eye-ahead preview
  const ribbonTokens = useMemo(() => {
    if (tab === 'passage' && parsedPassage) {
      // Find token index corresponding to current drill cursor
      let centerTokIdx = parsedPassage.tokens.findIndex((tk) => tk.drillIndex === cursor);
      if (centerTokIdx === -1) centerTokIdx = Math.max(0, parsedPassage.tokens.length - 1);
      const start = Math.max(0, centerTokIdx - 14);
      const end = Math.min(parsedPassage.tokens.length, centerTokIdx + 24);
      return parsedPassage.tokens.slice(start, end);
    }
    const start = Math.max(0, cursor - 6);
    const end = Math.min(deck.length, cursor + 16);
    return deck.slice(start, end).map((entry, offset) => ({
      raw: entry.char,
      entry,
      drillIndex: start + offset,
    }));
  }, [tab, parsedPassage, deck, cursor]);

  const handleLaunchSlowHell = () => {
    synth.playClick();
    setBottleneckKey(null);
    setTab('slowhell');
    setDeckVersion((v) => v + 1);
  };

  const handleLaunchBottleneck = (key: string) => {
    synth.playClick();
    setBottleneckKey(key);
    setTab('bottleneck');
    setDeckVersion((v) => v + 1);
  };

  const handleClearSlowPool = () => {
    if (!mastery.slowGlyphs || Object.keys(mastery.slowGlyphs).length === 0) return;
    synth.playClick();
    onMasteryChange({
      ...mastery,
      slowGlyphs: {},
    });
  };

  return (
    <div className="relative z-10 w-screen h-screen bg-[var(--dojo-canvas)] wash:bg-transparent text-[var(--dojo-text)] flex flex-col overflow-hidden wash-enter">
      {/* ==================== STRICT 3-ZONE TOP BAR ==================== */}
      <header className="shrink-0 h-14 px-5 sm:px-7 bg-[var(--dojo-header)] wash:bg-[var(--dojo-header)]/88 wash:backdrop-blur-sm border-b border-[var(--dojo-border)] flex items-center justify-between gap-6 z-30">
        {/* Zone 1: Single-line brand / back */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回大廳')}</span>
          </button>
          <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
          <span className="font-display text-sm font-bold tracking-wide text-[var(--dojo-text-bright)] whitespace-nowrap shrink-0">
            {t('文心實戰室')}
          </span>
        </div>

        {/* Zone 2: Segmented mode switch + threshold + script + theme selector */}
        <nav className="hidden lg:flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]">
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setBottleneckKey(null);
                setTab('passage');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'passage'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
              }`}
            >
              {t('高頻實戰文')}
            </button>
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setBottleneckKey(null);
                setTab('hardsplit');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'hardsplit'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
              }`}
            >
              {t('難拆結構專攻')}
            </button>
            <button
              type="button"
              onClick={handleLaunchSlowHell}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === 'slowhell'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
              }`}
            >
              {t('慢字回爐精修')}
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]">
            <span className="px-2 text-[11px] text-[var(--dojo-text-muted)] whitespace-nowrap">{t('猶豫閾值')}</span>
            {THRESHOLD_OPTIONS.map((ms) => (
              <button
                key={ms}
                type="button"
                onClick={() => setThresholdMs(ms)}
                className={`px-2 py-1 text-[11px] font-mono-tabular rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  thresholdMs === ms
                    ? 'bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)] font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {(ms / 1000).toFixed(1)}s
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]">
            {SCRIPT_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeScriptMode(opt.id)}
                className={`px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scriptMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-medium'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]"
            title={t('切換視覺色調（玄墨夜練 / 宣紙水墨）')}
          >
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeThemeMode(opt.id);
                }}
                className={`px-2 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  themeMode === opt.id
                    ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={t(muted ? '開啟按鍵音效' : '關閉按鍵音效')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {slowPool.length > 0 && tab !== 'slowhell' ? (
            <button
              type="button"
              onClick={handleLaunchSlowHell}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono-tabular">
                {t('立刻清零慢字')} ({slowPool.length})
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setPasteDraft(customText);
                setPasteOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border-strong)] text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
              <span>{t('貼入自訂文段')}</span>
            </button>
          )}
        </div>
      </header>

      {/* ==================== TWO-ZONE SANDBOX BODY (68% / 32%) ==================== */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* LEFT 68% INTERACTIVE STAGE */}
        <main className="flex-1 lg:w-[68%] min-h-0 flex flex-col justify-between px-6 sm:px-10 py-5 bg-[var(--dojo-canvas)] wash:bg-transparent relative overflow-y-auto">
          {/* Mobile / Tablet compact controls (visible below lg) */}
          <div className="flex lg:hidden flex-wrap items-center gap-2 pb-3 mb-3 border-b border-[var(--dojo-border)]">
            <div className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]">
              <button
                type="button"
                onClick={() => {
                  setBottleneckKey(null);
                  setTab('passage');
                }}
                className={`px-2.5 py-1 text-xs rounded whitespace-nowrap cursor-pointer ${
                  tab === 'passage'
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-sub)]'
                }`}
              >
                {t('高頻實戰文')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBottleneckKey(null);
                  setTab('hardsplit');
                }}
                className={`px-2.5 py-1 text-xs rounded whitespace-nowrap cursor-pointer ${
                  tab === 'hardsplit'
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-sub)]'
                }`}
              >
                {t('難拆結構專攻')}
              </button>
              <button
                type="button"
                onClick={handleLaunchSlowHell}
                className={`px-2.5 py-1 text-xs rounded whitespace-nowrap cursor-pointer ${
                  tab === 'slowhell'
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-sub)]'
                }`}
              >
                {t('慢字回爐精修')}
              </button>
            </div>
            <div className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]">
              {THRESHOLD_OPTIONS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => setThresholdMs(ms)}
                  className={`px-2 py-1 text-[11px] font-mono-tabular rounded whitespace-nowrap cursor-pointer ${
                    thresholdMs === ms
                      ? 'bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)] font-semibold'
                      : 'text-[var(--dojo-text-sub)]'
                  }`}
                >
                  {(ms / 1000).toFixed(1)}s
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]">
              {SCRIPT_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeScriptMode(opt.id)}
                  className={`px-2 py-1 text-[11px] rounded whitespace-nowrap cursor-pointer ${
                    scriptMode === opt.id
                      ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                      : 'text-[var(--dojo-text-sub)]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 p-1 bg-[var(--dojo-surface)] rounded-lg border border-[var(--dojo-border)]">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    onChangeThemeMode(opt.id);
                  }}
                  className={`px-2 py-1 text-[11px] rounded whitespace-nowrap cursor-pointer ${
                    themeMode === opt.id
                      ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] font-semibold'
                      : 'text-[var(--dojo-text-sub)]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>
          </div>

          {/* Quiet Stage Sub-Bar: Unboxed Tabular Stats + Passage Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--dojo-border)]">
            <div className="flex items-center gap-2.5 text-xs text-[var(--dojo-text-sub)] font-mono-tabular">
              <span>
                {t('直出率')} <strong className="text-[var(--dojo-pine)] font-semibold">{cleanRate}%</strong>
              </span>
              <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
              <span>
                {t('均速')} <strong className="text-[var(--dojo-text)] font-semibold">{avgCharMs > 0 ? `${avgCharMs}ms` : '--'}</strong>
              </span>
              <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
              <span>
                {t('連擊')} <strong className="text-[var(--dojo-ochre)] font-semibold">{combo}x</strong>
              </span>
              <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
              <span>
                {t('進度')} <strong className="text-[var(--dojo-text)] font-semibold">{Math.min(cursor, deck.length)}/{deck.length}</strong>
              </span>
              {tab === 'bottleneck' && bottleneckKey && (
                <>
                  <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                  <span className="text-[var(--dojo-ochre)] font-medium">
                    {t('瓶頸專攻')} {bottleneckKey.toUpperCase()}（{getChamberSummaryForKey(bottleneckKey).primaryAnchor}）
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {tab === 'passage' && (
                <div className="flex items-center gap-1">
                  {DRILL_PASSAGES.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setUsingCustomText(false);
                        setPassageIdx(idx);
                      }}
                      className={`px-2.5 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        !usingCustomText && passageIdx === idx
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-medium'
                          : 'text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t(p.title.slice(0, 4))}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPasteDraft(customText);
                      setPasteOpen((o) => !o);
                    }}
                    className={`px-2.5 py-1 text-[11px] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      usingCustomText || pasteOpen
                        ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] font-medium'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                    }`}
                  >
                    {t('貼入文段')}
                  </button>
                </div>
              )}

              {(tab === 'hardsplit' || tab === 'slowhell' || tab === 'bottleneck') && (
                <button
                  type="button"
                  onClick={() => setDeckVersion((v) => v + 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('換一組')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline Custom Text Paste Drawer */}
          {pasteOpen && (
            <div className="my-4 p-4 bg-[var(--dojo-surface)] border border-[var(--dojo-border-strong)] rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--dojo-text-bright)]">
                  {t('貼入任意文章進行純鍵碼盲打跟打')}
                </span>
                <span className="text-[11px] font-mono-tabular text-[var(--dojo-text-sub)]">
                  {t('可練')} {pastePreview.drillableEntries.length} {t('字')} · {t('自動略過')}{' '}
                  {pastePreview.punctuationCount + pastePreview.skippedUnsupportedCount} {t('標點／未收錄')}
                </span>
              </div>
              <textarea
                ref={pasteTextareaRef}
                value={pasteDraft}
                onChange={(e) => setPasteDraft(e.target.value)}
                rows={4}
                placeholder={t('在此貼入想專練的文章段落、詩詞或常用筆記⋯⋯')}
                className="w-full p-3 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg text-sm text-[var(--dojo-text)] placeholder-[var(--dojo-text-muted)] focus:outline-none focus:border-[var(--dojo-ochre)] resize-none"
              />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setPasteOpen(false)}
                  className="px-3 py-1.5 text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] cursor-pointer"
                >
                  {t('取消')}
                </button>
                <button
                  type="button"
                  disabled={pastePreview.drillableEntries.length === 0}
                  onClick={() => {
                    setCustomText(pasteDraft);
                    setUsingCustomText(true);
                    setTab('passage');
                    setPasteOpen(false);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] disabled:opacity-40 text-white rounded-lg transition-colors cursor-pointer"
                >
                  {t('開始盲打')}
                </button>
              </div>
            </div>
          )}

          {/* Eye-Ahead Rolling Passage / Sequence Track */}
          {!isFinished && (
            <div className="mt-5 px-4 py-3.5 bg-[var(--dojo-surface)] border border-[var(--dojo-border)] rounded-xl">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 font-display text-lg sm:text-xl leading-relaxed tracking-wide">
                {ribbonTokens.map((tk, i) => {
                  if (tk.drillIndex === -1) {
                    return (
                      <span key={`p-${i}`} className="text-[var(--dojo-text-muted)] select-none">
                        {tk.raw}
                      </span>
                    );
                  }
                  const done = results[tk.drillIndex];
                  const isCurrent = tk.drillIndex === cursor;
                  let colorCls = 'text-[var(--dojo-text-sub)]';
                  if (done) {
                    colorCls =
                      done.status === 'clean'
                        ? 'text-[var(--dojo-pine)] opacity-85'
                        : done.status === 'slow'
                          ? 'text-[var(--dojo-ochre)] wash:text-[#6E6E68]'
                          : 'text-[var(--dojo-crimson)] wash:underline wash:decoration-dotted wash:underline-offset-4';
                  } else if (isCurrent) {
                    colorCls = 'text-[var(--dojo-text-bright)] font-bold border-b-2 border-[var(--dojo-crimson)] pb-0.5';
                  }
                  return (
                    <span key={`d-${tk.drillIndex}-${i}`} className={`${colorCls} transition-colors`}>
                      {tk.raw}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* CENTRAL FOCUS STAGE: Target Glyph + Latency Bar + In-Place X-Ray Rescue */}
          <div className="flex-1 flex flex-col items-center justify-center py-6 min-h-[280px]">
            {!isFinished && activeEntry ? (
              <div className="w-full max-w-2xl flex flex-col items-center">
                {/* Latency Bar & Explicit State Text (Dual-Coded) */}
                <div className="w-full max-w-sm mb-5">
                  <div className="flex items-center justify-between text-xs font-mono-tabular mb-1.5">
                    <span
                      className={
                        isOverThreshold
                          ? 'text-[var(--dojo-ochre)] font-medium'
                          : 'text-[var(--dojo-text-muted)]'
                      }
                    >
                      {isOverThreshold
                        ? t('猶豫超時 · 已標記慢字')
                        : `${t('直出計時')} · ${t('目標')} < ${(thresholdMs / 1000).toFixed(1)}s`}
                    </span>
                    <span
                      className={
                        isOverThreshold ? 'text-[var(--dojo-ochre)] font-semibold' : 'text-[var(--dojo-text-sub)]'
                      }
                    >
                      {elapsedMs}ms
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[var(--dojo-surface-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full transition-colors"
                      style={{
                        width: `${Math.min(100, (elapsedMs / thresholdMs) * 100)}%`,
                        backgroundColor: isOverThreshold ? 'var(--dojo-ochre)' : 'var(--dojo-pine)',
                      }}
                    />
                  </div>
                </div>

                {/* Target Character + Side-by-Side In-Place X-Ray Breakdown */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
                  <div className="flex flex-col items-center">
                    <div
                      key={`${activeEntry.char}_${cursor}`}
                      className={`wash-enter relative font-display text-8xl sm:text-[112px] leading-none font-bold select-none transition-transform duration-150 ${
                        errorCue ? 'text-[var(--dojo-crimson-text)]' : 'text-[var(--dojo-text-bright)]'
                      }`}
                    >
                      {isWash && (
                        <>
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-6 rounded-full -z-10"
                            style={{
                              background: errorCue
                                ? 'radial-gradient(circle, rgba(20, 20, 18, 0.14) 0%, transparent 70%)'
                                : 'radial-gradient(circle, rgba(20, 20, 18, 0.075) 0%, rgba(48, 48, 44, 0.035) 45%, transparent 72%)',
                            }}
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -inset-8 rounded-full -z-10 blur-[6px] ink-aura-fade"
                            style={{
                              background:
                                'radial-gradient(circle, rgba(20, 20, 18, 0.15) 0%, rgba(56, 56, 52, 0.05) 50%, transparent 76%)',
                            }}
                          />
                        </>
                      )}
                      {activeEntry.char}
                    </div>

                    {/* Blind Keycode Slots */}
                    <div className="flex items-center gap-2.5 mt-6">
                      {Array.from(activeEntry.code).map((targetChar, idx) => {
                        const typedChar = typed[idx];
                        const isFilled = idx < typed.length;
                        const isNext = idx === typed.length;
                        const revealLetter = showXrayRescue;
                        return (
                          <div
                            key={idx}
                            className={`relative w-11 h-12 rounded-lg border flex items-center justify-center font-mono-tabular text-xl font-bold uppercase transition-all ${
                              isFilled
                                ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)] text-[var(--dojo-pine-text)] wash:shadow-[0_0_14px_rgba(20,20,18,0.20)]'
                                : isNext && errorCue
                                  ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] wash:border-dashed text-[var(--dojo-crimson-text)] wash:shadow-[0_0_14px_rgba(20,20,18,0.24)]'
                                  : isNext
                                    ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-border-strong)] text-[var(--dojo-text-bright)]'
                                    : 'bg-[var(--dojo-surface)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                            }`}
                          >
                            {isWash && isFilled && (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute -inset-3 rounded-full blur-[6px] ink-aura-slow"
                                  style={{
                                    background:
                                      'radial-gradient(circle, rgba(20, 20, 18, 0.18) 0%, rgba(56, 56, 52, 0.07) 52%, transparent 78%)',
                                  }}
                                />
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute -inset-2 rounded-full blur-[3px] ink-aura-fade"
                                  style={{
                                    background:
                                      'radial-gradient(circle, rgba(20, 20, 18, 0.24) 0%, transparent 74%)',
                                  }}
                                />
                              </>
                            )}
                            {isFilled ? typedChar : revealLetter ? targetChar : '·'}
                          </div>
                        );
                      })}
                    </div>

                    {/* Wrong key cue or subtle helper */}
                    <div className="h-6 mt-3 flex items-center justify-center text-xs">
                      {errorCue ? (
                        <span className="text-[var(--dojo-crimson-text)] font-medium">
                          {t('錯鍵')} · {errorCue}
                        </span>
                      ) : imeWarning ? (
                        <span className="text-[var(--dojo-ochre)]">
                          {t('請將系統輸入法切換至英文狀態以直出字根')}
                        </span>
                      ) : (
                        <span className="text-[var(--dojo-text-muted)]">
                          {t('Tab 閃看拆法 · Space 清空當前緩衝')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* In-Place Lightning X-Ray & Split Formula (revealed on timeout, 2 errors, or Tab) */}
                  {showXrayRescue && (
                    <div className="flex flex-col items-center sm:items-start gap-3 p-4 bg-[var(--dojo-surface)] border border-[var(--dojo-border)] rounded-xl max-w-xs">
                      <div className="flex items-center justify-between w-full gap-4 text-[11px] text-[var(--dojo-text-sub)]">
                        <span className="font-medium text-[var(--dojo-ochre)]">{t('結構拆解閃視')}</span>
                        <span className="font-mono-tabular uppercase text-[var(--dojo-text)]">
                          {activeEntry.code}
                        </span>
                      </div>

                      {activeEntry.xray && (
                        <svg
                          viewBox="0 0 1024 1024"
                          className="w-28 h-28 self-center"
                          aria-label={`${activeEntry.char} ${t('筆畫拆解')}`}
                        >
                          <g transform="translate(0, 900) scale(1, -1)">
                            {activeEntry.xray.strokes.map((d, sIdx) => {
                              const targetIdx = activeEntry.xray!.targets.findIndex((tg) =>
                                tg.strokeIndices.includes(sIdx)
                              );
                              const strokeColor =
                                targetIdx >= 0
                                  ? rootColors[Math.min(targetIdx, rootColors.length - 1)]
                                  : isWash
                                    ? '#A4A39B'
                                    : '#4E5768';
                              return (
                                <path
                                  key={sIdx}
                                  d={d}
                                  fill={strokeColor}
                                  fillOpacity={targetIdx >= 0 ? 0.92 : 0.35}
                                />
                              );
                            })}
                          </g>
                        </svg>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {activeEntry.rootDetails.map((rd, idx) => {
                          const color =
                            idx === activeEntry.rootDetails.length - 1 && activeEntry.rootDetails.length > 1
                              ? rootColors[3]
                              : rootColors[Math.min(idx, 2)];
                          return (
                            <div
                              key={`${rd.radical}-${idx}`}
                              className="flex items-center gap-1.5 px-2 py-1 bg-[var(--dojo-surface-inset)] rounded-md border border-[var(--dojo-border)] text-xs"
                            >
                              <span className="font-display text-base font-bold" style={{ color }}>
                                {rd.radical}
                              </span>
                              <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-sub)] uppercase">
                                {rd.chamberKey}
                                <span className="text-[var(--dojo-text-muted)]">({rd.ma})</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Graduation celebration toast */}
                {graduatedBanner && (
                  <div className="mt-4 text-xs font-medium text-[var(--dojo-pine-text)]">
                    {graduatedBanner}
                  </div>
                )}
              </div>
            ) : (
              /* SESSION COMPLETE SUMMARY IN STAGE */
              <div className="w-full max-w-lg p-6 bg-[var(--dojo-surface)] border border-[var(--dojo-border)] rounded-xl text-center">
                <h2 className="font-display text-2xl font-bold text-[var(--dojo-text-bright)] mb-2">
                  {t('本輪實戰完成')}
                </h2>
                <p className="text-xs text-[var(--dojo-text-sub)] mb-6">
                  {t('實戰延遲與慢字紀錄已同步寫入全域熟練度')}
                </p>

                <div className="grid grid-cols-3 gap-4 py-4 border-y border-[var(--dojo-border)] mb-6 font-mono-tabular">
                  <div>
                    <div className="text-[11px] font-sans text-[var(--dojo-text-muted)] mb-1">{t('純直出率')}</div>
                    <div className="text-2xl font-bold text-[var(--dojo-pine)]">{cleanRate}%</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-sans text-[var(--dojo-text-muted)] mb-1">{t('實戰均速')}</div>
                    <div className="text-2xl font-bold text-[var(--dojo-text-bright)]">{avgCharMs}ms</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-sans text-[var(--dojo-text-muted)] mb-1">
                      {tab === 'slowhell' ? t('移出達標') : t('記為慢字')}
                    </div>
                    <div className="text-2xl font-bold text-[var(--dojo-ochre)]">
                      {tab === 'slowhell' ? sessionGraduated : sessionSlowAdded}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  {slowPool.length > 0 && tab !== 'slowhell' && (
                    <button
                      type="button"
                      onClick={handleLaunchSlowHell}
                      className="px-5 py-2.5 text-xs font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors cursor-pointer"
                    >
                      {t('立刻清零慢字')} ({slowPool.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeckVersion((v) => v + 1)}
                    className="px-5 py-2.5 text-xs font-semibold bg-[var(--dojo-surface-2)] hover:opacity-90 border border-[var(--dojo-border-strong)] text-[var(--dojo-text)] rounded-lg transition-colors cursor-pointer"
                  >
                    {t('再練一輪')}
                  </button>
                  {tab === 'passage' && !usingCustomText && (
                    <button
                      type="button"
                      onClick={() => setPassageIdx((i) => (i + 1) % DRILL_PASSAGES.length)}
                      className="px-5 py-2.5 text-xs font-semibold text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
                    >
                      {t('下一篇短文')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quiet Bottom Context Line */}
          <div className="pt-3 border-t border-[var(--dojo-border)] flex items-center justify-between text-[11px] text-[var(--dojo-text-muted)]">
            <span>
              {tab === 'passage'
                ? usingCustomText
                  ? t('自訂文段盲打模式')
                  : t(DRILL_PASSAGES[passageIdx % DRILL_PASSAGES.length].subtitle)
                : tab === 'hardsplit'
                  ? t('超時 0.95 秒自動閃現筆畫切分，逼出第一眼結構直覺')
                  : tab === 'slowhell'
                    ? t('所有超時與錯鍵字集中高頻重現，連續 3 次高速直出即移出')
                    : t('專攻單一宮殿鍵位高頻搭配字，拉低鍵間延遲')}
            </span>
            <span className="font-mono-tabular hidden sm:inline">
              {t('收錄詞庫')} {ALL_DRILL_CHARS.length} {t('字')}
            </span>
          </div>
        </main>

        {/* RIGHT 32% SLOW POOL & BOTTLENECK CHAMBER DECK (Single-Level Surface) */}
        <aside className="lg:w-[32%] lg:min-w-[320px] shrink-0 bg-[var(--dojo-surface)] wash:bg-[#EAE7DF]/86 wash:backdrop-blur-xs border-t lg:border-t-0 lg:border-l border-[var(--dojo-border)] flex flex-col min-h-0 overflow-y-auto">
          {/* Upper Section: Slow & Error Pool */}
          <section className="p-5 border-b border-[var(--dojo-border)] flex-1 min-h-[240px] flex flex-col">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-sm font-semibold text-[var(--dojo-text-bright)]">
                {t('慢字／錯字精修池')}
                <span className="ml-2 font-mono-tabular text-[var(--dojo-ochre)]">{slowPool.length}</span>
              </h2>
              {slowPool.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSlowPool}
                  className="text-[11px] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-crimson-text)] transition-colors cursor-pointer"
                >
                  {t('清空')}
                </button>
              )}
            </div>
            <p className="text-[11px] text-[var(--dojo-text-muted)] mb-3">
              {t('連續')} {SLOW_POOL_GRADUATE_STREAK} {t('次在')} {(thresholdMs / 1000).toFixed(1)}s{' '}
              {t('內無錯直出即移出')}
            </p>

            {slowPool.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-[var(--dojo-text-muted)] py-8 text-center">
                {t('目前尚無卡殼字，持續保持直出節奏')}
              </div>
            ) : (
              <div className="divide-y divide-[var(--dojo-border)] overflow-y-auto max-h-[280px]">
                {slowPool.slice(0, 12).map((item) => {
                  const isSelected = inspectedChar === item.char;
                  return (
                    <button
                      key={item.char}
                      type="button"
                      onClick={() =>
                        setInspectedChar((prev) => (prev === item.char ? null : item.char))
                      }
                      className={`w-full py-2.5 px-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--dojo-surface-2)]'
                          : 'hover:bg-[var(--dojo-surface-2)]/65'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-display text-xl font-bold text-[var(--dojo-text-bright)] w-7 text-center shrink-0">
                          {item.char}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs text-[var(--dojo-text-sub)] truncate">
                            {item.parts.join(' · ')}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-[var(--dojo-text-muted)] uppercase">
                            {item.code}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs font-mono-tabular">
                        <span
                          className={
                            item.reason === 'error'
                              ? 'text-[var(--dojo-crimson-text)] font-medium'
                              : 'text-[var(--dojo-ochre)] font-medium'
                          }
                        >
                          {item.reason === 'error' ? t('錯') : t('慢')} {item.lastLatencyMs}ms
                        </span>
                        <span className="text-[var(--dojo-text-sub)]">
                          {item.fastCleanStreak}/{SLOW_POOL_GRADUATE_STREAK}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick inline inspection of clicked slow glyph */}
            {inspectedChar && inspectedEntry && (
              <div className="mt-3 pt-3 border-t border-[var(--dojo-border)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <Eye className="w-3.5 h-3.5 text-[var(--dojo-ochre)] shrink-0" />
                  <span className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                    {inspectedEntry.char}
                  </span>
                  <span className="text-[var(--dojo-text-sub)]">
                    {inspectedEntry.rootDetails
                      .map((r) => `${r.radical}(${r.chamberKey.toUpperCase()})`)
                      .join(' + ')}
                  </span>
                </div>
                <span className="font-mono-tabular text-xs font-bold uppercase text-[var(--dojo-pine-text)]">
                  {inspectedEntry.code}
                </span>
              </div>
            )}
          </section>

          {/* Lower Section: Top 3 Bottleneck Consonant Chambers */}
          <section className="p-5 flex flex-col">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-sm font-semibold text-[var(--dojo-text-bright)]">
                {t('瓶頸字根（最慢 3 個宮殿鍵位）')}
              </h2>
              {tab === 'bottleneck' && (
                <button
                  type="button"
                  onClick={() => {
                    setBottleneckKey(null);
                    setTab('passage');
                  }}
                  className="text-[11px] text-[var(--dojo-pine-text)] hover:underline cursor-pointer"
                >
                  {t('返回短文')}
                </button>
              )}
            </div>
            <p className="text-[11px] text-[var(--dojo-text-muted)] mb-3">
              {t('點擊任一鍵位，立即抽出 16 字進行專屬拔刺快練')}
            </p>

            <div className="divide-y divide-[var(--dojo-border)]">
              {bottleneckKeys.map((wk) => {
                const isSelected = tab === 'bottleneck' && bottleneckKey === wk.key;
                const errPct = wk.attempts > 0 ? Math.round(wk.errorRate * 100) : 0;
                return (
                  <button
                    key={wk.key}
                    type="button"
                    onClick={() => handleLaunchBottleneck(wk.key)}
                    className={`w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--dojo-surface-2)]'
                        : 'hover:bg-[var(--dojo-surface-2)]/65'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border-strong)] flex items-center justify-center font-mono-tabular text-xs font-bold uppercase text-[var(--dojo-text-bright)]">
                        {wk.key}
                      </span>
                      <div>
                        <div className="text-xs font-medium text-[var(--dojo-text)]">
                          {t('主根')} {wk.primary}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[var(--dojo-text-muted)]">
                          {wk.attempts > 0
                            ? `${Math.round(wk.emaLatencyMs)}ms · ${t('錯率')} ${errPct}%`
                            : t('尚待累積樣本')}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dojo-ochre)] shrink-0">
                      <Target className="w-3 h-3" />
                      <span>{t('專攻')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
