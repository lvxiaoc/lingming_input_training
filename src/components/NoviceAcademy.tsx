import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellRing,
  BookOpen,
  Brain,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Flame,
  ListChecks,
  PenLine,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
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
  applyRhythmPreset,
  BrowserNotifyStatus,
  buildTrainingIcsContent,
  computeSlotCountdown,
  evaluateTrainingState,
  fireBrowserNotification,
  formatMinutesUntil,
  getBrowserNotifyStatus,
  loadCompletedDaysList,
  loadTrainingSchedule,
  ReminderDeliveryMode,
  requestBrowserNotifyPermission,
  RHYTHM_PRESETS,
  RhythmPresetId,
  saveCompletedDaysList,
  saveTrainingSchedule,
  TrainingScheduleConfig,
} from '../engine/trainingScheduler';
import { synth } from '../audio/synth';

export type AcademyTab = 'curriculum' | 'rhythm' | 'guide' | 'freewrite';

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

  const [activeTab, setActiveTab] = useState<AcademyTab>(initialTab ?? 'curriculum');
  const [phaseFilter, setPhaseFilter] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [guideSection, setGuideSection] = useState<'laws' | 'barriers'>('laws');
  const [completedDays, setCompletedDays] = useState<number[]>(() => loadCompletedDaysList());
  const [scheduleConfig, setScheduleConfig] = useState<TrainingScheduleConfig>(() =>
    loadTrainingSchedule()
  );
  const [notifyStatus, setNotifyStatus] = useState<BrowserNotifyStatus>(() =>
    getBrowserNotifyStatus()
  );
  const [notifyFeedback, setNotifyFeedback] = useState<string | null>(null);
  const [showAdvancedIcs, setShowAdvancedIcs] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Free-Writing Isolation Bridge state (Tab 4)
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
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

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

  // Which day cards are expanded to show 3-step micro-routine & reinforcement modules.
  // Defaults cleanly to ONLY the active Day so the 14-day ordered curriculum stays scannable at a glance.
  const [expandedDays, setExpandedDays] = useState<number[]>(() => [nextRecommendedDay]);
  const [selectedDay, setSelectedDay] = useState<number>(() => nextRecommendedDay);
  const dayRowRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    setSelectedDay(nextRecommendedDay);
    setExpandedDays((prev) => (prev.includes(nextRecommendedDay) ? prev : [...prev, nextRecommendedDay]));
  }, [nextRecommendedDay]);

  const toggleExpandDay = (day: number) => {
    synth.playClick();
    setExpandedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleJumpToDay = (day: number) => {
    synth.playClick();
    setSelectedDay(day);
    setPhaseFilter(0);
    setExpandedDays((prev) => (prev.includes(day) ? prev : [...prev, day]));
    window.requestAnimationFrame(() => {
      const el = dayRowRefs.current[day];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const visiblePhases = useMemo(() => {
    const phases = phaseFilter === 0 ? PHASES : PHASES.filter((p) => p.id === phaseFilter);
    return phases.map((phase) => ({
      phase,
      lessons: DAILY_CURRICULUM.filter((l) => l.phaseId === phase.id),
    }));
  }, [phaseFilter]);

  const completionPct = Math.round((completedDays.length / 14) * 100);

  // Separate pre-lesson adaptive nudges (bottleneck / review / recovery) from the default lesson entry
  const urgentNudges = useMemo(
    () =>
      evaluation.adaptiveTasks.filter(
        (task) => task.id !== `main-day-${evaluation.currentPlanDay}` && task.priority !== 'core'
      ),
    [evaluation.adaptiveTasks, evaluation.currentPlanDay]
  );

  const handleEnableBrowserNotify = async () => {
    synth.playClick();
    const res = await requestBrowserNotifyPermission();
    setNotifyStatus(res);
    if (res === 'granted') {
      updateScheduleConfig({ notificationsEnabled: true, deliveryMode: 'browser_push' });
      fireBrowserNotification(
        t('墨鍵道場 · 彈性時窗推播已啟用'),
        t(
          `將在「${scheduleConfig.eveningAnchorCue}」(${scheduleConfig.eveningTime}–${scheduleConfig.eveningWindowEnd}) 輕量提醒；達標後自動全天靜音。`
        )
      );
      setNotifyFeedback('瀏覽器系統通知已啟用（達標自動靜音）；若擔心系統推播太多，可隨時切回「僅站內靜默微標」。');
    } else if (res === 'denied') {
      updateScheduleConfig({ deliveryMode: 'quiet_banner' });
      setNotifyFeedback('瀏覽器通知權限受限，已自動切為零打擾的「站內靜默微標」，不影響道場內提示。');
    } else if (res === 'unsupported') {
      updateScheduleConfig({ deliveryMode: 'quiet_banner' });
      setNotifyFeedback('當前環境不支援原生推播，已保持站內靜默節律提示（零打擾）。');
    }
  };

  const handleTestReminder = () => {
    if (scheduleConfig.deliveryMode !== 'quiet_banner') {
      synth.playMilestone();
    } else {
      synth.playClick();
    }
    const fired =
      scheduleConfig.deliveryMode === 'browser_push'
        ? fireBrowserNotification(
            t(`墨鍵道場 · Day ${evaluation.currentPlanDay} 練習時窗`),
            t(
              `錨點：${slotInfo.nextAnchorCue} · 今日 ${evaluation.todayChars}/${evaluation.todayQuota} 字`
            )
          )
        : false;
    setNotifyFeedback(
      fired
        ? '已依目前級別發出測試提示與系統推播！今日達標後系統將自動靜音。'
        : scheduleConfig.deliveryMode === 'quiet_banner'
          ? '目前為「僅站內靜默微標」模式：無刺耳鈴聲，僅在彈性時窗打開道場時浮出安靜微提示。'
          : '已發出輕音提醒！若需離線提醒，可展開下方「進階：可選行事曆匯出」。'
    );
  };

  const handleApplyPreset = (presetId: Exclude<RhythmPresetId, 'custom'>) => {
    synth.playClick();
    setScheduleConfig((prev) => {
      const next = applyRhythmPreset(prev, presetId);
      saveTrainingSchedule(next);
      return next;
    });
    onScheduleChanged?.();
  };

  const handleToggleTodayLowDose = () => {
    synth.playClick();
    const todayKey = getLocalDateKey(nowDate);
    setScheduleConfig((prev) => {
      const active = prev.lowDoseDates.includes(todayKey);
      const lowDoseDates = active
        ? prev.lowDoseDates.filter((d) => d !== todayKey)
        : [...prev.lowDoseDates, todayKey];
      const restDates = active ? prev.restDates : prev.restDates.filter((d) => d !== todayKey);
      const next = { ...prev, lowDoseDates, restDates };
      saveTrainingSchedule(next);
      return next;
    });
    onScheduleChanged?.();
  };

  const handleToggleTodayRest = () => {
    synth.playClick();
    const todayKey = getLocalDateKey(nowDate);
    setScheduleConfig((prev) => {
      const active = prev.restDates.includes(todayKey);
      const restDates = active
        ? prev.restDates.filter((d) => d !== todayKey)
        : [...prev.restDates, todayKey];
      const next = { ...prev, restDates };
      saveTrainingSchedule(next);
      return next;
    });
    onScheduleChanged?.();
  };

  const handleExportIcs = (maxDays: number) => {
    synth.playClick();
    const content = buildTrainingIcsContent(scheduleConfig, maxDays);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingming-${maxDays}day-rhythm-${scheduleConfig.startDate}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotifyFeedback(
      maxDays <= 3
        ? '已下載未來 3 天輕量試跑 .ics 檔，僅置入短期試跑事件，避免長期塞爆您的主行事曆。'
        : '已下載 14 天完整節律 .ics 檔，匯入日曆即可在設定窗口前提醒。'
    );
  };

  // Stuck-Char Diagnostics
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

  // High-contrast crisp surfaces in both Xuan-Paper Wash and Night Ink themes
  const surfaceCardClass = isWash
    ? 'bg-white/95 border-[#141413]/18 text-[#141413] shadow-[0_1px_4px_rgba(20,20,18,0.06)]'
    : 'bg-[#121824]/95 border-[#F2EEE6]/12 text-[#F2EEE6]';

  const subtlePanelClass = isWash
    ? 'bg-[#F4F1EA] border-[#141413]/12 text-[#141413]'
    : 'bg-[#0C1018]/85 border-[#F2EEE6]/10 text-[#F2EEE6]';

  const navTabs: Array<{ id: AcademyTab; label: string }> = [
    { id: 'curriculum', label: '01 訓練課表與進度' },
    { id: 'rhythm', label: '02 節律與督訓' },
    { id: 'guide', label: '03 原理與破壁說明' },
    { id: 'freewrite', label: '04 自由寫與自練庫' },
  ];

  return (
    <div
      className={`relative z-10 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col ${
        isWash
          ? 'bg-transparent text-[#141413]'
          : 'bg-[#0B0E14] text-[#F2EEE6]'
      }`}
    >
      {/* Top Clean 3-Zone Header */}
      <header
        className={`shrink-0 sticky top-0 z-30 border-b backdrop-blur-md ${
          isWash
            ? 'bg-[#F3F1EC]/94 border-[#141413]/14'
            : 'bg-[#0D1119]/94 border-[#F2EEE6]/10'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
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
                  ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                  : 'bg-[#161D2B] hover:bg-[#1E283B] border-[#F2EEE6]/14 text-[#DCE3F0]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('返回道場')}</span>
            </button>
            <h1 className="font-display text-base sm:text-lg font-bold tracking-wide truncate">
              {t('14 天速成學院')}
            </h1>
          </div>

          {/* Zone 2: Clean 4-Tab Navigation */}
          <nav
            role="tablist"
            aria-label={t('速成學院分區')}
            className="hidden lg:flex items-center gap-1"
          >
            {navTabs.map((tabItem) => {
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
                        ? 'text-[#4C4C48] hover:text-[#141413] hover:bg-[#141413]/7'
                        : 'text-[#9BA5B6] hover:text-[#F2EEE6] hover:bg-white/5'
                  }`}
                >
                  <span>{t(tabItem.label)}</span>
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
                  ? 'bg-white border-[#141413]/16'
                  : 'bg-[#141A26] border-[#F2EEE6]/12'
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
                        ? 'text-[#52524C] hover:text-[#141413]'
                        : 'text-[#94A0B4] hover:text-[#F2EEE6]'
                  }`}
                >
                  <span>{t(opt.short)}</span>
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label={t('切換道場視覺色調')}
              className={`inline-flex items-center p-0.5 rounded-lg border ${
                isWash
                  ? 'bg-white border-[#141413]/16'
                  : 'bg-[#141A26] border-[#F2EEE6]/12'
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
                        ? 'text-[#52524C] hover:text-[#141413]'
                        : 'text-[#94A0B4] hover:text-[#F2EEE6]'
                  }`}
                >
                  <span>{t(opt.short)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Tab Row */}
        <div className="lg:hidden px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
          {navTabs.map((tabItem) => {
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
                      ? 'bg-white border border-[#141413]/14 text-[#4C4C48]'
                      : 'bg-[#151B27] text-[#9BA5B6]'
                }`}
              >
                <span>{t(tabItem.label)}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Centered Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-5">
        {/* ==================== TAB 1 (CORE DEFAULT): ORDERED 14-DAY CURRICULUM & PROGRESS ==================== */}
        {activeTab === 'curriculum' && (
          <div className="space-y-5">
            {/* 1. Unmistakable Progress-at-a-Glance + Current Active Lesson Strip */}
            <section className={`rounded-xl border p-5 space-y-4 ${surfaceCardClass}`}>
              {/* Top Row: Overall Progress Telemetry + Quick Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-[var(--dojo-ochre)]">
                      {t('總進度')} {completedDays.length}/14 {t('天')}（{completionPct}%）
                    </span>
                    <span className="text-[var(--dojo-text-muted)]" aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[var(--dojo-text-sub)]">
                      {t('當前階段')}：{t(PHASES.find((p) => p.id === nextLesson.phaseId)?.title ?? '')}
                    </span>
                    <span className="text-[var(--dojo-text-muted)]" aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[var(--dojo-text-sub)]">
                      {t('今日字數')} {evaluation.todayChars}/{evaluation.todayQuota}
                    </span>
                  </div>
                  {/* Crisp progress bar */}
                  <div
                    className={`w-full max-w-md h-1.5 rounded-full overflow-hidden ${
                      isWash ? 'bg-[#141413]/10' : 'bg-white/10'
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(4, completionPct)}%`,
                        backgroundColor:
                          completedDays.length === 14
                            ? 'var(--dojo-pine)'
                            : isWash
                              ? '#181817'
                              : '#D89B3C',
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setActiveTab('rhythm');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isWash
                        ? 'bg-[#FAF9F5] hover:bg-[#EFECE4] border-[#141413]/16 text-[#141413]'
                        : 'bg-[#182030] hover:bg-[#222D43] border-[#F2EEE6]/14 text-[#DCE3F0]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                    <span>
                      {evaluation.todaySuppressed
                        ? t('今日已靜音 · 調節律')
                        : `${t('下個時窗')} ${slotInfo.nextWindowRange}`}
                    </span>
                  </button>

                  {completedDays.length > 0 && (
                    <button
                      type="button"
                      onClick={resetProgress}
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t('重置')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Ordered 14-Day Visual Progression Stepper (D1 -> D14 segmented by 4 phases) */}
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
                {DAILY_CURRICULUM.map((lesson) => {
                  const done = completedDays.includes(lesson.day);
                  const isCurrent = lesson.day === nextRecommendedDay && !done;
                  const isFocused = lesson.day === selectedDay;
                  const hasReview = evaluation.ebbinghausDue.some(
                    (eb) => eb.sourceDay === lesson.day
                  );
                  return (
                    <button
                      key={lesson.day}
                      type="button"
                      onClick={() => handleJumpToDay(lesson.day)}
                      title={t(`跳轉查看 Day ${lesson.day}：${lesson.title}`)}
                      className={`relative h-9 rounded-lg border font-mono-tabular text-xs font-semibold transition-all cursor-pointer flex flex-col items-center justify-center leading-none ${
                        done
                          ? isWash
                            ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                            : 'bg-[#2EA87E]/25 border-[#2EA87E] text-[#8CEBCB]'
                          : isCurrent
                            ? isWash
                              ? 'bg-[#FBF3E2] border-[#B87A18] border-2 text-[#141413]'
                              : 'bg-[#D89B3C]/22 border-[#D89B3C] border-2 text-[#F5C56B]'
                            : isFocused
                              ? isWash
                                ? 'bg-[#EFECE4] border-[#141413]/45 text-[#141413]'
                                : 'bg-[#1D273B] border-[#F2EEE6]/40 text-[#F2EEE6]'
                              : isWash
                                ? 'bg-[#F8F7F3] border-[#141413]/14 text-[#4C4C48] hover:border-[#141413]/40'
                                : 'bg-[#0D1119] border-[#F2EEE6]/12 text-[#9BA5B6] hover:border-[#F2EEE6]/35'
                      }`}
                    >
                      {done ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <span>{lesson.day}</span>
                      )}
                      {hasReview && !done && (
                        <span
                          aria-hidden="true"
                          className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                            isWash ? 'bg-[#B83226]' : 'bg-[#D94A38]'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Next-Step Focus Strip */}
              <div
                className={`pt-4 border-t flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isWash ? 'border-[#141413]/12' : 'border-[var(--dojo-border)]'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded ${
                        isWash
                          ? 'bg-[#181817] text-[#F8F7F3]'
                          : 'bg-[#D89B3C]/20 text-[#F5C56B]'
                      }`}
                    >
                      {t('當前第')} {nextLesson.day} {t('課')}
                    </span>
                    <span className="font-mono-tabular text-[var(--dojo-text-sub)]">
                      {t('建議')} {nextLesson.durationMin} {t('分鐘')}
                    </span>
                    {evaluation.ebbinghausDue.length > 0 && (
                      <span className="text-[var(--dojo-crimson)] font-medium">
                        · {t('另有')} {evaluation.ebbinghausDue.length} {t('項遺忘曲線複習到期')}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--dojo-text-bright)]">
                    Day {nextLesson.day} · {t(nextLesson.title)}
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[var(--dojo-text-sub)] leading-relaxed max-w-3xl">
                    {t(nextLesson.focusSummary)}
                  </p>

                  {/* Inline Compact Urgent Nudge (if a bottleneck / review prerequisite exists) */}
                  {urgentNudges.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {urgentNudges.slice(0, 2).map((nudge) => (
                        <button
                          key={nudge.id}
                          type="button"
                          onClick={() => handleTriggerAction(nudge.action)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                            nudge.priority === 'critical'
                              ? isWash
                                ? 'bg-[#FDF4F3] hover:bg-[#FAE7E5] border-[#B83226]/35 text-[#9B261C]'
                                : 'bg-[#221519] hover:bg-[#2E1B20] border-[#D94A38]/45 text-[#F28E80]'
                              : isWash
                                ? 'bg-[#FCF9F0] hover:bg-[#F7F0DC] border-[#B87A18]/35 text-[#7A510C]'
                                : 'bg-[#1B1A14] hover:bg-[#26241B] border-[#D89B3C]/40 text-[#F5C56B]'
                          }`}
                        >
                          <Flame className="w-3 h-3 shrink-0" />
                          <span>
                            {t('建議課前先補')}：{t(nudge.action.label)}（{nudge.minutes}m）
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                    onClick={() => toggleDayCompleted(nextLesson.day)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      completedDays.includes(nextLesson.day)
                        ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                        : isWash
                          ? 'bg-white hover:bg-[#EFECE4] border-[#141413]/20 text-[#141413]'
                          : 'bg-[#182030] hover:bg-[#212C42] border-[#F2EEE6]/14 text-[#E6E2DA]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {completedDays.includes(nextLesson.day)
                        ? t(`已完成 Day ${nextLesson.day}`)
                        : t(`打卡完成 Day ${nextLesson.day}`)}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            {/* 2. Phase Filter Toolbar (Simple Segmented Switch) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setPhaseFilter(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    phaseFilter === 0
                      ? isWash
                        ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                        : 'bg-[#1F293D] border-[#D89B3C] text-[#F7F3EC]'
                      : isWash
                        ? 'bg-white border-[#141413]/16 text-[#4C4C48] hover:text-[#141413]'
                        : 'bg-[#121824] border-[#F2EEE6]/12 text-[#9BA5B6] hover:text-[#F2EEE6]'
                  }`}
                >
                  <span>{t('全部 14 課（按順序）')}</span>
                </button>
                {PHASES.map((phase) => {
                  const active = phaseFilter === phase.id;
                  const phaseLessons = DAILY_CURRICULUM.filter((d) => d.phaseId === phase.id);
                  const phaseDone = phaseLessons.filter((d) =>
                    completedDays.includes(d.day)
                  ).length;
                  return (
                    <button
                      key={phase.id}
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setPhaseFilter((prev) => (prev === phase.id ? 0 : phase.id));
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? isWash
                            ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                            : 'bg-[#1F293D] border-[#D89B3C] text-[#F7F3EC]'
                          : isWash
                            ? 'bg-white border-[#141413]/16 text-[#4C4C48] hover:text-[#141413]'
                            : 'bg-[#121824] border-[#F2EEE6]/12 text-[#9BA5B6] hover:text-[#F2EEE6]'
                      }`}
                    >
                      <span>
                        {phase.dayRange} · {phaseDone}/{phaseLessons.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              <span className="text-[11px] text-[var(--dojo-text-muted)]">
                {t('點擊左側編號打卡 · 點開「練法詳情」看 3 步微循環與額外模組')}
              </span>
            </div>

            {/* 3. Ordered 4-Phase Curriculum Sequence (Day 1 -> Day 14) */}
            <div className="space-y-6">
              {visiblePhases.map(({ phase, lessons }) => {
                const phaseDone = lessons.filter((d) => completedDays.includes(d.day)).length;
                const isCurrentPhase = nextLesson.phaseId === phase.id;
                return (
                  <section key={phase.id} className="space-y-2.5">
                    {/* Crisp Phase Section Header */}
                    <div
                      className={`flex flex-col sm:flex-row sm:items-end justify-between gap-1 pb-2 border-b ${
                        isWash ? 'border-[#141413]/15' : 'border-[#F2EEE6]/12'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-tabular text-xs font-bold text-[var(--dojo-ochre)]">
                          {phase.dayRange}
                        </span>
                        <h3 className="font-display text-base sm:text-lg font-bold">
                          {t(phase.title)}
                        </h3>
                        {isCurrentPhase && (
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                              isWash
                                ? 'bg-[#FBF3E2] border border-[#B87A18]/40 text-[#7A510C]'
                                : 'bg-[#D89B3C]/18 text-[#F5C56B]'
                            }`}
                          >
                            {t('所在階段')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono-tabular text-[var(--dojo-text-muted)]">
                        {t('完成')} {phaseDone}/{lessons.length} · {t(phase.cumulativeTime)}
                      </div>
                    </div>

                    {/* Concise Ordered Course Rows */}
                    <div className="space-y-2.5">
                      {lessons.map((lesson) => {
                        const done = completedDays.includes(lesson.day);
                        const isNext = lesson.day === nextRecommendedDay && !done;
                        const isExpanded = expandedDays.includes(lesson.day);
                        const reviewDue = evaluation.ebbinghausDue.some(
                          (eb) => eb.sourceDay === lesson.day
                        );

                        return (
                          <article
                            key={lesson.day}
                            ref={(el) => {
                              dayRowRefs.current[lesson.day] = el;
                            }}
                            className={`rounded-xl border transition-colors ${
                              isNext
                                ? isWash
                                  ? 'bg-white border-[#B87A18] border-2 shadow-sm'
                                  : 'bg-[#161F30] border-[#D89B3C]/70'
                                : done
                                  ? isWash
                                    ? 'bg-[#F8F7F3]/90 border-[#141413]/12 opacity-90'
                                    : 'bg-[#0F1520]/90 border-[#2EA87E]/25 opacity-90'
                                  : surfaceCardClass
                            }`}
                          >
                            {/* Compact Primary Row */}
                            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                {/* Order Index / Completion Checkbox */}
                                <button
                                  type="button"
                                  onClick={() => toggleDayCompleted(lesson.day)}
                                  aria-label={t(`標記 Day ${lesson.day} 完成狀態`)}
                                  title={t(
                                    done
                                      ? `取消 Day ${lesson.day} 完成標記`
                                      : `標記 Day ${lesson.day} 已完成`
                                  )}
                                  className={`mt-0.5 w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer font-mono-tabular text-xs font-bold ${
                                    done
                                      ? isWash
                                        ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                                        : 'bg-[#2EA87E] border-[#2EA87E] text-[#0B0E14]'
                                      : isNext
                                        ? isWash
                                          ? 'bg-[#FBF3E2] border-[#B87A18] text-[#141413]'
                                          : 'bg-[#D89B3C]/22 border-[#D89B3C] text-[#F5C56B]'
                                        : isWash
                                          ? 'bg-[#F4F1EA] border-[#141413]/20 text-[#3E3E3A] hover:border-[#141413]'
                                          : 'bg-[#0D1119] border-[#F2EEE6]/16 text-[#AEB6C4] hover:border-[#F2EEE6]/40'
                                  }`}
                                >
                                  {done ? <Check className="w-4 h-4" /> : `D${lesson.day}`}
                                </button>

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-mono-tabular font-semibold text-[var(--dojo-ochre)]">
                                      Day {lesson.day}
                                    </span>
                                    <span className="text-[var(--dojo-text-muted)]" aria-hidden="true">·</span>
                                    <span className="font-mono-tabular text-[var(--dojo-text-sub)]">
                                      {lesson.durationMin} {t('分鐘')}
                                    </span>
                                    {isNext && (
                                      <span
                                        className={`font-semibold ${
                                          isWash ? 'text-[#9B5E0A]' : 'text-[#F5C56B]'
                                        }`}
                                      >
                                        · {t('當前主課')}
                                      </span>
                                    )}
                                    {done && (
                                      <span className="font-semibold text-[var(--dojo-pine-text)]">
                                        · {t('已打卡')}
                                      </span>
                                    )}
                                    {reviewDue && (
                                      <span className="font-semibold text-[var(--dojo-crimson)]">
                                        · {t('到期複習')}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="font-display text-base font-bold leading-snug">
                                    {t(lesson.title)}
                                  </h4>

                                  <p className="text-xs text-[var(--dojo-text-sub)] leading-relaxed">
                                    {t(lesson.focusSummary)}
                                  </p>

                                  <div className="text-[11px] text-[var(--dojo-text-muted)]">
                                    <span className="font-semibold text-[var(--dojo-text-sub)]">
                                      {t('過關標準')}：
                                    </span>
                                    <span>{t(lesson.passCriteria)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Clean Primary Start Button + Collapsible Details Toggle */}
                              <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0 pl-12 sm:pl-0">
                                {lesson.practiceModules[0] && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTriggerAction(lesson.practiceModules[0].action)
                                    }
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                                      isNext
                                        ? isWash
                                          ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                                          : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                                        : isWash
                                          ? 'bg-[#F4F1EA] hover:bg-[#181817] hover:text-[#F8F7F3] border border-[#141413]/18 text-[#141413]'
                                          : 'bg-[#192233] hover:bg-[#233048] border border-[#F2EEE6]/14 text-[#E6E2DA]'
                                    }`}
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>{t(lesson.practiceModules[0].action.label)}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => toggleExpandDay(lesson.day)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
                                >
                                  <span>
                                    {isExpanded
                                      ? t('收合練法詳情')
                                      : `${t('練法與模組')} (${lesson.practiceModules.length})`}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Collapsible 3-Step Routine & Extra Practice Modules Drawer */}
                            {isExpanded && (
                              <div
                                className={`px-4 pb-4 pt-3 border-t space-y-3 ${
                                  isWash ? 'border-[#141413]/12' : 'border-[var(--dojo-border)]'
                                }`}
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                  <div
                                    className={`rounded-lg border p-2.5 text-xs leading-relaxed ${subtlePanelClass}`}
                                  >
                                    <div className="font-semibold text-[var(--dojo-text-bright)] mb-0.5">
                                      01 · {t('喚醒 3 分鐘')}
                                    </div>
                                    <div className="text-[var(--dojo-text-sub)]">
                                      {t(lesson.microRoutine.warmup3m)}
                                    </div>
                                  </div>
                                  <div
                                    className={`rounded-lg border p-2.5 text-xs leading-relaxed ${subtlePanelClass}`}
                                  >
                                    <div className="font-semibold text-[var(--dojo-ochre)] mb-0.5">
                                      02 · {t('主練 8–12 分鐘')}
                                    </div>
                                    <div className="text-[var(--dojo-text-sub)]">
                                      {t(lesson.microRoutine.core8m)}
                                    </div>
                                  </div>
                                  <div
                                    className={`rounded-lg border p-2.5 text-xs leading-relaxed ${subtlePanelClass}`}
                                  >
                                    <div className="font-semibold text-[var(--dojo-pine-text)] mb-0.5">
                                      03 · {t('固化 4 分鐘')}
                                    </div>
                                    <div className="text-[var(--dojo-text-sub)]">
                                      {t(lesson.microRoutine.solidify4m)}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                  <span className="text-[11px] font-semibold text-[var(--dojo-text-muted)] mr-1">
                                    {t('本課相關練習模組')}：
                                  </span>
                                  {lesson.practiceModules.map((mod, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleTriggerAction(mod.action)}
                                      title={t(mod.usageTip)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                                        isWash
                                          ? 'bg-white hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/18 text-[#141413]'
                                          : 'bg-[#182030] hover:bg-[#222D43] border-[#F2EEE6]/14 text-[#E6E2DA]'
                                      }`}
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                      <span>{t(mod.action.label)}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* Quiet Helper Links at Bottom */}
            <div
              className={`pt-4 border-t flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--dojo-text-sub)] ${
                isWash ? 'border-[#141413]/14' : 'border-[var(--dojo-border)]'
              }`}
            >
              <span>{t('想進一步了解課程設計原理、彈性提醒排程或自由寫實戰？')}</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setActiveTab('rhythm');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-[var(--dojo-ochre)] hover:underline cursor-pointer"
                >
                  <span>{t('彈性節律與提醒')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setActiveTab('guide');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-[var(--dojo-ochre)] hover:underline cursor-pointer"
                >
                  <span>{t('記憶規律與七大破壁')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: FLEXIBLE RHYTHM & COACHING DIAGNOSTICS ==================== */}
        {activeTab === 'rhythm' && (
          <div className="space-y-5">
            {/* Concise Quantitative Telemetry Strip */}
            <section
              className={`rounded-xl border p-5 space-y-4 ${
                evaluation.statusLevel === 'devil_lock'
                  ? isWash
                    ? 'bg-[#FDF4F3] border-[#B83226]/45 text-[#141413]'
                    : 'bg-[#1A1318] border-[#D94A38]/55 text-[#F6F2EA]'
                  : evaluation.statusLevel === 'warning'
                    ? isWash
                      ? 'bg-[#FCF9F0] border-[#B87A18]/45 text-[#141413]'
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
                      {evaluation.todaySuppressed
                        ? t('今日已達標或調休，全天自動靜音')
                        : `${t('下個彈性窗')} ${slotInfo.nextWindowRange}（${t(
                            formatMinutesUntil(slotInfo.minutesUntilNext)
                          )}）`}
                    </span>
                  </div>
                  <h2 className="font-display text-xl font-bold">{t(evaluation.statusTitle)}</h2>
                  <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)] leading-relaxed max-w-3xl">
                    {t(evaluation.statusSummary)}
                  </p>
                </div>

                {/* Readiness Dial Summary */}
                <div
                  className={`shrink-0 rounded-xl border px-4 py-3 flex items-center gap-4 ${subtlePanelClass}`}
                >
                  <div className="text-center">
                    <span className="block text-[11px] text-[var(--dojo-text-muted)]">
                      {t('掌握準備度')}
                    </span>
                    <span className="font-mono-tabular text-2xl font-bold text-[var(--dojo-ochre)]">
                      {evaluation.readinessScore}
                      <span className="text-xs text-[var(--dojo-text-muted)]">/100</span>
                    </span>
                  </div>
                  <div className="h-8 w-px bg-[var(--dojo-border)]" aria-hidden="true" />
                  <div className="text-xs space-y-0.5 font-mono-tabular">
                    <div>
                      <span>
                        {t('連練紀錄')}：{evaluation.streakDays} {t('天')}
                      </span>
                    </div>
                    <div>
                      <span>
                        {t('慢字池')}：{evaluation.slowPoolCount} {t('字')}
                      </span>
                    </div>
                    <div>
                      <span>
                        {t('自動化率')}：{evaluation.masteredRatePct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5 Quantitative Telemetry Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <span className="block text-[11px] text-[var(--dojo-text-muted)]">
                    {t('今日字數紅線')}
                  </span>
                  <div className="font-mono-tabular text-lg font-bold mt-0.5">
                    <span>{evaluation.todayChars}</span>
                    <span className="text-xs font-normal text-[var(--dojo-text-muted)]">
                      /{evaluation.todayQuota}
                    </span>
                  </div>
                  <div
                    className={`mt-1.5 h-1.5 rounded-full overflow-hidden ${
                      isWash ? 'bg-[#141413]/12' : 'bg-black/30'
                    }`}
                  >
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
                  <span className="block text-[11px] text-[var(--dojo-text-muted)]">
                    {t('今日準確率')}
                  </span>
                  <span
                    className={`block font-mono-tabular text-lg font-bold mt-0.5 ${
                      evaluation.todayAccuracy !== null && evaluation.todayAccuracy < 92
                        ? 'text-[var(--dojo-crimson)]'
                        : 'text-[var(--dojo-pine-text)]'
                    }`}
                  >
                    {evaluation.todayAccuracy !== null ? `${evaluation.todayAccuracy}%` : '--'}
                  </span>
                  <span className="block text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('紅線 ≥ 92%')}
                  </span>
                </div>

                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <span className="block text-[11px] text-[var(--dojo-text-muted)]">
                    {t('字根均速')}
                  </span>
                  <span className="block font-mono-tabular text-lg font-bold mt-0.5">
                    {evaluation.todayAvgKeyMs ?? (evaluation.overallAvgKeyMs || '--')}
                    {evaluation.todayAvgKeyMs || evaluation.overallAvgKeyMs ? 'ms' : ''}
                  </span>
                  <span className="block text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('目標 < 450ms')}
                  </span>
                </div>

                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <span className="block text-[11px] text-[var(--dojo-text-muted)]">
                    {t('今日流速')}
                  </span>
                  <span className="block font-mono-tabular text-lg font-bold mt-0.5">
                    {evaluation.todayCpm ?? '--'}
                    {evaluation.todayCpm ? (
                      <span className="text-[11px] font-normal text-[var(--dojo-text-muted)]">
                        {' '}
                        CPM
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('14天終點 35+')}
                  </span>
                </div>

                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <span className="block text-[11px] text-[var(--dojo-text-muted)]">
                    {t('記憶到期複習')}
                  </span>
                  <span className="block font-mono-tabular text-lg font-bold mt-0.5 text-[var(--dojo-ochre)]">
                    {evaluation.ebbinghausDue.length} {t('項')}
                  </span>
                  <span className="block text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                    {t('+1/+2/+4/+7 天間隔')}
                  </span>
                </div>
              </div>
            </section>

            {/* Two-Column Core: Left Adaptive Remediation Queue + Right Flexible Rhythm Planner */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 7 cols */}
              <section className={`lg:col-span-7 rounded-xl border p-5 space-y-4 ${surfaceCardClass}`}>
                <div>
                  <h3 className="font-display text-lg font-bold flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-[var(--dojo-crimson)]" />
                    <span>{t('今日自動診斷補訓隊列')}</span>
                  </h3>
                  <p className="text-xs text-[var(--dojo-text-sub)] mt-0.5">
                    {t('偵測到低準確率、慢字堆積、斷練或遺忘曲線節點時，自動排在主課前優先消化。')}
                  </p>
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
                              ? 'bg-white hover:bg-[#FAF9F5] border border-[#141413]/18 text-[#141413]'
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
                    <span>{t('當前最弱輔音宮殿（點鍵立即單鍵覆寫肌肉記憶）：')}</span>
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
                            ? 'bg-white hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/18'
                            : 'bg-[#161E2E] hover:bg-[#222E46] border-[#F2EEE6]/14'
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

              {/* Right 5 cols: Flexible Habit-Anchor Rhythm Planner */}
              <section className={`lg:col-span-5 rounded-xl border p-5 space-y-4 ${surfaceCardClass}`}>
                <div>
                  <h3 className="font-display text-lg font-bold flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-[var(--dojo-ochre)]" />
                    <span>{t('輕擾動彈性節律規劃')}</span>
                  </h3>
                  <p className="text-xs text-[var(--dojo-text-sub)] mt-1 leading-relaxed">
                    {t(
                      '固定日曆鬧鐘容易令人煩躁。這裡改用「習慣錨點 ＋ 彈性時窗 ＋ 達標即靜音」：只在自然空檔輕提醒，練夠今日字數就自動安靜。'
                    )}
                  </p>
                </div>

                {/* Live Flex Escape Valves for Today */}
                <div
                  className={`rounded-xl border p-3.5 space-y-2.5 text-xs ${
                    evaluation.isRestDayToday
                      ? isWash
                        ? 'bg-[#EDF5F1] border-[#2EA87E]/45'
                        : 'bg-[#12201C] border-[#2EA87E]/45'
                      : subtlePanelClass
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--dojo-text-bright)]">
                      {t('今日臨時彈性調度')}
                    </span>
                    <span className="text-[11px] font-mono-tabular text-[var(--dojo-pine-text)]">
                      {evaluation.todaySuppressed
                        ? t('全天靜音保護中')
                        : `${t('尚差')} ${Math.max(0, evaluation.todayQuota - evaluation.todayChars)} ${t('字')}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleToggleTodayLowDose}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        evaluation.isLowDoseToday
                          ? 'bg-[var(--dojo-pine)] border-[var(--dojo-pine)] text-white'
                          : isWash
                            ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                            : 'bg-[#161E2E] hover:bg-[#1E2940] border-[#F2EEE6]/14 text-[#E6E2DA]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {t(evaluation.isLowDoseToday ? '已切為半量保溫 (取消)' : '今天太忙 · 改半量保溫')}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleTodayRest}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        evaluation.isRestDayToday
                          ? 'bg-[var(--dojo-ochre)] border-[var(--dojo-ochre)] text-[#0B0E14] font-semibold'
                          : isWash
                            ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                            : 'bg-[#161E2E] hover:bg-[#1E2940] border-[#F2EEE6]/14 text-[#E6E2DA]'
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {t(evaluation.isRestDayToday ? '今日已調休順延 (恢復)' : '今日調休 · 順延 1 天')}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3 Rhythm Templates */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[var(--dojo-text-sub)]">
                    <span>{t('1. 選擇最貼近你作息的生活節律模板')}</span>
                  </div>
                  <div className="space-y-1.5">
                    {RHYTHM_PRESETS.map((preset) => {
                      const selected = scheduleConfig.rhythmPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset.id)}
                          className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-colors cursor-pointer ${
                            selected
                              ? isWash
                                ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                                : 'bg-[#1C2638] border-[#D89B3C] text-[#F7F3EC]'
                              : isWash
                                ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                                : 'bg-[#0E131D] hover:bg-[#161E2E] border-[#F2EEE6]/12 text-[#DCE3F0]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span>{t(preset.title)}</span>
                            <span className="font-mono-tabular text-[11px] opacity-80 shrink-0">
                              {preset.morningEnabled
                                ? `${preset.morningTime} / ${preset.eveningTime}`
                                : `${preset.eveningTime}–${preset.eveningWindowEnd}`}
                            </span>
                          </div>
                          <div className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                            <span>{t(preset.subtitle)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Flexible Window & Habit Cues Editor */}
                <div className={`rounded-xl border p-4 space-y-3 text-xs ${subtlePanelClass}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--dojo-text-sub)]">
                      {t('2. 習慣觸發錨點與彈性時間窗')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        updateScheduleConfig({
                          rhythmPreset: 'custom',
                          morningEnabled: !scheduleConfig.morningEnabled,
                        });
                      }}
                      className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors cursor-pointer ${
                        scheduleConfig.morningEnabled
                          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                          : isWash
                            ? 'bg-white border-[#141413]/18 text-[#52524C]'
                            : 'bg-[#121824] border-[#F2EEE6]/12 text-[#888]'
                      }`}
                    >
                      <span>{t(scheduleConfig.morningEnabled ? '早／午段：啟用' : '早／午段：關閉（僅夜訓）')}</span>
                    </button>
                  </div>

                  {scheduleConfig.morningEnabled && (
                    <div className="space-y-1.5 pb-2.5 border-b border-[var(--dojo-border)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--dojo-text-muted)]">
                          {t('白日彈性窗（起 – 迄）')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={scheduleConfig.morningTime}
                            onChange={(e) =>
                              updateScheduleConfig({
                                rhythmPreset: 'custom',
                                morningTime: e.target.value,
                              })
                            }
                            className={`px-2 py-1 rounded-md border font-mono-tabular text-[11px] outline-none ${
                              isWash
                                ? 'bg-white border-[#141413]/20 text-[#141413]'
                                : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                            }`}
                          />
                          <span className="text-[var(--dojo-text-muted)]">–</span>
                          <input
                            type="time"
                            value={scheduleConfig.morningWindowEnd}
                            onChange={(e) =>
                              updateScheduleConfig({
                                rhythmPreset: 'custom',
                                morningWindowEnd: e.target.value,
                              })
                            }
                            className={`px-2 py-1 rounded-md border font-mono-tabular text-[11px] outline-none ${
                              isWash
                                ? 'bg-white border-[#141413]/20 text-[#141413]'
                                : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                            }`}
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={scheduleConfig.morningAnchorCue}
                        onChange={(e) =>
                          updateScheduleConfig({
                            rhythmPreset: 'custom',
                            morningAnchorCue: e.target.value,
                          })
                        }
                        placeholder={t('例如：早起喝完水／咖啡後 10 分鐘')}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
                          isWash
                            ? 'bg-white border-[#141413]/18 text-[#141413]'
                            : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                        }`}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--dojo-text-muted)]">
                        {t('晚間固化窗（起 – 迄）')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={scheduleConfig.eveningTime}
                          onChange={(e) =>
                            updateScheduleConfig({
                              rhythmPreset: 'custom',
                              eveningTime: e.target.value,
                            })
                          }
                          className={`px-2 py-1 rounded-md border font-mono-tabular text-[11px] outline-none ${
                            isWash
                              ? 'bg-white border-[#141413]/20 text-[#141413]'
                              : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                          }`}
                        />
                        <span className="text-[var(--dojo-text-muted)]">–</span>
                        <input
                          type="time"
                          value={scheduleConfig.eveningWindowEnd}
                          onChange={(e) =>
                            updateScheduleConfig({
                              rhythmPreset: 'custom',
                              eveningWindowEnd: e.target.value,
                            })
                          }
                          className={`px-2 py-1 rounded-md border font-mono-tabular text-[11px] outline-none ${
                            isWash
                              ? 'bg-white border-[#141413]/20 text-[#141413]'
                              : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                          }`}
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={scheduleConfig.eveningAnchorCue}
                      onChange={(e) =>
                        updateScheduleConfig({
                          rhythmPreset: 'custom',
                          eveningAnchorCue: e.target.value,
                        })
                      }
                      placeholder={t('例如：洗漱後／睡前放下手機前 15 分鐘')}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
                        isWash
                          ? 'bg-white border-[#141413]/18 text-[#141413]'
                          : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                      }`}
                    />
                  </div>

                  {/* Base Daily Quota & Start Date */}
                  <div className="pt-2.5 border-t border-[var(--dojo-border)] grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="block text-[11px] text-[var(--dojo-text-sub)]">
                        {t('計劃起跑日')}
                      </span>
                      <input
                        type="date"
                        value={scheduleConfig.startDate}
                        onChange={(e) => updateScheduleConfig({ startDate: e.target.value })}
                        className={`w-full px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs outline-none ${
                          isWash
                            ? 'bg-white border-[#141413]/20 text-[#141413]'
                            : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
                        }`}
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="block text-[11px] text-[var(--dojo-text-sub)]">
                        {t('每日基準字數')}
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
                                  ? 'bg-white border-[#141413]/18 text-[#52524C]'
                                  : 'bg-[#121824] border-[#F2EEE6]/12 text-[#9BA5B6]'
                            }`}
                          >
                            <span>{quota}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Mode */}
                  <div className="pt-2.5 border-t border-[var(--dojo-border)] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[var(--dojo-text-sub)]">
                        {t('3. 提醒打擾分級（達標即自動靜音）')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          updateScheduleConfig({
                            notificationsEnabled: !scheduleConfig.notificationsEnabled,
                          });
                        }}
                        className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
                          scheduleConfig.notificationsEnabled
                            ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                            : 'border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                        }`}
                      >
                        <span>{t(scheduleConfig.notificationsEnabled ? '提醒開啟中' : '完全靜默')}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'quiet_banner', label: '靜默微標', hint: '零聲音' },
                          { id: 'soft_chime', label: '輕音提示', hint: '開頁輕響' },
                          { id: 'browser_push', label: '系統推播', hint: '跨分頁' },
                        ] as Array<{ id: ReminderDeliveryMode; label: string; hint: string }>
                      ).map((dm) => {
                        const active = scheduleConfig.deliveryMode === dm.id;
                        return (
                          <button
                            key={dm.id}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              updateScheduleConfig({
                                deliveryMode: dm.id,
                                notificationsEnabled: true,
                              });
                            }}
                            className={`px-2 py-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
                              active
                                ? isWash
                                  ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                                  : 'bg-[#1F293D] border-[#D89B3C] text-[#F7F3EC]'
                                : isWash
                                  ? 'bg-white border-[#141413]/18 text-[#52524C]'
                                  : 'bg-[#121824] border-[#F2EEE6]/12 text-[#9BA5B6]'
                            }`}
                          >
                            <span className="block text-[11px] font-semibold">{t(dm.label)}</span>
                            <span className="block text-[10px] opacity-75">{t(dm.hint)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Strictness Switch */}
                  <div className="pt-2 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[var(--dojo-text-sub)]">{t('補訓演算法')}</span>
                    <div className="inline-flex items-center gap-1">
                      {(
                        [
                          { id: 'devil', label: '魔鬼防退行（自動插單）' },
                          { id: 'standard', label: '標準柔和' },
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
                                ? 'bg-white border-[#141413]/18 text-[#52524C]'
                                : 'bg-[#121824] border-[#F2EEE6]/12 text-[#9BA5B6]'
                          }`}
                        >
                          <span>{t(opt.label)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Test Reminder + Collapsible Optional Calendar Export */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {scheduleConfig.deliveryMode === 'browser_push' ? (
                      <button
                        type="button"
                        onClick={handleEnableBrowserNotify}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          notifyStatus === 'granted'
                            ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                            : isWash
                              ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                              : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#E6E2DA]'
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {t(
                            notifyStatus === 'granted'
                              ? '系統通知已授權'
                              : notifyStatus === 'denied'
                                ? '權限受限（改靜默）'
                                : '授權瀏覽器推播'
                          )}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTestReminder}
                        className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          isWash
                            ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                            : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#E6E2DA]'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('預覽目前級別提醒')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setShowAdvancedIcs((v) => !v);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        isWash
                          ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                          : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#E6E2DA]'
                      }`}
                    >
                      <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('進階：可選日曆匯出')}</span>
                      {showAdvancedIcs ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {showAdvancedIcs && (
                    <div className={`rounded-xl border p-3.5 space-y-2.5 text-xs ${subtlePanelClass}`}>
                      <p className="text-[11px] text-[var(--dojo-text-sub)] leading-relaxed">
                        {t(
                          '不想把 28 個死板事項塞滿 Google Calendar？建議先試用「未來 3 天輕量試跑」，只在需要外部提示的頭幾天使用。'
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportIcs(3)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isWash
                              ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                              : 'bg-[#D89B3C] hover:brightness-110 text-[#0B0E14]'
                          }`}
                        >
                          <span>{t('僅匯出未來 3 天 (.ics)')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportIcs(14)}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                            isWash
                              ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
                              : 'bg-[#192233] hover:bg-[#233048] border-[#F2EEE6]/14 text-[#E6E2DA]'
                          }`}
                        >
                          <span>{t('匯出完整 14 天 (.ics)')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {notifyFeedback && (
                    <div className="text-[11px] leading-relaxed text-[var(--dojo-pine-text)] px-1">
                      <span>{t(notifyFeedback)}</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: SUPPORTING PRINCIPLES & 7 BARRIERS ==================== */}
        {activeTab === 'guide' && (
          <div className="space-y-5">
            {/* Guide Header + Sub-Switch */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[var(--dojo-ochre)]" />
                  <span>{t('訓練方法論與破壁參考說明')}</span>
                </h2>
                <p className="text-xs sm:text-sm text-[var(--dojo-text-sub)] mt-0.5">
                  {t('課表為主、說明為輔——練法卡頓或好奇底層原理時，來這裡對照破壁指南即可。')}
                </p>
              </div>

              <div
                role="group"
                className={`inline-flex items-center p-1 rounded-lg border shrink-0 ${
                  isWash ? 'bg-white border-[#141413]/18' : 'bg-[#121824] border-[#F2EEE6]/14'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setGuideSection('laws');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    guideSection === 'laws'
                      ? isWash
                        ? 'bg-[#181817] text-[#F8F7F3]'
                        : 'bg-[#1F293D] text-[#F7F3EC]'
                      : 'text-[var(--dojo-text-sub)]'
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>{t('六大記憶底層規律')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setGuideSection('barriers');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    guideSection === 'barriers'
                      ? isWash
                        ? 'bg-[#181817] text-[#F8F7F3]'
                        : 'bg-[#1F293D] text-[#F7F3EC]'
                      : 'text-[var(--dojo-text-sub)]'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{t('七大真實難點破壁法')}</span>
                </button>
              </div>
            </div>

            {/* Sub-View A: 6 Cognitive Laws */}
            {guideSection === 'laws' && (
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

                    <div className="pt-3 border-t border-[var(--dojo-border)] space-y-2">
                      <div className="text-[11px] font-semibold text-[var(--dojo-text-muted)]">
                        <span>{t('想強化這條規律？直接點進對應模組自己練習：')}</span>
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
                                  ? 'bg-white hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/18 text-[#141413]'
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
            )}

            {/* Sub-View B: 7 Beginner Barriers */}
            {guideSection === 'barriers' && (
              <div className="space-y-3.5">
                {BARRIER_REMEDIES.map((item) => (
                  <section
                    key={item.id}
                    className={`rounded-xl border p-5 ${surfaceCardClass}`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      <div className="lg:col-span-7 space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-mono-tabular text-[var(--dojo-ochre)]">
                          <span className="font-semibold">{t(item.number)}</span>
                        </div>
                        <h3 className="font-display text-base sm:text-lg font-bold">
                          {t(item.title)}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className={`rounded-lg border p-3 text-xs leading-relaxed ${subtlePanelClass}`}>
                            <span className="block font-semibold mb-1 text-[var(--dojo-text-bright)]">
                              {t('卡點表現')}
                            </span>
                            <p className="text-[var(--dojo-text-sub)]">{t(item.symptom)}</p>
                          </div>
                          <div className={`rounded-lg border p-3 text-xs leading-relaxed ${subtlePanelClass}`}>
                            <span className="block font-semibold mb-1 text-[var(--dojo-text-bright)]">
                              {t('心理與生理成因')}
                            </span>
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

                      <div className={`lg:col-span-5 rounded-xl border p-4 space-y-3 ${subtlePanelClass}`}>
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
                              <span className="block text-xs font-semibold text-[var(--dojo-text-bright)]">
                                {t(mod.moduleName)}
                              </span>
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
                                      ? 'bg-white hover:bg-[#FAF9F5] border border-[#141413]/18 text-[#141413]'
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
            )}

            {/* Compact 3 Anti-Detour Iron Rules */}
            <section className={`rounded-xl border p-5 ${surfaceCardClass}`}>
              <h3 className="font-display text-base font-bold mb-2.5">
                {t('防走彎路「三不守則」')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed text-[var(--dojo-text-sub)]">
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <span className="block font-semibold text-[var(--dojo-text-bright)] mb-1">
                    01 · {t('不低頭看鍵盤')}
                  </span>
                  <p>{t('卡住哪怕停 3 秒，也只靠腦海空間與目標重合位雲圖回想，絕不低頭破壞手指本體感覺。')}</p>
                </div>
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <span className="block font-semibold text-[var(--dojo-text-bright)] mb-1">
                    02 · {t('不帶疲勞硬練')}
                  </span>
                  <p>{t('單次練超過 25 分鐘、頻頻錯鍵時立刻停手；睡一覺再回來，你會發現昨天卡住的鍵突然變順了。')}</p>
                </div>
                <div className={`rounded-lg border p-3 ${subtlePanelClass}`}>
                  <span className="block font-semibold text-[var(--dojo-text-bright)] mb-1">
                    03 · {t('不在低準確率下衝速')}
                  </span>
                  <p>{t('準確率低於 92% 時所有搶快都在強化錯誤記憶；開著節拍器守住「慢即是勻，勻即是快」。')}</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ==================== TAB 4: FREE WRITING BRIDGE & MODULE DIRECTORY ==================== */}
        {activeTab === 'freewrite' && (
          <div className="space-y-6">
            {/* Free-Writing Isolation Bridge */}
            <section className={`rounded-xl border p-5 space-y-4 ${surfaceCardClass}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="block text-xs font-mono-tabular text-[var(--dojo-ochre)] mb-1">
                    {t('第四階實戰遷移核心')} · {t('每日 200 字絕對禁切拼音區')}
                  </span>
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
                            ? 'bg-white border-[#141413]/18 text-[#52524C]'
                            : 'bg-[#0D1119] border-[#F2EEE6]/12 text-[#9BA5B6]'
                      }`}
                    >
                      <span>{t(p.title)}</span>
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
                        ? 'bg-white border-[#141413]/18 text-[#141413] placeholder:text-[#8E8E86] focus:ring-[#181817]/20'
                        : 'bg-[#0B0E15] border-[#F2EEE6]/14 text-[#F2EEE6] placeholder:text-[#5F6A7D] focus:ring-[#D89B3C]/30'
                    }`}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div
                        className={`flex-1 h-2 rounded-full overflow-hidden ${
                          isWash ? 'bg-[#141413]/12' : 'bg-white/10'
                        }`}
                      >
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${freeGoalPct}%`,
                            backgroundColor:
                              freeChineseCount >= 200 ? 'var(--dojo-pine)' : 'var(--dojo-ochre)',
                          }}
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
                                ? 'bg-white hover:bg-[#FAF9F5] border-[#141413]/18 text-[#141413]'
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
                            <span>{t('清空')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Stuck-Character Instant Split Inspector */}
                <div className={`lg:col-span-5 rounded-xl border p-4 flex flex-col justify-between gap-3 ${subtlePanelClass}`}>
                  <div className="space-y-3">
                    <div>
                      <span className="block text-xs font-semibold text-[var(--dojo-text-bright)]">
                        {t('造句卡殼字即時拆碼診斷')}
                      </span>
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
                          ? 'bg-white border-[#141413]/18 text-[#141413] focus:ring-[#181817]/20'
                          : 'bg-[#111622] border-[#F2EEE6]/14 text-[#F2EEE6] focus:ring-[#D89B3C]/30'
                      }`}
                    />

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {stuckDiagnostics.length === 0 ? (
                        <div className="text-xs text-[var(--dojo-text-muted)] py-4 text-center">
                          <span>{t('請輸入漢字以即時檢視字根與靈明全碼')}</span>
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
                                  ? 'bg-white border-[#141413]/14'
                                  : 'bg-[#121824] border-[#F2EEE6]/10'
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
                      <span className="block text-[11px] font-mono-tabular text-[var(--dojo-ochre)] font-semibold">
                        {t(mod.roleTag)}
                      </span>
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
                        <span className="block font-semibold text-[var(--dojo-pine-text)] mb-1">
                          {t('怎麼自己強化練習')}
                        </span>
                        <p className="text-[var(--dojo-text-sub)]">{t(mod.howToSelfDrill)}</p>
                      </div>
                      <div className="text-[11px] text-[var(--dojo-text-muted)]">
                        <span className="font-semibold text-[var(--dojo-text-sub)]">
                          {t('建議設置')}：
                        </span>
                        <span>{t(mod.recommendedSettings)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTriggerAction(mod.launchAction)}
                      className={`w-full inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        isWash
                          ? 'bg-white hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/18 text-[#141413]'
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
