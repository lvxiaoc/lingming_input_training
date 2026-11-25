import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  RotateCcw,
  ScrollText,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  encodeLingmingRoots,
  getLingmingCharScript,
  LINGMING_CHAMBER_BY_KEY,
  LINGMING_CHAR_SPLITS,
  LINGMING_ROOT_MAP,
} from '../data/lingming';
import { LINGMING_SHORT_CODES } from '../data/lingmingShortCodes';
import { ALL_DRILL_CHARS } from '../data/drillLexicon';
import { HUANGTING_CHAR_MAP } from '../data/huangtingjing';
import {
  loadUserHuangtingOverrides,
  resolveHuangtingCharInfo,
} from '../data/huangtingOverrides';
import { XRAY_HANZI_BY_CHAR } from '../data/xrayHanziData';
import {
  computeTakenRootSpans,
  resolveDaSlotFromRootCodes,
  TakenRootSpan,
  useKeystrokeCloud,
  useKeystrokeCloudPulse,
} from '../data/keystrokeCloud';
import {
  CharScript,
  matchesScript,
  SCRIPT_MODE_OPTIONS,
  ScriptMode,
} from '../data/scriptFilter';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';
import { ColorSplitGlyph, getRootColor, RadicalSymbol } from './ColorSplitGlyph';
import { KeystrokeCloudToggle, KeystrokePalaceCloud } from './KeystrokePalaceCloud';

export type DecompositionTab = 'rules' | 'lookup' | 'check';

interface DecompositionLabProps {
  initialTab?: DecompositionTab;
  scriptMode: ScriptMode;
  onChangeScriptMode: (next: ScriptMode) => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  onOpenDrillStudio: () => void;
  onOpenHuangtingDojo: () => void;
}

export interface UnifiedCharBreakdown {
  char: string;
  code: string;
  shortCode?: string;
  roots: string[];
  rootCodes: string[];
  strokes?: string[];
  strokeRootIndices?: number[];
  script: CharScript;
  isHardSplit?: boolean;
  sourcePriority: number;
}

interface RuleSpec {
  id: 'order' | 'big' | 'cap4' | 'short';
  indexLabel: string;
  title: string;
  formula: string;
  summary: string;
  bullets: string[];
  samples: string[];
}

const RULE_SPECS: RuleSpec[] = [
  {
    id: 'order',
    indexLabel: '原則一',
    title: '依書寫筆順取根',
    formula: '先左後右 · 先上後下 · 先外後內',
    summary:
      '不需要背特殊順序表，完全順著平常寫漢字的落筆方向依序認出字根，手眼才會自然一致。',
    bullets: [
      '左右結構：左部先取，右部隨後（如：明、好、休、清）',
      '上下結構：頂部先取，底部件承接（如：字、安、思、香）',
      '包圍與走之底：被包圍或右上主體先寫時依筆順取，辶 作為末筆墊底（如：國、問、這、道）',
    ],
    samples: ['明', '好', '字', '思', '國', '這', '問', '道'],
  },
  {
    id: 'big',
    indexLabel: '原則二',
    title: '取大優先 · 完整字根不拆碎',
    formula: '先框最大整根 · 絕不把現成字根砍散',
    summary:
      '當一組筆畫已經完整對應記憶宮殿裡的某個字根時，就整塊直接取走，不去拆成更細碎的單筆畫。',
    bullets: [
      '「香」上方整塊是「禾」，下方整塊是「日」，二根直取，不拆成丿+木',
      '「意」拆成「立 + 日 + 心」，中間直接鎖定「日」根',
      '「拿」上半整塊「合」直接成根，再接下方「手」根',
    ],
    samples: ['香', '是', '意', '拿', '墨', '休', '鮮', '時'],
  },
  {
    id: 'cap4',
    indexLabel: '原則三',
    title: '數根取碼與四碼封頂',
    formula: '1 根全取 · 2 根合滿 · 3+ 根取一二(三)末，最長 4 鍵',
    summary:
      '無論漢字多複雜，最多只按 4 鍵。心裡默念口訣，依各根所在宮殿（大碼）與輔助鍵落指即可：',
    bullets: [
      '獨體字根字（1 根）：直接敲該字根全碼（如：木 xu、白 kba、大 yda）',
      '兩根合體字：首根大碼(1) + 末根全碼(2–3)，或雙大根各取 2 鍵補滿 4 碼',
      '三根字：取第 1、2 根與末根湊足 4 碼；四根以上：取「一、二、三、末」或大碼免三，絕不超過 4 碼',
    ],
    samples: ['木', '白', '林', '理', '想', '墨', '韶', '霞'],
  },
  {
    id: 'short',
    indexLabel: '原則四',
    title: '高頻字自結束簡碼（不求快但求順）',
    formula: '五韻母一簡 + 韻母鍵收尾的二／三碼直上',
    summary:
      '真正去寫作時，最常用的虛詞和連接詞不必打滿 4 碼：只要最後落到韻母鍵（a e i o u），系統就自動上屏，行文節奏絲滑。',
    bullets: [
      '一碼直上（五個高頻虛詞）：了(a) · 的(e) · 是(i) · 我(o) · 不(u)',
      '二碼直上：首根大碼 ＋ 末根韻母鍵（如：有 me · 這 ho · 你 ja · 在 fu）',
      '三碼直上：前兩鍵 ＋ 末根韻母鍵（如：道 cno · 們 jme · 爲/為 依實際詞表）',
    ],
    samples: ['的', '了', '是', '我', '不', '有', '這', '你', '道', '說'],
  },
];

const QUICK_LOOKUP_GROUPS: Array<{ id: string; label: string; chars: string[] }> = [
  {
    id: 'principles',
    label: '原則代表字',
    chars: ['明', '好', '香', '是', '意', '國', '這', '墨', '韶', '道', '理', '想'],
  },
  {
    id: 'hardsplit',
    label: '常見易猶豫字',
    chars: ['我', '在', '那', '看', '着', '爲', '發', '體', '經', '虛', '霞', '靈'],
  },
  {
    id: 'short',
    label: '高頻簡碼字',
    chars: ['的', '了', '是', '我', '不', '有', '這', '你', '說', '就', '很', '知'],
  },
];

function buildUnifiedLexicon(): Map<string, UnifiedCharBreakdown> {
  const map = new Map<string, UnifiedCharBreakdown>();

  const upsert = (entry: UnifiedCharBreakdown) => {
    const prev = map.get(entry.char);
    if (!prev || entry.sourcePriority > prev.sourcePriority) {
      map.set(entry.char, {
        ...(prev || {}),
        ...entry,
        shortCode: entry.shortCode || prev?.shortCode,
        strokes: entry.strokes && entry.strokes.length > 0 ? entry.strokes : prev?.strokes,
        strokeRootIndices:
          entry.strokeRootIndices && entry.strokeRootIndices.length > 0
            ? entry.strokeRootIndices
            : prev?.strokeRootIndices,
      });
    } else if (prev) {
      // Enrich missing stroke/shortCode metadata from lower-priority entries
      if (!prev.shortCode && entry.shortCode) prev.shortCode = entry.shortCode;
      if ((!prev.strokes || prev.strokes.length === 0) && entry.strokes?.length) {
        prev.strokes = entry.strokes;
        prev.strokeRootIndices = entry.strokeRootIndices;
      }
    }
  };

  // Priority 1: LINGMING_CHAR_SPLITS
  for (const [char, roots] of LINGMING_CHAR_SPLITS) {
    const encoded = encodeLingmingRoots(roots);
    const xray = XRAY_HANZI_BY_CHAR.get(char);
    let strokeRootIndices: number[] | undefined;
    if (xray) {
      strokeRootIndices = xray.strokes.map((_, sIdx) =>
        xray.targets.findIndex((tg) => tg.strokeIndices.includes(sIdx))
      );
    }
    upsert({
      char,
      code: encoded.code,
      roots,
      rootCodes: roots.map((r) => LINGMING_ROOT_MAP.get(r)?.ma || ''),
      strokes: xray?.strokes,
      strokeRootIndices,
      script: getLingmingCharScript(char),
      sourcePriority: 1,
    });
  }

  // Priority 2: ALL_DRILL_CHARS
  for (const d of ALL_DRILL_CHARS) {
    let strokeRootIndices: number[] | undefined;
    if (d.xray) {
      strokeRootIndices = d.xray.strokes.map((_, sIdx) =>
        d.xray!.targets.findIndex((tg) => tg.strokeIndices.includes(sIdx))
      );
    }
    upsert({
      char: d.char,
      code: d.code,
      roots: d.parts,
      rootCodes: d.rootDetails.map((rd) => rd.ma),
      strokes: d.xray?.strokes,
      strokeRootIndices,
      script: d.script,
      isHardSplit: d.isHardSplit,
      sourcePriority: 2,
    });
  }

  // Priority 3: HUANGTING_CHAR_MAP (hundreds of rich literary Hanzi with verified roots + MakeMeAHanzi strokes)
  const userOverrides = loadUserHuangtingOverrides();
  for (const ch of Object.keys(HUANGTING_CHAR_MAP)) {
    const resolved = resolveHuangtingCharInfo(ch, userOverrides);
    if (!resolved) continue;
    upsert({
      char: ch,
      code: resolved.code,
      shortCode: resolved.shortCode,
      roots: resolved.roots,
      rootCodes: resolved.rootCodes,
      strokes: resolved.strokes,
      strokeRootIndices: resolved.strokeRootIndices,
      script: getLingmingCharScript(ch),
      sourcePriority: 3,
    });
  }

  // Priority 4: LINGMING_SHORT_CODES (official fullCode + shortCode + strokes)
  for (const sc of LINGMING_SHORT_CODES) {
    upsert({
      char: sc.char,
      code: sc.fullCode,
      shortCode: sc.shortCode,
      roots: sc.roots,
      rootCodes: sc.rootCodes,
      strokes: sc.strokes,
      strokeRootIndices: sc.strokeRootIndices,
      script: getLingmingCharScript(sc.char),
      sourcePriority: 4,
    });
  }

  return map;
}

function buildRoleTags(code: string, spans: TakenRootSpan[]): Array<'da' | 'sheng' | 'yun'> {
  const tags: Array<'da' | 'sheng' | 'yun'> = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if ('aeiou'.includes(ch)) {
      tags.push('yun');
      continue;
    }
    const sp = spans.find((s) => s.codeStart >= 0 && i >= s.codeStart && i < s.codeEnd);
    if (sp) {
      const inRootIdx = sp.matchStart + (i - sp.codeStart);
      tags.push(inRootIdx === 0 ? 'da' : 'sheng');
    } else {
      tags.push(i === 0 ? 'da' : 'sheng');
    }
  }
  return tags;
}

function renderRoleLabel(role: 'da' | 'sheng' | 'yun', t: (s: string) => string): string {
  if (role === 'da') return t('大碼');
  if (role === 'yun') return t('韻碼');
  return t('聲碼');
}

function shuffleSlice<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export const DecompositionLab: React.FC<DecompositionLabProps> = ({
  initialTab = 'rules',
  scriptMode,
  onChangeScriptMode,
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBack,
  onOpenDrillStudio,
  onOpenHuangtingDojo,
}) => {
  const t = useUiText();
  const isWash = themeMode === 'wash';
  const { enabled: keystrokeCloudEnabled } = useKeystrokeCloud();
  const { pulse, visible, trigger, clear } = useKeystrokeCloudPulse(keystrokeCloudEnabled);

  const lexicon = useMemo(() => buildUnifiedLexicon(), []);

  const [tab, setTab] = useState<DecompositionTab>(initialTab);
  const [activeRuleId, setActiveRuleId] = useState<RuleSpec['id']>('order');
  const [selectedChar, setSelectedChar] = useState<string>('明');
  const [lookupQuery, setLookupQuery] = useState<string>('明好香國這意');
  const [quickGroupId, setQuickGroupId] = useState<string>('principles');
  const [useShortPractice, setUseShortPractice] = useState<boolean>(false);

  // Interactive practice state (shared cleanly across tabs)
  const [typed, setTyped] = useState<string>('');
  const [errorCue, setErrorCue] = useState<string | null>(null);
  const [imeWarning, setImeWarning] = useState<boolean>(false);
  const [completedFlash, setCompletedFlash] = useState<boolean>(false);

  // Check-tab state
  const checkPool = useMemo(() => {
    const all = Array.from(lexicon.values()).filter(
      (entry) =>
        matchesScript(entry.script, scriptMode) &&
        entry.roots.length >= 1 &&
        /^[a-z]{1,4}$/.test(entry.code)
    );
    // Prefer entries that have full stroke SVG paths so X-ray reveal is maximally helpful
    const withStrokes = all.filter((e) => e.strokes && e.strokes.length > 0);
    return withStrokes.length >= 16 ? withStrokes : all;
  }, [lexicon, scriptMode]);

  const [checkDeck, setCheckDeck] = useState<UnifiedCharBreakdown[]>([]);
  const [checkIdx, setCheckIdx] = useState<number>(0);
  const [checkReveal, setCheckReveal] = useState<boolean>(false);
  const [checkClearedCount, setCheckClearedCount] = useState<number>(0);

  const buildNewCheckDeck = useCallback(() => {
    const picked = shuffleSlice(checkPool, 12);
    setCheckDeck(picked);
    setCheckIdx(0);
    setCheckReveal(false);
    setCheckClearedCount(0);
    setTyped('');
    setErrorCue(null);
    clear();
  }, [checkPool, clear]);

  useEffect(() => {
    buildNewCheckDeck();
  }, [buildNewCheckDeck]);

  const activeRule = useMemo(
    () => RULE_SPECS.find((r) => r.id === activeRuleId) ?? RULE_SPECS[0],
    [activeRuleId]
  );

  // Resolve active breakdown entry based on current tab
  const lookupChars = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ch of Array.from(lookupQuery)) {
      if (/[\u4e00-\u9fff]/.test(ch) && !seen.has(ch)) {
        seen.add(ch);
        out.push(ch);
      }
    }
    return out;
  }, [lookupQuery]);

  const activeEntry: UnifiedCharBreakdown | null = useMemo(() => {
    if (tab === 'check') {
      return checkDeck[checkIdx] ?? null;
    }
    const found = lexicon.get(selectedChar);
    if (found) return found;
    return lexicon.get('明') ?? Array.from(lexicon.values())[0] ?? null;
  }, [tab, checkDeck, checkIdx, lexicon, selectedChar]);

  const targetCode = useMemo(() => {
    if (!activeEntry) return '';
    if (tab === 'rules' && activeRuleId === 'short' && activeEntry.shortCode) {
      return activeEntry.shortCode;
    }
    if (tab !== 'check' && useShortPractice && activeEntry.shortCode) {
      return activeEntry.shortCode;
    }
    return activeEntry.code;
  }, [activeEntry, tab, activeRuleId, useShortPractice]);

  const spans = useMemo(() => {
    if (!activeEntry) return [];
    return computeTakenRootSpans(activeEntry.code, activeEntry.rootCodes);
  }, [activeEntry]);

  const roleTags = useMemo(() => buildRoleTags(targetCode, spans), [targetCode, spans]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectCharacter = useCallback(
    (ch: string) => {
      synth.playClick();
      setSelectedChar(ch);
      setTyped('');
      setErrorCue(null);
      setCompletedFlash(false);
      clear();
    },
    [clear]
  );

  // Reset typed buffer when switching tabs, rule, or character
  useEffect(() => {
    setTyped('');
    setErrorCue(null);
    setCompletedFlash(false);
    clear();
  }, [tab, activeRuleId, useShortPractice, checkIdx, clear]);

  // Ensure selecting a rule automatically selects its first sample char if current isn't in rule
  const handleSelectRule = (rule: RuleSpec) => {
    synth.playClick();
    setActiveRuleId(rule.id);
    if (rule.samples.length > 0 && !rule.samples.includes(selectedChar)) {
      setSelectedChar(rule.samples[0]);
    }
  };

  // Keyboard listener for hands-on practice inside DecompositionLab
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.tagName === 'SELECT' ||
          targetEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
        return;
      }

      if (!activeEntry || !targetCode) return;

      if (e.key === 'Tab' && tab === 'check') {
        e.preventDefault();
        synth.playClick();
        setCheckReveal((prev) => !prev);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        setTyped('');
        setErrorCue(null);
        clear();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        setTyped((prev) => prev.slice(0, -1));
        setErrorCue(null);
        return;
      }

      if (e.key === 'Process' || e.isComposing) {
        setImeWarning(true);
        window.setTimeout(() => setImeWarning(false), 2600);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey || !/^[a-zA-Z]$/.test(e.key)) {
        return;
      }

      e.preventDefault();
      setImeWarning(false);
      const letter = e.key.toLowerCase();
      const pos = typed.length;
      const expected = targetCode[pos];
      if (!expected) return;

      const daSlot = resolveDaSlotFromRootCodes(
        activeEntry.code,
        activeEntry.roots,
        activeEntry.rootCodes,
        pos,
        spans
      );

      if (letter === expected) {
        setErrorCue(null);
        const nextTyped = typed + letter;
        if (daSlot) {
          trigger(
            daSlot.chamberKey,
            daSlot.radical,
            'hit',
            letter,
            nextTyped.length >= targetCode.length ? 1500 : 2100
          );
        }

        if (nextTyped.length >= targetCode.length) {
          synth.playKeyHit(0, true);
          setTyped('');
          setCompletedFlash(true);
          window.setTimeout(() => setCompletedFlash(false), 750);

          if (tab === 'check') {
            setCheckClearedCount((n) => n + 1);
            window.setTimeout(() => {
              setCheckReveal(false);
              setCheckIdx((prev) => (prev + 1 < checkDeck.length ? prev + 1 : 0));
            }, 340);
          } else if (tab === 'rules') {
            // Advance gently to next sample in the active rule
            const idx = activeRule.samples.indexOf(activeEntry.char);
            if (idx >= 0) {
              const nextChar = activeRule.samples[(idx + 1) % activeRule.samples.length];
              window.setTimeout(() => {
                setSelectedChar(nextChar);
              }, 420);
            }
          }
        } else {
          synth.playKeyHit(0, false);
          setTyped(nextTyped);
        }
      } else {
        synth.playKeyMiss();
        setErrorCue(
          `${t('應按')} ${expected.toUpperCase()}${
            LINGMING_CHAMBER_BY_KEY[expected]
              ? `（${LINGMING_CHAMBER_BY_KEY[expected].primaryAnchor}${t('宮')}）`
              : ''
          }`
        );
        if (daSlot) {
          trigger(daSlot.chamberKey, daSlot.radical, 'miss', letter, 2500);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeEntry,
    targetCode,
    tab,
    typed,
    spans,
    trigger,
    clear,
    onBack,
    activeRule,
    checkDeck.length,
    t,
  ]);

  const rootGlyphTextColor = (idx: number) => getRootColor(idx, themeMode, 1);

  return (
    <div className="relative z-10 w-full h-full flex flex-col bg-[var(--dojo-canvas)] wash:bg-transparent text-[var(--dojo-text)] overflow-hidden">
      {/* Top Bar — 3-Zone Contract */}
      <header className="shrink-0 px-5 sm:px-8 py-3.5 border-b border-[var(--dojo-border)] bg-[var(--dojo-surface)]/85 backdrop-blur-md flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Back + Title */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回首頁')}</span>
          </button>
          <span className="font-display text-base font-bold text-[var(--dojo-text-bright)] whitespace-nowrap hidden sm:inline">
            {t('拆字原則與查碼試練')}
          </span>
        </div>

        {/* Zone 2: Clean Segmented Mode Tabs */}
        <nav
          aria-label={t('拆字學習階段')}
          className="inline-flex items-center p-1 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] shrink-0"
        >
          {(
            [
              { id: 'rules', label: '拆字四則' },
              { id: 'lookup', label: '查字拆碼' },
              { id: 'check', label: '通理自測' },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setTab(item.id);
                }}
                className={`px-3 sm:px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(item.label)}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Practical Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <KeystrokeCloudToggle compact />

          <div
            role="group"
            aria-label={t('切換繁簡顯示')}
            className="hidden md:inline-flex items-center p-0.5 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]"
          >
            {SCRIPT_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeScriptMode(opt.id);
                }}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  scriptMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label={t('切換視覺色調')}
            className="hidden sm:inline-flex items-center p-0.5 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]"
          >
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeThemeMode(opt.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  themeMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            title={t(muted ? '按鍵音效：已關閉' : '按鍵音效：已開啟')}
            aria-label={t(muted ? '開啟按鍵音效' : '關閉按鍵音效')}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* ==================== TAB 1: FOUR DECOMPOSITION PRINCIPLES ==================== */}
          {tab === 'rules' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Column (5 cols): 4 Rules Navigation + Concise Rule Breakdown */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                {RULE_SPECS.map((rule) => {
                  const isActive = rule.id === activeRuleId;
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => handleSelectRule(rule)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? isWash
                            ? 'bg-[#FAF9F5] border-[#181817]/40 shadow-xs'
                            : 'bg-[#172133]/95 border-[#D89B3C]/50'
                          : isWash
                            ? 'bg-[#F6F4EE]/70 hover:bg-[#FAF9F5] border-[#141413]/12'
                            : 'bg-[#121824]/75 hover:bg-[#161E2E] border-[#F2EEE6]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono-tabular text-[var(--dojo-ochre)]">
                          {t(rule.indexLabel)}
                        </span>
                        <span className="text-[11px] text-[var(--dojo-text-muted)] truncate">
                          {t(rule.formula)}
                        </span>
                      </div>
                      <div className="mt-1 font-display text-base font-bold text-[var(--dojo-text-bright)]">
                        {t(rule.title)}
                      </div>
                      {isActive && (
                        <div className="mt-2.5 pt-2.5 border-t border-[var(--dojo-border)] space-y-2">
                          <p className="text-xs leading-relaxed text-[var(--dojo-text-sub)]">
                            {t(rule.summary)}
                          </p>
                          <ul className="space-y-1">
                            {rule.bullets.map((b, i) => (
                              <li
                                key={i}
                                className="text-xs leading-relaxed text-[var(--dojo-text)] flex items-start gap-2"
                              >
                                <span
                                  aria-hidden="true"
                                  className="mt-1.5 w-1 h-1 rounded-full bg-[var(--dojo-ochre)] shrink-0"
                                />
                                <span>{t(b)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Column (7 cols): Interactive Example Stage with Color-Split + Keystroke Cloud */}
              <div
                className={`lg:col-span-7 relative rounded-2xl border p-5 sm:p-6 flex flex-col justify-between min-h-[500px] overflow-hidden ${
                  isWash
                    ? 'bg-[#FAF9F5]/95 border-[#141413]/16'
                    : 'bg-[#0F1520]/95 border-[#F2EEE6]/12'
                }`}
              >
                {/* Top Example Selector Strip */}
                <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[var(--dojo-text-muted)] mr-1">
                      {t('點選例字並直接敲鍵試打')}
                    </span>
                    {activeRule.samples.map((ch) => {
                      const active = activeEntry?.char === ch;
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => selectCharacter(ch)}
                          className={`w-9 h-9 rounded-lg border font-display text-base font-bold transition-all cursor-pointer ${
                            active
                              ? 'bg-[var(--dojo-crimson)] border-[var(--dojo-crimson)] text-white shadow-sm'
                              : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text)]'
                          }`}
                        >
                          {ch}
                        </button>
                      );
                    })}
                  </div>

                  {activeEntry?.shortCode && activeRuleId !== 'short' && (
                    <button
                      type="button"
                      onClick={() => setUseShortPractice((v) => !v)}
                      className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                        useShortPractice
                          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                      }`}
                    >
                      {t(useShortPractice ? `試打簡碼 (${activeEntry.shortCode.toUpperCase()})` : `切換簡碼 (${activeEntry.shortCode.toUpperCase()})`)}
                    </button>
                  )}
                </div>

                {/* Center Stage: Coincident Memory Palace Cloud + Large Color-Split Glyph */}
                {activeEntry && (
                  <div className="relative flex-1 flex flex-col items-center justify-center py-6">
                    <KeystrokePalaceCloud
                      pulse={pulse}
                      visible={visible}
                      scriptMode={scriptMode}
                      placement="coincident"
                      boxPx={330}
                      style={{
                        left: '50%',
                        top: '44%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />

                    <div
                      className={`relative z-20 transition-transform duration-150 ${
                        completedFlash ? 'scale-105' : 'scale-100'
                      }`}
                    >
                      {activeEntry.strokes && activeEntry.strokes.length > 0 ? (
                        <ColorSplitGlyph
                          char={activeEntry.char}
                          strokes={activeEntry.strokes}
                          strokeRootIndices={activeEntry.strokeRootIndices}
                          themeMode={themeMode}
                          colorMix={1}
                          sizeClass="w-36 h-36"
                        />
                      ) : (
                        <div className="font-display text-[104px] leading-none font-bold text-[var(--dojo-text-bright)] select-none">
                          {activeEntry.char}
                        </div>
                      )}
                    </div>

                    {/* Keystroke Input Slots */}
                    <div className="relative z-20 mt-4 flex items-center gap-2">
                      {Array.from(targetCode).map((expectedChar, idx) => {
                        const isFilled = idx < typed.length;
                        const isNext = idx === typed.length;
                        const role = roleTags[idx] ?? 'da';
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <div
                              className={`w-11 h-12 rounded-lg border flex items-center justify-center font-mono-tabular text-lg font-bold uppercase transition-colors ${
                                isFilled
                                  ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)] text-[var(--dojo-pine-text)]'
                                  : isNext && errorCue
                                    ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)]'
                                    : isNext
                                      ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                                      : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                              }`}
                            >
                              {isFilled ? typed[idx] : expectedChar}
                            </div>
                            <span className="text-[10px] text-[var(--dojo-text-muted)] whitespace-nowrap">
                              {renderRoleLabel(role, t)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quiet Status Cue */}
                    <div className="relative z-20 h-5 mt-2 text-xs flex items-center justify-center">
                      {completedFlash ? (
                        <span className="text-[var(--dojo-pine-text)] font-medium">
                          {t('成字順暢')}
                        </span>
                      ) : errorCue ? (
                        <span className="text-[var(--dojo-crimson-text)]">{errorCue}</span>
                      ) : imeWarning ? (
                        <span className="text-[var(--dojo-ochre)]">
                          {t('請先將系統輸入法切回英文狀態以直敲字根')}
                        </span>
                      ) : (
                        <span className="text-[var(--dojo-text-muted)]">
                          {t('直接在鍵盤上依序按下上方字母，體驗雲圖落位')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Bottom Root-by-Root Decomposition Equation */}
                {activeEntry && (
                  <div className="relative z-20 pt-4 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {activeEntry.roots.map((rootChar, idx) => {
                        const rc = activeEntry.rootCodes[idx] || '';
                        const sp = spans[idx];
                        const chamberKey = rc[0] || '';
                        const color = rootGlyphTextColor(idx);
                        return (
                          <div
                            key={`${rootChar}-${idx}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]"
                          >
                            <RadicalSymbol
                              glyph={rootChar}
                              style={{ color }}
                              className="text-xl font-bold"
                            />
                            <div className="text-xs font-mono-tabular">
                              <span className="text-[var(--dojo-text-sub)] uppercase">
                                {chamberKey}
                                {LINGMING_CHAMBER_BY_KEY[chamberKey]
                                  ? `(${LINGMING_CHAMBER_BY_KEY[chamberKey].primaryAnchor})`
                                  : ''}
                              </span>
                              <span className="mx-1 text-[var(--dojo-text-muted)]">·</span>
                              {rc ? (
                                <span className="uppercase">
                                  {Array.from(rc).map((l, li) => {
                                    const taken =
                                      sp && li >= sp.matchStart && li < sp.matchEnd;
                                    return (
                                      <span
                                        key={li}
                                        className={
                                          taken
                                            ? 'font-bold text-[var(--dojo-text-bright)] underline decoration-[var(--dojo-ochre)] underline-offset-2'
                                            : 'text-[var(--dojo-text-muted)]'
                                        }
                                      >
                                        {l}
                                      </span>
                                    );
                                  })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-xs font-mono-tabular text-[var(--dojo-text-sub)] whitespace-nowrap">
                      {t('全碼')}{' '}
                      <span className="font-bold uppercase text-[var(--dojo-text-bright)]">
                        {activeEntry.code}
                      </span>
                      {activeEntry.shortCode && (
                        <>
                          <span className="mx-1.5 opacity-40">·</span>
                          {t('簡碼')}{' '}
                          <span className="font-bold uppercase text-[var(--dojo-pine-text)]">
                            {activeEntry.shortCode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: CHARACTER DECOMPOSITION LOOKUP ==================== */}
          {tab === 'lookup' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left (6 cols): Search / Paste Box + Character List */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div
                  className={`rounded-2xl border p-5 ${
                    isWash
                      ? 'bg-[#FAF9F5]/95 border-[#141413]/15'
                      : 'bg-[#121824]/90 border-[#F2EEE6]/12'
                  }`}
                >
                  <label
                    htmlFor="lingming-lookup-input"
                    className="block text-sm font-bold text-[var(--dojo-text-bright)] mb-1.5"
                  >
                    {t('輸入或貼上你想查拆法的漢字')}
                  </label>
                  <p className="text-xs text-[var(--dojo-text-sub)] mb-3">
                    {t(
                      `內建常用與經典詞庫（${lexicon.size} 字），可切換至系統輸入法直接打出想查的字或句子，點選下方字卡即可查拆法並按鍵試敲。`
                    )}
                  </p>

                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-[var(--dojo-text-muted)] absolute left-3 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      id="lingming-lookup-input"
                      type="text"
                      value={lookupQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLookupQuery(val);
                        const firstMatch = Array.from(val).find(
                          (ch) => /[\u4e00-\u9fff]/.test(ch) && lexicon.has(ch)
                        );
                        if (firstMatch) {
                          setSelectedChar(firstMatch);
                          setTyped('');
                          setErrorCue(null);
                        }
                      }}
                      placeholder={t('例如：輸入「靈明書寫之道」或貼上寫作時卡殼的字…')}
                      className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-bright)] placeholder:text-[var(--dojo-text-muted)] focus:outline-none focus:border-[var(--dojo-ochre)]"
                    />
                    {lookupQuery && (
                      <button
                        type="button"
                        onClick={() => setLookupQuery('')}
                        aria-label={t('清空輸入')}
                        className="absolute right-2.5 p-1 text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {QUICK_LOOKUP_GROUPS.map((grp) => {
                      const active = quickGroupId === grp.id;
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setQuickGroupId(grp.id);
                            setLookupQuery(grp.chars.join(''));
                            const firstValid = grp.chars.find((c) => lexicon.has(c));
                            if (firstValid) selectCharacter(firstValid);
                          }}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/50 text-[var(--dojo-text-bright)]'
                              : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                          }`}
                        >
                          {t(grp.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Result Character Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {lookupChars.length === 0 ? (
                    <div className="col-span-full py-10 text-center text-xs text-[var(--dojo-text-muted)] border border-dashed border-[var(--dojo-border)] rounded-xl">
                      {t('請在上方輸入至少一個漢字查看拆字與宮殿落位')}
                    </div>
                  ) : (
                    lookupChars.map((ch) => {
                      const item = lexicon.get(ch);
                      const isSel = selectedChar === ch;
                      if (!item) {
                        return (
                          <div
                            key={ch}
                            className="px-3 py-2.5 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]/50 opacity-65"
                          >
                            <div className="font-display text-xl font-bold text-[var(--dojo-text-sub)]">
                              {ch}
                            </div>
                            <div className="text-[11px] text-[var(--dojo-text-muted)] mt-0.5">
                              {t('未收錄於精簡詞表')}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            selectCharacter(ch);
                            searchInputRef.current?.blur();
                          }}
                          className={`text-left px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSel
                              ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] text-[var(--dojo-text-bright)]'
                              : 'bg-[var(--dojo-surface)]/90 hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text)]'
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-display text-2xl font-bold">{item.char}</span>
                            <span className="font-mono-tabular text-xs font-bold uppercase text-[var(--dojo-ochre)]">
                              {item.shortCode ? `${item.shortCode} / ${item.code}` : item.code}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-[var(--dojo-text-sub)] truncate">
                            {item.roots.map((r, i) => (
                              <React.Fragment key={`${r}-${i}`}>
                                {i > 0 && <span className="opacity-40">+</span>}
                                <RadicalSymbol glyph={r} className="text-xs" />
                              </React.Fragment>
                            ))}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right (6 cols): Selected Character Deep Breakdown & Live Keystroke Practice */}
              {activeEntry && (
                <div
                  className={`lg:col-span-6 relative rounded-2xl border p-6 flex flex-col justify-between min-h-[460px] overflow-hidden ${
                    isWash
                      ? 'bg-[#FAF9F5]/95 border-[#141413]/16'
                      : 'bg-[#0F1520]/95 border-[#F2EEE6]/12'
                  }`}
                >
                  <div className="relative z-20 flex items-center justify-between gap-3">
                    <div className="text-xs text-[var(--dojo-text-sub)]">
                      {t('點此空白區後直接敲鍵試打（Space 重置）')}
                    </div>
                    {activeEntry.shortCode && (
                      <button
                        type="button"
                        onClick={() => setUseShortPractice((v) => !v)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                          useShortPractice
                            ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                            : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                        }`}
                      >
                        {t(useShortPractice ? `簡碼練習 (${activeEntry.shortCode.toUpperCase()})` : `切至簡碼 (${activeEntry.shortCode.toUpperCase()})`)}
                      </button>
                    )}
                  </div>

                  <div className="relative flex-1 flex flex-col items-center justify-center py-6">
                    <KeystrokePalaceCloud
                      pulse={pulse}
                      visible={visible}
                      scriptMode={scriptMode}
                      placement="coincident"
                      boxPx={320}
                      style={{
                        left: '50%',
                        top: '44%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    />

                    <div
                      className={`relative z-20 transition-transform duration-150 ${
                        completedFlash ? 'scale-105' : 'scale-100'
                      }`}
                    >
                      {activeEntry.strokes && activeEntry.strokes.length > 0 ? (
                        <ColorSplitGlyph
                          char={activeEntry.char}
                          strokes={activeEntry.strokes}
                          strokeRootIndices={activeEntry.strokeRootIndices}
                          themeMode={themeMode}
                          colorMix={1}
                          sizeClass="w-32 h-32"
                        />
                      ) : (
                        <div className="font-display text-[100px] leading-none font-bold text-[var(--dojo-text-bright)] select-none">
                          {activeEntry.char}
                        </div>
                      )}
                    </div>

                    <div className="relative z-20 mt-4 flex items-center gap-2">
                      {Array.from(targetCode).map((expectedChar, idx) => {
                        const isFilled = idx < typed.length;
                        const isNext = idx === typed.length;
                        const role = roleTags[idx] ?? 'da';
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <div
                              className={`w-11 h-12 rounded-lg border flex items-center justify-center font-mono-tabular text-lg font-bold uppercase transition-colors ${
                                isFilled
                                  ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)] text-[var(--dojo-pine-text)]'
                                  : isNext && errorCue
                                    ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)]'
                                    : isNext
                                      ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                                      : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                              }`}
                            >
                              {isFilled ? typed[idx] : expectedChar}
                            </div>
                            <span className="text-[10px] text-[var(--dojo-text-muted)]">
                              {renderRoleLabel(role, t)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="relative z-20 h-5 mt-2 text-xs flex items-center justify-center">
                      {completedFlash ? (
                        <span className="text-[var(--dojo-pine-text)] font-medium">
                          {t('成字順暢')}
                        </span>
                      ) : errorCue ? (
                        <span className="text-[var(--dojo-crimson-text)]">{errorCue}</span>
                      ) : imeWarning ? (
                        <span className="text-[var(--dojo-ochre)]">
                          {t('請切換至英文鍵盤試打')}
                        </span>
                      ) : (
                        <span className="text-[var(--dojo-text-muted)]">
                          {t('按下每個大碼時，記憶宮殿雲圖會於後方呼應')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Root Breakdown List */}
                  <div className="relative z-20 pt-4 border-t border-[var(--dojo-border)] flex flex-wrap items-center gap-2">
                    {activeEntry.roots.map((rootChar, idx) => {
                      const rc = activeEntry.rootCodes[idx] || '';
                      const chamberKey = rc[0] || '';
                      const sp = spans[idx];
                      return (
                        <div
                          key={`${rootChar}-${idx}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]"
                        >
                          <RadicalSymbol
                            glyph={rootChar}
                            style={{ color: rootGlyphTextColor(idx) }}
                            className="text-lg font-bold"
                          />
                          <span className="text-xs font-mono-tabular text-[var(--dojo-text-sub)] uppercase">
                            {chamberKey}
                            {LINGMING_CHAMBER_BY_KEY[chamberKey]
                              ? `(${LINGMING_CHAMBER_BY_KEY[chamberKey].primaryAnchor})`
                              : ''}
                          </span>
                          {rc && (
                            <span className="text-xs font-mono-tabular uppercase">
                              {Array.from(rc).map((l, li) => {
                                const taken = sp && li >= sp.matchStart && li < sp.matchEnd;
                                return (
                                  <span
                                    key={li}
                                    className={
                                      taken
                                        ? 'font-bold text-[var(--dojo-text-bright)] underline decoration-[var(--dojo-ochre)] underline-offset-2'
                                        : 'text-[var(--dojo-text-muted)]'
                                    }
                                  >
                                    {l}
                                  </span>
                                );
                              })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: CALM SPLIT-INTUITION CHECK ==================== */}
          {tab === 'check' && activeEntry && (
            <div
              className={`relative rounded-2xl border p-6 sm:p-8 flex flex-col justify-between min-h-[500px] overflow-hidden ${
                isWash
                  ? 'bg-[#FAF9F5]/95 border-[#141413]/16'
                  : 'bg-[#0F1520]/95 border-[#F2EEE6]/12'
              }`}
            >
              {/* Top Check Strip */}
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--dojo-text-sub)] font-mono-tabular">
                  <span>
                    {t('第')} {checkIdx + 1} / {checkDeck.length} {t('字')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('已順過')} {checkClearedCount} {t('字')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--dojo-text-muted)]">
                    {t('無倒數與扣血，按拆字直覺盲敲即可')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setCheckReveal((v) => !v);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      checkReveal
                        ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                        : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                    }`}
                  >
                    {t(checkReveal ? '收起拆法 (Tab)' : '閃視彩墨拆法 (Tab)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      buildNewCheckDeck();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('換一組 12 字')}</span>
                  </button>
                </div>
              </div>

              {/* Center Blind/Reveal Split Stage */}
              <div className="relative flex-1 flex flex-col items-center justify-center py-8">
                <KeystrokePalaceCloud
                  pulse={pulse}
                  visible={visible}
                  scriptMode={scriptMode}
                  placement="coincident"
                  boxPx={340}
                  style={{
                    left: '50%',
                    top: '44%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />

                <div
                  className={`relative z-20 transition-transform duration-150 ${
                    completedFlash ? 'scale-105' : 'scale-100'
                  }`}
                >
                  {checkReveal && activeEntry.strokes && activeEntry.strokes.length > 0 ? (
                    <ColorSplitGlyph
                      char={activeEntry.char}
                      strokes={activeEntry.strokes}
                      strokeRootIndices={activeEntry.strokeRootIndices}
                      themeMode={themeMode}
                      colorMix={1}
                      sizeClass="w-36 h-36"
                    />
                  ) : (
                    <div className="font-display text-[112px] leading-none font-bold text-[var(--dojo-text-bright)] select-none">
                      {activeEntry.char}
                    </div>
                  )}
                </div>

                {/* Blind Slots */}
                <div className="relative z-20 mt-5 flex items-center gap-2">
                  {Array.from(activeEntry.code).map((expectedChar, idx) => {
                    const isFilled = idx < typed.length;
                    const isNext = idx === typed.length;
                    return (
                      <div
                        key={idx}
                        className={`w-11 h-12 rounded-lg border flex items-center justify-center font-mono-tabular text-lg font-bold uppercase transition-colors ${
                          isFilled
                            ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)] text-[var(--dojo-pine-text)]'
                            : isNext && errorCue
                              ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)]'
                              : isNext
                                ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                                : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                        }`}
                      >
                        {isFilled ? typed[idx] : checkReveal ? expectedChar : '·'}
                      </div>
                    );
                  })}
                </div>

                <div className="relative z-20 h-6 mt-3 text-xs flex items-center justify-center">
                  {completedFlash ? (
                    <span className="text-[var(--dojo-pine-text)] font-medium">
                      {t('落筆成形')}
                    </span>
                  ) : errorCue ? (
                    <span className="text-[var(--dojo-crimson-text)]">{errorCue}</span>
                  ) : imeWarning ? (
                    <span className="text-[var(--dojo-ochre)]">
                      {t('請將系統輸入法切換至英文狀態')}
                    </span>
                  ) : (
                    <span className="text-[var(--dojo-text-muted)]">
                      {t('依拆字順序盲敲全碼 · 卡殼按 Tab 閃看彩墨拆法')}
                    </span>
                  )}
                </div>

                {checkReveal && (
                  <div className="relative z-20 mt-3 flex flex-wrap items-center justify-center gap-2">
                    {activeEntry.roots.map((rootChar, idx) => {
                      const rc = activeEntry.rootCodes[idx] || '';
                      return (
                        <div
                          key={`${rootChar}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-xs font-mono-tabular"
                        >
                          <RadicalSymbol
                            glyph={rootChar}
                            style={{ color: rootGlyphTextColor(idx) }}
                            className="text-base font-bold"
                          />
                          <span className="uppercase text-[var(--dojo-text-sub)]">
                            {rc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Transition Strip: Ready for Real Writing */}
              <div className="relative z-20 pt-4 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[var(--dojo-text-sub)]">
                  {t('通理之後即可切換至 Obsidian 用原輸入法直接寫作，也可先試一段靜心熱身：')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      onOpenDrillStudio();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                  >
                    <Flame className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                    <span>{t('彩墨實戰拆字')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      onOpenHuangtingDojo();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--dojo-ochre)]/40 bg-[var(--dojo-ochre-wash)] hover:brightness-105 text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
                  >
                    <ScrollText className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                    <span>{t('靜心抄經試寫')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
