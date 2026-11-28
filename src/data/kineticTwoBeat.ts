import { MorphBrushStroke, MorphPt, RadicalMorphNode } from './twentyKeysMorphTypes';

export type MotorTravelType =
  | 'up_left'
  | 'up_right'
  | 'home_drop'
  | 'glide_right'
  | 'glide_left'
  | 'down_right'
  | 'down_left';

export interface KeyMotorProfile {
  key: string;
  travelType: MotorTravelType;
  // Unit vector in canvas screen coordinates (+x right, +y down) matching physical finger travel from homeKey -> key
  vecX: number;
  vecY: number;
  arrowSymbol: string;
  originCornerLabel: string; // Opposite starting region in the radical box
  travelPhaseLabel: string; // Beat 1: Finger travel motion
  stopPhaseLabel: string; // Beat 2: Keypress bottoming-out resistance
  motorPrinciple: string; // 1-sentence embodied memory rule
}

export type KineticBeatMode = 'stroke_sweep' | 'motif_glide' | 'core_bloom';

export type CoreShapeKind =
  | 'square_corner'
  | 'cross_axis'
  | 'datum_bar'
  | 'base_seat'
  | 'slant_edge'
  | 'spine_needle';

export interface MotifGlideData {
  // Stroke(s) that physically translate along the finger's displacement vector during Beat 1
  movingStrokes: MorphBrushStroke[];
  // Normalized canvas offset at Beat 1 start (t=0) and destination (t=1, settled on glyph)
  fromOffset: { x: number; y: number };
  toOffset: { x: number; y: number };
}

export interface CoreBloomData {
  // Fundamental shared symbol strokes of this home-row vertical key (e.g. D's right-angle corner)
  coreStrokes: MorphBrushStroke[];
  // Outer strokes that expand/bloom outward from the core anchor
  outerStrokes: MorphBrushStroke[];
  // Central pivot / right-angle corner point where expansion begins
  anchorPoint: { x: number; y: number };
  shapeKind: CoreShapeKind;
  coreTag: string;
}

export interface TwoBeatDecomposition {
  key: string;
  radical: string;
  motor: KeyMotorProfile;
  // 'stroke_sweep' / 'motif_glide': 14 travel keys -> Beat 1 (起势) -> Beat 2 (击键) -> Beat 3 (弹回)
  // 'core_bloom': 6 home-row vertical keys (S D F J K L) -> Beat 1 (原位定核) -> Beat 2 (由核扩散) -> Beat 3 (垂立归位)
  kineticMode: KineticBeatMode;
  motifGlide?: MotifGlideData;
  coreBloom?: CoreBloomData;
  // Part 1: Single stroke (or representative guide path) following the finger trajectory
  trajectoryStroke: MorphBrushStroke;
  // Part 2: ALL remaining strokes (or full settled radical in motif_glide) unified into ONE stopping block
  stopStrokes: MorphBrushStroke[];
  // Exact 2D start anchor (0..1) where Beat 1 launches
  originPoint: { x: number; y: number };
  // Concise spatial label derived from originPoint (e.g. "右下角起势", "一从下往上移")
  originCornerText: string;
  // Exact 2D collision / locking point (0..1) where Part 2 locks Beat 1's momentum
  impactPoint: { x: number; y: number };
  // Exact 2D outer contour wall (0..1) in +motor.vec where the glyph bounces the finger back home
  reboundPoint: { x: number; y: number };
  // Return target (0..1) along -motor.vec showing the elastic springback toward home key
  reboundTarget: { x: number; y: number };
  // Per-radical natural-language hints for Beat 1, Beat 2, and Beat 3
  travelHint: string;
  stopHint: string;
  reboundHint: string;
  // Whether the trajectory stroke was reversed to flow strictly along the physical finger travel vector
  reversedForFingerFlow: boolean;
  // Alignment cosine (0..1) between trajectory axis and finger motion vector
  alignmentScore: number;
  // True for 1-stroke radicals where Beat 1 = travel body, Beat 2 = terminal dunbi/hook arrest
  isSingleStrokeSplit: boolean;
}

const normVec = (x: number, y: number): [number, number] => {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
};

const makeProfile = (
  key: string,
  travelType: MotorTravelType,
  rawX: number,
  rawY: number,
  arrowSymbol: string,
  originCornerLabel: string,
  travelPhaseLabel: string,
  stopPhaseLabel: string,
  motorPrinciple: string
): KeyMotorProfile => {
  const [vecX, vecY] = normVec(rawX, rawY);
  return {
    key,
    travelType,
    vecX,
    vecY,
    arrowSymbol,
    originCornerLabel,
    travelPhaseLabel,
    stopPhaseLabel,
    motorPrinciple,
  };
};

export const KEY_MOTOR_PROFILES: Record<string, KeyMotorProfile> = {
  // === Top Row (QWERTY staggered -0.25u left, finger lifts upward / diagonally) ===
  q: makeProfile(
    'q',
    'up_left',
    -0.25,
    -1.0,
    '↖',
    '右下角 / 尾端起势',
    '左小指上略外探，从字根右下角或尾端反向朝↖上穿',
    '落键瞬间被上方横梁或余部结构迎面截停交锁',
    '小指自 A 向 Q 上探成「去势」，必从右下角或末点逆势上行，触键阻力瞬间将余构锁停。'
  ),
  w: makeProfile(
    'w',
    'up_left',
    -0.25,
    -1.0,
    '↖',
    '右下 / 下方起势',
    '左无名上探轻提，顺弯弧/竖撇牵引',
    '触底急刹，余部折回或平拖定形',
    '无名指由 S 上探 W 画出灵动主弧，落键刹停即生回钩与附笔阻力。'
  ),
  r: makeProfile(
    'r',
    'up_left',
    -0.25,
    -1.0,
    '↖',
    '下层起势跨排',
    '左食指抬指上跨，划出引导基准笔',
    '落键踏实，余部叠成平行双勒块',
    '食指自 F 上跨至 R，抬起一势、落键成叠，天然对应上下/左右双层阻定。'
  ),
  t: makeProfile(
    't',
    'up_right',
    0.75,
    -1.0,
    '↗',
    '左下起势右上探',
    '左食指斜向右上方探出起势',
    '触键如鸟啄向右下 90° 顿点截停',
    '食指由 F 斜探 T 划出右上斜势，指尖砸落的一瞬恰成反折顿啄停顿。'
  ),
  y: makeProfile(
    'y',
    'up_left',
    -1.25,
    -1.0,
    '↖',
    '右下起势大跨左上',
    '右食指大幅向左上斜跨舒展',
    '落键定桩，余翼向两侧撑开锁势',
    '全键盘最长斜跨带来强烈张力，去势斜穿，落键一顿便将双翼稳稳撑住。'
  ),
  p: makeProfile(
    'p',
    'up_left',
    -0.25,
    -1.0,
    '↖',
    '右外下缘上扣',
    '右小指自外缘微扣上探成弧臂',
    '落键向内怀抱，余部稳锁腹中',
    '小指自分号键外侧上探 P 画出抱臂轨迹，触键一收将内里字块合拢停住。'
  ),

  // === Home Row Zero-Travel (Pure vertical gravity drop ↓) ===
  s: makeProfile(
    's',
    'home_drop',
    0,
    1.0,
    '↓',
    '中上原位直垂',
    '左无名原位无移，垂直下坠入骨',
    '触底重顿，底部长横/弯钩稳稳托停',
    '手指原位不移、垂直沉降，按到底部的键帽阻尼正对应「底托」那一重块。'
  ),
  d: makeProfile(
    'd',
    'home_drop',
    0,
    1.0,
    '↓',
    '左壁原位垂落',
    '左中指原位如印直落，先定左直壁',
    '落键封宫，方折余壁合围锁停',
    '中指原位直落定出方框左壁，触键阻尼化作折框余部四面合围停住。'
  ),
  f: makeProfile(
    'f',
    'home_drop',
    0,
    1.0,
    '↓',
    '基准凸点直落压平',
    '左食指守住凸点垂直压落',
    '触底拍平，主横界与余构稳住全局',
    '食指在 F 凸点原位稳压，垂直落势触底瞬间铺展成清晰横界并定住余形。'
  ),
  j: makeProfile(
    'j',
    'home_drop',
    -0.32,
    0.95,
    '↙',
    '右上微倾原位切落',
    '右食指借凸点微斜切入纸背',
    '落键瞬间由直柱或反笔截停收锋',
    '右食指在 J 原位自然微斜落键，第一拍侧锋切下，第二拍余块稳稳接停。'
  ),
  k: makeProfile(
    'k',
    'home_drop',
    0,
    1.0,
    '↓',
    '中轴正顶原位直垂',
    '右中指原位纯垂直中锋直入',
    '触键落定，其余结构附柱成字',
    '中指无须任何偏摆，一根垂直中轴直落到底，剩余笔画统一归为落键定形块。'
  ),
  l: makeProfile(
    'l',
    'home_drop',
    0,
    1.0,
    '↓',
    '中顶原位悬针直贯',
    '右无名原位直下贯通纵轴',
    '落键遇横架锁腰，化作贯立终态',
    '无名指原位长落如悬针直贯，触键阻尼由横梁与余部一举锁住中腰。'
  ),

  // === Home Row Pure Horizontal Glide (→ / ←) ===
  g: makeProfile(
    'g',
    'glide_right',
    1.0,
    0,
    '→',
    '左侧起势纯右平推',
    '左食指自 F 向右纯平滑动',
    '落键拐折回环，余块闭锁气脉',
    '食指纯水平向右滑入 G，去势横出，触键瞬间产生折转回环阻力把笔停住。'
  ),
  h: makeProfile(
    'h',
    'glide_left',
    -1.0,
    0,
    '←',
    '右顶起势纯左平扫',
    '右食指自 J 向左纯平扫出平顶',
    '触键 90° 垂直垂露，余部下挂定形',
    '食指纯水平向左扫至 H 画出平顶横势，落键一瞬垂直向下垂落刹停。'
  ),

  // === Bottom Row Curl-Down (QWERTY staggered +0.50u right) ===
  x: makeProfile(
    'x',
    'down_right',
    0.45,
    0.89,
    '↘',
    '左上起势下扣坐实',
    '左无名向下收扣直扎中柱',
    '触键顿底，横枝余块稳固立桩',
    '无名指由 S 向 X 下扣坐实立定主柱，落键阻尼让其余枝横一并落定。'
  ),
  c: makeProfile(
    'c',
    'down_right',
    0.45,
    0.89,
    '↘',
    '左上起势向掌心卷扣',
    '左中指向掌心自然卷曲下收',
    '落键折笔内敛，余块紧收成团',
    '中指由 D 向 C 内卷收扣，第一拍顺势弯入，落键阻力将余部折敛锁紧。'
  ),
  v: makeProfile(
    'v',
    'down_right',
    0.45,
    0.89,
    '↘',
    '中上起势下掠直切',
    '左食指斜向下掠划出分水主干',
    '触键分流，左右余块散开定势',
    '食指自 F 向 V 干脆下掠切开中路，触键瞬间余部如水花向两侧分流停住。'
  ),
  b: makeProfile(
    'b',
    'down_right',
    0.83,
    0.55,
    '↘',
    '左上大跨右下扣压',
    '左食指大跨度向右下方压罩',
    '落键重盖封顶，下方余块稳藏其下',
    '食指自 F 远探 B 划出覆盖压势，触键阻尼像屋盖般把剩余主体一次罩停。'
  ),
  n: makeProfile(
    'n',
    'down_left',
    -0.45,
    0.89,
    '↙',
    '右上起势左下斜滑',
    '右食指自 J 向左下自然撇滑',
    '落键由右捺或右壁反撑稳停',
    '食指向左下收扣 N 与「撇」完全同轨，触键瞬间右侧余块迎面撑住重心。'
  ),
  m: makeProfile(
    'm',
    'down_right',
    0.45,
    0.89,
    '↘',
    '左上起势右下斜趯',
    '右食指自 J 向右下斜滑蓄力',
    '触底反弹外趯，余部锁稳骨架',
    '食指向右下收扣 M 与斜钩/长捺物理同轨，触底刹停的一瞬即化作外趯余块。'
  ),
};

// Optional precision overrides (stroke index inside [...coreStrokes, ...extraStrokes], plus reverse flag)
// for radicals where exact kinetic corner intuition beats general heuristics.
const TRAJECTORY_OVERRIDES: Record<string, { strokeIdx: number; reverse?: boolean }> = {
  // Q: upward/up-left travel from A -> Q ↖: launch from the bottom-right corner / trailing dot!
  'q-you': { strokeIdx: 1, reverse: true }, // 捺 reversed = bottom-right (0.86,0.84) -> top-left ↖, stopped by 横撇
  'q-qi': { strokeIdx: 7, reverse: true }, // 其 bottom-right tail dot (0.78,0.89) -> (0.60,0.76) ↖, rest locks as Stop Block!
  // H: pure leftward horizontal sweep (J->H ←), starting from right edge, then vertical Chuilu drop stops it
  'h-ding': { strokeIdx: 0, reverse: true },
  'h-xia1': { strokeIdx: 0, reverse: true },
  'h-xia': { strokeIdx: 0, reverse: true },
  'h-shi': { strokeIdx: 0, reverse: true },
  'h-zi': { strokeIdx: 0, reverse: true },
  'h-zou': { strokeIdx: 0, reverse: true },
  // G: pure rightward horizontal sweep (F->G →), starting from left edge, then loop/enclosure stops it
  'g-gongzi': { strokeIdx: 0, reverse: false },
  'g-feng': { strokeIdx: 0, reverse: false },
  // F: home vertical drop onto horizontal bar — pick vertical/descending entry when present, else primary horizontal
  'f-zheng': { strokeIdx: 1, reverse: false },
  'f-zu': { strokeIdx: 4, reverse: false },
  'f-shi': { strokeIdx: 1, reverse: false },
  // S: vertical drop into bottom support (bottom bar/hook stays in the stopping resistance block!)
  's-tu': { strokeIdx: 0, reverse: false },
  's-shi': { strokeIdx: 0, reverse: false },
  's-niu': { strokeIdx: 0, reverse: false },
  's-shan': { strokeIdx: 0, reverse: false },
  's-ye': { strokeIdx: 0, reverse: false },
  's-laotou': { strokeIdx: 0, reverse: false },
  's-hei': { strokeIdx: 0, reverse: false },
  // L: vertical Xuanzhen drop first, horizontal crossbar locks it!
  'l-shi': { strokeIdx: 1, reverse: false },
  'l-gu': { strokeIdx: 1, reverse: false },
  'l-bu': { strokeIdx: 1, reverse: false },
  'l-gan': { strokeIdx: 1, reverse: false },
  'l-qian': { strokeIdx: 1, reverse: false },
  'l-ren': { strokeIdx: 1, reverse: false },
  'l-wei': { strokeIdx: 1, reverse: false },
  'l-mo': { strokeIdx: 1, reverse: false },
  'l-fu': { strokeIdx: 1, reverse: false },
  'l-she': { strokeIdx: 1, reverse: false },
  // K: pure vertical middle spine on 至
  'k-zhi': { strokeIdx: 0, reverse: false },
  // N: down-left sweep (J->N ↙) matches pie from top-right, right wing braces it!
  'n-ren': { strokeIdx: 0, reverse: false },
  'n-he': { strokeIdx: 0, reverse: false },
  'n-shi': { strokeIdx: 0, reverse: false },
  'n-wu': { strokeIdx: 0, reverse: false },
  // M: down-right sweep (J->M ↘) from top-left matches xieGou / woGou / na!
  'm-ge': { strokeIdx: 0, reverse: false },
  'm-xin': { strokeIdx: 0, reverse: false },
  'm-wu': { strokeIdx: 0, reverse: false },
  'm-yi': { strokeIdx: 0, reverse: false },
  'm-zhua': { strokeIdx: 0, reverse: false },
  'm-gua': { strokeIdx: 0, reverse: false },
  'm-bo': { strokeIdx: 0, reverse: false },
};

interface MotifGlideRule {
  moveIndices: number[];
  dist?: number;
  originTag: string;
  travelHint: string;
  stopHint: string;
}

// Organic element-displacement choreography when a radical's motion is better felt as
// "a structural motif shifting along the finger trajectory, then the full glyph locking on keypress"
const MOTIF_GLIDE_SPECS: Record<string, MotifGlideRule> = {
  'r-er': {
    moveIndices: [0],
    dist: 0.35,
    originTag: '一从下往上移',
    travelHint: '一横随 F→R（↖）自下而上平滑移位蓄势',
    stopHint: '落键瞬间上下两横同时定型为「二」',
  },
  'r-bing': {
    moveIndices: [0],
    dist: 0.35,
    originTag: '点从下往上移',
    travelHint: '下笔随 F→R（↖）自下而上轻抬移位',
    stopHint: '落键瞬间双冰点「冫」齐齐锁位定型',
  },
  'r-shuangdian': {
    moveIndices: [0],
    dist: 0.34,
    originTag: '点从下往上移',
    travelHint: '点笔随 F→R（↖）自右下向左上方上移',
    stopHint: '落键瞬间双点「⺀」同步定型',
  },
  'r-min': {
    moveIndices: [0],
    dist: 0.36,
    originTag: '横从底往上抬',
    travelHint: '横托随 F→R（↖）自底盘向上抬升对位',
    stopHint: '落键瞬间器皿四柱与底托一齐合定',
  },
  'r-wang': {
    moveIndices: [0],
    dist: 0.34,
    originTag: '框沿上抬定格',
    travelHint: '横沿随 F→R（↖）自下框向上抬至顶梁',
    stopHint: '落键瞬间「罒」方格整体同时定型',
  },
  'r-yan': {
    moveIndices: [0],
    dist: 0.34,
    originTag: '横阶自下上移',
    travelHint: '口横阶随 F→R（↖）自下层向上叠升',
    stopHint: '落键瞬间层叠横画与底座一齐稳住',
  },
  'f-yi': {
    moveIndices: [0],
    dist: 0.28,
    originTag: '平横自上压落',
    travelHint: '横担随 F 指原位垂直（↓）由上向下轻压',
    stopHint: '触底拍平瞬间定型为基准长横「一」',
  },
  't-dian': {
    moveIndices: [0],
    dist: 0.3,
    originTag: '左下向↗探出',
    travelHint: '墨点随 F→T（↗）从左下方斜向右上方探出',
    stopHint: '触键鸟啄重顿，化作「丶」稳稳落定',
  },
  't-na': {
    moveIndices: [0],
    dist: 0.24,
    originTag: '左下向↗蓄势',
    travelHint: '笔锋随 F→T（↗）先向左上方略探蓄势',
    stopHint: '落键瞬间反折顿出长捺「乀」定型',
  },
  'j-san': {
    moveIndices: [2],
    dist: 0.28,
    originTag: '上横↙滑落对位',
    travelHint: '中横随 J 指微斜（↙）自上方轻滑落位',
    stopHint: '落键瞬间三横「三」层层锁稳定型',
  },
  'j-tou': {
    moveIndices: [0],
    dist: 0.22,
    originTag: '顶盖↙切落',
    travelHint: '顶冠随 J 指微斜（↙）轻切而下',
    stopHint: '触键瞬间与长横合定为「亠」',
  },
  'g-gong': {
    moveIndices: [0],
    dist: 0.24,
    originTag: '左侧向→平推',
    travelHint: '首折随 F→G（→）从左侧水平向右平推入阵',
    stopHint: '落键回环瞬间折出全形「弓」',
  },
  'g-si': {
    moveIndices: [0],
    dist: 0.24,
    originTag: '左侧向→平推',
    travelHint: '折臂随 F→G（→）自左向右水平滑入',
    stopHint: '落键收拢瞬间三角「厶」闭锁定型',
  },
  'g-erdao': {
    moveIndices: [0],
    dist: 0.24,
    originTag: '左脊向→平推',
    travelHint: '耳廓随 F→G（→）自左向右平推贴合',
    stopHint: '落键瞬间「阝」双环直柱一并锁定',
  },
  'g-yao': {
    moveIndices: [0],
    dist: 0.24,
    originTag: '首节向→平推',
    travelHint: '曲丝随 F→G（→）自左向右水平滑入盘曲',
    stopHint: '触键回转瞬间定型为「幺」',
  },
  'm-fang': {
    moveIndices: [1, 2],
    dist: 0.26,
    originTag: '左上向↘斜压',
    travelHint: '顶盖「亠」随 J→M（↘）自左上斜滑罩下',
    stopHint: '落键瞬间勾挑定骨，全字「方」稳稳锁成',
  },
};

function reverseStroke(s: MorphBrushStroke): MorphBrushStroke {
  return {
    dunbiStart: true,
    flickEnd: false,
    points: [...s.points].reverse().map((pt) => ({ ...pt })),
  };
}

function describeOriginCorner(
  pt: { x: number; y: number },
  motor: KeyMotorProfile
): string {
  const { x, y } = pt;
  if (x >= 0.56 && y >= 0.56) return '右下角起势';
  if (x <= 0.44 && y >= 0.56) return '左下角起势';
  if (x >= 0.56 && y <= 0.44) return '右上角起势';
  if (x <= 0.44 && y <= 0.44) return '左上角起势';
  if (y >= 0.6) return '底端起势';
  if (y <= 0.4) return '顶端起势';
  if (x >= 0.6) return '右侧起势';
  if (x <= 0.4) return '左侧起势';
  return motor.originCornerLabel;
}

const HOME_VERTICAL_KEYS = new Set(['s', 'd', 'f', 'j', 'k', 'l']);

const HOME_CORE_META: Record<
  string,
  {
    shapeKind: CoreShapeKind;
    coreTag: string;
    travelHint: string;
    stopHint: string;
    reboundHint: string;
  }
> = {
  s: {
    shapeKind: 'base_seat',
    coreTag: '重顿托底基座',
    travelHint: '左无名指原位垂直下落，直取「托底基座」核心特征',
    stopHint: '以托底重横 / 弯钩为原点，向上扩散舒展全字结构',
    reboundHint: '原位垂直抬指回弹，掌心记住「重顿承底」的沉实阻尼',
  },
  d: {
    shapeKind: 'square_corner',
    coreTag: '横折直角方角',
    travelHint: '左中指原位垂直下落，先锚定「横折直角 / 拐角」根本特征',
    stopHint: '以直角拐点为核心向外扩散成大致方形的围宫范畴',
    reboundHint: '原位轻抬归位，指腹留存「横折直角」的方形边界记忆',
  },
  f: {
    shapeKind: 'datum_bar',
    coreTag: '一横定界基准',
    travelHint: '左食指守住凸点垂直按落，先定「一横定界」根本基准',
    stopHint: '由中央横界向上下两侧扩散展开余部笔画',
    reboundHint: '垂直抬指回弹，触感牢记 F 凸点一横贯界的稳度',
  },
  j: {
    shapeKind: 'slant_edge',
    coreTag: '侧锋斜切锋角',
    travelHint: '右食指在 J 凸点原位直落，先切出「侧锋斜角」核心特征',
    stopHint: '由斜切锋角向方折或右翼扩散定出全字形廓',
    reboundHint: '食指轻抬回位，保留侧锋斜入一刹那的轻切手感',
  },
  k: {
    shapeKind: 'spine_needle',
    coreTag: '中锋直轴支点',
    travelHint: '右中指原位垂直按入，先行确立「中锋直入」核心支点',
    stopHint: '以中位核心支点为中心向四周扩散补全外围结构',
    reboundHint: '原位垂直弹回，中指留存中锋直刺的定心张力',
  },
  l: {
    shapeKind: 'cross_axis',
    coreTag: '悬针贯立交叉枢',
    travelHint: '右无名指原位直落，先定「悬针贯立 / 十字枢轴」根本符号',
    stopHint: '从交叉枢轴或双直柱向外对称扩散铺展余笔',
    reboundHint: '垂直回抬归位，铭记修长贯立的中正平衡感',
  },
};

const REBOUND_HOME_ARROW: Record<string, string> = {
  q: '↘ 弹回 A',
  w: '↘ 弹回 S',
  r: '↘ 弹回 F',
  t: '↙ 弹回 F',
  y: '↘ 弹回 J',
  p: '↘ 弹回 ;',
  g: '← 弹回 F',
  h: '→ 弹回 J',
  x: '↖ 弹回 S',
  c: '↖ 弹回 D',
  v: '↖ 弹回 F',
  b: '↖ 弹回 F',
  n: '↗ 弹回 J',
  m: '↖ 弹回 J',
};

function findCoreAnchorPoint(
  coreStrokes: MorphBrushStroke[],
  shapeKind: CoreShapeKind
): { x: number; y: number } {
  if (coreStrokes.length === 0) return { x: 0.5, y: 0.5 };

  // For D's right-angle corner (横折角), locate the sharpest bend vertex or join corner!
  if (shapeKind === 'square_corner') {
    let bestCornerScore = Infinity;
    let bestPt: { x: number; y: number } | null = null;
    for (const st of coreStrokes) {
      if (st.points.length >= 3) {
        for (let i = 1; i < st.points.length - 1; i++) {
          const prev = st.points[i - 1];
          const cur = st.points[i];
          const next = st.points[i + 1];
          const v1x = cur.x - prev.x;
          const v1y = cur.y - prev.y;
          const v2x = next.x - cur.x;
          const v2y = next.y - cur.y;
          const l1 = Math.hypot(v1x, v1y);
          const l2 = Math.hypot(v2x, v2y);
          if (l1 > 0.06 && l2 > 0.06) {
            const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
            // cos near 0 => crisp 90-degree corner!
            if (Math.abs(cos) < 0.45 && Math.abs(cos) < bestCornerScore) {
              bestCornerScore = Math.abs(cos);
              bestPt = { x: cur.x, y: cur.y };
            }
          }
        }
      }
    }
    if (bestPt) return bestPt;
  }

  // Prefer the intersection / closest point between core strokes when 2+ core strokes exist
  if (coreStrokes.length >= 2) {
    let minD = Infinity;
    let midPt = { x: 0.5, y: 0.5 };
    for (const p1 of coreStrokes[0].points) {
      for (const p2 of coreStrokes[1].points) {
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (d < minD) {
          minD = d;
          midPt = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
        }
      }
    }
    if (minD < 0.25) return midPt;
  }

  let sx = 0;
  let sy = 0;
  let cnt = 0;
  coreStrokes.forEach((st) => {
    st.points.forEach((pt) => {
      sx += pt.x;
      sy += pt.y;
      cnt++;
    });
  });
  return cnt > 0 ? { x: sx / cnt, y: sy / cnt } : { x: 0.5, y: 0.5 };
}

function computeReboundGeometry(
  allStrokes: MorphBrushStroke[],
  motor: KeyMotorProfile,
  node: RadicalMorphNode
): {
  reboundPoint: { x: number; y: number };
  reboundTarget: { x: number; y: number };
  reboundHint: string;
} {
  let maxProj = -Infinity;
  let wallPt = { x: 0.5 + motor.vecX * 0.24, y: 0.5 + motor.vecY * 0.24 };

  allStrokes.forEach((st) => {
    st.points.forEach((pt) => {
      const proj = pt.x * motor.vecX + pt.y * motor.vecY;
      if (proj > maxProj) {
        maxProj = proj;
        wallPt = { x: pt.x, y: pt.y };
      }
    });
  });

  const target = {
    x: Math.max(0.1, Math.min(0.9, wallPt.x - motor.vecX * 0.3)),
    y: Math.max(0.1, Math.min(0.9, wallPt.y - motor.vecY * 0.3)),
  };
  const bounceArrow = REBOUND_HOME_ARROW[motor.key] ?? '弹回基准位';
  const reboundHint = `触及「${node.radical}」远端轮廓产生回弹阻尼，顺势 ${bounceArrow} 归位`;

  return {
    reboundPoint: wallPt,
    reboundTarget: target,
    reboundHint,
  };
}

function buildCoreBloomDecomposition(
  key: string,
  node: RadicalMorphNode,
  motor: KeyMotorProfile
): TwoBeatDecomposition {
  const meta = HOME_CORE_META[key] ?? HOME_CORE_META.k;
  const coreStrokes = node.coreStrokes.length > 0 ? node.coreStrokes : node.extraStrokes.slice(0, 1);
  const outerStrokes = node.coreStrokes.length > 0 ? node.extraStrokes : node.extraStrokes.slice(1);
  const anchorPoint = findCoreAnchorPoint(coreStrokes, meta.shapeKind);

  const primaryCore = coreStrokes[0] ?? {
    dunbiStart: true,
    flickEnd: false,
    points: [
      { x: anchorPoint.x, y: Math.max(0.15, anchorPoint.y - 0.12), p: 0.7 },
      { x: anchorPoint.x, y: Math.min(0.85, anchorPoint.y + 0.12), p: 0.8 },
    ],
  };

  return {
    key,
    radical: node.radical,
    motor,
    kineticMode: 'core_bloom',
    coreBloom: {
      coreStrokes,
      outerStrokes,
      anchorPoint,
      shapeKind: meta.shapeKind,
      coreTag: meta.coreTag,
    },
    trajectoryStroke: primaryCore,
    stopStrokes: outerStrokes,
    originPoint: anchorPoint,
    originCornerText: meta.coreTag,
    impactPoint: anchorPoint,
    reboundPoint: anchorPoint,
    reboundTarget: { x: anchorPoint.x, y: Math.max(0.09, anchorPoint.y - 0.14) },
    travelHint: meta.travelHint,
    stopHint: meta.stopHint,
    reboundHint: meta.reboundHint,
    reversedForFingerFlow: false,
    alignmentScore: 1,
    isSingleStrokeSplit: outerStrokes.length === 0,
  };
}

function buildMotifGlideDecomposition(
  key: string,
  node: RadicalMorphNode,
  motor: KeyMotorProfile,
  allStrokes: MorphBrushStroke[],
  rule: MotifGlideRule
): TwoBeatDecomposition {
  const validIndices = rule.moveIndices.filter((i) => i >= 0 && i < allStrokes.length);
  const movingStrokes =
    validIndices.length > 0 ? validIndices.map((i) => allStrokes[i]) : [allStrokes[0]];

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;
  let ptCount = 0;
  movingStrokes.forEach((st) => {
    st.points.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
      sumX += pt.x;
      sumY += pt.y;
      ptCount++;
    });
  });

  const cx = ptCount > 0 ? sumX / ptCount : 0.5;
  const cy = ptCount > 0 ? sumY / ptCount : 0.5;
  const dist = rule.dist ?? 0.3;
  let fx = -motor.vecX * dist;
  let fy = -motor.vecY * dist;

  // Keep shifted motif cleanly inside [0.08, 0.92] of the Xuan paper
  if (fx > 0) fx = Math.min(fx, Math.max(0.05, 0.92 - maxX));
  else if (fx < 0) fx = Math.max(fx, Math.min(-0.05, 0.08 - minX));
  if (fy > 0) fy = Math.min(fy, Math.max(0.05, 0.92 - maxY));
  else if (fy < 0) fy = Math.max(fy, Math.min(-0.05, 0.08 - minY));

  const originPt = {
    x: Math.max(0.1, Math.min(0.9, cx + fx)),
    y: Math.max(0.1, Math.min(0.9, cy + fy)),
  };
  const destPt = {
    x: Math.max(0.1, Math.min(0.9, cx)),
    y: Math.max(0.1, Math.min(0.9, cy)),
  };

  // Guide stroke represents the physical translation path of the motif centroid
  const trajectoryStroke: MorphBrushStroke = {
    dunbiStart: true,
    flickEnd: false,
    points: [
      { x: originPt.x, y: originPt.y, p: 0.75 },
      { x: destPt.x, y: destPt.y, p: 0.8 },
    ],
  };

  const rebound = computeReboundGeometry(allStrokes, motor, node);

  return {
    key,
    radical: node.radical,
    motor,
    kineticMode: 'motif_glide',
    motifGlide: {
      movingStrokes,
      fromOffset: { x: fx, y: fy },
      toOffset: { x: 0, y: 0 },
    },
    trajectoryStroke,
    // In motif_glide, Beat 2 snaps the ENTIRE settled radical into crisp Vermilion lock!
    stopStrokes: allStrokes,
    originPoint: originPt,
    originCornerText: rule.originTag,
    impactPoint: destPt,
    reboundPoint: rebound.reboundPoint,
    reboundTarget: rebound.reboundTarget,
    travelHint: rule.travelHint,
    stopHint: rule.stopHint,
    reboundHint: rebound.reboundHint,
    reversedForFingerFlow: false,
    alignmentScore: 1,
    isSingleStrokeSplit: false,
  };
}

// Subdivide a single-stroke glyph into Beat 1 (initial 70% travel body) + Beat 2 (final 30% stopping terminal)
function splitSingleStroke(
  s: MorphBrushStroke,
  motor: KeyMotorProfile
): {
  travel: MorphBrushStroke;
  stop: MorphBrushStroke;
  impact: { x: number; y: number };
  reversed: boolean;
  align: number;
} {
  const first = s.points[0];
  const last = s.points[s.points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const len = Math.hypot(dx, dy) || 1;
  const dot = (dx * motor.vecX + dy * motor.vecY) / len;
  const reversed = motor.travelType !== 'home_drop' && dot < -0.25;
  const oriented = reversed ? reverseStroke(s) : s;

  // Densify points linearly so splitting at 70% arc length is always smooth (>= 3 pts each)
  const dense: MorphPt[] = [];
  for (let i = 0; i < oriented.points.length - 1; i++) {
    const a = oriented.points[i];
    const b = oriented.points[i + 1];
    const steps = 8;
    for (let k = 0; k < (i === oriented.points.length - 2 ? steps + 1 : steps); k++) {
      const t = k / steps;
      dense.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        p: a.p + (b.p - a.p) * t,
      });
    }
  }
  const splitIdx = Math.max(2, Math.min(dense.length - 2, Math.floor(dense.length * 0.7)));
  const pivot = dense[splitIdx];
  return {
    travel: {
      dunbiStart: true,
      flickEnd: false,
      points: dense.slice(0, splitIdx + 1),
    },
    stop: {
      dunbiStart: true,
      flickEnd: Boolean(oriented.flickEnd),
      points: dense.slice(splitIdx),
    },
    impact: { x: pivot.x, y: pivot.y },
    reversed,
    align: Math.abs(dot),
  };
}

// Find exact 2D intersection or closest approach between trajectoryStroke and stopStrokes
function findImpactPoint(
  traj: MorphBrushStroke,
  stops: MorphBrushStroke[]
): { x: number; y: number } {
  const sampleLin = (pts: MorphPt[]): Array<{ x: number; y: number }> => {
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      for (let k = 0; k < 10; k++) {
        const t = k / 10;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    const last = pts[pts.length - 1];
    if (last) out.push({ x: last.x, y: last.y });
    return out;
  };

  const tPts = sampleLin(traj.points);
  const stopPts = stops.flatMap((st) => sampleLin(st.points));
  if (tPts.length === 0) return { x: 0.5, y: 0.5 };
  const endPt = tPts[tPts.length - 1];
  if (stopPts.length === 0) return endPt;

  // Prefer the closest contact along the second half of the trajectory stroke (where momentum is arrested!)
  let bestDist = Infinity;
  let bestPt = endPt;
  const startScan = Math.floor(tPts.length * 0.25);
  for (let i = startScan; i < tPts.length; i++) {
    const a = tPts[i];
    for (let j = 0; j < stopPts.length; j++) {
      const b = stopPts[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < bestDist) {
        bestDist = d;
        bestPt = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
      }
    }
  }
  return bestDist < 0.16 ? bestPt : endPt;
}

const decompositionCache = new Map<string, TwoBeatDecomposition>();

export function buildTwoBeatDecomposition(
  key: string,
  node: RadicalMorphNode
): TwoBeatDecomposition {
  const cacheKey = `${key}:${node.id}`;
  const cached = decompositionCache.get(cacheKey);
  if (cached) return cached;

  const motor = KEY_MOTOR_PROFILES[key] ?? KEY_MOTOR_PROFILES.r;
  const allStrokes: MorphBrushStroke[] = [...node.coreStrokes, ...node.extraStrokes];

  // 0. Home-row vertical-drop keys (S, D, F, J, K, L):
  //    Anchor on the key's fundamental shared symbol & expand outward ("找到中位共同特征 -> 向外扩散")!
  if (HOME_VERTICAL_KEYS.has(key)) {
    const result = buildCoreBloomDecomposition(key, node, motor);
    decompositionCache.set(cacheKey, result);
    return result;
  }

  // 1. Check explicit organic element-displacement ("motif_glide") rules for travel keys
  const motifRule = MOTIF_GLIDE_SPECS[node.id];
  if (motifRule && allStrokes.length > 0) {
    const result = buildMotifGlideDecomposition(key, node, motor, allStrokes, motifRule);
    decompositionCache.set(cacheKey, result);
    return result;
  }

  // 2. Single-stroke radicals without motif_glide fallback
  if (allStrokes.length <= 1) {
    const single = allStrokes[0] ?? {
      points: [
        { x: 0.3, y: 0.5, p: 0.7 },
        { x: 0.7, y: 0.5, p: 0.8 },
      ],
    };
    const split = splitSingleStroke(single, motor);
    const originPt = split.travel.points[0] ?? { x: 0.5, y: 0.5 };
    const rebound = computeReboundGeometry(allStrokes.length ? allStrokes : [single], motor, node);
    const result: TwoBeatDecomposition = {
      key,
      radical: node.radical,
      motor,
      kineticMode: 'stroke_sweep',
      trajectoryStroke: split.travel,
      stopStrokes: [split.stop],
      originPoint: { x: originPt.x, y: originPt.y },
      originCornerText: describeOriginCorner(originPt, motor),
      impactPoint: split.impact,
      reboundPoint: rebound.reboundPoint,
      reboundTarget: rebound.reboundTarget,
      travelHint: motor.travelPhaseLabel,
      stopHint: motor.stopPhaseLabel,
      reboundHint: rebound.reboundHint,
      reversedForFingerFlow: split.reversed,
      alignmentScore: split.align,
      isSingleStrokeSplit: true,
    };
    decompositionCache.set(cacheKey, result);
    return result;
  }

  const override = TRAJECTORY_OVERRIDES[node.id];
  let bestIdx = 0;
  let bestAlign = 0;
  let shouldReverse = false;

  if (override && override.strokeIdx < allStrokes.length) {
    bestIdx = override.strokeIdx;
    const st = allStrokes[bestIdx];
    const first = st.points[0];
    const last = st.points[st.points.length - 1];
    const len = Math.hypot(last.x - first.x, last.y - first.y) || 1;
    const dot = ((last.x - first.x) * motor.vecX + (last.y - first.y) * motor.vecY) / len;
    bestAlign = Math.abs(dot);
    shouldReverse =
      override.reverse !== undefined
        ? override.reverse
        : motor.travelType !== 'home_drop' && dot < -0.2;
  } else {
    // Score every stroke in this radical by:
    //   1. Spatial entry origin opposite to the finger's physical travel direction (primary embodied cue!)
    //      e.g. for Q (↖), starts near bottom-right (1,1); for B/M (↘), starts near top-left (0,0)
    //   2. Directional cosine alignment |dot| along the finger travel axis
    //   3. Stroke prominence so tiny accidental specks (< 0.16) don't steal major structural spines
    let bestScore = -Infinity;

    allStrokes.forEach((st, idx) => {
      const first = st.points[0];
      const last = st.points[st.points.length - 1];
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const chordLen = Math.hypot(dx, dy);
      if (chordLen < 0.02) return;

      const dot = (dx * motor.vecX + dy * motor.vecY) / chordLen;
      const absAlign = Math.abs(dot);
      const rev = motor.travelType !== 'home_drop' && dot < -0.2;
      const startPt = rev ? last : first;
      const originScore =
        (startPt.x - 0.5) * -motor.vecX + (startPt.y - 0.5) * -motor.vecY;
      const tinyPenalty = chordLen < 0.16 ? -0.58 : 0;
      const lengthWeight = Math.min(0.28, chordLen * 0.36);
      const score = absAlign * 1.0 + originScore * 1.25 + lengthWeight + tinyPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
        bestAlign = absAlign;
        shouldReverse = rev;
      }
    });
  }

  // Automatic fallback: if even the best stroke in a multi-stroke radical runs nearly perpendicular
  // to the physical finger trajectory (bestAlign < 0.48), render as an organic motif_glide instead of forcing a mechanical stroke trace!
  if (!override && bestAlign < 0.48) {
    const result = buildMotifGlideDecomposition(key, node, motor, allStrokes, {
      moveIndices: [0],
      dist: 0.28,
      originTag: `${motor.arrowSymbol} 移形起势`,
      travelHint: motor.travelPhaseLabel,
      stopHint: motor.stopPhaseLabel,
    });
    decompositionCache.set(cacheKey, result);
    return result;
  }

  const rawTraj = allStrokes[bestIdx];
  const trajectoryStroke = shouldReverse ? reverseStroke(rawTraj) : rawTraj;
  const stopStrokes = allStrokes.filter((_, i) => i !== bestIdx);
  const originPt = trajectoryStroke.points[0] ?? { x: 0.5, y: 0.5 };
  const impactPoint = findImpactPoint(trajectoryStroke, stopStrokes);
  const rebound = computeReboundGeometry(allStrokes, motor, node);

  const result: TwoBeatDecomposition = {
    key,
    radical: node.radical,
    motor,
    kineticMode: 'stroke_sweep',
    trajectoryStroke,
    stopStrokes,
    originPoint: { x: originPt.x, y: originPt.y },
    originCornerText: describeOriginCorner(originPt, motor),
    impactPoint,
    reboundPoint: rebound.reboundPoint,
    reboundTarget: rebound.reboundTarget,
    travelHint: motor.travelPhaseLabel,
    stopHint: motor.stopPhaseLabel,
    reboundHint: rebound.reboundHint,
    reversedForFingerFlow: shouldReverse,
    alignmentScore: bestAlign,
    isSingleStrokeSplit: false,
  };
  decompositionCache.set(cacheKey, result);
  return result;
}
