import { CampaignProgressStore, getCampaignSummary } from '../data/campaign';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { DAILY_CURRICULUM, DailyLesson, NovicePracticeAction } from '../data/noviceCurriculum';
import { LINGMING_SCHEME } from '../data/schemes';
import { ScriptMode } from '../data/scriptFilter';
import {
  getLast7DaysGrowthSeries,
  getLocalDateKey,
  getMasterySummary,
  getWeakestKeys,
  SchemeMasteryStore,
  WeakKeyInfo,
} from './mastery';

export type CoachStrictness = 'standard' | 'devil';
export type TrainingSlotKind = 'morning' | 'evening';
export type CoachStatusLevel = 'ahead' | 'on_track' | 'warning' | 'devil_lock';

export interface TrainingScheduleConfig {
  startDate: string; // YYYY-MM-DD
  morningTime: string; // HH:MM
  eveningTime: string; // HH:MM
  dailyCharQuota: number;
  notificationsEnabled: boolean;
  strictness: CoachStrictness;
  snoozedUntilMs: number;
  lastNotifiedSlotKey: string;
  dayCompletedDates: Record<number, string>;
}

export interface AdaptivePlanTask {
  id: string;
  priority: 'critical' | 'review' | 'core';
  tag: string;
  title: string;
  reason: string;
  minutes: number;
  action: NovicePracticeAction;
}

export interface EbbinghausDueItem {
  sourceDay: number;
  sourceTitle: string;
  intervalLabel: string; // '+1 天', '+2 天', '+4 天', '+7 天'
  stageAction: NovicePracticeAction;
}

export interface SlotCountdownInfo {
  nextSlot: TrainingSlotKind;
  nextSlotTime: string;
  minutesUntilNext: number;
  activeSlotNow: TrainingSlotKind | null;
  activeSlotKey: string | null;
}

export interface TrainingEvaluation {
  statusLevel: CoachStatusLevel;
  statusTitle: string;
  statusSummary: string;
  readinessScore: number; // 0-100
  currentPlanDay: number; // 1-14
  recommendedLesson: DailyLesson;
  todayChars: number;
  todayQuota: number;
  todayQuotaPct: number;
  todayAccuracy: number | null;
  todayAvgKeyMs: number | null;
  todayCpm: number | null;
  overallAvgKeyMs: number;
  masteredRatePct: number;
  streakDays: number;
  missedYesterday: boolean;
  slowPoolCount: number;
  weakestKeys: WeakKeyInfo[];
  ebbinghausDue: EbbinghausDueItem[];
  adaptiveTasks: AdaptivePlanTask[];
}

export const STORAGE_COMPLETED_DAYS = 'inkkey_novice_completed_days_v1';
const STORAGE_SCHEDULE_CONFIG = 'inkkey_training_schedule_v1';

const EBBINGHAUS_INTERVALS = [1, 2, 4, 7] as const;

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const base = parseDateKey(dateKey);
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
  return getLocalDateKey(next);
}

function diffDaysBetweenKeys(fromKey: string, toKey: string): number {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  const ms =
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

function parseTimeMinutes(hhmm: string, fallbackMin: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallbackMin;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  return h * 60 + min;
}

export function loadCompletedDaysList(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_COMPLETED_DAYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 14);
  } catch {
    return [];
  }
}

export function saveCompletedDaysList(days: number[]): void {
  try {
    localStorage.setItem(STORAGE_COMPLETED_DAYS, JSON.stringify(days));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadTrainingSchedule(): TrainingScheduleConfig {
  const today = getLocalDateKey();
  const defaults: TrainingScheduleConfig = {
    startDate: today,
    morningTime: '08:30',
    eveningTime: '20:30',
    dailyCharQuota: 80,
    notificationsEnabled: true,
    strictness: 'devil',
    snoozedUntilMs: 0,
    lastNotifiedSlotKey: '',
    dayCompletedDates: {},
  };
  try {
    const raw = localStorage.getItem(STORAGE_SCHEDULE_CONFIG);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TrainingScheduleConfig>;
    return {
      startDate:
        typeof parsed.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate)
          ? parsed.startDate
          : today,
      morningTime:
        typeof parsed.morningTime === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.morningTime)
          ? parsed.morningTime
          : defaults.morningTime,
      eveningTime:
        typeof parsed.eveningTime === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.eveningTime)
          ? parsed.eveningTime
          : defaults.eveningTime,
      dailyCharQuota:
        typeof parsed.dailyCharQuota === 'number' && parsed.dailyCharQuota >= 30
          ? Math.min(400, Math.round(parsed.dailyCharQuota))
          : defaults.dailyCharQuota,
      notificationsEnabled:
        typeof parsed.notificationsEnabled === 'boolean'
          ? parsed.notificationsEnabled
          : defaults.notificationsEnabled,
      strictness: parsed.strictness === 'standard' ? 'standard' : 'devil',
      snoozedUntilMs: typeof parsed.snoozedUntilMs === 'number' ? parsed.snoozedUntilMs : 0,
      lastNotifiedSlotKey:
        typeof parsed.lastNotifiedSlotKey === 'string' ? parsed.lastNotifiedSlotKey : '',
      dayCompletedDates:
        parsed.dayCompletedDates && typeof parsed.dayCompletedDates === 'object'
          ? parsed.dayCompletedDates
          : {},
    };
  } catch {
    return defaults;
  }
}

export function saveTrainingSchedule(config: TrainingScheduleConfig): void {
  try {
    localStorage.setItem(STORAGE_SCHEDULE_CONFIG, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export type BrowserNotifyStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserNotifyStatus(): BrowserNotifyStatus {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotifyPermission(): Promise<BrowserNotifyStatus> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

export function fireBrowserNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission !== 'granted') return false;
  try {
    new Notification(title, {
      body,
      tag: 'inkkey-training-reminder',
    });
    return true;
  } catch {
    return false;
  }
}

export function computeSlotCountdown(
  config: TrainingScheduleConfig,
  now: Date = new Date()
): SlotCountdownInfo {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const morningMin = parseTimeMinutes(config.morningTime, 8 * 60 + 30);
  const eveningMin = parseTimeMinutes(config.eveningTime, 20 * 60 + 30);
  const todayKey = getLocalDateKey(now);

  // Check if currently inside a 45-min active window for morning or evening
  let activeSlotNow: TrainingSlotKind | null = null;
  let activeSlotKey: string | null = null;
  if (nowMinutes >= morningMin && nowMinutes <= morningMin + 45) {
    activeSlotNow = 'morning';
    activeSlotKey = `${todayKey}_morning`;
  } else if (nowMinutes >= eveningMin && nowMinutes <= eveningMin + 45) {
    activeSlotNow = 'evening';
    activeSlotKey = `${todayKey}_evening`;
  }

  // Pick next upcoming slot
  const candidates: Array<{ slot: TrainingSlotKind; time: string; min: number }> = [
    { slot: 'morning' as TrainingSlotKind, time: config.morningTime, min: morningMin },
    { slot: 'evening' as TrainingSlotKind, time: config.eveningTime, min: eveningMin },
  ].sort((a, b) => a.min - b.min);

  for (const c of candidates) {
    if (c.min > nowMinutes) {
      return {
        nextSlot: c.slot,
        nextSlotTime: c.time,
        minutesUntilNext: c.min - nowMinutes,
        activeSlotNow,
        activeSlotKey,
      };
    }
  }

  // Otherwise next slot is tomorrow's earliest slot
  const first = candidates[0];
  return {
    nextSlot: first.slot,
    nextSlotTime: first.time,
    minutesUntilNext: 1440 - nowMinutes + first.min,
    activeSlotNow,
    activeSlotKey,
  };
}

export function formatMinutesUntil(minutes: number): string {
  if (minutes <= 0) return '即將開始';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分鐘後`;
  if (m === 0) return `${h} 小時後`;
  return `${h} 小時 ${m} 分後`;
}

export function evaluateTrainingState({
  mastery,
  campaignProgress,
  completedDays,
  scriptMode,
  config,
  now = new Date(),
}: {
  mastery: SchemeMasteryStore;
  campaignProgress: CampaignProgressStore;
  completedDays: number[];
  scriptMode: ScriptMode;
  config: TrainingScheduleConfig;
  now?: Date;
}): TrainingEvaluation {
  const todayKey = getLocalDateKey(now);
  const yesterdayKey = addDaysToDateKey(todayKey, -1);
  const dailyMap = mastery.dailyStats || {};
  const todayStat = dailyMap[todayKey];
  const yesterdayStat = dailyMap[yesterdayKey];

  const todayChars = todayStat?.charsCleared ?? 0;
  const todayAccuracy =
    todayStat && todayStat.keySamples >= 5
      ? Math.round((todayStat.correctKeys / todayStat.keySamples) * 100)
      : null;
  const todayAvgKeyMs =
    todayStat && todayStat.keySamples >= 5
      ? Math.round(todayStat.totalKeyMs / todayStat.keySamples)
      : null;
  const todayCpm =
    todayStat && todayStat.charsCleared > 0 && todayStat.totalCharMs > 0
      ? Math.min(
          300,
          Math.max(1, Math.round((todayStat.charsCleared * 60000) / todayStat.totalCharMs))
        )
      : null;

  // Compute current plan day (1..14)
  let firstUncompleted = 14;
  for (let d = 1; d <= 14; d++) {
    if (!completedDays.includes(d)) {
      firstUncompleted = d;
      break;
    }
  }
  const calendarDay = Math.max(
    1,
    Math.min(14, diffDaysBetweenKeys(config.startDate, todayKey) + 1)
  );
  const currentPlanDay = Math.max(firstUncompleted, Math.min(14, firstUncompleted));
  const recommendedLesson =
    DAILY_CURRICULUM.find((l) => l.day === currentPlanDay) || DAILY_CURRICULUM[0];

  // Streak days (>= 15 chars counts as active daily training)
  let streakDays = 0;
  for (let offset = 0; offset < 30; offset++) {
    const dk = addDaysToDateKey(todayKey, -offset);
    const st = dailyMap[dk];
    if (st && st.charsCleared >= 15) {
      streakDays++;
    } else if (offset === 0) {
      // Allow today not finished yet without breaking yesterday's streak
      continue;
    } else {
      break;
    }
  }

  const hasAnyHistory =
    mastery.totalCleared > 0 || completedDays.length > 0 || Object.keys(dailyMap).length > 0;
  const missedYesterday =
    hasAnyHistory &&
    calendarDay > 1 &&
    (!yesterdayStat || yesterdayStat.charsCleared < 15) &&
    todayChars < 20;

  const slowPoolCount = Object.keys(mastery.slowGlyphs || {}).length;
  const weakestKeys = getWeakestKeys(LINGMING_SCHEME, mastery, 5, scriptMode);
  const masterySummary = getMasterySummary(LINGMING_SCHEME, mastery, scriptMode);
  const masteredRatePct =
    masterySummary.totalEntries > 0
      ? Math.round((masterySummary.masteredCount / masterySummary.totalEntries) * 100)
      : 0;

  const campaignSummary = getCampaignSummary(campaignProgress);
  const growth = getLast7DaysGrowthSeries(mastery, now);
  const baseQuota = config.dailyCharQuota;
  // Devil mode adds +25% recovery quota if yesterday was missed or slow pool piled up
  const recoveryBoost =
    config.strictness === 'devil' && (missedYesterday || slowPoolCount >= 6) ? 1.25 : 1;
  const todayQuota = Math.round(baseQuota * recoveryBoost);
  const todayQuotaPct = Math.min(100, Math.round((todayChars / Math.max(1, todayQuota)) * 100));

  // Ebbinghaus spaced-repetition check for completed days
  const ebbinghausDue: EbbinghausDueItem[] = [];
  for (const dayNum of completedDays) {
    if (dayNum >= currentPlanDay) continue;
    const lesson = DAILY_CURRICULUM.find((l) => l.day === dayNum);
    if (!lesson || lesson.practiceModules.length === 0) continue;
    const doneDate = config.dayCompletedDates[dayNum] || config.startDate;
    const daysElapsed = diffDaysBetweenKeys(doneDate, todayKey);
    const hitInterval = EBBINGHAUS_INTERVALS.find((iv) => daysElapsed === iv);
    // Also surface Day - 1 / Day - 2 review if user has missed practicing today
    if (hitInterval) {
      ebbinghausDue.push({
        sourceDay: dayNum,
        sourceTitle: lesson.title,
        intervalLabel: `+${hitInterval} 天遺忘點`,
        stageAction: lesson.practiceModules[0].action,
      });
    }
  }
  // Fallback if no explicit completion date matched exact interval yet, surface 2-day-prior checkpoint when in Day 3+
  if (ebbinghausDue.length === 0 && currentPlanDay >= 3 && todayChars < 25) {
    const checkDay = currentPlanDay - 2;
    const prevLesson = DAILY_CURRICULUM.find((l) => l.day === checkDay);
    if (prevLesson && prevLesson.practiceModules[0]) {
      ebbinghausDue.push({
        sourceDay: checkDay,
        sourceTitle: prevLesson.title,
        intervalLabel: '+2 天記憶複習',
        stageAction: prevLesson.practiceModules[0].action,
      });
    }
  }

  // Compute Readiness Score (0-100)
  const accScore = todayAccuracy !== null ? Math.min(30, Math.round((todayAccuracy / 100) * 30)) : 20;
  const latencyMs = todayAvgKeyMs ?? masterySummary.avgKeyMs;
  const speedScore =
    latencyMs > 0
      ? Math.max(5, Math.min(25, Math.round(((950 - Math.min(950, latencyMs)) / 650) * 25)))
      : 10;
  const quotaScore = Math.min(20, Math.round((todayQuotaPct / 100) * 20));
  const campaignScore = Math.min(
    15,
    Math.round((campaignSummary.totalStars / Math.max(1, campaignSummary.maxStars)) * 15)
  );
  const cleanPoolScore = Math.max(0, 10 - slowPoolCount);
  const readinessScore = Math.max(
    0,
    Math.min(100, accScore + speedScore + quotaScore + campaignScore + cleanPoolScore)
  );

  // Build adaptive Devil-Mode tasks based on memory laws & real bottlenecks
  const adaptiveTasks: AdaptivePlanTask[] = [];
  const dirtyMemoryRisk = todayAccuracy !== null && todayAccuracy < 92 && (todayStat?.keySamples ?? 0) >= 20;

  if (dirtyMemoryRisk) {
    adaptiveTasks.push({
      id: 'dirty-memory-reset',
      priority: 'critical',
      tag: '強制降速覆寫',
      title: `準確率跌至 ${todayAccuracy}%（低於 92% 紅線）`,
      reason:
        '記憶培養規律：在 <92% 準確率下硬衝速度會把錯誤肌纖維寫死。魔鬼督訓鎖定先做 5 分鐘慢速高純度蓋印。',
      minutes: 5,
      action: {
        kind: 'free_play',
        mode: 'weakkey',
        scope: 'root',
        scaffold: 'full',
        label: '立即降速覆寫救準確率',
      },
    });
  }

  if (slowPoolCount >= 4) {
    adaptiveTasks.push({
      id: 'slow-pool-purge',
      priority: 'critical',
      tag: '慢字熔斷清零',
      title: `慢字／錯字池已累積 ${slowPoolCount} 字待爆破`,
      reason:
        '木桶效應：舊卡點未消滅直接推新課會引發雪崩卡頓。必須先讓慢字連續 3 次無錯畢業才能開新章。',
      minutes: 6,
      action: {
        kind: 'drill_studio',
        tab: 'slowhell',
        label: `先清剿 ${slowPoolCount} 個慢字`,
      },
    });
  }

  if (missedYesterday) {
    const topWeak = weakestKeys[0];
    const anchor = topWeak ? LINGMING_CHAMBER_BY_KEY[topWeak.key]?.primaryAnchor || '' : '';
    adaptiveTasks.push({
      id: 'missed-day-rescue',
      priority: 'critical',
      tag: '斷練遺忘搶救',
      title: topWeak
        ? `昨日斷練！立即激活最弱鍵 ${topWeak.key.toUpperCase()}（${anchor}）`
        : '昨日斷練！補打 5 分鐘記憶宮殿大碼喚醒',
      reason:
        '艾賓浩斯遺忘曲線在停練 24–48 小時出現最陡下滑。今日須先追加 +25% 字數拉回肌群熱度。',
      minutes: 5,
      action: topWeak
        ? {
            kind: 'chamber_drill',
            chamberKey: topWeak.key,
            label: `救回 ${topWeak.key.toUpperCase()} 鍵記憶`,
          }
        : {
            kind: 'free_play',
            mode: 'reflex',
            scope: 'da',
            scaffold: 'adaptive',
            label: '5 分鐘大碼喚醒',
          },
    });
  }

  // Weakest bottleneck key if practiced & latency > 520ms
  const practicedWeak = weakestKeys.find((w) => w.attempts >= 5 && w.emaLatencyMs > 520);
  if (practicedWeak && !missedYesterday) {
    const anchor = LINGMING_CHAMBER_BY_KEY[practicedWeak.key]?.primaryAnchor || '';
    adaptiveTasks.push({
      id: 'weak-key-remedy',
      priority: 'review',
      tag: '瓶頸鍵靶向加練',
      title: `${practicedWeak.key.toUpperCase()} 鍵（${anchor}）反應 ${practicedWeak.emaLatencyMs}ms 偏慢`,
      reason: '該鍵已成為拆字拖尾瓶頸，單鍵高密度重複 1 輪即可把基底核反應壓進 420ms。',
      minutes: 4,
      action: {
        kind: 'chamber_drill',
        chamberKey: practicedWeak.key,
        label: `單鍵專練 ${practicedWeak.key.toUpperCase()}（${anchor}）`,
      },
    });
  }

  // Ebbinghaus spaced review block
  if (ebbinghausDue.length > 0) {
    const due = ebbinghausDue[0];
    adaptiveTasks.push({
      id: `ebbinghaus-d${due.sourceDay}`,
      priority: 'review',
      tag: `艾賓浩斯 ${due.intervalLabel}`,
      title: `回測 Day ${due.sourceDay}：${due.sourceTitle}`,
      reason: '依 1／2／4／7 天黃金間隔安排主動提取回測，用最低成本把短期表徵轉成長期反射。',
      minutes: 4,
      action: due.stageAction,
    });
  }

  // Always include today's primary lesson block
  const primaryAction = recommendedLesson.practiceModules[0]?.action || {
    kind: 'stage',
    stageId: '1-1',
    label: '開始今日核心關卡',
  };
  adaptiveTasks.push({
    id: `core-day-${recommendedLesson.day}`,
    priority: 'core',
    tag: `Day ${recommendedLesson.day} 主課`,
    title: recommendedLesson.title,
    reason: recommendedLesson.focusSummary,
    minutes: 10,
    action: primaryAction,
  });

  // Determine overall status verdict
  let statusLevel: CoachStatusLevel = 'on_track';
  let statusTitle = '進度穩健 · 依計劃推進';
  let statusSummary = `今日目標 ${todayChars}/${todayQuota} 字。維持 94%+ 高純度準確率，睡前完成主課即可讓肌肉記憶離線鞏固。`;

  const behindSchedule = calendarDay > currentPlanDay + 1 && completedDays.length < calendarDay - 1;
  if (config.strictness === 'devil' && (dirtyMemoryRisk || slowPoolCount >= 6 || missedYesterday)) {
    statusLevel = 'devil_lock';
    statusTitle = dirtyMemoryRisk
      ? '魔鬼熔斷警報：準確率失守，禁止盲目衝速'
      : missedYesterday
        ? '魔鬼催練警報：昨日缺席引發遺忘滑坡，已追加搶救課表'
        : `魔鬼熔斷警報：慢字池堆積 ${slowPoolCount} 字，須先清剿再推新課`;
    statusSummary =
      '已根據記憶培養規律自動在今日計劃頂部插入強制補訓任務；先完成紅色標記任務再進主線，確保每小時訓練都不白費。';
  } else if (slowPoolCount >= 3 || behindSchedule || (growth.cpmDelta !== null && growth.cpmDelta < 0)) {
    statusLevel = 'warning';
    statusTitle = behindSchedule
      ? `進度落後預排（課表第 ${calendarDay} 天 vs 實進 Day ${currentPlanDay}）`
      : '記憶鞏固提醒：出現輕微卡點或流速波動';
    statusSummary =
      '建議先清掉慢字池與系統排出的艾賓浩斯複習節點，將今日字數補齊至達標線。';
  } else if (todayQuotaPct >= 100 && (todayAccuracy === null || todayAccuracy >= 94)) {
    statusLevel = 'ahead';
    statusTitle = '今日達標碾壓 · 記憶純度極佳';
    statusSummary = `今日已完成 ${todayChars} 字且準確率出色。注意單次練功不超過 25 分鐘，適時收手讓大腦在睡眠期固化成果。`;
  }

  return {
    statusLevel,
    statusTitle,
    statusSummary,
    readinessScore,
    currentPlanDay,
    recommendedLesson,
    todayChars,
    todayQuota,
    todayQuotaPct,
    todayAccuracy,
    todayAvgKeyMs,
    todayCpm,
    overallAvgKeyMs: masterySummary.avgKeyMs,
    masteredRatePct,
    streakDays,
    missedYesterday,
    slowPoolCount,
    weakestKeys,
    ebbinghausDue,
    adaptiveTasks,
  };
}

function formatIcsDateTimeLocal(dateKey: string, hhmm: string): string {
  const [y, m, d] = dateKey.split('-');
  const [hhRaw, mmRaw] = hhmm.split(':');
  const hh = String(Math.max(0, Math.min(23, Number(hhRaw) || 0))).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, Number(mmRaw) || 0))).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
}

export function buildTrainingIcsContent(config: TrainingScheduleConfig): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InkKey Dojo//Lingming 14-Day Devil Plan//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  for (const lesson of DAILY_CURRICULUM) {
    const dateKey = addDaysToDateKey(config.startDate, lesson.day - 1);

    // Morning 10-minute consolidation / warmup alarm
    const mStart = formatIcsDateTimeLocal(dateKey, config.morningTime);
    const mEndMin = parseTimeMinutes(config.morningTime, 8 * 60 + 30) + 10;
    const mEndTime = `${String(Math.floor(mEndMin / 60) % 24).padStart(2, '0')}:${String(
      mEndMin % 60
    ).padStart(2, '0')}`;
    const mEnd = formatIcsDateTimeLocal(dateKey, mEndTime);

    lines.push(
      'BEGIN:VEVENT',
      `UID:inkkey-d${lesson.day}-am-${config.startDate}@inkkey.dojo`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${mStart}`,
      `DTEND:${mEnd}`,
      `SUMMARY:[墨鍵道場 Day ${lesson.day}/14 晨練10分] ${lesson.title}`,
      `DESCRIPTION:晨間黃金喚醒：${lesson.microRoutine.warmup3m}（目標：先清慢字池再進入主課）`,
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      `DESCRIPTION:墨鍵道場晨練即將開始（Day ${lesson.day}）`,
      'END:VALARM',
      'END:VEVENT'
    );

    // Evening 15-minute core + pre-sleep consolidation alarm
    const eStart = formatIcsDateTimeLocal(dateKey, config.eveningTime);
    const eEndMin = parseTimeMinutes(config.eveningTime, 20 * 60 + 30) + 15;
    const eEndTime = `${String(Math.floor(eEndMin / 60) % 24).padStart(2, '0')}:${String(
      eEndMin % 60
    ).padStart(2, '0')}`;
    const eEnd = formatIcsDateTimeLocal(dateKey, eEndTime);

    lines.push(
      'BEGIN:VEVENT',
      `UID:inkkey-d${lesson.day}-pm-${config.startDate}@inkkey.dojo`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${eStart}`,
      `DTEND:${eEnd}`,
      `SUMMARY:[墨鍵道場 Day ${lesson.day}/14 睡前固化15分] ${lesson.title}`,
      `DESCRIPTION:核心專攻：${lesson.microRoutine.core8m}\\n收尾鞏固：${lesson.microRoutine.solidify4m}\\n過關標準：${lesson.passCriteria}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT5M',
      'ACTION:DISPLAY',
      `DESCRIPTION:墨鍵道場睡前固化訓練開始（Day ${lesson.day}），練完好睡眠離線記憶重放`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
