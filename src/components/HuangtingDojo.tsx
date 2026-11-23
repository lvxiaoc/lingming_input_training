import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Layers,
  List,
  RotateCcw,
  ScrollText,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  HUANGTING_CHAPTERS,
  HUANGTING_CHAR_MAP,
  HuangtingCharInfo,
} from '../data/huangtingjing';
import {
  recordGlyphCompletion,
  recordKeyResult,
  SchemeMasteryStore,
} from '../engine/mastery';
import { THEME_OPTIONS, ThemeMode, useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';
import { ColorSplitGlyph, getRootColor, RadicalSymbol } from './ColorSplitGlyph';

type ScriptureScript = 'trad' | 'simp';
type FadeMode = 'adaptive' | 'always' | 'blind';
type HuangtingViewMode = 'depth' | 'desk';

interface HuangtingLogStore {
  chapterClears: Record<number, number>;
  dailyDate: string;
  dailyChars: number;
  dailyChapters: number;
  lastChapterId: number;
}

const LOG_STORAGE_KEY = 'lingming_huangting_log_v1';
const VIEW_MODE_STORAGE_KEY = 'lingming_huangting_view_v1';
const DEPTH_CELL_PX = 68;
const DEPTH_ROW_PX = 104;

// Mastery-adaptive hesitation delay before hints gently fade in ("犹豫之后渐显")
function getHesitationDelayMs(level: number): number {
  if (level <= 0) return 1100;
  if (level === 1) return 1600;
  if (level === 2) return 2100;
  return 2600;
}

function loadViewMode(): HuangtingViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (raw === 'desk' || raw === 'depth') return raw;
  } catch {
    // ignore storage errors
  }
  return 'depth';
}

function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadHuangtingLog(): HuangtingLogStore {
  const today = getTodayKey();
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HuangtingLogStore>;
      const sameDay = parsed.dailyDate === today;
      return {
        chapterClears: parsed.chapterClears || {},
        dailyDate: today,
        dailyChars: sameDay ? parsed.dailyChars ?? 0 : 0,
        dailyChapters: sameDay ? parsed.dailyChapters ?? 0 : 0,
        lastChapterId: parsed.lastChapterId ?? 1,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    chapterClears: {},
    dailyDate: today,
    dailyChars: 0,
    dailyChapters: 0,
    lastChapterId: 1,
  };
}

function saveHuangtingLog(log: HuangtingLogStore): void {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // ignore quota errors
  }
}

interface VerseToken {
  char: string;
  isTypable: boolean;
  typableIdx: number; // -1 for punctuation
  info?: HuangtingCharInfo;
}

function tokenizeChapterText(text: string): {
  tokens: VerseToken[];
  typableChars: Array<{ char: string; tokenIdx: number; info: HuangtingCharInfo }>;
} {
  const chars = Array.from(text);
  const tokens: VerseToken[] = [];
  const typableChars: Array<{ char: string; tokenIdx: number; info: HuangtingCharInfo }> = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const info = HUANGTING_CHAR_MAP[ch];
    if (info && info.code) {
      const typableIdx = typableChars.length;
      tokens.push({ char: ch, isTypable: true, typableIdx, info });
      typableChars.push({ char: ch, tokenIdx: i, info });
    } else {
      tokens.push({ char: ch, isTypable: false, typableIdx: -1 });
    }
  }
  return { tokens, typableChars };
}

/** Split tokens into classical couplet lines (ending on 。) for serene chanting cadence */
function groupIntoLines(tokens: VerseToken[]): VerseToken[][] {
  const lines: VerseToken[][] = [];
  let cur: VerseToken[] = [];
  for (const tok of tokens) {
    cur.push(tok);
    if (tok.char === '。') {
      lines.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

interface TakenRootSpan {
  /** Index range [start, end) inside `rootCode` that is actually taken into the full character code */
  matchStart: number;
  matchEnd: number;
  /** Index range [codeStart, codeEnd) inside the character's full `code` */
  codeStart: number;
  codeEnd: number;
}

/**
 * Computes which exact letters of each root's own code (`rootCodes[i]`) are taken
 * into the character's official Lingming full `code` (e.g. 玉: 王 ya -> Y, 丶 tu -> TU => YTU).
 */
function computeTakenRootSpans(code: string, rootCodes: string[]): TakenRootSpan[] {
  const n = rootCodes.length;
  if (n === 0) return [];
  const r = rootCodes.map((x) => (x || '').toLowerCase());
  const c = (code || '').toLowerCase();

  type Candidate = Array<{ start: number; end: number }>;
  const buildFromLens = (lens: number[]): Candidate =>
    lens.map((len, i) => ({ start: 0, end: Math.min(len, r[i].length) }));

  const candidates: Candidate[] = [];
  if (n === 1) {
    candidates.push(buildFromLens([r[0].length]));
  } else if (n === 2) {
    candidates.push(buildFromLens([1, r[1].length]));
    candidates.push(buildFromLens([2, 2]));
    candidates.push(buildFromLens([2, 1]));
  } else if (n === 3) {
    candidates.push(buildFromLens([1, 1, 2]));
    candidates.push(buildFromLens([2, 1, 1]));
    candidates.push(buildFromLens([1, 2, 1]));
    // Edge case where 3rd root contributes its final vowel (e.g. 暉 hrbe: hri + bi + kce)
    if (r[2].length >= 1) {
      candidates.push([
        { start: 0, end: Math.min(2, r[0].length) },
        { start: 0, end: Math.min(1, r[1].length) },
        { start: r[2].length - 1, end: r[2].length },
      ]);
    }
  } else {
    const last = n - 1;
    // 1st root 2 consonants + 2nd root 1st + last root 1st
    candidates.push(
      r.map((rc, i) => ({
        start: 0,
        end: i === 0 ? Math.min(2, rc.length) : i === 1 || i === last ? Math.min(1, rc.length) : 0,
      }))
    );
    // 1st, 2nd, 3rd, last each 1st key
    candidates.push(
      r.map((rc, i) => ({
        start: 0,
        end: i <= 2 || i === last ? Math.min(1, rc.length) : 0,
      }))
    );
    // 1st 1, 2nd 2, last 1
    candidates.push(
      r.map((rc, i) => ({
        start: 0,
        end: i === 1 ? Math.min(2, rc.length) : i === 0 || i === last ? Math.min(1, rc.length) : 0,
      }))
    );
  }

  for (const cand of candidates) {
    const joined = cand.map((sp, i) => r[i].slice(sp.start, sp.end)).join('');
    if (joined === c) {
      let offset = 0;
      return cand.map((sp) => {
        const len = sp.end - sp.start;
        const out: TakenRootSpan = {
          matchStart: sp.start,
          matchEnd: sp.end,
          codeStart: offset,
          codeEnd: offset + len,
        };
        offset += len;
        return out;
      });
    }
  }

  // Safe fallback if a rare override doesn't match standard templates
  return r.map((rc) => ({ matchStart: 0, matchEnd: rc.length, codeStart: -1, codeEnd: -1 }));
}

interface HuangtingDojoProps {
  mastery: SchemeMasteryStore;
  onMasteryChange: (next: SchemeMasteryStore) => void;
  defaultScript: ScriptureScript;
  onChangeThemeMode: (mode: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
}

export const HuangtingDojo: React.FC<HuangtingDojoProps> = ({
  mastery,
  onMasteryChange,
  defaultScript,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBack,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';

  const [log, setLog] = useState<HuangtingLogStore>(() => loadHuangtingLog());
  const [chapterId, setChapterId] = useState<number>(() => {
    const initial = loadHuangtingLog().lastChapterId;
    return initial >= 1 && initial <= HUANGTING_CHAPTERS.length ? initial : 1;
  });
  const [script, setScript] = useState<ScriptureScript>(defaultScript);
  const [viewMode, setViewMode] = useState<HuangtingViewMode>(() => loadViewMode());
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false);
  const [fadeMode, setFadeMode] = useState<FadeMode>('adaptive');
  const [allowShortCode, setAllowShortCode] = useState<boolean>(true);
  const [weakDrillChars, setWeakDrillChars] = useState<string[] | null>(null);

  const handleChangeViewMode = useCallback((next: HuangtingViewMode) => {
    synth.playClick();
    setViewMode(next);
    setChapterDrawerOpen(false);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Typing cursor & live states
  const [cursor, setCursor] = useState(0);
  const [typed, setTyped] = useState('');
  const [hadError, setHadError] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);
  const [rescueActive, setRescueActive] = useState(false);
  const [hesitationRescue, setHesitationRescue] = useState(false);
  const [chapterDone, setChapterDone] = useState(false);
  const [lastUsedShort, setLastUsedShort] = useState(false);

  // Per-chapter session metrics
  const [mistypedIndices, setMistypedIndices] = useState<Set<number>>(() => new Set());
  const [correctKeys, setCorrectKeys] = useState(0);
  const [totalKeys, setTotalKeys] = useState(0);
  const [totalCharMs, setTotalCharMs] = useState(0);
  const [completedChars, setCompletedChars] = useState(0);

  const charStartRef = useRef<number>(performance.now());
  const masteryRef = useRef<SchemeMasteryStore>(mastery);
  masteryRef.current = mastery;
  const activeCharElRef = useRef<HTMLButtonElement | null>(null);

  const activeChapter = useMemo(
    () => HUANGTING_CHAPTERS.find((c) => c.id === chapterId) || HUANGTING_CHAPTERS[0],
    [chapterId]
  );

  const chapterText = script === 'trad' ? activeChapter.textTrad : activeChapter.textSimp;

  const { tokens, typableChars } = useMemo(() => {
    if (weakDrillChars && weakDrillChars.length > 0) {
      return tokenizeChapterText(weakDrillChars.join(''));
    }
    return tokenizeChapterText(chapterText);
  }, [chapterText, weakDrillChars]);

  const verseLines = useMemo(() => groupIntoLines(tokens), [tokens]);

  // Exact (row, col) coordinate of the active character in `verseLines` for Depth-of-Field shifting
  const activeGridPos = useMemo(() => {
    if (verseLines.length === 0) return { row: 0, col: 0 };
    const targetTypable = chapterDone ? Math.max(0, typableChars.length - 1) : cursor;
    for (let r = 0; r < verseLines.length; r++) {
      const line = verseLines[r];
      for (let c = 0; c < line.length; c++) {
        if (line[c].typableIdx === targetTypable) {
          return { row: r, col: c };
        }
      }
    }
    return { row: 0, col: 0 };
  }, [verseLines, cursor, chapterDone, typableChars.length]);

  const resetChapterSession = useCallback((startAt = 0) => {
    setCursor(startAt);
    setTyped('');
    setHadError(false);
    setErrorFlash(false);
    setRescueActive(false);
    setHesitationRescue(false);
    setChapterDone(false);
    setLastUsedShort(false);
    setMistypedIndices(new Set());
    setCorrectKeys(0);
    setTotalKeys(0);
    setTotalCharMs(0);
    setCompletedChars(0);
    charStartRef.current = performance.now();
  }, []);

  const selectChapter = useCallback(
    (nextId: number) => {
      const clamped = Math.max(1, Math.min(HUANGTING_CHAPTERS.length, nextId));
      setWeakDrillChars(null);
      setChapterId(clamped);
      resetChapterSession(0);
      setLog((prev) => {
        const next = { ...prev, lastChapterId: clamped };
        saveHuangtingLog(next);
        return next;
      });
    },
    [resetChapterSession]
  );

  // Reset cursor safely when switching Trad/Simp (keep same char index if aligned)
  useEffect(() => {
    setTyped('');
    setHadError(false);
    setRescueActive(false);
    setHesitationRescue(false);
  }, [script]);

  // Smooth scroll active verse character into view
  useEffect(() => {
    activeCharElRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [cursor, chapterId]);

  const currentItem = typableChars[cursor] || null;
  const glyphKey = currentItem ? `htj_${currentItem.char}` : '';
  const glyphMastery = glyphKey ? mastery.glyphs[glyphKey] : undefined;
  const glyphLevel = glyphMastery?.level ?? 0;

  // Automatic gentle hesitation rescue ("猶豫之後漸顯") in adaptive mode across all mastery levels
  useEffect(() => {
    if (chapterDone || !currentItem || fadeMode !== 'adaptive') {
      setHesitationRescue(false);
      return;
    }
    setHesitationRescue(false);
    const delayMs = getHesitationDelayMs(glyphLevel);
    const timer = window.setTimeout(() => {
      setHesitationRescue(true);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [cursor, chapterId, script, typed, chapterDone, currentItem, fadeMode, glyphLevel]);

  // Core signature: Mastery-adaptive pigment-to-ink fading + instant rescue on error/hesitation/Tab
  const isImmediateRescue = rescueActive || hadError || errorFlash;
  const isRescued = isImmediateRescue || hesitationRescue;
  const colorMix = useMemo(() => {
    if (isRescued) return 1.0;
    if (fadeMode === 'always') return 1.0;
    if (fadeMode === 'blind') return 0.0;
    if (glyphLevel === 0) return 1.0;
    if (glyphLevel === 1) return 0.52;
    if (glyphLevel === 2) return 0.16;
    return 0.0;
  }, [isRescued, fadeMode, glyphLevel]);

  const showKeyGuide =
    isRescued || fadeMode === 'always' || (fadeMode === 'adaptive' && glyphLevel === 0);
  const showRootGuide =
    isRescued || fadeMode === 'always' || (fadeMode === 'adaptive' && glyphLevel <= 1);

  // In Depth mode, hints below the target glyph stay hidden by default in adaptive/blind modes,
  // gently fading in after hesitation (adaptive) or snapping in immediately on mistype/Tab.
  const depthHintsVisible =
    fadeMode === 'always' ||
    isImmediateRescue ||
    (fadeMode === 'adaptive' && hesitationRescue);

  const takenRootSpans = useMemo(() => {
    if (!currentItem) return [];
    return computeTakenRootSpans(currentItem.info.code, currentItem.info.rootCodes);
  }, [currentItem]);

  // Determine which radical corresponds to the next keystroke (using exact Lingming taken-key spans)
  const activeRootIdx = useMemo(() => {
    if (!currentItem || (!showRootGuide && colorMix < 0.45)) return null;
    const rootCount = currentItem.info.roots.length;
    if (rootCount <= 1) return 0;
    const pos = typed.length;
    const exactIdx = takenRootSpans.findIndex(
      (sp) => sp.codeStart >= 0 && pos >= sp.codeStart && pos < sp.codeEnd
    );
    if (exactIdx >= 0) return exactIdx;
    if (pos === 0) return 0;
    if (pos >= currentItem.info.code.length - 1) return rootCount - 1;
    return Math.min(rootCount - 1, pos);
  }, [currentItem, typed.length, showRootGuide, colorMix, takenRootSpans]);

  // Whole-scripture mastery distribution (for current script)
  const scriptureStats = useMemo(() => {
    const uniq = new Set<string>();
    for (const ch of HUANGTING_CHAPTERS) {
      const txt = script === 'trad' ? ch.textTrad : ch.textSimp;
      for (const c of Array.from(txt)) {
        if (HUANGTING_CHAR_MAP[c]) uniq.add(c);
      }
    }
    let l0 = 0;
    let l1 = 0;
    let l2 = 0;
    let l3 = 0;
    for (const c of uniq) {
      const lvl = mastery.glyphs[`htj_${c}`]?.level ?? 0;
      if (lvl === 0) l0++;
      else if (lvl === 1) l1++;
      else if (lvl === 2) l2++;
      else l3++;
    }
    const total = Math.max(1, uniq.size);
    return {
      total: uniq.size,
      l0,
      l1,
      l2,
      l3,
      pureInkPct: Math.round(((l2 + l3) / total) * 100),
    };
  }, [mastery, script]);

  // Per-chapter pure-ink mastery percentage
  const getChapterPurePct = useCallback(
    (chId: number) => {
      const ch = HUANGTING_CHAPTERS[chId - 1];
      if (!ch) return 0;
      const txt = script === 'trad' ? ch.textTrad : ch.textSimp;
      const chars = Array.from(txt).filter((c) => Boolean(HUANGTING_CHAR_MAP[c]));
      if (chars.length === 0) return 0;
      const mastered = chars.filter(
        (c) => (mastery.glyphs[`htj_${c}`]?.level ?? 0) >= 2
      ).length;
      return Math.round((mastered / chars.length) * 100);
    },
    [mastery, script]
  );

  // Weak characters collected in current recitation
  const currentWeakChars = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const idx of mistypedIndices) {
      const item = typableChars[idx];
      if (item && !seen.has(item.char)) {
        seen.add(item.char);
        list.push(item.char);
      }
    }
    return list;
  }, [mistypedIndices, typableChars]);

  // Physical keyboard engine (supports BOTH full Lingming code & official short code seamlessly!)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (chapterDrawerOpen) {
          setChapterDrawerOpen(false);
        } else {
          onBack();
        }
        return;
      }

      if (chapterDone) {
        if (e.key === 'Enter') {
          e.preventDefault();
          synth.playClick();
          if (weakDrillChars) {
            setWeakDrillChars(null);
            resetChapterSession(0);
          } else if (chapterId < HUANGTING_CHAPTERS.length) {
            selectChapter(chapterId + 1);
          } else {
            resetChapterSession(0);
          }
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
      const candidate = typed + key;
      const fullCode = currentItem.info.code;
      const shortCode = allowShortCode ? currentItem.info.shortCode : undefined;

      const matchesFullPrefix = fullCode.startsWith(candidate);
      const matchesShortPrefix = Boolean(shortCode && shortCode.startsWith(candidate));
      const isExactFull = candidate === fullCode;
      const isExactShort = Boolean(shortCode && candidate === shortCode);

      setTotalKeys((n) => n + 1);

      if (isExactFull || isExactShort) {
        setCorrectKeys((n) => n + 1);
        setErrorFlash(false);
        setLastUsedShort(Boolean(isExactShort && !isExactFull));
        const elapsed = Math.max(80, Math.round(performance.now() - charStartRef.current));
        setTotalCharMs((s) => s + elapsed);
        setCompletedChars((c) => c + 1);

        // Clean completion promotes mastery (gradually fading radical colors into pure ink!)
        const hadAnyError = hadError || rescueActive || hesitationRescue;
        const afterKey = recordKeyResult(masteryRef.current, key, true, elapsed);
        const { nextStore } = recordGlyphCompletion(
          afterKey,
          `htj_${currentItem.char}`,
          hadAnyError,
          elapsed,
          candidate.length
        );
        onMasteryChange(nextStore);

        // Update daily log
        const isLastChar = cursor + 1 >= typableChars.length;
        setLog((prev) => {
          const today = getTodayKey();
          const sameDay = prev.dailyDate === today;
          const nextClears = { ...prev.chapterClears };
          if (isLastChar && !weakDrillChars) {
            nextClears[chapterId] = (nextClears[chapterId] ?? 0) + 1;
          }
          const updated: HuangtingLogStore = {
            chapterClears: nextClears,
            dailyDate: today,
            dailyChars: (sameDay ? prev.dailyChars : 0) + 1,
            dailyChapters:
              (sameDay ? prev.dailyChapters : 0) + (isLastChar && !weakDrillChars ? 1 : 0),
            lastChapterId: chapterId,
          };
          saveHuangtingLog(updated);
          return updated;
        });

        if (isLastChar) {
          synth.playMilestone();
          setChapterDone(true);
          setTyped('');
        } else {
          synth.playKeyHit(2, true);
          setCursor((c) => c + 1);
          setTyped('');
          setHadError(false);
          setRescueActive(false);
          setHesitationRescue(false);
          charStartRef.current = performance.now();
        }
      } else if (matchesFullPrefix || matchesShortPrefix) {
        setCorrectKeys((n) => n + 1);
        setErrorFlash(false);
        setTyped(candidate);
        synth.playKeyHit(candidate.length, false);
        const elapsed = Math.max(80, Math.round(performance.now() - charStartRef.current));
        const nextStore = recordKeyResult(masteryRef.current, key, true, elapsed);
        onMasteryChange(nextStore);
      } else {
        // Mistyped! Immediately bloom full-color radical stroke decomposition + keycode leads!
        synth.playKeyMiss();
        setHadError(true);
        setRescueActive(true);
        setErrorFlash(true);
        window.setTimeout(() => setErrorFlash(false), 260);
        setMistypedIndices((prev) => {
          const next = new Set(prev);
          next.add(cursor);
          return next;
        });
        const expected = fullCode[typed.length] || fullCode[0];
        const nextStore = recordKeyResult(masteryRef.current, expected, false, 950);
        onMasteryChange(nextStore);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentItem,
    typed,
    allowShortCode,
    hadError,
    rescueActive,
    hesitationRescue,
    cursor,
    typableChars.length,
    chapterDone,
    chapterDrawerOpen,
    chapterId,
    weakDrillChars,
    onBack,
    onMasteryChange,
    resetChapterSession,
    selectChapter,
  ]);

  const accuracy = totalKeys > 0 ? Math.round((correctKeys / totalKeys) * 100) : 100;
  const avgMs = completedChars > 0 ? Math.round(totalCharMs / completedChars) : 0;
  const activeTitle = script === 'trad' ? activeChapter.titleTrad : activeChapter.titleSimp;

  const masteryStageLabel =
    glyphLevel === 0
      ? '初識 · 全彩拆根'
      : glyphLevel === 1
        ? '漸熟 · 淡彩過渡'
        : glyphLevel === 2
          ? '心印 · 微墨隱碼'
          : '化境 · 純墨無痕';

  return (
    <div
      className={`relative z-10 w-full h-full flex flex-col bg-[var(--dojo-canvas)] wash:bg-transparent text-[var(--dojo-text)] select-none ${
        viewMode === 'depth' ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
    >
      {/* Strict 3-Zone Top Header */}
      <header className="sticky top-0 z-30 shrink-0 h-14 px-4 sm:px-6 border-b border-[var(--dojo-border)] bg-[var(--dojo-header)]/95 wash:bg-[#ECEAE3]/92 backdrop-blur-md flex items-center justify-between gap-3">
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
            <ScrollText className="w-4 h-4 text-[var(--dojo-ochre)] shrink-0" />
            <h1 className="font-display text-base font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
              {t('黃庭抄經閣')}
            </h1>
          </div>
        </div>

        {/* Center: View Mode (Depth Scroll vs Desk) + Color-Fading Scaffolding Mode */}
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg"
            role="group"
            aria-label={t('抄經視圖模式')}
          >
            <button
              type="button"
              onClick={() => handleChangeViewMode('depth')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'depth'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('景深誦抄')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleChangeViewMode('desk')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'desk'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('案頭卷冊')}</span>
            </button>
          </div>

          <div
            className="hidden lg:inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg"
            role="group"
            aria-label={t('分色引線模式')}
          >
            {([
              ['adaptive', '熟度漸隱'],
              ['always', '始終分色'],
              ['blind', '純墨默誦'],
            ] as const).map(([mId, label]) => (
              <button
                key={mId}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setFadeMode(mId);
                }}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  fadeMode === mId
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Scripture Script + ShortCode Toggle + Theme + Mute */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg">
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setScript('trad');
              }}
              className={`px-2 py-1 text-[11px] rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                script === 'trad'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
              }`}
            >
              {t('繁本')}
            </button>
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setScript('simp');
              }}
              className={`px-2 py-1 text-[11px] rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                script === 'simp'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
              }`}
            >
              {t('簡本')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setAllowShortCode((v) => !v);
            }}
            title={t('開啟後，經文中含有靈明直出簡碼的字可同時接受全碼或簡碼上屏')}
            className={`hidden sm:inline-flex items-center px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              allowShortCode
                ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
            }`}
          >
            {t(allowShortCode ? '簡全通打' : '僅限全碼')}
          </button>

          <div className="hidden sm:inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg">
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

      {/* ==================== IMMERSIVE DEPTH-OF-FIELD SHIFTING SCRIPTURE MODE ==================== */}
      {viewMode === 'depth' ? (
        <main className="relative flex-1 w-full overflow-hidden flex flex-col">
          {/* Shared Coordinate Stage for Background Scripture + Lower-Anchored Ergonomic Target */}
          <div className="relative flex-1 w-full overflow-hidden">
            {/* Layer 1 (Far & Mid Depth): Smoothly Shifting Classical Scripture Scroll (Zero Keyboard) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            >
              {/* Anchored to exact vertical center of the lowered foreground target glyph (202px mobile / 234px desktop from stage bottom) */}
              <div
                className="absolute left-1/2 bottom-[202px] sm:bottom-[234px]"
                style={{
                  transform: `translate3d(${-(activeGridPos.col * DEPTH_CELL_PX + DEPTH_CELL_PX / 2)}px, ${-(activeGridPos.row * DEPTH_ROW_PX + DEPTH_ROW_PX / 2)}px, 0)`,
                  transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                  willChange: 'transform',
                }}
              >
                {verseLines.map((line, rIdx) => {
                  const signedRowDelta = rIdx - activeGridPos.row;
                  const rowDelta = Math.abs(signedRowDelta);
                  // Show up to 6 softly receding rows above the lowered focal line and 3 rows below
                  if (signedRowDelta < -6 || signedRowDelta > 3) return null;

                  // Multi-plane optical depth: active line sits closest in mid-background,
                  // neighboring couplets recede softly upward/downward with progressive optical defocus & scale
                  const rowBlur =
                    rowDelta === 0
                      ? 0.45
                      : rowDelta === 1
                        ? 1.6
                        : rowDelta === 2
                          ? 2.9
                          : rowDelta === 3
                            ? 4.2
                            : rowDelta === 4
                              ? 5.4
                              : rowDelta === 5
                                ? 6.6
                                : 7.6;
                  const rowScale =
                    rowDelta === 0
                      ? 1
                      : rowDelta === 1
                        ? 0.95
                        : rowDelta === 2
                          ? 0.9
                          : rowDelta === 3
                            ? 0.85
                            : rowDelta === 4
                              ? 0.81
                              : rowDelta === 5
                                ? 0.77
                                : 0.74;
                  const rowBaseOpacity =
                    rowDelta === 0
                      ? 1
                      : rowDelta === 1
                        ? 0.35
                        : rowDelta === 2
                          ? 0.2
                          : rowDelta === 3
                            ? 0.11
                            : rowDelta === 4
                              ? 0.06
                              : rowDelta === 5
                                ? 0.035
                                : 0.02;

                  return (
                    <div
                      key={rIdx}
                      className="absolute left-0 flex items-center"
                      style={{
                        top: `${rIdx * DEPTH_ROW_PX}px`,
                        height: `${DEPTH_ROW_PX}px`,
                        opacity: rowBaseOpacity,
                        filter: `blur(${rowBlur}px)`,
                        transform: `scale(${rowScale})`,
                        transformOrigin: `${activeGridPos.col * DEPTH_CELL_PX + DEPTH_CELL_PX / 2}px center`,
                        transition:
                          'opacity 380ms cubic-bezier(0.22, 1, 0.36, 1), filter 380ms ease, transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      {line.map((tok, cIdx) => {
                        const colDelta = cIdx - activeGridPos.col;
                        const isCurrentSlot = rowDelta === 0 && colDelta === 0 && !chapterDone;
                        const isDone = tok.isTypable && (tok.typableIdx < cursor || chapterDone);
                        const wasMistyped = tok.isTypable && mistypedIndices.has(tok.typableIdx);

                        let charOpacity = 0.72;
                        if (isCurrentSlot) {
                          // Seamlessly hand off dead-center slot to the sharp foreground focal glyph
                          charOpacity = 0;
                        } else if (rowDelta === 0) {
                          const absCol = Math.abs(colDelta);
                          if (absCol === 1) {
                            // Soft breathing clearance immediately flanking the giant center character
                            charOpacity = colDelta > 0 ? 0.24 : 0.18;
                          } else if (colDelta > 1) {
                            // Upcoming text glides clearly in from the right for peripheral look-ahead
                            charOpacity =
                              absCol <= 5 ? 0.64 : Math.max(0.18, 0.64 - (absCol - 5) * 0.09);
                          } else {
                            // Completed characters drift calmly leftward in settled ink
                            charOpacity =
                              absCol <= 5 ? 0.34 : Math.max(0.12, 0.34 - (absCol - 5) * 0.05);
                          }
                        } else {
                          const absCol = Math.abs(colDelta);
                          charOpacity = Math.max(0.25, 0.85 - absCol * 0.06);
                        }

                        return (
                          <span
                            key={`${rIdx}_${cIdx}`}
                            className={`inline-flex items-center justify-center font-display text-[38px] sm:text-[42px] leading-none transition-all duration-300 ${
                              !tok.isTypable
                                ? 'text-[var(--dojo-text-muted)]'
                                : isDone
                                  ? 'text-[var(--dojo-text-bright)]'
                                  : 'text-[var(--dojo-text-sub)]'
                            }`}
                            style={{
                              width: `${DEPTH_CELL_PX}px`,
                              opacity: charOpacity,
                              transform: isCurrentSlot ? 'scale(0.72)' : 'scale(1)',
                            }}
                          >
                            <span className="relative">
                              {tok.char}
                              {wasMistyped && isDone && rowDelta === 0 && (
                                <span
                                  aria-hidden="true"
                                  className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-1.5 h-1.5 rounded-full bg-[var(--dojo-crimson)] opacity-75"
                                />
                              )}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Optical Halo Scrim locked to the lowered target glyph so contrast stays crisp */}
              <div
                className="absolute left-1/2 bottom-[202px] sm:bottom-[234px] -translate-x-1/2 translate-y-1/2 w-[540px] sm:w-[680px] h-[340px] sm:h-[420px]"
                style={{
                  background: isWash
                    ? 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(243,241,236,0.92) 0%, rgba(243,241,236,0.62) 48%, rgba(243,241,236,0) 76%)'
                    : 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(11,15,23,0.90) 0%, rgba(11,15,23,0.58) 48%, rgba(11,15,23,0) 76%)',
                }}
              />
              {/* Soft horizontal & upper horizon mist scrims */}
              <div
                className="absolute inset-0"
                style={{
                  background: isWash
                    ? 'linear-gradient(90deg, rgba(243,241,236,0.92) 0%, transparent 14%, transparent 86%, rgba(243,241,236,0.92) 100%)'
                    : 'linear-gradient(90deg, rgba(11,15,23,0.92) 0%, transparent 14%, transparent 86%, rgba(11,15,23,0.92) 100%)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: isWash
                    ? 'linear-gradient(180deg, rgba(243,241,236,0.88) 0%, transparent 16%, transparent 90%, rgba(243,241,236,0.75) 100%)'
                    : 'linear-gradient(180deg, rgba(11,15,23,0.88) 0%, transparent 16%, transparent 90%, rgba(11,15,23,0.75) 100%)',
                }}
              />
            </div>

            {/* Layer 2 (Foreground Focal Plane): Ergonomically Lowered Target Glyph for Comfortable Downward Gaze */}
            <div
              className={`relative z-20 h-full w-full flex flex-col items-center px-4 ${
                chapterDone ? 'justify-center py-6' : 'justify-end pb-2'
              }`}
            >
              {chapterDone ? (
                <div className="max-w-lg w-full bg-[var(--dojo-surface)]/92 wash:bg-[#F5F3EE]/94 backdrop-blur-md border border-[var(--dojo-border)] rounded-2xl p-7 flex flex-col items-center text-center gap-4 shadow-xl">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-pine-text)]">
                    <Check className="w-4 h-4" />
                    <span>{t(weakDrillChars ? '本章難字重抄完畢' : '本章誦抄圓滿')}</span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-[var(--dojo-text-bright)]">
                    {activeTitle}
                  </h3>
                  <div className="flex items-center gap-6 font-mono-tabular text-sm">
                    <div>
                      <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('準確率')}</div>
                      <div className="text-2xl font-bold text-[var(--dojo-pine-text)]">{accuracy}%</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('字均時長')}</div>
                      <div className="text-2xl font-bold text-[var(--dojo-ochre)]">{avgMs}ms</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('本章純墨率')}</div>
                      <div className="text-2xl font-bold text-[var(--dojo-text-bright)]">
                        {getChapterPurePct(chapterId)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    {currentWeakChars.length > 0 && !weakDrillChars && (
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setWeakDrillChars(currentWeakChars);
                          resetChapterSession(0);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('專抄本章難字')}（{currentWeakChars.length}）</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setWeakDrillChars(null);
                        resetChapterSession(0);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--dojo-surface-2)] border border-[var(--dojo-border-strong)] text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('再誦本章')}</span>
                    </button>
                    {chapterId < HUANGTING_CHAPTERS.length && (
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          selectChapter(chapterId + 1);
                        }}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t('續誦下一章（Enter）')}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : currentItem ? (
                <div className="flex flex-col items-center gap-2.5">
                  {/* Giant Permanently-Centered, Lower-Anchored Calligraphic Focal Target */}
                  <ColorSplitGlyph
                    char={currentItem.char}
                    strokes={currentItem.info.strokes}
                    strokeRootIndices={currentItem.info.strokeRootIndices}
                    themeMode={themeMode}
                    colorMix={colorMix}
                    activeRootIdx={activeRootIdx}
                    errorFlash={errorFlash}
                    sizeClass="w-44 h-44 sm:w-56 sm:h-56"
                  />

                  {/* Fixed-Height Hint Cushion: Hidden by default in adaptive/blind modes; gently fades in after hesitation */}
                  <div
                    aria-hidden={!depthHintsVisible}
                    className={`h-[96px] sm:h-[104px] flex flex-col items-center justify-start gap-1.5 ${
                      depthHintsVisible
                        ? isImmediateRescue || fadeMode === 'always'
                          ? 'opacity-100 translate-y-0 transition-all duration-200 ease-out'
                          : 'opacity-100 translate-y-0 transition-all duration-700 ease-out'
                        : 'opacity-0 translate-y-1.5 pointer-events-none transition-none'
                    }`}
                  >
                    {/* Keycode Input Slots */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      {currentItem.info.code.split('').map((ch, idx) => {
                        const isTyped = idx < typed.length;
                        const isCurrent = idx === typed.length;
                        const isFinalVowel =
                          idx === currentItem.info.code.length - 1 && 'aeiou'.includes(ch);
                        return (
                          <div
                            key={idx}
                            className={`w-10 h-11 sm:w-11 sm:h-12 rounded-xl border-2 flex flex-col items-center justify-center font-mono-tabular transition-colors ${
                              isTyped
                                ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)] text-[var(--dojo-pine-text)]'
                                : isCurrent && errorFlash
                                  ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)]'
                                  : isCurrent
                                    ? 'bg-[var(--dojo-surface-2)]/95 wash:bg-[#FFFFFF]/95 border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)] shadow-xs'
                                    : 'bg-[var(--dojo-surface-inset)]/90 wash:bg-[#FAF9F5]/88 border-[var(--dojo-border-strong)] text-[var(--dojo-text-sub)]'
                            }`}
                          >
                            <span className="text-lg font-bold uppercase leading-none">
                              {isTyped ? typed[idx] : ch}
                            </span>
                            {isFinalVowel && (
                              <span className="text-[9px] leading-none mt-0.5 opacity-65 font-sans">
                                {t('韻尾')}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {allowShortCode && currentItem.info.shortCode && (
                        <div className="ml-1 pl-2 border-l border-[var(--dojo-border-strong)] flex flex-col leading-tight">
                          <span className="text-[10px] text-[var(--dojo-text-muted)]">
                            {t('亦支援簡碼')}
                          </span>
                          <span className="font-mono-tabular text-xs font-bold text-[var(--dojo-ochre)] uppercase">
                            {currentItem.info.shortCode}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Color-Matched Radical Leads */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {currentItem.info.roots.map((root, rIdx) => {
                        const rootColor = getRootColor(
                          rIdx,
                          themeMode,
                          Math.max(0.75, colorMix)
                        );
                        const rootMa = (currentItem.info.rootCodes[rIdx] || '').toUpperCase();
                        const span = takenRootSpans[rIdx];
                        const isActiveRoot = activeRootIdx === rIdx;
                        const hasTaken = span ? span.matchEnd > span.matchStart : rootMa.length > 0;
                        return (
                          <div
                            key={`${root}_${rIdx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs transition-all backdrop-blur-xs"
                            style={{
                              borderColor: isActiveRoot
                                ? rootColor
                                : isWash
                                  ? 'rgba(24,24,22,0.16)'
                                  : 'rgba(255,255,255,0.12)',
                              backgroundColor: isWash
                                ? isActiveRoot
                                  ? 'rgba(255,255,255,0.94)'
                                  : 'rgba(243,241,236,0.82)'
                                : isActiveRoot
                                  ? 'rgba(20,27,39,0.92)'
                                  : 'rgba(15,20,30,0.72)',
                              opacity: hasTaken ? 1 : 0.55,
                            }}
                          >
                            <RadicalSymbol
                              glyph={root}
                              className="font-display text-sm font-bold leading-none"
                              style={{ color: rootColor }}
                            />
                            {rootMa && (
                              <span className="font-mono-tabular text-[11px] uppercase tracking-wide inline-flex items-baseline">
                                {rootMa.split('').map((letter, lIdx) => {
                                  const taken =
                                    !span ||
                                    (lIdx >= span.matchStart && lIdx < span.matchEnd);
                                  return (
                                    <span
                                      key={lIdx}
                                      style={{ color: rootColor }}
                                      className={
                                        taken
                                          ? 'font-bold'
                                          : 'opacity-35 line-through font-normal'
                                      }
                                    >
                                      {letter}
                                    </span>
                                  );
                                })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Whisper-quiet Rescue / Mode Caption */}
                    <div className="flex items-center gap-2 text-[10px] leading-none text-[var(--dojo-text-muted)]">
                      <span
                        className={
                          isImmediateRescue
                            ? 'text-[var(--dojo-crimson-text)] font-medium'
                            : hesitationRescue
                              ? 'text-[var(--dojo-ochre)]'
                              : ''
                        }
                      >
                        {hadError || errorFlash
                          ? t('誤擊回顯 · 全彩引線')
                          : rescueActive
                            ? t('Tab 顯影引線')
                            : hesitationRescue
                              ? t('猶豫漸顯 · 全彩引線')
                              : t(masteryStageLabel)}
                      </span>
                      {lastUsedShort && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--dojo-pine-text)]">
                            {t('剛以簡碼直上')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Layer 3 (Quiet Perimeter Footer): Chapter Controls, Progress & Slide-over Directory */}
          <footer className="relative z-30 shrink-0 px-4 sm:px-6 py-3 border-t border-[var(--dojo-border)]/70 bg-[var(--dojo-header)]/80 wash:bg-[#ECEAE3]/78 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left: Chapter Navigation + Directory Drawer Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={chapterId <= 1}
                onClick={() => {
                  synth.playClick();
                  selectChapter(chapterId - 1);
                }}
                aria-label={t('上一章')}
                className="p-1 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-display font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
                {weakDrillChars ? `${activeTitle} · ${t('難字重抄')}` : activeTitle}
              </span>
              <span className="font-mono-tabular text-[var(--dojo-ochre)]">{chapterId}/36</span>
              <button
                type="button"
                disabled={chapterId >= HUANGTING_CHAPTERS.length}
                onClick={() => {
                  synth.playClick();
                  selectChapter(chapterId + 1);
                }}
                aria-label={t('下一章')}
                className="p-1 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setChapterDrawerOpen(true);
                }}
                className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <List className="w-3.5 h-3.5" />
                <span>{t('章節目錄')}</span>
              </button>
            </div>

            {/* Center: Unboxed Tabular Chanting Progress */}
            <div className="flex items-center gap-2 font-mono-tabular text-[var(--dojo-text-sub)]">
              <span>
                {t('進度')} {Math.min(cursor + (chapterDone ? 1 : 0), typableChars.length)}/{typableChars.length}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t('準確')} {accuracy}%
              </span>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                {t('今日誦抄')} <strong className="text-[var(--dojo-text-bright)]">{log.dailyChars}</strong> {t('字')}
              </span>
            </div>

            {/* Right: Quiet Actions */}
            <div className="flex items-center gap-3 text-[var(--dojo-text-muted)]">
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setRescueActive((v) => !v);
                }}
                className="inline-flex items-center gap-1 hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
              >
                {rescueActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{t('Tab 顯影')}</span>
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setWeakDrillChars(null);
                  resetChapterSession(0);
                }}
                className="inline-flex items-center gap-1 hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('重抄')}</span>
              </button>
            </div>
          </footer>

          {/* Slide-over 36-Chapter Directory Drawer for Depth Mode */}
          {chapterDrawerOpen && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div
                className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
                onClick={() => setChapterDrawerOpen(false)}
              />
              <aside className="relative z-10 w-full max-w-sm h-full bg-[var(--dojo-surface)] wash:bg-[#F5F3EE]/97 border-l border-[var(--dojo-border)] p-5 flex flex-col gap-4 shadow-2xl">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--dojo-border)]">
                  <div>
                    <h2 className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                      {t('三十六章目錄')}
                    </h2>
                    <div className="text-[11px] font-mono-tabular text-[var(--dojo-text-muted)] mt-0.5">
                      {t('全經純墨化境')} {scriptureStats.pureInkPct}% · {Object.keys(log.chapterClears).length}/36 {t('章已誦')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChapterDrawerOpen(false)}
                    aria-label={t('關閉')}
                    className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile/narrow Fade-mode switch inside drawer */}
                <div className="lg:hidden flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg">
                  {([
                    ['adaptive', '熟度漸隱'],
                    ['always', '始終分色'],
                    ['blind', '純墨默誦'],
                  ] as const).map(([mId, label]) => (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setFadeMode(mId);
                      }}
                      className={`flex-1 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        fadeMode === mId
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] font-semibold'
                          : 'text-[var(--dojo-text-sub)]'
                      }`}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
                  {HUANGTING_CHAPTERS.map((ch) => {
                    const isSelected = ch.id === chapterId;
                    const clears = log.chapterClears[ch.id] ?? 0;
                    const purePct = getChapterPurePct(ch.id);
                    const title = script === 'trad' ? ch.titleTrad : ch.titleSimp;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          selectChapter(ch.id);
                          setChapterDrawerOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                            : 'bg-[var(--dojo-surface-inset)]/60 hover:bg-[var(--dojo-surface-2)]/70 border-transparent text-[var(--dojo-text-sub)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-mono-tabular text-[11px] w-5 shrink-0 ${
                              isSelected ? 'text-[var(--dojo-ochre)] font-bold' : 'text-[var(--dojo-text-muted)]'
                            }`}
                          >
                            {String(ch.id).padStart(2, '0')}
                          </span>
                          <span className="font-display text-sm font-medium truncate">
                            {title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono-tabular text-[10px] shrink-0">
                          {purePct > 0 && (
                            <span className="text-[var(--dojo-pine-text)]">{purePct}%</span>
                          )}
                          {clears > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[var(--dojo-ochre)]">
                              <Check className="w-3 h-3" />
                              <span>{clears}</span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            </div>
          )}
        </main>
      ) : (
        /* ==================== CLASSIC DESK 2-ZONE SCRIPTURE LAYOUT ==================== */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Zone (8 cols): Active Calligraphy Desk + Scripture Scroll */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          {/* Chapter Header & Daily Chanting Ledger */}
          <div className="bg-[var(--dojo-surface)] wash:bg-[#F5F3EE]/88 wash:backdrop-blur-[2px] border border-[var(--dojo-border)] rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[var(--dojo-border)]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={chapterId <= 1}
                  onClick={() => {
                    synth.playClick();
                    selectChapter(chapterId - 1);
                  }}
                  aria-label={t('上一章')}
                  className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--dojo-text-bright)]">
                      {weakDrillChars ? `${activeTitle} · ${t('難字重抄')}` : activeTitle}
                    </h2>
                    <span className="font-mono-tabular text-xs text-[var(--dojo-ochre)]">
                      {chapterId}/36
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[var(--dojo-text-muted)] mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>
                      {t('本章進度')} {Math.min(cursor + (chapterDone ? 1 : 0), typableChars.length)}/{typableChars.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('已誦')} {log.chapterClears[chapterId] ?? 0} {t('遍')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('準確')} {accuracy}%
                    </span>
                    {avgMs > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{avgMs}ms/{t('字')}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={chapterId >= HUANGTING_CHAPTERS.length}
                  onClick={() => {
                    synth.playClick();
                    selectChapter(chapterId + 1);
                  }}
                  aria-label={t('下一章')}
                  className="p-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono-tabular text-[var(--dojo-text-sub)]">
                <Flame className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                <span>
                  {t('今日誦抄')} <strong className="text-[var(--dojo-text-bright)]">{log.dailyChars}</strong> {t('字')}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-[var(--dojo-pine-text)]">{log.dailyChapters}</strong> {t('章')}
                </span>
              </div>
            </div>

            {/* Focal Calligraphy Glyph & Mastery-Adaptive Radical Decomposition */}
            {chapterDone ? (
              <div className="py-10 flex flex-col items-center text-center gap-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-pine-text)]">
                  <Check className="w-4 h-4" />
                  <span>{t(weakDrillChars ? '本章難字重抄完畢' : '本章誦抄圓滿')}</span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[var(--dojo-text-bright)]">
                  {activeTitle}
                </h3>
                <div className="flex items-center gap-6 font-mono-tabular text-sm">
                  <div>
                    <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('準確率')}</div>
                    <div className="text-2xl font-bold text-[var(--dojo-pine-text)]">{accuracy}%</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('字均時長')}</div>
                    <div className="text-2xl font-bold text-[var(--dojo-ochre)]">{avgMs}ms</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('本章純墨率')}</div>
                    <div className="text-2xl font-bold text-[var(--dojo-text-bright)]">
                      {getChapterPurePct(chapterId)}%
                    </div>
                  </div>
                </div>

                {currentWeakChars.length > 0 && !weakDrillChars && (
                  <div className="max-w-lg pt-3 border-t border-[var(--dojo-border)]">
                    <div className="text-xs text-[var(--dojo-text-muted)] mb-2">
                      {t('本章誤擊字')}（{currentWeakChars.length}）
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {currentWeakChars.map((ch) => (
                        <span
                          key={ch}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] text-xs"
                        >
                          <span className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                            {ch}
                          </span>
                          <span className="font-mono-tabular text-[var(--dojo-ochre)]">
                            {HUANGTING_CHAR_MAP[ch]?.code.toUpperCase()}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  {currentWeakChars.length > 0 && !weakDrillChars && (
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setWeakDrillChars(currentWeakChars);
                        resetChapterSession(0);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('專抄本章難字')}（{currentWeakChars.length}）</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setWeakDrillChars(null);
                      resetChapterSession(0);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--dojo-surface-2)] border border-[var(--dojo-border-strong)] text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('再誦本章')}</span>
                  </button>
                  {chapterId < HUANGTING_CHAPTERS.length && (
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        selectChapter(chapterId + 1);
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t('續誦下一章（Enter）')}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : currentItem ? (
              <div className="py-5 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
                {/* Large Color-Decomposed Calligraphic Character */}
                <div className="flex flex-col items-center gap-2">
                  <ColorSplitGlyph
                    char={currentItem.char}
                    strokes={currentItem.info.strokes}
                    strokeRootIndices={currentItem.info.strokeRootIndices}
                    themeMode={themeMode}
                    colorMix={colorMix}
                    activeRootIdx={activeRootIdx}
                    errorFlash={errorFlash}
                    sizeClass="w-36 h-36 sm:w-44 sm:h-44"
                  />
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--dojo-text-muted)]">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: isRescued
                          ? 'var(--dojo-crimson)'
                          : glyphLevel >= 3
                            ? 'var(--dojo-pine)'
                            : glyphLevel >= 1
                              ? 'var(--dojo-ochre)'
                              : 'var(--dojo-text-muted)',
                      }}
                    />
                    <span>
                      {isRescued
                        ? t(hadError ? '誤擊回顯 · 全彩引線' : '久停／Tab 顯影')
                        : t(masteryStageLabel)}
                    </span>
                  </div>
                </div>

                {/* Right of Focal Glyph: Keycode Slots & Color-Matched Radical Leads */}
                <div className="flex flex-col items-center sm:items-start gap-3.5 min-w-[250px]">
                  {/* Full-code input slots */}
                  <div className="flex items-center gap-2">
                    {currentItem.info.code.split('').map((ch, idx) => {
                      const isTyped = idx < typed.length;
                      const isCurrent = idx === typed.length;
                      const isFinalVowel =
                        idx === currentItem.info.code.length - 1 && 'aeiou'.includes(ch);
                      return (
                        <div
                          key={idx}
                          className={`w-11 h-13 sm:w-12 sm:h-14 rounded-xl border-2 flex flex-col items-center justify-center font-mono-tabular transition-all ${
                            isTyped
                              ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)] text-[var(--dojo-pine-text)]'
                              : isCurrent && errorFlash
                                ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)]'
                                : isCurrent
                                  ? 'bg-[var(--dojo-surface-2)] wash:bg-[#FFFFFF]/95 border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)] shadow-xs'
                                  : 'bg-[var(--dojo-surface-inset)] wash:bg-[#FAF9F5]/88 border-[var(--dojo-border-strong)] text-[var(--dojo-text-sub)]'
                          }`}
                        >
                          <span className="text-xl font-bold uppercase leading-none">
                            {isTyped ? typed[idx] : showKeyGuide ? ch : '·'}
                          </span>
                          {showKeyGuide && isFinalVowel && (
                            <span className="text-[9px] leading-none mt-1 opacity-65 font-sans">
                              {t('韻尾')}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Optional direct short-code indicator */}
                    {allowShortCode && currentItem.info.shortCode && showRootGuide && (
                      <div className="ml-1.5 pl-2.5 border-l border-[var(--dojo-border)] flex flex-col leading-tight">
                        <span className="text-[10px] text-[var(--dojo-text-muted)]">
                          {t('亦支援簡碼')}
                        </span>
                        <span className="font-mono-tabular text-sm font-bold text-[var(--dojo-ochre)] uppercase">
                          {currentItem.info.shortCode}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Color-Matched Radical Decomposition Leads (highlights exact taken keys vs omitted keys!) */}
                  <div className="min-h-[3.25rem] flex flex-col justify-center gap-1.5">
                    {showRootGuide ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {currentItem.info.roots.map((root, rIdx) => {
                          const rootColor = getRootColor(
                            rIdx,
                            themeMode,
                            Math.max(0.65, colorMix)
                          );
                          const rootMa = (currentItem.info.rootCodes[rIdx] || '').toUpperCase();
                          const span = takenRootSpans[rIdx];
                          const isActiveRoot = activeRootIdx === rIdx;
                          const hasTaken = span ? span.matchEnd > span.matchStart : rootMa.length > 0;
                          return (
                            <div
                              key={`${root}_${rIdx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-all"
                              style={{
                                borderColor: isActiveRoot
                                  ? rootColor
                                  : isWash
                                    ? 'rgba(24,24,22,0.16)'
                                    : 'rgba(255,255,255,0.11)',
                                backgroundColor: isWash
                                  ? isActiveRoot
                                    ? 'rgba(255,255,255,0.92)'
                                    : 'rgba(243,241,236,0.72)'
                                  : isActiveRoot
                                    ? 'rgba(255,255,255,0.07)'
                                    : 'rgba(255,255,255,0.03)',
                                opacity: hasTaken ? 1 : 0.55,
                              }}
                            >
                              <RadicalSymbol
                                glyph={root}
                                className="font-display text-base font-bold leading-none"
                                style={{ color: rootColor }}
                              />
                              {showKeyGuide && rootMa && (
                                <span className="font-mono-tabular text-[11px] uppercase tracking-wide inline-flex items-baseline">
                                  {rootMa.split('').map((letter, lIdx) => {
                                    const taken =
                                      !span ||
                                      (lIdx >= span.matchStart && lIdx < span.matchEnd);
                                    return (
                                      <span
                                        key={lIdx}
                                        style={{ color: rootColor }}
                                        className={
                                          taken
                                            ? 'font-bold'
                                            : 'opacity-35 line-through font-normal'
                                        }
                                      >
                                        {letter}
                                      </span>
                                    );
                                  })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--dojo-text-muted)]">
                        {t('已入化境 · 純墨默誦（忘碼按 Tab 或略停自動顯影分色拆根）')}
                      </div>
                    )}

                    {/* Micro control row */}
                    <div className="flex items-center gap-3 text-[11px] text-[var(--dojo-text-muted)]">
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setRescueActive((v) => !v);
                        }}
                        className="inline-flex items-center gap-1 hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
                      >
                        {rescueActive ? (
                          <EyeOff className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                        <span>{t('Tab 顯影引線')}</span>
                      </button>
                      <span aria-hidden="true">·</span>
                      <span>{t('Space 清空')}</span>
                      {lastUsedShort && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--dojo-pine-text)]">{t('剛以簡碼直上')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Living Classical Scripture Scroll (Click any char to jump!) */}
          <div className="bg-[var(--dojo-surface)] wash:bg-[#F5F3EE]/88 wash:backdrop-blur-[2px] border border-[var(--dojo-border)] rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-[var(--dojo-border)] text-xs">
              <div className="flex items-center gap-2 text-[var(--dojo-text-sub)]">
                <BookOpen className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                <span className="font-medium text-[var(--dojo-text)]">
                  {weakDrillChars ? t('本章難字專抄隊列') : t('經文抄卷（點擊任一字即可移位起抄）')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {weakDrillChars && (
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setWeakDrillChars(null);
                      resetChapterSession(0);
                    }}
                    className="text-xs text-[var(--dojo-ochre)] hover:underline cursor-pointer"
                  >
                    {t('返回完整本章')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    resetChapterSession(0);
                  }}
                  className="inline-flex items-center gap-1 text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('從頭重抄')}</span>
                </button>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
              {verseLines.map((line, lIdx) => (
                <p
                  key={lIdx}
                  className="font-display text-xl sm:text-2xl leading-[2.15] tracking-[0.12em] flex flex-wrap items-baseline"
                >
                  {line.map((tok, tIdx) => {
                    if (!tok.isTypable) {
                      return (
                        <span
                          key={`${lIdx}_${tIdx}`}
                          className="text-[var(--dojo-text-muted)]/55 mr-1 select-none"
                        >
                          {tok.char}
                        </span>
                      );
                    }
                    const isDone = tok.typableIdx < cursor || chapterDone;
                    const isCurrent = !chapterDone && tok.typableIdx === cursor;
                    const wasMistyped = mistypedIndices.has(tok.typableIdx);
                    const chLvl = mastery.glyphs[`htj_${tok.char}`]?.level ?? 0;

                    return (
                      <button
                        key={`${lIdx}_${tIdx}`}
                        ref={isCurrent ? activeCharElRef : undefined}
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setCursor(tok.typableIdx);
                          setTyped('');
                          setHadError(false);
                          setRescueActive(false);
                          setHesitationRescue(false);
                          setChapterDone(false);
                          charStartRef.current = performance.now();
                        }}
                        className={`relative px-0.5 rounded transition-colors cursor-pointer ${
                          isCurrent
                            ? 'text-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] font-bold'
                            : isDone
                              ? 'text-[var(--dojo-text-bright)]'
                              : chLvl >= 2
                                ? 'text-[var(--dojo-text-sub)]/75 hover:text-[var(--dojo-text-bright)]'
                                : 'text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)]'
                        }`}
                      >
                        {tok.char}
                        {isCurrent && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0.5 right-0.5 bottom-0.5 h-[2px] rounded-full bg-[var(--dojo-ochre)]"
                          />
                        )}
                        {wasMistyped && isDone && (
                          <span
                            aria-hidden="true"
                            className="absolute left-1/2 -translate-x-1/2 -bottom-0.5 w-1 h-1 rounded-full bg-[var(--dojo-crimson)]"
                          />
                        )}
                      </button>
                    );
                  })}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Right Zone (4 cols): Whole-Scripture Mastery Ledger & 36-Chapter Index */}
        <aside className="lg:col-span-4 bg-[var(--dojo-surface)] wash:bg-[#F5F3EE]/88 wash:backdrop-blur-[2px] border border-[var(--dojo-border)] rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          {/* Scripture Mastery Distribution */}
          <div className="pb-4 border-b border-[var(--dojo-border)]">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <span className="font-display text-sm font-bold text-[var(--dojo-text-bright)]">
                {t('全經純墨化境')}
              </span>
              <span className="font-mono-tabular text-xs font-semibold text-[var(--dojo-pine-text)]">
                {scriptureStats.pureInkPct}% · {scriptureStats.total}{t('異字')}
              </span>
            </div>

            {/* 4-tier mastery bar */}
            <div className="w-full h-2 rounded-full bg-[var(--dojo-surface-inset)] overflow-hidden flex">
              <div
                style={{
                  width: `${(scriptureStats.l3 / Math.max(1, scriptureStats.total)) * 100}%`,
                  backgroundColor: 'var(--dojo-pine)',
                }}
              />
              <div
                style={{
                  width: `${(scriptureStats.l2 / Math.max(1, scriptureStats.total)) * 100}%`,
                  backgroundColor: 'var(--dojo-pine-text)',
                  opacity: 0.6,
                }}
              />
              <div
                style={{
                  width: `${(scriptureStats.l1 / Math.max(1, scriptureStats.total)) * 100}%`,
                  backgroundColor: 'var(--dojo-ochre)',
                }}
              />
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] font-mono-tabular text-[var(--dojo-text-muted)]">
              <span>{t('初識')} {scriptureStats.l0}</span>
              <span className="text-[var(--dojo-ochre)]">{t('漸熟')} {scriptureStats.l1}</span>
              <span className="text-[var(--dojo-pine-text)]">{t('心印')} {scriptureStats.l2}</span>
              <span className="text-[var(--dojo-pine)] font-semibold">{t('純墨')} {scriptureStats.l3}</span>
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--dojo-text-muted)]">
              {t('初識字以四色分拆真筆字根；每清打一遍熟度晉階，色澤漸退直至純墨無痕。若不慎誤擊或停頓，引線即刻回顯。')}
            </p>
          </div>

          {/* 36-Chapter Scrollable Directory */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--dojo-text)]">
                {t('三十六章目錄')}
              </span>
              <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
                {Object.keys(log.chapterClears).length}/36 {t('章已誦')}
              </span>
            </div>

            <div className="max-h-[430px] overflow-y-auto pr-1 flex flex-col gap-1">
              {HUANGTING_CHAPTERS.map((ch) => {
                const isSelected = ch.id === chapterId;
                const clears = log.chapterClears[ch.id] ?? 0;
                const purePct = getChapterPurePct(ch.id);
                const title = script === 'trad' ? ch.titleTrad : ch.titleSimp;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      selectChapter(ch.id);
                    }}
                    className={`w-full px-3 py-2 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                        : 'bg-[var(--dojo-surface-inset)]/60 hover:bg-[var(--dojo-surface-2)]/70 border-transparent text-[var(--dojo-text-sub)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`font-mono-tabular text-[11px] w-5 shrink-0 ${
                          isSelected ? 'text-[var(--dojo-ochre)] font-bold' : 'text-[var(--dojo-text-muted)]'
                        }`}
                      >
                        {String(ch.id).padStart(2, '0')}
                      </span>
                      <span className="font-display text-sm font-medium truncate">
                        {title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono-tabular text-[10px] shrink-0">
                      {purePct > 0 && (
                        <span className="text-[var(--dojo-pine-text)]">{purePct}%</span>
                      )}
                      {clears > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[var(--dojo-ochre)]">
                          <Check className="w-3 h-3" />
                          <span>{clears}</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </main>
      )}
    </div>
  );
};
