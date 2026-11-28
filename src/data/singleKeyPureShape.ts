import {
  InitialStrokeId,
  KineticStageId,
  runKineticSimulation,
} from './kineticCodeSystem';
import { LINGMING_ROOT_MAP } from './lingming';
import {
  getPureShapeRadicalSpec,
  getWholeCharSecondBeatSpec,
  PURE_SHAPE_LEFT_MAP,
} from './pureShapeRadicals';
import { CharScript, ScriptMode } from './scriptFilter';

export type WriterKeyZone = '横区' | '撇区' | '折区' | '框区' | '竖区' | '点区';

export interface Writer25FamilyMeta {
  key: string;
  hand: 'L' | 'R';
  zone: WriterKeyZone;
  openingStroke: InitialStrokeId;
  strokeSymbol: string;
  label: string;
  shortTag: string;
  soloLeader: string;
  fingerLabel: string;
  rule: string;
  radicals: string[];
}

export interface MirrorStrokeEntry {
  stroke: InitialStrokeId;
  symbol: string;
  name: string;
  leftShort: string; // <=3 strokes
  leftLong: string; // >=4 strokes
  rightShort: string; // <=3 strokes
  rightLong: string; // >=4 strokes
}

export interface SingleKeyStep {
  index: number; // 0..3
  key: string; // lowercase a..z (never x)
  hand: 'L' | 'R';
  fingerLabel: string;
  role: 'root' | 'end_stroke' | 'second_stroke' | 'stroke_count';
  roleLabel: string; // 首根 / 次根 / 三根 / 末根 / 异手收笔 / 异手次笔 / 异手画数
  radical: string;
  visualCue: string;
}

export interface SingleKeyCharEntry {
  char: string;
  script: CharScript;
  parts: string[];
  code: string; // strictly 4 lowercase letters (never contains 'x')
  displayCode: string; // e.g. "K C F J"
  steps: SingleKeyStep[];
  alternationPct: number; // within-char L<->R alternation %
  sfbCount: number; // within-char same-finger transitions
  isCoreDrill: boolean;
}

export interface SingleKeyCollisionGroup {
  code: string;
  chars: SingleKeyCharEntry[];
}

export interface SingleKeySimulationResult {
  stageId: KineticStageId;
  scriptMode: ScriptMode;
  chars: SingleKeyCharEntry[];
  byChar: Map<string, SingleKeyCharEntry>;
  byCode: Map<string, SingleKeyCharEntry[]>;
  radicalsByKey: Map<string, Array<{ radical: string; freq: number }>>;
  collisions: SingleKeyCollisionGroup[];
  metrics: {
    totalChars: number;
    uniqueCodes: number;
    firstChoiceRate: number;
    collisionChars: number;
    avgCodeLength: number;
    handAlternationPct: number;
    sfbPct: number;
    leftHandPct: number;
    rightHandPct: number;
    pinkyPct: number;
    xKeyPct: number;
    totalRadicalsCovered: number;
    officialYuhaoTotal: number;
  };
}

export interface WriterPassage {
  id: string;
  title: string;
  note: string;
  text: string;
}

const LEFT_KEYS_SET = new Set('qwertasdfgzxcvb'.split(''));

export const FINGER_BY_KEY: Record<string, { group: string; label: string; isPinky: boolean }> = {
  q: { group: 'L5', label: '左小指', isPinky: true },
  a: { group: 'L5', label: '左小指', isPinky: true },
  z: { group: 'L5', label: '左小指', isPinky: true },
  w: { group: 'L4', label: '左无名', isPinky: false },
  s: { group: 'L4', label: '左无名', isPinky: false },
  x: { group: 'L4', label: '左无名', isPinky: false },
  e: { group: 'L3', label: '左中指', isPinky: false },
  d: { group: 'L3', label: '左中指', isPinky: false },
  c: { group: 'L3', label: '左中指', isPinky: false },
  r: { group: 'L2', label: '左食指', isPinky: false },
  f: { group: 'L2', label: '左食指', isPinky: false },
  v: { group: 'L2', label: '左食指', isPinky: false },
  t: { group: 'L2', label: '左食内', isPinky: false },
  g: { group: 'L2', label: '左食内', isPinky: false },
  b: { group: 'L2', label: '左食内', isPinky: false },
  y: { group: 'R2', label: '右食内', isPinky: false },
  h: { group: 'R2', label: '右食内', isPinky: false },
  n: { group: 'R2', label: '右食内', isPinky: false },
  u: { group: 'R2', label: '右食指', isPinky: false },
  j: { group: 'R2', label: '右食指', isPinky: false },
  m: { group: 'R2', label: '右食指', isPinky: false },
  i: { group: 'R3', label: '右中指', isPinky: false },
  k: { group: 'R3', label: '右中指', isPinky: false },
  o: { group: 'R4', label: '右无名', isPinky: false },
  l: { group: 'R4', label: '右无名', isPinky: false },
  p: { group: 'R5', label: '右小指', isPinky: true },
};

const STROKE_LABEL: Record<InitialStrokeId, { symbol: string; name: string }> = {
  heng: { symbol: '一', name: '横' },
  shu: { symbol: '丨', name: '竖' },
  pie: { symbol: '丿', name: '撇' },
  dian: { symbol: '丶', name: '点' },
  zhe: { symbol: '乛', name: '折' },
};

// 25-Key Zero-X Pure-Shape Families:
// Left Hand (14 keys, ZERO X): 横区(5) + 撇区(5) + 折区(4)
// Right Hand (11 keys): 框区(4) + 竖区(2) + 点区(5)
export const WRITER_25_FAMILIES: Writer25FamilyMeta[] = [
  // === 左手 · 横区 (5) ===
  {
    key: 'f',
    hand: 'L',
    zone: '横区',
    openingStroke: 'heng',
    strokeSymbol: '一',
    label: 'F · 舒展单横',
    shortTag: '单横',
    soloLeader: '一',
    fingerLabel: '左食指',
    rule: '横起舒展敞开：一、二、三、大、天、不、下、干、五、开',
    radicals: ['一', '二', '三', '大', '天', '夫', '太', '夭', '犬', '丈', '尤', '丌', '兀', '夹', '夷', '不', '下', '干', '于', '五', '专', '开'],
  },
  {
    key: 'r',
    hand: 'L',
    zone: '横区',
    openingStroke: 'heng',
    strokeSymbol: '一',
    label: 'R · 木车纵贯',
    shortTag: '木车',
    soloLeader: '木',
    fingerLabel: '左食指',
    rule: '横起木车系：木、本、末、未、来、束、东、车',
    radicals: ['木', '本', '末', '未', '来', '束', '东', '车', '朩'],
  },
  {
    key: 'g',
    hand: 'L',
    zone: '横区',
    openingStroke: 'heng',
    strokeSymbol: '一',
    label: 'G · 土王工寸',
    shortTag: '土王',
    soloLeader: '土',
    fingerLabel: '左食内',
    rule: '横竖稳立基座：土、士、王、工、玉、青、丰、正、寸',
    radicals: ['土', '士', '王', '工', '玉', '圭', '青', '丰', '井', '正', '亚', '至', '寸', '赤'],
  },
  {
    key: 't',
    hand: 'L',
    zone: '横区',
    openingStroke: 'heng',
    strokeSymbol: '一',
    label: 'T · 草十交叉',
    shortTag: '草十',
    soloLeader: '十',
    fingerLabel: '左食内',
    rule: '横竖十字穿插：艹、十、古、直、真、南、革、共、黄、其',
    radicals: ['艹', '十', '廿', '卅', '古', '克', '直', '真', '南', '革', '共', '黄', '其', '甘', '世', '卌', '甫'],
  },
  {
    key: 'a',
    hand: 'L',
    zone: '横区',
    openingStroke: 'heng',
    strokeSymbol: '一',
    label: 'A · 厂石西戈',
    shortTag: '厂戈',
    soloLeader: '石',
    fingerLabel: '左小指',
    rule: '横起半包或斜戈：厂、匚、石、西、酉、面、页、耳、戈、辰、雨',
    radicals: ['厂', '丆', '匚', '石', '西', '酉', '面', '页', '百', '而', '耳', '豆', '牙', '豕', '戈', '戊', '弋', '辰', '瓦', '臣', '长', '区', '匹', '巨', '雨'],
  },

  // === 左手 · 撇区 (5) ===
  {
    key: 'e',
    hand: 'L',
    zone: '撇区',
    openingStroke: 'pie',
    strokeSymbol: '丿',
    label: 'E · 人立双人',
    shortTag: '人立',
    soloLeader: '人',
    fingerLabel: '左中指',
    rule: '撇起人字立身：亻、人、入、彳、从、众',
    radicals: ['亻', '人', '入', '彳', '从', '众'],
  },
  {
    key: 'w',
    hand: 'L',
    zone: '撇区',
    openingStroke: 'pie',
    strokeSymbol: '丿',
    label: 'W · 手禾牛斤',
    shortTag: '手禾',
    soloLeader: '手',
    fingerLabel: '左无名',
    rule: '短撇起带横竖：扌、手、禾、牛、斤、反、生、失、午、气、毛',
    radicals: ['扌', '手', '龵', '禾', '斤', '斥', '反', '爪', '爫', '丘', '兵', '片', '牛', '牜', '生', '失', '朱', '午', '矢', '气', '毛', '氏', '升'],
  },
  {
    key: 'q',
    hand: 'L',
    zone: '撇区',
    openingStroke: 'pie',
    strokeSymbol: '丿',
    label: 'Q · 伞盖金竹',
    shortTag: '金竹',
    soloLeader: '八',
    fingerLabel: '左小指',
    rule: '人八伞顶与金食竹：八、金、钅、食、饣、合、竹、分、公、父',
    radicals: ['八', '金', '钅', '食', '饣', '合', '竹', '⺮', '僉', '分', '公', '父', '谷', '兑'],
  },
  {
    key: 'c',
    hand: 'L',
    zone: '撇区',
    openingStroke: 'pie',
    strokeSymbol: '丿',
    label: 'C · 月夕鱼鸟',
    shortTag: '月鸟',
    soloLeader: '月',
    fingerLabel: '左中指',
    rule: '长弯撇身形：月、夕、歹、犭、鱼、鸟、舟、身、瓜',
    radicals: ['月', '⺼', '夕', '歹', '犭', '鱼', '鸟', '舟', '身', '瓜', '豸', '乌', '烏'],
  },
  {
    key: 'b',
    hand: 'L',
    zone: '撇区',
    openingStroke: 'pie',
    strokeSymbol: '丿',
    label: 'B · 儿几白包',
    shortTag: '儿白',
    soloLeader: '白',
    fingerLabel: '左食内',
    rule: '撇起包怀或白自：儿、几、风、勹、久、勺、欠、白、自、用、周',
    radicals: ['儿', '几', '凡', '风', '勹', '久', '勺', '欠', '白', '自', '鬼', '臼', '鼠', '鼻', '角', '用', '甩', '周', '同'],
  },

  // === 左手 · 折区 (4) ===
  {
    key: 's',
    hand: 'L',
    zone: '折区',
    openingStroke: 'zhe',
    strokeSymbol: '乛',
    label: 'S · 又刀力皮',
    shortTag: '又刀',
    soloLeader: '又',
    fingerLabel: '左无名',
    rule: '横撇又叉与刀力：又、攵、夂、刀、力、乃、皮、艮、予、争、寻',
    radicals: ['又', '攵', '攴', '夂', '夊', '殳', '刀', '刂', '力', '乃', '皮', '艮', '予', '矛', '争', '彐', 'ヨ', '录', '寻', '尹', '君', '聿'],
  },
  {
    key: 'd',
    hand: 'L',
    zone: '折区',
    openingStroke: 'zhe',
    strokeSymbol: '乛',
    label: 'D · 女丝幺厶',
    shortTag: '女丝',
    soloLeader: '女',
    fingerLabel: '左中指',
    rule: '撇折或撇点起笔：女、纟、糸、幺、母、厶、匕、乡',
    radicals: ['女', '纟', '糸', '幺', '母', '毋', '厶', '匕', '乡', '兹', '幽'],
  },
  {
    key: 'v',
    hand: 'L',
    zone: '折区',
    openingStroke: 'zhe',
    strokeSymbol: '乛',
    label: 'V · 乙了子己',
    shortTag: '乙子',
    soloLeader: '了',
    fingerLabel: '左食指',
    rule: '纯折弯钩系：乙、了、子、巴、己、已、弓、也、九、飞、习、羽、民',
    radicals: ['乙', '乚', '了', '子', '孑', '巴', '己', '已', '巳', '弓', '也', '九', '飞', '习', '羽', '民', '乜', '卫', '卩', '㔾'],
  },
  {
    key: 'z',
    hand: 'L',
    zone: '折区',
    openingStroke: 'zhe',
    strokeSymbol: '乛',
    label: 'Z · 阝尸户马',
    shortTag: '尸马',
    soloLeader: '马',
    fingerLabel: '左小指',
    rule: '耳刀尸户与马建：阝、尸、户、马、尺、尾、居、廴、建',
    radicals: ['阝', '尸', '户', '戶', '马', '馬', '尺', '尾', '居', '廴', '建', '肃', '弗'],
  },

  // === 右手 · 框区 (4) ===
  {
    key: 'j',
    hand: 'R',
    zone: '框区',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'J · 口中虫框',
    shortTag: '口中',
    soloLeader: '口',
    fingerLabel: '右食指',
    rule: '空口及单竖穿口：口、中、虫、吕、品、只、另、史、央',
    radicals: ['口', '中', '虫', '吕', '品', '兄', '只', '另', '呈', '员', '吴', '史', '央', '串'],
  },
  {
    key: 'k',
    hand: 'R',
    zone: '框区',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'K · 日目横格',
    shortTag: '日目',
    soloLeader: '日',
    fingerLabel: '右中指',
    rule: '竖框内有横画分隔：日、曰、目、旦、早、昔、昌、音、冒',
    radicals: ['日', '曰', '目', '旦', '早', '旨', '旬', '昔', '昌', '晶', '音', '章', '冒', '曼', '最'],
  },
  {
    key: 'l',
    hand: 'R',
    zone: '框区',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'L · 田里甲由',
    shortTag: '田里',
    soloLeader: '田',
    fingerLabel: '右无名',
    rule: '方框纵横交格：田、罒、里、皿、曲、甲、由、申、电、果、重',
    radicals: ['田', '罒', '里', '皿', '曲', '甲', '由', '申', '电', '果', '男', '思', '畏', '毕', '黑', '重', '量', '曾', '鲁'],
  },
  {
    key: 'i',
    hand: 'R',
    zone: '框区',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'I · 囗门贝见',
    shortTag: '门贝',
    soloLeader: '门',
    fingerLabel: '右中指',
    rule: '大围框与门框贝见：囗、门、冂、贝、见、内、册、网、骨、高',
    radicals: ['囗', '门', '門', '冂', '贝', '貝', '见', '見', '内', '册', '网', '岡', '骨', '高', '鼎'],
  },

  // === 右手 · 竖区 (2) ===
  {
    key: 'u',
    hand: 'R',
    zone: '竖区',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'U · 小止上卜',
    shortTag: '小止',
    soloLeader: '小',
    fingerLabel: '右食指',
    rule: '直竖立柱非框体：小、丨、止、上、卜、占、步、此、非、业、北',
    radicals: ['小', '⺌', '丨', '止', '上', '卜', '占', '肯', '步', '此', '非', '业', '归', '旧', '师', '帅', '北', '川', '州'],
  },
  {
    key: 'o',
    hand: 'R',
    zone: '竖区',
    openingStroke: 'shu',
    strokeSymbol: '丨',
    label: 'O · 山巾足虎',
    shortTag: '山足',
    soloLeader: '山',
    fingerLabel: '右无名',
    rule: '开口山巾与足虎齿：山、巾、凵、足、虎、齿、卤',
    radicals: ['山', '巾', '凵', '足', '⻊', '虎', '虍', '齿', '齒', '卤', '鹵', '鬥', '丩', '卡', '叔', '督'],
  },

  // === 右手 · 点区 (5) ===
  {
    key: 'h',
    hand: 'R',
    zone: '点区',
    openingStroke: 'dian',
    strokeSymbol: '丶',
    label: 'H · 水冰三点',
    shortTag: '水冰',
    soloLeader: '水',
    fingerLabel: '右食内',
    rule: '水冰流势：氵、水、冫、永、求、泉',
    radicals: ['氵', '水', '氺', '冫', '永', '求', '泰', '冰', '泉'],
  },
  {
    key: 'n',
    hand: 'R',
    zone: '点区',
    openingStroke: 'dian',
    strokeSymbol: '丶',
    label: 'N · 心火意念',
    shortTag: '心火',
    soloLeader: '心',
    fingerLabel: '右食内',
    rule: '心火散点：心、忄、火、灬、必、为、义',
    radicals: ['心', '忄', '⺗', '火', '灬', '必', '为', '义'],
  },
  {
    key: 'm',
    hand: 'R',
    zone: '点区',
    openingStroke: 'dian',
    strokeSymbol: '丶',
    label: 'M · 走之广病',
    shortTag: '走广',
    soloLeader: '走',
    fingerLabel: '右食指',
    rule: '走之托底与广病半包：辶、走、之、广、疒、府、度、应、麻、鹿',
    radicals: ['辶', '走', '之', '退', '追', '广', '疒', '府', '度', '底', '庄', '床', '应', '麻', '鹿'],
  },
  {
    key: 'y',
    hand: 'R',
    zone: '点区',
    openingStroke: 'dian',
    strokeSymbol: '丶',
    label: 'Y · 屋盖点横',
    shortTag: '屋盖',
    soloLeader: '文',
    fingerLabel: '右食内',
    rule: '顶盖与点横头：宀、冖、穴、亠、立、方、文、六、主、亡、衣、辛',
    radicals: ['宀', '冖', '穴', '亠', '立', '方', '文', '六', '主', '亡', '亥', '京', '亭', '亮', '玄', '率', '齐', '衣', '辛', '帝', '童', '龙'],
  },
  {
    key: 'p',
    hand: 'R',
    zone: '点区',
    openingStroke: 'dian',
    strokeSymbol: '丶',
    label: 'P · 言衣米羊',
    shortTag: '言衣',
    soloLeader: '言',
    fingerLabel: '右小指',
    rule: '言衣偏旁与米羊散点：讠、言、礻、衤、米、羊、半、丶、丷',
    radicals: ['讠', '言', '訁', '礻', '衤', '米', '羊', '⺶', '半', '丶', '丷', '〇'],
  },
];

export const WRITER_25_MAP = new Map<string, Writer25FamilyMeta>(
  WRITER_25_FAMILIES.map((f) => [f.key, f])
);

export const MIRROR_STROKE_ENDINGS: MirrorStrokeEntry[] = [
  { stroke: 'heng', symbol: '一', name: '横', leftShort: 'f', leftLong: 'r', rightShort: 'j', rightLong: 'u' },
  { stroke: 'shu', symbol: '丨', name: '竖', leftShort: 'd', leftLong: 's', rightShort: 'k', rightLong: 'i' },
  { stroke: 'pie', symbol: '丿', name: '撇', leftShort: 'e', leftLong: 'w', rightShort: 'h', rightLong: 'y' },
  { stroke: 'dian', symbol: '丶', name: '点', leftShort: 'v', leftLong: 't', rightShort: 'l', rightLong: 'o' },
  { stroke: 'zhe', symbol: '乛', name: '折', leftShort: 'g', leftLong: 'b', rightShort: 'n', rightLong: 'm' },
];

const L_SHORT: Record<InitialStrokeId, string> = { heng: 'f', shu: 'd', pie: 'e', dian: 'v', zhe: 'g' };
const L_LONG: Record<InitialStrokeId, string> = { heng: 'r', shu: 's', pie: 'w', dian: 't', zhe: 'b' };
const R_SHORT: Record<InitialStrokeId, string> = { heng: 'j', shu: 'k', pie: 'h', dian: 'l', zhe: 'n' };
const R_LONG: Record<InitialStrokeId, string> = { heng: 'u', shu: 'i', pie: 'y', dian: 'o', zhe: 'm' };

const L_COUNT_RING = ['f', 'd', 'e', 'v', 'g', 'r', 's', 'w', 't', 'b'];
const R_COUNT_RING = ['j', 'k', 'h', 'l', 'n', 'u', 'i', 'y', 'o', 'm'];

const RADICAL_TO_KEY25 = new Map<string, string>();
for (const fam of WRITER_25_FAMILIES) {
  for (const r of fam.radicals) {
    RADICAL_TO_KEY25.set(r, fam.key);
  }
}

const FALLBACK_STROKE_KEY: Record<InitialStrokeId, string> = {
  heng: 'f',
  shu: 'u',
  pie: 'w',
  dian: 'p',
  zhe: 's',
};

// 5 Literary Writer Passages — 100% verified against the 1,067 Simplified corpus
export const WRITER_PASSAGES: WriterPassage[] = [
  {
    id: 'quiet-craft',
    title: '落墨起势',
    note: '十二字静气短句 · 体会单键纯形四码自动落字节奏',
    text: '一字一形，手落墨生，心手相应。',
  },
  {
    id: 'mountain-moon',
    title: '山月清风',
    note: '高频自然意象 · 高左右手交替率实测',
    text: '山月明，水清风轻，人静心安。',
  },
  {
    id: 'morning-window',
    title: '清晨见山',
    note: '散文起笔长句 · 全程无需敲击空格自分割',
    text: '清晨开门见山，微风吹动树叶，远方云淡天高。',
  },
  {
    id: 'autumn-pine',
    title: '秋风松泉',
    note: '偏旁组合丰富 · 木、日、石、水、心交替流转',
    text: '秋风过林，白日落山，松影照石泉。',
  },
  {
    id: 'writer-credo',
    title: '纸上之路',
    note: '作家纯粹书写观 · 告别声音惯性，以目光构字',
    text: '夜深人静，手写旧句，文字不是声音的回声，而是目光在纸上走过的路。',
  },
];

function getStrokeKeyOpposite(stroke: InitialStrokeId, isLong: boolean, prevKey: string): string {
  if (LEFT_KEYS_SET.has(prevKey)) {
    return isLong ? R_LONG[stroke] : R_SHORT[stroke];
  }
  return isLong ? L_LONG[stroke] : L_SHORT[stroke];
}

function getCountKeyOpposite(strokes: number, prevKey: string): string {
  const idx = Math.max(0, Math.min(9, strokes - 1));
  return LEFT_KEYS_SET.has(prevKey) ? R_COUNT_RING[idx] : L_COUNT_RING[idx];
}

function makeStep(
  index: number,
  key: string,
  role: SingleKeyStep['role'],
  roleLabel: string,
  radical: string,
  visualCue: string
): SingleKeyStep {
  return {
    index,
    key,
    hand: LEFT_KEYS_SET.has(key) ? 'L' : 'R',
    fingerLabel: FINGER_BY_KEY[key]?.label ?? '',
    role,
    roleLabel,
    radical,
    visualCue,
  };
}

const simCache = new Map<string, SingleKeySimulationResult>();

export function runSingleKeyPureShape(
  stageId: KineticStageId = 'full1448',
  scriptMode: ScriptMode = 'simp'
): SingleKeySimulationResult {
  const cacheKey = `${stageId}:${scriptMode}`;
  const cached = simCache.get(cacheKey);
  if (cached) return cached;

  const fullRefSim = runKineticSimulation(
    'three_row_dir8',
    'bidirectional',
    'full1448',
    'both',
    'yuhao',
    'event_stream'
  );
  const stageSim =
    stageId === 'full1448' && scriptMode === 'both'
      ? fullRefSim
      : runKineticSimulation(
          'three_row_dir8',
          'bidirectional',
          stageId,
          scriptMode,
          'yuhao',
          'event_stream'
        );

  const radOriginMap = new Map<string, InitialStrokeId>();
  const radFreqMap = new Map<string, number>();
  for (const r of fullRefSim.radicals) {
    radOriginMap.set(r.radical, r.originStroke);
  }
  for (const ch of stageSim.chars) {
    for (const p of ch.parts) {
      radFreqMap.set(p, (radFreqMap.get(p) ?? 0) + 1);
    }
  }

  const getKey25 = (rad: string): string => {
    const explicit = RADICAL_TO_KEY25.get(rad);
    if (explicit) return explicit;
    const spec = getPureShapeRadicalSpec(rad, radOriginMap.get(rad) ?? 'heng');
    const open =
      PURE_SHAPE_LEFT_MAP.get(spec.leftKey)?.openingStroke ??
      radOriginMap.get(rad) ??
      'heng';
    return FALLBACK_STROKE_KEY[open] ?? 'f';
  };

  // Map all 269 official Yuhao radicals to their 25 keys
  const radicalsByKey = new Map<string, Array<{ radical: string; freq: number }>>();
  for (const fam of WRITER_25_FAMILIES) radicalsByKey.set(fam.key, []);
  let coveredOfficial = 0;
  for (const officialRad of LINGMING_ROOT_MAP.keys()) {
    const k = getKey25(officialRad);
    const list = radicalsByKey.get(k);
    if (list) {
      list.push({ radical: officialRad, freq: radFreqMap.get(officialRad) ?? 0 });
      coveredOfficial++;
    }
  }
  for (const list of radicalsByKey.values()) {
    list.sort((a, b) => b.freq - a.freq || a.radical.localeCompare(b.radical));
  }

  const chars: SingleKeyCharEntry[] = [];
  const byChar = new Map<string, SingleKeyCharEntry>();
  const byCode = new Map<string, SingleKeyCharEntry[]>();

  let totalKeystrokes = 0;
  let leftKeystrokes = 0;
  let pinkyKeystrokes = 0;
  let xKeystrokes = 0;
  let totalPairs = 0;
  let altPairs = 0;
  let sfbPairs = 0;

  for (const entry of stageSim.chars) {
    const p = entry.parts;
    if (p.length === 0) continue;

    const k1 = getKey25(p[0]);
    const fam1 = WRITER_25_MAP.get(k1)!;
    const steps: SingleKeyStep[] = [
      makeStep(0, k1, 'root', p.length === 1 ? '本根' : '首根', p[0], `${p[0]} → ${fam1.shortTag}`),
    ];

    if (p.length === 1) {
      const spec = getPureShapeRadicalSpec(p[0], radOriginMap.get(p[0]) ?? 'heng');
      const endLong = spec.strokes >= 4;
      const k2 = getStrokeKeyOpposite(spec.lastStroke, endLong, k1);
      const endMeta = STROKE_LABEL[spec.lastStroke];
      steps.push(
        makeStep(
          1,
          k2,
          'end_stroke',
          '异手末笔',
          p[0],
          `末笔${endMeta.symbol}(${endLong ? '多≥4画' : '少≤3画'})`
        )
      );

      const sec = getWholeCharSecondBeatSpec(entry.char);
      const secStroke: InitialStrokeId = sec?.stroke ?? spec.lastStroke;
      const secStrokes = sec?.strokes ?? spec.strokes;
      const secLong = secStrokes >= 4;
      const k3 = getStrokeKeyOpposite(secStroke, secLong, k2);
      const secMeta = STROKE_LABEL[secStroke];
      steps.push(
        makeStep(
          2,
          k3,
          'second_stroke',
          '异手次笔',
          entry.char,
          `次笔${secMeta.symbol}(${secLong ? '多≥4画' : '少≤3画'})`
        )
      );

      const k4 = getCountKeyOpposite(secStrokes, k3);
      steps.push(
        makeStep(3, k4, 'stroke_count', '异手画数', entry.char, `共 ${secStrokes} 画收尾`)
      );
    } else if (p.length === 2) {
      const k2 = getKey25(p[1]);
      const fam2 = WRITER_25_MAP.get(k2)!;
      steps.push(makeStep(1, k2, 'root', '末根', p[1], `${p[1]} → ${fam2.shortTag}`));

      const spec1 = getPureShapeRadicalSpec(p[0], radOriginMap.get(p[0]) ?? 'heng');
      const long1 = spec1.strokes >= 4;
      const k3 = getStrokeKeyOpposite(spec1.lastStroke, long1, k2);
      steps.push(
        makeStep(
          2,
          k3,
          'end_stroke',
          '首根收笔',
          p[0],
          `${p[0]}收${STROKE_LABEL[spec1.lastStroke].symbol}(${long1 ? '≥4画' : '≤3画'})`
        )
      );

      const spec2 = getPureShapeRadicalSpec(p[1], radOriginMap.get(p[1]) ?? 'heng');
      const long2 = spec2.strokes >= 4;
      const k4 = getStrokeKeyOpposite(spec2.lastStroke, long2, k3);
      steps.push(
        makeStep(
          3,
          k4,
          'end_stroke',
          '末根收笔',
          p[1],
          `${p[1]}收${STROKE_LABEL[spec2.lastStroke].symbol}(${long2 ? '≥4画' : '≤3画'})`
        )
      );
    } else if (p.length === 3) {
      const k2 = getKey25(p[1]);
      const fam2 = WRITER_25_MAP.get(k2)!;
      steps.push(makeStep(1, k2, 'root', '次根', p[1], `${p[1]} → ${fam2.shortTag}`));

      const k3 = getKey25(p[2]);
      const fam3 = WRITER_25_MAP.get(k3)!;
      steps.push(makeStep(2, k3, 'root', '末根', p[2], `${p[2]} → ${fam3.shortTag}`));

      const spec3 = getPureShapeRadicalSpec(p[2], radOriginMap.get(p[2]) ?? 'heng');
      const long3 = spec3.strokes >= 4;
      const k4 = getStrokeKeyOpposite(spec3.lastStroke, long3, k3);
      steps.push(
        makeStep(
          3,
          k4,
          'end_stroke',
          '末根收笔',
          p[2],
          `${p[2]}收${STROKE_LABEL[spec3.lastStroke].symbol}(${long3 ? '≥4画' : '≤3画'})`
        )
      );
    } else {
      const k2 = getKey25(p[1]);
      const fam2 = WRITER_25_MAP.get(k2)!;
      steps.push(makeStep(1, k2, 'root', '次根', p[1], `${p[1]} → ${fam2.shortTag}`));

      const k3 = getKey25(p[2]);
      const fam3 = WRITER_25_MAP.get(k3)!;
      steps.push(makeStep(2, k3, 'root', '三根', p[2], `${p[2]} → ${fam3.shortTag}`));

      const lastRoot = p[p.length - 1];
      const k4 = getKey25(lastRoot);
      const fam4 = WRITER_25_MAP.get(k4)!;
      steps.push(makeStep(3, k4, 'root', '末根', lastRoot, `${lastRoot} → ${fam4.shortTag}`));
    }

    const code = steps.map((s) => s.key).join('');
    const displayCode = steps.map((s) => s.key.toUpperCase()).join(' ');

    let charAlt = 0;
    let charSfb = 0;
    for (let i = 0; i < code.length; i++) {
      const k = code[i];
      totalKeystrokes++;
      if (LEFT_KEYS_SET.has(k)) leftKeystrokes++;
      if (FINGER_BY_KEY[k]?.isPinky) pinkyKeystrokes++;
      if (k === 'x') xKeystrokes++;
      if (i > 0) {
        totalPairs++;
        if (LEFT_KEYS_SET.has(code[i - 1]) !== LEFT_KEYS_SET.has(k)) {
          altPairs++;
          charAlt++;
        }
        if (
          FINGER_BY_KEY[code[i - 1]]?.group === FINGER_BY_KEY[k]?.group &&
          code[i - 1] !== k
        ) {
          sfbPairs++;
          charSfb++;
        }
      }
    }

    const charEntry: SingleKeyCharEntry = {
      char: entry.char,
      script: entry.script,
      parts: entry.parts,
      code,
      displayCode,
      steps,
      alternationPct: Math.round((charAlt / 3) * 100),
      sfbCount: charSfb,
      isCoreDrill: entry.isCoreDrill,
    };

    chars.push(charEntry);
    byChar.set(entry.char, charEntry);
    const bucket = byCode.get(code) ?? [];
    bucket.push(charEntry);
    byCode.set(code, bucket);
  }

  const collisions: SingleKeyCollisionGroup[] = [];
  let collisionChars = 0;
  for (const [code, group] of byCode.entries()) {
    if (group.length > 1) {
      collisions.push({ code, chars: group });
      collisionChars += group.length - 1;
    }
  }
  collisions.sort((a, b) => b.chars.length - a.chars.length || a.code.localeCompare(b.code));

  const totalChars = chars.length;
  const uniqueCodes = byCode.size;
  const leftHandPct = totalKeystrokes > 0 ? (leftKeystrokes / totalKeystrokes) * 100 : 50;

  const result: SingleKeySimulationResult = {
    stageId,
    scriptMode,
    chars,
    byChar,
    byCode,
    radicalsByKey,
    collisions,
    metrics: {
      totalChars,
      uniqueCodes,
      firstChoiceRate: totalChars > 0 ? (uniqueCodes / totalChars) * 100 : 100,
      collisionChars,
      avgCodeLength: 4.0,
      handAlternationPct: totalPairs > 0 ? (altPairs / totalPairs) * 100 : 0,
      sfbPct: totalPairs > 0 ? (sfbPairs / totalPairs) * 100 : 0,
      leftHandPct,
      rightHandPct: 100 - leftHandPct,
      pinkyPct: totalKeystrokes > 0 ? (pinkyKeystrokes / totalKeystrokes) * 100 : 0,
      xKeyPct: totalKeystrokes > 0 ? (xKeystrokes / totalKeystrokes) * 100 : 0,
      totalRadicalsCovered: coveredOfficial,
      officialYuhaoTotal: LINGMING_ROOT_MAP.size,
    },
  };

  simCache.set(cacheKey, result);
  return result;
}
