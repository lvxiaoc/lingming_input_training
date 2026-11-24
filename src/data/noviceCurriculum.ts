import { GameMode } from '../engine/GameCanvas';
import { ScaffoldMode, TrainingScope } from '../engine/mastery';

export type DrillTabTarget = 'passage' | 'hardsplit' | 'slowhell' | 'bottleneck';
export type ShortCodeTierTarget = 'one' | 'core50' | 'two' | 'three' | 'all';
export type HuangtingFadeTarget = 'adaptive' | 'always' | 'blind';

export type NovicePracticeAction =
  | { kind: 'stage'; stageId: string; label: string }
  | { kind: 'campaign_chapter'; chapterId: 1 | 2 | 3 | 4 | 5; label: string }
  | { kind: 'palace_cloud'; label: string }
  | { kind: 'chamber_drill'; chamberKey: string; blind?: boolean; label: string }
  | {
      kind: 'free_play';
      mode: GameMode;
      scope?: TrainingScope;
      scaffold?: ScaffoldMode;
      label: string;
    }
  | {
      kind: 'drill_studio';
      tab: DrillTabTarget;
      customText?: string;
      openPaste?: boolean;
      label: string;
    }
  | { kind: 'short_code'; tier: ShortCodeTierTarget; label: string }
  | { kind: 'huangting'; fadeMode?: HuangtingFadeTarget; label: string };

export interface RecommendedModuleRef {
  moduleName: string;
  usageTip: string;
  action: NovicePracticeAction;
}

export interface CognitiveLawItem {
  id: string;
  index: string;
  title: string;
  contrastBadge: string;
  mechanism: string;
  antiPattern: string;
  protocol: string;
  reinforcementModules: RecommendedModuleRef[];
}

export interface BarrierRemedyItem {
  id: string;
  number: string;
  title: string;
  symptom: string;
  psychologyCause: string;
  breakthroughMethod: string;
  recommendedModules: RecommendedModuleRef[];
}

export interface DailyLesson {
  day: number;
  phaseId: 1 | 2 | 3 | 4;
  title: string;
  durationMin: number;
  focusSummary: string;
  microRoutine: {
    warmup3m: string;
    core8m: string;
    solidify4m: string;
  };
  passCriteria: string;
  practiceModules: RecommendedModuleRef[];
}

export interface PhaseOverview {
  id: 1 | 2 | 3 | 4;
  dayRange: string;
  title: string;
  subtitle: string;
  milestone: string;
  cumulativeTime: string;
}

export interface ModuleDirectoryCard {
  id: string;
  moduleName: string;
  roleTag: string;
  bestFor: string;
  howToSelfDrill: string;
  recommendedSettings: string;
  launchAction: NovicePracticeAction;
}

export const COGNITIVE_LAWS: CognitiveLawItem[] = [
  {
    id: 'dual-system',
    index: '01',
    title: '三條通路對比：文字口訣(4跳) vs 記憶宮殿(2跳) vs 肌肉反射(1跳)',
    contrastBadge: '宮殿搭橋 → 120–260ms 肌群反射',
    mechanism:
      '傳統口訣走「形 → 默念口訣 → 拆字母 → 找鍵」語言慢路徑（800–1500ms）；記憶宮殿把 200 字根壓成 20 座空間方位圖，走「視覺空間 → 手指座標」短路徑幫你迅速摸準大碼；最終成熟靠小腦／基底核程序記憶（見字直接落指）。宮殿是搭橋腳手架，不是終點。',
    antiPattern: '花幾天死背口訣，或已經熟練到 <350ms 還刻意去回憶宮殿故事反而拖慢節奏。',
    protocol:
      '第 1–5 天藉記憶宮殿快速定位，第 10 分鐘起就以打代背；只要該字延時進入舒適區，讓宮殿自動退場交棒給純肌肉記憶。',
    reinforcementModules: [
      {
        moduleName: '五重道場 · 1-1 中排基準',
        usageTip: '用中排 8 鍵宮殿主根作為空間錨點，直接在打字中建立手指距離感。',
        action: { kind: 'stage', stageId: '1-1', label: '啟動 1-1 中排主根直覺練' },
      },
      {
        moduleName: '自由鍛煉 · 記憶宮殿反射',
        usageTip: '選「僅大碼」開局，先藉重合位宮殿雲圖鎖定每一個部件第 1 鍵起手。',
        action: {
          kind: 'free_play',
          mode: 'reflex',
          scope: 'da',
          scaffold: 'adaptive',
          label: '練大碼空間反射',
        },
      },
    ],
  },
  {
    id: 'desirable-difficulty',
    index: '02',
    title: '消除不確定恐懼與實證漸隱：先穩信心，再靠數據裁決去留',
    contrastBadge: '降焦啟動 ＋ 客觀數據驗證',
    mechanism:
      '新手放棄形碼多半卡在「盲猜 20 鍵會錯、不知為何在這裡」的不確定性恐懼。記憶宮殿給出「順筆畫方位就能推回鍵位」的確定感與心理安全墊；但之後它是否還幫得上忙，不靠猜想，看首頁「7 日 CPM 與反應時延曲線」與漸隱效果客觀驗證。',
    antiPattern: '全程開常駐提示照抄（不敢主動回憶），或未建定位前直接無提示盲敲把隨機錯誤寫進肌肉。',
    protocol:
      '前期用宮殿破除恐懼、壓低錯鍵；中後期啟用「自適應漸隱／猶豫閃顯」，熟鍵自動隱藏，只留給真正卡殼時一閃拉回，連對 3 次徹底撤架。',
    reinforcementModules: [
      {
        moduleName: '文心實戰室 · 極限猶豫閃顯',
        usageTip: '純白盲字先行主動提取，只有猶豫超時或連錯才閃現宮殿與彩拆救援。',
        action: {
          kind: 'drill_studio',
          tab: 'hardsplit',
          label: '進入極限猶豫閃顯',
        },
      },
      {
        moduleName: '簡碼速成 · 核心 50 速成',
        usageTip: '先盲拆嘗試，錯了才立刻顯出構理與定位錨點，建立自信正反饋。',
        action: { kind: 'short_code', tier: 'core50', label: '進簡碼主動提取' },
      },
    ],
  },
  {
    id: 'zero-saccade',
    index: '03',
    title: '零眼動重合位：宮殿退居目標正中，絕不打斷聲韻連打',
    contrastBadge: '省下 200ms／次眼跳',
    mechanism:
      '視線若在目標字與旁側圖表間來回跳動，每次會損失 180–300ms 並打斷拆字緩存。本道場將宮殿雲圖鎖死在目標字重合位，且過濾為「僅大碼首鍵觸發、聲碼／韻碼不顯圖」，既保住空間確定感，又不干擾後續肌肉連招。',
    antiPattern: '一邊低頭偷瞄實體鍵盤，或側頭看紙本字根表邊打字。',
    protocol: '雙手穩放 F/J 凸點後視線鎖死目標字正中；大碼靠重合位雲圖校準信心，後段交由手指韻律完成。',
    reinforcementModules: [
      {
        moduleName: '自由鍛煉 · Alice 景深零掃視',
        usageTip: '目標重合位只在大碼亮出所屬宮殿座標，後續鍵位保持純淨連打。',
        action: {
          kind: 'free_play',
          mode: 'reflex',
          scope: 'root',
          scaffold: 'adaptive',
          label: '開啟景深零掃視練功',
        },
      },
      {
        moduleName: '25 鍵記憶宮殿雲圖',
        usageTip: '在無壓力環境下瀏覽各鍵房主與鄰居方位，先熟悉結構再去實戰檢驗。',
        action: { kind: 'palace_cloud', label: '巡禮 25 鍵宮殿圖' },
      },
    ],
  },
  {
    id: 'pareto-chunking',
    index: '04',
    title: '帕累托頻率集中律與 4±1 工作記憶上限',
    contrastBadge: '20 主根 + 80 高頻根 = 75% 覆蓋',
    mechanism:
      '工作記憶一次只能穩裝 4±1 個新組塊。漢字字根呈典型長尾分佈，先吞下 20 主根骨幹，再吸收第 2–5 順位高頻字根，即刻能覆蓋日常大部分拆字需求。',
    antiPattern: '不區分頻率，把冷僻邊角字根和高頻核心偏旁一起平均死背。',
    protocol: '先立 20 主根骨架，再吃第 2–5 高頻次根；生僻根交給實戰「慢字池」遇一個收一個。',
    reinforcementModules: [
      {
        moduleName: '五重道場 · 第三關築宮',
        usageTip: '嚴格按第 2–5 高頻 → 第 6–9 中頻 → 外圍變體三梯次解鎖。',
        action: { kind: 'campaign_chapter', chapterId: 3, label: '查看築宮分層關卡' },
      },
      {
        moduleName: '五重道場 · 3-1 高頻殿堂',
        usageTip: '只打字頻前 2–5 順位核心延伸字根，投資回報率最高。',
        action: { kind: 'stage', stageId: '3-1', label: '直接刷 3-1 高頻字根' },
      },
    ],
  },
  {
    id: 'motor-rhythm',
    index: '05',
    title: '運動組塊化與勻速節奏效應',
    contrastBadge: '均勻拍點驅動連招打包',
    mechanism:
      '小腦只在節奏平穩且錯誤率低（<5%）時，才會將單鍵「按—看—按」打包為整字「連招組塊」。忽快忽慢與連環誤擊會把猶豫寫進肌纖維。',
    antiPattern: '在正確率低於 90% 時盲目衝極限速度，邊錯邊狂按 Backspace。',
    protocol: '用 85% 舒適速度開「節奏節拍器」，像水滴一樣均勻落指，熟後再抬高速度基準。',
    reinforcementModules: [
      {
        moduleName: '疾風落字 · 節奏動態條＋節拍器',
        usageTip: '跟隨底部無形節拍聲軌，觀察暖黃到冷青的勻速節奏回饋。',
        action: {
          kind: 'free_play',
          mode: 'arcade',
          scope: 'char',
          scaffold: 'adaptive',
          label: '進疾風落字練節奏感',
        },
      },
      {
        moduleName: '黃庭抄經閣 · 靜心誦抄',
        usageTip: '配合 36 章長句流暢輸出，建立穩定呼吸與指節律動。',
        action: { kind: 'huangting', fadeMode: 'adaptive', label: '入黃庭閣練心流韻律' },
      },
    ],
  },
  {
    id: 'sleep-consolidation',
    index: '06',
    title: '睡眠離線鞏固：微劑量高純度勝過疲勞爆肝',
    contrastBadge: '15–20 分鐘／次最佳閾值',
    mechanism:
      '程序性肌肉記憶主要在夜間睡眠期間由腦幹與皮層重放固化。單次超過 25 分鐘後注意疲勞會推高錯鍵率，反而在大腦留下髒記憶。',
    antiPattern: '週末一次連打 3 小時想速成，越打手指越僵、準確率崩盤。',
    protocol: '嚴守早 10 分鐘 + 晚 15 分鐘；感覺手指卡鈍、連錯增多立刻收手休息。',
    reinforcementModules: [
      {
        moduleName: '文心實戰室 · 慢字／錯字池',
        usageTip: '隔天睡醒花 3 分鐘清完昨日慢字池，複利極大化。',
        action: { kind: 'drill_studio', tab: 'slowhell', label: '清空慢字池暖手' },
      },
      {
        moduleName: '自由鍛煉 · 弱鍵突擊',
        usageTip: '每日只花 5 分鐘專攻系統測出的最弱 5 鍵。',
        action: {
          kind: 'free_play',
          mode: 'weakkey',
          scope: 'root',
          scaffold: 'adaptive',
          label: '啟動弱鍵 5 分鐘熱身',
        },
      },
    ],
  },
];

export const BARRIER_REMEDIES: BarrierRemedyItem[] = [
  {
    id: 'key-lost',
    number: '難點 01',
    title: '鍵位迷失（知道要按哪根，手指卻找不到鍵）',
    symptom: '腦子剛想到字母或字根，視線就忍不住想低頭看鍵盤，一換行（上排／下排）就按偏一格。',
    psychologyCause: '手指對十指分區與伸指斜移距離的「本體感覺」還未校準，尤其上排 Q–P 與下排 X–M 最易漂移。',
    breakthroughMethod:
      '採用「分排定盤法」：先鎖中排歸位行 8 主根，確立 F/J 食指錨點後再拓上排 6 根、下排 6 根；錯鍵時故意不低頭，讓大腦靠餘光和位置回饋自我修正。',
    recommendedModules: [
      {
        moduleName: '五重道場 · 第一關（1-1 → 1-2 → 1-3）',
        usageTip: '中排 → 上排 → 下排分區獨立訓練，配合「Alice 上下分區」初識指法邊界。',
        action: { kind: 'campaign_chapter', chapterId: 1, label: '前往第一關分排定盤' },
      },
      {
        moduleName: '逐鍵宮殿單練（X 木宮範例）',
        usageTip: '單鍵 100% 重複敲擊該鍵家族字根，快速固化單指肌肉落點。',
        action: { kind: 'chamber_drill', chamberKey: 'x', label: '先試 X 鍵單鍵固化' },
      },
    ],
  },
  {
    id: 'radical-flood',
    number: '難點 02',
    title: '字根海恐懼與不確定焦慮（同鍵掛太多字根，不敢下手）',
    symptom: '看到一座宮殿掛了十幾個字根就發怵，擔心自己根本記不住、怕按錯而遲遲不敢落指。',
    psychologyCause: '把所有字根平等排成列表死背會引發極大不確定性恐懼，未利用「主根壁畫＋空間方位」把未知感降下來。',
    breakthroughMethod:
      '施行宮殿「房主帶鄰居」法消除不確定感：每鍵只認 1 個最高頻「主根」當房主，其餘記「順筆方位」（如 艹 在 又 上方、氵 在 水 中豎頂端）。即便一時忘鍵，也能順方位推出來，信心建立後再交給肌肉自動化。',
    recommendedModules: [
      {
        moduleName: '25 鍵記憶宮殿雲圖',
        usageTip: '打開「筆畫關聯路徑」，先看主根骨架，再按第 2–5 高頻順位瀏覽。',
        action: { kind: 'palace_cloud', label: '打開宮殿空間圖譜' },
      },
      {
        moduleName: '五重道場 · 3-1 高頻殿堂',
        usageTip: '只出第 2–5 高頻次根，先把性價比最高的 75% 字根練熟。',
        action: { kind: 'stage', stageId: '3-1', label: '練 3-1 第 2–5 高頻根' },
      },
    ],
  },
  {
    id: 'split-hesitation',
    number: '難點 03',
    title: '拆字猶豫症（單根認識，見成字不知怎麼切）',
    symptom: '單獨出字根都會按，遇到陌生合體字（尤其壓扁、包圍或交疊部件）卡在第一鍵下不去手。',
    psychologyCause: '缺的不是記憶，而是「整字 → 部件」的視覺邊界分割模板，與書寫筆順未對齊。',
    breakthroughMethod:
      '先做 2 輪純主根組字（零新字根干擾，專練切分順序），再切入「全彩拆字」看色彩分塊直接按鍵，最後用「第四關點睛」專練從複雜整字中一眼剝離高亮變形部件。',
    recommendedModules: [
      {
        moduleName: '五重道場 · 第二關（2-1 主根組字）',
        usageTip: '100% 由你已學會的 20 主根拼成真實漢字，純淨練習「一二三末」切分順序。',
        action: { kind: 'stage', stageId: '2-1', label: '進入 2-1 純主根組字' },
      },
      {
        moduleName: '五重道場 · 第四關（4-1 / 4-2 字中辨根）',
        usageTip: '整字中精準點亮變形偏旁或藏鋒包圍字根，專治「認識單根卻認不出變體」。',
        action: { kind: 'stage', stageId: '4-2', label: '練 4-2 藏鋒剝離' },
      },
    ],
  },
  {
    id: 'da-xiao-conflict',
    number: '難點 04',
    title: '大碼與聲韻小碼混亂（打大碼卻忘了尾韻）',
    symptom: '第一個輔音大碼幾乎反射按出，但到了補全根碼或字根聲韻小碼時腦子停住、頻頻試錯。',
    psychologyCause: '視覺空間編碼（形）與漢語語音編碼（音）同時搶佔工作記憶，兩套符號沒有分工。',
    breakthroughMethod:
      '明確分工：大碼完全交給「目標重合位宮殿雲圖」視覺反射（雲圖現在已過濾為只在大碼鍵觸發）；小碼／韻腹交給讀音直覺——兩鍵小根直接呼出該根讀音韻母，三鍵大根順口「聲＋韻」。',
    recommendedModules: [
      {
        moduleName: '自由鍛煉 · 全字根完整碼',
        usageTip: '搭配大碼重合位雲圖 + 開啟右上角「字根發音」，建立聲韻直覺。',
        action: {
          kind: 'free_play',
          mode: 'reflex',
          scope: 'root',
          scaffold: 'adaptive',
          label: '練全字根大碼＋聲韻',
        },
      },
      {
        moduleName: '文心實戰室 · Top 3 瓶頸字根專攻',
        usageTip: '針對系統統計反應最慢的 3 個輔音家族高頻連打，掃清聲韻卡點。',
        action: { kind: 'drill_studio', tab: 'bottleneck', label: '攻克 Top 3 瓶頸字根' },
      },
    ],
  },
  {
    id: 'error-avalanche',
    number: '難點 05',
    title: '誤擊雪崩效應（錯一字後越打越急、連環翻車）',
    symptom: '一旦有個字連錯兩次，心情立刻急躁，接下來三五個本來會打的字也開始瘋狂誤觸。',
    psychologyCause: '交感神經應激使手指微動控制崩潰；在慌亂中重複亂敲錯誤按鍵，反而把錯誤路徑覆寫進小腦。',
    breakthroughMethod:
      '執行「3 秒降速覆寫律」：觸發連錯時強制停頓半拍，掃一眼下方彩拆與 X 光提示，用 50% 慢速乾淨無錯地把這個字重打一遍；在疾風落字模式下可隨時暫停回穩或用節拍器壓住衝動。',
    recommendedModules: [
      {
        moduleName: '文心實戰室 · 慢字／錯字精修池',
        usageTip: '沒有倒數壓力的靜心重寫環境，錯字必須連續 3 次高速無誤直出才能畢業。',
        action: { kind: 'drill_studio', tab: 'slowhell', label: '進慢字池靜心覆寫' },
      },
      {
        moduleName: '自由鍛煉 · 弱鍵突擊',
        usageTip: '放緩目標追求 98% 零誤擊，把最易錯的 5 鍵手感重新「蓋印」正確。',
        action: {
          kind: 'free_play',
          mode: 'weakkey',
          scope: 'root',
          scaffold: 'full',
          label: '開全程提示重塑弱鍵',
        },
      },
    ],
  },
  {
    id: 'transfer-gap',
    number: '難點 06',
    title: '遷移斷層（打單字很順，一打真實文章就斷片）',
    symptom: '在字根和單字關卡能拿三星，一旦進長文抄錄就突然一頓一頓，均速跌回入門期。',
    psychologyCause: '單字訓練沒有「餘光預讀下一個字」的串流節奏，且高頻虛詞還用四鍵全碼硬拆，打斷語流。',
    breakthroughMethod:
      '雙管齊下：先在「簡碼速成」吃下一碼 5 字與核心 50 簡碼（立省 35%–45% 擊鍵）；再到「文心實戰室」用「目標居中＋水平景深字帶」訓練眼睛餘光預讀下一字，同時搭配節拍器練出連貫語流。',
    recommendedModules: [
      {
        moduleName: '簡碼速成 · 一碼 & 核心 50',
        usageTip: '將「的了是我不在有這你…」變成一拍上屏，瞬間打通句子流暢度。',
        action: { kind: 'short_code', tier: 'core50', label: '立即熟練核心 50 簡碼' },
      },
      {
        moduleName: '文心實戰室 · 行雲連打',
        usageTip: '目標字鎖定中央、右側字帶提供自然餘光預讀，練「上字尾鍵同時看清下字」。',
        action: { kind: 'drill_studio', tab: 'passage', label: '進文心實戰室練文流' },
      },
    ],
  },
  {
    id: 'free-writing-relapse',
    number: '難點 07',
    title: '臨門退縮症（聊天急用時總想切回拼音／雙拼）',
    symptom: '練習軟體都能打到 30–40 字/分，可真正打開微信或寫筆記時一想到要自己組織句子就卡住，下意識 `Ctrl+Space` 切回拼音。',
    psychologyCause: '「被動抄寫螢幕文字」走的是視覺通路；「腦中造句思考 → 手指打字」需要語義與形碼直接耦合，兩者必須靠純淨實戰去耦合。',
    breakthroughMethod:
      '設立「每日 200 字絕對禁切拼音區」：在下面的自由書寫遷移橋或黃庭抄經全盲模式中進行自主造句輸出；遇到卡殼字允許當場記錄進專屬慢字清單再一鍵特訓，但絕不切回拼音。',
    recommendedModules: [
      {
        moduleName: '黃庭抄經閣 · 盲打心流抄經',
        usageTip: '下方焦點純淨排版，把提示降到最低（盲打 / 10 秒超時救援），建立長時心流。',
        action: { kind: 'huangting', fadeMode: 'blind', label: '進黃庭閣挑戰純盲抄經' },
      },
      {
        moduleName: '五重道場 · 5-2 詞韻連打 / 5-3 疾風落字',
        usageTip: '雙字詞組連貫推進與實戰節奏抗壓，幫你跨越真實打字最後一公里。',
        action: { kind: 'stage', stageId: '5-2', label: '練 5-2 雙字詞組連打' },
      },
    ],
  },
];

export const PHASES: PhaseOverview[] = [
  {
    id: 1,
    dayRange: 'Day 1 – 2',
    title: '第一階 · 宮殿立骨定盤',
    subtitle: '只立 20 主根房主，藉空間座標消除盲猜恐懼、確立指法信心',
    milestone: '20 主根盲打準確率 ≥ 94%，十指能不低頭定位全鍵盤三排鍵區',
    cumulativeTime: '累計 ~50 分鐘',
  },
  {
    id: 2,
    dayRange: 'Day 3 – 5',
    title: '第二階 · 宮殿擴容與彩拆破冰',
    subtitle: '用已立主根拆真實漢字，順方位吸收第 2–5 高頻次根與變形偏旁',
    milestone: '面對常用 300 漢字能在 1.2 秒內有把握起手拆打，看懂變形偏旁',
    cumulativeTime: '累計 ~2.5 小時',
  },
  {
    id: 3,
    dayRange: 'Day 6 – 9',
    title: '第三階 · 宮殿交棒與純肌肉勻速',
    subtitle: '宮殿退居大碼救援，主軸切入簡碼槓桿 ＋ 節拍器勻速 ＋ 慢字池爆破',
    milestone: '真實文段盲打穩定 25–35 字/分（準確率 ≥ 95%），擊鍵間隔勻稱無急頓',
    cumulativeTime: '累計 ~5 小時',
  },
  {
    id: 4,
    dayRange: 'Day 10 – 14',
    title: '第四階 · 徹底脫敏與自由書寫',
    subtitle: '全盲心流、疾風提速衝關，搭配 7 日曲線驗證與每日 200 字自主造句',
    milestone: '盲打達 35–50+ 字/分，可不靠拼音在日常聊天／寫作中流暢思考輸出',
    cumulativeTime: '累計 ~8.5 小時（達成自由書寫）',
  },
];

export const DAILY_CURRICULUM: DailyLesson[] = [
  {
    day: 1,
    phaseId: 1,
    title: '中排立柱 8 主根：鎖定 F/J 食指基準軸',
    durationMin: 20,
    focusSummary: '不看實體鍵盤，用雙手歸位行 8 個核心主根建立手指空間基準（土 口 一 厶 日 亻 白 月）。',
    microRoutine: {
      warmup3m: '先開「25 鍵記憶宮殿圖」點開 S（土）、D（口）、H（日），看筆畫主軸但不死背小根。',
      core8m: '通關「1-1 中排基準」，保持全盲視覺焦點，靠目標重合位雲圖建立鍵位直覺。',
      solidify4m: '打開「自由鍛煉 · 記憶宮殿反射（僅大碼）」，只追求 96%+ 零猶豫穩打收尾。',
    },
    passCriteria: '1-1 達到 2 星以上，中排 8 鍵基本不用低頭找鍵。',
    practiceModules: [
      {
        moduleName: '五重道場 · 1-1 中排基準',
        usageTip: '必練起點：專門聚焦中排歸位行 8 個主根。',
        action: { kind: 'stage', stageId: '1-1', label: '立即開始 1-1' },
      },
      {
        moduleName: '25 鍵記憶宮殿雲圖',
        usageTip: '速覽中排 8 鍵主根骨架方位。',
        action: { kind: 'palace_cloud', label: '預覽宮殿空間' },
      },
    ],
  },
  {
    day: 2,
    phaseId: 1,
    title: '上下排全盤拓荒 ＋ 二十宮立柱檢定',
    durationMin: 25,
    focusSummary: '攻克上排 6 主根伸指區與下排 6 主根斜移區，當天結束前完成全部 20 主根盲打定盤。',
    microRoutine: {
      warmup3m: '重刷一遍昨日 1-1 中排 8 鍵，喚醒食指與無名指的基準位置感。',
      core8m: '依序打完「1-2 上排領銜」與「1-3 下排沉底」，最後挑戰「1-boss 二十宮立柱試」。',
      solidify4m: '若某鍵老按歪（如 C/V 或 T/Y），單點進入該鍵宮殿單練 2 分鐘覆寫正確軌跡。',
    },
    passCriteria: '通過 1-boss「二十宮立柱試」（準確率 ≥ 94%，均速 < 650ms），馬上進第二階不戀戰。',
    practiceModules: [
      {
        moduleName: '五重道場 · 1-2 上排領銜',
        usageTip: '強化上排 Q W R T Y P 六指伸張精準度。',
        action: { kind: 'stage', stageId: '1-2', label: '進入 1-2 上排' },
      },
      {
        moduleName: '五重道場 · 1-3 下排沉底',
        usageTip: '強化下排 X C V B N M 斜移手感。',
        action: { kind: 'stage', stageId: '1-3', label: '進入 1-3 下排' },
      },
      {
        moduleName: '五重道場 · 1-boss 檢定戰',
        usageTip: '20 主根全盤驗收，過關即代表第一階畢業。',
        action: { kind: 'stage', stageId: '1-boss', label: '挑戰 1-boss 檢定' },
      },
    ],
  },
  {
    day: 3,
    phaseId: 2,
    title: '主根組字破冰：零新字根下直打真實漢字',
    durationMin: 20,
    focusSummary: '用剛學會的 20 個主根直接拼出「明 林 休 友 泉 柏 森 品」等字，突破「會背不會拆」的第一層窗戶紙。',
    microRoutine: {
      warmup3m: '「自由鍛煉 · 弱鍵突擊」練 3 分鐘昨日最慢的幾把主根。',
      core8m: '通關「2-1 雙根成字」與「2-2 三根與疊字」，專注體會從左到右、從上到下的切分順序。',
      solidify4m: '挑選 X（木宮）、D（口宮）做 4 分鐘單鍵巡禮，看看主根身邊的第一位鄰居。',
    },
    passCriteria: '能一眼看懂 2 部件與 3 部件純主根漢字的取碼起筆順序，不再卡在第一鍵。',
    practiceModules: [
      {
        moduleName: '五重道場 · 2-1 雙根成字',
        usageTip: '零新知識負荷，用熟練的 20 主根打出成就感。',
        action: { kind: 'stage', stageId: '2-1', label: '進入 2-1 雙根組字' },
      },
      {
        moduleName: '五重道場 · 2-2 三根與疊字',
        usageTip: '練「森 晶 品 的 保」三部件切分節奏。',
        action: { kind: 'stage', stageId: '2-2', label: '進入 2-2 三根疊字' },
      },
    ],
  },
  {
    day: 4,
    phaseId: 2,
    title: '「一二三末 · 大根免三」＋ 實戰切分檢定',
    durationMin: 25,
    focusSummary: '掌握四根以上長字的跳取邏輯，並對高頻第 2–5 順位字根開始「高頻長肉」。',
    microRoutine: {
      warmup3m: '快速熱身 2-1 主根組字 2 分鐘，保持昨日手感溫度。',
      core8m: '完成「2-3 繁構與大根免三」並通過「2-boss 初字連斬試」，隨後啟動「3-1 高頻殿堂」。',
      solidify4m: '針對 3-1 裡出現陌生的高頻次根（如 艹 氵 讠 扌），開「全程提示」慢打 1 輪看色塊記憶。',
    },
    passCriteria: '理解「超過三根只取前二與末根」及「大根免三」規律，初步認識半數第 2–5 高頻次根。',
    practiceModules: [
      {
        moduleName: '五重道場 · 2-3 繁構免三',
        usageTip: '把最易讓人搞暈的長字規則一次打通。',
        action: { kind: 'stage', stageId: '2-3', label: '進入 2-3 繁構免三' },
      },
      {
        moduleName: '五重道場 · 2-boss 初字連斬',
        usageTip: '主根組字畢業考，檢驗切分反應。',
        action: { kind: 'stage', stageId: '2-boss', label: '挑戰 2-boss' },
      },
      {
        moduleName: '五重道場 · 3-1 高頻殿堂',
        usageTip: '開啟第 2–5 高頻延伸字根學習。',
        action: { kind: 'stage', stageId: '3-1', label: '進 3-1 練高頻次根' },
      },
    ],
  },
  {
    day: 5,
    phaseId: 2,
    title: '點睛透視：看清被壓扁與包圍的變形偏旁',
    durationMin: 25,
    focusSummary: '解決「字根換個長相放進字裡就認不出來」的痛點，直接用 X 光筆畫高亮剝離目標部件。',
    microRoutine: {
      warmup3m: '再打一遍「3-1 高頻殿堂」或挑 2 個弱鍵做單鍵記憶宮殿練功。',
      core8m: '進入「4-1 偏旁顯形」與「4-2 藏鋒剝離」，感受整字裡壓扁的 艹、穴、囗、辶 如何精準拆出。',
      solidify4m: '打 1 輪「簡碼速成 · 一碼直上(5)」，順手把「了 的 是 我 不」五個超高頻字領回家。',
    },
    passCriteria: '對左右、上下、半包圍漢字內的常見偏旁一眼定位，一碼 5 字達到直覺秒出。',
    practiceModules: [
      {
        moduleName: '五重道場 · 4-1 偏旁顯形',
        usageTip: '只打整字中被點亮的高亮部件，無規則干擾專練剝離。',
        action: { kind: 'stage', stageId: '4-1', label: '進入 4-1 偏旁顯形' },
      },
      {
        moduleName: '五重道場 · 4-2 藏鋒剝離',
        usageTip: '專治草字頭、走之底、病字旁等包圍壓縮變體。',
        action: { kind: 'stage', stageId: '4-2', label: '進入 4-2 藏鋒剝離' },
      },
      {
        moduleName: '簡碼速成 · 一碼直上 (5)',
        usageTip: '五分鐘記完文章中佔比極高的 5 個單鍵大字。',
        action: { kind: 'short_code', tier: 'one', label: '秒記一碼 5 大字' },
      },
    ],
  },
  {
    day: 6,
    phaseId: 3,
    title: '宮殿交棒時刻 ＋ 核心 50 簡碼槓桿',
    durationMin: 25,
    focusSummary:
      '今天起停止刻意去「背宮殿故事」，讓宮殿退居大碼閃現救援；主軸切入簡碼紅利與純肌肉連打，並隨時在首頁 7 日曲線檢驗增速是否符合預期。',
    microRoutine: {
      warmup3m: '先刷「4-1 / 4-2」或「弱鍵突擊」3 分鐘活動手指，感受不用想位置就能起手的鍵位。',
      core8m: '主攻「簡碼速成 · 核心 50 速成」，配合右抽屜 20×5 矩陣直接養成高頻短碼肌群反射。',
      solidify4m: '打開「3-2 中頻迴廊」，若遇生字再靠目標重合位宮殿雲圖穩住信心、不靠盲猜。',
    },
    passCriteria: '核心 50 簡碼掌握度 ≥ 80%，看到「有、這、你、說、就、着、中、沒」下意識只敲兩下。',
    practiceModules: [
      {
        moduleName: '簡碼速成 · 核心 50 速成',
        usageTip: '必練槓桿：無空格直出日常最高頻 50 字。',
        action: { kind: 'short_code', tier: 'core50', label: '主攻核心 50 簡碼' },
      },
      {
        moduleName: '五重道場 · 3-2 中頻迴廊',
        usageTip: '順勢補齊中頻常見字根，消除文章生字障礙。',
        action: { kind: 'stage', stageId: '3-2', label: '推進 3-2 中頻根' },
      },
    ],
  },
  {
    day: 7,
    phaseId: 3,
    title: '文心實戰初體驗 ＋ 節拍器建立勻速手感',
    durationMin: 25,
    focusSummary: '正式從「單字反應」跨越到「連續文本流」，利用水平景深帶學會餘光預讀下一字。',
    microRoutine: {
      warmup3m: '刷 1 輪「核心 50 速成」作為熱身，喚起簡碼優先意識。',
      core8m: '進入「文心實戰室 · 行雲連打」默背兩段內建短文，專注讓系統自動幫你撈出慢字（>1.5s）。',
      solidify4m: '進入「自由鍛煉 · 靈明單字」，看著底部「節奏節拍器」以 85% 舒適速度勻速敲完 1 輪。',
    },
    passCriteria: '實戰短文準確率 ≥ 93%，不再因為一個字想不起來就整個人呆住，開始用餘光預讀下字。',
    practiceModules: [
      {
        moduleName: '文心實戰室 · 行雲連打',
        usageTip: '真實語境練習，自動記錄你的個人「慢字池」。',
        action: { kind: 'drill_studio', tab: 'passage', label: '開始行雲連打文段' },
      },
      {
        moduleName: '自由鍛煉 · 節拍器勻速單字',
        usageTip: '跟隨底部節拍器流光與隱形拍點聲軌養成均勻擊鍵節奏。',
        action: {
          kind: 'free_play',
          mode: 'reflex',
          scope: 'char',
          scaffold: 'adaptive',
          label: '開節拍器練單字勻速',
        },
      },
    ],
  },
  {
    day: 8,
    phaseId: 3,
    title: '慢字池精準爆破 ＋ 猶豫極限閃顯特訓',
    durationMin: 25,
    focusSummary: '木桶理論實踐日：不浪費時間重打已熟的字，100% 火力集中轟炸拖慢你均速的慢字與錯字。',
    microRoutine: {
      warmup3m: '打開「文心實戰室 · 慢字／錯字池」，把昨日累積的紅黃標記慢字集中連打到連續 3 次直出畢業。',
      core8m: '切換至「極限猶豫閃顯（閾值設 1000ms–1500ms）」，強迫大腦在前 1 秒主動提取字根碼。',
      solidify4m: '補打 1 輪「簡碼速成 · 二碼直上」鞏固常用二簡規律。',
    },
    passCriteria: '慢字池內歷史積壓字數減半以上，主動提取延遲明顯縮短。',
    practiceModules: [
      {
        moduleName: '文心實戰室 · 慢字／錯字精修池',
        usageTip: '高純度錯題本：每個慢字須連續 3 次高速直出才移出。',
        action: { kind: 'drill_studio', tab: 'slowhell', label: '清剿慢字池' },
      },
      {
        moduleName: '文心實戰室 · 極限猶豫閃顯',
        usageTip: '專攻難拆結構與複雜長字，逼出第一時間主動回憶。',
        action: { kind: 'drill_studio', tab: 'hardsplit', label: '練極限閃顯盲打' },
      },
      {
        moduleName: '簡碼速成 · 二碼直上',
        usageTip: '二碼簡碼矩陣隨機高頻複習。',
        action: { kind: 'short_code', tier: 'two', label: '刷二碼簡碼' },
      },
    ],
  },
  {
    day: 9,
    phaseId: 3,
    title: '掃清 Top 3 瓶頸字根 ＋ 全殿外圍補漏',
    durationMin: 25,
    focusSummary: '根據近 7 日成長曲線與反應時延數據，精準掃除拖後腿的前三名瓶頸鍵位與外圍生字根。',
    microRoutine: {
      warmup3m: '在道場首頁看一眼弱鍵雷達圖，點「弱鍵突擊」練 3 分鐘。',
      core8m: '進入「文心實戰室 · 瓶頸字根專攻」，連刷 Top 3 最慢輔音家族；再回五重道場打通「3-3 / 3-boss」。',
      solidify4m: '再進「4-3 筆順連點」，練整字逐部件接力連按的流暢銜接感。',
    },
    passCriteria: '弱鍵均速落差明顯收窄，通過「3-boss 百根巡殿試」與「4-boss 透視辨根試」。',
    practiceModules: [
      {
        moduleName: '文心實戰室 · Top 3 瓶頸專攻',
        usageTip: '自動篩出你均速最慢的前 3 個字根鍵家族集中連打。',
        action: { kind: 'drill_studio', tab: 'bottleneck', label: '進瓶頸字根專攻' },
      },
      {
        moduleName: '五重道場 · 3-boss 百根巡殿試',
        usageTip: '全宮殿字根混測，對弱鍵自動加權出現。',
        action: { kind: 'stage', stageId: '3-boss', label: '挑戰 3-boss' },
      },
      {
        moduleName: '五重道場 · 4-3 筆順連點',
        usageTip: '在同一個整字上連續依序敲出多個字根全碼，無縫過渡到整字連打。',
        action: { kind: 'stage', stageId: '4-3', label: '練 4-3 筆順連點' },
      },
    ],
  },
  {
    day: 10,
    phaseId: 4,
    title: '化境整字與詞韻連打 ＋ 三碼高頻破關',
    durationMin: 25,
    focusSummary: '進入第四階去支架脫敏！不再按字根停頓，把雙字詞與三碼常用字連成整體肌肉連招。',
    microRoutine: {
      warmup3m: '2 分鐘「慢字池」清零喚醒，確保手無積滯。',
      core8m: '挑戰五重道場「5-1 百字初試」與「5-2 詞韻連打」，感受雙字詞不間斷節拍流。',
      solidify4m: '打開「簡碼速成 · 三碼高頻」，掌握常見三四碼字的 3 鍵直出捷徑。',
    },
    passCriteria: '5-1、5-2 均達 2 星以上，打常用詞組開始出現「一隻手還沒落完下一字已起手」的預感。',
    practiceModules: [
      {
        moduleName: '五重道場 · 5-1 百字初試',
        usageTip: '常用靈明單字全字根盲打實戰。',
        action: { kind: 'stage', stageId: '5-1', label: '進入 5-1 百字初試' },
      },
      {
        moduleName: '五重道場 · 5-2 詞韻連打',
        usageTip: '雙字詞組連貫推進，消除字間思索空拍。',
        action: { kind: 'stage', stageId: '5-2', label: '進入 5-2 詞韻連打' },
      },
      {
        moduleName: '簡碼速成 · 三碼高頻',
        usageTip: '用前兩碼＋末根韻碼直出四碼常用字。',
        action: { kind: 'short_code', tier: 'three', label: '練三碼高頻簡碼' },
      },
    ],
  },
  {
    day: 11,
    phaseId: 4,
    title: '黃庭抄經閣 · 靜心長句與純盲過渡',
    durationMin: 25,
    focusSummary: '撤除頻繁閃動提示，在靜謐下方焦點長句流中培養 10 分鐘以上持續穩定的輸入耐心與節奏。',
    microRoutine: {
      warmup3m: '先開「自適應漸隱」抄寫《黃庭經》第 1–2 章暖手。',
      core8m: '切至「純盲打模式（僅 Tab 偷看或 10s 超時漸顯）」，連續抄寫 3–5 章，遇錯不急躁、降速蓋印。',
      solidify4m: '進入本學院下方的「自由造句遷移橋」，嘗試不看任何字稿自寫 80 字今日小記。',
    },
    passCriteria: '能在沒有常駐拆字提醒的情況下連續靜心抄寫數百字，心態平穩不切換拼音。',
    practiceModules: [
      {
        moduleName: '黃庭抄經閣（純盲漸隱）',
        usageTip: '長篇古韻經文誦抄，底部焦點排版最適合沉澱長時盲打耐力。',
        action: { kind: 'huangting', fadeMode: 'blind', label: '入黃庭閣練長文盲打' },
      },
      {
        moduleName: '文心實戰室 · 貼上長文',
        usageTip: '也可貼入你日常工作常寫的郵件或文章段落來練手。',
        action: {
          kind: 'drill_studio',
          tab: 'passage',
          openPaste: true,
          label: '貼入自己的常用文章',
        },
      },
    ],
  },
  {
    day: 12,
    phaseId: 4,
    title: '疾風落字提速衝刺：用節奏條拉高反應天花板',
    durationMin: 20,
    focusSummary: '在不犧牲準確率（維持 ≥ 94%）的前提下，藉助落字時間壓迫與節奏動態條逼出潛在反應速度。',
    microRoutine: {
      warmup3m: '先打 1 輪「自由鍛煉 · 記憶宮殿反射」維持高準確率手感。',
      core8m: '主練「5-3 疾風落字」與自由模式「疾風落字」，追求目標字下方節奏條穩定亮出「冷青流光」。',
      solidify4m: '把剛才沒反應過來的字送進「慢字池」複習 2 分鐘，再用緩速節拍器收尾。',
    },
    passCriteria: '節奏條穩定維持 92%+ 精準度與冷青色相，單鍵均速突破 420ms 大關。',
    practiceModules: [
      {
        moduleName: '五重道場 · 5-3 疾風落字',
        usageTip: '關卡制抗壓訓練，測驗反應上限。',
        action: { kind: 'stage', stageId: '5-3', label: '進入 5-3 疾風落字' },
      },
      {
        moduleName: '自由鍛煉 · 疾風落字無盡衝速',
        usageTip: '觀察底部節奏動態條從暖黃轉為冷青呼吸光暈，兼開節拍器。',
        action: {
          kind: 'free_play',
          mode: 'arcade',
          scope: 'char',
          scaffold: 'adaptive',
          label: '進疾風落字刷冷青節奏',
        },
      },
    ],
  },
  {
    day: 13,
    phaseId: 4,
    title: '宗師盲打檢定戰 ＋ 全簡碼混測壓軸',
    durationMin: 25,
    focusSummary: '完成道場全套標準化關卡認證，檢查成長曲線趨勢與最後零星卡手字根。',
    microRoutine: {
      warmup3m: '「簡碼速成 · 全簡碼混測」5 分鐘快速過篩所有一二三碼。',
      core8m: '全力衝關「5-boss 墨鍵宗師試」（全程純盲打 36 字，限 3 枚墨印），拿下宗師段位。',
      solidify4m: '若仍有極少數易忘字根，立刻記錄並在文心自訂練完。',
    },
    passCriteria: '通關「5-boss 墨鍵宗師試」，且首頁 7 日成長曲線穩定攀升至 35+ CPM。',
    practiceModules: [
      {
        moduleName: '五重道場 · 5-boss 墨鍵宗師試',
        usageTip: '全程純盲打終極驗收戰。',
        action: { kind: 'stage', stageId: '5-boss', label: '挑戰 5-boss 宗師試' },
      },
      {
        moduleName: '簡碼速成 · 全簡碼混測',
        usageTip: '隨機混測全部簡碼，確保無漏網常用高頻詞。',
        action: { kind: 'short_code', tier: 'all', label: '全簡碼混測壓軸' },
      },
    ],
  },
  {
    day: 14,
    phaseId: 4,
    title: '自由書寫遷移：200 字無提示自主思考輸出',
    durationMin: 25,
    focusSummary: '打通最後一堵牆：徹底丟開「照抄文段」，直接用靈明輸入法將腦中真實想法寫出來！',
    microRoutine: {
      warmup3m: '先在本頁「自由書寫遷移橋」裡隨意選一個今日題目熱身。',
      core8m: '用你電腦／手機已安裝的形碼輸入法，不開參考表寫滿 200 字真實想法（日記、待辦、感言皆可）；遇到一時卡住的字，填進右側「卡殼字即時拆碼診斷」。',
      solidify4m: '點擊「一鍵送入文心實戰室專訓」把你今日造句時卡住的所有字連打 3 遍，從此真正畢業！',
    },
    passCriteria: '能全程不切換拼音獨立寫完 200+ 字流暢短文，日常工作／聊天正式切換為主力輸入法。',
    practiceModules: [
      {
        moduleName: '文心實戰室 · 自訂貼文實戰',
        usageTip: '貼上你日常真實要發送的文稿或造句卡殼字做最終靶向鞏固。',
        action: {
          kind: 'drill_studio',
          tab: 'passage',
          openPaste: true,
          label: '進文心自訂文章實戰',
        },
      },
      {
        moduleName: '黃庭抄經閣 · 隨喜抄經養手感',
        usageTip: '日後每天想放鬆練節奏時的最佳靜心歸宿。',
        action: { kind: 'huangting', fadeMode: 'adaptive', label: '進黃庭閣保持流暢手感' },
      },
    ],
  },
];

export const MODULE_DIRECTORY: ModuleDirectoryCard[] = [
  {
    id: 'campaign',
    moduleName: '五重道場闖關（1-1 ~ 5-boss）',
    roleTag: '主線骨架 · 第 1–5 關',
    bestFor: '不知該從何下手的新手、分排定位、純主根組字、字中辨根剝離',
    howToSelfDrill:
      '按 1 立柱 → 2 拆骨 → 3 築宮 → 4 點睛 → 5 化境依序推進；每關只過 2 星即可往下走，錯字過多再點單關「弱點複訓」。',
    recommendedSettings: '默認「自適應漸隱」· 先求 94%+ 準確率再求速度',
    launchAction: { kind: 'campaign_chapter', chapterId: 1, label: '打開五重道場地圖' },
  },
  {
    id: 'palace-cloud',
    moduleName: '25 鍵記憶宮殿雲圖（含單鍵巡禮）',
    roleTag: '空間記憶 · 零死背',
    bestFor: '某幾個字根總記混、想一次吃透某個鍵盤區域（如 X 木宮／D 口宮）',
    howToSelfDrill:
      '打開「筆畫關聯路徑」，按高頻順位看清字根圍繞主根的位置；點進任意單鍵即可開啟「單鍵 100% 重複固化練功」。',
    recommendedSettings: '單鍵練習建議開「自適應」→ 通關一次後用「盲打」再過一次',
    launchAction: { kind: 'palace_cloud', label: '開啟 25 鍵宮殿圖' },
  },
  {
    id: 'free-reflex',
    moduleName: '自由鍛煉 · 記憶宮殿反射 / 弱鍵突擊',
    roleTag: '空間反射 · 弱鍵靶向',
    bestFor: '每日 3 分鐘熱身、只練大碼反射、或專攻雷達圖裡紅黃警告的 5 個弱鍵',
    howToSelfDrill:
      '搭配「Alice 景深零掃視」與目標重合位「大碼擊鍵雲圖」練；看底部節奏節拍器跟住勻速拍點。',
    recommendedSettings: '新手前期選「僅大碼」；進階選「全字根」或「弱鍵突擊」',
    launchAction: {
      kind: 'free_play',
      mode: 'reflex',
      scope: 'root',
      scaffold: 'adaptive',
      label: '進記憶宮殿反射',
    },
  },
  {
    id: 'free-arcade',
    moduleName: '自由鍛煉 · 疾風落字（節奏條）',
    roleTag: '抗壓提速 · 節奏視覺化',
    bestFor: '單字已經會拆但速度卡在 20–30 字/分上不去、想培養連貫急擊手感的學員',
    howToSelfDrill:
      '盯緊下落目標字與下方動態節奏條：追求連擊時進度條從「暖黃過渡到冷青呼吸光暈」，避免盲目亂敲。',
    recommendedSettings: '準確率 ≥ 94% 時開啟「默背盲打」挑戰反應天花板',
    launchAction: {
      kind: 'free_play',
      mode: 'arcade',
      scope: 'char',
      scaffold: 'adaptive',
      label: '進疾風落字衝速',
    },
  },
  {
    id: 'short-code',
    moduleName: '簡碼速成道場（一二三碼）',
    roleTag: '提速槓桿 · 省 40% 按鍵',
    bestFor: '拆字熟了但長文均碼長、想迅速打通高頻常用字直出反射的用戶',
    howToSelfDrill:
      '先秒記「一碼 5 字」，接著專刷「核心 50 速成」，可點右上打開「20×5 二碼矩陣」對照首碼＋末根韻碼邏輯。',
    recommendedSettings: '建議保持「自適應」或「盲拆」，錯擊時即刻看構理口訣',
    launchAction: { kind: 'short_code', tier: 'core50', label: '進簡碼速成' },
  },
  {
    id: 'wenxin-drill',
    moduleName: '文心實戰室（連打／閃顯／慢字池／瓶頸）',
    roleTag: '實戰盲打 · 精準消滅卡點',
    bestFor: '進真實文段卡殼、想貼自己文章練習、或要定點消滅慢字／錯字／瓶頸鍵',
    howToSelfDrill:
      '「行雲連打」用來掃出慢字；隔天進「慢字池」讓慢字連對 3 次畢業；針對最慢輔音去「Top 3 瓶頸專攻」連刷。',
    recommendedSettings: '猶豫閾值：初學設 1500ms，進階壓到 1000ms',
    launchAction: { kind: 'drill_studio', tab: 'passage', label: '進文心實戰室' },
  },
  {
    id: 'huangting',
    moduleName: '黃庭抄經閣（36 章沉降焦點）',
    roleTag: '長時心流 · 靜心去支架',
    bestFor: '練習長時穩定注意力、純盲打脫敏、修煉穩定呼吸與指節律動',
    howToSelfDrill:
      '採用底部焦點景深視角，將提示漸隱調為「6–10 秒超時提示」或「純盲打」，一次靜抄 2–3 章不急不躁。',
    recommendedSettings: '宣紙水墨主題 ＋ 純盲打（卡殼才按 Tab 閃看）',
    launchAction: { kind: 'huangting', fadeMode: 'adaptive', label: '入黃庭抄經閣' },
  },
];

export const FREE_WRITING_PROMPTS: Array<{ id: string; title: string; guide: string }> = [
  {
    id: 'daily',
    title: '今日流水三件事',
    guide: '不用講究文采，直接打出你今天早上起床到現在做過的三件事，或等一下待辦的計劃。',
  },
  {
    id: 'explain',
    title: '向朋友推薦一個好東西',
    guide: '假裝你在聊天框裡給朋友安利一本書、一道菜、一部電影或一首音樂，寫下為什麼喜歡它。',
  },
  {
    id: 'reflect',
    title: '寫給自己的一段學習備忘',
    guide: '記錄下你學習形碼這幾天最順手與最容易混淆的幾個偏旁，用自己的話描述出來。',
  },
];
