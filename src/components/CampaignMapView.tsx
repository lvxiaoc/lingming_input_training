import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Compass,
  EyeOff,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  CAMPAIGN_CHAPTERS,
  CampaignChapter,
  CampaignProgressStore,
  CampaignStage,
  getCampaignSummary,
  getNextUnclearPalaceKey,
  PALACE_GUIDED_KEYS,
  PALACE_ROW_GROUPS,
} from '../data/campaign';
import { getLingmingRadicalScript, LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import {
  matchesScript,
  SCRIPT_MODE_LABELS,
  SCRIPT_MODE_OPTIONS,
  ScriptMode,
} from '../data/scriptFilter';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';

const InlinePrimaryGlyph: React.FC<{ char: string; className?: string }> = ({
  char,
  className = '',
}) => {
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

interface CampaignMapViewProps {
  progress: CampaignProgressStore;
  scriptMode: ScriptMode;
  initialChapterId?: 1 | 2 | 3 | 4 | 5;
  onChangeScriptMode: (mode: ScriptMode) => void;
  onBackToTitle: () => void;
  onOpenPalaceCloud: () => void;
  onLaunchStage: (stage: CampaignStage) => void;
  onLaunchChamberDrill: (chamberKey: string, scope: 'da' | 'root', blind?: boolean) => void;
}

export const CampaignMapView: React.FC<CampaignMapViewProps> = ({
  progress,
  scriptMode,
  initialChapterId,
  onChangeScriptMode,
  onBackToTitle,
  onOpenPalaceCloud,
  onLaunchStage,
  onLaunchChamberDrill,
}) => {
  const t = useUiText();
  const summary = useMemo(() => getCampaignSummary(progress), [progress]);
  const [selectedChapterId, setSelectedChapterId] = useState<1 | 2 | 3 | 4 | 5>(
    initialChapterId ?? summary.nextRecommendedStage.chapterId
  );
  const [chamberBlindMode, setChamberBlindMode] = useState(false);

  const clearedChamberCount = useMemo(
    () =>
      PALACE_GUIDED_KEYS.filter((k) => (progress.chambers?.[k]?.clears ?? 0) > 0).length,
    [progress.chambers]
  );
  const nextChamberKey = useMemo(
    () => getNextUnclearPalaceKey(progress.chambers || {}),
    [progress.chambers]
  );
  const nextChamberAnchor = LINGMING_CHAMBER_BY_KEY[nextChamberKey]?.primaryAnchor || '';

  const selectedChapter: CampaignChapter = useMemo(
    () => CAMPAIGN_CHAPTERS.find((c) => c.id === selectedChapterId) ?? CAMPAIGN_CHAPTERS[0],
    [selectedChapterId]
  );

  const handleSelectChapter = (chId: 1 | 2 | 3 | 4 | 5) => {
    synth.playClick();
    setSelectedChapterId(chId);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0B0F17] text-[#F2EEE6] overflow-hidden">
      {/* Top Dojo Header */}
      <header className="shrink-0 h-14 px-4 sm:px-8 bg-[#0D111A] border-b border-[#F2EEE6]/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBackToTitle();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#C8C3B8] hover:text-white bg-[#161C27] hover:bg-[#212A3A] border border-[#F2EEE6]/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回主畫面')}</span>
          </button>

          <div className="min-w-0 flex items-baseline gap-2.5">
            <h1 className="font-display text-base sm:text-lg font-bold text-[#F5F1E8] truncate">
              {t('墨鍵道場 · 五重修煉卷軸')}
            </h1>
            <span className="hidden md:inline text-xs text-[#7E8899]">
              {t('循序破關兼支援自由跳關體驗')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* 繁簡分流切換（全五關字根與拆字同步分流） */}
          <div
            className="hidden md:inline-flex items-center gap-0.5 p-0.5 bg-[#121722] border border-[#F2EEE6]/10 rounded-lg"
            title={t('全程依所選繁簡分流訓練（字根、逐鍵宮殿與拆字同步過濾，避免同源異鍵干擾）；記憶宮殿對照圖則淡化非本字集字根')}
          >
            {SCRIPT_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeScriptMode(opt.id);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scriptMode === opt.id
                    ? 'bg-[#212A3A] text-[#F2D59B]'
                    : 'text-[#8994A6] hover:text-[#E5E0D5]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono-tabular">
            <span className="text-[#8E98A8] font-sans">{t('段位')}</span>
            <span className="font-display font-bold text-sm text-[#D89B3C]">
              {t(summary.rank.title)}
            </span>
            <span className="text-[#465063]" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-[#F2D59B]">
              <Star className="w-3.5 h-3.5 fill-[#D89B3C] text-[#D89B3C]" />
              <span>
                {summary.totalStars}/{summary.maxStars}
              </span>
            </span>
            {summary.rank.nextTitle && summary.rank.nextMinStars !== undefined && (
              <>
                <span className="hidden lg:inline text-[#465063]" aria-hidden="true">·</span>
                <span className="hidden lg:inline text-[#7D8696] font-sans">
                  {t('再')} {Math.max(0, summary.rank.nextMinStars - summary.totalStars)}{' '}
                  {t(`星晉升「${summary.rank.nextTitle}」`)}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onOpenPalaceCloud();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F2D59B] hover:text-white bg-[#171E2C] hover:bg-[#232D40] border border-[#D89B3C]/35 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[#D89B3C]" />
            <span>{t('記憶宮殿雲圖')}</span>
          </button>
        </div>
      </header>

      {/* Main Campaign Workspace */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* 5-Chapter Progression Rail */}
          <section aria-label={t('五大修煉關卡總覽')}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {CAMPAIGN_CHAPTERS.map((ch) => {
                const isSelected = ch.id === selectedChapterId;
                const chStars = ch.stages.reduce(
                  (acc, st) => acc + (progress.stages[st.id]?.stars ?? 0),
                  0
                );
                const chMaxStars = ch.stages.length * 3;
                const chCleared = ch.stages.filter(
                  (st) => (progress.stages[st.id]?.stars ?? 0) > 0
                ).length;
                const pct = Math.round((chStars / chMaxStars) * 100);
                const isNextChapter = summary.nextRecommendedStage.chapterId === ch.id;

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChapter(ch.id)}
                    className={`relative text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#171E2C] border-[#D89B3C]/65'
                        : 'bg-[#111621] hover:bg-[#161C29] border-[#F2EEE6]/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono-tabular text-[11px] font-semibold ${
                          isSelected ? 'text-[#E8C078]' : 'text-[#8994A6]'
                        }`}
                      >
                        {t(`第 ${ch.id} 關 · ${ch.shortTitle}`)}
                      </span>
                      {isNextChapter && (
                        <span className="text-[11px] font-medium text-[#2EA87E] whitespace-nowrap">
                          {t('當前進度')}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-display text-base font-bold text-[#F5F1E8]">
                        {t(ch.sceneName)}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs font-mono-tabular text-[#8F99AA]">
                        <span>
                          {chCleared}/{ch.stages.length} {t('節')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#D89B3C]">
                          <Star className="w-3 h-3 fill-[#D89B3C] text-[#D89B3C]" />
                          <span>
                            {chStars}/{chMaxStars}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-[2px] bg-[#F2EEE6]/8 overflow-hidden rounded-full">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: chStars === chMaxStars ? '#2EA87E' : '#D89B3C',
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected Chapter Editorial Header & Cognitive Breakdown */}
          <section className="bg-[#121722] border border-[#F2EEE6]/10 rounded-xl p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-5 border-b border-[#F2EEE6]/8">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2.5 text-xs text-[#D89B3C] font-medium mb-1">
                  <span>{t(`第 ${selectedChapter.id} 重境`)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t(`場景「${selectedChapter.sceneName}」`)}</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-[#F5F1E8]">
                  {t(selectedChapter.title)}
                </h2>
                <p className="mt-2 text-sm text-[#B9C1CE] leading-relaxed">
                  {t(selectedChapter.cognitiveGoal)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {selectedChapter.id === 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      onOpenPalaceCloud();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#F2D59B] hover:text-white bg-[#1A2130] hover:bg-[#232D42] border border-[#D89B3C]/40 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#D89B3C]" />
                    <span>{t('預覽 25 鍵記憶宮殿圖')}</span>
                  </button>
                )}

                {selectedChapter.id === summary.nextRecommendedStage.chapterId && (
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      onLaunchStage(summary.nextRecommendedStage);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#D94A38] hover:bg-[#E45643] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {t('立即開始推薦小節')}（{t(summary.nextRecommendedStage.indexLabel)}）
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Unboxed Cognitive Barrier & Reflex Target Metadata + Script Scope */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 text-xs border-b border-[#F2EEE6]/8">
              <div>
                <div className="text-[#7E8899] mb-1">{t('克服的形碼認知難關')}</div>
                <div className="text-[#E5E0D5] font-medium">{t(selectedChapter.barrierResolved)}</div>
              </div>
              <div>
                <div className="text-[#7E8899] mb-1">{t('建立的條件反射路徑')}</div>
                <div className="text-[#7CE5BC] font-medium">{t(selectedChapter.reflexTarget)}</div>
              </div>
              <div>
                <div className="text-[#7E8899] mb-1">{t('繁簡範圍策略')}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#F2D59B] font-medium">
                    {t(SCRIPT_MODE_LABELS[scriptMode])}
                    {selectedChapter.id === 3 && (
                      <span className="text-[#8E98A8] font-normal">
                        {' '}· {t('記憶宮殿同步淡化非本字集字根')}
                      </span>
                    )}
                  </span>
                  <div className="inline-flex items-center gap-0.5 p-0.5 bg-[#0D111A] border border-[#F2EEE6]/10 rounded-md md:hidden">
                    {SCRIPT_MODE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          onChangeScriptMode(opt.id);
                        }}
                        className={`px-2 py-0.5 text-[11px] rounded transition-colors whitespace-nowrap cursor-pointer ${
                          scriptMode === opt.id
                            ? 'bg-[#212A3A] text-[#F2D59B]'
                            : 'text-[#8994A6] hover:text-white'
                        }`}
                      >
                        {t(opt.short)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Chapter 3 Step 1: 20-Key Key-by-Key Memory Palace Practice */}
            {selectedChapter.id === 3 && (
              <div className="mt-5 pb-5 border-b border-[#F2EEE6]/8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-base font-bold text-[#F5F1E8]">
                        {t('第一步 · 二十宮殿逐鍵巡禮')}
                      </h3>
                      <span className="font-mono-tabular text-xs font-semibold text-[#7CE5BC]">
                        {t(`已修完 ${clearedChamberCount}/20 鍵`)}
                      </span>
                    </div>
                    <p className="text-xs text-[#8E98A8] mt-1">
                      {t('點擊下方任一輔音鍵位，依該鍵宮殿 1:1 筆順位置由主根逐一敲遍全部字根；先建牢單鍵宮殿，再進跨鍵混測。')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setChamberBlindMode((v) => !v);
                      }}
                      title={t('切換逐鍵巡禮時的預設輔助提示')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        chamberBlindMode
                          ? 'bg-[#172824] border-[#2EA87E]/50 text-[#7CE5BC]'
                          : 'bg-[#0F141E] hover:bg-[#171E2C] border-[#F2EEE6]/10 text-[#9AA3B2]'
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{t(chamberBlindMode ? '逐鍵：默背盲打' : '逐鍵：雲圖漸隱')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        onLaunchChamberDrill(nextChamberKey, 'root', chamberBlindMode);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#2EA87E] hover:bg-[#36BC8E] text-[#0A1410] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {t('練習下一鍵：')}
                        {nextChamberKey.toUpperCase()}（
                        <InlinePrimaryGlyph char={nextChamberAnchor} />）
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {PALACE_ROW_GROUPS.map((rowGroup) => (
                    <div key={rowGroup.label} className="flex flex-col gap-1.5">
                      <div className="text-[11px] font-medium text-[#7D8798]">
                        {t(rowGroup.label)}
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                        {rowGroup.keys.map((k) => {
                          const chamber = LINGMING_CHAMBER_BY_KEY[k];
                          const totalRoots =
                            chamber?.clusters.reduce(
                              (sum, c) =>
                                sum +
                                c.radicals.filter((r) =>
                                  matchesScript(
                                    getLingmingRadicalScript(r.char, k, r.ma),
                                    scriptMode
                                  )
                                ).length,
                              0
                            ) ?? 0;
                          const rec = progress.chambers?.[k];
                          const isCleared = (rec?.clears ?? 0) > 0;
                          const isNextTarget = k === nextChamberKey && !isCleared;

                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                synth.playClick();
                                onLaunchChamberDrill(k, 'root', chamberBlindMode);
                              }}
                              className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                                isCleared
                                  ? 'bg-[#101C19] hover:bg-[#142420] border-[#2EA87E]/40'
                                  : isNextTarget
                                    ? 'bg-[#181E2B] hover:bg-[#1F2738] border-[#D89B3C]/65'
                                    : 'bg-[#0F141E] hover:bg-[#161D2B] border-[#F2EEE6]/10 hover:border-[#F2EEE6]/25'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`font-mono-tabular text-xs font-bold ${
                                    isCleared
                                      ? 'text-[#7CE5BC]'
                                      : isNextTarget
                                        ? 'text-[#F2D59B]'
                                        : 'text-[#D89B3C]'
                                  }`}
                                >
                                  {k.toUpperCase()}
                                </span>
                                <span className="font-mono-tabular text-[10px] text-[#7D8696]">
                                  {totalRoots}
                                  {t('根')}
                                </span>
                              </div>

                              <div className="font-display text-xl font-bold text-[#F5F1E8] leading-none py-0.5 text-center">
                                <InlinePrimaryGlyph char={chamber?.primaryAnchor || ''} />
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                                {isCleared && rec ? (
                                  <>
                                    <span className="inline-flex items-center gap-0.5 text-[#34D399] font-medium">
                                      <Check className="w-3 h-3" />
                                      <span>{rec.bestAccuracy}%</span>
                                    </span>
                                    <span className="text-[#7D8696] font-sans">
                                      {t(rec.blindCleared ? '默' : `${rec.clears}遍`)}
                                    </span>
                                  </>
                                ) : (
                                  <span
                                    className={`font-sans ${
                                      isNextTarget ? 'text-[#E8C078]' : 'text-[#6C7585]'
                                    }`}
                                  >
                                    {t(isNextTarget ? '建議先練' : '待巡禮')}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedChapter.id === 3 && (
              <div className="mt-5 mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-[#F5F1E8]">
                  {t('第二步 · 全宮殿跨鍵分級混測與檢定')}
                </h3>
                <span className="text-xs text-[#7E8899]">{t('按字根使用頻率由內向外展開')}</span>
              </div>
            )}

            {/* 4-Stage Cards Grid */}
            <div className={`${selectedChapter.id === 3 ? '' : 'mt-5 '}grid grid-cols-1 md:grid-cols-2 gap-3.5`}>
              {selectedChapter.stages.map((stage) => {
                const rec = progress.stages[stage.id];
                const stars = rec?.stars ?? 0;
                const isRecommended = summary.nextRecommendedStage.id === stage.id;
                const isCleared = stars > 0;

                return (
                  <div
                    key={stage.id}
                    className={`p-4 sm:p-5 rounded-xl border flex flex-col justify-between gap-4 transition-colors ${
                      stage.isBossTrial
                        ? 'bg-[#17151D] border-[#D94A38]/40 hover:border-[#D94A38]/65'
                        : isRecommended
                          ? 'bg-[#151D2A] border-[#2EA87E]/50'
                          : 'bg-[#0F141E] border-[#F2EEE6]/10 hover:border-[#F2EEE6]/22'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-mono-tabular">
                            <span
                              className={`font-bold ${
                                stage.isBossTrial ? 'text-[#F07868]' : 'text-[#D89B3C]'
                              }`}
                            >
                              {t(stage.indexLabel)}
                            </span>
                            {stage.isBossTrial && (
                              <span className="inline-flex items-center gap-1 text-[#F07868] font-sans">
                                <Shield className="w-3 h-3" />
                                <span>{t('關末檢定')}</span>
                              </span>
                            )}
                            {isRecommended && (
                              <span className="inline-flex items-center gap-1 text-[#34D399] font-sans font-medium">
                                <Sparkles className="w-3 h-3" />
                                <span>{t('推薦下一節')}</span>
                              </span>
                            )}
                          </div>

                          <h3 className="font-display text-lg font-bold text-[#F5F1E8] mt-1">
                            {t(stage.title)}
                          </h3>
                        </div>

                        {/* 3-Star Seal Row */}
                        <div
                          className="flex items-center gap-1 shrink-0 pt-0.5"
                          aria-label={t(`星級 ${stars} / 3`)}
                        >
                          {[1, 2, 3].map((n) => (
                            <Star
                              key={n}
                              className={`w-4 h-4 ${
                                n <= stars
                                  ? stage.isBossTrial
                                    ? 'fill-[#D94A38] text-[#D94A38]'
                                    : 'fill-[#D89B3C] text-[#D89B3C]'
                                  : 'text-[#313949]'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-[#9AA4B4] leading-relaxed">
                        {t(stage.subtitle)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#F2EEE6]/8">
                      <div className="text-xs font-mono-tabular text-[#848E9F]">
                        {isCleared && rec ? (
                          <span>
                            {t(`最佳 ${rec.bestAccuracy}%`)} ·{' '}
                            {rec.bestAvgMs > 0 ? `${rec.bestAvgMs}ms` : '--'} · {t('已過關')}
                          </span>
                        ) : (
                          <span>
                            {stage.targetGoal} {t('題')} · {t('三星')} ≥{stage.threeStarAccuracy}% / ≤
                            {stage.threeStarAvgMs}ms
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          onLaunchStage(stage);
                        }}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          stage.isBossTrial
                            ? 'bg-[#D94A38] hover:bg-[#E45643] text-white'
                            : isRecommended
                              ? 'bg-[#2EA87E] hover:bg-[#36BC8E] text-[#0A1410]'
                              : 'bg-[#1D2535] hover:bg-[#273247] text-[#F2EEE6]'
                        }`}
                      >
                        {isCleared ? (
                          <RotateCcw className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>
                          {t(
                            stage.isBossTrial
                              ? isCleared
                                ? '重試檢定'
                                : '挑戰檢定戰'
                              : isCleared
                                ? '重練沖星'
                                : '開始練習'
                          )}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
