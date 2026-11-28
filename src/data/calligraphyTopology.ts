import { LINGMING_ROOT_MAP, getLingmingRadicalScript } from './lingming';

export interface BrushControlPoint {
  x: number; // 0..1 normalized ink-box coordinate
  y: number; // 0..1 normalized ink-box coordinate
  p: number; // brush pressure 0.12 (hairline) .. 1.0 (heavy dunbi press)
}

export interface ParametricBrushStroke {
  points: BrushControlPoint[];
  delay: number; // 0..0.75 normalized start time within gesture
  duration: number; // 0.25..0.95 normalized draw duration
  dunbiStart?: boolean; // heavy initial ink press
  flickEnd?: boolean; // sharp dry-brush exit taper
}

export interface CalligraphyGestureSpec {
  key: string;
  hand: 'L' | 'R';
  row: 'top' | 'home' | 'bot';
  fingerLabel: string;
  reachLabel: string;
  reachVector: { dx: number; dy: number }; // -1..1 direction from Home Row
  techniqueName: string; // 4-char unique calligraphic gesture name
  topoSymbol: string;
  topoBrief: string;
  brushEssence: string;
  primaryAnchor: string;
  simpRadicals: string[];
  strokes: ParametricBrushStroke[];
  noteHz: number;
}

export interface CalligraphyPracticePhrase {
  id: string;
  title: string;
  subtitle: string;
  chars: string[];
}

function getSimpRadicalsForKey(key: string): string[] {
  const list: Array<{ rad: string; rank: number }> = [];
  for (const [rad, meta] of LINGMING_ROOT_MAP.entries()) {
    if (meta.chamberKey !== key) continue;
    const sc = getLingmingRadicalScript(rad);
    if (sc === 'trad') continue;
    list.push({ rad, rank: meta.rank });
  }
  list.sort((a, b) => a.rank - b.rank);
  return list.map((x) => x.rad);
}

// 20 100%-unique topological calligraphy brush gestures mapped to Lingming's 20 consonant keys
export const CALLIGRAPHY_GESTURES: CalligraphyGestureSpec[] = [
  // ==================== 上排：抬指前探（起势扬锋） ====================
  {
    key: 'q',
    hand: 'L',
    row: 'top',
    fingerLabel: '左小指',
    reachLabel: '向上轻挑',
    reachVector: { dx: 0, dy: -1 },
    techniqueName: '绞锋穿插',
    topoSymbol: '╪',
    topoBrief: '两线以上必相交，成叉成栅',
    brushEssence: '左小指轻挑如笔锋凌空十字绞过，一横铺势、双锋斜正穿插交汇。',
    primaryAnchor: '又',
    simpRadicals: getSimpRadicalsForKey('q'),
    noteHz: 261.63, // C4
    strokes: [
      // Horizontal beam
      {
        delay: 0.0,
        duration: 0.36,
        dunbiStart: true,
        points: [
          { x: 0.18, y: 0.44, p: 0.72 },
          { x: 0.42, y: 0.41, p: 0.48 },
          { x: 0.68, y: 0.38, p: 0.56 },
          { x: 0.84, y: 0.36, p: 0.78 },
        ],
      },
      // Left crossing vertical/pie
      {
        delay: 0.28,
        duration: 0.36,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.38, y: 0.18, p: 0.78 },
          { x: 0.36, y: 0.45, p: 0.54 },
          { x: 0.31, y: 0.68, p: 0.42 },
          { x: 0.22, y: 0.82, p: 0.14 },
        ],
      },
      // Right crossing sweeping na
      {
        delay: 0.52,
        duration: 0.44,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.64, y: 0.18, p: 0.74 },
          { x: 0.60, y: 0.46, p: 0.55 },
          { x: 0.68, y: 0.68, p: 0.76 },
          { x: 0.84, y: 0.82, p: 0.18 },
        ],
      },
    ],
  },
  {
    key: 'w',
    hand: 'L',
    row: 'top',
    fingerLabel: '左无名',
    reachLabel: '向上微探',
    reachVector: { dx: 0, dy: -1 },
    techniqueName: '游丝牵带',
    topoSymbol: '⺄',
    topoBrief: '蛇行弯折带长尾或曲钩',
    brushEssence: '左无名指顺势前游，如行草游丝一波三折，末段舒展拖出柔韧长捺。',
    primaryAnchor: '辶',
    simpRadicals: getSimpRadicalsForKey('w'),
    noteHz: 293.66, // D4
    strokes: [
      // Leading ink dot
      {
        delay: 0.0,
        duration: 0.22,
        dunbiStart: true,
        points: [
          { x: 0.26, y: 0.20, p: 0.38 },
          { x: 0.33, y: 0.28, p: 0.82 },
        ],
      },
      // Sinuous Z-wave + sweeping tail
      {
        delay: 0.18,
        duration: 0.82,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.18, y: 0.44, p: 0.64 },
          { x: 0.34, y: 0.40, p: 0.68 },
          { x: 0.26, y: 0.56, p: 0.44 },
          { x: 0.35, y: 0.68, p: 0.62 },
          { x: 0.22, y: 0.76, p: 0.52 },
          { x: 0.46, y: 0.76, p: 0.74 },
          { x: 0.70, y: 0.82, p: 0.86 },
          { x: 0.88, y: 0.79, p: 0.16 },
        ],
      },
    ],
  },
  {
    key: 'r',
    hand: 'L',
    row: 'top',
    fingerLabel: '左食指',
    reachLabel: '向上直推',
    reachVector: { dx: 0, dy: -1 },
    techniqueName: '双勒叠锋',
    topoSymbol: '=',
    topoBrief: '成对平行的横画或叠层',
    brushEssence: '左食指上推似两道勒笔前后叠铺，上短仰势、下长覆势，平行生呼应。',
    primaryAnchor: '二',
    simpRadicals: getSimpRadicalsForKey('r'),
    noteHz: 329.63, // E4
    strokes: [
      // Upper shorter bar (slight upward tilt)
      {
        delay: 0.0,
        duration: 0.42,
        dunbiStart: true,
        points: [
          { x: 0.26, y: 0.36, p: 0.76 },
          { x: 0.48, y: 0.33, p: 0.52 },
          { x: 0.72, y: 0.31, p: 0.82 },
        ],
      },
      // Lower wider grounded bar
      {
        delay: 0.38,
        duration: 0.58,
        dunbiStart: true,
        points: [
          { x: 0.15, y: 0.66, p: 0.86 },
          { x: 0.42, y: 0.63, p: 0.58 },
          { x: 0.68, y: 0.62, p: 0.66 },
          { x: 0.86, y: 0.64, p: 0.92 },
        ],
      },
    ],
  },
  {
    key: 't',
    hand: 'L',
    row: 'top',
    fingerLabel: '左食内',
    reachLabel: '右上斜探',
    reachVector: { dx: 0.75, dy: -0.75 },
    techniqueName: '阻力受阻',
    topoSymbol: '⊣',
    topoBrief: '伸指遇阻 · 推进撞上阻壁或强弓挡路',
    brushEssence: '左食指从 F 伸向 T 最吃力，肌肉的阻滞感正对应笔画遭遇斜墙、立壁或强弓阻拦。',
    primaryAnchor: '丶',
    simpRadicals: getSimpRadicalsForKey('t'),
    noteHz: 392.0, // G4
    strokes: [
      // Crisp drop dot
      {
        delay: 0.0,
        duration: 0.42,
        dunbiStart: true,
        points: [
          { x: 0.40, y: 0.22, p: 0.28 },
          { x: 0.50, y: 0.32, p: 0.74 },
          { x: 0.56, y: 0.44, p: 0.94 },
        ],
      },
      // Crisp diagonal flick (ti/pie)
      {
        delay: 0.38,
        duration: 0.52,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.24, y: 0.74, p: 0.84 },
          { x: 0.46, y: 0.64, p: 0.52 },
          { x: 0.76, y: 0.48, p: 0.14 },
        ],
      },
    ],
  },
  {
    key: 'y',
    hand: 'R',
    row: 'top',
    fingerLabel: '右食内',
    reachLabel: '左上斜探',
    reachVector: { dx: -0.75, dy: -0.75 },
    techniqueName: '抗阻斜推',
    topoSymbol: '⊢',
    topoBrief: '右食左上斜推遇阻 · 与 T 键左右镜像成对',
    brushEssence: '右食指从 J 向左上斜伸吃力（↖），大夫糸瓦右下起推、王非虚拟指路撞上整片全红阻力墙。',
    primaryAnchor: '大',
    simpRadicals: getSimpRadicalsForKey('y'),
    noteHz: 440.0, // A4
    strokes: [
      // Balanced horizontal shoulder
      {
        delay: 0.0,
        duration: 0.34,
        dunbiStart: true,
        points: [
          { x: 0.20, y: 0.42, p: 0.76 },
          { x: 0.50, y: 0.39, p: 0.54 },
          { x: 0.80, y: 0.38, p: 0.80 },
        ],
      },
      // Left sweeping pie wing
      {
        delay: 0.28,
        duration: 0.46,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.50, y: 0.16, p: 0.82 },
          { x: 0.48, y: 0.44, p: 0.62 },
          { x: 0.36, y: 0.68, p: 0.44 },
          { x: 0.16, y: 0.84, p: 0.14 },
        ],
      },
      // Right sweeping na wing
      {
        delay: 0.52,
        duration: 0.46,
        dunbiStart: false,
        flickEnd: true,
        points: [
          { x: 0.50, y: 0.44, p: 0.44 },
          { x: 0.62, y: 0.64, p: 0.72 },
          { x: 0.74, y: 0.78, p: 0.88 },
          { x: 0.88, y: 0.82, p: 0.16 },
        ],
      },
    ],
  },
  {
    key: 'p',
    hand: 'R',
    row: 'top',
    fingerLabel: '右小指',
    reachLabel: '向上轻举',
    reachVector: { dx: 0, dy: -1 },
    techniqueName: '裹锋怀抱',
    topoSymbol: '╮',
    topoBrief: '弧形外抱壳体与下散飞脚',
    brushEssence: '右小指外扬起撇，再以丰满弧笔向内裹锋抱合，收尾蓄势内钩。',
    primaryAnchor: '勹',
    simpRadicals: getSimpRadicalsForKey('p'),
    noteHz: 523.25, // C5
    strokes: [
      // Opening curved pie
      {
        delay: 0.0,
        duration: 0.34,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.42, y: 0.16, p: 0.82 },
          { x: 0.33, y: 0.34, p: 0.54 },
          { x: 0.20, y: 0.50, p: 0.16 },
        ],
      },
      // Wrapping embracing arc + inward hook
      {
        delay: 0.26,
        duration: 0.72,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.34, y: 0.32, p: 0.54 },
          { x: 0.68, y: 0.28, p: 0.82 },
          { x: 0.76, y: 0.46, p: 0.66 },
          { x: 0.72, y: 0.74, p: 0.78 },
          { x: 0.58, y: 0.84, p: 0.68 },
          { x: 0.46, y: 0.74, p: 0.16 },
        ],
      },
    ],
  },

  // ==================== 中排：基准位沉落（驻锋立骨） ====================
  {
    key: 's',
    hand: 'L',
    row: 'home',
    fingerLabel: '左无名',
    reachLabel: '原位沉落',
    reachVector: { dx: 0, dy: 0 },
    techniqueName: '重顿托底',
    topoSymbol: '┴',
    topoBrief: '竖立中干，厚实底横稳托全字',
    brushEssence: '左无名指原位沉稳一顿，中竖扎根，底横由轻渐重铺纸承托。',
    primaryAnchor: '土',
    simpRadicals: getSimpRadicalsForKey('s'),
    noteHz: 220.0, // A3
    strokes: [
      // Upper short cross bar
      {
        delay: 0.0,
        duration: 0.28,
        dunbiStart: true,
        points: [
          { x: 0.32, y: 0.44, p: 0.68 },
          { x: 0.68, y: 0.41, p: 0.74 },
        ],
      },
      // Grounding vertical spine
      {
        delay: 0.22,
        duration: 0.36,
        dunbiStart: true,
        points: [
          { x: 0.50, y: 0.16, p: 0.84 },
          { x: 0.50, y: 0.48, p: 0.64 },
          { x: 0.50, y: 0.76, p: 0.72 },
        ],
      },
      // Heavy foundational base bar
      {
        delay: 0.52,
        duration: 0.48,
        dunbiStart: true,
        points: [
          { x: 0.14, y: 0.78, p: 0.88 },
          { x: 0.48, y: 0.76, p: 0.68 },
          { x: 0.86, y: 0.76, p: 0.96 },
        ],
      },
    ],
  },
  {
    key: 'd',
    hand: 'L',
    row: 'home',
    fingerLabel: '左中指',
    reachLabel: '原位沉落',
    reachVector: { dx: 0, dy: 0 },
    techniqueName: '方折围宫',
    topoSymbol: '□',
    topoBrief: '四方折笔围合出朗阔窗面',
    brushEssence: '左中指正落定宫，左竖立壁、右上重顿方折、底横严密合口成窗。',
    primaryAnchor: '口',
    simpRadicals: getSimpRadicalsForKey('d'),
    noteHz: 261.63, // C4
    strokes: [
      // Left wall
      {
        delay: 0.0,
        duration: 0.30,
        dunbiStart: true,
        points: [
          { x: 0.24, y: 0.26, p: 0.82 },
          { x: 0.26, y: 0.52, p: 0.62 },
          { x: 0.28, y: 0.76, p: 0.76 },
        ],
      },
      // Top beam + crisp square corner turn + right wall
      {
        delay: 0.24,
        duration: 0.46,
        dunbiStart: false,
        points: [
          { x: 0.26, y: 0.28, p: 0.56 },
          { x: 0.54, y: 0.25, p: 0.54 },
          { x: 0.76, y: 0.25, p: 0.92 },
          { x: 0.74, y: 0.52, p: 0.64 },
          { x: 0.71, y: 0.74, p: 0.78 },
        ],
      },
      // Closing bottom sill
      {
        delay: 0.64,
        duration: 0.34,
        dunbiStart: true,
        points: [
          { x: 0.28, y: 0.74, p: 0.68 },
          { x: 0.52, y: 0.73, p: 0.64 },
          { x: 0.74, y: 0.73, p: 0.82 },
        ],
      },
    ],
  },
  {
    key: 'f',
    hand: 'L',
    row: 'home',
    fingerLabel: '左食指',
    reachLabel: '原位沉落',
    reachVector: { dx: 0, dy: 0 },
    techniqueName: '横勒定界',
    topoSymbol: '─',
    topoBrief: '一道清晰水平主梁贯通定界',
    brushEssence: '如永字八法之「勒」，左食指原位稳按，藏锋起笔、中段提劲、收尾回锋顿定。',
    primaryAnchor: '一',
    simpRadicals: getSimpRadicalsForKey('f'),
    noteHz: 293.66, // D4
    strokes: [
      {
        delay: 0.0,
        duration: 0.92,
        dunbiStart: true,
        points: [
          { x: 0.14, y: 0.53, p: 0.90 },
          { x: 0.34, y: 0.51, p: 0.60 },
          { x: 0.56, y: 0.49, p: 0.54 },
          { x: 0.76, y: 0.48, p: 0.74 },
          { x: 0.87, y: 0.50, p: 0.96 },
        ],
      },
    ],
  },
  {
    key: 'g',
    hand: 'L',
    row: 'home',
    fingerLabel: '左食内',
    reachLabel: '向右内靠',
    reachVector: { dx: 1, dy: 0 },
    techniqueName: '藏锋回环',
    topoSymbol: '⊞',
    topoBrief: '折角回环扣锁与中轴内聚',
    brushEssence: '左食指向中线内收，斜撇下探后疾折向右，末点回扣锁住气口。',
    primaryAnchor: '厶',
    simpRadicals: getSimpRadicalsForKey('g'),
    noteHz: 329.63, // E4
    strokes: [
      // Sharp folding loop (厶)
      {
        delay: 0.0,
        duration: 0.64,
        dunbiStart: true,
        points: [
          { x: 0.52, y: 0.20, p: 0.84 },
          { x: 0.38, y: 0.46, p: 0.56 },
          { x: 0.22, y: 0.72, p: 0.86 },
          { x: 0.48, y: 0.68, p: 0.58 },
          { x: 0.72, y: 0.63, p: 0.72 },
        ],
      },
      // Locking closing dot
      {
        delay: 0.60,
        duration: 0.36,
        dunbiStart: true,
        points: [
          { x: 0.64, y: 0.48, p: 0.44 },
          { x: 0.74, y: 0.62, p: 0.78 },
          { x: 0.82, y: 0.78, p: 0.92 },
        ],
      },
    ],
  },
  {
    key: 'h',
    hand: 'R',
    row: 'home',
    fingerLabel: '右食内',
    reachLabel: '向左内靠',
    reachVector: { dx: -1, dy: 0 },
    techniqueName: '平顶垂露',
    topoSymbol: '┬',
    topoBrief: '顶横铺平、垂干悬落收露',
    brushEssence: '右食指内靠轻驻，先铺平顶横梁，再垂落一根饱满圆润的垂露竖干。',
    primaryAnchor: '日',
    simpRadicals: getSimpRadicalsForKey('h'),
    noteHz: 392.0, // G4
    strokes: [
      // Flat top roof bar
      {
        delay: 0.0,
        duration: 0.42,
        dunbiStart: true,
        points: [
          { x: 0.18, y: 0.26, p: 0.82 },
          { x: 0.50, y: 0.24, p: 0.58 },
          { x: 0.82, y: 0.24, p: 0.86 },
        ],
      },
      // Plumb vertical drop with rounded dewdrop finish (垂露)
      {
        delay: 0.38,
        duration: 0.58,
        dunbiStart: true,
        points: [
          { x: 0.50, y: 0.26, p: 0.80 },
          { x: 0.50, y: 0.54, p: 0.62 },
          { x: 0.50, y: 0.78, p: 0.88 },
          { x: 0.48, y: 0.84, p: 0.92 },
        ],
      },
    ],
  },
  {
    key: 'j',
    hand: 'R',
    row: 'home',
    fingerLabel: '右食指',
    reachLabel: '原位沉落',
    reachVector: { dx: 0, dy: 0 },
    techniqueName: '侧锋斜切',
    topoSymbol: '⟋',
    topoBrief: '单侧斜撇切入、直竖稳立边旁',
    brushEssence: '右食指干脆落键，侧锋斜切带出俊逸短撇，腰部顺接一竖端立。',
    primaryAnchor: '亻',
    simpRadicals: getSimpRadicalsForKey('j'),
    noteHz: 440.0, // A4
    strokes: [
      // Crisp side-edge diagonal pie
      {
        delay: 0.0,
        duration: 0.46,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.62, y: 0.16, p: 0.86 },
          { x: 0.46, y: 0.38, p: 0.58 },
          { x: 0.24, y: 0.58, p: 0.16 },
        ],
      },
      // Vertical pillar dropping from midpoint
      {
        delay: 0.42,
        duration: 0.54,
        dunbiStart: true,
        points: [
          { x: 0.46, y: 0.42, p: 0.80 },
          { x: 0.46, y: 0.64, p: 0.62 },
          { x: 0.46, y: 0.84, p: 0.84 },
        ],
      },
    ],
  },
  {
    key: 'k',
    hand: 'R',
    row: 'home',
    fingerLabel: '右中指',
    reachLabel: '原位沉落',
    reachVector: { dx: 0, dy: 0 },
    techniqueName: '中锋直入',
    topoSymbol: '⌂',
    topoBrief: '尖顶覆罩与单笔直刺贯下',
    brushEssence: '右中指端正下压，顶撇轻起如冠帽覆罩，中锋直入贯通气脉。',
    primaryAnchor: '白',
    simpRadicals: getSimpRadicalsForKey('k'),
    noteHz: 523.25, // C5
    strokes: [
      // Crown dot / roof peak
      {
        delay: 0.0,
        duration: 0.26,
        dunbiStart: true,
        points: [
          { x: 0.48, y: 0.14, p: 0.42 },
          { x: 0.51, y: 0.24, p: 0.86 },
        ],
      },
      // Roof canopy eaves
      {
        delay: 0.22,
        duration: 0.42,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.22, y: 0.42, p: 0.68 },
          { x: 0.26, y: 0.30, p: 0.62 },
          { x: 0.76, y: 0.28, p: 0.88 },
          { x: 0.70, y: 0.40, p: 0.22 },
        ],
      },
      // Direct center-tip plumb stroke
      {
        delay: 0.54,
        duration: 0.42,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.50, y: 0.38, p: 0.82 },
          { x: 0.50, y: 0.64, p: 0.62 },
          { x: 0.50, y: 0.86, p: 0.16 },
        ],
      },
    ],
  },
  {
    key: 'l',
    hand: 'R',
    row: 'home',
    fingerLabel: '右无名',
    reachLabel: '原位沉落',
    reachVector: { dx: 0, dy: 0 },
    techniqueName: '悬针贯立',
    topoSymbol: '╂',
    topoBrief: '长竖出头贯通或双长腿修立',
    brushEssence: '右无名指稳落铺横，继以一根修长悬针直贯上下，出锋细锐挺拔。',
    primaryAnchor: '月',
    simpRadicals: getSimpRadicalsForKey('l'),
    noteHz: 587.33, // D5
    strokes: [
      // Left graceful vertical leg
      {
        delay: 0.0,
        duration: 0.42,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.32, y: 0.20, p: 0.80 },
          { x: 0.32, y: 0.54, p: 0.62 },
          { x: 0.26, y: 0.84, p: 0.16 },
        ],
      },
      // Right tall needle leg + top bridge
      {
        delay: 0.32,
        duration: 0.64,
        dunbiStart: false,
        flickEnd: true,
        points: [
          { x: 0.33, y: 0.22, p: 0.56 },
          { x: 0.66, y: 0.20, p: 0.86 },
          { x: 0.66, y: 0.54, p: 0.64 },
          { x: 0.66, y: 0.82, p: 0.78 },
          { x: 0.56, y: 0.76, p: 0.16 },
        ],
      },
    ],
  },

  // ==================== 下排：缩指回掌（收锋蓄势） ====================
  {
    key: 'x',
    hand: 'L',
    row: 'bot',
    fingerLabel: '左无名',
    reachLabel: '向下微缩',
    reachVector: { dx: 0, dy: 1 },
    techniqueName: '中柱努立',
    topoSymbol: '┼',
    topoBrief: '一竖中轴立定、横画对称穿过',
    brushEssence: '如八法之「努」，无名指向掌心微收蓄力，立住一根劲直不阿的中心竖柱。',
    primaryAnchor: '木',
    simpRadicals: getSimpRadicalsForKey('x'),
    noteHz: 196.0, // G3
    strokes: [
      // Balanced horizontal cross
      {
        delay: 0.0,
        duration: 0.34,
        dunbiStart: true,
        points: [
          { x: 0.22, y: 0.38, p: 0.74 },
          { x: 0.50, y: 0.36, p: 0.54 },
          { x: 0.78, y: 0.35, p: 0.80 },
        ],
      },
      // Central resilient nu-pillar
      {
        delay: 0.28,
        duration: 0.64,
        dunbiStart: true,
        points: [
          { x: 0.50, y: 0.14, p: 0.88 },
          { x: 0.49, y: 0.48, p: 0.66 },
          { x: 0.50, y: 0.84, p: 0.86 },
        ],
      },
    ],
  },
  {
    key: 'c',
    hand: 'L',
    row: 'bot',
    fingerLabel: '左中指',
    reachLabel: '向下微缩',
    reachVector: { dx: 0, dy: 1 },
    techniqueName: '折笔内敛',
    topoSymbol: '∪',
    topoBrief: '双点收分与开口弯折向内抱气',
    brushEssence: '左中指向掌心回收，如两点顾盼相向，再以柔韧弯折向怀中敛住笔意。',
    primaryAnchor: '丷',
    simpRadicals: getSimpRadicalsForKey('c'),
    noteHz: 220.0, // A3
    strokes: [
      // Left inward dot
      {
        delay: 0.0,
        duration: 0.24,
        dunbiStart: true,
        points: [
          { x: 0.28, y: 0.20, p: 0.36 },
          { x: 0.36, y: 0.34, p: 0.82 },
        ],
      },
      // Right facing short pie
      {
        delay: 0.20,
        duration: 0.26,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.70, y: 0.18, p: 0.80 },
          { x: 0.58, y: 0.34, p: 0.18 },
        ],
      },
      // Inward cradling curved hook (己/∪)
      {
        delay: 0.42,
        duration: 0.56,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.28, y: 0.48, p: 0.76 },
          { x: 0.28, y: 0.72, p: 0.68 },
          { x: 0.50, y: 0.78, p: 0.74 },
          { x: 0.74, y: 0.76, p: 0.82 },
          { x: 0.78, y: 0.60, p: 0.18 },
        ],
      },
    ],
  },
  {
    key: 'v',
    hand: 'L',
    row: 'bot',
    fingerLabel: '左食指',
    reachLabel: '向下微缩',
    reachVector: { dx: 0, dy: 1 },
    techniqueName: '直掠分流',
    topoSymbol: '｜',
    topoBrief: '垂竖水脉中分、左右散点随行',
    brushEssence: '左食指向下顺势一掠，中竖钩直落如刀劈清流，左右水势自然分披。',
    primaryAnchor: '水',
    simpRadicals: getSimpRadicalsForKey('v'),
    noteHz: 261.63, // C4
    strokes: [
      // Center vertical water spine + hook
      {
        delay: 0.0,
        duration: 0.50,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.50, y: 0.16, p: 0.86 },
          { x: 0.50, y: 0.54, p: 0.64 },
          { x: 0.50, y: 0.82, p: 0.82 },
          { x: 0.38, y: 0.74, p: 0.18 },
        ],
      },
      // Left wave sweep
      {
        delay: 0.44,
        duration: 0.28,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.18, y: 0.44, p: 0.64 },
          { x: 0.34, y: 0.42, p: 0.76 },
          { x: 0.16, y: 0.72, p: 0.16 },
        ],
      },
      // Right splash na
      {
        delay: 0.64,
        duration: 0.34,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.74, y: 0.34, p: 0.70 },
          { x: 0.56, y: 0.50, p: 0.48 },
          { x: 0.76, y: 0.74, p: 0.86 },
          { x: 0.86, y: 0.76, p: 0.16 },
        ],
      },
    ],
  },
  {
    key: 'b',
    hand: 'L',
    row: 'bot',
    fingerLabel: '左食内',
    reachLabel: '右下内探',
    reachVector: { dx: 0.75, dy: 0.75 },
    techniqueName: '覆盖压锋',
    topoSymbol: '∏',
    topoBrief: '平顶横盖下压与三横折匣',
    brushEssence: '左食指向右下探按，左点定桩、宽横平覆压顶，折锋向内一扣封局。',
    primaryAnchor: '冖',
    simpRadicals: getSimpRadicalsForKey('b'),
    noteHz: 293.66, // D4
    strokes: [
      // Left downward eaves dot
      {
        delay: 0.0,
        duration: 0.26,
        dunbiStart: true,
        points: [
          { x: 0.22, y: 0.36, p: 0.66 },
          { x: 0.16, y: 0.54, p: 0.86 },
        ],
      },
      // Wide pressing horizontal canopy + inward turn hook
      {
        delay: 0.20,
        duration: 0.54,
        dunbiStart: false,
        flickEnd: true,
        points: [
          { x: 0.22, y: 0.38, p: 0.56 },
          { x: 0.52, y: 0.34, p: 0.58 },
          { x: 0.82, y: 0.33, p: 0.92 },
          { x: 0.74, y: 0.50, p: 0.18 },
        ],
      },
      // Inner horizontal box shelf (彐 echo)
      {
        delay: 0.66,
        duration: 0.32,
        dunbiStart: true,
        points: [
          { x: 0.32, y: 0.66, p: 0.66 },
          { x: 0.68, y: 0.64, p: 0.78 },
        ],
      },
    ],
  },
  {
    key: 'n',
    hand: 'R',
    row: 'bot',
    fingerLabel: '右食内',
    reachLabel: '左下内探',
    reachVector: { dx: -0.75, dy: 0.75 },
    techniqueName: '撇捺撑合',
    topoSymbol: '∧',
    topoBrief: '人字两脚分撑大地，稳成三角',
    brushEssence: '右食指向左下内探，长撇凌空斜落，重捺半腰支起，如双足鼎立撑地。',
    primaryAnchor: '人',
    simpRadicals: getSimpRadicalsForKey('n'),
    noteHz: 329.63, // E4
    strokes: [
      // Tall sweeping pie leg
      {
        delay: 0.0,
        duration: 0.50,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.52, y: 0.16, p: 0.88 },
          { x: 0.44, y: 0.46, p: 0.64 },
          { x: 0.30, y: 0.68, p: 0.46 },
          { x: 0.16, y: 0.84, p: 0.14 },
        ],
      },
      // Grounded supporting na leg
      {
        delay: 0.44,
        duration: 0.52,
        dunbiStart: false,
        flickEnd: true,
        points: [
          { x: 0.45, y: 0.44, p: 0.46 },
          { x: 0.58, y: 0.62, p: 0.72 },
          { x: 0.72, y: 0.78, p: 0.92 },
          { x: 0.86, y: 0.82, p: 0.16 },
        ],
      },
    ],
  },
  {
    key: 'm',
    hand: 'R',
    row: 'bot',
    fingerLabel: '右食指',
    reachLabel: '向下微缩',
    reachVector: { dx: 0, dy: 1 },
    techniqueName: '磔锋外趯',
    topoSymbol: '╰',
    topoBrief: '长斜钩、卧钩蓄势向外舒展挑出',
    brushEssence: '结合「磔」与「趯」，右食指下收蓄势，沿斜弧奔逸而出，末梢昂然上挑。',
    primaryAnchor: '𠂇',
    simpRadicals: getSimpRadicalsForKey('m'),
    noteHz: 392.0, // G4
    strokes: [
      // Guiding cross bar
      {
        delay: 0.0,
        duration: 0.28,
        dunbiStart: true,
        points: [
          { x: 0.20, y: 0.36, p: 0.72 },
          { x: 0.56, y: 0.32, p: 0.66 },
          { x: 0.74, y: 0.30, p: 0.78 },
        ],
      },
      // Iconic sweeping halberd hook (戈/心斜钩)
      {
        delay: 0.22,
        duration: 0.66,
        dunbiStart: true,
        flickEnd: true,
        points: [
          { x: 0.46, y: 0.16, p: 0.86 },
          { x: 0.52, y: 0.44, p: 0.64 },
          { x: 0.64, y: 0.70, p: 0.78 },
          { x: 0.78, y: 0.84, p: 0.84 },
          { x: 0.86, y: 0.66, p: 0.16 },
        ],
      },
      // Finishing accent dot
      {
        delay: 0.78,
        duration: 0.20,
        dunbiStart: true,
        points: [
          { x: 0.72, y: 0.16, p: 0.36 },
          { x: 0.80, y: 0.24, p: 0.78 },
        ],
      },
    ],
  },
];

export const CALLIGRAPHY_GESTURE_BY_KEY = new Map<string, CalligraphyGestureSpec>(
  CALLIGRAPHY_GESTURES.map((g) => [g.key, g])
);

// Curated literary calligraphy phrases — 100% present in our Simplified Yuhao corpus
export const CALLIGRAPHY_PRACTICE_PHRASES: CalligraphyPracticePhrase[] = [
  {
    id: 'classic-four',
    title: '明思休好',
    subtitle: '最经典四字 · 体会「平顶垂露→悬针」「藏锋→外趯」的节奏对答',
    chars: ['明', '思', '休', '好'],
  },
  {
    id: 'pure-brush',
    title: '道落清静',
    subtitle: '全大码连势 · 一口气走出三到四段连续笔法',
    chars: ['道', '落', '清', '静'],
  },
  {
    id: 'scholar-desk',
    title: '墨纸书香',
    subtitle: '书房四韵 · 在真实灵明编码中感受运指起落',
    chars: ['墨', '纸', '书', '香'],
  },
  {
    id: 'mountain-autumn',
    title: '山月秋泉',
    subtitle: '自然意象 · 兼顾单根立骨与双根连绵',
    chars: ['山', '月', '秋', '泉'],
  },
  {
    id: 'heart-hand',
    title: '心手相应',
    subtitle: '作家打底心法 · 运指如运笔，字随念生',
    chars: ['心', '手', '相', '应'],
  },
];
