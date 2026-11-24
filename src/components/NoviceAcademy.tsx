import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellRing,
  Brain,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  Compass,
  Flame,
  PenLine,
  Play,
  RotateCcw,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { CampaignProgressStore } from '../data/campaign';
import {
  BARRIER_REMEDIES,
  COGNITIVE_LAWS,
  DAILY_CURRICULUM,
  FREE_WRITING_PROMPTS,
  MODULE_DIRECTORY,
  NovicePracticeAction,
  PHASES,
} from '../data/noviceCurriculum';
import { getDrillEntry } from '../data/drillLexicon';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { SCRIPT_MODE_OPTIONS, ScriptMode } from '../data/scriptFilter';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { getLocalDateKey, SchemeMasteryStore } from '../engine/mastery';
import {
  BrowserNotifyStatus,
  buildTrainingIcsContent,
  computeSlotCountdown,
  evaluateTrainingState,
  fireBrowserNotification,
  formatMinutesUntil,
  getBrowserNotifyStatus,
  loadCompletedDaysList,
  loadTrainingSchedule,
  requestBrowserNotifyPermission,
  saveCompletedDaysList,
  saveTrainingSchedule,
  TrainingScheduleConfig,
} from '../engine/trainingScheduler';
import { synth } from '../audio/synth';

export type AcademyTab = 'coach' | 'laws' | 'barriers' | 'path' | 'modules';

const STORAGE_FREEWRITE_DRAFT = 'inkkey_novice_freewrite_draft_v1';
const STORAGE_STUCK_CHARS = 'inkkey_novice_stuck_chars_v1';

function countChineseChars(text: string): number {
  const matches = text.match(/[\u4e00-\u9fff]/g);
  return matches ? matches.length : 0;
}

interface NoviceAcademyProps {
  mastery: SchemeMasteryStore;
  campaignProgress: CampaignProgressStore;
  initialTab?: AcademyTab;
  scriptMode: ScriptMode;
  onChangeScriptMode: (next: ScriptMode) => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  onScheduleChanged?: () => void;
  onBack: () => void;
  onLaunchAction: (action: NovicePracticeAction) => void;
}

export const NoviceAcademy: React.FC<NoviceAcademyProps> = ({
  mastery,
  campaignProgress,
  initialTab,
  scriptMode,
  onChangeScriptMode,
  themeMode,
  onChangeThemeMode,
  onScheduleChanged,
  onBack,
  onLaunchAction,
}) => {
  const t = useUiText();
  const isWash = themeMode === 'wash';

  const [activeTab, setActiveTab] = useState<AcademyTab>(initialTab ?? 'coach');
  const [phaseFilter, setPhaseFilter] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [completedDays, setCompletedDays] = useState<number[]>(() => loadCompletedDaysList());
  const [scheduleConfig, setScheduleConfig] = useState<TrainingScheduleConfig>(() =>
    loadTrainingSchedule()
  );
  const [notifyStatus, setNotifyStatus] = useState<BrowserNotifyStatus>(() =>
    getBrowserNotifyStatus()
  );
  const [notifyFeedback, setNotifyFeedback] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Free-Writing Isolation Bridge state (Tab 5)
  const [promptIdx, setPromptIdx] = useState<number>(0);
  const [freeDraft, setFreeDraft] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_FREEWRITE_DRAFT) || '';
    } catch {
      return '';
    }
  });
  const [stuckInput, setStuckInput] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_STUCK_CHARS) || '能 這 說 就 裡';
    } catch {
      return '能 這 說 就 裡';
    }
  });

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FREEWRITE_DRAFT, freeDraft);
    } catch {
      // Ignore
    }
  }, [freeDraft]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_STUCK_CHARS, stuckInput);
    } catch {
      // Ignore
    }
  }, [stuckInput]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') {
          (e.target as HTMLElement).blur();
          return;
        }
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const updateScheduleConfig = (patch: Partial<TrainingScheduleConfig>) => {
    setScheduleConfig((prev) => {
      const next = { ...prev, ...patch };
      saveTrainingSchedule(next);
      return next;
    });
    onScheduleChanged?.();
  };

  const toggleDayCompleted = (day: number) => {
    synth.playClick();
    const todayKey = getLocalDateKey();
    setCompletedDays((prev) => {
      const removing = prev.includes(day);
      const next = removing
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b);
      saveCompletedDaysList(next);
      const nextDates = { ...scheduleConfig.dayCompletedDates };
      if (removing) {
        delete nextDates[day];
      } else {
        nextDates[day] = todayKey;
      }
      updateScheduleConfig({ dayCompletedDates: nextDates });
      return next;
    });
  };

  const resetProgress = () => {
    synth.playClick();
    setCompletedDays([]);
    saveCompletedDaysList([]);
    updateScheduleConfig({ dayCompletedDates: {} });
  };

  const nowDate = useMemo(() => new Date(nowTick), [nowTick]);
  const slotInfo = useMemo(
    () => computeSlotCountdown(scheduleConfig, nowDate),
    [scheduleConfig, nowDate]
  );
  const evaluation = useMemo(
    () =>
      evaluateTrainingState({
        mastery,
        campaignProgress,
        completedDays,
        scriptMode,
        config: scheduleConfig,
        now: nowDate,
      }),
    [mastery, campaignProgress, completedDays, scriptMode, scheduleConfig, nowDate]
  );

  const nextRecommendedDay = evaluation.currentPlanDay;
  const nextLesson = evaluation.recommendedLesson;

  const visibleLessons = useMemo(() => {
    if (phaseFilter === 0) return DAILY_CURRICULUM;
    return DAILY_CURRICULUM.filter((l) => l.phaseId === phaseFilter);
  }, [phaseFilter]);

  const handleEnableBrowserNotify = async () => {
    synth.playClick();
    const res = await requestBrowserNotifyPermission();
    setNotifyStatus(res);
    if (res === 'granted') {
      updateScheduleConfig({ notificationsEnabled: true });
      fireBrowserNotification(
        t('墨鍵道場 · 魔鬼督訓鬧鐘已啟用'),
        t(`每日 ${scheduleConfig.morningTime} 與 ${scheduleConfig.eveningTime} 將準時督促練功。`)
      );
      setNotifyFeedback('瀏覽器系統通知已啟用並發送測試提示；若關閉本頁建議同時匯出 .ics 行事曆。');
    } else if (res === 'denied') {
      setNotifyFeedback('瀏覽器通知權限被拒（或於內嵌視窗受限），站內鬧鐘鈴聲仍可用，建議下載 .ics 行事曆鬧鐘。');
    } else if (res === 'unsupported') {
      setNotifyFeedback('當前瀏覽器環境不支援原生通知，已啟用站內鈴聲與提醒，並可匯出 .ics 行事曆。');
    }
  };

  const handleTestReminder = () => {
    synth.playMilestone();
    const fired = fireBrowserNotification(
      t(`墨鍵道場 · Day ${evaluation.currentPlanDay} 練功提醒`),
      t(`今日目標 ${evaluation.todayChars}/${evaluation.todayQuota} 字 · ${evaluation.adaptiveTasks[0]?.title || ''}`)
    );
    setNotifyFeedback(
      fired
        ? '已觸發鬧鐘鈴聲與系統彈窗通知！'
        : '已觸發站內鬧鐘鈴聲！若需離開網頁後依然準時響鈴，請點右側「匯出 14 天行事曆」。'
    );
  };

  const handleExportIcs = () => {
    synth.playClick();
    const content = buildTrainingIcsContent(scheduleConfig);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingming-14day-devil-plan-${scheduleConfig.startDate}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotifyFeedback('已下載 14 天早晚共 28 場訓練 .ics 行事曆檔案，雙擊即可匯入手機或電腦日曆自動響鈴。');
  };

  // Parse unique Chinese characters entered in the Stuck-Char Diagnostics box
  const stuckDiagnostics = useMemo(() => {
    const unique: string[] = [];
    for (const ch of stuckInput) {
      if (/[\u4e00-\u9fff]/.test(ch) && !unique.includes(ch)) {
        unique.push(ch);
      }
      if (unique.length >= 24) break;
    }
    return unique.map((ch) => ({
      char: ch,
      entry: getDrillEntry(ch) || null,
    }));
  }, [stuckInput]);

  const drillableStuckText = useMemo(
    () =>
      stuckDiagnostics
        .filter((d) => d.entry !== null)
        .map((d) => d.char)
        .join(''),
    [stuckDiagnostics]
  );

  const freeChineseCount = useMemo(() => countChineseChars(freeDraft), [freeDraft]);
  const freeGoalPct = Math.min(100, Math.round((freeChineseCount / 200) * 100));
  const activePrompt = FREE_WRITING_PROMPTS[promptIdx % FREE_WRITING_PROMPTS.length];

  const handleTriggerAction = (action: NovicePracticeAction) => {
    synth.playClick();
    onLaunchAction(action);
  };

  const surfaceCardClass = isWash
    ? 'bg-[#FAF9F5]/95 border-[#141413]/14 text-[#141413]'
    : 'bg-[#121824]/92 border-[#F2EEE6]/10 text-[#F2EEE6]';

  const subtlePanelClass = isWash
    ? 'bg-[#EFECE4]/70 border-[#141413]/10'
    : 'bg-[#0C1018]/80 border-[#F2EEE6]/8';

  return (
    <div
      className={`min-h-screen w-full flex flex-col ${
        isWash ? 'bg-[#F3F1EC] text-[#141413]' : 'bg-[#0B0E14] text-[#F2EEE6]'
      }`}
    >
      {/* Top 3-Zone Bar */}
      <header
        className={`shrink-0 sticky top-0 z-30 border-b backdrop-blur-md ${
          isWash
            ? 'bg-[#F3F1EC]/92 border-[#141413]/12'
            : 'bg-[#0D1119]/92 border-[#F2EEE6]/10'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          {/* Zone 1: Back + Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                onBack();
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isWash
                  ? 'bg-[#FAF9F5] hover:bg-white border-[#141413]/14 text-[#141413]'
                  : 'bg-[#161D2B] hover:bg-[#1E283B] border-[#F2EEE6]/12 text-[#DCE3F0]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('返回道場')}</span>
            </button>
            <h1 className="font-display text-base sm:text-lg font-bold tracking-wide truncate">
              {t('新手 14 天最短路徑速成學院')}
            </h1>
          </div>

          {/* Zone 2: Clean Text Navigation Tabs */}
          <nav
            role="tablist"
            aria-label={t('新手教程章節')}
            className="hidden lg:flex items-center gap-1"
          >
            {(
              [
                { id: 'coach', label: '01 督訓評估與鬧鐘' },
                { id: 'laws', label: '02 記憶規律' },
                { id: 'barriers', label: '03 七大難點' },
                { id: 'path', label: '04 14天路徑' },
                { id: 'modules', label: '05 自練與自由寫' },
              ] as Array<{ id: AcademyTab; label: string }>
            ).map((tabItem) => {
              const active = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    synth.playClick();
                    setActiveTab(tabItem.id);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? isWash
                        ? 'bg-[#181817] text-[#F8F7F3]'
                        : 'bg-[#1F293D] text-[#F7F3EC]'
                      : isWash
                        ? 'text-[#52524C] hover:text-[#141413] hover:bg-[#141413]/6'
                        : 'text-[#9BA5B6] hover:text-[#F2EEE6] hover:bg-white/5'
                  }`}
                >
                  {t(tabItem.label)}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Script & Theme Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label={t('字集與介面切換')}
              className={`hidden sm:inline-flex items-center p-0.5 rounded-lg border ${
                isWash
                  ? 'bg-[#FAF9F5] border-[#141413]/12'
                  : 'bg-[#141A26] border-[#F2EEE6]/10'
              }`}
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
                      ? isWash
                        ? 'bg-[#181817] text-[#F8F7F3]'
                        : 'bg-[#222C3F] text-[#F2EEE6]'
                      : isWash
                        ? 'text-[#5A5A54] hover:text-[#141413]'
                        : 'text-[#94A0B4] hover:text-[#F2EEE6]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label={t('切換道場視覺色調')}
              className={`inline-flex items-center p-0.5 rounded-lg border ${
                isWash
                  ? 'bg-[#FAF9F5] border-[#141413]/12'
                  : 'bg-[#141A26] border-[#F2EEE6]/10'
              }`}
            >
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    onChangeThemeMode(opt.id);
                  }}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    themeMode === opt.id
                      ? isWash
                        ? 'bg-[#181817] text-[#F8F7F3]'
                        : 'bg-[#222C3F] text-[#F2EEE6]'
                      : isWash
                        ? 'text-[#5A5A54] hover:text-[#141413]'
                        : 'text-[#94A0B4] hover:text-[#F2EEE6]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Tab Row */}
        <div className="lg:hidden px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'coach', label: '01 督訓評估與鬧鐘' },
              { id: 'laws', label: '02 記憶規律' },
              { id: 'barriers', label: '03 七大難點破壁' },
              { id: 'path', label: '04 14 天速成路徑' },
              { id: 'modules', label: '05 自練與自由書寫' },
            ] as Array<{ id: AcademyTab; label: string }>
          ).map((tabItem) => {
            const active = activeTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setActiveTab(tabItem.id);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? isWash
                      ? 'bg-[#181817] text-[#F8F7F3]'
                      : 'bg-[#1F293D] text-[#F7F3EC]'
                    : isWash
                      ? 'bg-[#E9E6DD] text-[#4E4E48]'
                      : 'bg-[#151B27] text-[#9BA5B6]'
                }`}
              >
                {t(tabItem.label)}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Top Actionable Learning Status & Daily Recommendation Strip */}
        <section className={`rounded-xl border p-5 ${surfaceCardClass}`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--dojo-text-sub)] font-mono-tabular">
                <span className="font-sans font-semibold text-[var(--dojo-ochre)]">
                  {t('目標：8–10 小時分散於 14 天達成自由書寫')}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('課表進度')} {completedDays.length}/14 {t('天')}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('下一建議')}：Day {nextLesson.day}
                </span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--dojo-text-bright)]">
                Day {nextLesson.day} · {t(nextLesson.title)}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)] leading-relaxed max-w-3xl">
                {t(nextLesson.focusSummary)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {nextLesson.practiceModules[0] && (
                <button
                  type="button"
                  onClick={() => handleTriggerAction(nextLesson.practiceModules[0].action)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isWash
                      ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                      : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t(nextLesson.practiceModules[0].action.label)}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setActiveTab('path');
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isWash
                    ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/16 text-[#141413]'
                    : 'bg-[#182030] hover:bg-[#212C42] border-[#F2EEE6]/14 text-[#E6E2DA]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{t('看 14 天完整課表')}</span>
              </button>
            </div>
          </div>

          {/* 14-Day Mini Stepper Progress Bar */}
          <div className="mt-4 pt-3.5 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {DAILY_CURRICULUM.map((lesson) => {
                const done = completedDays.includes(lesson.day);
                const isNext = lesson.day === nextRecommendedDay;
                return (
                  <button
                    key={lesson.day}
                    type="button"
                    onClick={() => toggleDayCompleted(lesson.day)}
                    title={t(`點擊標記或取消完成 Day ${lesson.day}：${lesson.title}`)}
                    className={`w-7 h-7 rounded-md text-[11px] font-mono-tabular font-semibold border transition-colors cursor-pointer flex items-center justify-center ${
                      done
                        ? isWash
                          ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                          : 'bg-[#2EA87E]/25 border-[#2EA87E] text-[#8CEBCB]'
                        : isNext
                          ? isWash
                            ? 'bg-[#D89B3C]/18 border-[#B87A18] text-[#141413]'
                            : 'bg-[#D89B3C]/20 border-[#D89B3C] text-[#F5C56B]'
                          : isWash
                            ? 'bg-white border-[#141413]/12 text-[#62625C] hover:border-[#141413]/30'
                            : 'bg-[#0D1119] border-[#F2EEE6]/10 text-[#848FA2] hover:border-[#F2EEE6]/28'
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : lesson.day}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[var(--dojo-text-muted)]">
              <span className="font-mono-tabular">
                {t('今日完成')} {evaluation.todayChars}/{evaluation.todayQuota} {t('字')} ·{' '}
                {t('下次鬧鐘')} {slotInfo.nextSlotTime}
              </span>
              {completedDays.length > 0 && (
                <button
                  type="button"
                  onClick={resetProgress}
                  className="inline-flex items-center gap-1 hover:text-[var(--dojo-text)] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('重置進度')}</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ==================== TAB 0 (COACH): DEVIL-MODE EVALUATION, ADAPTIVE PLAN & ALARMS ==================== */}
        {activeTab === 'coach' && (
          <div className="space-y-5">
            {/* Top Evaluation Verdict + Quantitative Readiness Telemetry */}
            <section
              className={`rounded-xl border p-5 space-y-4 ${
                evaluation.statusLevel === 'devil_lock'
                  ? isWash
                    ? 'bg-[#FAF5F4] border-[#B83226]/45 text-[#141413]'
                    : 'bg-[#1A1318] border-[#D94A38]/55 text-[#F6F2EA]'
                  : evaluation.statusLevel === 'warning'
                    ? isWash
                      ? 'bg-[#FAF8F2] border-[#B87A18]/40 text-[#141413]'
                      : 'bg-[#191714] border-[#D89B3C]/45 text-[#F6F2EA]'
                    : surfaceCardClass
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
                    <span
                      className={`font-sans font-bold ${
                        evaluation.statusLevel === 'devil_lock'
                          ? 'text-[var(--dojo-crimson)]'
                          : evaluation.statusLevel === 'ahead'
                            ? 'text-[var(--dojo-pine-text)]'
                            : 'text-[var(--dojo-ochre)]'
                      }`}
                    >
                      {t(
                        scheduleConfig.strictness === 'devil'
                          ? '魔鬼督訓引擎 · 實時診斷'
                          : '標準督訓引擎 · 實時診斷'
                      )}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('掌握度綜合評分')} {evaluation.readinessScore}/100
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('下次鬧鐘')} {slotInfo.nextSlotTime}（{t(formatMinutesUntil(slotInfo.minutesUntilNext))}）
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-bold">{t(evaluation.statusTitle)}</h2>
                  <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)] leading-relaxed max-w-3xl">
                    {t(evaluation.statusSummary)}
                  </p>
                </div>

                {/* Readiness Score Dial Summary */}
                <div
                  className={`shrink-0 rounded-xl border px-4 py-3 flex items-center gap-4 ${subtlePanelClass}`}
                >
                  <div className="text-center">
                    <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('掌握準備度')}</div>
                    <div className="font-mono-tabular text-2xl font-bold text-[var(--dojo-ochre)]">
                      {evaluation.readinessScore}
                      <span className="text-xs text-[var(--dojo-text-muted)]">/100</span>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-[var(--dojo-border)]" aria-hidden="true" />
                  <div className="text-xs space-y-0.5 font-mono-tabular">
                    <div>
                      {t('連練紀錄')}：{evaluation.streakDays} {t('天')}
                    </div>
                    <div>
                      {t('慢字池')}：{evaluation.slowPoolCount} {t('字')}
                    </div>
                    <div>
                      {t('自動化率')}：{evaluation.masteredRatePct}%
                    </div>
                  </div>
                </div>
              </div>

              {/* 5 Quantitative Telemetry Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('今日字數紅線')}</div>
                  <div className="font-mono-tabular text-lg font-bold mt-0.5">
                    {evaluation.todayChars}
                    <span className="text-xs font-normal text-[var(--dojo-text-muted)]">
                      /{evaluation.todayQuota}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-black/20 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${evaluation.todayQuotaPct}%`,
                        backgroundColor:
                          evaluation.todayQuotaPct >= 100
                            ? 'var(--dojo-pine)'
                            : 'var(--dojo-ochre)',
                      }}
                    />
                  </div>
                </div>

                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('今日準確率')}</div>
                  <div
                    className={`font-mono-tabular text-lg font-bold mt-0.5 ${
                      evaluation.todayAccuracy !== null && evaluation.todayAccuracy < 92
                        ? 'text-[var(--dojo-crimson)]'
                        : 'text-[var(--dojo-pine-text)]'
                    }`}
                  >
                    {evaluation.todayAccuracy !== null ? `${evaluation.todayAccuracy}%` : '--'}
                  </div>
                  <div className="text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('紅線 ≥ 92%')}
                  </div>
                </div>

                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('字根均速')}</div>
                  <div className="font-mono-tabular text-lg font-bold mt-0.5">
                    {evaluation.todayAvgKeyMs ?? (evaluation.overallAvgKeyMs || '--')}
                    {(evaluation.todayAvgKeyMs || evaluation.overallAvgKeyMs) ? 'ms' : ''}
                  </div>
                  <div className="text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('目標 < 450ms')}
                  </div>
                </div>

                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('今日流速')}</div>
                  <div className="font-mono-tabular text-lg font-bold mt-0.5">
                    {evaluation.todayCpm ?? '--'}
                    {evaluation.todayCpm ? (
                      <span className="text-[11px] font-normal text-[var(--dojo-text-muted)]"> CPM</span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('14天終點 35+')}
                  </div>
                </div>

                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="text-[11px] text-[var(--dojo-text-muted)]">{t('記憶到期複習')}</div>
                  <div className="font-mono-tabular text-lg font-bold mt-0.5 text-[var(--dojo-ochre)]">
                    {evaluation.ebbinghausDue.length} {t('項')}
                  </div>
                  <div className="text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('+1/+2/+4/+7 天間隔')}
                  </div>
                </div>
              </div>
            </section>

            {/* Two-Column Core: Left Auto-Added Adaptive Plan + Weak Keys; Right Alarms & Calendar Export */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 7 cols: Adaptive Remediation & Today's Enforced Micro-Plan */}
              <section className={`lg:col-span-7 rounded-xl border p-5 space-y-4 ${surfaceCardClass}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold flex items-center gap-2">
                      <Flame className="w-5 h-5 text-[var(--dojo-crimson)]" />
                      <span>{t('系統依記憶規律自動排入的「今日強制執行課表」')}</span>
                    </h3>
                    <p className="text-xs text-[var(--dojo-text-sub)] mt-0.5">
                      {t('偵測到低準確率、慢字堆積、斷練或遺忘曲線節點時，自動在主課前插入補訓項目。')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {evaluation.adaptiveTasks.map((task, idx) => (
                    <div
                      key={task.id}
                      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        task.priority === 'critical'
                          ? isWash
                            ? 'bg-[#FDF4F3] border-[#B83226]/35'
                            : 'bg-[#1D1418] border-[#D94A38]/40'
                          : task.priority === 'review'
                            ? isWash
                              ? 'bg-[#FCF9F0] border-[#B87A18]/35'
                              : 'bg-[#191B17] border-[#D89B3C]/35'
                            : subtlePanelClass
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-tabular">
                          <span
                            className={`font-sans font-bold ${
                              task.priority === 'critical'
                                ? 'text-[var(--dojo-crimson)]'
                                : task.priority === 'review'
                                  ? 'text-[var(--dojo-ochre)]'
                                  : 'text-[var(--dojo-pine-text)]'
                            }`}
                          >
                            #{idx + 1} · {t(task.tag)}
                          </span>
                          <span className="text-[var(--dojo-text-muted)]">
                            · {t('建議')} {task.minutes} {t('分鐘')}
                          </span>
                        </div>
                        <div className="font-display text-sm sm:text-base font-bold">
                          {t(task.title)}
                        </div>
                        <p className="text-xs text-[var(--dojo-text-sub)] leading-relaxed">
                          {t(task.reason)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTriggerAction(task.action)}
                        className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          task.priority === 'critical' || idx === 0
                            ? isWash
                              ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                              : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                            : isWash
                              ? 'bg-white hover:bg-[#FAF9F5] border border-[#141413]/16 text-[#141413]'
                              : 'bg-[#192233] hover:bg-[#233048] border border-[#F2EEE6]/14 text-[#E6E2DA]'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{t(task.action.label)}</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Weakest Chambers Instant Target Row */}
                <div className="pt-3 border-t border-[var(--dojo-border)] space-y-2">
                  <div className="text-xs font-semibold text-[var(--dojo-text-sub)]">
                    {t('當前最弱輔音宮殿（點鍵立即單鍵覆寫肌肉記憶）：')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {evaluation.weakestKeys.map((wk) => (
                      <button
                        key={wk.key}
                        type="button"
                        onClick={() =>
                          handleTriggerAction({
                            kind: 'chamber_drill',
                            chamberKey: wk.key,
                            label: `單鍵攻克 ${wk.key.toUpperCase()}`,
                          })
                        }
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          isWash
                            ? 'bg-white hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/14'
                            : 'bg-[#161E2E] hover:bg-[#222E46] border-[#F2EEE6]/12'
                        }`}
                      >
                        <span className="font-mono-tabular font-bold text-[var(--dojo-ochre)]">
                          {wk.key.toUpperCase()}
                        </span>
                        <span className="font-display font-bold">{wk.primary}</span>
                        <span className="font-mono-tabular text-[11px] opacity-75">
                          {wk.attempts > 0 ? `${wk.emaLatencyMs}ms` : t('待測')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Right 5 cols: Training Alarm Schedule, Browser Notifications & .ics Export */}
              <section className={`lg:col-span-5 rounded-xl border p-5 space-y-4 ${surfaceCardClass}`}>
                <div>
                  <h3 className="font-display text-lg font-bold flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-[var(--dojo-ochre)]" />
                    <span>{t('14 天訓練時段鬧鐘與行事曆督促')}</span>
                  </h3>
                  <p className="text-xs text-[var(--dojo-text-sub)] mt-0.5">
                    {t('符合睡眠離線鞏固規律：早喚醒 10 分鐘 ＋ 睡前固化 15 分鐘。到點自動響鈴彈出。')}
                  </p>
                </div>

                {/* Schedule Config Controls */}
                <div className={`rounded-xl border p-4 space-y-3 text-xs ${subtlePanelClass}`}>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="block text-[11px] text-[var(--dojo-text-sub)]">
                        {t('晨間黃金喚醒時間')}
                      </span>
                      <input
                        type="time"
                        value={scheduleConfig.morningTime}
                        onChange={(e) => updateScheduleConfig({ morningTime: e.target.value })}
                        className={`w-full px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs outline-none ${
                          isWash
                            ? 'bg-white border-[#141413]/18 text-[#141413]'
                            : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                        }`}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-[var(--dojo-text-sub)]">
                        {t('晚間睡前固化時間')}
                      </span>
                      <input
                        type="time"
                        value={scheduleConfig.eveningTime}
                        onChange={(e) => updateScheduleConfig({ eveningTime: e.target.value })}
                        className={`w-full px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs outline-none ${
                          isWash
                            ? 'bg-white border-[#141413]/18 text-[#141413]'
                            : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                        }`}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="block text-[11px] text-[var(--dojo-text-sub)]">
                        {t('14 天計劃起跑日')}
                      </span>
                      <input
                        type="date"
                        value={scheduleConfig.startDate}
                        onChange={(e) => updateScheduleConfig({ startDate: e.target.value })}
                        className={`w-full px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs outline-none ${
                          isWash
                            ? 'bg-white border-[#141413]/18 text-[#141413]'
                            : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                        }`}
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="block text-[11px] text-[var(--dojo-text-sub)]">
                        {t('每日最低字數紅線')}
                      </span>
                      <div className="flex items-center gap-1">
                        {[60, 80, 120, 200].map((quota) => (
                          <button
                            key={quota}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              updateScheduleConfig({ dailyCharQuota: quota });
                            }}
                            className={`flex-1 py-1.5 rounded-md border text-[11px] font-mono-tabular transition-colors cursor-pointer ${
                              scheduleConfig.dailyCharQuota === quota
                                ? isWash
                                  ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                                  : 'bg-[#D89B3C]/22 border-[#D89B3C] text-[#F5C56B]'
                                : isWash
                                  ? 'bg-white border-[#141413]/14 text-[#52524C]'
                                  : 'bg-[#121824] border-[#F2EEE6]/10 text-[#9BA5B6]'
                            }`}
                          >
                            {quota}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Strictness & In-App Alarm Switches */}
                  <div className="pt-2 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[var(--dojo-text-sub)]">{t('督訓強度')}</span>
                    <div className="inline-flex items-center gap-1">
                      {(
                        [
                          { id: 'devil', label: '魔鬼嚴苛（自動懲罰補訓）' },
                          { id: 'standard', label: '標準提醒' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            updateScheduleConfig({ strictness: opt.id });
                          }}
                          className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                            scheduleConfig.strictness === opt.id
                              ? opt.id === 'devil'
                                ? 'bg-[var(--dojo-crimson)] border-[var(--dojo-crimson)] text-white'
                                : isWash
                                  ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                                  : 'bg-[#1F293D] border-[#D89B3C] text-[#F6F2EA]'
                              : isWash
                                ? 'bg-white border-[#141413]/14 text-[#52524C]'
                                : 'bg-[#121824] border-[#F2EEE6]/10 text-[#9BA5B6]'
                          }`}
                        >
                          {t(opt.label)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--dojo-text-sub)]">
                      {t('開頁自動鬧鐘提醒與音效')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        updateScheduleConfig({
                          notificationsEnabled: !scheduleConfig.notificationsEnabled,
                        });
                      }}
                      className={`px-3 py-1 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                        scheduleConfig.notificationsEnabled
                          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                          : isWash
                            ? 'bg-white border-[#141413]/14 text-[#666]'
                            : 'bg-[#121824] border-[#F2EEE6]/10 text-[#888]'
                      }`}
                    >
                      {t(scheduleConfig.notificationsEnabled ? '已開啟' : '已暫停')}
                    </button>
                  </div>
                </div>

                {/* Browser Notification & .ics Calendar Actions */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleEnableBrowserNotify}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        notifyStatus === 'granted'
                          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                          : isWash
                            ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/16 text-[#141413]'
                            : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#E6E2DA]'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {t(
                          notifyStatus === 'granted'
                            ? '系統通知已授權'
                            : notifyStatus === 'denied'
                              ? '通知權限受限'
                              : '開啟系統彈窗通知'
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTestReminder}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        isWash
                          ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/16 text-[#141413]'
                          : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#E6E2DA]'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('立即測試鬧鐘鈴聲')}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportIcs}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isWash
                        ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                        : 'bg-[#D89B3C] hover:brightness-110 text-[#0B0E14]'
                    }`}
                  >
                    <CalendarPlus className="w-4 h-4 shrink-0" />
                    <span>{t('匯出 14 天行事曆鬧鐘 (.ics · 關網頁也準時響)')}</span>
                  </button>

                  {notifyFeedback && (
                    <div className="text-[11px] leading-relaxed text-[var(--dojo-pine-text)] px-1">
                      {t(notifyFeedback)}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: COGNITIVE & MOTOR MEMORY LAWS ==================== */}
        {activeTab === 'laws' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-[var(--dojo-ochre)]" />
                  <span>{t('一、記憶強化與打字肌肉記憶的底層規律')}</span>
                </h2>
                <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)] mt-1">
                  {t('先看懂大腦如何形成「見形直出」的運動組塊，再使用右下方對應模組驗證並強化每條規律。')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setActiveTab('barriers');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-ochre)] hover:underline whitespace-nowrap cursor-pointer"
              >
                <span>{t('下一步：看七大真實難點破壁法')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {COGNITIVE_LAWS.map((law) => (
                <article
                  key={law.id}
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${surfaceCardClass}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular">
                      <span className="font-semibold text-[var(--dojo-ochre)]">
                        {t('規律')} {law.index}
                      </span>
                      <span className="text-[var(--dojo-text-sub)]">{t(law.contrastBadge)}</span>
                    </div>

                    <h3 className="font-display text-base sm:text-lg font-bold leading-snug">
                      {t(law.title)}
                    </h3>

                    <p className="text-xs sm:text-[13px] leading-relaxed text-[var(--dojo-text-sub)]">
                      {t(law.mechanism)}
                    </p>

                    <div className={`rounded-lg border p-3 space-y-1.5 text-xs ${subtlePanelClass}`}>
                      <div className="leading-relaxed">
                        <span className="font-semibold text-[var(--dojo-crimson)]">
                          {t('常見彎路')}：
                        </span>
                        <span className="text-[var(--dojo-text-sub)]">{t(law.antiPattern)}</span>
                      </div>
                      <div className="leading-relaxed">
                        <span className="font-semibold text-[var(--dojo-pine-text)]">
                          {t('正確練法')}：
                        </span>
                        <span>{t(law.protocol)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Self-Practice Module Recommendations */}
                  <div className="pt-3 border-t border-[var(--dojo-border)] space-y-2">
                    <div className="text-[11px] font-semibold text-[var(--dojo-text-muted)]">
                      {t('想強化這條規律？直接點進對應模組自己練習：')}
                    </div>
                    <div className="space-y-2">
                      {law.reinforcementModules.map((mod, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="min-w-0 text-xs">
                            <span className="font-semibold">{t(mod.moduleName)}</span>
                            <span className="text-[var(--dojo-text-sub)]"> — {t(mod.usageTip)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTriggerAction(mod.action)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              isWash
                                ? 'bg-white hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/16 text-[#141413]'
                                : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#E6E2DA]'
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{t(mod.action.label)}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: 7 BEGINNER BARRIERS & REMEDIES ==================== */}
        {activeTab === 'barriers' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[var(--dojo-crimson)]" />
                  <span>{t('二、克服過程中大大小小的「七大真實難點」')}</span>
                </h2>
                <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)] mt-1">
                  {t('哪個環節卡住了，不用重頭再來——對照下表找到對應破壁方法，點按鈕直接進入靶向模組精修。')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setActiveTab('path');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-ochre)] hover:underline whitespace-nowrap cursor-pointer"
              >
                <span>{t('下一步：看 14 天最短訓練路徑')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {BARRIER_REMEDIES.map((item) => (
                <section
                  key={item.id}
                  className={`rounded-xl border p-5 ${surfaceCardClass}`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left: Diagnosis & Breakthrough Method */}
                    <div className="lg:col-span-7 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-mono-tabular text-[var(--dojo-ochre)]">
                        <span className="font-semibold">{t(item.number)}</span>
                      </div>
                      <h3 className="font-display text-base sm:text-lg font-bold">
                        {t(item.title)}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className={`rounded-lg border p-3 text-xs leading-relaxed ${subtlePanelClass}`}>
                          <div className="font-semibold mb-1 text-[var(--dojo-text-bright)]">
                            {t('卡點表現')}
                          </div>
                          <p className="text-[var(--dojo-text-sub)]">{t(item.symptom)}</p>
                        </div>
                        <div className={`rounded-lg border p-3 text-xs leading-relaxed ${subtlePanelClass}`}>
                          <div className="font-semibold mb-1 text-[var(--dojo-text-bright)]">
                            {t('心理與生理成因')}
                          </div>
                          <p className="text-[var(--dojo-text-sub)]">{t(item.psychologyCause)}</p>
                        </div>
                      </div>
                      <div className="text-xs sm:text-[13px] leading-relaxed pt-1">
                        <span className="font-semibold text-[var(--dojo-pine-text)]">
                          {t('精準破壁方法')}：
                        </span>
                        <span>{t(item.breakthroughMethod)}</span>
                      </div>
                    </div>

                    {/* Right: Dedicated Self-Practice Modules */}
                    <div
                      className={`lg:col-span-5 rounded-xl border p-4 space-y-3 ${subtlePanelClass}`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                        <span>{t('對應自練強化模組（附建議練法）')}</span>
                      </div>

                      <div className="space-y-3">
                        {item.recommendedModules.map((mod, idx) => (
                          <div
                            key={idx}
                            className="space-y-1.5 pb-2.5 last:pb-0 border-b last:border-b-0 border-[var(--dojo-border)]"
                          >
                            <div className="text-xs font-semibold text-[var(--dojo-text-bright)]">
                              {t(mod.moduleName)}
                            </div>
                            <p className="text-[11px] leading-relaxed text-[var(--dojo-text-sub)]">
                              {t(mod.usageTip)}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleTriggerAction(mod.action)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                idx === 0
                                  ? isWash
                                    ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                                    : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                                  : isWash
                                    ? 'bg-white hover:bg-[#FAF9F5] border border-[#141413]/16 text-[#141413]'
                                    : 'bg-[#192233] hover:bg-[#233048] border border-[#F2EEE6]/14 text-[#E6E2DA]'
                              }`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>{t(mod.action.label)}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: 14-DAY SHORTEST PATH CURRICULUM ==================== */}
        {activeTab === 'path' && (
          <div className="space-y-5">
            {/* 4-Phase Roadmap Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PHASES.map((phase) => {
                const selected = phaseFilter === phase.id;
                const phaseLessons = DAILY_CURRICULUM.filter((d) => d.phaseId === phase.id);
                const phaseDone = phaseLessons.filter((d) => completedDays.includes(d.day)).length;
                return (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setPhaseFilter((prev) => (prev === phase.id ? 0 : phase.id));
                    }}
                    className={`rounded-xl border p-4 text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                      selected
                        ? isWash
                          ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                          : 'bg-[#1D273B] border-[#D89B3C] text-[#F6F2EA]'
                        : surfaceCardClass
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                        <span className={selected ? 'opacity-90' : 'text-[var(--dojo-ochre)]'}>
                          {phase.dayRange}
                        </span>
                        <span className="opacity-75">
                          {phaseDone}/{phaseLessons.length} · {t(phase.cumulativeTime)}
                        </span>
                      </div>
                      <div className="font-display text-sm font-bold">{t(phase.title)}</div>
                      <p className="text-[11px] leading-relaxed opacity-80">{t(phase.subtitle)}</p>
                    </div>
                    <div className="pt-2 border-t border-current/12 text-[11px] leading-snug opacity-85">
                      {t('階段指標')}：{t(phase.milestone)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Filter indicator + Show All */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-[var(--dojo-text-sub)]">
                {phaseFilter === 0
                  ? t('顯示全部 14 天最短路徑課表（點擊左側方框可打卡記錄已完成天數）')
                  : `${t('正在篩選第')} ${phaseFilter} ${t('階段課表')}（${visibleLessons.length} ${t('天')}）`}
              </div>
              {phaseFilter !== 0 && (
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setPhaseFilter(0);
                  }}
                  className="text-xs font-medium text-[var(--dojo-ochre)] hover:underline cursor-pointer"
                >
                  {t('顯示全部 14 天')}
                </button>
              )}
            </div>

            {/* Daily Lesson Cards */}
            <div className="space-y-3.5">
              {visibleLessons.map((lesson) => {
                const done = completedDays.includes(lesson.day);
                const isNext = lesson.day === nextRecommendedDay;
                return (
                  <article
                    key={lesson.day}
                    className={`rounded-xl border p-5 transition-colors ${
                      isNext && !done
                        ? isWash
                          ? 'bg-[#FAF9F5] border-[#181817]/45 shadow-sm'
                          : 'bg-[#151D2C] border-[#D89B3C]/55'
                        : surfaceCardClass
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Completion Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleDayCompleted(lesson.day)}
                          aria-label={t(`標記 Day ${lesson.day} 完成狀態`)}
                          className={`mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer font-mono-tabular text-xs font-bold ${
                            done
                              ? isWash
                                ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                                : 'bg-[#2EA87E] border-[#2EA87E] text-[#0B0E14]'
                              : isWash
                                ? 'bg-white border-[#141413]/20 text-[#52524C] hover:border-[#141413]'
                                : 'bg-[#0D1119] border-[#F2EEE6]/16 text-[#AEB6C4] hover:border-[#F2EEE6]/40'
                          }`}
                        >
                          {done ? <Check className="w-4 h-4" /> : `D${lesson.day}`}
                        </button>

                        <div className="min-w-0 space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
                            <span className="font-semibold text-[var(--dojo-ochre)]">
                              Day {lesson.day} · {t(`第 ${lesson.phaseId} 階`)}
                            </span>
                            <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                            <span className="text-[var(--dojo-text-sub)]">
                              {lesson.durationMin} {t('分鐘')}
                            </span>
                            {isNext && !done && (
                              <>
                                <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                                <span className="font-sans font-semibold text-[var(--dojo-pine-text)]">
                                  {t('今日推薦任務')}
                                </span>
                              </>
                            )}
                            {evaluation.ebbinghausDue.some((eb) => eb.sourceDay === lesson.day) && (
                              <>
                                <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                                <span className="font-sans font-semibold text-[var(--dojo-ochre)]">
                                  {t('今日艾賓浩斯到期複習')}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="font-display text-base sm:text-lg font-bold">
                            {t(lesson.title)}
                          </h3>
                          <p className="text-xs sm:text-[13px] text-[var(--dojo-text-sub)] leading-relaxed">
                            {t(lesson.focusSummary)}
                          </p>

                          {/* 3-Step 15-Minute Golden Routine */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                            <div className={`rounded-lg border p-2.5 text-xs leading-relaxed ${subtlePanelClass}`}>
                              <div className="font-semibold text-[var(--dojo-text-bright)] mb-0.5">
                                01 · {t('喚醒 3 分鐘')}
                              </div>
                              <div className="text-[var(--dojo-text-sub)]">
                                {t(lesson.microRoutine.warmup3m)}
                              </div>
                            </div>
                            <div className={`rounded-lg border p-2.5 text-xs leading-relaxed ${subtlePanelClass}`}>
                              <div className="font-semibold text-[var(--dojo-ochre)] mb-0.5">
                                02 · {t('推進 8–12 分鐘')}
                              </div>
                              <div className="text-[var(--dojo-text-sub)]">
                                {t(lesson.microRoutine.core8m)}
                              </div>
                            </div>
                            <div className={`rounded-lg border p-2.5 text-xs leading-relaxed ${subtlePanelClass}`}>
                              <div className="font-semibold text-[var(--dojo-pine-text)] mb-0.5">
                                03 · {t('固化 4 分鐘')}
                              </div>
                              <div className="text-[var(--dojo-text-sub)]">
                                {t(lesson.microRoutine.solidify4m)}
                              </div>
                            </div>
                          </div>

                          <div className="text-xs text-[var(--dojo-text-sub)] pt-0.5">
                            <span className="font-semibold text-[var(--dojo-text-bright)]">
                              {t('過關標準')}：
                            </span>
                            {t(lesson.passCriteria)}
                          </div>
                        </div>
                      </div>

                      {/* Right Launch Column */}
                      <div className="lg:w-72 shrink-0 flex flex-col gap-2 pt-2 lg:pt-0 lg:border-l lg:border-[var(--dojo-border)] lg:pl-4">
                        <div className="text-[11px] font-semibold text-[var(--dojo-text-muted)]">
                          {t('今日強化使用模組')}
                        </div>
                        {lesson.practiceModules.map((mod, idx) => (
                          <div key={idx} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => handleTriggerAction(mod.action)}
                              className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                idx === 0
                                  ? isWash
                                    ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                                    : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                                  : isWash
                                    ? 'bg-white hover:bg-[#FAF9F5] border border-[#141413]/14 text-[#141413]'
                                    : 'bg-[#182030] hover:bg-[#222D43] border border-[#F2EEE6]/12 text-[#E6E2DA]'
                              }`}
                            >
                              <span className="truncate">{t(mod.action.label)}</span>
                              <Play className="w-3 h-3 fill-current shrink-0" />
                            </button>
                            <div className="text-[11px] text-[var(--dojo-text-muted)] leading-snug px-0.5">
                              {t(mod.moduleName)} · {t(mod.usageTip)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Three Anti-Detour Iron Rules */}
            <section className={`rounded-xl border p-5 ${surfaceCardClass}`}>
              <h3 className="font-display text-base font-bold mb-2">
                {t('防走彎路「三不守則」')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed text-[var(--dojo-text-sub)]">
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="font-semibold text-[var(--dojo-text-bright)] mb-1">
                    01 · {t('不低頭看鍵盤')}
                  </div>
                  {t('卡住哪怕停 3 秒，也只靠腦海空間與目標重合位雲圖回想，絕不低頭破壞手指本體感覺。')}
                </div>
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="font-semibold text-[var(--dojo-text-bright)] mb-1">
                    02 · {t('不帶疲勞硬練')}
                  </div>
                  {t('單次練超過 25 分鐘、頻頻錯鍵時立刻停手；睡一覺再回來，你會發現昨天卡住的鍵突然變順了。')}
                </div>
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <div className="font-semibold text-[var(--dojo-text-bright)] mb-1">
                    03 · {t('不在低準確率下衝速')}
                  </div>
                  {t('準確率低於 92% 時所有搶快都在強化錯誤記憶；開著節拍器守住「慢即是勻，勻即是快」。')}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ==================== TAB 4: MODULE SELF-DRILL DIRECTORY & FREE-WRITING BRIDGE ==================== */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            {/* Free-Writing Isolation Bridge (Day 10-14 Core Transfer Tool) */}
            <section className={`rounded-xl border p-5 space-y-4 ${surfaceCardClass}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono-tabular text-[var(--dojo-ochre)] mb-1">
                    {t('第四階實戰遷移核心')} · {t('每日 200 字絕對禁切拼音區')}
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
                    <PenLine className="w-5 h-5 text-[var(--dojo-pine-text)]" />
                    <span>{t('自由書寫遷移橋：無提示自主思考造句區')}</span>
                  </h2>
                  <p className="text-xs text-[var(--dojo-text-sub)] mt-1">
                    {t('照抄螢幕文字與腦中思考造句是兩條神經通路。切換至你安裝的靈明輸入法，在下方直接寫真想法；寫不出來的字填進右側診斷並送去文心特訓！')}
                  </p>
                </div>

                {/* Writing Topic Switcher */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {FREE_WRITING_PROMPTS.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setPromptIdx(idx);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap cursor-pointer ${
                        promptIdx === idx
                          ? isWash
                            ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                            : 'bg-[#1F293D] border-[#D89B3C] text-[#F6F2EA]'
                          : isWash
                            ? 'bg-white border-[#141413]/14 text-[#52524C]'
                            : 'bg-[#0D1119] border-[#F2EEE6]/10 text-[#9BA5B6]'
                      }`}
                    >
                      {t(p.title)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Free Composition Canvas */}
                <div className="lg:col-span-7 space-y-2.5">
                  <div className={`rounded-lg border px-3.5 py-2.5 text-xs ${subtlePanelClass}`}>
                    <span className="font-semibold text-[var(--dojo-ochre)]">
                      {t('今日題示')}：
                    </span>
                    <span className="text-[var(--dojo-text-sub)]">{t(activePrompt.guide)}</span>
                  </div>

                  <textarea
                    value={freeDraft}
                    onChange={(e) => setFreeDraft(e.target.value)}
                    placeholder={t('請直接切換到靈明輸入法，把腦海裡想說的話寫在這裡（不照抄、不切回拼音，寫滿 200 漢字即完成今日遷移）…')}
                    rows={7}
                    className={`w-full rounded-xl border p-4 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 ${
                      isWash
                        ? 'bg-white border-[#141413]/16 text-[#141413] placeholder:text-[#8E8E86] focus:ring-[#181817]/20'
                        : 'bg-[#0B0E15] border-[#F2EEE6]/14 text-[#F2EEE6] placeholder:text-[#5F6A7D] focus:ring-[#D89B3C]/30'
                    }`}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div
                        className={`flex-1 h-2 rounded-full overflow-hidden ${
                          isWash ? 'bg-[#141413]/10' : 'bg-white/10'
                        }`}
                      >
                        <div
                          className={`h-full transition-all duration-300 ${
                            freeChineseCount >= 200
                              ? 'bg-[var(--dojo-pine)]'
                              : 'bg-[var(--dojo-ochre)]'
                          }`}
                          style={{ width: `${freeGoalPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono-tabular text-[var(--dojo-text-sub)] shrink-0">
                        {freeChineseCount} / 200 {t('漢字')} ({freeGoalPct}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {freeDraft.trim().length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleTriggerAction({
                                kind: 'drill_studio',
                                tab: 'passage',
                                customText: freeDraft,
                                label: '把自己寫的這段送入文心複練',
                              })
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                              isWash
                                ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/16 text-[#141413]'
                                : 'bg-[#182030] hover:bg-[#232F46] border-[#F2EEE6]/14 text-[#E6E2DA]'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                            <span>{t('送入文心盲打複習這段')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setFreeDraft('');
                            }}
                            className="px-2.5 py-1.5 text-xs text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)] transition-colors cursor-pointer"
                          >
                            {t('清空')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Stuck-Character Instant Split Inspector + One-Click Targeted Drill */}
                <div className={`lg:col-span-5 rounded-xl border p-4 flex flex-col justify-between gap-3 ${subtlePanelClass}`}>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-[var(--dojo-text-bright)]">
                        {t('造句卡殼字即時拆碼診斷')}
                      </div>
                      <p className="text-[11px] text-[var(--dojo-text-muted)] mt-0.5">
                        {t('寫作時遇到一時想不起拆法的字，貼或打在這裡查全碼與字根，並一鍵送入專屬複訓：')}
                      </p>
                    </div>

                    <input
                      type="text"
                      value={stuckInput}
                      onChange={(e) => setStuckInput(e.target.value)}
                      placeholder={t('輸入卡殼漢字（例：能 這 說 隨 隱）')}
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isWash
                          ? 'bg-white border-[#141413]/16 text-[#141413] focus:ring-[#181817]/20'
                          : 'bg-[#111622] border-[#F2EEE6]/14 text-[#F2EEE6] focus:ring-[#D89B3C]/30'
                      }`}
                    />

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {stuckDiagnostics.length === 0 ? (
                        <div className="text-xs text-[var(--dojo-text-muted)] py-4 text-center">
                          {t('請輸入漢字以即時檢視字根與靈明全碼')}
                        </div>
                      ) : (
                        stuckDiagnostics.map(({ char, entry }) => {
                          const firstKey = entry?.code?.[0];
                          const chamber = firstKey ? LINGMING_CHAMBER_BY_KEY[firstKey] : undefined;
                          return (
                            <div
                              key={char}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                                isWash
                                  ? 'bg-white border-[#141413]/10'
                                  : 'bg-[#121824] border-[#F2EEE6]/8'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-display text-base font-bold shrink-0">
                                  {char}
                                </span>
                                {entry ? (
                                  <span className="text-[var(--dojo-text-sub)] truncate">
                                    {entry.parts.join(' + ')}
                                    {firstKey && chamber ? ` · ${firstKey.toUpperCase()}(${chamber.primaryAnchor})` : ''}
                                  </span>
                                ) : (
                                  <span className="text-[var(--dojo-text-muted)]">
                                    {t('未收錄於基礎練字庫')}
                                  </span>
                                )}
                              </div>
                              {entry && (
                                <span className="font-mono-tabular font-bold text-[var(--dojo-pine-text)] shrink-0">
                                  {entry.code}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {drillableStuckText.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleTriggerAction({
                          kind: 'drill_studio',
                          tab: 'passage',
                          customText: `${drillableStuckText}${drillableStuckText}${drillableStuckText}`,
                          label: `把這 ${drillableStuckText.length} 個卡殼字連打 3 遍`,
                        })
                      }
                      className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        isWash
                          ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                          : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {t(`送入文心實戰室將這 ${drillableStuckText.length} 字連打 3 遍`)}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Full App Module Self-Reinforcement Matrix */}
            <div className="space-y-3">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[var(--dojo-ochre)]" />
                  <span>{t('全道場自練強化模組指南')}</span>
                </h2>
                <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)] mt-1">
                  {t('若想在教程之外自主加強特定能力，可依需求直接點進對應模組並套用推薦參數。')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODULE_DIRECTORY.map((mod) => (
                  <article
                    key={mod.id}
                    className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${surfaceCardClass}`}
                  >
                    <div className="space-y-2.5">
                      <div className="text-[11px] font-mono-tabular text-[var(--dojo-ochre)] font-semibold">
                        {t(mod.roleTag)}
                      </div>
                      <h3 className="font-display text-base font-bold leading-snug">
                        {t(mod.moduleName)}
                      </h3>
                      <div className="text-xs leading-relaxed">
                        <span className="font-semibold text-[var(--dojo-text-bright)]">
                          {t('適用情境')}：
                        </span>
                        <span className="text-[var(--dojo-text-sub)]">{t(mod.bestFor)}</span>
                      </div>
                      <div className={`rounded-lg border p-3 text-xs leading-relaxed ${subtlePanelClass}`}>
                        <div className="font-semibold text-[var(--dojo-pine-text)] mb-1">
                          {t('怎麼自己強化練習')}
                        </div>
                        <p className="text-[var(--dojo-text-sub)]">{t(mod.howToSelfDrill)}</p>
                      </div>
                      <div className="text-[11px] text-[var(--dojo-text-muted)]">
                        <span className="font-semibold text-[var(--dojo-text-sub)]">
                          {t('建議設置')}：
                        </span>
                        {t(mod.recommendedSettings)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTriggerAction(mod.launchAction)}
                      className={`w-full inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        isWash
                          ? 'bg-white hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/16 text-[#141413]'
                          : 'bg-[#182030] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#F2EEE6]'
                      }`}
                    >
                      <span>{t(mod.launchAction.label)}</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
