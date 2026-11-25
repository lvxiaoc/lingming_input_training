import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Compass, Sparkles } from 'lucide-react';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import { synth } from '../audio/synth';
import { speech } from '../audio/speech';
import { useUiText } from '../data/uiScript';
import { useThemeMode } from '../data/theme';
import type { PalaceCloudTrainMode } from '../data/palaceCloudTraining';

type PostureRow = 'top' | 'home' | 'bot';

interface FingerKeySpec {
  key: string;
  row: PostureRow;
  role: 'consonant' | 'vowel' | 'empty';
  actionVerb: string;
  feelingCue: string;
  vowelChar?: string;
}

interface FingerColumnSpec {
  id: string;
  hand: 'left' | 'right';
  fingerName: string;
  handTrait: string;
  keys: [FingerKeySpec, FingerKeySpec, FingerKeySpec]; // [top, home, bot]
}

interface ActionChainHighlight {
  id: string;
  title: string;
  subtitle: string;
  keys: string[];
  accent: string;
}

const FINGER_COLUMNS: FingerColumnSpec[] = [
  // LEFT HAND (5 finger tracks + inner index extension)
  {
    id: 'l_pinky',
    hand: 'left',
    fingerName: '左小指',
    handTrait: '邊角收放 · 上抓下空',
    keys: [
      {
        key: 'q',
        row: 'top',
        role: 'consonant',
        actionVerb: '上勾抓握',
        feelingCue: '左小指往上微勾抓起，就像「又」字手爪伸出抓取。',
      },
      {
        key: 'a',
        row: 'home',
        role: 'vowel',
        vowelChar: '了',
        actionVerb: '韻尾停息',
        feelingCue: '左小指基准停靠位，不佔字根，專作韻腹「a / 了」輕呼收尾。',
      },
      {
        key: 'z',
        row: 'bot',
        role: 'empty',
        actionVerb: '留空不按',
        feelingCue: 'Z 鍵留白免按（原 z/zh 併入 V 鍵，輕省左小指負擔）。',
      },
    ],
  },
  {
    id: 'l_ring',
    hand: 'left',
    fingerName: '左無名',
    handTrait: '天地行止鏈：辶 → 土 → 木',
    keys: [
      {
        key: 'w',
        row: 'top',
        role: 'consonant',
        actionVerb: '抬腳前行',
        feelingCue: '從大地「土」往上抬步前行，正似「辶」走之底託舉邁進。',
      },
      {
        key: 's',
        row: 'home',
        role: 'consonant',
        actionVerb: '平立大地',
        feelingCue: '左無名指自然落在中排「土」，穩重鋪開作天地地平線。',
      },
      {
        key: 'x',
        row: 'bot',
        role: 'consonant',
        actionVerb: '向下扎根',
        feelingCue: '從「土」往下深探扎進泥底，便是樹木扎根的「木」。',
      },
    ],
  },
  {
    id: 'l_middle',
    hand: 'left',
    fingerName: '左中指',
    handTrait: '方口居中 · 下落分叉',
    keys: [
      {
        key: 'e',
        row: 'top',
        role: 'vowel',
        vowelChar: '的',
        actionVerb: '韻尾輕吐',
        feelingCue: '上排 E 留作純韻腹「e / 的」，不與中排字根搶形體通道。',
      },
      {
        key: 'd',
        row: 'home',
        role: 'consonant',
        actionVerb: '四方坐定',
        feelingCue: '左中指最飽滿的立定點，四平八穩坐出一張方「口」。',
      },
      {
        key: 'c',
        row: 'bot',
        role: 'consonant',
        actionVerb: '分叉點落',
        feelingCue: '中指往下微張劈開成兩點「丷」，如八字敞落點墨。',
      },
    ],
  },
  {
    id: 'l_index_out',
    hand: 'left',
    fingerName: '左食指·外',
    handTrait: '橫流一線鏈：二 → 一 → 水',
    keys: [
      {
        key: 'r',
        row: 'top',
        role: 'consonant',
        actionVerb: '上抬疊橫',
        feelingCue: '在基准「一」上方再抬一格多加一橫，自然成「二」。',
      },
      {
        key: 'f',
        row: 'home',
        role: 'consonant',
        actionVerb: '基準平橫',
        feelingCue: '左食指最天然的水平橫臥基准位，即筆直一道「一」。',
      },
      {
        key: 'v',
        row: 'bot',
        role: 'consonant',
        actionVerb: '水往低流',
        feelingCue: '人往高處走、水往低處流——左食指往下沉落便是「水」。',
      },
    ],
  },
  {
    id: 'l_index_in',
    hand: 'left',
    fingerName: '左食指·內',
    handTrait: '點折覆蓋：丶 → 厶 → 冖',
    keys: [
      {
        key: 't',
        row: 'top',
        role: 'consonant',
        actionVerb: '向右上點',
        feelingCue: '食指往右上斜伸輕點一下，恰如懸空落筆的一點「丶」。',
      },
      {
        key: 'g',
        row: 'home',
        role: 'consonant',
        actionVerb: '內屈勾折',
        feelingCue: '食指向右側微屈收回折角，手勢正似緊湊三角「厶」。',
      },
      {
        key: 'b',
        row: 'bot',
        role: 'consonant',
        actionVerb: '俯身覆蓋',
        feelingCue: '食指向右下壓低蓋住一片，像平寶蓋「冖」橫覆於上。',
      },
    ],
  },

  // RIGHT HAND (inner index extension + 4 primary fingers)
  {
    id: 'r_index_in',
    hand: 'right',
    fingerName: '右食指·內',
    handTrait: '人日分層：大 / 日 / 人',
    keys: [
      {
        key: 'y',
        row: 'top',
        role: 'consonant',
        actionVerb: '仰臂張開',
        feelingCue: '右食指往左上舒展撐開雙臂，昂首敞懷即是「大」。',
      },
      {
        key: 'h',
        row: 'home',
        role: 'consonant',
        actionVerb: '居中圓日',
        feelingCue: '右食指內探基準點，與中指「白」、無名「月」排成「日白月」。',
      },
      {
        key: 'n',
        row: 'bot',
        role: 'consonant',
        actionVerb: '下探邁步',
        feelingCue: '食指向下跨開一步（區別於 J 的原地站立），兩腿分立成「人」。',
      },
    ],
  },
  {
    id: 'r_index_out',
    hand: 'right',
    fingerName: '右食指·外',
    handTrait: '立定人旁：U / 亻 / 𠂇',
    keys: [
      {
        key: 'u',
        row: 'top',
        role: 'vowel',
        vowelChar: '不',
        actionVerb: '韻尾上呼',
        feelingCue: '右食指上排純韻腹「u / 不」，為形體末端提供輕快收音。',
      },
      {
        key: 'j',
        row: 'home',
        role: 'consonant',
        actionVerb: '立正站定',
        feelingCue: '右食指基准點原地垂直站直，就是靠左挺立的單人旁「亻」。',
      },
      {
        key: 'm',
        row: 'bot',
        role: 'consonant',
        actionVerb: '斜壓偏撇',
        feelingCue: '右食指向下偏壓滑出斜撇橫臂，便是反手倚斜的「𠂇」。',
      },
    ],
  },
  {
    id: 'r_middle',
    hand: 'right',
    fingerName: '右中指',
    handTrait: '清白中宮：I / 白',
    keys: [
      {
        key: 'i',
        row: 'top',
        role: 'vowel',
        vowelChar: '是',
        actionVerb: '韻尾收聲',
        feelingCue: '右中指上排專作韻腹「i / 是」，與中排實形互不干擾。',
      },
      {
        key: 'k',
        row: 'home',
        role: 'consonant',
        actionVerb: '澄明中立',
        feelingCue: '右中指最舒展的居中位——左接「日」、右映「月」，清透為「白」。',
      },
      {
        key: ',',
        row: 'bot',
        role: 'empty',
        actionVerb: '標點休息',
        feelingCue: '右中指下排僅作中文逗號「，」，不承擔字根記憶負荷。',
      },
    ],
  },
  {
    id: 'r_ring',
    hand: 'right',
    fingerName: '右無名',
    handTrait: '清月右翼：O / 月',
    keys: [
      {
        key: 'o',
        row: 'top',
        role: 'vowel',
        vowelChar: '我',
        actionVerb: '無音借代',
        feelingCue: '純韻腹「o / 我」，無聲母或難讀字根一律順手落於 O 結尾。',
      },
      {
        key: 'l',
        row: 'home',
        role: 'consonant',
        actionVerb: '右翼映月',
        feelingCue: '右手無名指自然落定「月」，與左手無名指「土」形成左右平衡。',
      },
      {
        key: '.',
        row: 'bot',
        role: 'empty',
        actionVerb: '句點歇筆',
        feelingCue: '下排僅作句號「。」收筆，無需額外字根記憶。',
      },
    ],
  },
  {
    id: 'r_pinky',
    hand: 'right',
    fingerName: '右小指',
    handTrait: '探勾包裹：勹',
    keys: [
      {
        key: 'p',
        row: 'top',
        role: 'consonant',
        actionVerb: '探勾包裹',
        feelingCue: '右小指往上輕探畫出一道微彎鉤弧，恰好包住「勹」字頭。',
      },
      {
        key: ';',
        row: 'home',
        role: 'empty',
        actionVerb: '自然歇手',
        feelingCue: '右小指中排基準位放鬆歇息，專心輔助上排「勹」。',
      },
      {
        key: '/',
        row: 'bot',
        role: 'empty',
        actionVerb: '輔助符號',
        feelingCue: '下排不設字根，右小指只需記住往上勾抓「勹」一個動作。',
      },
    ],
  },
];

const ACTION_CHAINS: ActionChainHighlight[] = [
  {
    id: 'earth_tree_walk',
    title: '天地行止鏈',
    subtitle: '左無名指：站「土」→ 下扎「木」· 上行「辶」',
    keys: ['w', 's', 'x'],
    accent: '#22B8CF',
  },
  {
    id: 'stroke_water',
    title: '橫流一線鏈',
    subtitle: '左食指外：平「一」→ 上疊「二」· 下流「水」',
    keys: ['r', 'f', 'v'],
    accent: '#38A885',
  },
  {
    id: 'human_split',
    title: '人形防混鏈',
    subtitle: '右食指：上撐臂「大」· 中立正「亻」· 下邁步「人」',
    keys: ['y', 'j', 'n'],
    accent: '#E8A94B',
  },
  {
    id: 'sun_white_moon',
    title: '三曜橫軸',
    subtitle: '右中排一線平推：「日」—「白」—「月」',
    keys: ['h', 'k', 'l'],
    accent: '#D65DB1',
  },
];

const ALL_KEYS_FLAT: Record<string, { spec: FingerKeySpec; col: FingerColumnSpec }> = {};
for (const col of FINGER_COLUMNS) {
  for (const spec of col.keys) {
    ALL_KEYS_FLAT[spec.key] = { spec, col };
  }
}

interface EmbodiedActionAtlasProps {
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onLaunchCloudTrainer?: (chamberKey: string, mode: PalaceCloudTrainMode) => void;
}

export const EmbodiedActionAtlas: React.FC<EmbodiedActionAtlasProps> = ({
  selectedKey,
  onSelectKey,
  onLaunchCloudTrainer,
}) => {
  const t = useUiText();
  const isWash = useThemeMode() === 'wash';
  const [activeChainId, setActiveChainId] = useState<string | null>('human_split');
  const [inspectedVowelKey, setInspectedVowelKey] = useState<string | null>(null);

  const activeChain = useMemo(
    () => ACTION_CHAINS.find((c) => c.id === activeChainId) ?? null,
    [activeChainId]
  );

  const chainKeysSet = useMemo(
    () => new Set(activeChain ? activeChain.keys : []),
    [activeChain]
  );

  const effectiveInspectKey = inspectedVowelKey || selectedKey.toLowerCase();
  const inspectedEntry =
    ALL_KEYS_FLAT[effectiveInspectKey] ?? ALL_KEYS_FLAT['j'];
  const inspectedChamber = LINGMING_CHAMBER_BY_KEY[inspectedEntry.spec.key];

  const leftCols = FINGER_COLUMNS.filter((c) => c.hand === 'left');
  const rightCols = FINGER_COLUMNS.filter((c) => c.hand === 'right');

  const renderColumn = (col: FingerColumnSpec) => {
    const [topKey, , botKey] = col.keys;
    const hasTopAction = topKey.role === 'consonant';
    const hasBotAction = botKey.role === 'consonant';

    const colContainsChain = col.keys.some((k) => chainKeysSet.has(k.key));

    return (
      <div
        key={col.id}
        className={`relative flex flex-col items-center rounded-xl border px-1.5 py-2 transition-all ${
          colContainsChain
            ? isWash
              ? 'bg-[#FFFFFF]/88 border-[#181817]/28 shadow-xs'
              : 'bg-[var(--dojo-surface)] border-[var(--dojo-ochre)]/40 shadow-xs'
            : isWash
              ? 'bg-[#F8F6F0]/65 border-[#141413]/10'
              : 'bg-[var(--dojo-surface-inset)]/70 border-[var(--dojo-border)]'
        }`}
      >
        {/* Finger Header */}
        <div className="text-[10px] font-semibold text-[var(--dojo-text-sub)] whitespace-nowrap mb-1.5">
          {t(col.fingerName)}
        </div>

        {/* Vertical Posture Spine SVG backdrop linking Up ↑ · Home ● · Down ↓ */}
        <div className="relative w-full flex flex-col items-center gap-1.5">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 140"
            className="pointer-events-none absolute inset-y-2 left-1/2 -translate-x-1/2 w-5 h-[calc(100%-16px)]"
          >
            {/* Central vertical spine connecting the 3 rows */}
            <line
              x1="12"
              y1="20"
              x2="12"
              y2="120"
              stroke={isWash ? 'rgba(20,20,18,0.14)' : 'rgba(242,238,230,0.12)'}
              strokeWidth="1.4"
              strokeDasharray="2.5 2.5"
            />
            {hasTopAction && (
              <path
                d="M12 64 L12 22 M8 27 L12 21 L16 27"
                fill="none"
                stroke={isWash ? '#1B6B5C' : '#38C896'}
                strokeOpacity="0.55"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {hasBotAction && (
              <path
                d="M12 76 L12 118 M8 113 L12 119 L16 113"
                fill="none"
                stroke={isWash ? '#B83B2A' : '#E8A94B'}
                strokeOpacity="0.55"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {col.keys.map((spec) => {
            const pdf = PALACE_PDF_CHAMBERS[spec.key];
            const chamber = LINGMING_CHAMBER_BY_KEY[spec.key];
            const isSelected = effectiveInspectKey === spec.key;
            const inChain = chainKeysSet.has(spec.key);
            const isVowel = spec.role === 'vowel';
            const isEmpty = spec.role === 'empty';

            const borderStyle = isSelected
              ? isWash
                ? 'border-[#181817] bg-[#FFFFFF] ring-2 ring-[#181817]/20'
                : 'border-[var(--dojo-ochre)] bg-[var(--dojo-surface-2)] ring-1 ring-[var(--dojo-ochre)]/45'
              : inChain
                ? isWash
                  ? 'border-[#B83B2A]/45 bg-[#FFFDF9]'
                  : 'border-[var(--dojo-ochre)]/55 bg-[var(--dojo-ochre-wash)]'
                : isVowel
                  ? 'border-[var(--dojo-ochre)]/25 bg-[var(--dojo-surface)]/80'
                  : isEmpty
                    ? 'border-dashed border-[var(--dojo-border)]/60 bg-transparent opacity-45'
                    : spec.row === 'home'
                      ? isWash
                        ? 'border-[#141413]/22 bg-[#FFFFFF]/95'
                        : 'border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)]'
                      : isWash
                        ? 'border-[#141413]/12 bg-[#FBF9F4]/90'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]';

            return (
              <button
                key={spec.key}
                type="button"
                disabled={isEmpty}
                onClick={() => {
                  if (isEmpty) return;
                  synth.playClick();
                  if (chamber) {
                    setInspectedVowelKey(null);
                    onSelectKey(spec.key);
                    speech.speakGlyph(chamber.primaryAnchor);
                  } else if (spec.vowelChar) {
                    setInspectedVowelKey(spec.key);
                    speech.speakGlyph(spec.vowelChar);
                  }
                }}
                className={`relative z-10 w-full min-h-[70px] rounded-lg border px-1 py-1.5 flex flex-col items-center justify-between transition-all ${
                  isEmpty ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5'
                } ${borderStyle}`}
              >
                {/* Row Key + Posture Direction Marker */}
                <div className="w-full flex items-center justify-between text-[9px] leading-none px-0.5">
                  <span
                    className={`font-mono-tabular uppercase font-bold ${
                      isVowel ? 'text-[var(--dojo-ochre)]' : 'text-[var(--dojo-text-muted)]'
                    }`}
                  >
                    {spec.key}
                  </span>
                  {spec.row === 'top' && spec.role === 'consonant' && (
                    <ArrowUp className="w-2.5 h-2.5 text-[var(--dojo-pine-text)]" />
                  )}
                  {spec.row === 'home' && spec.role === 'consonant' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--dojo-ochre)]" />
                  )}
                  {spec.row === 'bot' && spec.role === 'consonant' && (
                    <ArrowDown className="w-2.5 h-2.5 text-[var(--dojo-ochre)]" />
                  )}
                  {isVowel && (
                    <span className="text-[8px] text-[var(--dojo-ochre)]">{t('韻')}</span>
                  )}
                </div>

                {/* Calligraphic Vector Main Radical (or Vowel Char) */}
                <div className="h-7 flex items-center justify-center my-0.5">
                  {pdf ? (
                    <svg
                      viewBox="0 0 100 100"
                      className={`w-7 h-7 overflow-visible ${
                        isSelected
                          ? 'text-[var(--dojo-text-bright)]'
                          : col.hand === 'left'
                            ? isWash ? 'text-[#181817]' : 'text-[#6FE3B9]'
                            : isWash ? 'text-[#32322F]' : 'text-[#89BAFA]'
                      }`}
                      aria-label={chamber?.primaryAnchor || spec.key}
                    >
                      <path
                        d={pdf.monument.path}
                        fill="currentColor"
                        shapeRendering="geometricPrecision"
                      />
                    </svg>
                  ) : isVowel ? (
                    <span className="font-display text-lg font-bold text-[var(--dojo-ochre)] leading-none">
                      {spec.vowelChar}
                    </span>
                  ) : (
                    <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                      —
                    </span>
                  )}
                </div>

                {/* Short Somatic Action Verb */}
                <div className="text-[10px] leading-tight font-medium text-[var(--dojo-text-sub)] whitespace-nowrap truncate max-w-full">
                  {t(spec.actionVerb)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-4 flex flex-col gap-3.5 ${
        isWash
          ? 'border-[#141413]/14 bg-[#FAF8F2]/90'
          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)]'
      }`}
    >
      {/* Top Action Chains Selector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {ACTION_CHAINS.map((chain) => {
            const active = activeChainId === chain.id;
            return (
              <button
                key={chain.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setInspectedVowelKey(null);
                  setActiveChainId(active ? null : chain.id);
                  if (!active && chain.keys[0]) {
                    onSelectKey(chain.keys[0]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)] font-semibold'
                    : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: chain.accent }}
                />
                <span>{t(chain.title)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--dojo-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="w-3 h-3 text-[var(--dojo-pine-text)]" />
            <span>{t('上伸托舉')}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--dojo-ochre)]" />
            <span>{t('中排站定')}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowDown className="w-3 h-3 text-[var(--dojo-ochre)]" />
            <span>{t('下探扎根')}</span>
          </span>
        </div>
      </div>

      {activeChain && (
        <div className="text-xs text-[var(--dojo-ochre)] px-1 flex items-center gap-2">
          <span className="font-semibold">{t(activeChain.title)}</span>
          <span aria-hidden="true" className="opacity-45">·</span>
          <span className="text-[var(--dojo-text)]">{t(activeChain.subtitle)}</span>
        </div>
      )}

      {/* Two-Wing 10-Finger Vertical Posture Atlas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Left Hand Wing */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1 text-[11px]">
            <span className="font-semibold text-[var(--dojo-pine-text)]">
              {t('左手指腹 · 構造、底座與流變')}
            </span>
            <span className="text-[var(--dojo-text-muted)]">{t('12 個輔音主根')}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {leftCols.map(renderColumn)}
          </div>
        </div>

        {/* Right Hand Wing */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-1 text-[11px]">
            <span className="font-semibold text-[var(--dojo-text-bright)]">
              {t('右手指腹 · 人倫、日月與包納')}
            </span>
            <span className="text-[var(--dojo-text-muted)]">{t('8 個輔音主根 + 3 純韻腹')}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {rightCols.map(renderColumn)}
          </div>
        </div>
      </div>

      {/* Focused Somatic Feeling Readout for Currently Selected Finger/Key */}
      <div className="pt-2.5 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {PALACE_PDF_CHAMBERS[inspectedEntry.spec.key] && (
            <div className="w-10 h-10 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 100 100" className="w-8 h-8 text-[var(--dojo-text-bright)]">
                <path
                  d={PALACE_PDF_CHAMBERS[inspectedEntry.spec.key].monument.path}
                  fill="currentColor"
                />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono-tabular font-bold uppercase text-[var(--dojo-ochre)]">
                {inspectedEntry.spec.key}
              </span>
              <span className="font-semibold text-[var(--dojo-text-bright)]">
                {t(inspectedEntry.col.fingerName)} · {t(inspectedEntry.spec.actionVerb)}
              </span>
              {inspectedChamber && (
                <span className="text-[var(--dojo-text-muted)]">
                  · {t('主根')}「{inspectedChamber.primaryAnchor}」
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--dojo-text-sub)] leading-relaxed">
              {t(inspectedEntry.spec.feelingCue)}
            </p>
          </div>
        </div>

        {onLaunchCloudTrainer && inspectedChamber && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                onLaunchCloudTrainer(inspectedChamber.key, 'template');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--dojo-ochre)]/45 bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{t('練此鍵雲圖')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                onLaunchCloudTrainer(inspectedChamber.key, 'variant_cloud');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--dojo-pine)] text-white hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('變根漢字雲圖')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
