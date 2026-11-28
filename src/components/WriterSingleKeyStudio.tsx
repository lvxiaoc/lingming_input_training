import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  RotateCcw,
  Search,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  FINGER_BY_KEY,
  MIRROR_STROKE_ENDINGS,
  runSingleKeyPureShape,
  SingleKeyCharEntry,
  WRITER_25_FAMILIES,
  WRITER_25_MAP,
  WRITER_PASSAGES,
  WriterKeyZone,
} from '../data/singleKeyPureShape';
import { KineticStageId } from '../data/kineticCodeSystem';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { synth } from '../audio/synth';

interface WriterSingleKeyStudioProps {
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onOpenChordLab?: () => void;
}

type StudioTab = 'write' | 'atlas' | 'audit';
type WriteMode = 'passage' | 'free';
type HintLevel = 'full' | 'fade' | 'blind';

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

const CN_PUNCT_MAP: Record<string, string> = {
  ',': '，',
  '.': '。',
  '?': '？',
  '!': '！',
  ';': '；',
  ':': '：',
};

const LEFT_ZONES: WriterKeyZone[] = ['横区', '撇区', '折区'];
const RIGHT_ZONES: WriterKeyZone[] = ['框区', '竖区', '点区'];

function isChineseChar(ch: string): boolean {
  return /[\u4e00-\u9fff]/.test(ch);
}

export const WriterSingleKeyStudio: React.FC<WriterSingleKeyStudioProps> = ({
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBack,
  onOpenChordLab,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('write');
  const [writeMode, setWriteMode] = useState<WriteMode>('passage');
  const [hintLevel, setHintLevel] = useState<HintLevel>('full');
  const [auditStage, setAuditStage] = useState<KineticStageId>('common500');

  // Core simulations (memoized once)
  const sim1067 = useMemo(() => runSingleKeyPureShape('full1448', 'simp'), []);
  const sim500 = useMemo(() => runSingleKeyPureShape('common500', 'simp'), []);
  const activeAuditSim = auditStage === 'common500' ? sim500 : sim1067;

  // Passage practice state
  const [passageIdx, setPassageIdx] = useState(0);
  const currentPassage = WRITER_PASSAGES[passageIdx];

  // Build ordered list of Hanzi targets in current passage
  const passageChars = useMemo(() => Array.from(currentPassage.text), [currentPassage.text]);
  const passageHanziIndices = useMemo(() => {
    const idxs: number[] = [];
    passageChars.forEach((ch, idx) => {
      if (isChineseChar(ch) && sim1067.byChar.has(ch)) idxs.push(idx);
    });
    return idxs;
  }, [passageChars, sim1067.byChar]);

  const [passagePos, setPassagePos] = useState(0); // index into passageHanziIndices
  const [passageStep, setPassageStep] = useState(0); // 0..3 within current character
  const [passageCompletedCount, setPassageCompletedCount] = useState(0);
  const [passageMistakeKey, setPassageMistakeKey] = useState<string | null>(null);
  const [lastStruckKey, setLastStruckKey] = useState<string | null>(null);
  const [keyTimesMs, setKeyTimesMs] = useState<number[]>([]);
  const lastKeyTsRef = useRef<number | null>(null);

  const passageDone = passagePos >= passageHanziIndices.length;
  const activePassageCharStr = passageDone
    ? null
    : passageChars[passageHanziIndices[passagePos]];
  const activePassageEntry: SingleKeyCharEntry | null = activePassageCharStr
    ? sim1067.byChar.get(activePassageCharStr) ?? null
    : null;

  const resetPassage = useCallback((nextIdx?: number) => {
    if (typeof nextIdx === 'number') setPassageIdx(nextIdx);
    setPassagePos(0);
    setPassageStep(0);
    setPassageCompletedCount(0);
    setPassageMistakeKey(null);
    setKeyTimesMs([]);
    lastKeyTsRef.current = null;
  }, []);

  // Free-drafting IME state
  const [draftText, setDraftText] = useState('');
  const [buffer, setBuffer] = useState('');
  const [lastSwapOptions, setLastSwapOptions] = useState<{
    code: string;
    chars: string[];
    selectedIdx: number;
  } | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [lookupInput, setLookupInput] = useState('');
  const lookupRef = useRef<HTMLInputElement | null>(null);

  // Atlas selection state
  const [selectedAtlasKey, setSelectedAtlasKey] = useState<string>('f');
  const [inspectedChar, setInspectedChar] = useState<SingleKeyCharEntry | null>(
    () => sim1067.byChar.get('明') ?? sim1067.chars[0] ?? null
  );

  // Prefix candidates for Free Drafting
  const freeCandidates = useMemo(() => {
    if (!buffer) return [];
    const results: SingleKeyCharEntry[] = [];
    // If buffer length === 1, put the family soloLeader first if present in corpus
    if (buffer.length === 1) {
      const fam = WRITER_25_MAP.get(buffer);
      if (fam) {
        const leaderEntry = sim1067.byChar.get(fam.soloLeader);
        if (leaderEntry) results.push(leaderEntry);
      }
    }
    const seen = new Set(results.map((r) => r.char));
    // Prefer Simp 500 entries first for natural writer frequency order
    for (const c of sim500.chars) {
      if (c.code.startsWith(buffer) && !seen.has(c.char)) {
        results.push(c);
        seen.add(c.char);
        if (results.length >= 8) break;
      }
    }
    if (results.length < 8) {
      for (const c of sim1067.chars) {
        if (c.code.startsWith(buffer) && !seen.has(c.char)) {
          results.push(c);
          seen.add(c.char);
          if (results.length >= 8) break;
        }
      }
    }
    return results;
  }, [buffer, sim500.chars, sim1067.chars, sim1067.byChar]);

  const lookupEntries = useMemo(() => {
    const trimmed = lookupInput.trim();
    if (!trimmed) return [];
    const found: SingleKeyCharEntry[] = [];
    const seen = new Set<string>();
    for (const ch of Array.from(trimmed)) {
      if (seen.has(ch)) continue;
      const entry = sim1067.byChar.get(ch);
      if (entry) {
        found.push(entry);
        seen.add(ch);
      }
    }
    return found;
  }, [lookupInput, sim1067.byChar]);

  // Flash key highlight
  const flashKey = useCallback((k: string) => {
    setLastStruckKey(k);
    window.setTimeout(() => {
      setLastStruckKey((prev) => (prev === k ? null : prev));
    }, 150);
  }, []);

  // Unified key handler for both physical keyboard and on-screen key clicks
  const handleLetterInput = useCallback(
    (rawKey: string) => {
      const key = rawKey.toLowerCase();
      if (!/^[a-z]$/.test(key)) return;
      flashKey(key);

      if (writeMode === 'passage') {
        if (passageDone || !activePassageEntry) return;
        const expected = activePassageEntry.code[passageStep];
        if (!expected) return;

        if (key === expected) {
          synth.playClick();
          setPassageMistakeKey(null);
          const now = performance.now();
          if (lastKeyTsRef.current !== null) {
            const delta = Math.round(now - lastKeyTsRef.current);
            if (delta > 20 && delta < 2500) {
              setKeyTimesMs((prev) => [...prev.slice(-39), delta]);
            }
          }
          lastKeyTsRef.current = now;

          if (passageStep + 1 >= activePassageEntry.code.length) {
            setPassagePos((p) => p + 1);
            setPassageStep(0);
            setPassageCompletedCount((c) => c + 1);
          } else {
            setPassageStep((s) => s + 1);
          }
        } else {
          setPassageMistakeKey(key);
          window.setTimeout(() => {
            setPassageMistakeKey((prev) => (prev === key ? null : prev));
          }, 260);
        }
        return;
      }

      // === FREE DRAFTING MODE (100% 4-key self-delimiting + X swaps 2nd candidate) ===
      if (key === 'x') {
        // X is 0% used in encoding: swaps to next candidate if a collision just committed!
        if (buffer.length === 0 && lastSwapOptions && lastSwapOptions.chars.length > 1) {
          synth.playClick();
          const nextIdx = (lastSwapOptions.selectedIdx + 1) % lastSwapOptions.chars.length;
          const nextChar = lastSwapOptions.chars[nextIdx];
          setDraftText((prev) =>
            prev.length > 0 ? prev.slice(0, -1) + nextChar : nextChar
          );
          setLastSwapOptions({ ...lastSwapOptions, selectedIdx: nextIdx });
        } else if (buffer.length > 0 && freeCandidates.length > 1) {
          synth.playClick();
          const chosen = freeCandidates[1];
          setDraftText((prev) => prev + chosen.char);
          setBuffer('');
          setLastSwapOptions(null);
        }
        return;
      }

      synth.playClick();
      const nextBuf = buffer + key;
      if (nextBuf.length < 4) {
        setBuffer(nextBuf);
        setLastSwapOptions(null);
      } else {
        // 4th key reached -> 100% self-delimiting auto-commit!
        const exactGroup = sim1067.byCode.get(nextBuf) ?? [];
        if (exactGroup.length > 0) {
          // Order by Simp 500 membership first
          const ordered = [...exactGroup].sort((a, b) => {
            const a500 = sim500.byChar.has(a.char) ? 0 : 1;
            const b500 = sim500.byChar.has(b.char) ? 0 : 1;
            return a500 - b500;
          });
          setDraftText((prev) => prev + ordered[0].char);
          setBuffer('');
          if (ordered.length > 1) {
            setLastSwapOptions({
              code: nextBuf,
              chars: ordered.map((e) => e.char),
              selectedIdx: 0,
            });
          } else {
            setLastSwapOptions(null);
          }
        } else {
          // No match for this 4-key combo: clear cleanly without polluting manuscript
          setBuffer('');
          setLastSwapOptions(null);
        }
      }
    },
    [
      activePassageEntry,
      buffer,
      flashKey,
      freeCandidates,
      lastSwapOptions,
      passageDone,
      passageStep,
      sim1067.byCode,
      sim500.byChar,
      writeMode,
    ]
  );

  // Physical keyboard listener on 'write' tab
  useEffect(() => {
    if (activeTab !== 'write') return;

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
        handleLetterInput(e.key);
        return;
      }

      if (writeMode === 'passage') {
        if (e.key === 'Backspace' && passageStep > 0) {
          e.preventDefault();
          setPassageStep((s) => Math.max(0, s - 1));
        } else if (e.key === 'Enter' && passageDone) {
          e.preventDefault();
          resetPassage((passageIdx + 1) % WRITER_PASSAGES.length);
        }
        return;
      }

      // Free drafting controls
      if (e.key === ' ') {
        e.preventDefault();
        if (buffer.length > 0 && freeCandidates.length > 0) {
          synth.playClick();
          setDraftText((prev) => prev + freeCandidates[0].char);
          setBuffer('');
          setLastSwapOptions(null);
        } else {
          setDraftText((prev) => prev + ' ');
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (buffer.length > 0) {
          setBuffer((b) => b.slice(0, -1));
        } else {
          setDraftText((prev) => prev.slice(0, -1));
          setLastSwapOptions(null);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setBuffer('');
        setLastSwapOptions(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (buffer.length > 0 && freeCandidates.length > 0) {
          setDraftText((prev) => prev + freeCandidates[0].char);
          setBuffer('');
        } else {
          setDraftText((prev) => prev + '\n');
        }
        setLastSwapOptions(null);
      } else if (/^[1-8]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        if (buffer.length > 0 && freeCandidates[idx]) {
          e.preventDefault();
          synth.playClick();
          setDraftText((prev) => prev + freeCandidates[idx].char);
          setBuffer('');
          setLastSwapOptions(null);
        } else if (
          buffer.length === 0 &&
          lastSwapOptions &&
          lastSwapOptions.chars[idx]
        ) {
          e.preventDefault();
          synth.playClick();
          setDraftText((prev) =>
            prev.length > 0
              ? prev.slice(0, -1) + lastSwapOptions.chars[idx]
              : lastSwapOptions.chars[idx]
          );
          setLastSwapOptions({ ...lastSwapOptions, selectedIdx: idx });
        }
      } else if (CN_PUNCT_MAP[e.key]) {
        e.preventDefault();
        synth.playClick();
        if (buffer.length > 0 && freeCandidates.length > 0) {
          setDraftText((prev) => prev + freeCandidates[0].char + CN_PUNCT_MAP[e.key]);
          setBuffer('');
        } else {
          setDraftText((prev) => prev + CN_PUNCT_MAP[e.key]);
        }
        setLastSwapOptions(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    buffer,
    freeCandidates,
    handleLetterInput,
    lastSwapOptions,
    passageDone,
    passageIdx,
    passageStep,
    resetPassage,
    writeMode,
  ]);

  const handleCopyDraft = useCallback(() => {
    if (!draftText) return;
    navigator.clipboard?.writeText(draftText).catch(() => {});
    setCopiedDraft(true);
    window.setTimeout(() => setCopiedDraft(false), 1600);
  }, [draftText]);

  const avgMsPerKey = useMemo(() => {
    if (keyTimesMs.length === 0) return null;
    const sum = keyTimesMs.reduce((a, b) => a + b, 0);
    return Math.round(sum / keyTimesMs.length);
  }, [keyTimesMs]);

  const passageAltPct = useMemo(() => {
    let pairs = 0;
    let alt = 0;
    let prevHand: 'L' | 'R' | null = null;
    for (const idx of passageHanziIndices) {
      const entry = sim1067.byChar.get(passageChars[idx]);
      if (!entry) continue;
      for (const s of entry.steps) {
        if (prevHand !== null) {
          pairs++;
          if (prevHand !== s.hand) alt++;
        }
        prevHand = s.hand;
      }
    }
    return pairs > 0 ? Math.round((alt / pairs) * 100) : 0;
  }, [passageChars, passageHanziIndices, sim1067.byChar]);

  const expectedKey =
    writeMode === 'passage' &&
    activePassageEntry &&
    !passageDone &&
    (hintLevel === 'full' || (hintLevel === 'fade' && passageCompletedCount < 4))
      ? activePassageEntry.code[passageStep]
      : null;

  const selectedAtlasFamily = WRITER_25_MAP.get(selectedAtlasKey) ?? null;
  const selectedAtlasRadicals = sim1067.radicalsByKey.get(selectedAtlasKey) ?? [];
  const selectedAtlasSamples = useMemo(() => {
    return sim500.chars.filter((c) => c.code[0] === selectedAtlasKey).slice(0, 14);
  }, [selectedAtlasKey, sim500.chars]);

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
            素形单键
          </span>
        </div>

        {/* Zone 2: 3 Clean Editorial Nav Tabs */}
        <nav
          aria-label="素形单键工坊视图"
          className="flex items-center gap-6 text-sm font-medium"
        >
          {(
            [
              { id: 'write', label: '临纸试写' },
              { id: 'atlas', label: '二十五键图谱' },
              { id: 'audit', label: '手感对照' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setActiveTab(tab.id);
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

        {/* Zone 3: Theme + Audio Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="视觉色系"
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
            aria-label={muted ? '开启按键音效' : '静音'}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* ==================== MAIN SCROLLABLE WORKSPACE ==================== */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-8">
          {/* ==================== TAB 1: 临纸试写 (FOCUSED WRITER'S DESK) ==================== */}
          {activeTab === 'write' && (
            <>
              {/* Quiet Workspace Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--dojo-text-bright)] text-balance">
                    告别声音惯性，以单键纯形直接落墨
                  </h1>
                  <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)]">
                    25 键视觉分族 · 零音托 · 零并击 · 零 X 键 · 四码定长满键自动上屏（100% 自分割）
                  </p>
                </div>

                {/* Mode Switcher: 选段实测 | 自由起草 */}
                <div
                  role="tablist"
                  aria-label="书写模式"
                  className="inline-flex items-center p-1 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={writeMode === 'passage'}
                    onClick={() => {
                      synth.playClick();
                      setWriteMode('passage');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      writeMode === 'passage'
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    选段实测
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={writeMode === 'free'}
                    onClick={() => {
                      synth.playClick();
                      setWriteMode('free');
                    }}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      writeMode === 'free'
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    自由起草
                  </button>
                </div>
              </div>

              {/* PRIMARY FOCAL ANCHOR: THE MANUSCRIPT DESK */}
              {writeMode === 'passage' ? (
                <section
                  aria-label="文学选段单键实测稿纸"
                  className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 sm:p-8 space-y-6"
                >
                  {/* Passage Selector & Hint Level */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--dojo-border)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {WRITER_PASSAGES.map((p, idx) => {
                        const active = idx === passageIdx;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              resetPassage(idx);
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              active
                                ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                            }`}
                          >
                            {p.title}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center p-0.5 rounded-md bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                        {(
                          [
                            { id: 'full', label: '显码' },
                            { id: 'fade', label: '渐隐' },
                            { id: 'blind', label: '盲打' },
                          ] as const
                        ).map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setHintLevel(h.id);
                            }}
                            className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              hintLevel === h.id
                                ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-medium'
                                : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                            }`}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          resetPassage();
                        }}
                        title="重新书写本段"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] rounded-md border border-[var(--dojo-border)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>重写</span>
                      </button>
                    </div>
                  </div>

                  {/* Manuscript Text Line */}
                  <div className="py-4 sm:py-6">
                    <p className="text-xs text-[var(--dojo-text-muted)] mb-4">
                      {currentPassage.note}
                    </p>
                    <div className="font-display text-2xl sm:text-4xl leading-[1.9] tracking-[0.14em] select-none">
                      {passageChars.map((ch, idx) => {
                        const hanziRank = passageHanziIndices.indexOf(idx);
                        const isTarget = hanziRank !== -1;
                        const isCompleted = isTarget
                          ? hanziRank < passagePos
                          : passageDone ||
                            idx < (passageHanziIndices[passagePos] ?? passageChars.length);
                        const isCurrent = isTarget && hanziRank === passagePos;

                        return (
                          <span
                            key={`${currentPassage.id}-${idx}`}
                            className={`inline-block transition-colors duration-150 ${
                              isCurrent
                                ? 'text-[var(--dojo-text-bright)] border-b-2 border-[var(--dojo-crimson)] pb-0.5'
                                : isCompleted
                                  ? 'text-[var(--dojo-text-bright)]'
                                  : 'text-[var(--dojo-text-muted)]/55'
                            }`}
                          >
                            {ch}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Character 4-Key Visual Formula Strip */}
                  {!passageDone && activePassageEntry ? (
                    <div className="pt-5 border-t border-[var(--dojo-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-display text-4xl font-bold text-[var(--dojo-text-bright)] leading-none">
                          {activePassageEntry.char}
                        </span>
                        <div className="text-xs text-[var(--dojo-text-sub)] space-y-1">
                          <div>
                            拆根：{activePassageEntry.parts.join(' · ')}
                          </div>
                          <div className="font-mono-tabular text-[var(--dojo-text-muted)]">
                            本字交替 {activePassageEntry.alternationPct}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2.5 flex-1 max-w-xl">
                        {activePassageEntry.steps.map((step, sIdx) => {
                          const typed = sIdx < passageStep;
                          const isCurr = sIdx === passageStep;
                          const hideKey =
                            hintLevel === 'blind' ||
                            (hintLevel === 'fade' && passageCompletedCount >= 4 && !typed);

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
                              <div className="flex items-baseline justify-between gap-1">
                                <span
                                  className={`font-mono-tabular text-lg font-bold ${
                                    typed
                                      ? 'text-[var(--dojo-pine-text)]'
                                      : isCurr
                                        ? 'text-[var(--dojo-text-bright)]'
                                        : 'text-[var(--dojo-text-sub)]'
                                  }`}
                                >
                                  {hideKey ? '·' : step.key.toUpperCase()}
                                </span>
                                <span className="text-[11px] text-[var(--dojo-text-muted)]">
                                  {step.hand === 'L' ? '左' : '右'}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-[var(--dojo-text-sub)] truncate">
                                {step.roleLabel}
                              </div>
                              <div className="text-[11px] text-[var(--dojo-text-muted)] truncate">
                                {hideKey ? step.radical : step.visualCue}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-5 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-4">
                      <div className="text-sm text-[var(--dojo-text-bright)]">
                        本段已落墨完成 · 直接按 Enter 进入下一段，或切换至「自由起草」直接写作。
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            resetPassage((passageIdx + 1) % WRITER_PASSAGES.length);
                          }}
                          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          下一选段
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setWriteMode('free');
                          }}
                          className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--dojo-border-strong)] text-[var(--dojo-text)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          前往自由起草
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quiet Inline Cadence Readout (Zero Pills) */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono-tabular text-[var(--dojo-text-muted)]">
                    <span>
                      进度 {passagePos}/{passageHanziIndices.length} 字
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>本段左右手交替 {passageAltPct}%</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {avgMsPerKey !== null ? `均速 ${avgMsPerKey} ms/键` : '直接敲击实体键盘即可开始'}
                    </span>
                    {passageMistakeKey && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--dojo-crimson-text)]">
                          误触 {passageMistakeKey.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>
                </section>
              ) : (
                /* FREE DRAFTING PURE-SHAPE MANUSCRIPT DESK */
                <section
                  aria-label="自由起草纯形稿纸"
                  className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 sm:p-8 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--dojo-border)]">
                    <div className="text-xs text-[var(--dojo-text-sub)]">
                      满 4 键自动落字 · 1–3 键按 Space 可直出首候 · 遇重码按 X 或 2 原地换字 · 支持 , . ? ! ; : 自动转中文标点
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyDraft}
                        disabled={!draftText}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--dojo-border)] text-[var(--dojo-text)] hover:text-[var(--dojo-text-bright)] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {copiedDraft ? (
                          <Check className="w-3.5 h-3.5 text-[var(--dojo-pine)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedDraft ? '已复制' : '复制文稿'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setDraftText('');
                          setBuffer('');
                          setLastSwapOptions(null);
                        }}
                        disabled={!draftText && !buffer}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>清空</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Manuscript Sheet */}
                  <div className="min-h-[168px] rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] p-5 sm:p-6">
                    <div className="font-display text-2xl sm:text-3xl leading-[1.85] tracking-[0.08em] text-[var(--dojo-text-bright)] whitespace-pre-wrap break-words">
                      {draftText ? (
                        draftText
                      ) : !buffer ? (
                        <span className="text-[var(--dojo-text-muted)]/60 text-lg font-sans tracking-normal">
                          直接敲击实体键盘，例如输入 K C U R（明）、L G O F（墨）、Y D N F（安），满四键即自动落墨。
                        </span>
                      ) : null}
                      {buffer && (
                        <span className="inline-block ml-1 px-1.5 py-0.5 rounded font-mono-tabular text-base align-middle bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]">
                          {buffer.toUpperCase()}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className="inline-block w-[2px] h-6 ml-0.5 align-middle bg-[var(--dojo-crimson)]"
                      />
                    </div>
                  </div>

                  {/* Inline Candidate / Swap Strip */}
                  <div className="min-h-[36px] flex flex-wrap items-center justify-between gap-3 text-xs">
                    {buffer.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[var(--dojo-text-muted)] font-mono-tabular">
                          候选 ({buffer.toUpperCase()}):
                        </span>
                        {freeCandidates.length > 0 ? (
                          freeCandidates.map((cand, idx) => (
                            <button
                              key={cand.char}
                              type="button"
                              onClick={() => {
                                synth.playClick();
                                setDraftText((prev) => prev + cand.char);
                                setBuffer('');
                                setLastSwapOptions(null);
                              }}
                              className="inline-flex items-baseline gap-1 px-2 py-1 rounded hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
                            >
                              <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
                                {idx + 1}
                              </span>
                              <span className="font-display text-base text-[var(--dojo-text-bright)]">
                                {cand.char}
                              </span>
                              <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
                                {cand.code.slice(buffer.length).toUpperCase()}
                              </span>
                            </button>
                          ))
                        ) : (
                          <span className="text-[var(--dojo-text-muted)]">
                            当前前缀无匹配字 · 按 Esc 清除
                          </span>
                        )}
                      </div>
                    ) : lastSwapOptions ? (
                      <div className="flex flex-wrap items-center gap-3 text-[var(--dojo-text-sub)]">
                        <span>
                          已落「{lastSwapOptions.chars[lastSwapOptions.selectedIdx]}」
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>按 X 或数字键原地切换：</span>
                        {lastSwapOptions.chars.map((ch, idx) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setDraftText((prev) =>
                                prev.length > 0 ? prev.slice(0, -1) + ch : ch
                              );
                              setLastSwapOptions({ ...lastSwapOptions, selectedIdx: idx });
                            }}
                            className={`px-2 py-0.5 rounded font-display text-sm cursor-pointer ${
                              idx === lastSwapOptions.selectedIdx
                                ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-bold'
                                : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                            }`}
                          >
                            {idx + 1}.{ch}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--dojo-text-muted)] font-mono-tabular">
                        已写 {Array.from(draftText.replace(/\s/g, '')).length} 字 · 支持 1,067 个常用简体字实时四码输入
                      </span>
                    )}

                    {/* Inline Forget-Shape Lookup */}
                    <div className="relative flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-[var(--dojo-text-muted)] shrink-0" />
                      <input
                        ref={lookupRef}
                        type="text"
                        value={lookupInput}
                        onChange={(e) => setLookupInput(e.target.value)}
                        placeholder="忘形反查：输入汉字查四码…"
                        className="w-48 sm:w-56 px-2.5 py-1 text-xs rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text)] placeholder:text-[var(--dojo-text-muted)] focus:outline-none focus:border-[var(--dojo-border-strong)]"
                      />
                    </div>
                  </div>

                  {/* Lookup Result Bar */}
                  {lookupEntries.length > 0 && (
                    <div className="pt-3 border-t border-[var(--dojo-border)] flex flex-wrap items-center gap-4 text-xs">
                      {lookupEntries.map((item) => (
                        <div key={item.char} className="flex items-center gap-2">
                          <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                            {item.char}
                          </span>
                          <span className="font-mono-tabular font-semibold text-[var(--dojo-ochre)]">
                            {item.displayCode}
                          </span>
                          <span className="text-[var(--dojo-text-muted)]">
                            ({item.steps.map((s) => s.visualCue).join(' → ')})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* TACTILE SINGLE-KEY 26-LETTER DECK */}
              <section
                aria-label="单键纯形键盘导视"
                className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-5 sm:p-6 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--dojo-text-muted)]">
                  <span>实体单键映射 · 左手 14 键（横/撇/折） · 右手 11 键（框/竖/点）</span>
                  <span>X 键 0% 参与编码（专作重码选二）</span>
                </div>

                <div className="overflow-x-auto pb-1">
                  <div className="min-w-[640px] flex flex-col gap-2">
                    {QWERTY_ROWS.map((row, rIdx) => (
                      <div
                        key={rIdx}
                        className="flex items-center justify-center gap-1.5"
                        style={{
                          paddingLeft: rIdx === 1 ? '18px' : rIdx === 2 ? '40px' : '0px',
                        }}
                      >
                        {row.map((cell, cIdx) => {
                          const fam = WRITER_25_MAP.get(cell.key);
                          const isExpected = expectedKey === cell.key;
                          const isStruck = lastStruckKey === cell.key;
                          const isMistake = passageMistakeKey === cell.key;
                          const isX = cell.key === 'x';
                          const addCenterGap =
                            cIdx > 0 && row[cIdx - 1].hand === 'L' && cell.hand === 'R';

                          return (
                            <button
                              key={cell.key}
                              type="button"
                              onClick={() => handleLetterInput(cell.key)}
                              style={{ marginLeft: addCenterGap ? '18px' : undefined }}
                              className={`keycap-surface w-[54px] h-[52px] rounded-lg border flex flex-col items-center justify-center select-none cursor-pointer ${
                                isMistake
                                  ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] scale-95'
                                  : isExpected
                                    ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson)] text-white shadow-sm'
                                    : isStruck
                                      ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)] scale-95'
                                      : isX
                                        ? 'border-dashed border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]/45 text-[var(--dojo-text-muted)]'
                                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:border-[var(--dojo-border-strong)] text-[var(--dojo-text)]'
                              }`}
                            >
                              <span className="font-mono-tabular text-sm font-bold leading-none">
                                {cell.key.toUpperCase()}
                              </span>
                              <span
                                className={`mt-1 text-[11px] leading-none ${
                                  isExpected
                                    ? 'text-white/90'
                                    : isX
                                      ? 'text-[var(--dojo-text-muted)]'
                                      : 'text-[var(--dojo-text-sub)]'
                                }`}
                              >
                                {isX ? '选二' : fam?.soloLeader}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ==================== TAB 2: 二十五键图谱 (3-MINUTE RULE & ATLAS) ==================== */}
          {activeTab === 'atlas' && (
            <div className="space-y-8">
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--dojo-text-bright)]">
                  二十五键纯形图谱与四码定长法则
                </h1>
                <p className="text-sm text-[var(--dojo-text-sub)]">
                  不背字根口诀，不借拼音音托。左手管横撇折、右手管框竖点，收笔自动走异手，满四键即自动成字。
                </p>
              </div>

              {/* Rule 1 & Rule 2 Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* 4-Key Fixed Rule */}
                <section className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                    01. 四码定长取码法则（100% 自分割）
                  </h2>
                  <dl className="divide-y divide-[var(--dojo-border)] text-sm">
                    <div className="py-2.5 flex items-baseline justify-between gap-4">
                      <dt className="font-medium text-[var(--dojo-text-bright)] shrink-0">
                        4 根及以上
                      </dt>
                      <dd className="text-[var(--dojo-text-sub)] text-right">
                        首根 + 次根 + 三根 + 末根（顺笔取 4 根）
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-baseline justify-between gap-4">
                      <dt className="font-medium text-[var(--dojo-text-bright)] shrink-0">
                        3 根字
                      </dt>
                      <dd className="text-[var(--dojo-text-sub)] text-right">
                        首根 + 次根 + 末根 + 异手末根收笔
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-baseline justify-between gap-4">
                      <dt className="font-medium text-[var(--dojo-text-bright)] shrink-0">
                        2 根字
                      </dt>
                      <dd className="text-[var(--dojo-text-sub)] text-right">
                        首根 + 末根 + 异手首根收笔 + 异手末根收笔
                      </dd>
                    </div>
                    <div className="py-2.5 flex items-baseline justify-between gap-4">
                      <dt className="font-medium text-[var(--dojo-text-bright)] shrink-0">
                        独体 1 根字
                      </dt>
                      <dd className="text-[var(--dojo-text-sub)] text-right">
                        本根 + 异手末笔 + 异手次笔 + 异手画数
                      </dd>
                    </div>
                  </dl>
                </section>

                {/* Mirror Closing-Stroke Table */}
                <section className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                    02. 异手镜像收笔表（零小指 · 零 X）
                  </h2>
                  <p className="text-xs text-[var(--dojo-text-sub)]">
                    上一键在左手就用右手落收笔，上一键在右手就用左手落收笔——天然保持 75% 左右交替。
                  </p>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--dojo-border)] text-[var(--dojo-text-muted)]">
                        <th className="py-2 font-medium">末笔</th>
                        <th className="py-2 font-medium">左手 ≤3画</th>
                        <th className="py-2 font-medium">左手 ≥4画</th>
                        <th className="py-2 font-medium">右手 ≤3画</th>
                        <th className="py-2 font-medium">右手 ≥4画</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dojo-border)] font-mono-tabular">
                      {MIRROR_STROKE_ENDINGS.map((row) => (
                        <tr key={row.stroke}>
                          <td className="py-2 font-sans text-[var(--dojo-text-bright)] font-medium">
                            {row.symbol} {row.name}
                          </td>
                          <td className="py-2 text-[var(--dojo-text)]">
                            {row.leftShort.toUpperCase()}
                          </td>
                          <td className="py-2 text-[var(--dojo-text-sub)]">
                            {row.leftLong.toUpperCase()}
                          </td>
                          <td className="py-2 text-[var(--dojo-text)]">
                            {row.rightShort.toUpperCase()}
                          </td>
                          <td className="py-2 text-[var(--dojo-text-sub)]">
                            {row.rightLong.toUpperCase()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>

              {/* 25-Key Interactive Families */}
              <section className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Hand 14 Keys */}
                  <div className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 space-y-5">
                    <div className="flex items-baseline justify-between">
                      <h2 className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                        左手 14 键 · 横 / 撇 / 折
                      </h2>
                      <span className="text-xs text-[var(--dojo-text-muted)]">
                        X 键留白不参与编码
                      </span>
                    </div>
                    {LEFT_ZONES.map((zone) => {
                      const items = WRITER_25_FAMILIES.filter((f) => f.zone === zone);
                      return (
                        <div key={zone} className="space-y-2">
                          <div className="text-xs font-medium text-[var(--dojo-text-muted)]">
                            {zone}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map((fam) => {
                              const active = selectedAtlasKey === fam.key;
                              return (
                                <button
                                  key={fam.key}
                                  type="button"
                                  onClick={() => {
                                    synth.playClick();
                                    setSelectedAtlasKey(fam.key);
                                  }}
                                  className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                                    active
                                      ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-surface-2)]'
                                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:border-[var(--dojo-border-strong)]'
                                  }`}
                                >
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-mono-tabular text-sm font-bold text-[var(--dojo-text-bright)]">
                                      {fam.key.toUpperCase()} · {fam.shortTag}
                                    </span>
                                    <span className="font-display text-base text-[var(--dojo-ochre)]">
                                      {fam.soloLeader}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-[var(--dojo-text-muted)] truncate">
                                    {fam.radicals.slice(0, 9).join(' ')}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Hand 11 Keys */}
                  <div className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 space-y-5">
                    <div className="flex items-baseline justify-between">
                      <h2 className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                        右手 11 键 · 框 / 竖 / 点
                      </h2>
                      <span className="text-xs text-[var(--dojo-text-muted)]">
                        覆盖全部 269 宇浩官方字根
                      </span>
                    </div>
                    {RIGHT_ZONES.map((zone) => {
                      const items = WRITER_25_FAMILIES.filter((f) => f.zone === zone);
                      return (
                        <div key={zone} className="space-y-2">
                          <div className="text-xs font-medium text-[var(--dojo-text-muted)]">
                            {zone}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map((fam) => {
                              const active = selectedAtlasKey === fam.key;
                              return (
                                <button
                                  key={fam.key}
                                  type="button"
                                  onClick={() => {
                                    synth.playClick();
                                    setSelectedAtlasKey(fam.key);
                                  }}
                                  className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                                    active
                                      ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-surface-2)]'
                                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:border-[var(--dojo-border-strong)]'
                                  }`}
                                >
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-mono-tabular text-sm font-bold text-[var(--dojo-text-bright)]">
                                      {fam.key.toUpperCase()} · {fam.shortTag}
                                    </span>
                                    <span className="font-display text-base text-[var(--dojo-ochre)]">
                                      {fam.soloLeader}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-[var(--dojo-text-muted)] truncate">
                                    {fam.radicals.slice(0, 9).join(' ')}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Family Inspector */}
                {selectedAtlasFamily && (
                  <div className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                        {selectedAtlasFamily.label}
                      </h3>
                      <span className="text-xs text-[var(--dojo-text-muted)]">
                        {selectedAtlasFamily.fingerLabel} · {selectedAtlasFamily.zone} · 收录{' '}
                        {selectedAtlasRadicals.length} 个官方字根
                      </span>
                    </div>
                    <p className="text-sm text-[var(--dojo-text-sub)]">
                      {selectedAtlasFamily.rule}
                    </p>
                    <div className="flex flex-wrap gap-2 text-lg font-display text-[var(--dojo-text-bright)]">
                      {selectedAtlasRadicals.map((r) => (
                        <span
                          key={r.radical}
                          className="px-2.5 py-1 rounded bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]"
                        >
                          {r.radical}
                        </span>
                      ))}
                    </div>

                    {selectedAtlasSamples.length > 0 && (
                      <div className="pt-4 border-t border-[var(--dojo-border)] space-y-2.5">
                        <div className="text-xs text-[var(--dojo-text-muted)]">
                          常用例字（点击查看四码拆解）
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedAtlasSamples.map((sample) => {
                            const active = inspectedChar?.char === sample.char;
                            return (
                              <button
                                key={sample.char}
                                type="button"
                                onClick={() => {
                                  synth.playClick();
                                  setInspectedChar(sample);
                                }}
                                className={`inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors cursor-pointer ${
                                  active
                                    ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                    : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text)] hover:border-[var(--dojo-border-strong)]'
                                }`}
                              >
                                <span className="font-display text-base">{sample.char}</span>
                                <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                                  {sample.code.toUpperCase()}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {inspectedChar && (
                          <div className="pt-3 text-xs text-[var(--dojo-text-sub)] flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                              {inspectedChar.char}
                            </span>
                            <span className="font-mono-tabular text-[var(--dojo-ochre)] font-semibold">
                              {inspectedChar.displayCode}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {inspectedChar.steps
                                .map((s) => `${s.key.toUpperCase()}(${s.visualCue})`)
                                .join(' → ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ==================== TAB 3: 手感对照 (HONEST ERGONOMICS & COLLISION AUDIT) ==================== */}
          {activeTab === 'audit' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--dojo-text-bright)]">
                    实体键盘手感实测与重码透明清单
                  </h1>
                  <p className="text-sm text-[var(--dojo-text-sub)]">
                    所有指标均基于简体宇浩真实拆分实时计算，不隐藏任何重码对。
                  </p>
                </div>

                <div className="inline-flex items-center p-1 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                  {(
                    [
                      { id: 'common500', label: '简体常用 500' },
                      { id: 'full1448', label: '简体全量 1,067' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setAuditStage(st.id);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        auditStage === st.id
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4-Column Quiet KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-5 space-y-1">
                  <div className="text-xs text-[var(--dojo-text-muted)]">首选唯一率</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[var(--dojo-text-bright)]">
                    {activeAuditSim.metrics.firstChoiceRate.toFixed(2)}%
                  </div>
                  <div className="text-xs text-[var(--dojo-text-sub)] font-mono-tabular">
                    重码 {activeAuditSim.metrics.collisionChars} 字 / 共 {activeAuditSim.metrics.totalChars} 字
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-5 space-y-1">
                  <div className="text-xs text-[var(--dojo-text-muted)]">左右手交替率</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[var(--dojo-text-bright)]">
                    {activeAuditSim.metrics.handAlternationPct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[var(--dojo-text-sub)] font-mono-tabular">
                    左手 {activeAuditSim.metrics.leftHandPct.toFixed(1)}% · 右手{' '}
                    {activeAuditSim.metrics.rightHandPct.toFixed(1)}%
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-5 space-y-1">
                  <div className="text-xs text-[var(--dojo-text-muted)]">同指连击率 (SFB)</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[var(--dojo-text-bright)]">
                    {activeAuditSim.metrics.sfbPct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[var(--dojo-text-sub)]">
                    低于英文 QWERTY（约 7–10%）
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-5 space-y-1">
                  <div className="text-xs text-[var(--dojo-text-muted)]">X 键使用率 · 自分割</div>
                  <div className="font-mono-tabular text-3xl font-bold text-[var(--dojo-text-bright)]">
                    {activeAuditSim.metrics.xKeyPct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[var(--dojo-text-sub)]">
                    四码定长自动上屏 · 零空格
                  </div>
                </div>
              </div>

              {/* Honest Comparison: Single-Key Pure Shape vs Piano Chord */}
              <section className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                    普通实体键盘上的真实差异：单键素形四码 vs 双手并击
                  </h2>
                  {onOpenChordLab && (
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        onOpenChordLab();
                      }}
                      className="text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] underline underline-offset-4 cursor-pointer"
                    >
                      切回早期并击实验对照
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--dojo-border)] text-xs text-[var(--dojo-text-muted)]">
                        <th className="py-2.5 pr-4 font-medium">维度</th>
                        <th className="py-2.5 px-4 font-medium text-[var(--dojo-text-bright)]">
                          单键素形四码（25 键无 X）
                        </th>
                        <th className="py-2.5 pl-4 font-medium">双手钢琴并击（A 方案）</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--dojo-border)] text-[var(--dojo-text-sub)]">
                      <tr>
                        <td className="py-3 pr-4 font-medium text-[var(--dojo-text)]">物理施力</td>
                        <td className="py-3 px-4 text-[var(--dojo-text-bright)]">
                          单指轻点 1× 触发力，靠左右惯性滚指，长文写作不累
                        </td>
                        <td className="py-3 pl-4">
                          双指同步压下 2× 触发力并同步抬起，普通键盘久打易紧绷
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-medium text-[var(--dojo-text)]">自分割连续性</td>
                        <td className="py-3 px-4 text-[var(--dojo-text-bright)]">
                          100% 自分割（满四键自动落字，全程无需敲空格）
                        </td>
                        <td className="py-3 pl-4">
                          拍数不定（1–4 拍），非自分割，需空格或末拍带空格定界
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-medium text-[var(--dojo-text)]">
                          简体 500 / 1,067 首选
                        </td>
                        <td className="py-3 px-4 font-mono-tabular text-[var(--dojo-text-bright)]">
                          {sim500.metrics.firstChoiceRate.toFixed(2)}% /{' '}
                          {sim1067.metrics.firstChoiceRate.toFixed(2)}%
                        </td>
                        <td className="py-3 pl-4 font-mono-tabular">99.40% / 99.72%</td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-medium text-[var(--dojo-text)]">节奏感</td>
                        <td className="py-3 px-4 text-[var(--dojo-text-bright)]">
                          恒定四拍流水，左右交替 {sim500.metrics.handAlternationPct.toFixed(1)}%，适合沉浸式文学起草
                        </td>
                        <td className="py-3 pl-4">
                          每字 2.45–2.65 拍，更适合极轻触发压力的专用速录硬件
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Transparent Collision Audit List */}
              <section className="rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] p-6 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                    当前字集全部重码对（{activeAuditSim.collisions.length} 组）
                  </h2>
                  <span className="text-xs text-[var(--dojo-text-muted)]">
                    自由起草时满四键自动上首选，按 X 键即可原地切换次选
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {activeAuditSim.collisions.map((group) => (
                    <div
                      key={group.code}
                      className="rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] px-3 py-2 flex items-baseline justify-between gap-2"
                    >
                      <span className="font-display text-base text-[var(--dojo-text-bright)]">
                        {group.chars.map((c) => c.char).join(' / ')}
                      </span>
                      <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                        {group.code.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
