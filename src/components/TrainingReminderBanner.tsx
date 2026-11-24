import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, CalendarClock, Clock, Flame, Play, ShieldAlert, Sparkles, X } from 'lucide-react';
import { CampaignProgressStore } from '../data/campaign';
import { NovicePracticeAction } from '../data/noviceCurriculum';
import { ScriptMode } from '../data/scriptFilter';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { getLocalDateKey, SchemeMasteryStore } from '../engine/mastery';
import {
  computeSlotCountdown,
  evaluateTrainingState,
  fireBrowserNotification,
  loadCompletedDaysList,
  loadTrainingSchedule,
  saveTrainingSchedule,
  TrainingScheduleConfig,
} from '../engine/trainingScheduler';
import { synth } from '../audio/synth';

interface TrainingReminderBannerProps {
  visibleScreen: boolean; // Show only on non-typing/hub screens so active typing is never interrupted
  mastery: SchemeMasteryStore;
  campaignProgress: CampaignProgressStore;
  scriptMode: ScriptMode;
  scheduleVersion: number;
  onScheduleChanged: () => void;
  onLaunchAction: (action: NovicePracticeAction) => void;
  onOpenCoachCenter: () => void;
}

export const TrainingReminderBanner: React.FC<TrainingReminderBannerProps> = ({
  visibleScreen,
  mastery,
  campaignProgress,
  scriptMode,
  scheduleVersion,
  onScheduleChanged,
  onLaunchAction,
  onOpenCoachCenter,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [config, setConfig] = useState<TrainingScheduleConfig>(() => loadTrainingSchedule());

  // Sync config whenever external schedule settings change
  useEffect(() => {
    setConfig(loadTrainingSchedule());
  }, [scheduleVersion]);

  // 20-second clock ticker to catch flexible training windows
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
      setConfig(loadTrainingSchedule());
    }, 20000);
    return () => window.clearInterval(id);
  }, []);

  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const todayKey = useMemo(() => getLocalDateKey(now), [now]);
  const completedDays = useMemo(() => loadCompletedDaysList(), [scheduleVersion, nowTick]);

  const slotInfo = useMemo(() => computeSlotCountdown(config, now), [config, now]);

  const evalResult = useMemo(
    () =>
      evaluateTrainingState({
        mastery,
        campaignProgress,
        completedDays,
        scriptMode,
        config,
        now,
      }),
    [mastery, campaignProgress, completedDays, scriptMode, config, now]
  );

  // Smart Quota-Aware Suppression: never fire if quota already hit OR today is postponed
  const isDueSlot = Boolean(
    config.notificationsEnabled &&
      !evalResult.todaySuppressed &&
      slotInfo.activeSlotNow &&
      slotInfo.activeSlotKey &&
      nowTick >= config.snoozedUntilMs &&
      config.lastNotifiedSlotKey !== `${slotInfo.activeSlotKey}_dismissed`
  );

  // Trigger optional audio / browser notification once per flexible window (respecting deliveryMode)
  useEffect(() => {
    if (!isDueSlot || !slotInfo.activeSlotKey) return;
    if (
      config.lastNotifiedSlotKey === slotInfo.activeSlotKey ||
      config.lastNotifiedSlotKey === `${slotInfo.activeSlotKey}_dismissed`
    ) {
      return;
    }
    const nextCfg: TrainingScheduleConfig = {
      ...config,
      lastNotifiedSlotKey: slotInfo.activeSlotKey,
    };
    saveTrainingSchedule(nextCfg);
    setConfig(nextCfg);
    onScheduleChanged();

    if (config.deliveryMode === 'soft_chime' || config.deliveryMode === 'browser_push') {
      synth.playMilestone();
    }
    if (config.deliveryMode === 'browser_push') {
      const slotTitle =
        slotInfo.activeSlotNow === 'morning' ? '彈性醒腦時窗' : '睡前固化時窗';
      fireBrowserNotification(
        t(`墨鍵道場 · ${slotTitle}`),
        t(
          `習慣錨點「${slotInfo.activeAnchorCue || ''}」：Day ${evalResult.currentPlanDay} 今日 ${evalResult.todayChars}/${evalResult.todayQuota} 字`
        )
      );
    }
  }, [
    isDueSlot,
    slotInfo.activeSlotKey,
    slotInfo.activeSlotNow,
    slotInfo.activeAnchorCue,
    config,
    evalResult,
    onScheduleChanged,
    t,
  ]);

  if (!visibleScreen || !isDueSlot) return null;

  const topTask = evalResult.adaptiveTasks[0];
  const isCritical = topTask?.priority === 'critical' || evalResult.statusLevel === 'devil_lock';

  const handleSnooze15 = () => {
    synth.playClick();
    const nextCfg: TrainingScheduleConfig = {
      ...config,
      snoozedUntilMs: Date.now() + 15 * 60 * 1000,
    };
    saveTrainingSchedule(nextCfg);
    setConfig(nextCfg);
    onScheduleChanged();
  };

  const handleLowDoseToday = () => {
    synth.playClick();
    const nextLowDose = config.lowDoseDates.includes(todayKey)
      ? config.lowDoseDates
      : [...config.lowDoseDates, todayKey];
    const nextCfg: TrainingScheduleConfig = {
      ...config,
      lowDoseDates: nextLowDose,
    };
    saveTrainingSchedule(nextCfg);
    setConfig(nextCfg);
    onScheduleChanged();
  };

  const handlePostponeToday = () => {
    synth.playClick();
    const nextRest = config.restDates.includes(todayKey)
      ? config.restDates
      : [...config.restDates, todayKey];
    const nextCfg: TrainingScheduleConfig = {
      ...config,
      restDates: nextRest,
    };
    saveTrainingSchedule(nextCfg);
    setConfig(nextCfg);
    onScheduleChanged();
  };

  const handleDismissSlot = () => {
    synth.playClick();
    if (!slotInfo.activeSlotKey) return;
    const nextCfg: TrainingScheduleConfig = {
      ...config,
      lastNotifiedSlotKey: `${slotInfo.activeSlotKey}_dismissed`,
    };
    saveTrainingSchedule(nextCfg);
    setConfig(nextCfg);
    onScheduleChanged();
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm rounded-xl border p-4 shadow-2xl backdrop-blur-md transition-all ${
        isWash
          ? isCritical
            ? 'bg-[#FAF6F4]/96 border-[#B83226]/45 text-[#141413]'
            : 'bg-[#FAF9F5]/96 border-[#141413]/22 text-[#141413]'
          : isCritical
            ? 'bg-[#1C1418]/95 border-[#D94A38]/55 text-[#F6F2EA]'
            : 'bg-[#121926]/95 border-[#D89B3C]/45 text-[#F6F2EA]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold min-w-0">
          {isCritical ? (
            <ShieldAlert className="w-4 h-4 text-[var(--dojo-crimson)] shrink-0" />
          ) : (
            <BellRing className="w-4 h-4 text-[var(--dojo-ochre)] shrink-0" />
          )}
          <span
            className={`truncate ${
              isCritical ? 'text-[var(--dojo-crimson)]' : 'text-[var(--dojo-ochre)]'
            }`}
          >
            {t(
              slotInfo.activeSlotNow === 'morning'
                ? `彈性早練窗 (${slotInfo.activeWindowRange})`
                : `睡前固化窗 (${slotInfo.activeWindowRange})`
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismissSlot}
          aria-label={t('關閉本次訓練提示')}
          className="text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {slotInfo.activeAnchorCue && (
        <div className="mt-1.5 text-[11px] text-[var(--dojo-pine-text)] font-medium">
          {t('習慣錨點')}：{t(slotInfo.activeAnchorCue)}
        </div>
      )}

      <div className="mt-1.5 space-y-1">
        <div className="text-sm font-bold font-display">
          Day {evalResult.currentPlanDay} ·{' '}
          {t(topTask ? topTask.title : evalResult.recommendedLesson.title)}
        </div>
        <p className="text-xs text-[var(--dojo-text-sub)] leading-relaxed">
          {t(topTask ? topTask.reason : evalResult.statusSummary)}
        </p>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono-tabular text-[var(--dojo-text-muted)]">
        <span>
          {t('今日完成')} {evalResult.todayChars}/{evalResult.todayQuota} {t('字')}
          {evalResult.isLowDoseToday ? ` (${t('保溫半量')})` : ''}
        </span>
        <span>
          {t('慢字池')} {evalResult.slowPoolCount} · {t('連練')} {evalResult.streakDays} {t('天')}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {topTask && (
          <button
            type="button"
            onClick={() => {
              handleDismissSlot();
              onLaunchAction(topTask.action);
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isWash
                ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t(topTask.action.label)}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleSnooze15}
          className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs transition-colors whitespace-nowrap cursor-pointer ${
            isWash
              ? 'bg-white hover:bg-[#F1EFE9] border-[#141413]/15 text-[#333330]'
              : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/12 text-[#D6DCE8]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t('延後 15 分')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            synth.playClick();
            onOpenCoachCenter();
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs transition-colors whitespace-nowrap cursor-pointer ${
            isWash
              ? 'bg-white hover:bg-[#F1EFE9] border-[#141413]/15 text-[#333330]'
              : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/12 text-[#D6DCE8]'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
          <span>{t('節律設定')}</span>
        </button>
      </div>

      {/* Low-friction escape valves so real life never turns into alert fatigue */}
      <div className="mt-2.5 pt-2 border-t border-[var(--dojo-border)] flex items-center justify-between gap-2 text-[11px]">
        {!evalResult.isLowDoseToday ? (
          <button
            type="button"
            onClick={handleLowDoseToday}
            className="inline-flex items-center gap-1 text-[var(--dojo-pine-text)] hover:underline cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>{t('今天太忙？改半量 5 分鐘保溫')}</span>
          </button>
        ) : (
          <span className="text-[var(--dojo-pine-text)]">{t('已切為 5 分鐘保溫線')}</span>
        )}
        <button
          type="button"
          onClick={handlePostponeToday}
          className="inline-flex items-center gap-1 text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] cursor-pointer whitespace-nowrap"
        >
          <CalendarClock className="w-3 h-3" />
          <span>{t('今日調休順延')}</span>
        </button>
      </div>
    </aside>
  );
};
