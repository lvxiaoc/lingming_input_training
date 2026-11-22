import {
  CodeRole,
  encodeLingmingRoots,
  getLingmingCharScript,
  getLingmingRadicalScript,
  LINGMING_CHAMBERS,
  LINGMING_CHAR_SPLITS,
  LINGMING_ROOT_MAP,
} from './lingming';
import { GlyphEntry, ShapeCodeScheme } from './schemes';
import { matchesScript, ScriptMode } from './scriptFilter';
import { XRAY_HANZI_ENTRIES, XrayHanziEntry } from './xrayHanziData';
import { pickAdaptiveEntry, ScaffoldMode, SchemeMasteryStore } from '../engine/mastery';

export type CampaignStageKind =
  | 'primary_roots'
  | 'primary_hanzi'
  | 'palace_tier'
  | 'hanzi_radical_xray'
  | 'full_char_flow'
  | 'word_flow'
  | 'arcade_flow';

export interface CampaignStage {
  id: string;
  chapterId: 1 | 2 | 3 | 4 | 5;
  indexLabel: string;
  title: string;
  subtitle: string;
  kind: CampaignStageKind;
  isBossTrial: boolean;
  targetGoal: number;
  mode: 'reflex' | 'arcade';
  defaultScaffold: ScaffoldMode;
  threeStarAccuracy: number;
  threeStarAvgMs: number;
  twoStarAccuracy: number;
}

export interface CampaignChapter {
  id: 1 | 2 | 3 | 4 | 5;
  shortTitle: string;
  title: string;
  sceneName: string;
  cognitiveGoal: string;
  barrierResolved: string;
  reflexTarget: string;
  stages: CampaignStage[];
}

export interface StageProgressRecord {
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  bestAccuracy: number;
  bestAvgMs: number;
  attempts: number;
  clearedAt?: number;
}

export interface ChamberPassRecord {
  clears: number;
  bestAccuracy: number;
  bestAvgMs: number;
  blindCleared: boolean;
}

export interface CampaignProgressStore {
  stages: Record<string, StageProgressRecord>;
  chambers: Record<string, ChamberPassRecord>;
}

export interface DojoRankInfo {
  title: string;
  minStars: number;
  nextTitle?: string;
  nextMinStars?: number;
}

export const DOJO_RANKS: DojoRankInfo[] = [
  { title: '初墨', minStars: 0, nextTitle: '立柱', nextMinStars: 6 },
  { title: '立柱', minStars: 6, nextTitle: '解構', nextMinStars: 15 },
  { title: '解構', minStars: 15, nextTitle: '入殿', nextMinStars: 27 },
  { title: '入殿', minStars: 27, nextTitle: '點睛', nextMinStars: 40 },
  { title: '點睛', minStars: 40, nextTitle: '墨鍵宗師', nextMinStars: 52 },
  { title: '墨鍵宗師', minStars: 52 },
];

export const CAMPAIGN_CHAPTERS: CampaignChapter[] = [
  {
    id: 1,
    shortTitle: '立柱',
    title: '第一關 · 立柱・二十主根',
    sceneName: '初墨定盤',
    cognitiveGoal: '以 20 個核心主根錨定輔音鍵位空間，同步熟練大碼＋韻腹收尾全碼手感。',
    barrierResolved: '第一難關：鍵位空間錨點（克服 25 鍵無意識尋找）',
    reflexTarget: '主根骨架形狀 → 手指指區與完整字根碼反射',
    stages: [
      {
        id: '1-1',
        chapterId: 1,
        indexLabel: '1-1',
        title: '中排基準（8 主根）',
        subtitle: '土 口 一 厶 日 亻 白 月 — 雙手歸位行，直接輸入完整字根碼',
        kind: 'primary_roots',
        isBossTrial: false,
        targetGoal: 16,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 650,
        twoStarAccuracy: 86,
      },
      {
        id: '1-2',
        chapterId: 1,
        indexLabel: '1-2',
        title: '上排領銜（6 主根）',
        subtitle: '又 辶 二 丶 大 勹 — 伸指區六大主根全碼定盤',
        kind: 'primary_roots',
        isBossTrial: false,
        targetGoal: 12,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 650,
        twoStarAccuracy: 86,
      },
      {
        id: '1-3',
        chapterId: 1,
        indexLabel: '1-3',
        title: '下排沉底（6 主根）',
        subtitle: '木 丷 水 冖 人 𠂇 — 下排斜移區六主根全碼定盤',
        kind: 'primary_roots',
        isBossTrial: false,
        targetGoal: 12,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 650,
        twoStarAccuracy: 86,
      },
      {
        id: '1-boss',
        chapterId: 1,
        indexLabel: '檢定戰',
        title: '二十宮立柱試',
        subtitle: '20 主根全盤巡迴 24 題 · 限 3 枚墨心印容錯',
        kind: 'primary_roots',
        isBossTrial: true,
        targetGoal: 24,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 95,
        threeStarAvgMs: 580,
        twoStarAccuracy: 88,
      },
    ],
  },
  {
    id: 2,
    shortTitle: '拆骨',
    title: '第二關 · 拆骨・主根組字',
    sceneName: '折竹解構',
    cognitiveGoal: '100% 僅用第一關 20 個主根拼寫真實漢字，零新字根負擔下掌握拆字與取碼順序。',
    barrierResolved: '第二難關：漢字結構切分（從看整圖轉為按筆順拆骨）',
    reflexTarget: '主根組合漢字 → 依序切分並輸出靈明單字碼',
    stages: [
      {
        id: '2-1',
        chapterId: 2,
        indexLabel: '2-1',
        title: '雙根成字',
        subtitle: '明 林 休 友 右 有 泉 柏 等 2 部件純主根真實漢字',
        kind: 'primary_hanzi',
        isBossTrial: false,
        targetGoal: 20,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 680,
        twoStarAccuracy: 85,
      },
      {
        id: '2-2',
        chapterId: 2,
        indexLabel: '2-2',
        title: '三根與疊字',
        subtitle: '森 晶 品 速 坐 的 倡 保 等三部件取碼節奏',
        kind: 'primary_hanzi',
        isBossTrial: false,
        targetGoal: 18,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 680,
        twoStarAccuracy: 85,
      },
      {
        id: '2-3',
        chapterId: 2,
        indexLabel: '2-3',
        title: '繁構與大根免三',
        subtitle: '體會「一二三末、大根免三」：含 大 日 二 白 𠂇 與四根字',
        kind: 'primary_hanzi',
        isBossTrial: false,
        targetGoal: 18,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 660,
        twoStarAccuracy: 85,
      },
      {
        id: '2-boss',
        chapterId: 2,
        indexLabel: '檢定戰',
        title: '初字連斬試',
        subtitle: '25 字主根組字混編連打 · 限 3 枚墨心印容錯',
        kind: 'primary_hanzi',
        isBossTrial: true,
        targetGoal: 25,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 95,
        threeStarAvgMs: 600,
        twoStarAccuracy: 88,
      },
    ],
  },
  {
    id: 3,
    shortTitle: '築宮',
    title: '第三關 · 築宮・全根入殿',
    sceneName: '記憶宮殿',
    cognitiveGoal: '先逐鍵巡禮 20 座單鍵記憶宮殿建立一鍵一宮肌肉反射，再跨鍵依頻率由內向外混測所選繁簡字集字根。',
    barrierResolved: '第三難關：宮殿擴張自動化（消除從主根轉譯的二段思考）',
    reflexTarget: '逐鍵字根宮殿單練 → 跨鍵 1:1 宮殿位置重合直擊',
    stages: [
      {
        id: '3-1',
        chapterId: 3,
        indexLabel: '3-1',
        title: '高頻殿堂（第 2–5 順位）',
        subtitle: '覆蓋日常最常出現的核心延伸字根',
        kind: 'palace_tier',
        isBossTrial: false,
        targetGoal: 28,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 93,
        threeStarAvgMs: 640,
        twoStarAccuracy: 84,
      },
      {
        id: '3-2',
        chapterId: 3,
        indexLabel: '3-2',
        title: '中頻迴廊（第 6–9 順位）',
        subtitle: '熟練中頻字根與常用偏旁的聲韻搭配',
        kind: 'palace_tier',
        isBossTrial: false,
        targetGoal: 26,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 93,
        threeStarAvgMs: 650,
        twoStarAccuracy: 84,
      },
      {
        id: '3-3',
        chapterId: 3,
        indexLabel: '3-3',
        title: '全殿巡禮（外圍與變體）',
        subtitle: '補齊第 10 順位以下字根與邊角變體，不留盲區',
        kind: 'palace_tier',
        isBossTrial: false,
        targetGoal: 26,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 92,
        threeStarAvgMs: 660,
        twoStarAccuracy: 84,
      },
      {
        id: '3-boss',
        chapterId: 3,
        indexLabel: '檢定戰',
        title: '百根巡殿試',
        subtitle: '30 題全宮殿混測（自動加權個人弱鍵）· 限 3 枚墨心印',
        kind: 'palace_tier',
        isBossTrial: true,
        targetGoal: 30,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 580,
        twoStarAccuracy: 86,
      },
    ],
  },
  {
    id: 4,
    shortTitle: '點睛',
    title: '第四關 · 點睛・字中辨根',
    sceneName: '墨脈透視',
    cognitiveGoal: '整字淡墨呈現並精準點亮目標部件真實筆畫，無須管整字規則，專訓字形內的部件剝離與字根全碼直覺。',
    barrierResolved: '第四難關：語境視覺剝離（克服字根被壓扁／包圍後的失認）',
    reflexTarget: '整字中的高亮變形部件 → 對應字根全碼 ＋ 1:1 宮殿回響',
    stages: [
      {
        id: '4-1',
        chapterId: 4,
        indexLabel: '4-1',
        title: '偏旁顯形',
        subtitle: '左右與上下結構中點亮常見偏旁（僅輸入高亮部件全碼）',
        kind: 'hanzi_radical_xray',
        isBossTrial: false,
        targetGoal: 22,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 650,
        twoStarAccuracy: 85,
      },
      {
        id: '4-2',
        chapterId: 4,
        indexLabel: '4-2',
        title: '藏鋒剝離',
        subtitle: '包圍、穿插與壓扁變形字根（艹 囗 辶 疒 穴 攵 等）透視辨認',
        kind: 'hanzi_radical_xray',
        isBossTrial: false,
        targetGoal: 24,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 93,
        threeStarAvgMs: 660,
        twoStarAccuracy: 85,
      },
      {
        id: '4-3',
        chapterId: 4,
        indexLabel: '4-3',
        title: '筆順連點（進階）',
        subtitle: '同字依筆順逐一接力點亮各部件，連打整字內所有字根全碼',
        kind: 'hanzi_radical_xray',
        isBossTrial: false,
        targetGoal: 22,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 640,
        twoStarAccuracy: 86,
      },
      {
        id: '4-boss',
        chapterId: 4,
        indexLabel: '檢定戰',
        title: '透視辨根試',
        subtitle: '28 題偏旁、藏鋒與筆順連點混合挑戰 · 限 3 枚墨心印',
        kind: 'hanzi_radical_xray',
        isBossTrial: true,
        targetGoal: 28,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 95,
        threeStarAvgMs: 590,
        twoStarAccuracy: 87,
      },
    ],
  },
  {
    id: 5,
    shortTitle: '化境',
    title: '第五關 · 化境・整字實戰',
    sceneName: '行雲流水',
    cognitiveGoal: '將拆字規則、全字根反射與字中辨根融會貫通，實現單字、詞組與節奏盲打自動化組塊。',
    barrierResolved: '第五難關：動作組塊化（整字多鍵連擊無需逐根停頓）',
    reflexTarget: '完整漢字與雙字詞 → 一氣呵成盲打輸入流',
    stages: [
      {
        id: '5-1',
        chapterId: 5,
        indexLabel: '5-1',
        title: '百字初試',
        subtitle: '全字根覆蓋常用靈明單字靜心實戰',
        kind: 'full_char_flow',
        isBossTrial: false,
        targetGoal: 28,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 600,
        twoStarAccuracy: 86,
      },
      {
        id: '5-2',
        chapterId: 5,
        indexLabel: '5-2',
        title: '詞韻連打',
        subtitle: '常用雙字詞組連貫推進，消除字間思索停頓',
        kind: 'word_flow',
        isBossTrial: false,
        targetGoal: 28,
        mode: 'reflex',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 560,
        twoStarAccuracy: 86,
      },
      {
        id: '5-3',
        chapterId: 5,
        indexLabel: '5-3',
        title: '疾風落字',
        subtitle: '60fps 動態節奏演練，提升抗壓反應速度',
        kind: 'arcade_flow',
        isBossTrial: false,
        targetGoal: 28,
        mode: 'arcade',
        defaultScaffold: 'adaptive',
        threeStarAccuracy: 94,
        threeStarAvgMs: 550,
        twoStarAccuracy: 86,
      },
      {
        id: '5-boss',
        chapterId: 5,
        indexLabel: '檢定戰',
        title: '墨鍵宗師試',
        subtitle: '36 字盲打終極檢定 · 限 3 枚墨心印，通過即證宗師段位',
        kind: 'full_char_flow',
        isBossTrial: true,
        targetGoal: 36,
        mode: 'reflex',
        defaultScaffold: 'blind',
        threeStarAccuracy: 95,
        threeStarAvgMs: 500,
        twoStarAccuracy: 88,
      },
    ],
  },
];

export const CAMPAIGN_STAGE_BY_ID: Record<string, CampaignStage> = Object.fromEntries(
  CAMPAIGN_CHAPTERS.flatMap((ch) => ch.stages.map((s) => [s.id, s]))
);

export const ALL_CAMPAIGN_STAGES: CampaignStage[] = CAMPAIGN_CHAPTERS.flatMap((ch) => ch.stages);

export function getNextCampaignStage(stageId: string): CampaignStage | null {
  const idx = ALL_CAMPAIGN_STAGES.findIndex((s) => s.id === stageId);
  if (idx < 0 || idx + 1 >= ALL_CAMPAIGN_STAGES.length) return null;
  return ALL_CAMPAIGN_STAGES[idx + 1];
}

// ==================== Progress & Stars Persistence ====================

const CAMPAIGN_STORAGE_KEY = 'inkkey_campaign_v1';

export const PALACE_ROW_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: '中排歸位行（8 宮殿）', keys: ['s', 'd', 'f', 'g', 'h', 'j', 'k', 'l'] },
  { label: '上排伸指行（6 宮殿）', keys: ['q', 'w', 'r', 't', 'y', 'p'] },
  { label: '下排斜移行（6 宮殿）', keys: ['x', 'c', 'v', 'b', 'n', 'm'] },
];

export const PALACE_GUIDED_KEYS: string[] = PALACE_ROW_GROUPS.flatMap((g) => g.keys);

export function getNextUnclearPalaceKey(
  chambers: Record<string, ChamberPassRecord>
): string {
  for (const k of PALACE_GUIDED_KEYS) {
    if ((chambers[k]?.clears ?? 0) === 0) return k;
  }
  return PALACE_GUIDED_KEYS[0];
}

export function loadCampaignProgress(): CampaignProgressStore {
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return { stages: {}, chambers: {} };
    const parsed = JSON.parse(raw) as Partial<CampaignProgressStore>;
    return {
      stages: parsed.stages || {},
      chambers: parsed.chambers || {},
    };
  } catch {
    return { stages: {}, chambers: {} };
  }
}

export function saveCampaignProgress(store: CampaignProgressStore): void {
  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

export function computeStageStars(
  stage: CampaignStage,
  accuracy: number,
  avgKeyMs: number,
  passed: boolean
): 0 | 1 | 2 | 3 {
  if (!passed) return 0;
  if (
    accuracy >= stage.threeStarAccuracy &&
    (avgKeyMs <= 0 || avgKeyMs <= stage.threeStarAvgMs)
  ) {
    return 3;
  }
  if (accuracy >= stage.twoStarAccuracy) {
    return 2;
  }
  return 1;
}

export function recordCampaignStageResult(
  store: CampaignProgressStore,
  stage: CampaignStage,
  score: number,
  accuracy: number,
  avgKeyMs: number,
  passed: boolean
): { nextStore: CampaignProgressStore; earnedStars: 0 | 1 | 2 | 3; isNewRecord: boolean } {
  const earnedStars = computeStageStars(stage, accuracy, avgKeyMs, passed);
  const prev = store.stages[stage.id];
  const nextStars = Math.max(prev?.stars ?? 0, earnedStars) as 0 | 1 | 2 | 3;
  const bestScore = Math.max(prev?.bestScore ?? 0, score);
  const bestAccuracy = Math.max(prev?.bestAccuracy ?? 0, accuracy);
  const bestAvgMs =
    avgKeyMs > 0
      ? prev?.bestAvgMs && prev.bestAvgMs > 0
        ? Math.min(prev.bestAvgMs, avgKeyMs)
        : avgKeyMs
      : prev?.bestAvgMs ?? 0;

  const isNewRecord = earnedStars > (prev?.stars ?? 0) || score > (prev?.bestScore ?? 0);

  const nextStore: CampaignProgressStore = {
    stages: {
      ...store.stages,
      [stage.id]: {
        stars: nextStars,
        bestScore,
        bestAccuracy,
        bestAvgMs,
        attempts: (prev?.attempts ?? 0) + 1,
        clearedAt: passed ? Date.now() : prev?.clearedAt,
      },
    },
    chambers: store.chambers || {},
  };

  saveCampaignProgress(nextStore);
  return { nextStore, earnedStars, isNewRecord };
}

export function recordChamberPass(
  store: CampaignProgressStore,
  chamberKey: string,
  accuracy: number,
  avgKeyMs: number,
  blindCleared: boolean
): CampaignProgressStore {
  const k = chamberKey.toLowerCase();
  const prev = store.chambers?.[k];
  const nextAvg =
    avgKeyMs > 0
      ? prev?.bestAvgMs && prev.bestAvgMs > 0
        ? Math.min(prev.bestAvgMs, avgKeyMs)
        : avgKeyMs
      : prev?.bestAvgMs ?? 0;

  const nextStore: CampaignProgressStore = {
    stages: store.stages || {},
    chambers: {
      ...(store.chambers || {}),
      [k]: {
        clears: (prev?.clears ?? 0) + 1,
        bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
        bestAvgMs: nextAvg,
        blindCleared: Boolean(prev?.blindCleared || blindCleared),
      },
    },
  };

  saveCampaignProgress(nextStore);
  return nextStore;
}

export function getDojoRank(totalStars: number, boss5Cleared: boolean): DojoRankInfo {
  if (boss5Cleared && totalStars >= 52) {
    return DOJO_RANKS[DOJO_RANKS.length - 1];
  }
  let current = DOJO_RANKS[0];
  for (const r of DOJO_RANKS) {
    if (r.title === '墨鍵宗師' && !boss5Cleared) continue;
    if (totalStars >= r.minStars) {
      current = r;
    }
  }
  return current;
}

export function getCampaignSummary(store: CampaignProgressStore): {
  totalStars: number;
  maxStars: number;
  clearedCount: number;
  totalStages: number;
  rank: DojoRankInfo;
  nextRecommendedStage: CampaignStage;
} {
  let totalStars = 0;
  let clearedCount = 0;
  let nextRecommendedStage = ALL_CAMPAIGN_STAGES[0];
  let foundUncleared = false;

  for (const st of ALL_CAMPAIGN_STAGES) {
    const rec = store.stages[st.id];
    const stars = rec?.stars ?? 0;
    totalStars += stars;
    if (stars > 0) {
      clearedCount++;
    } else if (!foundUncleared) {
      nextRecommendedStage = st;
      foundUncleared = true;
    }
  }

  const maxStars = ALL_CAMPAIGN_STAGES.length * 3;
  const boss5Cleared = (store.stages['5-boss']?.stars ?? 0) > 0;
  const rank = getDojoRank(totalStars, boss5Cleared);

  return {
    totalStars,
    maxStars,
    clearedCount,
    totalStages: ALL_CAMPAIGN_STAGES.length,
    rank,
    nextRecommendedStage,
  };
}

// ==================== Deck Builders for All 5 Chapters ====================

const HOME_ROW_KEYS = ['s', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const TOP_ROW_KEYS = ['q', 'w', 'r', 't', 'y', 'p'];
const BOT_ROW_KEYS = ['x', 'c', 'v', 'b', 'n', 'm'];

export const PRIMARY_ANCHOR_CHARS = new Set(LINGMING_CHAMBERS.map((c) => c.primaryAnchor));
const BIG_ROOT_PRIMARIES = new Set(['二', '大', '日', '白', '𠂇']);

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Repeats and shuffles items to hit exact targetCount while preventing the same char back-to-back.
 */
function buildNonAdjacentDeck(pool: GlyphEntry[], targetCount: number, tag: string): GlyphEntry[] {
  if (pool.length === 0) return [];
  const raw: GlyphEntry[] = [];
  while (raw.length < targetCount) {
    const batch = shuffleArray(pool);
    for (const item of batch) {
      if (raw.length >= targetCount) break;
      raw.push(item);
    }
  }
  // Smooth out any accidental adjacent duplicates across batch boundaries
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].char === raw[i - 1].char && raw.length > 2) {
      const swapIdx = (i + 2) % raw.length;
      [raw[i], raw[swapIdx]] = [raw[swapIdx], raw[i]];
    }
  }
  return raw.map((item, idx) => ({
    ...item,
    id: `cmp_${tag}_${idx}_${item.char}`,
  }));
}

function buildXrayGlyphEntry(
  hanzi: XrayHanziEntry,
  targetIdx: number,
  completedIndices: number[],
  seq: number,
  totalStepsInChain?: number
): GlyphEntry | null {
  const spec = hanzi.targets[targetIdx];
  if (!spec) return null;
  const info = LINGMING_ROOT_MAP.get(spec.radical);
  if (!info) return null;
  const roles: CodeRole[] = info.isXiao ? ['da', 'yun'] : ['da', 'sheng', 'yun'];
  return {
    id: `xray_${hanzi.char}_${targetIdx}_${seq}`,
    char: hanzi.char,
    code: info.ma,
    parts: [
      `部件「${spec.radical}」`,
      info.isXiao ? `小根 · ${info.ma.toUpperCase()}` : `大根 · ${info.ma.toUpperCase()}`,
    ],
    tier: 2,
    kind: 'root',
    script: getLingmingCharScript(hanzi.char),
    roles,
    palace: {
      chamberKey: info.chamberKey,
      anchorChar: info.anchor,
      clusterLabel: info.clusterLabel,
      siblings: info.siblings,
      isXiao: info.isXiao,
      note: info.note,
    },
    xray: {
      hanziChar: hanzi.char,
      strokes: hanzi.strokes,
      activeIndices: spec.strokeIndices,
      completedIndices,
      radicalChar: spec.radical,
      stepIndex: totalStepsInChain ? targetIdx + 1 : undefined,
      totalSteps: totalStepsInChain,
    },
  };
}

const WORD_PAIR_LIST: Array<[string, string]> = [
  ['明', '天'],
  ['好', '友'],
  ['森', '林'],
  ['花', '草'],
  ['天', '空'],
  ['空', '间'],
  ['安', '心'],
  ['时', '间'],
  ['中', '国'],
  ['秋', '冬'],
  ['光', '明'],
  ['鲜', '花'],
  ['放', '心'],
  ['红', '花'],
  ['认', '字'],
  ['打', '字'],
  ['码', '字'],
  ['问', '好'],
  ['星', '空'],
  ['草', '木'],
  ['冬', '夏'],
  ['音', '乐'],
  ['思', '想'],
  ['知', '心'],
  ['意', '思'],
  ['山', '岩'],
  ['日', '月'],
  ['山', '水'],
  ['白', '云'],
  ['明', '白'],
  ['早', '安'],
  ['好', '人'],
  ['大', '笑'],
  // 繁體／通用詞組補充
  ['時', '間'],
  ['問', '好'],
  ['鮮', '花'],
  ['紅', '花'],
  ['開', '門'],
  ['雲', '雪'],
  ['風', '雷'],
  ['銀', '針'],
  ['話', '音'],
  ['順', '心'],
  ['白', '雲'],
  ['星', '雲'],
  ['軍', '馬'],
  ['車', '馬'],
  ['雷', '鳴'],
  ['閃', '光'],
  ['飲', '水'],
  ['香', '茶'],
  ['古', '今'],
  ['仁', '心'],
  ['忠', '信'],
  ['保', '安'],
];

export function buildCampaignStageDeck(
  stage: CampaignStage,
  scheme: ShapeCodeScheme,
  mastery: SchemeMasteryStore,
  scriptMode: ScriptMode = 'trad'
): GlyphEntry[] {
  const rootEntries = scheme.entries.filter(
    (e) =>
      e.kind === 'root' &&
      matchesScript(
        e.script ?? getLingmingRadicalScript(e.char, e.palace?.chamberKey, e.code),
        scriptMode
      )
  );
  const charEntries = scheme.entries.filter(
    (e) =>
      e.kind === 'char' &&
      matchesScript(e.script ?? getLingmingCharScript(e.char), scriptMode)
  );
  // 第 1 關 20 主根皆為繁簡共用字根
  const primaryRootEntries = rootEntries.filter(
    (e) => e.palace && PRIMARY_ANCHOR_CHARS.has(e.char)
  );

  // ---------- Chapter 1: 20 Primary Anchors (Full Code) ----------
  if (stage.kind === 'primary_roots') {
    let subset = primaryRootEntries;
    if (stage.id === '1-1') {
      subset = primaryRootEntries.filter((e) => HOME_ROW_KEYS.includes(e.palace!.chamberKey));
    } else if (stage.id === '1-2') {
      subset = primaryRootEntries.filter((e) => TOP_ROW_KEYS.includes(e.palace!.chamberKey));
    } else if (stage.id === '1-3') {
      subset = primaryRootEntries.filter((e) => BOT_ROW_KEYS.includes(e.palace!.chamberKey));
    }
    return buildNonAdjacentDeck(subset, stage.targetGoal, stage.id);
  }

  // ---------- Chapter 2: Pure Primary-Root Real Hanzi (filtered by scriptMode) ----------
  if (stage.kind === 'primary_hanzi') {
    const pureChars = charEntries.filter((e) =>
      e.parts.every((r) => PRIMARY_ANCHOR_CHARS.has(r))
    );
    let subset = pureChars;
    if (stage.id === '2-1') {
      subset = pureChars.filter((e) => e.parts.length === 2);
    } else if (stage.id === '2-2') {
      subset = pureChars.filter((e) => e.parts.length === 3);
    } else if (stage.id === '2-3') {
      const tricky = pureChars.filter(
        (e) => e.parts.length >= 4 || e.parts.some((r) => BIG_ROOT_PRIMARIES.has(r))
      );
      subset = tricky.length >= 10 ? tricky : pureChars;
    }
    return buildNonAdjacentDeck(subset, stage.targetGoal, stage.id);
  }

  // ---------- Chapter 3: Full Memory Palace Tiers (filtered by scriptMode) ----------
  if (stage.kind === 'palace_tier') {
    const nonPrimary = rootEntries.filter((e) => !PRIMARY_ANCHOR_CHARS.has(e.char));
    if (stage.id === '3-boss') {
      const deck: GlyphEntry[] = [];
      const used = new Set<string>();
      for (let i = 0; i < stage.targetGoal; i++) {
        const picked = pickAdaptiveEntry(nonPrimary, mastery, null, used, 3, 'root');
        used.add(picked.id);
        if (used.size >= Math.min(nonPrimary.length, 24)) used.clear();
        deck.push({ ...picked, id: `cmp_3boss_${i}_${picked.char}` });
      }
      return deck;
    }

    const subset = nonPrimary.filter((e) => {
      const rank = LINGMING_ROOT_MAP.get(e.char)?.rank ?? 10;
      if (stage.id === '3-1') return rank >= 2 && rank <= 5;
      if (stage.id === '3-2') return rank >= 6 && rank <= 9;
      return rank >= 10;
    });
    return buildNonAdjacentDeck(subset.length > 0 ? subset : nonPrimary, stage.targetGoal, stage.id);
  }

  // ---------- Chapter 4: Hanzi Internal Radical X-Ray (filtered by scriptMode) ----------
  if (stage.kind === 'hanzi_radical_xray') {
    const xrayPool = XRAY_HANZI_ENTRIES.filter((h) =>
      matchesScript(getLingmingCharScript(h.char), scriptMode)
    );
    const deck: GlyphEntry[] = [];
    let seq = 0;

    if (stage.id === '4-1' || stage.id === '4-2') {
      const targetStage = stage.id as '4-1' | '4-2';
      const candidates: GlyphEntry[] = [];
      for (const h of shuffleArray(xrayPool)) {
        const matchingIndices = h.targets
          .map((t, idx) => ({ t, idx }))
          .filter((x) => x.t.stage === targetStage);
        if (matchingIndices.length === 0) continue;
        for (const m of matchingIndices) {
          const entry = buildXrayGlyphEntry(h, m.idx, [], seq++);
          if (entry) candidates.push(entry);
        }
      }
      return buildNonAdjacentDeck(candidates, stage.targetGoal, stage.id);
    }

    if (stage.id === '4-3') {
      const chainChars = shuffleArray(
        xrayPool.filter((h) => h.fullChain && h.targets.length >= 2)
      );
      for (const h of chainChars) {
        if (deck.length >= stage.targetGoal) break;
        let completed: number[] = [];
        for (let idx = 0; idx < h.targets.length; idx++) {
          const entry = buildXrayGlyphEntry(h, idx, [...completed], seq++, h.targets.length);
          if (entry) deck.push(entry);
          completed = [...completed, ...h.targets[idx].strokeIndices];
        }
      }
      return deck;
    }

    // 4-boss: Mix of single X-ray challenges + 4 sequential chained Hanzi
    const chainPool = shuffleArray(
      xrayPool.filter((h) => h.fullChain && h.targets.length >= 2)
    ).slice(0, 4);
    for (const h of chainPool) {
      let completed: number[] = [];
      for (let idx = 0; idx < h.targets.length; idx++) {
        const entry = buildXrayGlyphEntry(h, idx, [...completed], seq++, h.targets.length);
        if (entry) deck.push(entry);
        completed = [...completed, ...h.targets[idx].strokeIndices];
      }
    }
    const singlePool: GlyphEntry[] = [];
    for (const h of xrayPool) {
      for (let idx = 0; idx < h.targets.length; idx++) {
        const entry = buildXrayGlyphEntry(h, idx, [], seq++);
        if (entry) singlePool.push(entry);
      }
    }
    const remaining = Math.max(0, stage.targetGoal - deck.length);
    const fill = buildNonAdjacentDeck(singlePool, remaining, '4boss_single');
    return [...fill, ...deck].slice(0, stage.targetGoal);
  }

  // ---------- Chapter 5: Full-Char & Word Flow (filtered by scriptMode) ----------
  if (stage.kind === 'word_flow') {
    const charByGlyph = new Map<string, GlyphEntry>();
    for (const ce of charEntries) {
      if (!charByGlyph.has(ce.char)) charByGlyph.set(ce.char, ce);
    }
    const resolveCharEntry = (ch: string): GlyphEntry | null => {
      if (!matchesScript(getLingmingCharScript(ch), scriptMode)) return null;
      const existing = charByGlyph.get(ch);
      if (existing) return existing;
      const rootInfo = LINGMING_ROOT_MAP.get(ch);
      if (rootInfo) {
        const enc = encodeLingmingRoots([ch]);
        return {
          id: `word_root_${ch}`,
          char: ch,
          code: enc.code,
          parts: [ch],
          tier: 3,
          kind: 'char',
          script: getLingmingCharScript(ch),
          roles: enc.roles,
        };
      }
      return null;
    };

    const validPairs = shuffleArray(
      WORD_PAIR_LIST.filter(([a, b]) => resolveCharEntry(a) && resolveCharEntry(b))
    );
    const deck: GlyphEntry[] = [];
    let seq = 0;
    for (const [a, b] of validPairs) {
      if (deck.length + 2 > stage.targetGoal) break;
      const ea = resolveCharEntry(a)!;
      const eb = resolveCharEntry(b)!;
      const pairStr = `${a}${b}`;
      deck.push({
        ...ea,
        id: `cmp_word_${seq++}_${a}`,
        wordPair: pairStr,
        wordCharIdx: 0,
      });
      deck.push({
        ...eb,
        id: `cmp_word_${seq++}_${b}`,
        wordPair: pairStr,
        wordCharIdx: 1,
      });
    }
    return deck;
  }

  if (stage.kind === 'full_char_flow') {
    if (stage.id === '5-boss') {
      const deck: GlyphEntry[] = [];
      const used = new Set<string>();
      for (let i = 0; i < stage.targetGoal; i++) {
        const picked = pickAdaptiveEntry(charEntries, mastery, null, used, 3, 'char');
        used.add(picked.id);
        if (used.size >= Math.min(charEntries.length, 30)) used.clear();
        deck.push({ ...picked, id: `cmp_5boss_${i}_${picked.char}` });
      }
      return deck;
    }
    return buildNonAdjacentDeck(charEntries, stage.targetGoal, stage.id);
  }

  // arcade_flow returns empty so GameCanvas uses arcade spawning with targetGoal & scriptMode
  return [];
}

/**
 * Builds a concise 12-item targeted micro-drill from the weakest entries of a finished round.
 */
export function buildWeakSpotDrillDeck(weakEntries: GlyphEntry[], count = 12): GlyphEntry[] {
  if (weakEntries.length === 0) return [];
  const cleanPool = weakEntries.map((e) => ({
    ...e,
    xray: e.xray
      ? {
          ...e.xray,
          completedIndices: [],
          stepIndex: undefined,
          totalSteps: undefined,
        }
      : undefined,
    wordPair: undefined,
    wordCharIdx: undefined,
  }));
  return buildNonAdjacentDeck(cleanPool, count, 'weak_drill');
}
