import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Play,
  Target,
  EyeOff,
  AudioLines,
  Move,
  RotateCcw,
  Download,
  Upload,
  Check,
  X,
} from 'lucide-react';
import {
  getLingmingRadicalScript,
  LINGMING_CHAMBER_BY_KEY,
  LINGMING_CHAMBERS,
  LINGMING_ROOT_MAP,
  PalaceChamber,
} from '../data/lingming';
import {
  FINGER_LABELS,
  KEY_FINGER_MAP,
  KEYBOARD_ROWS,
  VOWEL_KEYS,
} from '../data/schemes';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import {
  exportPalacePositionsJson,
  importPalacePositionsJson,
  loadPalaceOverrides,
  PalaceOverridesMap,
  resetChamberOverrides,
  resetPalaceNodeOverride,
  updatePalaceNodeOverride,
} from '../data/palaceEditor';
import { FrequencyTier } from '../data/palaceStrokes';
import { ChamberPassRecord } from '../data/campaign';
import { SchemeMasteryStore } from '../engine/mastery';
import {
  FREQUENCY_TIER_COLORS,
  PDF_TIER_COLORS,
  StrokeCloudSelection,
  StrokeCloudStage,
} from './StrokeCloudStage';
import { synth } from '../audio/synth';
import { getRadicalReading, speech } from '../audio/speech';
import {
  matchesScript,
  SCRIPT_MODE_OPTIONS,
  ScriptMode,
} from '../data/scriptFilter';
import { uiMnemonic, useUiScript, useUiText } from '../data/uiScript';

interface MemoryPalaceCloudProps {
  mastery: SchemeMasteryStore;
  chamberPasses?: Record<string, ChamberPassRecord>;
  scriptMode: ScriptMode;
  onChangeScriptMode?: (mode: ScriptMode) => void;
  speechEnabled: boolean;
  onToggleSpeech: () => void;
  onBack: () => void;
  onLaunchChamberDrill: (
    chamberKey: string | null,
    scope: 'da' | 'root',
    blind?: boolean
  ) => void;
}

const VOWEL_POSTER_META: Record<string, { shortWord: string; note: string }> = {
  a: { shortWord: '了', note: '一簡「了」 · 韻腹 a 終止' },
  e: { shortWord: '的', note: '一簡「的」 · 韻腹 e 終止' },
  i: { shortWord: '是', note: '一簡「是」 · 韻腹 i 終止' },
  o: { shortWord: '我', note: '一簡「我」 · 韻腹 o / 無讀音字根取 o' },
  u: { shortWord: '不', note: '一簡「不」 · 韻腹 u 終止' },
};

function getTierForRank(rank: number): FrequencyTier {
  if (rank === 1) return 'primary';
  if (rank <= 5) return 'rank2_5';
  if (rank <= 9) return 'rank6_9';
  return 'rest';
}

function getClusterAccent(clusterId: string): string {
  if (clusterId.endsWith('_primary')) return FREQUENCY_TIER_COLORS.primary;
  if (clusterId.endsWith('_t25')) return FREQUENCY_TIER_COLORS.rank2_5;
  if (clusterId.endsWith('_t69')) return FREQUENCY_TIER_COLORS.rank6_9;
  return FREQUENCY_TIER_COLORS.rest;
}

/** Crisp calligraphic SVG fallback for CJK Ext-B 「𠂇」 so M key never renders as a missing-font tofu box */
const InlineGlyph: React.FC<{ char: string; className?: string }> = ({ char, className = '' }) => {
  if (char === '𠂇') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`inline-block align-middle ${className}`}
        style={{ width: '1em', height: '1em' }}
        aria-label="𠂇"
      >
        <path
          fill="currentColor"
          d="M2.5 7.6 L18.8 7.0 Q20.1 6.9 21.1 7.9 Q21.3 8.4 20.6 8.7 L3.2 9.0 Q2.4 8.8 2.5 7.6 Z"
        />
        <path
          fill="currentColor"
          d="M12.3 2.8 Q13.7 3.2 14.1 4.2 C13.0 8.9 11.1 14.0 8.3 17.8 C6.4 20.3 4.1 21.8 2.5 22.4 C2.2 22.1 2.4 21.7 2.8 21.3 C5.4 19.2 8.2 15.3 10.0 10.7 C11.1 7.8 11.7 5.1 11.8 3.3 Q11.9 2.7 12.3 2.8 Z"
        />
      </svg>
    );
  }
  return <span className={className}>{char}</span>;
};

export const MemoryPalaceCloud: React.FC<MemoryPalaceCloudProps> = ({
  mastery,
  chamberPasses,
  scriptMode,
  onChangeScriptMode,
  speechEnabled,
  onToggleSpeech,
  onBack,
  onLaunchChamberDrill,
}) => {
  const t = useUiText();
  const uiScript = useUiScript();
  const [selectedKey, setSelectedKey] = useState<string>('q');
  const [selectedNode, setSelectedNode] = useState<StrokeCloudSelection | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [overrides, setOverrides] = useState<PalaceOverridesMap>(() => loadPalaceOverrides());
  const [jsonPanelOpen, setJsonPanelOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);

  const activeChamber: PalaceChamber =
    LINGMING_CHAMBER_BY_KEY[selectedKey] || LINGMING_CHAMBERS[0];
  const activePdfChamber = PALACE_PDF_CHAMBERS[activeChamber.key];

  useEffect(() => {
    setSelectedNode(null);
  }, [selectedKey]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (jsonPanelOpen) {
          setJsonPanelOpen(false);
          return;
        }
        onBack();
        return;
      }
      const k = e.key.toLowerCase();
      const nextChamber = LINGMING_CHAMBER_BY_KEY[k];
      if (nextChamber) {
        e.preventDefault();
        synth.playClick();
        setSelectedKey(k);
        speech.speakGlyph(nextChamber.primaryAnchor);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack, jsonPanelOpen]);

  const fingerLabel = FINGER_LABELS[KEY_FINGER_MAP[activeChamber.key]];
  const isLeft = activeChamber.handGroup.startsWith('left');
  const chamberColor = isLeft ? '#38A885' : '#4F86C6';
  const allChamberRadicals = activeChamber.clusters.flatMap((c) => c.radicals);
  const totalRadicals = allChamberRadicals.length;
  const activeRadicals = allChamberRadicals.filter((r) =>
    matchesScript(getLingmingRadicalScript(r.char, activeChamber.key, r.ma), scriptMode)
  ).length;
  const totalPdfGlyphs = activePdfChamber ? 1 + activePdfChamber.nodes.length : totalRadicals;

  const hasChamberEdits = Object.keys(overrides).some((id) =>
    id.startsWith(`${activeChamber.key}_`)
  );
  const selectedOverride = selectedNode
    ? overrides[selectedNode.id] || { dx: 0, dy: 0, scale: 1 }
    : null;

  const handleOpenExport = () => {
    setJsonDraft(exportPalacePositionsJson());
    setJsonStatus(t('已生成目前 20 宮殿完整座標定義 JSON（可直接複製或修改後匯入）'));
    setJsonPanelOpen(true);
  };

  const handleDownloadJson = () => {
    const content = exportPalacePositionsJson();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lingming-memory-palace-layout.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setJsonStatus(t('已下載 lingming-memory-palace-layout.json'));
  };

  const handleImportJson = () => {
    const res = importPalacePositionsJson(jsonDraft);
    if (res.ok) {
      setOverrides(loadPalaceOverrides());
      setJsonStatus(t(`成功套用 ${res.count} 項雲圖座標微調`));
    } else {
      setJsonStatus(t(`匯入失敗：${res.error || '格式錯誤'}`));
    }
  };

  const rowOffsets = ['pl-0', 'pl-3 sm:pl-6', 'pl-7 sm:pl-14'];

  return (
    <div className="w-full h-full flex flex-col bg-[#0E1218] text-[#F2EEE6] overflow-hidden">
      {/* Compact top utility strip */}
      <header className="shrink-0 h-13 px-4 sm:px-6 bg-[#0C1016] border-b border-[#F2EEE6]/8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C8C3B8] hover:text-white bg-[#171C26] hover:bg-[#222938] border border-[#F2EEE6]/10 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回')}</span>
          </button>
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-display text-base font-bold text-[#F5F1E8] whitespace-nowrap">
              {t('靈明字根 · 記憶宮殿壁畫地圖')}
            </span>
            <span aria-hidden="true" className="hidden md:inline text-[#565F70]">·</span>
            <span className="hidden md:inline text-[#8F98A8] truncate">
              {t('每鍵以最高頻主根為骨架，其餘字根自第一筆起順著筆順按頻率排列')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onChangeScriptMode && (
            <div
              className="hidden sm:inline-flex items-center gap-0.5 p-0.5 bg-[#121722] border border-[#F2EEE6]/10 rounded-lg"
              title={t('切換訓練與宮殿高亮字集；非本字集字根自動淡化顯示')}
            >
              {SCRIPT_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    onChangeScriptMode(opt.id);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    scriptMode === opt.id
                      ? 'bg-[#212A3A] text-[#F2D59B]'
                      : 'text-[#8994A6] hover:text-[#E5E0D5]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onToggleSpeech}
            title={t('開關字根代表發音朗讀')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              speechEnabled
                ? 'bg-[#172824] hover:bg-[#1E3530] border-[#2EA87E]/50 text-[#7CE5BC]'
                : 'bg-[#171C26] hover:bg-[#222938] border-[#F2EEE6]/10 text-[#8F98A8]'
            }`}
          >
            <AudioLines className="w-3.5 h-3.5" />
            <span>{t(speechEnabled ? '字根發音：開' : '字根發音：關')}</span>
          </button>

          <button
            type="button"
            onClick={() => onLaunchChamberDrill(null, 'root', false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#D94A38] hover:bg-[#E25644] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t('全盤 20 宮殿完整碼實戰')}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4 max-w-6xl w-full mx-auto">
        {/* Section 1: Spatial 25-Key Memory Palace Map */}
        <section aria-label={t('靈明25鍵空間記憶宮殿')}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs text-[#9AA3B2]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-sm bg-[#38A885]" />
                <span>{t('A區左手大碼')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-sm bg-[#4F86C6]" />
                <span>{t('A區右手大碼')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-sm bg-[#D89B3C]" />
                <span>{t('B區元音韻腹（E的 U不 I是 O我 A了）')}</span>
              </span>
              <span className="text-[#6D7584]">{t('Z 鍵不用（z/zh→V · q→K · 零聲母→J）')}</span>
            </div>
            <span className="font-mono-tabular text-[#7D8696]">
              {t('敲擊實體鍵切換宮殿')}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {KEYBOARD_ROWS.map((row, rIdx) => (
              <div
                key={rIdx}
                className={`flex items-stretch justify-center gap-1.5 sm:gap-2 ${rowOffsets[rIdx]}`}
              >
                {row.map((k) => {
                  const isVowel = VOWEL_KEYS.has(k);
                  const isZ = k === 'z';
                  const chamber = LINGMING_CHAMBER_BY_KEY[k];
                  const isSelected = selectedKey === k;
                  const stat = mastery.keys[k];
                  const masteryPct =
                    stat && stat.attempts > 0
                      ? Math.max(
                          14,
                          Math.min(
                            100,
                            Math.round(((900 - Math.min(900, stat.emaLatencyMs)) / 620) * 100)
                          )
                        )
                      : 0;

                  if (isZ) {
                    return (
                      <div
                        key={k}
                        className="flex flex-col justify-between items-center rounded-lg border border-[#F2EEE6]/6 bg-[#11151D]/60 px-1.5 py-1.5 opacity-55"
                        style={{ width: 'clamp(56px, 8.6vw, 96px)', minHeight: '58px' }}
                      >
                        <span className="self-start font-mono-tabular text-[10px] font-bold text-[#646C7B]">
                          Z
                        </span>
                        <span className="text-[11px] text-[#6E7787] font-medium">{t('不用')}</span>
                        <span className="font-mono-tabular text-[9px] text-[#5B6372]">z/zh→V</span>
                      </div>
                    );
                  }

                  if (isVowel) {
                    const vm = VOWEL_POSTER_META[k];
                    return (
                      <div
                        key={k}
                        title={t(vm.note)}
                        className="flex flex-col justify-between items-center rounded-lg border border-[#D89B3C]/35 bg-[#D89B3C]/10 px-1.5 py-1.5"
                        style={{ width: 'clamp(56px, 8.6vw, 96px)', minHeight: '58px' }}
                      >
                        <div className="w-full flex items-center justify-between">
                          <span className="font-mono-tabular text-[10px] font-bold text-[#E6B55E]">
                            {k.toUpperCase()}
                          </span>
                          <span className="text-[9px] text-[#D89B3C]/90">
                            {t('韻')} {k}
                          </span>
                        </div>
                        <span className="font-display text-lg font-bold text-[#F5DC9F] leading-none my-0.5">
                          {vm.shortWord}
                        </span>
                        <span className="text-[9px] text-[#B8985B] truncate max-w-full">
                          {t(k === 'o' ? 'o / 無音' : 'B區韻腹')}
                        </span>
                      </div>
                    );
                  }

                  const leftSide = chamber?.handGroup.startsWith('left');
                  const accent = leftSide ? '#38A885' : '#4F86C6';
                  const chamberPass = chamberPasses?.[k];
                  const isChamberCleared = (chamberPass?.clears ?? 0) > 0;
                  const keyRadicals = chamber?.clusters.flatMap((c) => c.radicals) ?? [];
                  const keyTotalCount = keyRadicals.length;
                  const keyActiveCount = keyRadicals.filter((r) =>
                    matchesScript(getLingmingRadicalScript(r.char, k, r.ma), scriptMode)
                  ).length;
                  const subTokens = chamber?.subAnchors ? chamber.subAnchors.split(' ') : [];

                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setSelectedKey(k);
                        if (chamber) {
                          speech.speakGlyph(chamber.primaryAnchor);
                        }
                      }}
                      className="keycap-surface relative flex flex-col justify-between items-center rounded-lg border px-1.5 py-1.5 text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D89B3C]"
                      style={{
                        width: 'clamp(56px, 8.6vw, 96px)',
                        minHeight: '58px',
                        backgroundColor: isSelected
                          ? leftSide
                            ? 'rgba(56, 168, 133, 0.22)'
                            : 'rgba(79, 134, 198, 0.22)'
                          : '#161C27',
                        borderColor: isSelected
                          ? accent
                          : isChamberCleared
                            ? 'rgba(46, 168, 126, 0.45)'
                            : 'rgba(242, 238, 230, 0.11)',
                        boxShadow: isSelected
                          ? `0 0 0 1px ${accent}, 0 4px 16px rgba(0,0,0,0.4)`
                          : '0 2px 0 #090C11',
                      }}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span
                          className="font-mono-tabular text-[10px] font-bold"
                          style={{ color: isSelected ? '#FFFFFF' : accent }}
                        >
                          {k.toUpperCase()}
                        </span>
                        <span
                          className="inline-flex items-center gap-0.5 font-mono-tabular text-[9px] text-[#7A8496]"
                          title={
                            keyActiveCount < keyTotalCount
                              ? `${keyActiveCount}/${keyTotalCount}${t('根')}`
                              : undefined
                          }
                        >
                          {isChamberCleared && (
                            <Check className="w-2.5 h-2.5 text-[#34D399]" aria-label={t('已逐鍵過關')} />
                          )}
                          <span>
                            {keyActiveCount}
                            {t('根')}
                          </span>
                        </span>
                      </div>

                      <span className="font-display text-lg font-bold text-[#F5F1E8] leading-none my-0.5">
                        <InlineGlyph char={chamber?.primaryAnchor || ''} />
                      </span>

                      <span className="text-[9px] text-[#9BA3B2] truncate max-w-full leading-tight">
                        {subTokens.map((tok, tIdx) => {
                          const radMatch = keyRadicals.find((r) => r.char === tok);
                          const tokActive = matchesScript(
                            getLingmingRadicalScript(tok, k, radMatch?.ma),
                            scriptMode
                          );
                          return (
                            <span
                              key={`${k}_sub_${tIdx}`}
                              className={tokActive ? '' : 'opacity-25'}
                            >
                              {tIdx > 0 ? ` ${tok}` : tok}
                            </span>
                          );
                        })}
                      </span>

                      <div className="w-full h-[2px] bg-[#F2EEE6]/8 rounded-full overflow-hidden mt-1">
                        {masteryPct > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${masteryPct}%`,
                              backgroundColor:
                                masteryPct >= 70
                                  ? '#2EA87E'
                                  : masteryPct >= 40
                                    ? '#D89B3C'
                                    : '#D9604C',
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Frequency-Ordered Stroke-Aligned Mural Palace */}
        <section className="flex-1 min-h-[300px] grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[#141923] border border-[#F2EEE6]/10 rounded-xl p-4 sm:p-5">
          {/* Left: Giant #1 主根 Silhouette + Frequency-Ordered Stroke Cloud (1:1 PDF + Interactive Editor) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#0F141C] rounded-xl border border-[#F2EEE6]/8 p-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="font-mono-tabular text-sm font-bold shrink-0"
                    style={{ color: chamberColor }}
                  >
                    {activeChamber.key.toUpperCase()} {t('鍵宮殿')}
                  </span>
                  <span aria-hidden="true" className="text-[#565F70]">·</span>
                  <span className="text-[#9AA3B2] truncate">{t(fingerLabel)}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono-tabular text-[#7D8696]">
                    {activeRadicals < totalRadicals ? `${activeRadicals}/${totalRadicals}` : totalRadicals}
                    {t('根')} · {totalPdfGlyphs}
                    {t('形')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setEditMode((v) => !v);
                    }}
                    title={t('拖曳調整字根位置、大小或匯出雲圖座標 JSON')}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                      editMode
                        ? 'bg-[#2B2214] border-[#D89B3C]/65 text-[#F7D286]'
                        : 'bg-[#151B26] hover:bg-[#1D2534] border-[#F2EEE6]/10 text-[#9AA3B2] hover:text-[#F2EEE6]'
                    }`}
                  >
                    <Move className="w-3 h-3" />
                    <span>{t(editMode ? '完成編輯' : '編輯雲圖')}</span>
                  </button>
                </div>
              </div>

              {/* A4 Poster 5-Tier Frequency + Variant Legend */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8F99AA] pt-0.5">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#DCE8E3]/55" />
                  <span>{t('主根')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FREQUENCY_TIER_COLORS.rank2_5 }}
                  />
                  <span>{t('第 2–5')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FREQUENCY_TIER_COLORS.rank6_9 }}
                  />
                  <span>{t('第 6–9')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: FREQUENCY_TIER_COLORS.rest }}
                  />
                  <span>{t('其餘')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PDF_TIER_COLORS.var_2_5 }}
                  />
                  <span>{t('變體')}</span>
                </span>
                <span className="text-[#6F798B]">· {t('順筆順按頻率排列')}</span>
                {scriptMode !== 'both' && (
                  <span className="text-[#6F798B]/90">· {t('半透明：非本字集對照')}</span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-[240px] flex items-center justify-center my-1">
              <StrokeCloudStage
                chamberKey={activeChamber.key}
                variant="palace"
                scriptMode={scriptMode}
                selectedChar={selectedNode?.char || null}
                selectedNodeId={selectedNode?.id || null}
                overrides={overrides}
                editMode={editMode}
                onDragNode={(id, patch) => {
                  setOverrides(updatePalaceNodeOverride(id, patch));
                }}
                onSelectNode={(node) => {
                  if (!editMode) synth.playClick();
                  setSelectedNode(node);
                  const speakTarget = node.isPua ? node.parentChar : node.char;
                  if (speakTarget && !editMode) {
                    speech.speakGlyph(speakTarget);
                  }
                }}
              />
            </div>

            {/* Cloud Editor Controls (only shown when editMode is ON) */}
            {editMode && (
              <div className="mb-2.5 p-2.5 rounded-lg bg-[#141A24] border border-[#D89B3C]/28 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#E6C485] font-medium">
                    {t(
                      selectedNode
                        ? '微調選中字根（可直接在圖上拖曳）'
                        : '在上方雲圖拖曳或點擊任一字根 / 主根以調整位置與縮放'
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasChamberEdits && (
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setOverrides(resetChamberOverrides(activeChamber.key));
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1D2432] hover:bg-[#273144] text-[11px] text-[#C8C3B8] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('還原此鍵')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenExport}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1D2432] hover:bg-[#273144] text-[11px] text-[#9BC4E2] cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{t('匯出/匯入')}</span>
                    </button>
                  </div>
                </div>

                {selectedNode && selectedOverride && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#F2EEE6]/8">
                    <div className="flex items-center gap-2 font-mono-tabular text-[11px] text-[#B8C0CE]">
                      <span>
                        X:{(selectedNode.cx + selectedOverride.dx).toFixed(1)}
                      </span>
                      <span>
                        Y:{(selectedNode.cy + selectedOverride.dy).toFixed(1)}
                      </span>
                    </div>

                    <label className="flex items-center gap-2 text-[11px] text-[#C8C3B8] flex-1 min-w-[140px] max-w-[200px]">
                      <span>{t('縮放')}</span>
                      <input
                        type="range"
                        min={0.4}
                        max={2.2}
                        step={0.05}
                        value={selectedOverride.scale}
                        onChange={(e) => {
                          setOverrides(
                            updatePalaceNodeOverride(selectedNode.id, {
                              scale: parseFloat(e.target.value),
                            })
                          );
                        }}
                        className="w-full accent-[#D89B3C] cursor-pointer"
                      />
                      <span className="font-mono-tabular w-9 text-right">
                        {selectedOverride.scale.toFixed(2)}x
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setOverrides(resetPalaceNodeOverride(selectedNode.id));
                      }}
                      className="px-2 py-0.5 rounded bg-[#1A202C] hover:bg-[#242C3D] text-[11px] text-[#D89B3C] cursor-pointer"
                    >
                      {t('重設此字根')}
                    </button>
                  </div>
                )}

                {jsonPanelOpen && (
                  <div className="pt-2 border-t border-[#F2EEE6]/10 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#9AA3B2]">
                        {t(`雲圖座標 JSON（${jsonStatus || '貼上即可匯入'}）`)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDownloadJson}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1B2A25] hover:bg-[#233831] text-[11px] text-[#7CE5BC] cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>{t('下載')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleImportJson}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2B2214] hover:bg-[#3A2E1A] text-[11px] text-[#F7D286] cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('套用匯入')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setJsonPanelOpen(false)}
                          aria-label={t('關閉 JSON 面板')}
                          className="p-0.5 text-[#7D8696] hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={jsonDraft}
                      onChange={(e) => setJsonDraft(e.target.value)}
                      rows={4}
                      spellCheck={false}
                      className="w-full rounded bg-[#0A0E14] border border-[#F2EEE6]/12 p-2 font-mono-tabular text-[10px] text-[#C8D0DC] focus:outline-none focus:border-[#D89B3C]"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 text-xs border-t border-[#F2EEE6]/8 pt-2.5">
              {selectedNode ? (
                <div className="flex items-center gap-2 text-[#E5E0D5] min-w-0">
                  {selectedNode.path ? (
                    <svg
                      viewBox={`${selectedNode.cx - Math.max(4, selectedNode.r) * 1.25} ${selectedNode.cy - Math.max(4, selectedNode.r) * 1.25} ${Math.max(4, selectedNode.r) * 2.5} ${Math.max(4, selectedNode.r) * 2.5}`}
                      className="w-5 h-5 shrink-0 text-[#F7D286]"
                      aria-label={selectedNode.char}
                    >
                      <path d={selectedNode.path} fill="currentColor" />
                    </svg>
                  ) : (
                    <span className="font-display text-base font-bold text-[#F7D286]">
                      <InlineGlyph char={selectedNode.char} />
                    </span>
                  )}
                  <span className="font-mono-tabular text-[11px] text-[#8F99AA]">
                    #{selectedNode.rank}
                  </span>
                  {selectedNode.ma && (
                    <span className="font-mono-tabular font-semibold">
                      <span style={{ color: chamberColor }}>
                        {selectedNode.ma[0].toUpperCase()}
                      </span>
                      {!selectedNode.isXiao && (
                        <span className="text-[#E5E0D5]">{selectedNode.ma[1]}</span>
                      )}
                      <span className="text-[#D89B3C]">
                        {selectedNode.ma[selectedNode.ma.length - 1]}
                      </span>
                    </span>
                  )}
                  {(() => {
                    const lookupChar = selectedNode.isPua
                      ? selectedNode.parentChar
                      : selectedNode.char;
                    const rd = getRadicalReading(lookupChar);
                    return rd.pinyin ? (
                      <span className="text-[#7CE5BC] font-mono-tabular truncate">
                        {rd.pinyin}
                      </span>
                    ) : null;
                  })()}
                  <span className="text-[#8F98A8] truncate">
                    {t(
                      selectedNode.note ||
                        LINGMING_ROOT_MAP.get(selectedNode.parentChar)?.note ||
                        (selectedNode.isXiao ? '小根 2 碼' : '大根 3 碼')
                    )}
                    {(() => {
                      const ds = getLingmingRadicalScript(
                        selectedNode.char,
                        activeChamber.key,
                        selectedNode.ma
                      );
                      const eff =
                        ds !== 'common'
                          ? ds
                          : getLingmingRadicalScript(
                              selectedNode.parentChar,
                              activeChamber.key,
                              selectedNode.ma
                            );
                      return matchesScript(eff, scriptMode) ? '' : `（${t('非當前字集')}）`;
                    })()}
                  </span>
                </div>
              ) : (
                <span className="text-[#C8C3B8] truncate">
                  {t('筆順口訣：')}
                  {uiMnemonic(activeChamber.mnemonic, uiScript)}
                </span>
              )}
              <span className="text-[11px] text-[#7A8496] shrink-0">
                {t(editMode ? '拖曳調整位置' : '點擊字根聽發音')}
              </span>
            </div>
          </div>

          {/* Right: Frequency-Tier Cluster Cards + One-Click Palace Drills */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3">
              {activeChamber.clusters.map((cl) => {
                const tierAccent = getClusterAccent(cl.id);
                const activeInCluster = cl.radicals.filter((rad) =>
                  matchesScript(
                    getLingmingRadicalScript(rad.char, activeChamber.key, rad.ma),
                    scriptMode
                  )
                ).length;
                return (
                  <div
                    key={cl.id}
                    className="pb-3 border-b border-[#F2EEE6]/7 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: tierAccent }}
                      />
                      <span className="font-medium text-[#E5E0D5]">{t(cl.label)}</span>
                      <span aria-hidden="true" className="text-[#565F70]">·</span>
                      <span className="font-mono-tabular text-[#8A94A6]">
                        {activeInCluster < cl.radicals.length
                          ? `${activeInCluster}/${cl.radicals.length}`
                          : cl.radicals.length}{' '}
                        {t('個')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {cl.radicals.map((rad) => {
                        const da = rad.ma[0].toUpperCase();
                        const sheng = rad.isXiao ? '' : rad.ma[1];
                        const yun = rad.ma[rad.ma.length - 1];
                        const isSel = selectedNode?.char === rad.char;
                        const tier = getTierForRank(rad.rank);
                        const radScript = getLingmingRadicalScript(
                          rad.char,
                          activeChamber.key,
                          rad.ma
                        );
                        const inScript = matchesScript(radScript, scriptMode);
                        return (
                          <button
                            key={`${cl.id}_${rad.char}_${rad.ma}`}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              speech.speakGlyph(rad.char);
                              const pdfMatch =
                                activePdfChamber?.monument.displayChar === rad.char
                                  ? activePdfChamber.monument
                                  : activePdfChamber?.nodes.find(
                                      (n) => n.displayChar === rad.char || n.rawChar === rad.char
                                    );
                              setSelectedNode({
                                id: pdfMatch?.id || `${activeChamber.key}_card_${rad.char}`,
                                char: rad.char,
                                rawChar: pdfMatch?.rawChar || rad.char,
                                parentChar: rad.char,
                                ma: rad.ma,
                                isXiao: rad.isXiao,
                                rank: rad.rank,
                                tier:
                                  rad.rank === 1
                                    ? 'primary'
                                    : rad.rank <= 5
                                      ? 'rank2_5'
                                      : rad.rank <= 9
                                        ? 'rank6_9'
                                        : 'rest',
                                isVariant: false,
                                isPua: false,
                                path: pdfMatch?.path || '',
                                cx: pdfMatch?.cx ?? 50,
                                cy: pdfMatch?.cy ?? 50,
                                r: pdfMatch?.r ?? 6,
                                pinyin: '',
                                note: rad.note,
                              });
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                              isSel
                                ? inScript
                                  ? 'bg-[#1D2736] border-[#D89B3C]'
                                  : 'bg-[#1A212D] border-[#D89B3C]/70 opacity-85'
                                : inScript
                                  ? 'bg-[#10141C] border-[#F2EEE6]/9 hover:border-[#F2EEE6]/25'
                                  : 'bg-[#0C1017] border-[#F2EEE6]/5 opacity-28 hover:opacity-75'
                            }`}
                          >
                            <span
                              className="font-display text-base font-bold leading-none"
                              style={{
                                color:
                                  rad.rank === 1 ? '#FFF8EB' : FREQUENCY_TIER_COLORS[tier],
                              }}
                            >
                              <InlineGlyph char={rad.char} />
                            </span>
                            <div className="flex flex-col items-start leading-tight">
                              <span className="font-mono-tabular text-xs font-semibold">
                                <span style={{ color: chamberColor }}>{da}</span>
                                {sheng && <span className="text-[#D8D3C8]">{sheng}</span>}
                                <span className="text-[#D89B3C]">{yun}</span>
                              </span>
                              <span className="text-[10px] text-[#7A8496]">
                                #{rad.rank} ·{' '}
                                {!inScript
                                  ? t(radScript === 'trad' ? '僅繁 · 對照' : '僅簡 · 對照')
                                  : t(rad.note ? rad.note : rad.isXiao ? '小根' : '大根')}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instant Chamber Practice Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F2EEE6]/10">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#8D96A6]">
                <span>
                  {t('編碼色標：')}
                  <span style={{ color: chamberColor }}>{t('大碼')}</span> ·{' '}
                  <span className="text-[#E5E0D5]">{t('聲碼')}</span> ·{' '}
                  <span className="text-[#D89B3C]">{t('韻碼(AEIOU)')}</span>
                </span>
                {(chamberPasses?.[activeChamber.key]?.clears ?? 0) > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[#565F70]">·</span>
                    <span className="font-mono-tabular text-[#7CE5BC]">
                      {t(`已過 ${chamberPasses![activeChamber.key].clears} 遍 · 最佳 ${chamberPasses![activeChamber.key].bestAccuracy}%`)}
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLaunchChamberDrill(activeChamber.key, 'root', false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#D94A38] hover:bg-[#E25644] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>
                    {t('跟打')} {activeChamber.key.toUpperCase()} {t('宮殿字根')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onLaunchChamberDrill(activeChamber.key, 'root', true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1D2432] hover:bg-[#273144] border border-[#F2EEE6]/12 text-[#F2EEE6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5 text-[#2EA87E]" />
                  <span>
                    {t('直接默背')} {activeChamber.key.toUpperCase()} {t('宮殿')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
