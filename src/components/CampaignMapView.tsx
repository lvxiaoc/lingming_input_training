import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Compass,
  EyeOff,
  Play,
  RotateCcw,
  ScanSearch,
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
  getChamberXrayStats,
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
import { THEME_OPTIONS, ThemeMode, useThemeMode } from '../data/theme';
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
  onChangeThemeMode?: (mode: ThemeMode) => void;
  onBackToTitle: () => void;
  onOpenPalaceCloud: () => void;
  onLaunchStage: (stage: CampaignStage) => void;
  onLaunchChamberDrill: (chamberKey: string, scope: 'da' | 'root', blind?: boolean) => void;
  onLaunchChamberXrayDrill?: (chamberKey: string | null, blind?: boolean) => void;
}

export const CampaignMapView: React.FC<CampaignMapViewProps> = ({
  progress,
  scriptMode,
  initialChapterId,
  onChangeScriptMode,
  onChangeThemeMode,
  onBackToTitle,
  onOpenPalaceCloud,
  onLaunchStage,
  onLaunchChamberDrill,
  onLaunchChamberXrayDrill,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const summary = useMemo(() => getCampaignSummary(progress), [progress]);
  const [selectedChapterId, setSelectedChapterId] = useState<1 | 2 | 3 | 4 | 5>(
    initialChapterId ?? summary.nextRecommendedStage.chapterId
  );
  const [chamberBlindMode, setChamberBlindMode] = useState(false);
  const [chamberDrillStyle, setChamberDrillStyle] = useState<'isolated' | 'xray'>('isolated');

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
    <div className="relative z-10 w-full h-full flex flex-col bg-[var(--dojo-canvas)] wash:bg-transparent text-[var(--dojo-text)] overflow-hidden wash-enter">
      {/* Top Dojo Header */}
      <header className="shrink-0 h-14 px-4 sm:px-8 bg-[var(--dojo-header)] wash:bg-[var(--dojo-header)]/88 wash:backdrop-blur-sm border-b border-[var(--dojo-border)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBackToTitle();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回主畫面')}</span>
          </button>

          <div className="min-w-0 flex items-baseline gap-2.5">
            <h1 className="font-display text-base sm:text-lg font-bold text-[var(--dojo-text-bright)] truncate">
              {t('墨鍵道場 · 五重修煉卷軸')}
            </h1>
            <span className="hidden md:inline text-xs text-[var(--dojo-text-muted)]">
              {t('循序破關兼支援自由跳關體驗')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
          {/* 繁簡分流切換（全五關字根與拆字同步分流） */}
          <div
            className="hidden md:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)] border border-[var(--dojo-border)] rounded-lg"
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
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)]'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          {onChangeThemeMode && (
            <div
              className="hidden sm:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)] border border-[var(--dojo-border)] rounded-lg"
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
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    themeMode === opt.id
                      ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)]'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono-tabular">
            <span className="text-[var(--dojo-text-muted)] font-sans">{t('段位')}</span>
            <span className="font-display font-bold text-sm text-[var(--dojo-ochre)]">
              {t(summary.rank.title)}
            </span>
            <span className="text-[var(--dojo-border-strong)]" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-[var(--dojo-ochre)]">
              <Star className="w-3.5 h-3.5 fill-[var(--dojo-ochre)] text-[var(--dojo-ochre)]" />
              <span>
                {summary.totalStars}/{summary.maxStars}
              </span>
            </span>
            {summary.rank.nextTitle && summary.rank.nextMinStars !== undefined && (
              <>
                <span className="hidden lg:inline text-[var(--dojo-border-strong)]" aria-hidden="true">·</span>
                <span className="hidden lg:inline text-[var(--dojo-text-muted)] font-sans">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--dojo-ochre)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-ochre)]/35 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
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
                        ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)]'
                        : 'bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)]/75 border-[var(--dojo-border)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono-tabular text-[11px] font-semibold ${
                          isSelected ? 'text-[var(--dojo-ochre)]' : 'text-[var(--dojo-text-sub)]'
                        }`}
                      >
                        {t(`第 ${ch.id} 關 · ${ch.shortTitle}`)}
                      </span>
                      {isNextChapter && (
                        <span className="text-[11px] font-medium text-[var(--dojo-pine)] whitespace-nowrap">
                          {t('當前進度')}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                        {t(ch.sceneName)}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs font-mono-tabular text-[var(--dojo-text-sub)]">
                        <span>
                          {chCleared}/{ch.stages.length} {t('節')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[var(--dojo-ochre)]">
                          <Star className="w-3 h-3 fill-[var(--dojo-ochre)] text-[var(--dojo-ochre)]" />
                          <span>
                            {chStars}/{chMaxStars}
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-[2px] bg-[var(--dojo-border)] overflow-hidden rounded-full">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: chStars === chMaxStars ? 'var(--dojo-pine)' : 'var(--dojo-ochre)',
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Selected Chapter Editorial Header & Cognitive Breakdown */}
          <section
            key={selectedChapterId}
            className="wash-enter-soft bg-[var(--dojo-surface)] wash:bg-[#EAE7DF]/88 wash:backdrop-blur-xs border border-[var(--dojo-border)] rounded-xl p-5 sm:p-6"
          >
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-5 border-b border-[var(--dojo-border)]">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2.5 text-xs text-[var(--dojo-ochre)] font-medium mb-1">
                  <span>{t(`第 ${selectedChapter.id} 重境`)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t(`場景「${selectedChapter.sceneName}」`)}</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]">
                  {t(selectedChapter.title)}
                </h2>
                <p className="mt-2 text-sm text-[var(--dojo-text-sub)] leading-relaxed">
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[var(--dojo-ochre)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface-2)] border border-[var(--dojo-ochre)]/40 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
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
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 text-xs border-b border-[var(--dojo-border)]">
              <div>
                <div className="text-[var(--dojo-text-muted)] mb-1">{t('克服的形碼認知難關')}</div>
                <div className="text-[var(--dojo-text)] font-medium">{t(selectedChapter.barrierResolved)}</div>
              </div>
              <div>
                <div className="text-[var(--dojo-text-muted)] mb-1">{t('建立的條件反射路徑')}</div>
                <div className="text-[var(--dojo-pine-text)] font-medium">{t(selectedChapter.reflexTarget)}</div>
              </div>
              <div>
                <div className="text-[var(--dojo-text-muted)] mb-1">{t('繁簡範圍策略')}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--dojo-ochre)] font-medium">
                    {t(SCRIPT_MODE_LABELS[scriptMode])}
                    {selectedChapter.id === 3 && (
                      <span className="text-[var(--dojo-text-muted)] font-normal">
                        {' '}· {t('記憶宮殿同步淡化非本字集字根')}
                      </span>
                    )}
                  </span>
                  <div className="inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-md md:hidden">
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
                            ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)]'
                            : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
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
              <div className="mt-5 pb-5 border-b border-[var(--dojo-border)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                        {t('第一步 · 二十宮殿逐鍵巡禮')}
                      </h3>
                      <span className="font-mono-tabular text-xs font-semibold text-[var(--dojo-pine-text)]">
                        {t(`已修完 ${clearedChamberCount}/20 鍵`)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--dojo-text-muted)] mt-1">
                      {t(
                        chamberDrillStyle === 'xray'
                          ? '點擊任一輔音鍵，每次隨機抽取該鍵字根所在的真實漢字並高亮其變形筆畫，在語境中徹底練透單鍵記憶宮殿。'
                          : '點擊下方任一輔音鍵位，依該鍵宮殿 1:1 筆順位置由主根逐一敲遍全部字根；先建牢單鍵宮殿，再進跨鍵混測。'
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {onLaunchChamberXrayDrill && (
                      <div
                        className="inline-flex items-center p-0.5 bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] rounded-lg"
                        role="group"
                        aria-label={t('單鍵宮殿訓練方式')}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setChamberDrillStyle('isolated');
                          }}
                          className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            chamberDrillStyle === 'isolated'
                              ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] font-semibold'
                              : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                          }`}
                        >
                          {t('孤立字根')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setChamberDrillStyle('xray');
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            chamberDrillStyle === 'xray'
                              ? 'bg-[var(--dojo-pine)] text-white font-semibold'
                              : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                          }`}
                        >
                          <ScanSearch className="w-3 h-3" />
                          <span>{t('字中辨根（隨機漢字）')}</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setChamberBlindMode((v) => !v);
                      }}
                      title={t('切換逐鍵巡禮時的預設輔助提示')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        chamberBlindMode
                          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/50 text-[var(--dojo-pine-text)]'
                          : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>{t(chamberBlindMode ? '逐鍵：默背盲打' : '逐鍵：雲圖漸隱')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        if (chamberDrillStyle === 'xray' && onLaunchChamberXrayDrill) {
                          onLaunchChamberXrayDrill(nextChamberKey, chamberBlindMode);
                        } else {
                          onLaunchChamberDrill(nextChamberKey, 'root', chamberBlindMode);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {t(chamberDrillStyle === 'xray' ? '字中辨根下一鍵：' : '練習下一鍵：')}
                        {nextChamberKey.toUpperCase()}（
                        <InlinePrimaryGlyph char={nextChamberAnchor} />）
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {PALACE_ROW_GROUPS.map((rowGroup) => (
                    <div key={rowGroup.label} className="flex flex-col gap-1.5">
                      <div className="text-[11px] font-medium text-[var(--dojo-text-muted)]">
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
                          const xrayStats =
                            chamberDrillStyle === 'xray'
                              ? getChamberXrayStats(k, scriptMode)
                              : null;

                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                synth.playClick();
                                if (chamberDrillStyle === 'xray' && onLaunchChamberXrayDrill) {
                                  onLaunchChamberXrayDrill(k, chamberBlindMode);
                                } else {
                                  onLaunchChamberDrill(k, 'root', chamberBlindMode);
                                }
                              }}
                              className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                                isCleared
                                  ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45'
                                  : isNextTarget
                                    ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/65'
                                    : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`font-mono-tabular text-xs font-bold ${
                                    isCleared
                                      ? 'text-[var(--dojo-pine-text)]'
                                      : 'text-[var(--dojo-ochre)]'
                                  }`}
                                >
                                  {k.toUpperCase()}
                                </span>
                                <span className="font-mono-tabular text-[10px] text-[var(--dojo-text-muted)]">
                                  {xrayStats
                                    ? `${xrayStats.carrierCount}${t('字')}`
                                    : `${totalRoots}${t('根')}`}
                                </span>
                              </div>

                              <div className="font-display text-xl font-bold text-[var(--dojo-text-bright)] leading-none py-0.5 text-center">
                                <InlinePrimaryGlyph char={chamber?.primaryAnchor || ''} />
                              </div>

                              <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                                {isCleared && rec ? (
                                  <>
                                    <span className="inline-flex items-center gap-0.5 text-[var(--dojo-pine-text)] font-medium">
                                      <Check className="w-3 h-3" />
                                      <span>{rec.bestAccuracy}%</span>
                                    </span>
                                    <span className="text-[var(--dojo-text-muted)] font-sans">
                                      {t(rec.blindCleared ? '默' : `${rec.clears}遍`)}
                                    </span>
                                  </>
                                ) : (
                                  <span
                                    className={`font-sans ${
                                      isNextTarget ? 'text-[var(--dojo-ochre)]' : 'text-[var(--dojo-text-muted)]'
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

            {selectedChapter.id === 4 && onLaunchChamberXrayDrill && (
              <div className="mt-5 pb-5 border-b border-[var(--dojo-border)]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                      {t('單鍵宮殿 · 隨機字中辨根挑戰')}
                    </h3>
                    <p className="text-xs text-[var(--dojo-text-muted)] mt-0.5">
                      {t('選擇任一記憶宮殿鍵位，每輪隨機更換不同承載漢字並高亮該鍵小字根在字中的真實變形，告別孤立死背。')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      onLaunchChamberXrayDrill(null, false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-lg transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ScanSearch className="w-3.5 h-3.5" />
                    <span>{t('全宮殿隨機字中辨根 (24題)')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {PALACE_GUIDED_KEYS.map((k) => {
                    const chamber = LINGMING_CHAMBER_BY_KEY[k];
                    const stats = getChamberXrayStats(k, scriptMode);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          onLaunchChamberXrayDrill(k, false);
                        }}
                        title={t(`${k.toUpperCase()} 鍵宮殿 · ${stats.carrierCount} 個隨機承載漢字`)}
                        className="p-2 rounded-lg border bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] hover:border-[var(--dojo-pine)]/60 border-[var(--dojo-border)] transition-colors cursor-pointer flex flex-col items-center gap-0.5"
                      >
                        <div className="w-full flex items-center justify-between text-[10px] font-mono-tabular">
                          <span className="font-bold text-[var(--dojo-ochre)]">{k.toUpperCase()}</span>
                          <span className="text-[var(--dojo-text-muted)]">{stats.carrierCount}{t('字')}</span>
                        </div>
                        <span className="font-display text-base font-bold text-[var(--dojo-text-bright)] leading-none">
                          <InlinePrimaryGlyph char={chamber?.primaryAnchor || ''} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedChapter.id === 3 && (
              <div className="mt-5 mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                  {t('第二步 · 全宮殿跨鍵分級混測與檢定')}
                </h3>
                <span className="text-xs text-[var(--dojo-text-muted)]">{t('按字根使用頻率由內向外展開')}</span>
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
                        ? 'bg-[var(--dojo-crimson-wash)]/40 border-[var(--dojo-crimson)]/45 hover:border-[var(--dojo-crimson)]/70'
                        : isRecommended
                          ? 'bg-[var(--dojo-pine-wash)]/45 border-[var(--dojo-pine)]/55'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] hover:border-[var(--dojo-border-strong)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-mono-tabular">
                            <span
                              className={`font-bold ${
                                stage.isBossTrial ? 'text-[var(--dojo-crimson-text)]' : 'text-[var(--dojo-ochre)]'
                              }`}
                            >
                              {t(stage.indexLabel)}
                            </span>
                            {stage.isBossTrial && (
                              <span className="inline-flex items-center gap-1 text-[var(--dojo-crimson-text)] font-sans">
                                <Shield className="w-3 h-3" />
                                <span>{t('關末檢定')}</span>
                              </span>
                            )}
                            {isRecommended && (
                              <span className="inline-flex items-center gap-1 text-[var(--dojo-pine-text)] font-sans font-medium">
                                <Sparkles className="w-3 h-3" />
                                <span>{t('推薦下一節')}</span>
                              </span>
                            )}
                          </div>

                          <h3 className="font-display text-lg font-bold text-[var(--dojo-text-bright)] mt-1">
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
                                    ? 'fill-[var(--dojo-crimson)] text-[var(--dojo-crimson)]'
                                    : 'fill-[var(--dojo-ochre)] text-[var(--dojo-ochre)]'
                                  : 'text-[var(--dojo-border-strong)]'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="mt-2 text-xs text-[var(--dojo-text-sub)] leading-relaxed">
                        {t(stage.subtitle)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--dojo-border)]">
                      <div className="text-xs font-mono-tabular text-[var(--dojo-text-muted)]">
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
                            ? 'bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white'
                            : isRecommended
                              ? 'bg-[var(--dojo-pine)] hover:opacity-90 text-white'
                              : 'bg-[var(--dojo-surface-2)] hover:opacity-90 text-[var(--dojo-text)] border border-[var(--dojo-border)]'
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
