import { ALL_DRILL_CHARS } from './drillLexicon';
import { HUANGTING_CHAR_MAP } from './huangtingjing';
import {
  encodeLingmingRoots,
  getLingmingCharScript,
  LINGMING_CHAR_SPLITS,
  LINGMING_ROOT_MAP,
} from './lingming';
import { PALACE_PDF_CHAMBERS } from './palacePdfData';
import { CharScript, matchesScript, ScriptMode } from './scriptFilter';

export type KineticZoneId =
  | 'kinetic_prefix22'
  | 'three_row_dir8'
  | 'three_row_full26'
  | 'home_dir8'
  | 'home_dir4'
  | 'comfort20'
  | 'comfort22'
  | 'compact16';
export type KineticAlternationMode = 'strict_lr' | 'bidirectional';
export type KineticStageId = 'starter12' | 'core48' | 'common500' | 'full1448';
export type KineticBlockMode = 'connected' | 'yuhao';
export type KineticRhythmMode = 'heshi_compact' | 'heshi_1k' | 'event_stream' | 'fixed4';

// Left-hand 5 canonical initial strokes (起笔五势)
export type InitialStrokeId = 'heng' | 'shu' | 'pie' | 'dian' | 'zhe';

// Right-hand ending momentum & aperture vectors (意之去向与收势散合)
export type EndingVectorId =
  | 'up_gather'
  | 'up_lift'
  | 'up_right_open'
  | 'up_right_far'
  | 'center_close'
  | 'center_settle'
  | 'center_spread'
  | 'right_extend'
  | 'down_plumb'
  | 'down_splay';

export type KineticRow = 'top' | 'home' | 'bot';

export interface KineticKeySpec {
  key: string;
  hand: 'L' | 'R';
  row: KineticRow;
  rowOffset: 1 | 0 | -1; // +1 up, 0 home, -1 down
  dist: 0 | 1 | 2 | 3; // distance from center bridge G/H
  colIndex: number; // visual 0..9 across keyboard columns
  finger: string;
  qiCue: string;
  strokeId?: InitialStrokeId; // Left-hand origin stroke
  vectorId?: EndingVectorId; // Right-hand ending vector
}

export interface KineticRadicalSpec {
  radical: string;
  freq: number;
  originStroke: InitialStrokeId;
  endingVector: EndingVectorId;
  intentCue: string;
  dyad: string; // 2-key alternating code
  key1: KineticKeySpec;
  key2: KineticKeySpec;
  heshiKey: KineticKeySpec; // Single Praying-Hands (手指合十) key encoding both origin + expansion
  heshiCue: string;
  isStarter12: boolean;
  isCore48: boolean;
  isReversedPolarity: boolean;
  ergonomicCost: number;
  lingmingMa?: string;
  // Self-delimiting Direction x Distance (A16 + B6) fields
  prefixMid?: KineticKeySpec;
  prefixEndB?: KineticKeySpec;
  prefixIsXiao?: boolean;
}

export interface KineticCharEntry {
  char: string;
  parts: string[];
  rawParts: string[];
  code: string;
  script: CharScript;
  radicals: KineticRadicalSpec[];
  keySpecs: KineticKeySpec[];
  alternationCount: number;
  transitionCount: number;
  homeRowHits: number;
  totalDist: number;
  isCoreDrill: boolean;
}

export interface KineticCollisionGroup {
  code: string;
  chars: KineticCharEntry[];
}

export interface KineticSimulationResult {
  zoneId: KineticZoneId;
  altMode: KineticAlternationMode;
  stageId: KineticStageId;
  scriptMode: ScriptMode;
  blockMode: KineticBlockMode;
  rhythmMode: KineticRhythmMode;
  keys: KineticKeySpec[];
  leftKeys: KineticKeySpec[];
  rightKeys: KineticKeySpec[];
  radicals: KineticRadicalSpec[];
  radicalMap: Map<string, KineticRadicalSpec>;
  chars: KineticCharEntry[];
  collisions: KineticCollisionGroup[];
  metrics: {
    totalChars: number;
    uniqueCodes: number;
    firstChoiceRate: number;
    collisionChars: number;
    wholeWordAltRate: number;
    radicalAltRate: number;
    homeRowRate: number;
    sameFingerRate: number;
    avgCenterDist: number;
    avgCodeLength: number;
    activeRadicalCount: number;
  };
}

export const INITIAL_STROKE_META: Record<
  InitialStrokeId,
  {
    symbol: string;
    label: string;
    primaryKey: string;
    secondaryKey: string;
    fingerCue: string;
    calligraphyCue: string;
  }
> = {
  heng: {
    symbol: '一',
    label: '一 · 橫起定基',
    primaryKey: 'f',
    secondaryKey: 'g',
    fingerCue: '左食指中宮 F / 內橋 G',
    calligraphyCue: '橫平落紙如陣雲展開，穩守中排食指本位',
  },
  shu: {
    symbol: '丨',
    label: '丨 · 豎起立柱',
    primaryKey: 'd',
    secondaryKey: 's',
    fingerCue: '左中指立柱 D / 外欄 S',
    calligraphyCue: '中指最長如中鋒立骨，S 兼護外框雙豎',
  },
  pie: {
    symbol: '丿',
    label: '丿 · 撇起斜掠',
    primaryKey: 'e',
    secondaryKey: 'c',
    fingerCue: '左中指斜上 E / 斜下 C',
    calligraphyCue: '中指上下斜掠出鋒，契合蘭葉撇之斜勢',
  },
  dian: {
    symbol: '丶',
    label: '丶 · 點落起鋒',
    primaryKey: 'v',
    secondaryKey: 'r',
    fingerCue: '左食指沉點 V / 冠點 R',
    calligraphyCue: 'V 如點水心火沉降着墨，R 如寶蓋冠點高懸',
  },
  zhe: {
    symbol: '乛',
    label: '乛 · 折起轉腕',
    primaryKey: 'w',
    secondaryKey: 'x',
    fingerCue: '左無名上折 W / 下折 X',
    calligraphyCue: '無名指順腕轉折蓄勁，W 主橫折、X 主撇折',
  },
};

export const ENDING_VECTOR_META: Record<
  EndingVectorId,
  { label: string; short: string; key: string; cue: string }
> = {
  up_gather: {
    label: '聚頂上收 (Y)',
    short: '聚頂',
    key: 'y',
    cue: '筆意收束於頂蓋，上合而下庇',
  },
  up_lift: {
    label: '微揚右上提 (U)',
    short: '上提',
    key: 'u',
    cue: '末筆挑勢微揚向右上，如三點水收提',
  },
  up_right_open: {
    label: '右上開口托舉 (I)',
    short: '右上開',
    key: 'i',
    cue: '結構開口朝右上方敞開托舉，如走之底辶',
  },
  up_right_far: {
    label: '右上高揚舒展 (O)',
    short: '右上展',
    key: 'o',
    cue: '長戈斜挑大幅度向右上舒展騰空',
  },
  center_close: {
    label: '歸中封口合抱 (H)',
    short: '封口',
    key: 'h',
    cue: '末筆封口或回中合抱，蓄鋒不散',
  },
  center_settle: {
    label: '中宮平定穩駐 (J)',
    short: '平定',
    key: 'j',
    cue: '橫平豎正穩落中宮，骨力端凝',
  },
  center_spread: {
    label: '並立撐開分張 (K)',
    short: '分撐',
    key: 'k',
    cue: '雙豎或多格向左右平撐，堂皇開張',
  },
  right_extend: {
    label: '右展拖勢開廓 (L)',
    short: '右展',
    key: 'l',
    cue: '尾勢向右橫展或右耳駐守，餘韻悠長',
  },
  down_plumb: {
    label: '垂豎直落歸根 (N)',
    short: '垂落',
    key: 'n',
    cue: '一豎直垂向下落根，收束聚流不散（如亻、十、中）',
  },
  down_splay: {
    label: '撇捺下盤張散 (M)',
    short: '下散',
    key: 'm',
    cue: '中柱向下並帶撇捺四點左右散開（如木、人、火）',
  },
};

export const STARTER_12_RADICALS: string[] = [
  '口',
  '一',
  '日',
  '木',
  '人',
  '亻',
  '辶',
  '氵',
  '土',
  '心',
  '艹',
  '又',
];

// Finger-symmetric Praying-Hands (手指合十) mirror pairs across the G|H center spine
export const HESHI_MIRROR_PAIRS: Array<{
  leftKey: string;
  rightKey: string;
  expansionLabel: string;
  leftRole: string;
  rightRole: string;
}> = [
  { leftKey: 't', rightKey: 'y', expansionLabel: '聚頂上收', leftRole: '橫撇上聚(金竹雨)', rightRole: '點豎蓋頂(宀丷穴)' },
  { leftKey: 'r', rightKey: 'u', expansionLabel: '微揚上提', leftRole: '橫撇上提(扌)', rightRole: '點豎提勢(氵讠冖)' },
  { leftKey: 'e', rightKey: 'i', expansionLabel: '右上開口', leftRole: '撇橫右上(几我耂)', rightRole: '右上承託(辶山虍)' },
  { leftKey: 'w', rightKey: 'o', expansionLabel: '遠翼高展', leftRole: '斜折高揚(戈戊也)', rightRole: '遠穹舒張(羽)' },
  { leftKey: 'g', rightKey: 'h', expansionLabel: '歸中封口', leftRole: '橫撇封合(二寸白勺)', rightRole: '豎點合口(口囗言丶)' },
  { leftKey: 'f', rightKey: 'j', expansionLabel: '中宮平定', leftRole: '橫平駐中(一土五王)', rightRole: '豎點定柱(日立目止)' },
  { leftKey: 'd', rightKey: 'k', expansionLabel: '並立分撐', leftRole: '橫折撐立(艹井卌)', rightRole: '豎點並撐(田罒門門)' },
  { leftKey: 's', rightKey: 'l', expansionLabel: '右展拖勢', leftRole: '橫折右展(厂匕儿尸)', rightRole: '豎點右延(广亡刂灬)' },
  { leftKey: 'b', rightKey: 'n', expansionLabel: '垂豎直落', leftRole: '橫折垂落(十丰中卩)', rightRole: '豎點直垂(丨巾心羊)' },
  { leftKey: 'v', rightKey: 'm', expansionLabel: '下盤張散', leftRole: '橫下散(木束本大)', rightRole: '點水四散(火水小米)' },
];

const STARTER_12_SET = new Set(STARTER_12_RADICALS);

// Physical keyboard layout definition (pure A-Z comfort zone, zero pinky Q/A/Z/P)
const ALL_COMFORT_KEYS: Record<string, KineticKeySpec> = {
  // Left Hand: 5 Canonical Initial Strokes
  w: { key: 'w', hand: 'L', row: 'top', rowOffset: 1, dist: 3, colIndex: 1, finger: '左無名', qiCue: '乛 上折起', strokeId: 'zhe' },
  e: { key: 'e', hand: 'L', row: 'top', rowOffset: 1, dist: 2, colIndex: 2, finger: '左中指', qiCue: '丿 斜撇起', strokeId: 'pie' },
  r: { key: 'r', hand: 'L', row: 'top', rowOffset: 1, dist: 1, colIndex: 3, finger: '左食指', qiCue: '丶 冠點起', strokeId: 'dian' },
  t: { key: 't', hand: 'L', row: 'top', rowOffset: 1, dist: 0, colIndex: 4, finger: '左食內', qiCue: '一 上橫軸', strokeId: 'heng' },

  s: { key: 's', hand: 'L', row: 'home', rowOffset: 0, dist: 3, colIndex: 1, finger: '左無名', qiCue: '丨 外欄豎', strokeId: 'shu' },
  d: { key: 'd', hand: 'L', row: 'home', rowOffset: 0, dist: 2, colIndex: 2, finger: '左中指', qiCue: '丨 立柱豎', strokeId: 'shu' },
  f: { key: 'f', hand: 'L', row: 'home', rowOffset: 0, dist: 1, colIndex: 3, finger: '左食指', qiCue: '一 平橫基', strokeId: 'heng' },
  g: { key: 'g', hand: 'L', row: 'home', rowOffset: 0, dist: 0, colIndex: 4, finger: '左食內', qiCue: '一 內橋橫', strokeId: 'heng' },

  x: { key: 'x', hand: 'L', row: 'bot', rowOffset: -1, dist: 3, colIndex: 1, finger: '左無名', qiCue: '乛 撇折起', strokeId: 'zhe' },
  c: { key: 'c', hand: 'L', row: 'bot', rowOffset: -1, dist: 2, colIndex: 2, finger: '左中指', qiCue: '丿 下掠撇', strokeId: 'pie' },
  v: { key: 'v', hand: 'L', row: 'bot', rowOffset: -1, dist: 1, colIndex: 3, finger: '左食指', qiCue: '丶 沉點起', strokeId: 'dian' },
  b: { key: 'b', hand: 'L', row: 'bot', rowOffset: -1, dist: 0, colIndex: 4, finger: '左食內', qiCue: '丶 內軸點', strokeId: 'dian' },

  // Right Hand: 10 Ending Direction Vectors
  y: { key: 'y', hand: 'R', row: 'top', rowOffset: 1, dist: 0, colIndex: 5, finger: '右食內', qiCue: '聚頂上收', vectorId: 'up_gather' },
  u: { key: 'u', hand: 'R', row: 'top', rowOffset: 1, dist: 1, colIndex: 6, finger: '右食指', qiCue: '微揚上提', vectorId: 'up_lift' },
  i: { key: 'i', hand: 'R', row: 'top', rowOffset: 1, dist: 2, colIndex: 7, finger: '右中指', qiCue: '右上開口', vectorId: 'up_right_open' },
  o: { key: 'o', hand: 'R', row: 'top', rowOffset: 1, dist: 3, colIndex: 8, finger: '右無名', qiCue: '右上舒展', vectorId: 'up_right_far' },

  h: { key: 'h', hand: 'R', row: 'home', rowOffset: 0, dist: 0, colIndex: 5, finger: '右食內', qiCue: '歸中封口', vectorId: 'center_close' },
  j: { key: 'j', hand: 'R', row: 'home', rowOffset: 0, dist: 1, colIndex: 6, finger: '右食指', qiCue: '中宮平定', vectorId: 'center_settle' },
  k: { key: 'k', hand: 'R', row: 'home', rowOffset: 0, dist: 2, colIndex: 7, finger: '右中指', qiCue: '並立分撐', vectorId: 'center_spread' },
  l: { key: 'l', hand: 'R', row: 'home', rowOffset: 0, dist: 3, colIndex: 8, finger: '右無名', qiCue: '右展拖勢', vectorId: 'right_extend' },

  n: { key: 'n', hand: 'R', row: 'bot', rowOffset: -1, dist: 0, colIndex: 5, finger: '右食內', qiCue: '垂豎直落', vectorId: 'down_plumb' },
  m: { key: 'm', hand: 'R', row: 'bot', rowOffset: -1, dist: 1, colIndex: 6, finger: '右食指', qiCue: '下盤張散', vectorId: 'down_splay' },

  // Outer-wing pinky keys (used ONLY in three_row_full26 for ultra-rare tail radicals)
  q: { key: 'q', hand: 'L', row: 'top', rowOffset: 1, dist: 3, colIndex: 0, finger: '左小指', qiCue: '外翼上補', strokeId: 'zhe' },
  a: { key: 'a', hand: 'L', row: 'home', rowOffset: 0, dist: 3, colIndex: 0, finger: '左小指', qiCue: '外翼中補', strokeId: 'shu' },
  z: { key: 'z', hand: 'L', row: 'bot', rowOffset: -1, dist: 3, colIndex: 0, finger: '左小指', qiCue: '外翼下補', strokeId: 'zhe' },
  p: { key: 'p', hand: 'R', row: 'top', rowOffset: 1, dist: 3, colIndex: 9, finger: '右小指', qiCue: '外翼遠展', vectorId: 'up_right_far' },
};

export const HOME_GROUP_ANCHORS: Array<{
  key: string;
  hand: 'L' | 'R';
  columnKeys: string[];
  topKey: string;
  botKey?: string;
  groupTitle: string;
  shortTag: string;
  anchorRadicals: string;
  ruleCue: string;
}> = [
  {
    key: 's',
    hand: 'L',
    columnKeys: ['s', 'w', 'x'],
    topKey: 'w',
    botKey: 'x',
    groupTitle: 'S · 框圍並立',
    shortTag: '框圍',
    anchorRadicals: '囗 門 貝 山 巾',
    ruleCue: '外框包圍與山門貝類',
  },
  {
    key: 'd',
    hand: 'L',
    columnKeys: ['d', 'e', 'c'],
    topKey: 'e',
    botKey: 'c',
    groupTitle: 'D · 斜撇斜掠',
    shortTag: '斜撇',
    anchorRadicals: '人 亻 月 八 勹',
    ruleCue: '撇筆領頭與單人旁類',
  },
  {
    key: 'f',
    hand: 'L',
    columnKeys: ['f', 'r', 'v'],
    topKey: 'r',
    botKey: 'v',
    groupTitle: 'F · 橫基定樁',
    shortTag: '橫基',
    anchorRadicals: '一 木 土 艹 大',
    ruleCue: '平橫領頭與草木土大',
  },
  {
    key: 'g',
    hand: 'L',
    columnKeys: ['g', 't', 'b'],
    topKey: 't',
    botKey: 'b',
    groupTitle: 'G · 折轉勾連',
    shortTag: '折勾',
    anchorRadicals: '又 乙 女 刀 糸',
    ruleCue: '橫撇折轉與女絞絲類',
  },
  {
    key: 'h',
    hand: 'R',
    columnKeys: ['h', 'y', 'n'],
    topKey: 'y',
    botKey: 'n',
    groupTitle: 'H · 口日合框',
    shortTag: '口日',
    anchorRadicals: '口 日 田 目 白',
    ruleCue: '方形合圍與目田白類',
  },
  {
    key: 'j',
    hand: 'R',
    columnKeys: ['j', 'u', 'm'],
    topKey: 'u',
    botKey: 'm',
    groupTitle: 'J · 點水心火',
    shortTag: '點水',
    anchorRadicals: '丶 氵 心 火 灬',
    ruleCue: '點水沉鋒與心火四點',
  },
  {
    key: 'k',
    hand: 'R',
    columnKeys: ['k', 'i'],
    topKey: 'i',
    groupTitle: 'K · 冠蓋言立',
    shortTag: '冠蓋',
    anchorRadicals: '宀 冖 亠 立 言',
    ruleCue: '寶蓋頭蓋與言立廣門',
  },
  {
    key: 'l',
    hand: 'R',
    columnKeys: ['l', 'o'],
    topKey: 'o',
    groupTitle: 'L · 豎柱走之',
    shortTag: '豎托',
    anchorRadicals: '丨 辶 亅 小 刂',
    ruleCue: '垂豎立柱與走之托底',
  },
];

export interface OppositeDirectionSpec {
  dirIdx: number;
  arrow: string;
  label: string;
  short: string;
  rightKey: string;
  leftMirrorKey: string;
  cue: string;
}

export const OPPOSITE_DIR8_COMPASS: OppositeDirectionSpec[] = [
  { dirIdx: 0, arrow: '↖', label: '上聚', short: '↖聚', rightKey: 'y', leftMirrorKey: 't', cue: '聚頂收束、蓋覆向上' },
  { dirIdx: 1, arrow: '↑', label: '上提', short: '↑提', rightKey: 'u', leftMirrorKey: 'r', cue: '微揚上提、挑勢向上' },
  { dirIdx: 2, arrow: '↗', label: '右上開', short: '↗開', rightKey: 'i', leftMirrorKey: 'e', cue: '向右上敞開或斜挑舒展' },
  { dirIdx: 3, arrow: '←', label: '內收', short: '←合', rightKey: 'h', leftMirrorKey: 'g', cue: '向內合抱封口、蓄勢不散' },
  { dirIdx: 4, arrow: '●', label: '平定', short: '●定', rightKey: 'j', leftMirrorKey: 'f', cue: '橫平豎正、中宮平定穩駐' },
  { dirIdx: 5, arrow: '→', label: '外展', short: '→展', rightKey: 'l', leftMirrorKey: 's', cue: '向右開展或雙柱分撐' },
  { dirIdx: 6, arrow: '↓', label: '垂落', short: '↓垂', rightKey: 'n', leftMirrorKey: 'b', cue: '一豎直垂落根、貫穿歸中' },
  { dirIdx: 7, arrow: '↘', label: '下散', short: '↘散', rightKey: 'm', leftMirrorKey: 'v', cue: '撇捺四點向下方舒張散開' },
];

export const OPPOSITE_DIR4_COMPASS: OppositeDirectionSpec[] = [
  { dirIdx: 0, arrow: '↑', label: '上揚聚提', short: '↑上揚', rightKey: 'u', leftMirrorKey: 'r', cue: '頂蓋聚頂、微揚上提或右上開' },
  { dirIdx: 1, arrow: '←', label: '內收平定', short: '←內定', rightKey: 'h', leftMirrorKey: 'g', cue: '合口內抱或中宮平定穩駐' },
  { dirIdx: 2, arrow: '→', label: '外展分撐', short: '→外展', rightKey: 'l', leftMirrorKey: 's', cue: '向右拖勢開廓或並立撐開' },
  { dirIdx: 3, arrow: '↓', label: '垂落張散', short: '↓下散', rightKey: 'm', leftMirrorKey: 'v', cue: '垂豎直落或撇捺四點下散' },
];

export interface KineticPrefixBSpec {
  key: string;
  hand: 'L' | 'R';
  arrow: string;
  tierLabel: string;
  shortTag: string;
  reachCue: string;
}

export const KINETIC_PREFIX_B_SPECS: KineticPrefixBSpec[] = [
  { key: 'e', hand: 'L', arrow: '↑', tierLabel: '上揚收勢', shortTag: 'B↑揚', reachCue: '左中指上伸 · 頂蓋/開口/上挑收尾' },
  { key: 'g', hand: 'L', arrow: '→', tierLabel: '中宮內定', shortTag: 'B→定', reachCue: '左食指中排內收 · 封口/平定/橫展' },
  { key: 'v', hand: 'L', arrow: '↓', tierLabel: '下沉收鋒', shortTag: 'B↓沉', reachCue: '左食指下沉 · 垂豎/撇捺下散收尾' },
  { key: 'i', hand: 'R', arrow: '↑', tierLabel: '上揚收勢', shortTag: 'B↑揚', reachCue: '右中指上伸 · 頂蓋/開口/上挑收尾' },
  { key: 'h', hand: 'R', arrow: '←', tierLabel: '中宮內定', shortTag: 'B←定', reachCue: '右食指中排內收 · 封口/平定/橫展' },
  { key: 'm', hand: 'R', arrow: '↓', tierLabel: '下沉收鋒', shortTag: 'B↓沉', reachCue: '右食指下沉 · 垂豎/撇捺下散收尾' },
];

export const KINETIC_PREFIX_B_SET = new Set(KINETIC_PREFIX_B_SPECS.map((s) => s.key));

export const ZONE_DEFINITIONS: Record<
  KineticZoneId,
  { label: string; subtitle: string; left: string[]; right: string[] }
> = {
  kinetic_prefix22: {
    label: '動力學自分割 22 鍵',
    subtitle: '以「方向×距離」取代靈明聲韻音託：A區16鍵(FDS|JKL零位移) × B區6鍵(EGV|IHM勢距終結) · 零小指、前綴衝突 0（免空格）',
    left: ['w', 'e', 'r', 't', 's', 'd', 'f', 'g', 'x', 'c', 'v', 'b'],
    right: ['y', 'u', 'i', 'o', 'h', 'j', 'k', 'l', 'n', 'm'],
  },
  three_row_dir8: {
    label: '三排指柱 22 鍵 × 8 向',
    subtitle: '8 條同指縱柱分層（中排主根 ~67% → 上排次頻 22% → 下排低頻 11%）× 對側 8 向 = 176 零小指專屬位',
    left: ['w', 'e', 'r', 't', 's', 'd', 'f', 'g', 'x', 'c', 'v', 'b'],
    right: ['y', 'u', 'i', 'o', 'h', 'j', 'k', 'l', 'n', 'm'],
  },
  three_row_full26: {
    label: '三排全 26 鍵 · 全根不重',
    subtitle: '三排分層優先中排 + 罕用尾根補小指外翼 · 100% 獨立覆蓋全部 269 個宇浩字根（小指率 <0.3%）',
    left: ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b'],
    right: ['y', 'u', 'i', 'o', 'p', 'h', 'j', 'k', 'l', 'n', 'm'],
  },
  home_dir8: {
    label: '單排中排 4+4 × 8 向',
    subtitle: '僅用中排 8 鍵起手 (SDFG | HJKL) × 對側 8 向 = 64 位（覆蓋前 64 高頻根 67.1% 頻次）',
    left: ['e', 'r', 't', 's', 'd', 'f', 'g', 'v', 'b'],
    right: ['y', 'u', 'i', 'h', 'j', 'k', 'l', 'n', 'm'],
  },
  home_dir4: {
    label: '單排中排 4+4 × 4 向',
    subtitle: '極簡 4 方向 (↑上揚 ←內定 →外展 ↓下散) · 中排起手 × 對側 4 向 = 32 位',
    left: ['r', 's', 'd', 'f', 'g', 'v'],
    right: ['u', 'h', 'j', 'k', 'l', 'm'],
  },
  comfort20: {
    label: '20 鍵中宮舒適區',
    subtitle: '零小指 · 左五筆起手 (F/G橫 D/S豎 E/C撇 V/R點 W/X折) × 右十向收勢',
    left: ['w', 'e', 'r', 's', 'd', 'f', 'g', 'x', 'c', 'v'],
    right: ['y', 'u', 'i', 'o', 'h', 'j', 'k', 'l', 'n', 'm'],
  },
  comfort22: {
    label: '22 鍵擴展內橋區',
    subtitle: '含 T/B · 左 12 鍵擴充橫點承重 × 右 10 向收勢',
    left: ['w', 'e', 'r', 't', 's', 'd', 'f', 'g', 'x', 'c', 'v', 'b'],
    right: ['y', 'u', 'i', 'o', 'h', 'j', 'k', 'l', 'n', 'm'],
  },
  compact16: {
    label: '16 鍵極簡三指核',
    subtitle: '極致緊湊 · 左 8 (ER/SDFG/CV) × 右 8 (UI/HJKL/NM)',
    left: ['e', 'r', 's', 'd', 'f', 'g', 'c', 'v'],
    right: ['u', 'i', 'h', 'j', 'k', 'l', 'n', 'm'],
  },
};

// Connected-component merge rules: groups touching/intersecting strokes into single physical qi-blocks
const SHU_CONTAINING_CHARS = new Set([
  '速', '束', '赖', '賴', '懒', '懶', '辣', '敕', '整', '嗽', '漱', '棘', '疎',
]);

interface BlockMergeRule {
  seq: string[];
  merged: string;
  charGuard?: Set<string>;
}

const CONNECTED_BLOCK_RULES: BlockMergeRule[] = [
  // 4-part unified single connected glyphs
  { seq: ['一', '丨', '乙', '一'], merged: '五' },
  // 3-part touching connected blocks
  { seq: ['二', '丿', '丨'], merged: '井' },
  { seq: ['丿', '扌', '戈'], merged: '我' },
  { seq: ['一', '乙', '一'], merged: '与' },
  { seq: ['一', '勹', '丿'], merged: '万' },
  { seq: ['丶', '力', '丶'], merged: '为' },
  { seq: ['丷', '十', '一'], merged: '半' },
  { seq: ['乙', '丶', '用'], merged: '甬' },
  { seq: ['勹', '口', '儿'], merged: '免' },
  { seq: ['戈', '口', '一'], merged: '或' },
  { seq: ['𠂇', '丨', '土'], merged: '在' },
  // 2-part touching / intersecting connected blocks
  { seq: ['口', '丨'], merged: '中' },
  { seq: ['木', '一'], merged: '本' },
  { seq: ['木', '口'], merged: '束', charGuard: SHU_CONTAINING_CHARS },
  { seq: ['王', '丶'], merged: '玉' },
  { seq: ['勹', '丶'], merged: '勺' },
  { seq: ['一', '夕'], merged: '歹' },
  { seq: ['刀', '二'], merged: '冄' },
  { seq: ['二', '亅'], merged: '亍' },
  { seq: ['彐', '亅'], merged: '争' },
  { seq: ['冂', '人'], merged: '内' },
  { seq: ['刀', '丶'], merged: '刃' },
  { seq: ['又', '丶'], merged: '叉' },
  { seq: ['田', '木'], merged: '果' },
  { seq: ['大', '丶'], merged: '犬' },
  { seq: ['一', '大'], merged: '天' },
  { seq: ['爪', '冖'], merged: '爫' },
];

function mergePartsToConnectedBlocks(char: string, rawParts: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < rawParts.length) {
    let matched = false;
    for (const rule of CONNECTED_BLOCK_RULES) {
      if (rule.charGuard && !rule.charGuard.has(char)) continue;
      const len = rule.seq.length;
      if (i + len <= rawParts.length) {
        let ok = true;
        for (let k = 0; k < len; k++) {
          if (rawParts[i + k] !== rule.seq[k]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          out.push(rule.merged);
          i += len;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      out.push(rawParts[i]);
      i++;
    }
  }
  return out;
}

interface RadicalKinestheticSeed {
  stroke: InitialStrokeId;
  vector: EndingVectorId;
  cue: string;
  preferredDyad?: string;
}

// Explicit calligraphic kinetic seeds:
// First key = First stroke origin (一丨丿丶乛), Second key = Ending flow/aperture direction
const RADICAL_KINESTHETIC_BOOK: Record<string, RadicalKinestheticSeed> = {
  // Top 1-20 highest-frequency radicals
  '口': { stroke: 'shu', vector: 'center_close', cue: '豎起(D) → 末橫封口歸中(H)', preferredDyad: 'dh' },
  '一': { stroke: 'heng', vector: 'center_settle', cue: '橫起(F) → 平定駐中(J)', preferredDyad: 'fj' },
  '日': { stroke: 'shu', vector: 'center_settle', cue: '豎起(D) → 內橫平定收口(J)', preferredDyad: 'dj' },
  '木': { stroke: 'heng', vector: 'down_splay', cue: '橫起(F) → 豎垂兼撇捺下散(M)', preferredDyad: 'fm' },
  '人': { stroke: 'pie', vector: 'down_splay', cue: '撇起(E) → 撇捺下盤張散(M)', preferredDyad: 'em' },
  '月': { stroke: 'pie', vector: 'down_plumb', cue: '撇起(E) → 豎鉤垂落(N)', preferredDyad: 'en' },
  '丶': { stroke: 'dian', vector: 'center_close', cue: '點落(V) → 歸中一點(H)', preferredDyad: 'vh' },
  '土': { stroke: 'heng', vector: 'center_settle', cue: '橫起(G) → 下橫穩駐中宮(J)', preferredDyad: 'gj' },
  '亻': { stroke: 'pie', vector: 'down_plumb', cue: '斜撇起(C) → 垂豎直落不散(N)', preferredDyad: 'cn' },
  '又': { stroke: 'zhe', vector: 'down_splay', cue: '橫撇折(W) → 長捺向下舒散(M)', preferredDyad: 'wm' },
  '丿': { stroke: 'pie', vector: 'down_plumb', cue: '斜掠撇(E) → 斜垂落鋒(H)', preferredDyad: 'eh' },
  '氵': { stroke: 'dian', vector: 'up_lift', cue: '點起沉鋒(V) → 末筆微揚提向右上(U)', preferredDyad: 'vu' },
  '艹': { stroke: 'heng', vector: 'center_spread', cue: '橫起(F) → 雙豎並撐上展(K)', preferredDyad: 'fk' },
  '宀': { stroke: 'dian', vector: 'up_gather', cue: '冠點起(R) → 橫鉤聚頂庇覆(Y)', preferredDyad: 'ry' },
  '冖': { stroke: 'dian', vector: 'up_lift', cue: '點起(R) → 橫鉤仰蓋上提(U)', preferredDyad: 'ru' },
  '辶': { stroke: 'dian', vector: 'up_right_open', cue: '點起(V) → 平捺拖出，開口向右上托舉(I)', preferredDyad: 'vi' },
  '二': { stroke: 'heng', vector: 'center_close', cue: '橫起內橋(G) → 雙橫合抱(H)', preferredDyad: 'gh' },
  '八': { stroke: 'pie', vector: 'down_splay', cue: '下撇起(C) → 左右分張散開(M)', preferredDyad: 'cm' },
  '心': { stroke: 'dian', vector: 'down_plumb', cue: '點起沉腕(V) → 臥鉤收束歸根(N)', preferredDyad: 'vn' },
  '乙': { stroke: 'zhe', vector: 'right_extend', cue: '折起(W) → 彎鉤向右展伸(L)', preferredDyad: 'wl' },

  // Merged Connected-Component Blocks (相連成塊)
  '中': { stroke: 'shu', vector: 'down_plumb', cue: '豎起(S) → 一豎貫口直垂到底(N)', preferredDyad: 'sn' },
  '束': { stroke: 'heng', vector: 'down_splay', cue: '橫起(F) → 束腰撇捺下散(M)' },
  '本': { stroke: 'heng', vector: 'down_splay', cue: '橫起(G) → 貫底橫兼撇捺下散(M)' },
  '井': { stroke: 'heng', vector: 'center_spread', cue: '雙橫(G) → 撇豎並穿撐開(K)' },
  '五': { stroke: 'heng', vector: 'center_settle', cue: '橫起(F) → 折下底橫平定收正(J)' },
  '与': { stroke: 'heng', vector: 'right_extend', cue: '橫起(F) → 豎折鉤平托延展(L)' },
  '万': { stroke: 'heng', vector: 'down_plumb', cue: '橫起(F) → 折鉤包撇垂落(N)' },
  '为': { stroke: 'dian', vector: 'down_splay', cue: '冠點(R) → 力勢拖點下散(M)' },
  '我': { stroke: 'pie', vector: 'up_right_far', cue: '短撇起(E) → 戈鉤斜挑向右上(O)' },
  '半': { stroke: 'dian', vector: 'down_plumb', cue: '雙點(V) → 中豎穿橫直下(N)' },
  '甬': { stroke: 'zhe', vector: 'down_plumb', cue: '折點起(W) → 用字垂豎落根(N)' },
  '免': { stroke: 'pie', vector: 'right_extend', cue: '撇起(C) → 豎彎鉤向右展伸(L)' },
  '或': { stroke: 'heng', vector: 'up_right_far', cue: '橫起(F) → 斜戈挑向右上(O)' },
  '玉': { stroke: 'heng', vector: 'center_settle', cue: '橫起(G) → 三橫駐定內蓄一點(J)' },
  '勺': { stroke: 'pie', vector: 'center_close', cue: '撇起(C) → 包弧內藏一點(H)' },
  '歹': { stroke: 'heng', vector: 'down_plumb', cue: '橫起(F) → 夕撇斜垂(N)' },
  '冄': { stroke: 'zhe', vector: 'down_plumb', cue: '折起(W) → 雙橫垂豎(N)' },
  '亍': { stroke: 'heng', vector: 'down_plumb', cue: '雙橫(G) → 豎鉤垂落(N)' },
  '争': { stroke: 'zhe', vector: 'down_plumb', cue: '折起(W) → 豎鉤貫穿直下(N)' },
  '内': { stroke: 'shu', vector: 'center_close', cue: '外豎(S) → 框合內人(H)' },
  '刃': { stroke: 'zhe', vector: 'down_plumb', cue: '折起(W) → 帶點穿鋒落(N)' },
  '叉': { stroke: 'zhe', vector: 'down_splay', cue: '折起(W) → 長捺貫點下散(M)' },
  '果': { stroke: 'shu', vector: 'down_splay', cue: '豎起(D) → 日頂木腳下盤散開(M)' },
  '犬': { stroke: 'heng', vector: 'down_splay', cue: '橫起(F) → 撇捺張開兼頂點(M)' },
  '天': { stroke: 'heng', vector: 'down_splay', cue: '雙橫起(G) → 撇捺大開下散(M)' },
  '在': { stroke: 'heng', vector: 'center_settle', cue: '橫起(F) → 土字穩落定駐(J)' },

  // Top 21-140 canonical radicals
  '丷': { stroke: 'dian', vector: 'up_gather', cue: '點起(V) → 雙點聚頂呼應(Y)', preferredDyad: 'vy' },
  '十': { stroke: 'heng', vector: 'down_plumb', cue: '橫起(F) → 中豎直落貫下(N)', preferredDyad: 'fn' },
  '大': { stroke: 'heng', vector: 'down_splay', cue: '橫起內橋(G) → 撇捺大幅下散(M)', preferredDyad: 'gm' },
  '勹': { stroke: 'pie', vector: 'center_close', cue: '撇起(C) → 橫折鉤內抱合口(H)', preferredDyad: 'ch' },
  '隹': { stroke: 'pie', vector: 'center_settle', cue: '撇起(E) → 四橫穩落定駐(J)', preferredDyad: 'ej' },
  '厶': { stroke: 'zhe', vector: 'center_close', cue: '撇折起(X) → 末點閉合歸中(H)', preferredDyad: 'xh' },
  '糸': { stroke: 'zhe', vector: 'down_splay', cue: '撇折(X) → 下三點散落(M)', preferredDyad: 'xm' },
  '丨': { stroke: 'shu', vector: 'down_plumb', cue: '豎起立柱(D) → 一氣垂落到底(N)', preferredDyad: 'dn' },
  '纟': { stroke: 'zhe', vector: 'up_lift', cue: '撇折(X) → 末提微揚右上(U)', preferredDyad: 'xu' },
  '寸': { stroke: 'heng', vector: 'center_close', cue: '橫起(F) → 豎鉤點斂(H)', preferredDyad: 'fh' },
  '王': { stroke: 'heng', vector: 'center_spread', cue: '內橋橫起(G) → 三橫正撐(K)', preferredDyad: 'gk' },
  '匕': { stroke: 'pie', vector: 'right_extend', cue: '撇起(E) → 豎彎鉤向右出鋒(L)', preferredDyad: 'el' },
  '火': { stroke: 'dian', vector: 'down_splay', cue: '點起(V) → 撇捺下盤炎散(M)', preferredDyad: 'vm' },
  '亠': { stroke: 'dian', vector: 'center_settle', cue: '冠點(R) → 長橫平定蓋頂(J)', preferredDyad: 'rj' },
  '扌': { stroke: 'heng', vector: 'up_lift', cue: '橫起(F) → 提筆挑向右上(U)', preferredDyad: 'fu' },
  '阝': { stroke: 'zhe', vector: 'down_plumb', cue: '橫折彎鉤(W) → 長豎直落駐守(N)', preferredDyad: 'wn' },
  '彐': { stroke: 'zhe', vector: 'center_settle', cue: '折起(W) → 末橫封齊定駐(J)', preferredDyad: 'wj' },
  '立': { stroke: 'dian', vector: 'center_settle', cue: '冠點(R) → 底橫穩立(K)', preferredDyad: 'rk' },
  '言': { stroke: 'dian', vector: 'center_close', cue: '冠點(R) → 底部口字封合(H)', preferredDyad: 'rh' },
  '⺌': { stroke: 'shu', vector: 'up_gather', cue: '豎起(D) → 聚頂收束上呼(Y)', preferredDyad: 'dy' },
  '女': { stroke: 'zhe', vector: 'down_splay', cue: '撇點(X) → 橫撇下盤開展(N)', preferredDyad: 'xn' },
  '戈': { stroke: 'heng', vector: 'up_right_far', cue: '橫起(F) → 斜鉤高揚挑向右上(O)', preferredDyad: 'fo' },
  '亅': { stroke: 'shu', vector: 'up_lift', cue: '豎起(D) → 鉤尖挑起微揚(U)', preferredDyad: 'du' },
  '刀': { stroke: 'zhe', vector: 'down_plumb', cue: '折起(W) → 撇鋒直落(H)', preferredDyad: 'wh' },
  '田': { stroke: 'shu', vector: 'center_spread', cue: '豎起(D) → 四格撐開合框(K)', preferredDyad: 'dk' },
  '儿': { stroke: 'pie', vector: 'right_extend', cue: '下撇(C) → 豎彎鉤向右展(L)', preferredDyad: 'cl' },
  '夕': { stroke: 'pie', vector: 'down_plumb', cue: '斜撇(E) → 橫撇點垂(K)', preferredDyad: 'ek' },
  '白': { stroke: 'pie', vector: 'center_close', cue: '短撇(C) → 框合封口(J)', preferredDyad: 'cj' },
  '囗': { stroke: 'shu', vector: 'center_close', cue: '外欄豎(S) → 大框合抱封口(H)', preferredDyad: 'sh' },
  '小': { stroke: 'shu', vector: 'down_splay', cue: '豎鉤(D) → 兩點左右分落(M)', preferredDyad: 'dm' },
  '山': { stroke: 'shu', vector: 'up_lift', cue: '中豎起(D) → 敞口向上承託(I)', preferredDyad: 'di' },
  '厂': { stroke: 'heng', vector: 'right_extend', cue: '橫起(F) → 右開左撇庇護(L)', preferredDyad: 'fl' },
  '乂': { stroke: 'pie', vector: 'down_splay', cue: '撇起(E) → 交叉拖捺下散(I)', preferredDyad: 'ei' },
  '巾': { stroke: 'shu', vector: 'down_plumb', cue: '外豎(S) → 中豎直垂到底(N)' },
  '冂': { stroke: 'shu', vector: 'center_spread', cue: '外框豎(S) → 框頂平撐垂落(K)', preferredDyad: 'sk' },
  '夊': { stroke: 'pie', vector: 'down_splay', cue: '撇起(C) → 拖捺向右下開(M)' },
  '讠': { stroke: 'dian', vector: 'up_lift', cue: '冠點(R) → 折提右上收(I)', preferredDyad: 'ri' },
  '卌': { stroke: 'heng', vector: 'center_spread', cue: '內橋橫(G) → 並豎分撐(L)', preferredDyad: 'gl' },
  '目': { stroke: 'shu', vector: 'center_settle', cue: '外豎(S) → 多橫平定封齊(J)', preferredDyad: 'sj' },
  '尸': { stroke: 'zhe', vector: 'right_extend', cue: '折起(W) → 垂撇開廓護下(K)', preferredDyad: 'wk' },
  '丰': { stroke: 'heng', vector: 'down_plumb', cue: '內橋橫(G) → 豎筆貫穿直下(N)', preferredDyad: 'gn' },
  '匚': { stroke: 'heng', vector: 'up_right_open', cue: '橫起(F) → 框口朝右敞開(I)', preferredDyad: 'fi' },
  '𠂇': { stroke: 'heng', vector: 'down_splay', cue: '橫起(G) → 斜撇下張(U)', preferredDyad: 'gu' },
  '金': { stroke: 'pie', vector: 'up_gather', cue: '撇起(E) → 人字蓋聚頂(Y)', preferredDyad: 'ey' },
  '貝': { stroke: 'shu', vector: 'down_splay', cue: '外豎(S) → 下八字腳散立(M)', preferredDyad: 'sm' },
  '士': { stroke: 'heng', vector: 'center_settle', cue: '內橋橫(G) → 堅正定樁(I)', preferredDyad: 'gi' },
  '力': { stroke: 'zhe', vector: 'down_plumb', cue: '折鉤(W) → 斜撇出勁(U)', preferredDyad: 'wu' },
  '几': { stroke: 'pie', vector: 'up_right_open', cue: '斜撇(E) → 橫折彎鉤揚向右上(O)', preferredDyad: 'eo' },
  '彳': { stroke: 'pie', vector: 'down_plumb', cue: '下撇(C) → 垂豎並行落根(I)', preferredDyad: 'ci' },
  '禾': { stroke: 'pie', vector: 'down_splay', cue: '平撇起(E) → 如木下盤散開(M)' },
  '幺': { stroke: 'zhe', vector: 'center_close', cue: '下折(X) → 末點回中(J)', preferredDyad: 'xj' },
  '工': { stroke: 'heng', vector: 'center_settle', cue: '橫起(G) → 下橫平穩收正(J)' },
  '羊': { stroke: 'dian', vector: 'down_plumb', cue: '雙點起(R) → 中豎直垂(N)', preferredDyad: 'rn' },
  '忄': { stroke: 'dian', vector: 'down_plumb', cue: '沉點(V) → 豎心直立沉降(K)', preferredDyad: 'vk' },
  '門': { stroke: 'shu', vector: 'center_spread', cue: '外欄雙豎(S) → 左右對開撐立(L)', preferredDyad: 'sl' },
  '广': { stroke: 'dian', vector: 'right_extend', cue: '冠點(R) → 斜撇庇護敞右(L)', preferredDyad: 'rl' },
  '罒': { stroke: 'shu', vector: 'up_gather', cue: '外豎(S) → 橫頂聚斂(Y)', preferredDyad: 'sy' },
  '刂': { stroke: 'shu', vector: 'down_plumb', cue: '立豎(D) → 末鉤直垂收勁(L)', preferredDyad: 'dl' },
  '丁': { stroke: 'heng', vector: 'down_plumb', cue: '橫起(G) → 豎鉤垂直落下(N)' },
  '攵': { stroke: 'pie', vector: 'down_splay', cue: '撇起(C) → 末筆長捺向下散開(K)', preferredDyad: 'ck' },
  '竹': { stroke: 'pie', vector: 'up_gather', cue: '雙撇起(C) → 高懸聚頂(Y)', preferredDyad: 'cy' },
  '車': { stroke: 'heng', vector: 'down_plumb', cue: '橫起(F) → 豎軸直貫到底(N)' },
  '也': { stroke: 'zhe', vector: 'up_right_far', cue: '折起(W) → 豎彎鉤挑向右上(O)', preferredDyad: 'wo' },
  '灬': { stroke: 'dian', vector: 'down_splay', cue: '沉點(V) → 四點平散托底(L)', preferredDyad: 'vl' },
  '米': { stroke: 'dian', vector: 'down_splay', cue: '冠點(R) → 如木四散(M)', preferredDyad: 'rm' },
  '止': { stroke: 'shu', vector: 'center_settle', cue: '豎起(D) → 底橫平定歸止(J)' },
  '夂': { stroke: 'pie', vector: 'down_splay', cue: '撇起(C) → 交叉下散(M)' },
  '皿': { stroke: 'shu', vector: 'center_settle', cue: '外豎(S) → 底橫穩托盤底(J)' },
  '门': { stroke: 'dian', vector: 'center_spread', cue: '點起(R) → 雙扉撐立(K)' },
  '石': { stroke: 'heng', vector: 'center_close', cue: '橫起(F) → 撇下口字封合(H)' },
  '方': { stroke: 'dian', vector: 'down_plumb', cue: '冠點(R) → 折鉤下垂(N)' },
  '习': { stroke: 'zhe', vector: 'up_lift', cue: '折起(W) → 內點挑勢上揚(U)' },
  '耳': { stroke: 'heng', vector: 'down_plumb', cue: '橫起(F) → 右豎懸垂(N)' },
  '里': { stroke: 'shu', vector: 'center_settle', cue: '豎起(D) → 雙橫落定(J)' },
  '巳': { stroke: 'zhe', vector: 'up_right_open', cue: '折起(W) → 豎彎鉤向右敞開(I)', preferredDyad: 'wi' },
  '水': { stroke: 'shu', vector: 'down_splay', cue: '中豎鉤(D) → 撇捺流散兩翼(M)' },
  '艮': { stroke: 'zhe', vector: 'down_splay', cue: '折起(W) → 右捺下散止步(M)' },
  '頁': { stroke: 'heng', vector: 'down_splay', cue: '橫起(F) → 末兩點下散(M)' },
  '欠': { stroke: 'pie', vector: 'down_splay', cue: '撇起(E) → 人字下敞氣(M)' },
  '斤': { stroke: 'pie', vector: 'down_plumb', cue: '平撇起(E) → 懸針豎直下(N)' },
  '殳': { stroke: 'pie', vector: 'down_splay', cue: '撇起(E) → 又字底拖捺下散(M)' },
  '穴': { stroke: 'dian', vector: 'up_gather', cue: '冠點(R) → 寶蓋聚頂下開(Y)' },
  '户': { stroke: 'dian', vector: 'up_lift', cue: '冠點(R) → 門扉微揚(U)' },
  '戊': { stroke: 'heng', vector: 'up_right_far', cue: '橫起(F) → 長戈斜挑右上(O)' },
  '爪': { stroke: 'pie', vector: 'down_splay', cue: '平撇(E) → 豎捺垂散(M)' },
  '爫': { stroke: 'pie', vector: 'up_gather', cue: '平撇(E) → 聚點覆頂(Y)' },
  '贝': { stroke: 'shu', vector: 'down_splay', cue: '外豎(S) → 下散雙足(M)' },
  '氺': { stroke: 'shu', vector: 'down_splay', cue: '豎鉤(D) → 四水星散(M)' },
  '页': { stroke: 'heng', vector: 'down_splay', cue: '橫起(F) → 下兩點撐開(M)' },
  '子': { stroke: 'zhe', vector: 'center_settle', cue: '橫撇折(X) → 中橫平展定身(K)', preferredDyad: 'xk' },
  '七': { stroke: 'heng', vector: 'right_extend', cue: '橫起(F) → 豎彎鉤向右開展(L)' },
  '雨': { stroke: 'heng', vector: 'up_gather', cue: '橫起(F) → 蓋頂含雨滴(Y)', preferredDyad: 'fy' },
  '廾': { stroke: 'heng', vector: 'center_spread', cue: '橫起(F) → 撇豎雙柱並撐(K)' },
  '夫': { stroke: 'heng', vector: 'down_splay', cue: '雙橫(G) → 撇捺下散(M)' },
  '舌': { stroke: 'pie', vector: 'center_close', cue: '平撇(E) → 底下口字合口(H)' },
  '虫': { stroke: 'shu', vector: 'up_lift', cue: '豎起(D) → 末筆上提加點(U)' },
  '卩': { stroke: 'zhe', vector: 'down_plumb', cue: '折起(W) → 單耳長豎直垂(N)' },
  '饣': { stroke: 'pie', vector: 'up_lift', cue: '撇起(E) → 末提微揚向右上(U)' },
  '兀': { stroke: 'heng', vector: 'right_extend', cue: '橫起(F) → 豎彎鉤向右延展(L)' },
  '古': { stroke: 'heng', vector: 'center_close', cue: '橫起(F) → 底下口字封口(H)' },
  '彡': { stroke: 'pie', vector: 'down_plumb', cue: '三撇順勢斜落(C)' },
  '亡': { stroke: 'dian', vector: 'right_extend', cue: '點起(R) → 折框向右開口(L)' },
  '虍': { stroke: 'shu', vector: 'up_lift', cue: '豎起(D) → 虎頭鈎覆兼右展(U)' },
  '车': { stroke: 'heng', vector: 'down_plumb', cue: '橫起(F) → 垂豎定軸(N)' },
  '豕': { stroke: 'heng', vector: 'down_splay', cue: '橫起(F) → 彎鉤眾撇下散(M)' },
  '尤': { stroke: 'heng', vector: 'up_right_far', cue: '橫起(F) → 豎彎鉤揚向右(O)' },
  '乀': { stroke: 'dian', vector: 'down_splay', cue: '平捺波磔(V) → 長曳右下散(M)' },
  '矢': { stroke: 'pie', vector: 'down_splay', cue: '撇起(E) → 箭羽下盤散開(M)' },
  '黑': { stroke: 'shu', vector: 'down_splay', cue: '外豎(S) → 下四點流散(M)' },
  '⺀': { stroke: 'dian', vector: 'up_lift', cue: '沉點(V) → 兩點水挑向右上(U)' },
  '食': { stroke: 'pie', vector: 'down_splay', cue: '撇起(E) → 末捺下盤穩收(M)' },
  '上': { stroke: 'shu', vector: 'center_settle', cue: '豎起(D) → 底橫平定承地(J)' },
  '衤': { stroke: 'dian', vector: 'down_plumb', cue: '點起(V) → 衣補直垂(N)' },
  '自': { stroke: 'pie', vector: 'center_settle', cue: '短撇(E) → 目框平封(J)' },
  '凵': { stroke: 'zhe', vector: 'up_lift', cue: '豎折(X) → 敞口向上承載(U)' },
  '己': { stroke: 'zhe', vector: 'up_right_open', cue: '折起(W) → 豎彎鉤敞向右上(I)' },
  '钅': { stroke: 'pie', vector: 'up_lift', cue: '撇起(E) → 豎提微揚右上(U)' },
  '冊': { stroke: 'shu', vector: 'center_spread', cue: '外豎(S) → 簡牘並立撐開(K)' },
  '耂': { stroke: 'heng', vector: 'up_right_open', cue: '橫起(F) → 長撇飛揚斜穿(I)' },
};

const HENG_EXTRA = new Set([
  '三', '未', '末', '干', '丈', '天', '非', '失', '西', '覀', '甘', '瓦', '正',
  '云', '元', '不', '下', '可', '平', '百', '而', '豆', '面', '来', '东',
  '两', '夾', '夹', '更', '至', '牙', '互', '毋', '辰', '長',
  '长', '青', '革', '韋', '韦', '馬',
]);
const SHU_EXTRA = new Set([
  '甲', '申', '由', '曲', '業', '业', '卜', '凸', '凹', '師', '临', '舊', '占',
  '盧', '鹵', '卤', '串', '史', '央', '肉', '同', '周', '罔', '网',
]);
const PIE_EXTRA = new Set([
  '牛', '生', '手', '舟', '鬼', '身', '采', '鱼', '魚', '鳥', '鸟', '气', '风', '風',
  '反', '片', '用', '角', '血', '臼', '瓜', '矛', '卵', '免', '兔', '象', '鼠',
  '鼻', '香', '重', '垂', '千', '壬', '夭', '升', '氏', '民',
]);
const DIAN_EXTRA = new Set([
  '文', '之', '良', '音', '鹿', '麻', '高', '衣', '示', '礻', '州', '辛', '主',
  '永', '冰', '羊', '米', '首', '並', '前', '关', '兼', '曽', '曾', '丫', '斗',
  '爲', '炎', '冬', '寒',
]);

export function inferRadicalKinesthetics(rad: string): RadicalKinestheticSeed {
  const curated = RADICAL_KINESTHETIC_BOOK[rad];
  if (curated) return curated;

  let stroke: InitialStrokeId = 'heng';
  if (SHU_EXTRA.has(rad)) stroke = 'shu';
  else if (PIE_EXTRA.has(rad)) stroke = 'pie';
  else if (DIAN_EXTRA.has(rad)) stroke = 'dian';
  else if (HENG_EXTRA.has(rad)) stroke = 'heng';
  else {
    const code = rad.charCodeAt(0);
    const mod = code % 5;
    stroke = mod === 0 ? 'heng' : mod === 1 ? 'shu' : mod === 2 ? 'pie' : mod === 3 ? 'dian' : 'zhe';
  }

  let vector: EndingVectorId = 'center_settle';
  if (['之', '文', '冬', '炎', '夹', '來', '来', '象', '鼠', '走', '足', '交'].includes(rad)) {
    vector = 'down_splay';
  } else if (['气', '风', '風', '飞', '飛', '氏', '民', '毛', '见', '見', '虎'].includes(rad)) {
    vector = 'up_right_open';
  } else if (['千', '壬', '牛', '申', '甲', '卜', '州', '吊'].includes(rad)) {
    vector = 'down_plumb';
  } else if (['网', '罔', '同', '周'].includes(rad)) {
    vector = 'center_spread';
  } else if (['甘', '由', '曲', '臼', '面', '西', '覀', '音'].includes(rad)) {
    vector = 'center_close';
  } else if (stroke === 'dian') {
    vector = 'up_gather';
  } else if (stroke === 'zhe') {
    vector = 'right_extend';
  }

  return {
    stroke,
    vector,
    cue: `${INITIAL_STROKE_META[stroke].symbol}起 → ${ENDING_VECTOR_META[vector].short}`,
  };
}

const STROKE_LEFT_KEY_PREFS: Record<InitialStrokeId, string[]> = {
  heng: ['f', 'g', 't', 'd', 's', 'e', 'r', 'c', 'v', 'w', 'x', 'b'],
  shu: ['d', 's', 'f', 'g', 'e', 'c', 'w', 'x', 'r', 'v', 't', 'b'],
  pie: ['e', 'c', 'r', 'f', 'd', 'v', 's', 'g', 'w', 'x', 't', 'b'],
  dian: ['v', 'r', 'b', 'f', 'g', 'e', 'd', 'c', 't', 's', 'w', 'x'],
  zhe: ['w', 'x', 's', 'c', 'd', 'e', 'v', 'r', 'f', 'g', 't', 'b'],
};

const VECTOR_RIGHT_KEY_PREFS: Record<EndingVectorId, string[]> = {
  up_gather: ['y', 'u', 'k', 'i', 'h', 'o', 'j', 'l', 'n', 'm'],
  up_lift: ['u', 'i', 'y', 'o', 'h', 'j', 'k', 'l', 'n', 'm'],
  up_right_open: ['i', 'u', 'o', 'l', 'y', 'k', 'j', 'h', 'm', 'n'],
  up_right_far: ['o', 'i', 'u', 'l', 'k', 'y', 'j', 'h', 'm', 'n'],
  center_close: ['h', 'j', 'n', 'y', 'k', 'u', 'i', 'l', 'm', 'o'],
  center_settle: ['j', 'h', 'k', 'n', 'l', 'u', 'y', 'i', 'm', 'o'],
  center_spread: ['k', 'j', 'l', 'h', 'u', 'i', 'm', 'n', 'y', 'o'],
  right_extend: ['l', 'k', 'i', 'o', 'j', 'u', 'h', 'm', 'n', 'y'],
  down_plumb: ['n', 'm', 'h', 'j', 'k', 'l', 'u', 'y', 'i', 'o'],
  down_splay: ['m', 'n', 'k', 'l', 'j', 'i', 'u', 'h', 'y', 'o'],
};

interface RawCorpusEntry {
  char: string;
  parts: string[];
  script: CharScript;
  isCoreDrill: boolean;
}

let cachedBaseCorpus: RawCorpusEntry[] | null = null;

function buildFallbackRootMap(): Map<string, string> {
  const fallback = new Map<string, string>();
  for (const ch of Object.values(PALACE_PDF_CHAMBERS)) {
    for (const n of ch.nodes) {
      if (n.parentChar && LINGMING_ROOT_MAP.has(n.parentChar)) {
        fallback.set(n.displayChar, n.parentChar);
        fallback.set(n.rawChar, n.parentChar);
      }
    }
  }
  for (const info of Object.values(HUANGTING_CHAR_MAP)) {
    info.roots.forEach((r, idx) => {
      if (!LINGMING_ROOT_MAP.has(r) && !fallback.has(r)) {
        const ma = info.rootCodes[idx];
        if (ma) {
          for (const [canon, v] of LINGMING_ROOT_MAP) {
            if (v.ma === ma) {
              fallback.set(r, canon);
              break;
            }
          }
        }
      }
    });
  }
  return fallback;
}

function getBaseCorpus(): RawCorpusEntry[] {
  if (cachedBaseCorpus) return cachedBaseCorpus;

  const fallbackRoot = buildFallbackRootMap();
  const seen = new Map<string, RawCorpusEntry>();

  const normalizeParts = (parts: string[]) =>
    parts.map((p) => (LINGMING_ROOT_MAP.has(p) ? p : fallbackRoot.get(p) || p));

  for (const d of ALL_DRILL_CHARS) {
    if (!d.parts || d.parts.length === 0) continue;
    const detected = getLingmingCharScript(d.char);
    const script = detected !== 'common' ? detected : d.script;
    seen.set(d.char, {
      char: d.char,
      parts: normalizeParts(d.parts),
      script,
      isCoreDrill: true,
    });
  }

  for (const [ch, parts] of LINGMING_CHAR_SPLITS) {
    if (seen.has(ch) || parts.length === 0) continue;
    seen.set(ch, {
      char: ch,
      parts: normalizeParts(parts),
      script: getLingmingCharScript(ch),
      isCoreDrill: false,
    });
  }

  for (const [ch, info] of Object.entries(HUANGTING_CHAR_MAP)) {
    if (seen.has(ch) || !info.roots || info.roots.length === 0) continue;
    seen.set(ch, {
      char: ch,
      parts: normalizeParts(info.roots),
      script: getLingmingCharScript(ch),
      isCoreDrill: false,
    });
  }

  cachedBaseCorpus = [...seen.values()];
  return cachedBaseCorpus;
}

function scoreKinestheticPair(
  k1: KineticKeySpec,
  k2: KineticKeySpec,
  seed: RadicalKinestheticSeed,
  zoneId: KineticZoneId
): { cost: number; reversedPolarity: boolean } {
  const isLR = k1.hand === 'L' && k2.hand === 'R';
  const leftKey = isLR ? k1 : k2;
  const rightKey = isLR ? k2 : k1;

  const strokePrefs = STROKE_LEFT_KEY_PREFS[seed.stroke];
  const vectorPrefs = VECTOR_RIGHT_KEY_PREFS[seed.vector];

  const strokeIdx = strokePrefs.indexOf(leftKey.key);
  const vectorIdx = vectorPrefs.indexOf(rightKey.key);

  // Number of dedicated left-hand keys belonging to this stroke in the active zone
  // (2 in comfort20/22 for shu/pie/dian/zhe, 3 for heng in comfort22; zhe falls back in compact16)
  const nativeCount =
    zoneId === 'compact16' && seed.stroke === 'zhe'
      ? 2
      : zoneId === 'comfort22' && (seed.stroke === 'heng' || seed.stroke === 'dian')
        ? 3
        : 2;

  // Enforce strict first-stroke fidelity: wrong-stroke keys carry +5000 penalty
  const strokeRankPenalty =
    strokeIdx >= 0 && strokeIdx < nativeCount
      ? strokeIdx * 2.2
      : 5000 + (strokeIdx >= 0 ? strokeIdx * 20 : 200);

  // Direction fidelity on Right Hand (exact vector = 0, close neighbor = 3..8, far = 24+)
  const vectorRankPenalty =
    vectorIdx === 0
      ? 0
      : vectorIdx === 1
        ? 3.2
        : vectorIdx === 2
          ? 7.5
          : 18 + vectorIdx * 4.5;

  // Mild preference for natural L(origin) -> R(direction) when unused
  const polarityPenalty = isLR ? 0 : 4.2;

  const ergo =
    (leftKey.dist + rightKey.dist) * 0.3 +
    (Math.abs(leftKey.rowOffset) + Math.abs(rightKey.rowOffset)) * 0.2;

  return {
    cost: strokeRankPenalty + vectorRankPenalty + polarityPenalty + ergo,
    reversedPolarity: !isLR,
  };
}

// Resolve the single Praying-Hands (手指合十) key encoding BOTH initial-stroke axis & expansion vector
function resolveHeshiKey(
  stroke: InitialStrokeId,
  vector: EndingVectorId,
  activeLeftSet: Set<string>,
  activeRightSet: Set<string>
): { keySpec: KineticKeySpec; cue: string } {
  const isLeftOrigin = stroke === 'heng' || stroke === 'pie' || stroke === 'zhe';
  const handAxis = isLeftOrigin ? '左橫斜' : '右豎點';
  const pickAvailable = (prefs: string[], fallbackPool: Set<string>): KineticKeySpec => {
    for (const k of prefs) {
      if (fallbackPool.has(k) && ALL_COMFORT_KEYS[k]) return ALL_COMFORT_KEYS[k];
    }
    const first = [...fallbackPool][0];
    return ALL_COMFORT_KEYS[first];
  };

  let prefs: string[];
  if (isLeftOrigin) {
    if (vector === 'up_gather') prefs = ['t', 'r', 'e', 'f'];
    else if (vector === 'up_lift') prefs = ['r', 't', 'e', 'f'];
    else if (vector === 'up_right_open') prefs = ['e', 'w', 'r', 'f'];
    else if (vector === 'up_right_far') prefs = ['w', 'e', 'r', 'f'];
    else if (vector === 'center_close') prefs = ['g', 'f', 'd', 's'];
    else if (vector === 'center_settle') prefs = ['f', 'g', 'd', 's'];
    else if (vector === 'center_spread') prefs = ['d', 'f', 'g', 's'];
    else if (vector === 'right_extend') prefs = ['s', 'd', 'f', 'g'];
    else if (vector === 'down_plumb') {
      prefs =
        stroke === 'pie'
          ? ['c', 'b', 'v', 'd']
          : stroke === 'zhe'
            ? ['x', 's', 'c', 'b']
            : ['b', 'v', 'f', 'g'];
    } else {
      // down_splay
      prefs =
        stroke === 'pie'
          ? ['c', 'v', 'e', 'd']
          : stroke === 'zhe'
            ? ['x', 'c', 'v', 's']
            : ['v', 'b', 'c', 'f'];
    }
    const keySpec = pickAvailable(prefs, activeLeftSet);
    return {
      keySpec,
      cue: `${handAxis} × ${ENDING_VECTOR_META[vector].short} (${keySpec.key.toUpperCase()})`,
    };
  }

  // Right Hand: vertical (shu) or dot (dian) origin
  if (vector === 'up_gather') prefs = ['y', 'u', 'i', 'h'];
  else if (vector === 'up_lift') prefs = ['u', 'i', 'y', 'h'];
  else if (vector === 'up_right_open') prefs = ['i', 'o', 'u', 'y'];
  else if (vector === 'up_right_far') prefs = ['o', 'i', 'u', 'y'];
  else if (vector === 'center_close') prefs = ['h', 'j', 'k', 'l'];
  else if (vector === 'center_settle') prefs = ['j', 'h', 'k', 'l'];
  else if (vector === 'center_spread') prefs = ['k', 'j', 'l', 'h'];
  else if (vector === 'right_extend') prefs = ['l', 'k', 'j', 'h'];
  else if (vector === 'down_plumb') prefs = ['n', 'm', 'h', 'j'];
  else prefs = ['m', 'n', 'k', 'l'];

  const keySpec = pickAvailable(prefs, activeRightSet);
  return {
    keySpec,
    cue: `${handAxis} × ${ENDING_VECTOR_META[vector].short} (${keySpec.key.toUpperCase()})`,
  };
}

export function runKineticSimulation(
  zoneId: KineticZoneId,
  altMode: KineticAlternationMode,
  stageId: KineticStageId,
  scriptMode: ScriptMode,
  blockMode: KineticBlockMode = 'connected',
  rhythmMode: KineticRhythmMode = 'heshi_compact'
): KineticSimulationResult {
  const zone = ZONE_DEFINITIONS[zoneId];
  const leftKeys = zone.left.map((k) => ALL_COMFORT_KEYS[k]);
  const rightKeys = zone.right.map((k) => ALL_COMFORT_KEYS[k]);
  const keys = [...leftKeys, ...rightKeys];
  const leftSet = new Set(zone.left);
  const rightSet = new Set(zone.right);

  const baseEntries = getBaseCorpus();
  const entries = baseEntries.map((e) => ({
    ...e,
    rawParts: e.parts,
    parts: blockMode === 'connected' ? mergePartsToConnectedBlocks(e.char, e.parts) : e.parts,
  }));

  const freqMap = new Map<string, number>();
  for (const entry of entries) {
    for (const r of entry.parts) {
      freqMap.set(r, (freqMap.get(r) || 0) + 1);
    }
  }
  const sortedRadicals = [...freqMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([radical, freq]) => ({ radical, freq }));

  const allCandidatePairs: Array<[KineticKeySpec, KineticKeySpec]> = [];
  for (const l of leftKeys) {
    for (const r of rightKeys) {
      allCandidatePairs.push([l, r]);
    }
  }
  if (altMode === 'bidirectional') {
    for (const r of rightKeys) {
      for (const l of leftKeys) {
        allCandidatePairs.push([r, l]);
      }
    }
  }

  const dyadUseCount = new Map<string, number>();
  const radicalMap = new Map<string, KineticRadicalSpec>();

  if (zoneId === 'kinetic_prefix22') {
    // Direction x Distance Self-Delimiting (A16 + B6, zero pinky, 0 prefix conflicts)
    const LEFT_A = ['f', 'd', 's', 'r', 'w', 't', 'c', 'x', 'b'];
    const RIGHT_A = ['j', 'k', 'l', 'u', 'o', 'y', 'n'];
    const LEFT_B = ['e', 'g', 'v'];
    const RIGHT_B = ['i', 'h', 'm'];

    const contextBuckets = new Map<string, Set<string>>();
    const posStats = new Map<string, { first: number; second: number; total: number }>();
    for (const entry of entries) {
      const parts = entry.parts;
      parts.forEach((p, i) => {
        const s = posStats.get(p) || { first: 0, second: 0, total: 0 };
        s.total++;
        if (i === 0) s.first++;
        else if (i === 1) s.second++;
        posStats.set(p, s);
        const frame = parts.map((x, j) => (j === i ? '_' : x)).join('|');
        const set = contextBuckets.get(frame) || new Set<string>();
        set.add(p);
        contextBuckets.set(frame, set);
      });
    }
    const conflictNeighbors = new Map<string, Set<string>>();
    for (const set of contextBuckets.values()) {
      if (set.size > 1) {
        for (const a of set) {
          const nb = conflictNeighbors.get(a) || new Set<string>();
          for (const b of set) if (a !== b) nb.add(b);
          conflictNeighbors.set(a, nb);
        }
      }
    }

    const vecScore = (k: string, vector: EndingVectorId): number => {
      const p = QWERTY_KEY_GEOM[k];
      const dist = getFingerReachDist(k);
      const isTop = p.row === 'top';
      const isHome = p.row === 'home';
      const isBot = p.row === 'bot';
      const isNear = dist < 0.25;
      const isFar = p.finger === 'L4' || p.finger === 'R4';
      switch (vector) {
        case 'up_gather':
          return (isTop ? 0 : isHome ? 1.0 : 2.6) + (isNear ? 0 : 0.6);
        case 'up_lift':
          return (isTop ? 0 : isHome ? 1.0 : 2.6) + (dist < 1.1 ? 0 : 0.8);
        case 'up_right_open':
        case 'up_right_far':
          return (isTop ? 0 : isHome ? 0.9 : 2.6) + (isFar ? 0 : 0.6);
        case 'center_close':
          return (isHome ? 0 : 2.0) + (isNear ? 0 : 0.8);
        case 'center_settle':
          return (isHome ? 0 : 2.0) + (isNear ? 0 : 0.7);
        case 'center_spread':
          return (isHome ? 0 : 1.6) + (p.finger === 'L3' || p.finger === 'R3' ? 0 : 0.6);
        case 'right_extend':
          return (isHome ? 0 : 1.5) + (isFar ? 0 : 0.7);
        case 'down_plumb':
          return (isBot ? 0 : isHome ? 0.9 : 2.4) + (isNear ? 0 : 0.6);
        case 'down_splay':
          return (isBot ? 0 : isHome ? 1.0 : 2.4) + (isFar ? 0.2 : 0.6);
        default:
          return dist;
      }
    };

    const daMembers = new Map<string, string[]>();
    const daFreqLoad = new Map<string, number>();
    const codeTupleUsed = new Set<string>();
    const daMidUsed = new Set<string>();
    const bSpecByKey = new Map(KINETIC_PREFIX_B_SPECS.map((s) => [s.key, s]));

    sortedRadicals.forEach(({ radical, freq }, idx) => {
      const seed = inferRadicalKinesthetics(radical);
      const ps = posStats.get(radical) || { first: 0, second: 0, total: 1 };
      const firstRatio = ps.first / Math.max(1, ps.total);
      const preferL =
        firstRatio >= 0.54
          ? true
          : firstRatio <= 0.4
            ? false
            : seed.stroke === 'heng' || seed.stroke === 'pie' || seed.stroke === 'zhe';
      const neighbors = conflictNeighbors.get(radical) || new Set<string>();

      let bestDa = LEFT_A[0];
      let bestDaSc = Infinity;
      for (const k of [...LEFT_A, ...RIGHT_A]) {
        const p = QWERTY_KEY_GEOM[k];
        const dist = getFingerReachDist(k);
        const handPen = p.hand === (preferL ? 'L' : 'R') ? 0 : 5.5;
        const rowPen = p.row === 'home' ? 0 : p.row === 'top' ? 2.4 : 3.6;
        let conflictPen = 0;
        const mems = daMembers.get(k) || [];
        for (const m of mems) if (neighbors.has(m)) conflictPen += 22;
        const fLoad = daFreqLoad.get(k) || 0;
        const tierWeight = freq >= 10 ? 3.5 : freq >= 4 ? 2.2 : 1.0;
        const sc =
          conflictPen +
          handPen +
          (rowPen + dist * 4.2) * tierWeight +
          fLoad * 0.04 +
          mems.length * 0.55;
        if (sc < bestDaSc) {
          bestDaSc = sc;
          bestDa = k;
        }
      }
      const mems = daMembers.get(bestDa) || [];
      mems.push(radical);
      daMembers.set(bestDa, mems);
      daFreqLoad.set(bestDa, (daFreqLoad.get(bestDa) || 0) + freq);

      const daSpec = ALL_COMFORT_KEYS[bestDa];
      const daIsL = daSpec.hand === 'L';
      const oppB = daIsL ? RIGHT_B : LEFT_B;
      const sameB = daIsL ? LEFT_B : RIGHT_B;
      const oppBOrder = [...oppB].sort((a, b) => vecScore(a, seed.vector) - vecScore(b, seed.vector));

      let prefixMid: KineticKeySpec | undefined;
      let prefixEndB: KineticKeySpec | undefined;
      let prefixIsXiao = false;

      if (idx < 52) {
        for (const bk of oppBOrder) {
          const tup = bestDa + bk;
          if (!codeTupleUsed.has(tup)) {
            codeTupleUsed.add(tup);
            prefixEndB = ALL_COMFORT_KEYS[bk];
            prefixIsXiao = true;
            break;
          }
        }
      }

      if (!prefixEndB) {
        const oppA = daIsL ? RIGHT_A : LEFT_A;
        const bCand = [...sameB].sort((a, b) => vecScore(a, seed.vector) - vecScore(b, seed.vector));
        let bestMid = oppA[0];
        let bestEnd = bCand[0];
        let bestSc = Infinity;
        for (const mk of oppA) {
          const mp = QWERTY_KEY_GEOM[mk];
          const mDist = getFingerReachDist(mk);
          const mRowPen = mp.row === 'home' ? 0 : mp.row === 'top' ? 2.2 : 3.2;
          const dmUsed = daMidUsed.has(bestDa + mk) ? 32 : 0;
          const vSc = vecScore(mk, seed.vector);
          for (let bi = 0; bi < bCand.length; bi++) {
            const bk = bCand[bi];
            const tup = bestDa + mk + bk;
            const used = codeTupleUsed.has(tup) ? 250 : 0;
            const sc = used + dmUsed + vSc * 0.9 + (mRowPen + mDist * 4.2) * 1.4 + bi * 1.1;
            if (sc < bestSc) {
              bestSc = sc;
              bestMid = mk;
              bestEnd = bk;
            }
          }
        }
        codeTupleUsed.add(bestDa + bestMid + bestEnd);
        daMidUsed.add(bestDa + bestMid);
        prefixMid = ALL_COMFORT_KEYS[bestMid];
        prefixEndB = ALL_COMFORT_KEYS[bestEnd];
        prefixIsXiao = false;
      }

      const lm = LINGMING_ROOT_MAP.get(radical);
      const bMeta = bSpecByKey.get(prefixEndB.key);
      const reachTag =
        getFingerReachDist(bestDa) < 0.25
          ? '近距零移'
          : daSpec.row === 'top'
            ? '上排中距'
            : '下排遠距';
      const fullMa = prefixIsXiao
        ? bestDa + prefixEndB.key
        : bestDa + (prefixMid?.key || '') + prefixEndB.key;
      const cue = prefixIsXiao
        ? `小根·${reachTag}(${bestDa.toUpperCase()}) → ${bMeta?.arrow || ''}${bMeta?.tierLabel || ''}(${prefixEndB.key.toUpperCase()})`
        : `大根·${reachTag}(${bestDa.toUpperCase()})→對側中碼(${(prefixMid?.key || '').toUpperCase()})→${bMeta?.arrow || ''}(${prefixEndB.key.toUpperCase()})`;

      radicalMap.set(radical, {
        radical,
        freq,
        originStroke: seed.stroke,
        endingVector: seed.vector,
        intentCue: cue,
        dyad: fullMa,
        key1: daSpec,
        key2: prefixMid || prefixEndB,
        heshiKey: daSpec,
        heshiCue: `${reachTag}(${bestDa.toUpperCase()}) · ${bMeta?.shortTag || ''}`,
        isStarter12: STARTER_12_SET.has(radical),
        isCore48: idx < 48,
        isReversedPolarity: daSpec.hand === 'R',
        ergonomicCost:
          Math.round(
            (getFingerReachDist(bestDa) +
              getFingerReachDist((prefixMid || prefixEndB).key)) *
              10
          ) / 10,
        lingmingMa: lm?.ma,
        prefixMid,
        prefixEndB,
        prefixIsXiao,
      });
    });
  } else if (
    zoneId === 'home_dir8' ||
    zoneId === 'home_dir4' ||
    zoneId === 'three_row_dir8' ||
    zoneId === 'three_row_full26'
  ) {
    const HOME_GROUP_BOOK: Record<string, string> = {
      // F: 一橫基主脈
      '一': 'f', '木': 'f', '土': 'f', '艹': 'f', '二': 'f', '十': 'f', '大': 'f', '寸': 'f',
      '王': 'f', '扌': 'f', '戈': 'f', '厂': 'f', '卌': 'f', '丰': 'f', '士': 'f', '工': 'f',
      '丁': 'f', '車': 'f', '车': 'f', '石': 'f', '耳': 'f', '頁': 'f', '页': 'f', '戊': 'f',
      '七': 'f', '雨': 'f', '廾': 'f', '夫': 'f', '古': 'f', '尤': 'f', '耂': 'f', '𠂇': 'f',
      '三': 'f', '未': 'f', '末': 'f', '干': 'f', '丈': 'f', '天': 'f', '不': 'f', '可': 'f',
      '平': 'f', '百': 'f', '而': 'f', '豆': 'f', '至': 'f', '互': 'f', '長': 'f', '长': 'f',
      // G: 折轉勾連
      '又': 'g', '乙': 'g', '厶': 'g', '糸': 'g', '纟': 'g', '阝': 'g', '彐': 'g', '女': 'g',
      '刀': 'g', '尸': 'g', '力': 'g', '幺': 'g', '习': 'g', '巳': 'g', '艮': 'g', '卩': 'g',
      '子': 'g', '凵': 'g', '己': 'g', '弓': 'g', '巴': 'g', '乃': 'g', '卯': 'g', '乚': 'g',
      // D: 斜撇斜掠
      '人': 'd', '月': 'd', '亻': 'd', '丿': 'd', '八': 'd', '勹': 'd', '隹': 'd', '匕': 'd',
      '儿': 'd', '夕': 'd', '乂': 'd', '禾': 'd', '几': 'd', '彳': 'd', '攵': 'd', '竹': 'd',
      '夂': 'd', '欠': 'd', '斤': 'd', '殳': 'd', '爪': 'd', '舌': 'd', '饣': 'd', '彡': 'd',
      '食': 'd', '钅': 'd', '牛': 'd', '生': 'd', '手': 'd', '舟': 'd', '鬼': 'd', '身': 'd',
      '魚': 'd', '鱼': 'd', '鳥': 'd', '鸟': 'd', '风': 'd', '風': 'd', '片': 'd', '角': 'd',
      // S: 框圍並立
      '囗': 's', '巾': 's', '冂': 's', '貝': 's', '贝': 's', '門': 's', '罒': 's', '山': 's',
      '冊': 's', '皿': 's', '黑': 's', '同': 's', '周': 's', '網': 's', '网': 's',
      // H: 口日合框
      '口': 'h', '日': 'h', '田': 'h', '目': 'h', '里': 'h', '白': 'h', '自': 'h', '西': 'h',
      '覀': 'h', '甲': 'h', '申': 'h', '由': 'h', '曲': 'h', '面': 'h', '甘': 'h', '臼': 'h',
      // J: 點水心火
      '丶': 'j', '氵': 'j', '心': 'j', '火': 'j', '灬': 'j', '忄': 'j', '水': 'j', '氺': 'j',
      '米': 'j', '羊': 'j', '乀': 'j', '⺀': 'j', '衤': 'j', '冰': 'j', '永': 'j', '礻': 'j',
      // K: 冠蓋言立
      '宀': 'k', '冖': 'k', '丷': 'k', '亠': 'k', '立': 'k', '言': 'k', '讠': 'k', '广': 'k',
      '门': 'k', '穴': 'k', '户': 'k', '方': 'k', '亡': 'k', '文': 'k', '音': 'k', '高': 'k',
      '麻': 'k', '鹿': 'k', '辛': 'k', '首': 'k',
      // L: 豎柱走之
      '丨': 'l', '辶': 'l', '亅': 'l', '⺌': 'l', '小': 'l', '刂': 'l', '止': 'l', '虫': 'l',
      '虍': 'l', '上': 'l', '卜': 'l', '占': 'l', '業': 'l', '业': 'l', '師': 'l', '川': 'l',
    };

    const pickHomeGroup = (rad: string, stroke: InitialStrokeId): string => {
      if (HOME_GROUP_BOOK[rad]) return HOME_GROUP_BOOK[rad];
      if (stroke === 'heng') return 'f';
      if (stroke === 'zhe') return 'g';
      if (stroke === 'pie') return 'd';
      if (stroke === 'shu') return 'l';
      return 'k';
    };

    const isThreeRow = zoneId === 'three_row_dir8' || zoneId === 'three_row_full26';
    const isFull26 = zoneId === 'three_row_full26';
    const compass = zoneId === 'home_dir4' ? OPPOSITE_DIR4_COMPASS : OPPOSITE_DIR8_COMPASS;

    const vecToDirOrder: Record<EndingVectorId, number[]> =
      zoneId === 'home_dir4'
        ? {
            up_gather: [0, 1, 2, 3],
            up_lift: [0, 2, 1, 3],
            up_right_open: [0, 2, 1, 3],
            up_right_far: [0, 2, 1, 3],
            center_close: [1, 0, 3, 2],
            center_settle: [1, 2, 0, 3],
            center_spread: [2, 1, 0, 3],
            right_extend: [2, 0, 1, 3],
            down_plumb: [3, 1, 2, 0],
            down_splay: [3, 2, 1, 0],
          }
        : {
            up_gather: [0, 1, 2, 3, 4, 5, 6, 7],
            up_lift: [1, 2, 0, 4, 5, 3, 6, 7],
            up_right_open: [2, 1, 5, 0, 4, 7, 3, 6],
            up_right_far: [2, 5, 1, 0, 7, 4, 3, 6],
            center_close: [3, 4, 0, 6, 1, 5, 2, 7],
            center_settle: [4, 3, 5, 1, 6, 0, 2, 7],
            center_spread: [5, 4, 2, 7, 3, 1, 6, 0],
            right_extend: [5, 2, 4, 7, 1, 3, 6, 0],
            down_plumb: [6, 7, 3, 4, 5, 0, 1, 2],
            down_splay: [7, 6, 5, 4, 2, 3, 1, 0],
          };

    const leftHomeKeys = ['f', 'g', 'd', 's'];
    const rightHomeKeys = ['h', 'j', 'k', 'l'];
    const homeSet = new Set([...leftHomeKeys, ...rightHomeKeys]);
    const topSet = new Set(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']);
    const pinkySet = new Set(['q', 'a', 'z', 'p']);

    const leftAll3Row = isFull26
      ? ['f', 'g', 'd', 's', 'r', 't', 'e', 'w', 'v', 'b', 'c', 'x', 'a', 'q', 'z']
      : ['f', 'g', 'd', 's', 'r', 't', 'e', 'w', 'v', 'b', 'c', 'x'];
    const rightAll3Row = isFull26
      ? ['h', 'j', 'k', 'l', 'u', 'y', 'i', 'o', 'n', 'm', 'p']
      : ['h', 'j', 'k', 'l', 'u', 'y', 'i', 'o', 'n', 'm'];

    const extraRightOppFull26: Array<{ key: string; arrow: string; label: string }> = [
      { key: 'o', arrow: '↗', label: '遠展' },
      { key: 'k', arrow: '↔', label: '分撐' },
      { key: 'p', arrow: '↗', label: '極遠' },
    ];
    const extraLeftOppFull26: Array<{ key: string; arrow: string; label: string }> = [
      { key: 'w', arrow: '↖', label: '遠展' },
      { key: 'd', arrow: '↔', label: '分撐' },
      { key: 'c', arrow: '↙', label: '斜掠' },
      { key: 'x', arrow: '↙', label: '折沉' },
    ];

    const colAnchorByKey = new Map<string, typeof HOME_GROUP_ANCHORS[number]>();
    for (const h of HOME_GROUP_ANCHORS) {
      for (const ck of h.columnKeys) colAnchorByKey.set(ck, h);
    }

    sortedRadicals.forEach(({ radical, freq }, idx) => {
      const seed = inferRadicalKinesthetics(radical);
      let prefHome = pickHomeGroup(radical, seed.stroke);
      if (altMode === 'strict_lr' && rightHomeKeys.includes(prefHome)) {
        prefHome =
          seed.stroke === 'shu'
            ? prefHome === 'h'
              ? 's'
              : 'd'
            : seed.stroke === 'dian'
              ? 'g'
              : 'f';
      }

      const isLeftPref = leftHomeKeys.includes(prefHome);
      const prefAnchor = HOME_GROUP_ANCHORS.find((h) => h.key === prefHome)!;
      const dirOrder = vecToDirOrder[seed.vector] || compass.map((c) => c.dirIdx);

      // Build ordered candidate K1 list:
      // - 1-row modes: strictly same-hand home 4 keys
      // - 3-row modes: own vertical finger column first (Home -> Top -> Bot), then same-hand comfort keys,
      //   and in full26 allow opposite-hand/pinky overflow ONLY so every single radical gets a unique 1-to-1 slot
      let k1Candidates: Array<{ key: string; colPen: number }>;
      if (!isThreeRow) {
        const sameHandHomes = isLeftPref
          ? [prefHome, ...leftHomeKeys.filter((k) => k !== prefHome)]
          : [prefHome, ...rightHomeKeys.filter((k) => k !== prefHome)];
        k1Candidates = sameHandHomes.map((k, i) => ({
          key: k,
          colPen: i === 0 ? 0 : 4.2 + i * 1.4,
        }));
      } else {
        const ownCol = prefAnchor.columnKeys;
        const sameHandPool = isLeftPref ? leftAll3Row : rightAll3Row;
        const otherHandPool = isLeftPref ? rightAll3Row : leftAll3Row;
        k1Candidates = [
          ...ownCol.map((k) => ({ key: k, colPen: 0 })),
          ...sameHandPool
            .filter((k) => !ownCol.includes(k))
            .map((k, i) => ({ key: k, colPen: 28 + i * 0.6 })),
        ];
        if (isFull26 && altMode !== 'strict_lr') {
          k1Candidates.push(
            ...otherHandPool.map((k, i) => ({ key: k, colPen: 62 + i * 0.6 }))
          );
        }
      }

      let bestK1 = ALL_COMFORT_KEYS[prefHome];
      let bestK2 = ALL_COMFORT_KEYS[isLeftPref ? compass[0].rightKey : compass[0].leftMirrorKey];
      let bestArrow = compass[0].arrow;
      let bestDirLabel = compass[0].label;
      let bestScore = Infinity;

      for (const cand of k1Candidates) {
        const hk = cand.key;
        const k1Spec = ALL_COMFORT_KEYS[hk];
        if (!k1Spec) continue;
        const isL = k1Spec.hand === 'L';
        const rowPen = !isThreeRow
          ? 0
          : homeSet.has(hk)
            ? 0
            : topSet.has(hk)
              ? 10
              : 18;
        const pinkyPen1 = pinkySet.has(hk) ? 48 : 0;

        // Primary compass directions (8 or 4)
        dirOrder.forEach((di, rank) => {
          const dirSpec = compass[di];
          if (!dirSpec) return;
          const oppKeyChar = isL ? dirSpec.rightKey : dirSpec.leftMirrorKey;
          const k2Spec = ALL_COMFORT_KEYS[oppKeyChar];
          if (!k2Spec) return;
          const code = hk + oppKeyChar;
          const used = dyadUseCount.get(code) ?? 0;
          const score = used * 220 + cand.colPen + rowPen + pinkyPen1 + rank * 2.2;
          if (score < bestScore) {
            bestScore = score;
            bestK1 = k1Spec;
            bestK2 = k2Spec;
            bestArrow = dirSpec.arrow;
            bestDirLabel = dirSpec.label;
          }
        });

        // Extended outer directions in full26 mode (guarantees 269/269 1-to-1 coverage!)
        if (isFull26) {
          const extras = isL ? extraRightOppFull26 : extraLeftOppFull26;
          extras.forEach((ex, exIdx) => {
            const k2Spec = ALL_COMFORT_KEYS[ex.key];
            if (!k2Spec) return;
            const code = hk + ex.key;
            const used = dyadUseCount.get(code) ?? 0;
            const pinkyPen2 = pinkySet.has(ex.key) ? 42 : 0;
            const score = used * 220 + cand.colPen + rowPen + pinkyPen1 + pinkyPen2 + 20 + exIdx * 2.4;
            if (score < bestScore) {
              bestScore = score;
              bestK1 = k1Spec;
              bestK2 = k2Spec;
              bestArrow = ex.arrow;
              bestDirLabel = ex.label;
            }
          });
        }
      }

      const code = bestK1.key + bestK2.key;
      dyadUseCount.set(code, (dyadUseCount.get(code) ?? 0) + 1);
      const lm = LINGMING_ROOT_MAP.get(radical);
      const colMeta = colAnchorByKey.get(bestK1.key);
      const rowTag = bestK1.row === 'home' ? '中排' : bestK1.row === 'top' ? '上排' : '下排';
      const colTag = colMeta ? colMeta.shortTag : rowTag;

      radicalMap.set(radical, {
        radical,
        freq,
        originStroke: seed.stroke,
        endingVector: seed.vector,
        intentCue: `${colTag}${isThreeRow ? `·${rowTag}` : ''}(${bestK1.key.toUpperCase()}) → ${bestArrow}${bestDirLabel}(${bestK2.key.toUpperCase()})`,
        dyad: code,
        key1: bestK1,
        key2: bestK2,
        heshiKey: bestK1,
        heshiCue: `${colTag}(${bestK1.key.toUpperCase()}) · ${bestArrow}${bestDirLabel}`,
        isStarter12: STARTER_12_SET.has(radical),
        isCore48: idx < 48,
        isReversedPolarity: bestK1.hand === 'R',
        ergonomicCost: bestK1.dist + bestK2.dist,
        lingmingMa: lm?.ma,
      });
    });
  } else {
    // Pass 1: Lock explicit preferredDyad anchors if available in active zone & unused
    sortedRadicals.forEach(({ radical, freq }, idx) => {
      const seed = inferRadicalKinesthetics(radical);
      const preset = seed.preferredDyad;
      if (!preset || preset.length !== 2) return;
      const k1 = ALL_COMFORT_KEYS[preset[0]];
      const k2 = ALL_COMFORT_KEYS[preset[1]];
      if (!k1 || !k2) return;
      const validInZone =
        (leftSet.has(k1.key) && rightSet.has(k2.key)) ||
        (altMode === 'bidirectional' && rightSet.has(k1.key) && leftSet.has(k2.key));
      if (!validInZone || (dyadUseCount.get(preset) ?? 0) > 0) return;

      dyadUseCount.set(preset, 1);
      const { cost, reversedPolarity } = scoreKinestheticPair(k1, k2, seed, zoneId);
      const heshi = resolveHeshiKey(seed.stroke, seed.vector, leftSet, rightSet);
      const lm = LINGMING_ROOT_MAP.get(radical);
      radicalMap.set(radical, {
        radical,
        freq,
        originStroke: seed.stroke,
        endingVector: seed.vector,
        intentCue: seed.cue,
        dyad: preset,
        key1: k1,
        key2: k2,
        heshiKey: heshi.keySpec,
        heshiCue: heshi.cue,
        isStarter12: STARTER_12_SET.has(radical),
        isCore48: idx < 48,
        isReversedPolarity: reversedPolarity,
        ergonomicCost: cost,
        lingmingMa: lm?.ma,
      });
    });

    // Pass 2: Assign remaining blocks/radicals in descending frequency order
    sortedRadicals.forEach(({ radical, freq }, idx) => {
      if (radicalMap.has(radical)) return;
      const seed = inferRadicalKinesthetics(radical);

      let bestPair: [KineticKeySpec, KineticKeySpec] | null = null;
      let bestScore = Infinity;
      let bestCost = 0;
      let bestReversed = false;

      for (const pair of allCandidatePairs) {
        const code = pair[0].key + pair[1].key;
        const usedCount = dyadUseCount.get(code) ?? 0;
        const { cost, reversedPolarity } = scoreKinestheticPair(pair[0], pair[1], seed, zoneId);
        const totalScore = usedCount * 140 + cost;
        if (totalScore < bestScore) {
          bestScore = totalScore;
          bestPair = pair;
          bestCost = cost;
          bestReversed = reversedPolarity;
        }
      }

      if (!bestPair) return;
      const code = bestPair[0].key + bestPair[1].key;
      dyadUseCount.set(code, (dyadUseCount.get(code) ?? 0) + 1);
      const heshi = resolveHeshiKey(seed.stroke, seed.vector, leftSet, rightSet);
      const lm = LINGMING_ROOT_MAP.get(radical);

      radicalMap.set(radical, {
        radical,
        freq,
        originStroke: seed.stroke,
        endingVector: seed.vector,
        intentCue: seed.cue,
        dyad: code,
        key1: bestPair[0],
        key2: bestPair[1],
        heshiKey: heshi.keySpec,
        heshiCue: heshi.cue,
        isStarter12: STARTER_12_SET.has(radical),
        isCore48: idx < 48,
        isReversedPolarity: bestReversed,
        ergonomicCost: bestCost,
        lingmingMa: lm?.ma,
      });
    });
  }

  const scriptFiltered = entries.filter((e) => matchesScript(e.script, scriptMode));

  let stageEntries: Array<RawCorpusEntry & { rawParts: string[] }>;
  if (stageId === 'starter12') {
    const starterOnly = scriptFiltered.filter((e) =>
      e.parts.every((p) => STARTER_12_SET.has(p))
    );
    if (starterOnly.length >= 25) {
      stageEntries = starterOnly;
    } else {
      const top20 = new Set(sortedRadicals.slice(0, 20).map((r) => r.radical));
      stageEntries = scriptFiltered.filter((e) => e.parts.every((p) => top20.has(p)));
    }
  } else if (stageId === 'core48') {
    const top48 = new Set(sortedRadicals.slice(0, 48).map((r) => r.radical));
    stageEntries = scriptFiltered.filter((e) => e.parts.every((p) => top48.has(p)));
  } else if (stageId === 'common500') {
    stageEntries = scriptFiltered.slice(0, 500);
  } else {
    stageEntries = scriptFiltered;
  }

  const chars: KineticCharEntry[] = [];
  const codeBuckets = new Map<string, KineticCharEntry[]>();

  let totalTransitions = 0;
  let totalAltTransitions = 0;
  let totalKeystrokes = 0;
  let totalHomeHits = 0;
  let totalSameFinger = 0;
  let totalDistSum = 0;
  const activeRadSet = new Set<string>();

  for (const entry of stageEntries) {
    const radSpecs = entry.parts
      .map((p) => radicalMap.get(p))
      .filter((r): r is KineticRadicalSpec => Boolean(r));
    if (radSpecs.length === 0) continue;
    for (const r of radSpecs) activeRadSet.add(r.radical);

    let keySpecs: KineticKeySpec[] = [];
    if (zoneId === 'kinetic_prefix22') {
      // Exact self-delimiting 4-code prefix grammar (0 prefix conflicts, zero Space key!)
      const len = radSpecs.length;
      const o = radSpecs[0];
      const d = radSpecs[1];
      const h = radSpecs[2];
      const a = radSpecs[len - 1];
      const oXiao = Boolean(o.prefixIsXiao);
      const aXiao = Boolean(a.prefixIsXiao);
      const oMid = o.prefixMid || o.key2;
      const oEnd = o.prefixEndB || o.key2;
      const aMid = a.prefixMid || a.key2;
      const aEnd = a.prefixEndB || a.key2;
      if (oXiao) {
        if (len === 1) keySpecs = [o.key1, oEnd];
        else if (len === 2)
          keySpecs = aXiao ? [o.key1, a.key1, aEnd] : [o.key1, a.key1, aMid, aEnd];
        else if (len === 3) keySpecs = [o.key1, d.key1, a.key1, aXiao ? aEnd : aMid];
        else keySpecs = [o.key1, d.key1, h.key1, a.key1];
      } else {
        if (len === 1) keySpecs = [o.key1, oMid, oEnd];
        else if (len === 2) keySpecs = [o.key1, oMid, a.key1, aXiao ? aEnd : aMid];
        else keySpecs = [o.key1, oMid, d.key1, a.key1];
      }
    } else if (rhythmMode === 'heshi_1k') {
      // Pure Praying-Hands 1-key-per-block (avg ~2.35 keys, zero truncation)
      for (const r of radSpecs) {
        keySpecs.push(r.heshiKey);
      }
    } else if (rhythmMode === 'heshi_compact') {
      // Compact Praying-Hands (2-4 keys, avg ~2.95 keys):
      // 1 block -> full 2-key gesture; 2 blocks -> Block1 dyad + Block2 Heshi key (3k);
      // 3+ blocks -> 1 Heshi key per block (3~4k)
      if (radSpecs.length === 1) {
        keySpecs = [radSpecs[0].key1, radSpecs[0].key2];
      } else if (radSpecs.length === 2) {
        keySpecs = [radSpecs[0].key1, radSpecs[0].key2, radSpecs[1].heshiKey];
      } else {
        keySpecs = radSpecs.map((r) => r.heshiKey);
      }
    } else if (rhythmMode === 'event_stream') {
      // Full 2-key event stream per block (2~8 keys)
      for (const r of radSpecs) {
        keySpecs.push(r.key1, r.key2);
      }
    } else {
      // Fixed 4-key truncation mode
      if (radSpecs.length === 1) {
        keySpecs = [radSpecs[0].key1, radSpecs[0].key2];
      } else if (radSpecs.length === 2) {
        keySpecs = [
          radSpecs[0].key1,
          radSpecs[0].key2,
          radSpecs[1].key1,
          radSpecs[1].key2,
        ];
      } else {
        const last = radSpecs[radSpecs.length - 1];
        keySpecs = [
          radSpecs[0].key1,
          radSpecs[0].key2,
          radSpecs[1].key1,
          last.key2,
        ];
      }
    }

    const code = keySpecs.map((k) => k.key).join('');
    let altCount = 0;
    const transCount = Math.max(0, keySpecs.length - 1);
    let homeHits = 0;
    let distSum = 0;

    for (let i = 0; i < keySpecs.length; i++) {
      const ks = keySpecs[i];
      totalKeystrokes++;
      if (ks.row === 'home') {
        homeHits++;
        totalHomeHits++;
      }
      distSum += ks.dist;
      totalDistSum += ks.dist;

      if (i > 0) {
        totalTransitions++;
        const prev = keySpecs[i - 1];
        if (prev.hand !== ks.hand) {
          altCount++;
          totalAltTransitions++;
        } else if (prev.finger === ks.finger && prev.key !== ks.key) {
          totalSameFinger++;
        }
      }
    }

    const item: KineticCharEntry = {
      char: entry.char,
      parts: entry.parts,
      rawParts: entry.rawParts,
      code,
      script: entry.script,
      radicals: radSpecs,
      keySpecs,
      alternationCount: altCount,
      transitionCount: transCount,
      homeRowHits: homeHits,
      totalDist: distSum,
      isCoreDrill: entry.isCoreDrill,
    };

    chars.push(item);
    const bucket = codeBuckets.get(code);
    if (bucket) bucket.push(item);
    else codeBuckets.set(code, [item]);
  }

  const collisions: KineticCollisionGroup[] = [...codeBuckets.entries()]
    .filter(([, group]) => group.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([code, group]) => ({ code, chars: group }));

  const uniqueCodes = codeBuckets.size;
  const totalChars = chars.length;
  const collisionChars = totalChars - uniqueCodes;

  const radicals = sortedRadicals
    .map(({ radical }) => radicalMap.get(radical))
    .filter((r): r is KineticRadicalSpec => Boolean(r));

  return {
    zoneId,
    altMode,
    stageId,
    scriptMode,
    blockMode,
    rhythmMode,
    keys,
    leftKeys,
    rightKeys,
    radicals,
    radicalMap,
    chars,
    collisions,
    metrics: {
      totalChars,
      uniqueCodes,
      firstChoiceRate: totalChars > 0 ? (uniqueCodes / totalChars) * 100 : 100,
      collisionChars,
      wholeWordAltRate:
        totalTransitions > 0 ? (totalAltTransitions / totalTransitions) * 100 : 100,
      radicalAltRate: 100,
      homeRowRate: totalKeystrokes > 0 ? (totalHomeHits / totalKeystrokes) * 100 : 0,
      sameFingerRate:
        totalTransitions > 0 ? (totalSameFinger / totalTransitions) * 100 : 0,
      avgCenterDist: totalKeystrokes > 0 ? totalDistSum / totalKeystrokes : 0,
      avgCodeLength: totalChars > 0 ? totalKeystrokes / totalChars : 0,
      activeRadicalCount: activeRadSet.size,
    },
  };
}

// Physical QWERTY coordinates (standard staggered key units, 1u = 19.05mm)
interface PhysicalKeyGeom {
  x: number;
  y: number;
  hand: 'L' | 'R';
  finger: 'L5' | 'L4' | 'L3' | 'L2' | 'R2' | 'R3' | 'R4' | 'R5';
  row: KineticRow;
  pinky: boolean;
}

const QWERTY_KEY_GEOM: Record<string, PhysicalKeyGeom> = {
  q: { x: 0.0, y: 0, hand: 'L', finger: 'L5', row: 'top', pinky: true },
  w: { x: 1.0, y: 0, hand: 'L', finger: 'L4', row: 'top', pinky: false },
  e: { x: 2.0, y: 0, hand: 'L', finger: 'L3', row: 'top', pinky: false },
  r: { x: 3.0, y: 0, hand: 'L', finger: 'L2', row: 'top', pinky: false },
  t: { x: 4.0, y: 0, hand: 'L', finger: 'L2', row: 'top', pinky: false },
  y: { x: 5.0, y: 0, hand: 'R', finger: 'R2', row: 'top', pinky: false },
  u: { x: 6.0, y: 0, hand: 'R', finger: 'R2', row: 'top', pinky: false },
  i: { x: 7.0, y: 0, hand: 'R', finger: 'R3', row: 'top', pinky: false },
  o: { x: 8.0, y: 0, hand: 'R', finger: 'R4', row: 'top', pinky: false },
  p: { x: 9.0, y: 0, hand: 'R', finger: 'R5', row: 'top', pinky: true },
  a: { x: 0.25, y: 1, hand: 'L', finger: 'L5', row: 'home', pinky: true },
  s: { x: 1.25, y: 1, hand: 'L', finger: 'L4', row: 'home', pinky: false },
  d: { x: 2.25, y: 1, hand: 'L', finger: 'L3', row: 'home', pinky: false },
  f: { x: 3.25, y: 1, hand: 'L', finger: 'L2', row: 'home', pinky: false },
  g: { x: 4.25, y: 1, hand: 'L', finger: 'L2', row: 'home', pinky: false },
  h: { x: 5.25, y: 1, hand: 'R', finger: 'R2', row: 'home', pinky: false },
  j: { x: 6.25, y: 1, hand: 'R', finger: 'R2', row: 'home', pinky: false },
  k: { x: 7.25, y: 1, hand: 'R', finger: 'R3', row: 'home', pinky: false },
  l: { x: 8.25, y: 1, hand: 'R', finger: 'R4', row: 'home', pinky: false },
  z: { x: 0.75, y: 2, hand: 'L', finger: 'L5', row: 'bot', pinky: true },
  x: { x: 1.75, y: 2, hand: 'L', finger: 'L4', row: 'bot', pinky: false },
  c: { x: 2.75, y: 2, hand: 'L', finger: 'L3', row: 'bot', pinky: false },
  v: { x: 3.75, y: 2, hand: 'L', finger: 'L2', row: 'bot', pinky: false },
  b: { x: 4.75, y: 2, hand: 'L', finger: 'L2', row: 'bot', pinky: false },
  n: { x: 5.75, y: 2, hand: 'R', finger: 'R2', row: 'bot', pinky: false },
  m: { x: 6.75, y: 2, hand: 'R', finger: 'R2', row: 'bot', pinky: false },
};

const FINGER_HOME_POS: Record<PhysicalKeyGeom['finger'], { x: number; y: number }> = {
  L5: { x: 0.25, y: 1 },
  L4: { x: 1.25, y: 1 },
  L3: { x: 2.25, y: 1 },
  L2: { x: 3.25, y: 1 },
  R2: { x: 6.25, y: 1 },
  R3: { x: 7.25, y: 1 },
  R4: { x: 8.25, y: 1 },
  R5: { x: 9.25, y: 1 },
};

function getFingerReachDist(key: string): number {
  const g = QWERTY_KEY_GEOM[key];
  if (!g) return 1.5;
  const home = FINGER_HOME_POS[g.finger];
  return Math.hypot(g.x - home.x, g.y - home.y);
}

export interface BenchmarkSchemeMetrics {
  id: 'lingming_official' | 'kinetic_prefix22' | 'three_row_dir8';
  label: string;
  keyCountLabel: string;
  mechanism: string;
  totalChars: number;
  uniqueRate: number;
  collisionChars: number;
  avgCodeLength: number;
  prefixConflicts: number;
  altRate: number;
  homeRate: number;
  sameFingerRate: number;
  pinkyRate: number;
  avgTravelPerChar: number;
}

export interface BenchmarkCharSample {
  char: string;
  parts: string[];
  lingmingCode: string;
  lingmingTravel: number;
  lingmingAltPct: number;
  lingmingHasSameFinger: boolean;
  lingmingHasPinky: boolean;
  kineticCode: string;
  kineticTravel: number;
  kineticAltPct: number;
  kineticHasSameFinger: boolean;
  kineticHasPinky: boolean;
}

export interface LingmingVsKineticBenchmark {
  stageId: KineticStageId;
  scriptMode: ScriptMode;
  totalChars: number;
  lingming: BenchmarkSchemeMetrics;
  kineticPrefix: BenchmarkSchemeMetrics;
  threeRowDir8: BenchmarkSchemeMetrics;
  samples: BenchmarkCharSample[];
}

function measureCodeStats(code: string): {
  travel: number;
  altCount: number;
  transCount: number;
  homeHits: number;
  sameFinger: number;
  pinkyHits: number;
} {
  let travel = 0;
  let altCount = 0;
  let transCount = 0;
  let homeHits = 0;
  let sameFinger = 0;
  let pinkyHits = 0;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const g = QWERTY_KEY_GEOM[ch];
    if (!g) continue;
    travel += getFingerReachDist(ch);
    if (g.row === 'home') homeHits++;
    if (g.pinky) pinkyHits++;
    if (i > 0) {
      const prev = QWERTY_KEY_GEOM[code[i - 1]];
      if (prev) {
        transCount++;
        if (prev.hand !== g.hand) altCount++;
        else if (prev.finger === g.finger && code[i - 1] !== ch) sameFinger++;
      }
    }
  }
  return { travel, altCount, transCount, homeHits, sameFinger, pinkyHits };
}

function evaluateCorpusScheme(
  id: BenchmarkSchemeMetrics['id'],
  label: string,
  keyCountLabel: string,
  mechanism: string,
  items: Array<{ char: string; code: string }>
): BenchmarkSchemeMetrics {
  const buckets = new Map<string, string[]>();
  let totalKeys = 0;
  let homeKeys = 0;
  let pinkyKeys = 0;
  let totalTrans = 0;
  let altTrans = 0;
  let sameFinger = 0;
  let totalTravel = 0;

  for (const it of items) {
    const arr = buckets.get(it.code);
    if (arr) arr.push(it.char);
    else buckets.set(it.code, [it.char]);
    const st = measureCodeStats(it.code);
    totalKeys += it.code.length;
    homeKeys += st.homeHits;
    pinkyKeys += st.pinkyHits;
    totalTrans += st.transCount;
    altTrans += st.altCount;
    sameFinger += st.sameFinger;
    totalTravel += st.travel;
  }

  let prefixConflicts = 0;
  for (const c of buckets.keys()) {
    for (let l = 1; l < c.length; l++) {
      if (buckets.has(c.slice(0, l))) {
        prefixConflicts++;
        break;
      }
    }
  }

  const n = Math.max(1, items.length);
  return {
    id,
    label,
    keyCountLabel,
    mechanism,
    totalChars: items.length,
    uniqueRate: Math.round((buckets.size / n) * 10000) / 100,
    collisionChars: items.length - buckets.size,
    avgCodeLength: Math.round((totalKeys / n) * 100) / 100,
    prefixConflicts,
    altRate: totalTrans > 0 ? Math.round((altTrans / totalTrans) * 1000) / 10 : 100,
    homeRate: totalKeys > 0 ? Math.round((homeKeys / totalKeys) * 1000) / 10 : 0,
    sameFingerRate: totalTrans > 0 ? Math.round((sameFinger / totalTrans) * 10000) / 100 : 0,
    pinkyRate: totalKeys > 0 ? Math.round((pinkyKeys / totalKeys) * 10000) / 100 : 0,
    avgTravelPerChar: Math.round((totalTravel / n) * 100) / 100,
  };
}

export function computeLingmingVsKineticBenchmark(
  stageId: KineticStageId,
  scriptMode: ScriptMode
): LingmingVsKineticBenchmark {
  const kineticSim = runKineticSimulation(
    'kinetic_prefix22',
    'bidirectional',
    stageId,
    scriptMode,
    'yuhao',
    'fixed4'
  );
  const threeRowSim = runKineticSimulation(
    'three_row_dir8',
    'bidirectional',
    stageId,
    scriptMode,
    'yuhao',
    'event_stream'
  );

  const lingmingItems = kineticSim.chars.map((c) => ({
    char: c.char,
    code: encodeLingmingRoots(c.rawParts).code,
  }));
  const kineticItems = kineticSim.chars.map((c) => ({
    char: c.char,
    code: c.code,
  }));
  const threeRowItems = threeRowSim.chars.map((c) => ({
    char: c.char,
    code: c.code,
  }));

  const lingming = evaluateCorpusScheme(
    'lingming_official',
    '宇浩·靈明原版（音託）',
    '25 鍵 (A20 + B5 元音)',
    '形大碼 ＋ 聲韻音託小碼 · 免空格自分割',
    lingmingItems
  );
  const kineticPrefix = evaluateCorpusScheme(
    'kinetic_prefix22',
    '動力學自分割（方向×距離）',
    '22 鍵零小指 (A16 + B6 勢距)',
    '同庫宇浩拆分 · 方向×距離聚類 · 免空格自分割',
    kineticItems
  );
  const threeRowDir8 = evaluateCorpusScheme(
    'three_row_dir8',
    '三排指柱 22 鍵（事件流）',
    '22 鍵零小指 (8 縱柱 × 8 向)',
    '每字根完整兩碼事件流 · 根內 100% 交替',
    threeRowItems
  );

  const lmByChar = new Map(lingmingItems.map((i) => [i.char, i.code]));
  const PREFERRED_SAMPLES = ['明', '想', '速', '道', '清', '國', '国', '書', '书', '時', '时', '機', '机', '靈', '灵', '本', '相', '休', '好', '看', '和', '地', '在', '要', '有', '這', '这'];
  const picked: KineticCharEntry[] = [];
  const used = new Set<string>();
  const charByGlyph = new Map(kineticSim.chars.map((c) => [c.char, c]));

  for (const ch of PREFERRED_SAMPLES) {
    const entry = charByGlyph.get(ch);
    if (entry && !used.has(ch)) {
      picked.push(entry);
      used.add(ch);
      if (picked.length >= 12) break;
    }
  }
  for (const entry of kineticSim.chars) {
    if (picked.length >= 12) break;
    if (!used.has(entry.char)) {
      picked.push(entry);
      used.add(entry.char);
    }
  }

  const samples: BenchmarkCharSample[] = picked.map((entry) => {
    const lmCode = lmByChar.get(entry.char) || '';
    const lmSt = measureCodeStats(lmCode);
    const kinSt = measureCodeStats(entry.code);
    return {
      char: entry.char,
      parts: entry.rawParts,
      lingmingCode: lmCode,
      lingmingTravel: Math.round(lmSt.travel * 100) / 100,
      lingmingAltPct:
        lmSt.transCount > 0 ? Math.round((lmSt.altCount / lmSt.transCount) * 100) : 100,
      lingmingHasSameFinger: lmSt.sameFinger > 0,
      lingmingHasPinky: lmSt.pinkyHits > 0,
      kineticCode: entry.code,
      kineticTravel: Math.round(kinSt.travel * 100) / 100,
      kineticAltPct:
        kinSt.transCount > 0 ? Math.round((kinSt.altCount / kinSt.transCount) * 100) : 100,
      kineticHasSameFinger: kinSt.sameFinger > 0,
      kineticHasPinky: kinSt.pinkyHits > 0,
    };
  });

  return {
    stageId,
    scriptMode,
    totalChars: kineticSim.chars.length,
    lingming,
    kineticPrefix,
    threeRowDir8,
    samples,
  };
}

