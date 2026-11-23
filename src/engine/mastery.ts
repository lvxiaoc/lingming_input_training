import { EntryKind, GlyphEntry, ShapeCodeScheme } from '../data/schemes';
import { matchesScript, ScriptMode } from '../data/scriptFilter';

export interface KeyMasteryStat {
  attempts: number;
  errors: number;
  emaLatencyMs: number;
}

export interface GlyphMasteryStat {
  streak: number;
  bestMs: number;
  level: 0 | 1 | 2 | 3; // 0: 新接觸, 1: 學習中, 2: 漸隱盲打, 3: 肌肉自動化
}

export interface SlowGlyphRecord {
  char: string;
  parts: string[];
  code: string;
  lastLatencyMs: number;
  hesitationCount: number;
  errorCount: number;
  fastCleanStreak: number; // 連續 3 次門檻內無錯直出即移出慢字池
  reason: 'slow' | 'error';
  updatedAt: number;
}

export interface DailyPracticeStat {
  date: string; // Local YYYY-MM-DD
  charsCleared: number;
  totalCharMs: number;
  keySamples: number;
  totalKeyMs: number;
  correctKeys: number;
  bestCpm?: number;
}

export interface SchemeMasteryStore {
  keys: Record<string, KeyMasteryStat>;
  glyphs: Record<string, GlyphMasteryStat>;
  slowGlyphs?: Record<string, SlowGlyphRecord>;
  dailyStats?: Record<string, DailyPracticeStat>;
  totalCleared: number;
  bestScore: number;
}

export type ScaffoldMode = 'adaptive' | 'full' | 'blind';
export type TrainingScope = 'all' | EntryKind;

const MASTERY_PREFIX = 'inkkey_mastery_v2_';
const MAX_DAILY_HISTORY_DAYS = 30;

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createEmptyDailyStat(dateKey: string): DailyPracticeStat {
  return {
    date: dateKey,
    charsCleared: 0,
    totalCharMs: 0,
    keySamples: 0,
    totalKeyMs: 0,
    correctKeys: 0,
  };
}

function pruneDailyStats(
  stats: Record<string, DailyPracticeStat>
): Record<string, DailyPracticeStat> {
  const keys = Object.keys(stats);
  if (keys.length <= MAX_DAILY_HISTORY_DAYS) return stats;
  const kept = keys.sort().slice(-MAX_DAILY_HISTORY_DAYS);
  const next: Record<string, DailyPracticeStat> = {};
  for (const k of kept) {
    next[k] = stats[k];
  }
  return next;
}

export function createEmptyStore(): SchemeMasteryStore {
  return {
    keys: {},
    glyphs: {},
    slowGlyphs: {},
    dailyStats: {},
    totalCleared: 0,
    bestScore: 0,
  };
}

export function loadMasteryStore(schemeId: string): SchemeMasteryStore {
  try {
    const raw = localStorage.getItem(MASTERY_PREFIX + schemeId);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as Partial<SchemeMasteryStore>;
    return {
      keys: parsed.keys || {},
      glyphs: parsed.glyphs || {},
      slowGlyphs: parsed.slowGlyphs || {},
      dailyStats: parsed.dailyStats || {},
      totalCleared: parsed.totalCleared || 0,
      bestScore: parsed.bestScore || 0,
    };
  } catch {
    return createEmptyStore();
  }
}

export function saveMasteryStore(schemeId: string, store: SchemeMasteryStore): void {
  try {
    localStorage.setItem(MASTERY_PREFIX + schemeId, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordKeyResult(
  store: SchemeMasteryStore,
  key: string,
  correct: boolean,
  latencyMs: number
): SchemeMasteryStore {
  const k = key.toLowerCase();
  const prev = store.keys[k] || { attempts: 0, errors: 0, emaLatencyMs: 650 };
  const clampedMs = Math.min(2500, Math.max(90, latencyMs));
  const nextEma =
    prev.attempts === 0
      ? clampedMs
      : Math.round(prev.emaLatencyMs * 0.72 + clampedMs * 0.28);

  const todayKey = getLocalDateKey();
  const prevDailyMap = store.dailyStats || {};
  const prevToday = prevDailyMap[todayKey] || createEmptyDailyStat(todayKey);
  const nextDailyMap = pruneDailyStats({
    ...prevDailyMap,
    [todayKey]: {
      ...prevToday,
      keySamples: prevToday.keySamples + 1,
      totalKeyMs: prevToday.totalKeyMs + Math.round(clampedMs),
      correctKeys: prevToday.correctKeys + (correct ? 1 : 0),
    },
  });

  return {
    ...store,
    dailyStats: nextDailyMap,
    keys: {
      ...store.keys,
      [k]: {
        attempts: prev.attempts + 1,
        errors: prev.errors + (correct ? 0 : 1),
        emaLatencyMs: correct ? nextEma : Math.min(2500, Math.round(prev.emaLatencyMs * 1.12)),
      },
    },
  };
}

export function recordGlyphCompletion(
  store: SchemeMasteryStore,
  glyphId: string,
  hadError: boolean,
  totalMs: number,
  codeLength: number
): { nextStore: SchemeMasteryStore; promoted: boolean; level: 0 | 1 | 2 | 3 } {
  const prev = store.glyphs[glyphId] || { streak: 0, bestMs: 9999, level: 0 };
  const msPerKey = totalMs / Math.max(1, codeLength);
  const nextStreak = hadError ? 0 : prev.streak + 1;

  let nextLevel: 0 | 1 | 2 | 3 = prev.level;
  if (hadError) {
    nextLevel = Math.max(0, prev.level - 1) as 0 | 1 | 2 | 3;
  } else if (nextStreak >= 5 && msPerKey < 460) {
    nextLevel = 3;
  } else if (nextStreak >= 3 && msPerKey < 680) {
    nextLevel = Math.max(prev.level, 2) as 0 | 1 | 2 | 3;
  } else if (nextStreak >= 1) {
    nextLevel = Math.max(prev.level, 1) as 0 | 1 | 2 | 3;
  }

  const promoted = nextLevel > prev.level;

  // Clamp per-char duration (140ms..12s) so idle pauses don't distort daily CPM
  const clampedCharMs = Math.min(12000, Math.max(140, Math.round(totalMs)));
  const todayKey = getLocalDateKey();
  const prevDailyMap = store.dailyStats || {};
  const prevToday = prevDailyMap[todayKey] || createEmptyDailyStat(todayKey);
  const nextDailyMap = pruneDailyStats({
    ...prevDailyMap,
    [todayKey]: {
      ...prevToday,
      charsCleared: prevToday.charsCleared + 1,
      totalCharMs: prevToday.totalCharMs + clampedCharMs,
    },
  });

  return {
    promoted,
    level: nextLevel,
    nextStore: {
      ...store,
      totalCleared: store.totalCleared + 1,
      dailyStats: nextDailyMap,
      glyphs: {
        ...store.glyphs,
        [glyphId]: {
          streak: nextStreak,
          bestMs: Math.min(prev.bestMs, Math.round(totalMs)),
          level: nextLevel,
        },
      },
    },
  };
}

export function recordDailyBestCpm(
  store: SchemeMasteryStore,
  roundCpm: number
): SchemeMasteryStore {
  if (!Number.isFinite(roundCpm) || roundCpm <= 0) return store;
  const rounded = Math.min(300, Math.round(roundCpm));
  const todayKey = getLocalDateKey();
  const prevDailyMap = store.dailyStats || {};
  const prevToday = prevDailyMap[todayKey] || createEmptyDailyStat(todayKey);
  if ((prevToday.bestCpm || 0) >= rounded) return store;
  return {
    ...store,
    dailyStats: pruneDailyStats({
      ...prevDailyMap,
      [todayKey]: {
        ...prevToday,
        bestCpm: rounded,
      },
    }),
  };
}

export interface GrowthDayPoint {
  date: string;
  label: string;
  shortDate: string;
  isToday: boolean;
  cpm: number | null;
  avgLatencyMs: number | null;
  charsCleared: number;
  keySamples: number;
  accuracyPct: number | null;
  bestCpm: number | null;
}

export interface GrowthAnalyticsSeries {
  days: GrowthDayPoint[];
  activeDays: number;
  totalChars7d: number;
  totalKeys7d: number;
  latestCpm: number | null;
  avgCpm7d: number | null;
  peakCpm7d: number | null;
  cpmDelta: number | null;
  latestLatencyMs: number | null;
  avgLatency7d: number | null;
  latencyDeltaMs: number | null;
}

export function getLast7DaysGrowthSeries(
  store: SchemeMasteryStore,
  now: Date = new Date()
): GrowthAnalyticsSeries {
  const dailyMap = store.dailyStats || {};
  const days: GrowthDayPoint[] = [];

  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = getLocalDateKey(d);
    const shortDate = `${d.getMonth() + 1}/${d.getDate()}`;
    const isToday = offset === 0;
    const stat = dailyMap[key];

    const cpm =
      stat && stat.charsCleared > 0 && stat.totalCharMs > 0
        ? Math.min(300, Math.max(1, Math.round((stat.charsCleared * 60000) / stat.totalCharMs)))
        : null;
    const avgLatencyMs =
      stat && stat.keySamples > 0
        ? Math.round(stat.totalKeyMs / stat.keySamples)
        : null;
    const accuracyPct =
      stat && stat.keySamples > 0
        ? Math.round((stat.correctKeys / stat.keySamples) * 100)
        : null;

    days.push({
      date: key,
      label: isToday ? '今日' : shortDate,
      shortDate,
      isToday,
      cpm,
      avgLatencyMs,
      charsCleared: stat?.charsCleared ?? 0,
      keySamples: stat?.keySamples ?? 0,
      accuracyPct,
      bestCpm: stat?.bestCpm ?? null,
    });
  }

  const cpmDays = days.filter((d): d is GrowthDayPoint & { cpm: number } => d.cpm !== null);
  const latencyDays = days.filter(
    (d): d is GrowthDayPoint & { avgLatencyMs: number } => d.avgLatencyMs !== null
  );
  const activeDays = days.filter((d) => d.cpm !== null || d.avgLatencyMs !== null).length;
  const totalChars7d = days.reduce((sum, d) => sum + d.charsCleared, 0);
  const totalKeys7d = days.reduce((sum, d) => sum + d.keySamples, 0);

  const latestCpm = cpmDays.length > 0 ? cpmDays[cpmDays.length - 1].cpm : null;
  const avgCpm7d =
    cpmDays.length > 0
      ? Math.round(cpmDays.reduce((sum, d) => sum + d.cpm, 0) / cpmDays.length)
      : null;
  const peakCpm7d =
    cpmDays.length > 0
      ? Math.max(...cpmDays.map((d) => Math.max(d.cpm, d.bestCpm ?? 0)))
      : null;
  const cpmDelta =
    cpmDays.length >= 2 ? cpmDays[cpmDays.length - 1].cpm - cpmDays[0].cpm : null;

  const latestLatencyMs =
    latencyDays.length > 0 ? latencyDays[latencyDays.length - 1].avgLatencyMs : null;
  const avgLatency7d =
    latencyDays.length > 0
      ? Math.round(latencyDays.reduce((sum, d) => sum + d.avgLatencyMs, 0) / latencyDays.length)
      : null;
  const latencyDeltaMs =
    latencyDays.length >= 2
      ? latencyDays[latencyDays.length - 1].avgLatencyMs - latencyDays[0].avgLatencyMs
      : null;

  return {
    days,
    activeDays,
    totalChars7d,
    totalKeys7d,
    latestCpm,
    avgCpm7d,
    peakCpm7d,
    cpmDelta,
    latestLatencyMs,
    avgLatency7d,
    latencyDeltaMs,
  };
}

export interface WeakKeyInfo {
  key: string;
  primary: string;
  emaLatencyMs: number;
  errorRate: number;
  attempts: number;
  weaknessScore: number;
}

export function getWeakestKeys(
  scheme: ShapeCodeScheme,
  store: SchemeMasteryStore,
  limit = 5,
  scriptMode: ScriptMode = 'both'
): WeakKeyInfo[] {
  const list: WeakKeyInfo[] = [];
  for (const [k, def] of Object.entries(scheme.keyMap)) {
    if (def.isDisabled) continue;
    // In Lingming, prioritize the 20 consonant large-code chambers for weak-key targeting
    if (scheme.isLingming && def.isVowel) continue;
    const used = scheme.entries.some(
      (e) => matchesScript(e.script, scriptMode) && e.code.includes(k)
    );
    if (!used) continue;
    const stat = store.keys[k];
    if (!stat || stat.attempts === 0) {
      list.push({
        key: k,
        primary: def.primary,
        emaLatencyMs: 700,
        errorRate: 0,
        attempts: 0,
        weaknessScore: 340,
      });
    } else {
      const errorRate = stat.errors / stat.attempts;
      const weaknessScore = errorRate * 550 + Math.max(0, stat.emaLatencyMs - 260);
      list.push({
        key: k,
        primary: def.primary,
        emaLatencyMs: stat.emaLatencyMs,
        errorRate,
        attempts: stat.attempts,
        weaknessScore,
      });
    }
  }
  return list.sort((a, b) => b.weaknessScore - a.weaknessScore).slice(0, limit);
}

export function getEffectiveScaffoldLevel(
  scaffoldMode: ScaffoldMode,
  glyphLevel: 0 | 1 | 2 | 3,
  hesitationMs: number,
  forcedHint: boolean
): 0 | 1 | 2 | 3 {
  if (forcedHint) return 0;
  if (scaffoldMode === 'full') return 0;
  if (scaffoldMode === 'blind') {
    return hesitationMs > 2200 ? 1 : 3;
  }
  if (hesitationMs > 1800) return 0;
  if (hesitationMs > 1200) return Math.min(glyphLevel, 1) as 0 | 1 | 2 | 3;
  return glyphLevel;
}

export function pickAdaptiveEntry(
  entries: GlyphEntry[],
  store: SchemeMasteryStore,
  focusKeys: string[] | null,
  excludeIds: Set<string>,
  maxTier: 1 | 2 | 3,
  trainingScope: TrainingScope = 'all'
): GlyphEntry {
  let scoped = entries;
  if (trainingScope !== 'all') {
    const byKind = entries.filter((e) => e.kind === trainingScope);
    if (byKind.length > 0) scoped = byKind;
  }

  let pool = scoped.filter((e) => (trainingScope !== 'all' || e.tier <= maxTier) && !excludeIds.has(e.id));
  if (pool.length === 0) {
    pool = scoped.filter((e) => trainingScope !== 'all' || e.tier <= maxTier);
  }
  if (pool.length === 0) {
    pool = scoped;
  }

  if (focusKeys && focusKeys.length > 0) {
    // Match either chamberKey (palace focus) or code prefix/containment
    const focused = pool.filter(
      (e) =>
        (e.palace && focusKeys.includes(e.palace.chamberKey)) ||
        focusKeys.some((fk) => e.code.startsWith(fk)) ||
        focusKeys.some((fk) => e.code.includes(fk))
    );
    if (focused.length > 0) {
      pool = focused;
    }
  }

  const weights = pool.map((entry) => {
    const gm = store.glyphs[entry.id];
    const lvlWeight = gm ? (4 - gm.level) * 1.6 : 5.5;
    let keyLatencyBoost = 1;
    for (const ch of entry.code) {
      const ks = store.keys[ch];
      if (ks && ks.emaLatencyMs > 520) keyLatencyBoost += 0.8;
      if (ks && ks.errors > 0) keyLatencyBoost += 0.6;
    }
    return lvlWeight * keyLatencyBoost;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function getMasterySummary(
  scheme: ShapeCodeScheme,
  store: SchemeMasteryStore,
  scriptMode: ScriptMode = 'both'
): {
  masteredCount: number;
  learningCount: number;
  totalEntries: number;
  avgKeyMs: number;
} {
  let masteredCount = 0;
  let learningCount = 0;
  let totalEntries = 0;
  for (const e of scheme.entries) {
    if (!matchesScript(e.script, scriptMode)) continue;
    totalEntries++;
    const g = store.glyphs[e.id];
    if (!g) continue;
    if (g.level >= 2) masteredCount++;
    else if (g.level === 1) learningCount++;
  }
  const practicedKeys = Object.values(store.keys).filter((k) => k.attempts > 0);
  const avgKeyMs =
    practicedKeys.length > 0
      ? Math.round(
          practicedKeys.reduce((acc, k) => acc + k.emaLatencyMs, 0) / practicedKeys.length
        )
      : 0;
  return {
    masteredCount,
    learningCount,
    totalEntries,
    avgKeyMs,
  };
}

export const SLOW_POOL_GRADUATE_STREAK = 3;

export function recordSlowPoolOutcome(
  store: SchemeMasteryStore,
  params: {
    char: string;
    parts: string[];
    code: string;
    latencyMs: number;
    hadError: boolean;
    thresholdMs: number;
  }
): {
  nextStore: SchemeMasteryStore;
  status: 'clean' | 'slow' | 'error';
  graduated: boolean;
} {
  const { char, parts, code, latencyMs, hadError, thresholdMs } = params;
  const prevPool = store.slowGlyphs || {};
  const existing = prevPool[char];
  const isSlow = latencyMs > thresholdMs;

  if (hadError || isSlow) {
    const nextRec: SlowGlyphRecord = {
      char,
      parts,
      code,
      lastLatencyMs: Math.round(latencyMs),
      hesitationCount: (existing?.hesitationCount || 0) + (isSlow ? 1 : 0),
      errorCount: (existing?.errorCount || 0) + (hadError ? 1 : 0),
      fastCleanStreak: 0,
      reason: hadError ? 'error' : 'slow',
      updatedAt: Date.now(),
    };
    return {
      status: hadError ? 'error' : 'slow',
      graduated: false,
      nextStore: {
        ...store,
        slowGlyphs: {
          ...prevPool,
          [char]: nextRec,
        },
      },
    };
  }

  // Fast and error-free
  if (existing) {
    const nextStreak = existing.fastCleanStreak + 1;
    if (nextStreak >= SLOW_POOL_GRADUATE_STREAK) {
      const nextPool = { ...prevPool };
      delete nextPool[char];
      return {
        status: 'clean',
        graduated: true,
        nextStore: {
          ...store,
          slowGlyphs: nextPool,
        },
      };
    }
    return {
      status: 'clean',
      graduated: false,
      nextStore: {
        ...store,
        slowGlyphs: {
          ...prevPool,
          [char]: {
            ...existing,
            lastLatencyMs: Math.round(latencyMs),
            fastCleanStreak: nextStreak,
            updatedAt: Date.now(),
          },
        },
      },
    };
  }

  return {
    status: 'clean',
    graduated: false,
    nextStore: store,
  };
}

