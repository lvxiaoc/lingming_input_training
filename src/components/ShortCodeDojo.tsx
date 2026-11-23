import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Grid2x2,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  LINGMING_CORE_50_CODES,
  LINGMING_ONE_KEY_CODES,
  LINGMING_SHORT_CODES,
  LINGMING_THREE_KEY_CODES,
  LINGMING_TWO_KEY_CODES,
  LingmingShortCodeEntry,
} from '../data/lingmingShortCodes';
import { getLingmingCharScript } from '../data/lingming';
import {
  matchesScript,
  SCRIPT_MODE_OPTIONS,
  ScriptMode,
} from '../data/scriptFilter';
import {
  recordGlyphCompletion,
  recordKeyResult,
  SchemeMasteryStore,
} from '../engine/mastery';
import { THEME_OPTIONS, ThemeMode, useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';
import {
  resolveDaSlotForShortCode,
  useKeystrokeCloud,
  useKeystrokeCloudPulse,
} from '../data/keystrokeCloud';
import { ColorSplitGlyph, getRootColor, RadicalSymbol } from './ColorSplitGlyph';
import { KeystrokeCloudToggle, KeystrokePalaceCloud } from './KeystrokePalaceCloud';

type ShortCodeTier = 'one' | 'core50' | 'two' | 'three' | 'all';

const TIER_OPTIONS: Array<{ id: ShortCodeTier; label: string; desc: string }> = [
  { id: 'one', label: '一碼直上 (5)', desc: 'A 了 · E 的 · I 是 · O 我 · U 不（最高頻 5 字一鍵上屏）' },
  { id: 'core50', label: '核心 50 速成', desc: '官推最值得優先記憶的 50 個高頻直出簡碼，記完均長直降' },
  { id: 'two', label: '二碼直上', desc: '首根大碼 ＋ 末根韻碼（無需空格，等同傳統一簡）' },
  { id: 'three', label: '三碼高頻', desc: '前兩輔音 ＋ 末根韻碼（無需空格，常用四碼字提速關鍵）' },
  { id: 'all', label: '全簡碼混測', desc: '全部一二三碼自定簡碼隨機抽測，建立無空格直出反射' },
];

const MATRIX_CONSONANTS = [
  'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm',
  'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y',
];
const MATRIX_VOWELS = ['a', 'o', 'e', 'i', 'u'];

function shuffleList<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface ShortCodeDojoProps {
  mastery: SchemeMasteryStore;
  onMasteryChange: (next: SchemeMasteryStore) => void;
  scriptMode: ScriptMode;
  onChangeScriptMode: (mode: ScriptMode) => void;
  onChangeThemeMode: (mode: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
}

export const ShortCodeDojo: React.FC<ShortCodeDojoProps> = ({
  mastery,
  onMasteryChange,
  scriptMode,
  onChangeScriptMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBack,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';

  const [tier, setTier] = useState<ShortCodeTier>('core50');
  const [rightTab, setRightTab] = useState<'inspect' | 'matrix'>('inspect');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [hintMode, setHintMode] = useState<'adaptive' | 'always' | 'blind'>('adaptive');
  const { enabled: keystrokeCloudEnabled } = useKeystrokeCloud();
  const cloudPulse = useKeystrokeCloudPulse(keystrokeCloudEnabled);
  const { trigger: triggerCloud } = cloudPulse;

  // Filter pool by tier + scriptMode (gracefully keep full tier if script filter yields too few)
  const pool = useMemo(() => {
    const base =
      tier === 'one'
        ? LINGMING_ONE_KEY_CODES
        : tier === 'core50'
          ? LINGMING_CORE_50_CODES
          : tier === 'two'
            ? LINGMING_TWO_KEY_CODES
            : tier === 'three'
              ? LINGMING_THREE_KEY_CODES
              : LINGMING_SHORT_CODES;
    if (scriptMode === 'both') return base;
    const filtered = base.filter((item) =>
      matchesScript(getLingmingCharScript(item.char), scriptMode)
    );
    return filtered.length >= 4 ? filtered : base;
  }, [tier, scriptMode]);

  const [deck, setDeck] = useState<LingmingShortCodeEntry[]>(() => {
    const base = LINGMING_CORE_50_CODES;
    return shuffleList(base).slice(0, 24);
  });
  const [cursor, setCursor] = useState(0);
  const [typed, setTyped] = useState('');
  const [hadError, setHadError] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const [rescueActive, setRescueActive] = useState(false);
  const [roundDone, setRoundDone] = useState(false);

  // Session telemetry
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctKeys, setCorrectKeys] = useState(0);
  const [totalKeys, setTotalKeys] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [weakItems, setWeakItems] = useState<LingmingShortCodeEntry[]>([]);

  const itemStartRef = useRef<number>(performance.now());
  const masteryRef = useRef<SchemeMasteryStore>(mastery);
  masteryRef.current = mastery;

  const startFreshDeck = useCallback(
    (sourcePool: LingmingShortCodeEntry[], customList?: LingmingShortCodeEntry[]) => {
      let nextDeck: LingmingShortCodeEntry[];
      if (customList && customList.length > 0) {
        nextDeck = shuffleList(customList);
      } else if (sourcePool.length <= 5) {
        // Repeat the 5 one-key chars 3 times in non-adjacent order for muscle memory
        const repeated: LingmingShortCodeEntry[] = [];
        for (let r = 0; r < 3; r++) {
          repeated.push(...shuffleList(sourcePool));
        }
        nextDeck = repeated;
      } else {
        // Weight unmastered items higher first
        const unmastered = sourcePool.filter(
          (item) => (masteryRef.current.glyphs[`sc_${item.char}`]?.level ?? 0) < 2
        );
        const mastered = sourcePool.filter(
          (item) => (masteryRef.current.glyphs[`sc_${item.char}`]?.level ?? 0) >= 2
        );
        const combined = [...shuffleList(unmastered), ...shuffleList(mastered)];
        nextDeck = combined.slice(0, Math.min(25, combined.length));
      }
      setDeck(nextDeck);
      setCursor(0);
      setTyped('');
      setHadError(false);
      setErrorFlash(false);
      setRescueActive(false);
      setRoundDone(false);
      setCombo(0);
      setMaxCombo(0);
      setCorrectKeys(0);
      setTotalKeys(0);
      setTotalMs(0);
      setCompletedCount(0);
      setWeakItems([]);
      itemStartRef.current = performance.now();
    },
    []
  );

  // Rebuild deck whenever tier or scriptMode changes
  useEffect(() => {
    startFreshDeck(pool);
  }, [pool, startFreshDeck]);

  const currentItem = deck[cursor] || null;
  const glyphId = currentItem ? `sc_${currentItem.char}` : '';
  const glyphMastery = glyphId ? mastery.glyphs[glyphId] : undefined;
  const glyphLevel = glyphMastery?.level ?? 0;

  // Compute mastery-adaptive color mix + hint visibility
  const colorMix = useMemo(() => {
    if (rescueActive || errorFlash || hadError) return 1.0;
    if (hintMode === 'always') return 1.0;
    if (hintMode === 'blind') return 0.0;
    if (glyphLevel === 0) return 1.0;
    if (glyphLevel === 1) return 0.55;
    if (glyphLevel === 2) return 0.18;
    return 0.0;
  }, [rescueActive, errorFlash, hadError, hintMode, glyphLevel]);

  const showKeyHint =
    rescueActive ||
    hadError ||
    hintMode === 'always' ||
    (hintMode === 'adaptive' && glyphLevel <= 1);

  const showRuleHint =
    rescueActive ||
    hadError ||
    hintMode === 'always' ||
    (hintMode === 'adaptive' && glyphLevel <= 2);

  // Jump directly to a specific short-code entry from the 20x5 matrix
  const focusSingleChar = useCallback((entry: LingmingShortCodeEntry) => {
    synth.playClick();
    setDeck((prev) => {
      const rest = prev.filter((x) => x.char !== entry.char);
      return [entry, ...rest];
    });
    setCursor(0);
    setTyped('');
    setHadError(false);
    setErrorFlash(false);
    setRescueActive(false);
    setRoundDone(false);
    itemStartRef.current = performance.now();
  }, []);

  // Build 20x5 matrix lookup for 2-key direct short codes
  const twoKeyMatrix = useMemo(() => {
    const map = new Map<string, LingmingShortCodeEntry>();
    for (const item of LINGMING_TWO_KEY_CODES) {
      map.set(item.shortCode, item);
    }
    return map;
  }, []);

  // Count mastered short codes in current pool
  const masteredInPool = useMemo(() => {
    return pool.filter((item) => (mastery.glyphs[`sc_${item.char}`]?.level ?? 0) >= 2).length;
  }, [pool, mastery]);

  // Global physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (inspectorOpen) {
          setInspectorOpen(false);
          itemStartRef.current = performance.now();
          return;
        }
        onBack();
        return;
      }
      if (inspectorOpen) return;
      if (roundDone) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          synth.playClick();
          startFreshDeck(pool);
        }
        return;
      }
      if (!currentItem) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        setRescueActive(true);
        synth.playClick();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setTyped((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        setTyped('');
        return;
      }
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      e.preventDefault();

      const key = e.key.toLowerCase();
      const expected = currentItem.shortCode[typed.length];
      const daSlot = resolveDaSlotForShortCode(
        currentItem.shortCode,
        currentItem.fullCode,
        currentItem.roots,
        currentItem.rootCodes,
        typed.length
      );
      setTotalKeys((n) => n + 1);

      if (key === expected) {
        const nextTyped = typed + key;
        const isComplete = nextTyped === currentItem.shortCode;
        if (daSlot) {
          triggerCloud(
            daSlot.chamberKey,
            daSlot.radical,
            'hit',
            key,
            isComplete ? 1650 : 2200
          );
        }
        setCorrectKeys((n) => n + 1);
        setErrorFlash(false);
        const now = performance.now();
        const elapsed = Math.max(80, Math.round(now - itemStartRef.current));

        if (isComplete) {
          // Completed short code!
          const nextCombo = combo + 1;
          if (cursor + 1 >= deck.length) {
            synth.playMilestone();
          } else {
            synth.playKeyHit(nextCombo, true);
          }
          setCombo(nextCombo);
          setMaxCombo((m) => Math.max(m, nextCombo));
          setTotalMs((s) => s + elapsed);
          setCompletedCount((c) => c + 1);

          // Persist mastery for this short code
          const afterKey = recordKeyResult(masteryRef.current, key, true, elapsed);
          const { nextStore } = recordGlyphCompletion(
            afterKey,
            `sc_${currentItem.char}`,
            hadError || rescueActive,
            elapsed,
            currentItem.shortCode.length
          );
          onMasteryChange(nextStore);

          if (hadError || rescueActive || elapsed > 1800) {
            setWeakItems((prev) =>
              prev.some((x) => x.char === currentItem.char) ? prev : [...prev, currentItem]
            );
          }

          if (cursor + 1 >= deck.length) {
            setRoundDone(true);
            setTyped('');
          } else {
            setCursor((c) => c + 1);
            setTyped('');
            setHadError(false);
            setRescueActive(false);
            itemStartRef.current = performance.now();
          }
        } else {
          synth.playKeyHit(combo, false);
          setTyped(nextTyped);
          const nextStore = recordKeyResult(masteryRef.current, key, true, elapsed);
          onMasteryChange(nextStore);
        }
      } else {
        // Mistyped — immediately reveal color decomposition + rule rescue!
        synth.playKeyMiss();
        setCombo(0);
        setHadError(true);
        setRescueActive(true);
        setErrorFlash(true);
        window.setTimeout(() => setErrorFlash(false), 260);
        if (daSlot) {
          triggerCloud(daSlot.chamberKey, daSlot.radical, 'miss', key, 2600);
        }
        const nextStore = recordKeyResult(masteryRef.current, expected, false, 900);
        onMasteryChange(nextStore);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    inspectorOpen,
    currentItem,
    typed,
    combo,
    hadError,
    rescueActive,
    cursor,
    deck.length,
    roundDone,
    pool,
    onBack,
    onMasteryChange,
    startFreshDeck,
    triggerCloud,
  ]);

  const accuracy = totalKeys > 0 ? Math.round((correctKeys / totalKeys) * 100) : 100;
  const avgMs = completedCount > 0 ? Math.round(totalMs / completedCount) : 0;
  const activeTierMeta = TIER_OPTIONS.find((x) => x.id === tier)!;

  const getRuleExplanation = (item: LingmingShortCodeEntry): string => {
    const saved = item.fullCode.length - item.shortCode.length;
    const lastRoot = item.roots[item.roots.length - 1] || '';
    const lastVowel = item.shortCode[item.shortCode.length - 1].toUpperCase();
    if (item.level === 1) {
      return t(`一碼元音直出：單按 ${lastVowel} 鍵無空格上屏（全碼 ${item.fullCode.toUpperCase()}，省 ${saved} 鍵）`);
    }
    if (item.level === 2) {
      return t(
        `首碼 ${item.shortCode[0].toUpperCase()} ＋ 末根「${lastRoot}」韻碼 ${lastVowel} 直出（省去全碼 ${item.fullCode.toUpperCase()} 的 ${saved} 鍵）`
      );
    }
    return t(
      `前兩碼 ${item.shortCode.slice(0, 2).toUpperCase()} ＋ 末根「${lastRoot}」韻碼 ${lastVowel} 直出（全碼 ${item.fullCode.toUpperCase()}，省 ${saved} 鍵）`
    );
  };

  const DECK_CELL_PX = 62;

  return (
    <div className="relative z-10 w-screen h-screen overflow-hidden flex flex-col bg-[var(--dojo-canvas)] wash:bg-transparent text-[var(--dojo-text)] select-none">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 border-b border-[var(--dojo-border)] bg-[var(--dojo-header)]/95 wash:bg-[#ECEAE3]/92 backdrop-blur-md flex items-center justify-between gap-3">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回')}</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-[var(--dojo-ochre)] shrink-0" />
            <h1 className="font-display text-base font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
              {t('簡碼速成')}
            </h1>
            <span className="hidden xl:inline text-xs text-[var(--dojo-text-muted)] truncate">
              · {t('無空格自定簡碼反射訓練')}
            </span>
          </div>
        </div>

        {/* Center: Tier Segmented Bar */}
        <div
          className="hidden lg:inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg"
          role="tablist"
          aria-label={t('簡碼分級')}
        >
          {TIER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={tier === opt.id}
              onClick={() => {
                synth.playClick();
                setTier(opt.id);
              }}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tier === opt.id
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
              }`}
            >
              {t(opt.label)}
            </button>
          ))}
        </div>

        {/* Right: Cloud Toggle + Reference Drawer Trigger + Script + Theme + Sound */}
        <div className="flex items-center gap-2 shrink-0">
          <KeystrokeCloudToggle compact />
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setInspectorOpen((v) => !v);
            }}
            aria-expanded={inspectorOpen}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              inspectorOpen
                ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-ochre)]'
                : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
            }`}
          >
            <Grid2x2 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{t('簡碼矩陣')}</span>
          </button>
          <div className="hidden sm:inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg">
            {SCRIPT_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeScriptMode(opt.id);
                }}
                className={`px-2 py-1 text-[11px] rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scriptMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeThemeMode(opt.id);
                }}
                className={`px-2 py-1 text-[11px] rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  themeMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={t(muted ? '開啟音效' : '靜音')}
            className="p-2 text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Mobile Tier Switcher */}
      <div className="lg:hidden px-4 pt-3 flex items-center gap-1.5 overflow-x-auto">
        {TIER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              synth.playClick();
              setTier(opt.id);
            }}
            className={`px-3 py-1.5 text-xs rounded-lg border whitespace-nowrap shrink-0 cursor-pointer ${
              tier === opt.id
                ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-ochre)] font-semibold'
                : 'bg-[var(--dojo-surface)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
            }`}
          >
            {t(opt.label)}
          </button>
        ))}
      </div>

      {/* ==================== FULL-VIEWPORT CENTERED SHORT-CODE SANCTUARY ==================== */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden flex flex-col">
        {/* Layer 1 (Ambient Mid-Background): Horizontal Depth-of-Field Short-Code Deck Stream centered on (50%, 50%) */}
        {!roundDone && deck.length > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          >
            <div
              className="absolute left-1/2 top-1/2 h-[68px]"
              style={{
                transform: `translate3d(${-(cursor * DECK_CELL_PX + DECK_CELL_PX / 2)}px, -50%, 0)`,
                transition: 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'transform',
              }}
            >
              {deck.map((entry, idx) => {
                const delta = idx - cursor;
                if (Math.abs(delta) > 11) return null;
                const isCurrentSlot = delta === 0;
                const absDelta = Math.abs(delta);

                let charOpacity = 0;
                let charBlur = 0;
                if (isCurrentSlot) {
                  charOpacity = 0;
                } else if (absDelta === 1) {
                  charOpacity = delta > 0 ? 0.34 : 0.24;
                  charBlur = 0.35;
                } else if (delta > 1) {
                  charOpacity = Math.max(0.08, 0.54 - (delta - 2) * 0.05);
                  charBlur = 0.45 + (delta - 1) * 0.22;
                } else {
                  charOpacity = Math.max(0.06, 0.38 - (absDelta - 2) * 0.045);
                  charBlur = 0.55 + (absDelta - 1) * 0.24;
                }

                return (
                  <span
                    key={`${entry.char}_${idx}`}
                    className={`absolute top-1/2 -translate-y-1/2 inline-flex items-center justify-center font-display text-[32px] sm:text-[36px] leading-none select-none transition-opacity duration-300 ${
                      delta < 0 ? 'text-[var(--dojo-pine)]' : 'text-[var(--dojo-text-sub)]'
                    }`}
                    style={{
                      left: `${idx * DECK_CELL_PX}px`,
                      width: `${DECK_CELL_PX}px`,
                      opacity: charOpacity,
                      filter: charBlur > 0.1 ? `blur(${charBlur.toFixed(1)}px)` : 'none',
                    }}
                  >
                    {entry.char}
                  </span>
                );
              })}
            </div>

            {/* Centered Radial Optical Halo Scrim */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[640px] h-[340px] sm:h-[420px]"
              style={{
                background: isWash
                  ? 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(243,241,236,0.92) 0%, rgba(243,241,236,0.62) 48%, rgba(243,241,236,0) 76%)'
                  : 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(11,15,23,0.90) 0%, rgba(11,15,23,0.58) 48%, rgba(11,15,23,0) 76%)',
              }}
            />
            {/* Soft Horizontal Edge Mist Scrims */}
            <div
              className="absolute inset-0"
              style={{
                background: isWash
                  ? 'linear-gradient(90deg, rgba(243,241,236,0.96) 0%, transparent 16%, transparent 84%, rgba(243,241,236,0.96) 100%)'
                  : 'linear-gradient(90deg, rgba(11,15,23,0.96) 0%, transparent 16%, transparent 84%, rgba(11,15,23,0.96) 100%)',
              }}
            />
          </div>
        )}

        {/* Top Floating Perimeter Bar: Unboxed Metrics & Scaffold Switcher */}
        <div className="relative z-20 px-5 sm:px-8 pt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-[var(--dojo-text-sub)]">
            <span className="text-[var(--dojo-text-bright)] font-semibold">
              {Math.min(cursor + (roundDone ? 1 : 0), deck.length)}/{deck.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('連擊')} <strong className="text-[var(--dojo-ochre)]">×{combo}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('準確')} <strong className="text-[var(--dojo-pine-text)]">{accuracy}%</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('均速')} <strong className="text-[var(--dojo-text)]">{avgMs > 0 ? `${avgMs}ms` : '--'}</strong>
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              {t('本組已熟')} {masteredInPool}/{pool.length}
            </span>
          </div>

          <div className="inline-flex items-center gap-1 p-0.5 bg-[var(--dojo-surface-inset)]/90 border border-[var(--dojo-border)] rounded-lg backdrop-blur-xs">
            {([
              ['adaptive', '熟度漸隱'],
              ['always', '始終提示'],
              ['blind', '全盲默打'],
            ] as const).map(([modeId, label]) => (
              <button
                key={modeId}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setHintMode(modeId);
                }}
                className={`px-2 py-1 text-[11px] rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  hintMode === modeId
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        {/* Layer 2 (Foreground Focal Plane): Screen-Centered Target Character (0px shift) */}
        {roundDone ? (
          <div className="relative z-20 flex-1 flex items-center justify-center px-4">
            <div className="max-w-lg w-full bg-[var(--dojo-surface)]/95 backdrop-blur-md border border-[var(--dojo-border)] rounded-2xl p-7 flex flex-col items-center text-center gap-5 shadow-xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--dojo-pine-text)]">
                <Check className="w-4 h-4" />
                <span>{t('本輪簡碼訓練完成')}</span>
              </div>
              <h2 className="font-display text-3xl font-bold text-[var(--dojo-text-bright)]">
                {t(activeTierMeta.label)}
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-6 font-mono-tabular text-sm">
                <div>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('準確率')}</div>
                  <div className="text-2xl font-bold text-[var(--dojo-pine-text)]">{accuracy}%</div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('單字均速')}</div>
                  <div className="text-2xl font-bold text-[var(--dojo-ochre)]">{avgMs}ms</div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('最高連擊')}</div>
                  <div className="text-2xl font-bold text-[var(--dojo-text-bright)]">×{maxCombo}</div>
                </div>
              </div>

              {weakItems.length > 0 && (
                <div className="max-w-lg w-full pt-4 border-t border-[var(--dojo-border)]">
                  <div className="text-xs text-[var(--dojo-text-muted)] mb-2.5">
                    {t('本輪猶豫或誤擊簡碼')}（{weakItems.length}）
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {weakItems.map((w) => (
                      <span
                        key={w.char}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] text-xs"
                      >
                        <span className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                          {w.char}
                        </span>
                        <span className="font-mono-tabular font-bold text-[var(--dojo-ochre)]">
                          {w.shortCode.toUpperCase()}
                        </span>
                        <span className="font-mono-tabular text-[10px] text-[var(--dojo-text-muted)]">
                          ← {w.fullCode.toUpperCase()}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {weakItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      startFreshDeck(pool, weakItems);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('專攻本輪生疏簡碼')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    startFreshDeck(pool);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('再來一輪（Enter）')}</span>
                </button>
              </div>
            </div>
          </div>
        ) : currentItem ? (
          <>
            {/* Whisper Meta Line quietly anchored above the centered target */}
            <div className="pointer-events-none absolute left-1/2 bottom-[calc(50%+58px)] -translate-x-1/2 z-20 flex items-center gap-2 text-xs text-[var(--dojo-text-muted)] whitespace-nowrap">
              <span className="text-[var(--dojo-ochre)] font-medium">
                {currentItem.level === 1
                  ? t('一碼直上')
                  : currentItem.level === 2
                    ? t('二碼直上')
                    : t('三碼直上')}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t(
                  glyphLevel === 0
                    ? '初識（分色引導）'
                    : glyphLevel === 1
                      ? '漸熟（淡色過渡）'
                      : glyphLevel === 2
                        ? '心印（微墨隱碼）'
                        : '純墨無痕'
                )}
              </span>
              {rescueActive && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--dojo-crimson-text)] font-medium">
                    {t('引線顯影')}
                  </span>
                </>
              )}
            </div>

            {/* Dead-Center Target Character + 100% Target-Coincident Memory Palace Cloud */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
              {keystrokeCloudEnabled && (
                <>
                  <KeystrokePalaceCloud
                    pulse={cloudPulse.pulse}
                    visible={cloudPulse.visible}
                    scriptMode={scriptMode}
                    placement="coincident"
                    size="coincident-lg"
                    className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  />
                  <KeystrokePalaceCloud
                    pulse={cloudPulse.pulse}
                    visible={cloudPulse.visible}
                    scriptMode={scriptMode}
                    placement="coincident"
                    size="coincident-sm"
                    className="sm:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                  />
                </>
              )}
              <div className="relative z-20">
                <ColorSplitGlyph
                  char={currentItem.char}
                  strokes={currentItem.strokes}
                  strokeRootIndices={currentItem.strokeRootIndices}
                  themeMode={themeMode}
                  colorMix={colorMix}
                  errorFlash={errorFlash}
                  sizeClass="w-[68px] h-[68px] sm:w-[76px] sm:h-[76px]"
                />
              </div>
            </div>

            {/* Keycode Slots & Rule Explanation anchored below the centered target */}
            <div className="absolute left-1/2 top-[calc(50%+56px)] -translate-x-1/2 z-20 flex flex-col items-center gap-3.5 w-full max-w-lg px-4">
              <div className="flex items-center gap-2.5">
                {currentItem.shortCode.split('').map((ch, idx) => {
                  const isTyped = idx < typed.length;
                  const isCurrent = idx === typed.length;
                  const isFinalVowel = idx === currentItem.shortCode.length - 1;
                  return (
                    <div
                      key={idx}
                      className={`w-11 h-13 sm:w-12 sm:h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                        isTyped
                          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)] text-[var(--dojo-pine-text)]'
                          : isCurrent && errorFlash
                            ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)]'
                            : isCurrent
                              ? 'bg-[var(--dojo-surface-2)]/95 border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                              : 'bg-[var(--dojo-surface-inset)]/88 border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                      }`}
                    >
                      <span className="font-mono-tabular text-xl font-bold uppercase leading-none">
                        {isTyped ? typed[idx] : showKeyHint ? ch : '·'}
                      </span>
                      <span className="text-[9px] mt-1 opacity-75">
                        {t(isFinalVowel ? '末韻' : idx === 0 ? '首碼' : '次碼')}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="min-h-[2.25rem] flex flex-col items-center justify-center text-center gap-1">
                {showRuleHint ? (
                  <>
                    <div className="text-xs text-[var(--dojo-text-sub)]">
                      {getRuleExplanation(currentItem)}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {currentItem.roots.map((r, rIdx) => (
                        <span
                          key={`${r}_${rIdx}`}
                          className="inline-flex items-center gap-1 font-medium"
                          style={{ color: getRootColor(rIdx, themeMode, Math.max(0.75, colorMix)) }}
                        >
                          <RadicalSymbol glyph={r} className="font-display text-sm font-bold" />
                          <span className="font-mono-tabular text-[11px] opacity-85">
                            {currentItem.rootCodes[rIdx]?.toUpperCase()}
                          </span>
                          {rIdx < currentItem.roots.length - 1 && (
                            <span className="text-[var(--dojo-text-muted)] ml-1">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-[var(--dojo-text-muted)]">
                    {t('直覺盲打中 · 按 Tab 鍵瞬時顯影分色與簡碼規則')}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Quiet Bottom Perimeter Controls */}
        <div className="absolute bottom-4 left-0 right-0 z-20 px-5 sm:px-8 flex items-center justify-between gap-3 text-xs">
          <span className="hidden sm:inline text-[11px] text-[var(--dojo-text-muted)]">
            {t(activeTierMeta.desc)}
          </span>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setRescueActive((v) => !v);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface-inset)]/90 border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap cursor-pointer backdrop-blur-xs"
            >
              {rescueActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{t('Tab 顯影')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                startFreshDeck(pool);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface-inset)]/90 border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap cursor-pointer backdrop-blur-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('換一批')}</span>
            </button>
          </div>
        </div>

        {/* On-Demand Slide-Over Reference Drawer: Short-Code Structure & 20x5 Matrix */}
        {inspectorOpen && (
          <div className="absolute inset-0 z-40 flex justify-end">
            <div
              aria-hidden="true"
              onClick={() => setInspectorOpen(false)}
              className="flex-1 bg-black/25 backdrop-blur-[1px]"
            />
            <aside className="w-full max-w-[390px] h-full bg-[var(--dojo-surface)]/96 wash:bg-[#F3F1EC]/96 backdrop-blur-md border-l border-[var(--dojo-border)] shadow-2xl p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto">
              {/* Inspector Header Switch */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--dojo-border)]">
                <div className="inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setRightTab('inspect');
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      rightTab === 'inspect'
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-semibold'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                    }`}
                  >
                    {t('簡碼構理')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setRightTab('matrix');
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      rightTab === 'matrix'
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                    }`}
                  >
                    <Grid2x2 className="w-3 h-3" />
                    <span>{t('20×5 二碼矩陣')}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
                    {pool.length}{t('字')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInspectorOpen(false)}
                    aria-label={t('關閉側欄')}
                    className="p-1 rounded-md text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {rightTab === 'inspect' ? (
                <div className="flex flex-col gap-4 text-xs">
                  <p className="text-[var(--dojo-text-sub)] leading-relaxed">
                    {t(activeTierMeta.desc)}
                  </p>

                  {/* 1-Key Quick Strip */}
                  <div>
                    <div className="text-[11px] font-medium text-[var(--dojo-text-muted)] mb-2">
                      {t('一碼五字直出（單按元音，無需空格）')}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {LINGMING_ONE_KEY_CODES.map((item) => {
                        const isMastered = (mastery.glyphs[`sc_${item.char}`]?.level ?? 0) >= 2;
                        return (
                          <button
                            key={item.char}
                            type="button"
                            onClick={() => {
                              focusSingleChar(item);
                              setInspectorOpen(false);
                            }}
                            className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                              currentItem?.char === item.char
                                ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]'
                                : isMastered
                                  ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45'
                                  : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] hover:border-[var(--dojo-border-strong)]'
                            }`}
                          >
                            <div className="font-display text-lg font-bold text-[var(--dojo-text-bright)] leading-none">
                              {item.char}
                            </div>
                            <div className="font-mono-tabular text-xs font-bold text-[var(--dojo-ochre)] mt-1">
                              {item.shortCode.toUpperCase()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Current Pool Quick Browse */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--dojo-text-muted)] mb-2">
                      <span>{t('本組簡碼速覽（點擊立即單練）')}</span>
                      <span className="font-mono-tabular">{masteredInPool}/{pool.length}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {pool.slice(0, 60).map((item) => {
                        const lvl = mastery.glyphs[`sc_${item.char}`]?.level ?? 0;
                        const active = currentItem?.char === item.char;
                        return (
                          <button
                            key={item.char}
                            type="button"
                            onClick={() => {
                              focusSingleChar(item);
                              setInspectorOpen(false);
                            }}
                            className={`px-2 py-1.5 rounded-lg border text-left transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                              active
                                ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]'
                                : lvl >= 2
                                  ? 'bg-[var(--dojo-pine-wash)]/70 border-[var(--dojo-pine)]/40'
                                  : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] hover:bg-[var(--dojo-surface-2)]'
                            }`}
                          >
                            <span className="font-display text-sm font-bold text-[var(--dojo-text-bright)]">
                              {item.char}
                            </span>
                            <span className="font-mono-tabular text-[11px] font-semibold text-[var(--dojo-ochre)]">
                              {item.shortCode.toUpperCase()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* 20x5 Official Lingming 2-Key Direct Matrix */
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">
                    {t('行＝首根輔音，列＝末根韻碼（A O E I U），點擊任一字立即檢視並專練')}
                  </div>
                  <div className="overflow-y-auto pr-1">
                    <table className="w-full text-center border-collapse font-mono-tabular text-xs">
                      <thead className="sticky top-0 bg-[var(--dojo-surface)] z-10">
                        <tr className="border-b border-[var(--dojo-border)] text-[11px] text-[var(--dojo-ochre)]">
                          <th className="py-1 font-bold text-left pl-1">{t('鍵')}</th>
                          {MATRIX_VOWELS.map((v) => (
                            <th key={v} className="py-1 font-bold uppercase">
                              {v}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MATRIX_CONSONANTS.map((c) => (
                          <tr
                            key={c}
                            className="border-b border-[var(--dojo-border)]/50 last:border-b-0"
                          >
                            <td className="py-1 pl-1 text-left font-bold uppercase text-[var(--dojo-text-sub)]">
                              {c}
                            </td>
                            {MATRIX_VOWELS.map((v) => {
                              const entry = twoKeyMatrix.get(`${c}${v}`);
                              if (!entry) {
                                return (
                                  <td
                                    key={v}
                                    className="py-1 text-[var(--dojo-text-muted)]/30"
                                  >
                                    ·
                                  </td>
                                );
                              }
                              const isCurrent = currentItem?.char === entry.char;
                              const isMastered =
                                (mastery.glyphs[`sc_${entry.char}`]?.level ?? 0) >= 2;
                              return (
                                <td key={v} className="py-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      focusSingleChar(entry);
                                      setInspectorOpen(false);
                                    }}
                                    title={`${entry.char}：簡碼 ${entry.shortCode.toUpperCase()}（全碼 ${entry.fullCode.toUpperCase()}）`}
                                    className={`w-7 h-7 rounded-md font-display text-sm font-bold transition-colors cursor-pointer ${
                                      isCurrent
                                        ? 'bg-[var(--dojo-ochre)] text-white'
                                        : isMastered
                                          ? 'bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)]'
                                          : isWash
                                            ? 'hover:bg-black/10 text-[var(--dojo-text-bright)]'
                                            : 'hover:bg-white/10 text-[var(--dojo-text-bright)]'
                                    }`}
                                  >
                                    {entry.char}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};
