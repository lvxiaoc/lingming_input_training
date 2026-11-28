import { InitialStrokeId } from './kineticCodeSystem';

export type PureShapeLeftKey =
  | 'f'
  | 'r'
  | 'v'
  | 's'
  | 'd'
  | 'e'
  | 'c'
  | 'w'
  | 'x'
  | 't'
  | 'g'
  | 'b';

export type PureShapeRightKey =
  | 'j'
  | 'k'
  | 'h'
  | 'l'
  | 'n'
  | 'u'
  | 'i'
  | 'y'
  | 'o'
  | 'm';

export interface PureShapeLeftFamilyMeta {
  key: PureShapeLeftKey;
  openingStroke: InitialStrokeId;
  strokeSymbol: string;
  label: string;
  shortTag: string;
  soloLeader: string;
  examples: string;
  rule: string;
}

export interface PureShapeRightEndingMeta {
  key: PureShapeRightKey;
  lastStroke: InitialStrokeId;
  strokeSymbol: string;
  isComplex: boolean; // false: ≤4 strokes (简), true: ≥5 strokes (繁)
  label: string;
  shortTag: string;
  soloLeader: string;
  fingerPair: string;
}

// Simplified-Optimized Left Hand (12 zero-pinky keys) = 100% Objective Opening Stroke x Visual Form
// Rebalanced specifically for Simplified Chinese:
// - F split evenly with R (單橫敞開 vs 交叉木土)
// - S split evenly with B (空框開口 vs 滿框日目田)
// - W split evenly with G (純折乙巳 vs 折撇又刀)
export const PURE_SHAPE_LEFT_FAMILIES: PureShapeLeftFamilyMeta[] = [
  {
    key: 'f',
    openingStroke: 'heng',
    strokeSymbol: '一',
    label: 'F · 單橫敞開',
    shortTag: '單橫',
    soloLeader: '一',
    examples: '一 大 天 厂 匚 戈 寸 石 西 面',
    rule: '橫起敞開、無橫豎十字穿插',
  },
  {
    key: 'r',
    openingStroke: 'heng',
    strokeSymbol: '一',
    label: 'R · 交叉木土',
    shortTag: '交叉',
    soloLeader: '木',
    examples: '木 艹 十 土 王 工 古 正 本 车 东',
    rule: '橫起且有橫豎十字相交（草木土王）',
  },
  {
    key: 's',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'S · 空框開口',
    shortTag: '空框',
    soloLeader: '口',
    examples: '口 囗 冂 凵 山 巾 门 见 贝 中 虫',
    rule: '豎起空框、開口框或單豎貫中',
  },
  {
    key: 'b',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'B · 滿框格內',
    shortTag: '滿框',
    soloLeader: '日',
    examples: '日 目 田 罒 里 皿 曲 甲 由 申 电',
    rule: '方框內部有橫格分隔（日目田系）',
  },
  {
    key: 'd',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'D · 直豎立柱',
    shortTag: '直豎',
    soloLeader: '小',
    examples: '小 丨 止 上 卜 ⺌ 刂 非 尚 虎 业',
    rule: '直豎立柱、非閉合框體',
  },
  {
    key: 'e',
    openingStroke: 'pie',
    strokeSymbol: '丿',
    label: 'E · 直撇人手',
    shortTag: '直撇',
    soloLeader: '亻',
    examples: '亻 人 八 扌 斤 彳 隹 竹 禾 金 钅 饣',
    rule: '短撇／直撇起、無外包框',
  },
  {
    key: 'c',
    openingStroke: 'pie',
    strokeSymbol: '丿',
    label: 'C · 彎撇包框',
    shortTag: '彎撇',
    soloLeader: '月',
    examples: '月 勹 白 儿 夕 欠 几 户 自 犭 鱼 鸟',
    rule: '長彎撇或撇帶框包圍',
  },
  {
    key: 'v',
    openingStroke: 'dian',
    strokeSymbol: '丶',
    label: 'V · 水火走點',
    shortTag: '水火',
    soloLeader: '氵',
    examples: '氵 心 丶 丷 忄 火 米 水 羊 辶 走 之',
    rule: '側點水火散點、走之托底',
  },
  {
    key: 't',
    openingStroke: 'dian',
    strokeSymbol: '丶',
    label: 'T · 蓋頂言立',
    shortTag: '蓋頂',
    soloLeader: '宀',
    examples: '宀 亠 冖 立 方 亡 广 穴 疒 讠 言 礻',
    rule: '居頂單點蓋頭（寶蓋言立廣）',
  },
  {
    key: 'w',
    openingStroke: 'zhe',
    strokeSymbol: '乛',
    label: 'W · 純折乙巳',
    shortTag: '純折',
    soloLeader: '乙',
    examples: '乙 了 子 巴 己 已 巳 弓 也 九 阝 马 习',
    rule: '橫折／彎鉤起、無長撇叉展開',
  },
  {
    key: 'g',
    openingStroke: 'zhe',
    strokeSymbol: '乛',
    label: 'G · 折撇又刀',
    shortTag: '折撇',
    soloLeader: '又',
    examples: '又 攵 殳 刀 力 乃 尸 艮 皮 予 争',
    rule: '橫撇又叉、刀力尸皮等折帶撇',
  },
  {
    key: 'x',
    openingStroke: 'zhe',
    strokeSymbol: '乛',
    label: 'X · 撇折絲女',
    shortTag: '撇折',
    soloLeader: '女',
    examples: '女 纟 糸 幺 母 厶 匕',
    rule: '撇折或撇點起筆',
  },
];

// Right Hand (10 zero-pinky keys) = 100% Objective Last Stroke (一丨丿丶乛) x Stroke Count (少畫≤4 vs 多畫≥5)
export const PURE_SHAPE_RIGHT_ENDINGS: PureShapeRightEndingMeta[] = [
  // Few strokes (≤4) — Home row + N
  { key: 'j', lastStroke: 'heng', strokeSymbol: '一', isComplex: false, label: 'J · 末橫(≤4畫·少畫)', shortTag: '少一', soloLeader: '土', fingerPair: 'J/U' },
  { key: 'k', lastStroke: 'shu', strokeSymbol: '丨', isComplex: false, label: 'K · 末豎(≤4畫·少畫)', shortTag: '少丨', soloLeader: '十', fingerPair: 'K/I' },
  { key: 'h', lastStroke: 'pie', strokeSymbol: '丿', isComplex: false, label: 'H · 末撇(≤4畫·少畫)', shortTag: '少丿', soloLeader: '人', fingerPair: 'H/Y' },
  { key: 'n', lastStroke: 'dian', strokeSymbol: '丶', isComplex: false, label: 'N · 末點捺(≤4畫·少畫)', shortTag: '少丶', soloLeader: '大', fingerPair: 'N/M' },
  { key: 'l', lastStroke: 'zhe', strokeSymbol: '乛', isComplex: false, label: 'L · 末折鉤提(≤4畫·少畫)', shortTag: '少乛', soloLeader: '辶', fingerPair: 'L/O' },
  // Many strokes (≥5) — Directly above on Top row + M!
  { key: 'u', lastStroke: 'heng', strokeSymbol: '一', isComplex: true, label: 'U · 末橫(≥5畫·多畫)', shortTag: '多一', soloLeader: '目', fingerPair: 'J/U' },
  { key: 'i', lastStroke: 'shu', strokeSymbol: '丨', isComplex: true, label: 'I · 末豎(≥5畫·多畫)', shortTag: '多丨', soloLeader: '田', fingerPair: 'K/I' },
  { key: 'y', lastStroke: 'pie', strokeSymbol: '丿', isComplex: true, label: 'Y · 末撇(≥5畫·多畫)', shortTag: '多丿', soloLeader: '白', fingerPair: 'H/Y' },
  { key: 'm', lastStroke: 'dian', strokeSymbol: '丶', isComplex: true, label: 'M · 末點捺(≥5畫·多畫)', shortTag: '多丶', soloLeader: '心', fingerPair: 'N/M' },
  { key: 'o', lastStroke: 'zhe', strokeSymbol: '乛', isComplex: true, label: 'O · 末折鉤提(≥5畫·多畫)', shortTag: '多乛', soloLeader: '艹', fingerPair: 'L/O' },
];

export const PURE_SHAPE_LEFT_MAP = new Map<PureShapeLeftKey, PureShapeLeftFamilyMeta>(
  PURE_SHAPE_LEFT_FAMILIES.map((m) => [m.key, m])
);

export const PURE_SHAPE_RIGHT_MAP = new Map<PureShapeRightKey, PureShapeRightEndingMeta>(
  PURE_SHAPE_RIGHT_ENDINGS.map((m) => [m.key, m])
);

export function getPureShapeRightKey(
  lastStroke: InitialStrokeId,
  strokes: number,
  complexThreshold = 5
): PureShapeRightKey {
  const complex = strokes >= complexThreshold;
  switch (lastStroke) {
    case 'heng':
      return complex ? 'u' : 'j';
    case 'shu':
      return complex ? 'i' : 'k';
    case 'pie':
      return complex ? 'y' : 'h';
    case 'dian':
      return complex ? 'm' : 'n';
    case 'zhe':
      return complex ? 'o' : 'l';
  }
}

export interface PureShapeRadicalSpec {
  leftKey: PureShapeLeftKey;
  lastStroke: InitialStrokeId;
  strokes: number;
}

// 22 Zero-Pinky Solo Family-Leader Taps (1 finger solo tap — zero conflict with any 2-finger chord!)
// Left 12 = 12 Opening Family Leaders, Right 10 = 10 High-Frequency Simplified Ending Kings
export const PURE_SHAPE_SOLO_RADICALS: Record<string, string> = {
  // Left 12 Family Heads
  一: 'f',
  木: 'r',
  口: 's',
  日: 'b',
  小: 'd',
  亻: 'e',
  月: 'c',
  氵: 'v',
  宀: 't',
  乙: 'w',
  又: 'g',
  女: 'x',
  // Right 10 High-Frequency Simplified Kings
  土: 'j',
  目: 'u',
  十: 'k',
  田: 'i',
  人: 'h',
  白: 'y',
  大: 'n',
  心: 'm',
  辶: 'l',
  艹: 'o',
};

export const PURE_SHAPE_SOLO_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PURE_SHAPE_SOLO_RADICALS).map(([rad, key]) => [key, rad])
);

// 26 Alpha Solo Leaders for the 0-Sharing Pure 2-Finger Mode (A–Z only — ; , . / stay 100% free as solo punctuation!)
export const PURE_SHAPE_SOLO_26: Record<string, string> = {
  ...PURE_SHAPE_SOLO_RADICALS,
  八: 'q',
  厂: 'a',
  也: 'z',
  王: 'p',
};

export const PURE_SHAPE_SOLO_26_BY_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PURE_SHAPE_SOLO_26).map(([rad, key]) => [key, rad])
);

// Objective visual tags for the 4 alpha outer expansion keys in 26-Letter Pure Cross-Hand mode (ZERO punctuation keys!)
export const PURE_SHAPE_EXT_KEY_TAGS: Record<string, { shortTag: string; label: string; hand: 'L' | 'R' }> = {
  q: { shortTag: '傘撇', label: 'Q · 傘撇八人', hand: 'L' },
  a: { shortTag: '半包', label: 'A · 廠匚半包', hand: 'L' },
  z: { shortTag: '彎鉤', label: 'Z · 乙己彎鉤', hand: 'L' },
  p: { shortTag: '擴容', label: 'P · 右上擴容', hand: 'R' },
};

// Purely Traditional Yuhao radicals mapped to their Simplified twin in Simplified-first 0-sharing mode
export const TRAD_TO_SIMP_TWIN: Record<string, string> = {
  門: '门',
  貝: '贝',
  見: '见',
  頁: '页',
  車: '车',
  馬: '马',
  鳥: '鸟',
  烏: '乌',
  魚: '鱼',
  長: '长',
  風: '风',
  飛: '飞',
  齒: '齿',
  戶: '户',
  亞: '亚',
  黃: '黄',
  開: '开',
  夾: '夹',
};

// 2nd Stroke + Stroke Count for Single-Radical Whole Characters (成字字根補 1 指次筆)
// Uses Right-hand 10 keys: 5 second-stroke types (一丨丿丶乛) x simple(≤5画 home J/K/H/N/L) vs complex(≥6画 top U/I/Y/M/O)
export const WHOLE_CHAR_SECOND_STROKE: Record<string, [InitialStrokeId, number]> = {
  // 横起类
  天: ['heng', 4],
  太: ['pie', 4],
  不: ['pie', 4],
  下: ['shu', 3],
  寸: ['shu', 3],
  夫: ['heng', 4],
  犬: ['pie', 4],
  戈: ['zhe', 4],
  戊: ['pie', 5],
  古: ['shu', 5],
  正: ['shu', 5],
  石: ['pie', 5],
  耳: ['shu', 6],
  至: ['zhe', 6],
  面: ['pie', 9],
  酉: ['shu', 7],
  本: ['shu', 5],
  西: ['shu', 6],
  五: ['shu', 4],
  二: ['heng', 2],
  三: ['heng', 3],
  工: ['shu', 3],
  士: ['heng', 3],
  王: ['heng', 4],
  干: ['heng', 3],
  束: ['shu', 7],
  末: ['heng', 5],
  未: ['heng', 5],
  其: ['shu', 8],
  丰: ['heng', 4],
  井: ['heng', 4],
  世: ['shu', 5],
  雨: ['shu', 8],
  车: ['zhe', 4],
  东: ['zhe', 5],
  玉: ['heng', 5],
  在: ['pie', 6],
  或: ['shu', 8],
  厂: ['pie', 2],
  丁: ['zhe', 2],
  七: ['zhe', 2],
  牙: ['zhe', 4],
  瓦: ['zhe', 4],
  长: ['heng', 4],
  臣: ['shu', 6],
  而: ['pie', 6],
  豆: ['shu', 7],
  可: ['shu', 5],
  百: ['pie', 6],
  亚: ['shu', 6],
  辰: ['pie', 7],
  页: ['pie', 6],
  甫: ['shu', 7],
  豕: ['pie', 7],
  尤: ['pie', 4],
  弋: ['zhe', 3],
  夹: ['dian', 6],
  甘: ['shu', 5],
  开: ['heng', 4],
  共: ['shu', 6],
  黄: ['shu', 11],
  革: ['shu', 9],
  // 折起类
  也: ['shu', 3],
  了: ['shu', 2],
  九: ['zhe', 2],
  已: ['heng', 3],
  己: ['heng', 3],
  巳: ['heng', 3],
  习: ['dian', 3],
  弓: ['heng', 3],
  巴: ['shu', 4],
  子: ['shu', 3],
  马: ['zhe', 3],
  丑: ['shu', 4],
  飞: ['pie', 3],
  民: ['heng', 5],
  羽: ['dian', 6],
  尺: ['heng', 4],
  司: ['heng', 5],
  君: ['heng', 7],
  刀: ['pie', 2],
  力: ['pie', 2],
  尸: ['heng', 3],
  皮: ['pie', 5],
  乃: ['pie', 2],
  予: ['dian', 4],
  矛: ['dian', 5],
  艮: ['heng', 6],
  良: ['zhe', 7],
  隶: ['heng', 8],
  母: ['zhe', 5],
  幺: ['zhe', 3],
  匕: ['zhe', 2],
  云: ['heng', 4],
  去: ['shu', 5],
  台: ['dian', 5],
  友: ['pie', 4],
  圣: ['dian', 5],
  发: ['pie', 5],
  // 框起/竖起类
  向: ['shu', 6],
  且: ['zhe', 5],
  由: ['zhe', 5],
  里: ['zhe', 7],
  甲: ['zhe', 5],
  申: ['zhe', 5],
  曲: ['zhe', 6],
  电: ['zhe', 5],
  皿: ['zhe', 5],
  早: ['zhe', 6],
  黑: ['zhe', 12],
  门: ['shu', 3],
  见: ['zhe', 4],
  贝: ['zhe', 4],
  山: ['zhe', 3],
  巾: ['zhe', 3],
  足: ['zhe', 7],
  中: ['zhe', 4],
  虫: ['zhe', 6],
  内: ['zhe', 4],
  同: ['zhe', 6],
  周: ['zhe', 8],
  网: ['zhe', 6],
  四: ['zhe', 5],
  册: ['zhe', 5],
  上: ['heng', 3],
  止: ['heng', 4],
  卜: ['dian', 2],
  非: ['heng', 8],
  川: ['shu', 3],
  片: ['heng', 4],
  业: ['shu', 5],
  虎: ['heng', 8],
  齿: ['heng', 8],
  尚: ['dian', 8],
  步: ['heng', 7],
  此: ['heng', 6],
  占: ['heng', 5],
  // 撇起类
  金: ['dian', 8],
  生: ['heng', 5],
  合: ['dian', 6],
  舌: ['heng', 6],
  牛: ['heng', 4],
  手: ['heng', 4],
  千: ['heng', 3],
  禾: ['heng', 5],
  矢: ['heng', 5],
  入: ['dian', 2],
  八: ['dian', 2],
  斤: ['pie', 4],
  我: ['heng', 7],
  竹: ['heng', 6],
  气: ['heng', 4],
  毛: ['heng', 4],
  夭: ['heng', 4],
  瓜: ['pie', 5],
  反: ['pie', 4],
  丘: ['shu', 5],
  兵: ['shu', 7],
  升: ['heng', 4],
  垂: ['heng', 8],
  重: ['heng', 9],
  香: ['heng', 9],
  氏: ['zhe', 4],
  采: ['dian', 8],
  自: ['shu', 6],
  儿: ['zhe', 2],
  夕: ['zhe', 3],
  欠: ['zhe', 4],
  几: ['zhe', 2],
  户: ['zhe', 4],
  歹: ['pie', 4],
  鬼: ['shu', 9],
  身: ['shu', 7],
  免: ['zhe', 7],
  用: ['zhe', 5],
  鱼: ['zhe', 8],
  骨: ['zhe', 9],
  臼: ['shu', 6],
  鸟: ['zhe', 5],
  乌: ['zhe', 4],
  风: ['zhe', 4],
  凡: ['zhe', 3],
  久: ['zhe', 3],
  勺: ['zhe', 3],
  争: ['zhe', 6],
  舟: ['pie', 6],
  角: ['zhe', 7],
  象: ['zhe', 11],
  鼠: ['shu', 13],
  爪: ['pie', 4],
  // 点起类
  水: ['zhe', 4],
  火: ['pie', 4],
  米: ['pie', 6],
  羊: ['pie', 6],
  半: ['pie', 5],
  之: ['zhe', 3],
  走: ['shu', 7],
  州: ['pie', 6],
  永: ['zhe', 5],
  冰: ['zhe', 6],
  斗: ['dian', 4],
  炎: ['pie', 8],
  冬: ['zhe', 5],
  广: ['heng', 3],
  穴: ['dian', 5],
  立: ['heng', 5],
  方: ['heng', 4],
  亡: ['heng', 3],
  高: ['heng', 10],
  辛: ['heng', 7],
  文: ['heng', 4],
  亦: ['heng', 6],
  示: ['heng', 5],
  麻: ['heng', 11],
  言: ['heng', 7],
  衣: ['heng', 6],
  音: ['heng', 9],
  京: ['heng', 8],
  玄: ['heng', 5],
  六: ['heng', 4],
  交: ['heng', 6],
  主: ['heng', 5],
  首: ['pie', 9],
  前: ['pie', 9],
  关: ['pie', 6],
  兼: ['pie', 10],
  曾: ['pie', 12],
  鹿: ['heng', 11],
};

export function getWholeCharSecondBeatSpec(
  ch: string
): { key: PureShapeRightKey; stroke: InitialStrokeId; strokes: number } | null {
  const entry = WHOLE_CHAR_SECOND_STROKE[ch];
  if (!entry) return null;
  const [stroke, strokes] = entry;
  // Threshold >= 6 splits 4-5 stroke simple roots (home row J/K/H/N/L) from 6+ stroke complex roots (top row U/I/Y/M/O)
  const key = getPureShapeRightKey(stroke, strokes, 6);
  return { key, stroke, strokes };
}

// Complete, 100% Objective Pure-Shape Dictionary for ALL 269 Official Yuhao Radicals (Simplified-Optimized Left-12)
// Tuple: [leftKey (opening visual family), lastStroke (一/丨/丿/丶/乛), exact stroke count]
const RAW_PURE_SHAPE_BOOK: Record<string, [PureShapeLeftKey, InitialStrokeId, number]> = {
  // === F: 單橫敞開 (橫起、無橫豎十字穿插) ===
  一: ['f', 'heng', 1],
  二: ['f', 'heng', 2],
  三: ['f', 'heng', 3],
  五: ['f', 'heng', 4],
  大: ['f', 'dian', 3],
  犬: ['f', 'dian', 4],
  夫: ['f', 'dian', 4],
  天: ['f', 'dian', 4],
  石: ['f', 'heng', 5],
  厂: ['f', 'pie', 2],
  丆: ['f', 'pie', 2],
  丁: ['f', 'zhe', 2],
  丅: ['f', 'shu', 2],
  丂: ['f', 'zhe', 2],
  兀: ['f', 'zhe', 3],
  丌: ['f', 'shu', 3],
  亍: ['f', 'zhe', 3],
  不: ['f', 'dian', 4],
  下: ['f', 'dian', 3],
  至: ['f', 'heng', 6],
  牙: ['f', 'pie', 4],
  瓦: ['f', 'dian', 4],
  戈: ['f', 'dian', 4],
  戊: ['f', 'dian', 5],
  弋: ['f', 'dian', 3],
  七: ['f', 'zhe', 2],
  尤: ['f', 'dian', 4],
  尢: ['f', 'zhe', 3],
  辰: ['f', 'dian', 7],
  頁: ['f', 'dian', 9],
  页: ['f', 'dian', 6],
  西: ['f', 'heng', 6],
  酉: ['f', 'heng', 7],
  臣: ['f', 'zhe', 6],
  匚: ['f', 'zhe', 2],
  '𠂇': ['f', 'pie', 2],
  寸: ['f', 'dian', 3],
  豕: ['f', 'dian', 7],
  面: ['f', 'heng', 9],
  而: ['f', 'shu', 6],
  耳: ['f', 'heng', 6],
  豆: ['f', 'heng', 7],
  可: ['f', 'zhe', 5],
  百: ['f', 'heng', 6],
  亞: ['f', 'heng', 8],
  亚: ['f', 'heng', 6],
  或: ['f', 'dian', 8],
  夾: ['f', 'dian', 7],
  夹: ['f', 'dian', 6],

  // === R: 交叉木土 (橫豎十字交叉・草木土王) ===
  木: ['r', 'dian', 4],
  朩: ['r', 'dian', 4],
  土: ['r', 'heng', 3],
  士: ['r', 'heng', 3],
  工: ['r', 'heng', 3],
  干: ['r', 'shu', 3],
  王: ['r', 'heng', 4],
  玉: ['r', 'dian', 5],
  在: ['r', 'heng', 6],
  古: ['r', 'heng', 5],
  正: ['r', 'heng', 5],
  本: ['r', 'heng', 5],
  未: ['r', 'dian', 5],
  末: ['r', 'dian', 5],
  束: ['r', 'dian', 7],
  甫: ['r', 'dian', 7],
  世: ['r', 'zhe', 5],
  车: ['r', 'shu', 4],
  車: ['r', 'shu', 7],
  东: ['r', 'dian', 5],
  來: ['r', 'dian', 8],
  十: ['r', 'shu', 2],
  艹: ['r', 'shu', 3],
  廿: ['r', 'heng', 4],
  卅: ['r', 'shu', 4],
  卌: ['r', 'shu', 5],
  廾: ['r', 'shu', 3],
  丰: ['r', 'shu', 4],
  其: ['r', 'dian', 8],
  革: ['r', 'shu', 9],
  耂: ['r', 'pie', 4],
  雨: ['r', 'dian', 8],
  井: ['r', 'shu', 4],
  共: ['r', 'dian', 6],
  黃: ['r', 'dian', 12],
  黄: ['r', 'dian', 11],
  甘: ['r', 'heng', 5],
  開: ['r', 'shu', 12],
  开: ['r', 'shu', 4],

  // === S: 空框開口 (空框、開口框、門貝見山巾) ===
  口: ['s', 'heng', 3],
  囗: ['s', 'heng', 3],
  '〇': ['s', 'zhe', 1],
  门: ['s', 'zhe', 3],
  門: ['s', 'zhe', 8],
  贝: ['s', 'dian', 4],
  貝: ['s', 'dian', 7],
  見: ['s', 'zhe', 7],
  见: ['s', 'zhe', 4],
  巾: ['s', 'shu', 3],
  冂: ['s', 'zhe', 2],
  凵: ['s', 'shu', 2],
  山: ['s', 'shu', 3],
  鹵: ['s', 'heng', 11],
  鬥: ['s', 'zhe', 10],
  足: ['s', 'dian', 7],
  虫: ['s', 'dian', 6],
  中: ['s', 'shu', 4],
  内: ['s', 'dian', 4],
  內: ['s', 'dian', 4],
  同: ['s', 'heng', 6],
  周: ['s', 'heng', 8],
  网: ['s', 'dian', 6],
  向: ['s', 'heng', 6],
  且: ['s', 'heng', 5],
  咼: ['s', 'heng', 9],
  冄: ['s', 'heng', 4],

  // === B: 滿框格內 (框內有橫格：日目田罒里皿曲甲由申電) ===
  日: ['b', 'heng', 4],
  曰: ['b', 'heng', 4],
  目: ['b', 'heng', 5],
  田: ['b', 'heng', 5],
  由: ['b', 'heng', 5],
  甲: ['b', 'shu', 5],
  申: ['b', 'shu', 5],
  电: ['b', 'zhe', 5],
  曲: ['b', 'heng', 6],
  四: ['b', 'heng', 5],
  罒: ['b', 'heng', 5],
  皿: ['b', 'heng', 5],
  冊: ['b', 'heng', 5],
  册: ['b', 'heng', 5],
  黑: ['b', 'dian', 12],
  里: ['b', 'heng', 7],
  早: ['b', 'shu', 6],
  禺: ['b', 'dian', 9],

  // === D: 直豎立柱 ===
  丨: ['d', 'shu', 1],
  亅: ['d', 'zhe', 1],
  上: ['d', 'heng', 3],
  止: ['d', 'heng', 4],
  卜: ['d', 'dian', 2],
  占: ['d', 'heng', 5],
  刂: ['d', 'zhe', 2],
  业: ['d', 'heng', 5],
  業: ['d', 'dian', 13],
  屮: ['d', 'shu', 3],
  丱: ['d', 'shu', 5],
  丩: ['d', 'shu', 2],
  川: ['d', 'shu', 3],
  非: ['d', 'heng', 8],
  片: ['d', 'zhe', 4],
  爿: ['d', 'shu', 4],
  丬: ['d', 'heng', 3],
  虍: ['d', 'zhe', 6],
  虎: ['d', 'zhe', 8],
  齒: ['d', 'shu', 15],
  齿: ['d', 'shu', 8],
  小: ['d', 'dian', 3],
  '⺌': ['d', 'pie', 3],
  尚: ['d', 'heng', 8],
  步: ['d', 'pie', 7],
  此: ['d', 'zhe', 6],
  師: ['d', 'shu', 10],

  // === E: 直撇人手 ===
  丿: ['e', 'pie', 1],
  人: ['e', 'dian', 2],
  亻: ['e', 'shu', 2],
  八: ['e', 'dian', 2],
  入: ['e', 'dian', 2],
  乂: ['e', 'dian', 2],
  彳: ['e', 'shu', 3],
  彡: ['e', 'pie', 3],
  手: ['e', 'zhe', 4],
  扌: ['e', 'zhe', 3],
  牛: ['e', 'shu', 4],
  禾: ['e', 'dian', 5],
  千: ['e', 'shu', 3],
  壬: ['e', 'heng', 4],
  生: ['e', 'heng', 5],
  矢: ['e', 'dian', 5],
  金: ['e', 'heng', 8],
  钅: ['e', 'zhe', 5],
  食: ['e', 'dian', 9],
  饣: ['e', 'zhe', 3],
  竹: ['e', 'zhe', 6],
  斤: ['e', 'shu', 4],
  气: ['e', 'zhe', 4],
  毛: ['e', 'zhe', 4],
  夭: ['e', 'dian', 4],
  舌: ['e', 'heng', 6],
  缶: ['e', 'shu', 6],
  隹: ['e', 'heng', 8],
  瓜: ['e', 'dian', 5],
  僉: ['e', 'dian', 13],
  合: ['e', 'heng', 6],
  反: ['e', 'dian', 4],
  丘: ['e', 'heng', 5],
  兵: ['e', 'dian', 7],
  升: ['e', 'shu', 4],
  垂: ['e', 'heng', 8],
  重: ['e', 'heng', 9],
  香: ['e', 'heng', 9],
  鼻: ['e', 'shu', 14],
  氏: ['e', 'zhe', 4],
  我: ['e', 'dian', 7],
  采: ['e', 'dian', 8],
  豸: ['e', 'pie', 7],

  // === C: 彎撇包框 ===
  月: ['c', 'heng', 4],
  舟: ['c', 'dian', 6],
  几: ['c', 'zhe', 2],
  儿: ['c', 'zhe', 2],
  勹: ['c', 'zhe', 2],
  夕: ['c', 'dian', 3],
  欠: ['c', 'dian', 4],
  風: ['c', 'dian', 9],
  风: ['c', 'dian', 4],
  凡: ['c', 'dian', 3],
  用: ['c', 'shu', 5],
  骨: ['c', 'heng', 10],
  鬼: ['c', 'dian', 9],
  臼: ['c', 'heng', 6],
  鳥: ['c', 'dian', 11],
  烏: ['c', 'dian', 10],
  乌: ['c', 'heng', 4],
  鸟: ['c', 'heng', 5],
  魚: ['c', 'dian', 11],
  鱼: ['c', 'heng', 8],
  白: ['c', 'heng', 5],
  自: ['c', 'heng', 6],
  甶: ['c', 'heng', 5],
  身: ['c', 'pie', 7],
  戶: ['c', 'pie', 4],
  户: ['c', 'pie', 4],
  髟: ['c', 'pie', 10],
  夂: ['c', 'dian', 3],
  夊: ['c', 'dian', 3],
  犭: ['c', 'pie', 3],
  卯: ['c', 'shu', 5],
  爪: ['c', 'dian', 4],
  爫: ['c', 'dian', 4],
  角: ['c', 'shu', 7],
  象: ['c', 'dian', 11],
  鼠: ['c', 'zhe', 13],
  龜: ['c', 'zhe', 16],
  免: ['c', 'zhe', 7],
  久: ['c', 'dian', 3],
  勺: ['c', 'dian', 3],
  争: ['c', 'shu', 6],
  歹: ['c', 'dian', 4],

  // === V: 水火走點 (散點水火 + 走之托底) ===
  丶: ['v', 'dian', 1],
  乀: ['v', 'dian', 1],
  氵: ['v', 'zhe', 3],
  冫: ['v', 'zhe', 2],
  '⺀': ['v', 'dian', 2],
  心: ['v', 'dian', 4],
  忄: ['v', 'shu', 3],
  火: ['v', 'dian', 4],
  灬: ['v', 'dian', 4],
  水: ['v', 'dian', 4],
  氺: ['v', 'dian', 5],
  米: ['v', 'dian', 6],
  羊: ['v', 'shu', 6],
  丷: ['v', 'pie', 2],
  半: ['v', 'shu', 5],
  州: ['v', 'shu', 6],
  永: ['v', 'dian', 5],
  冰: ['v', 'dian', 6],
  斗: ['v', 'shu', 4],
  炎: ['v', 'dian', 8],
  冬: ['v', 'dian', 5],
  辶: ['v', 'dian', 3],
  廴: ['v', 'dian', 2],
  之: ['v', 'dian', 3],
  走: ['v', 'dian', 7],

  // === T: 蓋頂言立 ===
  亠: ['t', 'heng', 2],
  宀: ['t', 'zhe', 3],
  冖: ['t', 'zhe', 2],
  穴: ['t', 'dian', 5],
  言: ['t', 'heng', 7],
  讠: ['t', 'zhe', 2],
  立: ['t', 'heng', 5],
  广: ['t', 'pie', 3],
  疒: ['t', 'zhe', 5],
  文: ['t', 'dian', 4],
  方: ['t', 'pie', 4],
  亡: ['t', 'zhe', 3],
  亥: ['t', 'dian', 6],
  亦: ['t', 'dian', 6],
  衣: ['t', 'dian', 6],
  衤: ['t', 'dian', 5],
  示: ['t', 'dian', 5],
  礻: ['t', 'dian', 4],
  辛: ['t', 'shu', 7],
  高: ['t', 'heng', 10],
  鹿: ['t', 'zhe', 11],
  麻: ['t', 'dian', 11],
  音: ['t', 'heng', 9],
  京: ['t', 'dian', 8],
  玄: ['t', 'dian', 5],
  六: ['t', 'dian', 4],
  交: ['t', 'dian', 6],
  主: ['t', 'heng', 5],
  首: ['t', 'heng', 9],
  前: ['t', 'zhe', 9],
  並: ['t', 'heng', 8],
  关: ['t', 'dian', 6],
  兼: ['t', 'dian', 10],
  曾: ['t', 'heng', 12],

  // === W: 純折乙巳 (純折彎鉤、無大撇叉) ===
  乙: ['w', 'zhe', 1],
  乚: ['w', 'zhe', 1],
  乜: ['w', 'zhe', 2],
  习: ['w', 'zhe', 3],
  己: ['w', 'zhe', 3],
  已: ['w', 'zhe', 3],
  巳: ['w', 'zhe', 3],
  巴: ['w', 'zhe', 4],
  弓: ['w', 'zhe', 3],
  飛: ['w', 'dian', 9],
  飞: ['w', 'dian', 3],
  九: ['w', 'zhe', 2],
  丑: ['w', 'heng', 4],
  卩: ['w', 'shu', 2],
  '㔾': ['w', 'zhe', 2],
  阝: ['w', 'shu', 2],
  子: ['w', 'heng', 3],
  了: ['w', 'zhe', 2],
  孑: ['w', 'zhe', 3],
  彐: ['w', 'heng', 3],
  彑: ['w', 'heng', 3],
  肀: ['w', 'shu', 4],
  馬: ['w', 'dian', 10],
  马: ['w', 'heng', 3],
  也: ['w', 'zhe', 3],
  民: ['w', 'zhe', 5],
  羽: ['w', 'zhe', 6],
  司: ['w', 'heng', 5],

  // === G: 折撇又刀 (折帶撇叉：又刀力尸艮皮予) ===
  又: ['g', 'dian', 2],
  攵: ['g', 'dian', 4],
  殳: ['g', 'dian', 4],
  刀: ['g', 'pie', 2],
  力: ['g', 'pie', 2],
  乃: ['g', 'pie', 2],
  尸: ['g', 'pie', 3],
  尺: ['g', 'dian', 4],
  尹: ['g', 'pie', 4],
  君: ['g', 'heng', 7],
  予: ['g', 'zhe', 4],
  矛: ['g', 'pie', 5],
  皮: ['g', 'dian', 5],
  艮: ['g', 'dian', 6],
  良: ['g', 'dian', 7],
  隶: ['g', 'dian', 8],
  癶: ['g', 'dian', 5],
  甬: ['g', 'shu', 7],
  長: ['g', 'dian', 8],
  长: ['g', 'dian', 4],
  友: ['g', 'dian', 4],
  圣: ['g', 'heng', 5],
  发: ['g', 'dian', 5],
  登: ['g', 'heng', 12],

  // === X: 撇折絲女 ===
  女: ['x', 'heng', 3],
  糸: ['x', 'dian', 6],
  纟: ['x', 'zhe', 3],
  幺: ['x', 'dian', 3],
  巛: ['x', 'zhe', 3],
  母: ['x', 'dian', 5],
  毋: ['x', 'heng', 4],
  厶: ['x', 'dian', 2],
  匕: ['x', 'zhe', 2],
  云: ['x', 'dian', 4],
  去: ['x', 'dian', 5],
  台: ['x', 'heng', 5],
};

export function getPureShapeRadicalSpec(
  radical: string,
  fallbackStroke: InitialStrokeId
): PureShapeRadicalSpec {
  const exact = RAW_PURE_SHAPE_BOOK[radical];
  if (exact) {
    return {
      leftKey: exact[0],
      lastStroke: exact[1],
      strokes: exact[2],
    };
  }
  const fallbackLeft: PureShapeLeftKey =
    fallbackStroke === 'heng'
      ? 'f'
      : fallbackStroke === 'shu'
        ? 'd'
        : fallbackStroke === 'pie'
          ? 'e'
          : fallbackStroke === 'dian'
            ? 'v'
            : 'w';
  return {
    leftKey: fallbackLeft,
    lastStroke: fallbackStroke,
    strokes: 4,
  };
}
