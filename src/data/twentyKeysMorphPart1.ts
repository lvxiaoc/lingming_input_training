import { KeyTopologyMorphSpec } from './twentyKeysMorphTypes';

// First 10 Lingming consonant keys: Top Row (Q W R T Y P) + Left Home Row (S D F G)
export const TWENTY_KEY_MORPHS_PART1: KeyTopologyMorphSpec[] = [
  // ==================== 1. Q · 绞锋穿插 ====================
  {
    key: 'q',
    hand: 'L',
    row: 'top',
    homeKey: 'A',
    fingerLabel: '左小指',
    reachLabel: '由 A 向上轻挑',
    techniqueName: '绞锋穿插',
    sealText: ['绞', '锋'],
    topoSymbol: '╪',
    topoInvariant: '两线相交 · 穿叉成栅',
    nodes: [
      {
        id: 'q-you',
        radical: '又',
        code: 'Q O',
        tag: '斜交母体',
        title: '凌空十字 · 撇捺绞锋',
        insight: '左小指轻挑 Q 键，笔锋斜撇下切再反手长捺穿出，两笔于腹心交锁成叉。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.25, y: 0.26, p: 0.74 },
              { x: 0.56, y: 0.24, p: 0.58 },
              { x: 0.7, y: 0.24, p: 0.84 },
              { x: 0.56, y: 0.52, p: 0.62 },
              { x: 0.36, y: 0.74, p: 0.44 },
              { x: 0.16, y: 0.86, p: 0.16 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.26, y: 0.35, p: 0.62 },
              { x: 0.44, y: 0.54, p: 0.66 },
              { x: 0.64, y: 0.74, p: 0.88 },
              { x: 0.86, y: 0.84, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'q-cao',
        radical: '艹',
        code: 'Q I',
        tag: '双竖穿横',
        title: '草头双穿 · 横梁锁柱',
        insight: '一横凌空铺展，左竖下切形成首个交点，右竖紧随穿插，化作「艹」之双叉。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.46, p: 0.82 },
              { x: 0.5, y: 0.43, p: 0.56 },
              { x: 0.86, y: 0.41, p: 0.86 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.36, y: 0.2, p: 0.78 },
              { x: 0.37, y: 0.48, p: 0.58 },
              { x: 0.39, y: 0.74, p: 0.7 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.66, y: 0.19, p: 0.82 },
              { x: 0.64, y: 0.48, p: 0.6 },
              { x: 0.61, y: 0.76, p: 0.22 },
            ],
          },
        ],
      },
      {
        id: 'q-gong',
        radical: '廾',
        code: 'Q I',
        tag: '承托双穿',
        title: '双手拱托 · 撇竖双贯',
        insight: '横梁下移托举，左撇与右竖双双贯穿横线，正是草头倒置后的拱托穿插势。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.48, p: 0.84 },
              { x: 0.5, y: 0.45, p: 0.58 },
              { x: 0.86, y: 0.43, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.36, y: 0.18, p: 0.78 },
              { x: 0.36, y: 0.52, p: 0.6 },
              { x: 0.31, y: 0.74, p: 0.44 },
              { x: 0.2, y: 0.88, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.64, y: 0.17, p: 0.82 },
              { x: 0.64, y: 0.54, p: 0.62 },
              { x: 0.64, y: 0.88, p: 0.74 },
            ],
          },
        ],
      },
      {
        id: 'q-sa',
        radical: '卅',
        code: 'Q I',
        tag: '三柱成栅',
        title: '一横串三 · 绞锋成栅',
        insight: '核心十字绞锋进一步延展，一记稳横串联三道并立竖柱，成竹篱栅格之象。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.44, p: 0.84 },
              { x: 0.5, y: 0.42, p: 0.56 },
              { x: 0.86, y: 0.4, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.18, p: 0.78 },
              { x: 0.5, y: 0.52, p: 0.58 },
              { x: 0.5, y: 0.86, p: 0.72 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.28, y: 0.2, p: 0.76 },
              { x: 0.28, y: 0.54, p: 0.58 },
              { x: 0.22, y: 0.86, p: 0.18 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.72, y: 0.18, p: 0.8 },
              { x: 0.72, y: 0.54, p: 0.6 },
              { x: 0.72, y: 0.88, p: 0.74 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 2. W · 游丝牵带 ====================
  {
    key: 'w',
    hand: 'L',
    row: 'top',
    homeKey: 'S',
    fingerLabel: '左无名',
    reachLabel: '由 S 向上微探',
    techniqueName: '游丝牵带',
    sealText: ['游', '丝'],
    topoSymbol: '⺄',
    topoInvariant: '一波三折 · 曲尾游丝',
    nodes: [
      {
        id: 'w-yi',
        radical: '乙',
        code: 'W I',
        tag: '游丝母体',
        title: '曲折盘转 · 挑钩收尾',
        insight: '左无名指顺势前探，一笔游丝横折斜下再圆弯平出，末段昂首钩起，灵动连绵。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.24, y: 0.24, p: 0.74 },
              { x: 0.58, y: 0.2, p: 0.64 },
              { x: 0.68, y: 0.22, p: 0.84 },
              { x: 0.44, y: 0.48, p: 0.52 },
              { x: 0.24, y: 0.7, p: 0.68 },
              { x: 0.44, y: 0.82, p: 0.76 },
              { x: 0.76, y: 0.81, p: 0.84 },
              { x: 0.82, y: 0.66, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'w-chuo',
        radical: '辶',
        code: 'W O',
        tag: '行步长尾',
        title: '走之三折 · 舒展平捺',
        insight: '游丝先作灵巧折弯蓄势，随即拖出宽阔平捺如江水横渡，顶上一点轻落引气。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.18, y: 0.45, p: 0.66 },
              { x: 0.36, y: 0.41, p: 0.74 },
              { x: 0.26, y: 0.58, p: 0.48 },
              { x: 0.36, y: 0.68, p: 0.66 },
              { x: 0.2, y: 0.76, p: 0.54 },
              { x: 0.46, y: 0.76, p: 0.78 },
              { x: 0.72, y: 0.83, p: 0.9 },
              { x: 0.9, y: 0.8, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.19, p: 0.36 },
              { x: 0.34, y: 0.27, p: 0.84 },
            ],
          },
        ],
      },
      {
        id: 'w-nai',
        radical: '乃',
        code: 'W N A',
        tag: '悬丝回钩',
        title: '横折折钩 · 游丝盘旋',
        insight: '朱砂游丝连作两次折返后斜下回钩，再以一记中撇凌空斜出，婉转中藏筋骨。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.26, y: 0.24, p: 0.76 },
              { x: 0.66, y: 0.21, p: 0.82 },
              { x: 0.54, y: 0.46, p: 0.58 },
              { x: 0.74, y: 0.44, p: 0.82 },
              { x: 0.68, y: 0.72, p: 0.72 },
              { x: 0.58, y: 0.86, p: 0.82 },
              { x: 0.44, y: 0.78, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.44, y: 0.26, p: 0.74 },
              { x: 0.36, y: 0.54, p: 0.56 },
              { x: 0.24, y: 0.76, p: 0.38 },
              { x: 0.14, y: 0.88, p: 0.14 },
            ],
          },
        ],
      },
      {
        id: 'w-yanp',
        radical: '讠',
        code: 'W A',
        tag: '急折牵提',
        title: '言旁游丝 · 折下急挑',
        insight: '上点轻落领势，朱砂游丝横折直下后陡然右上提锋，把连绵曲势浓缩成利落一折。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.26, y: 0.45, p: 0.74 },
              { x: 0.48, y: 0.41, p: 0.82 },
              { x: 0.46, y: 0.66, p: 0.64 },
              { x: 0.45, y: 0.82, p: 0.86 },
              { x: 0.68, y: 0.67, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.4, y: 0.18, p: 0.32 },
              { x: 0.48, y: 0.26, p: 0.86 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 3. R · 双勒叠锋 ====================
  {
    key: 'r',
    hand: 'L',
    row: 'top',
    homeKey: 'F',
    fingerLabel: '左食指',
    reachLabel: '由 F 向上直推',
    techniqueName: '双勒叠锋',
    sealText: ['双', '勒'],
    topoSymbol: '=',
    topoInvariant: '成对平行 · 叠层呼应',
    nodes: [
      {
        id: 'r-er',
        radical: '二',
        code: 'R J E',
        tag: '母体原势',
        title: '双勒本形 · 上仰下覆',
        insight: '左食指由 F 向上直推至 R，起两道平行勒笔：上短微仰、下长稳覆，两锋隔空呼应。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.35, p: 0.78 },
              { x: 0.5, y: 0.32, p: 0.54 },
              { x: 0.74, y: 0.3, p: 0.84 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.67, p: 0.88 },
              { x: 0.42, y: 0.64, p: 0.6 },
              { x: 0.68, y: 0.63, p: 0.68 },
              { x: 0.86, y: 0.65, p: 0.94 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'r-bing',
        radical: '冫',
        code: 'R J E',
        tag: '倾势化点',
        title: '冰霜双锋 · 顿点斜挑',
        insight: '将两道平行横画收束倾斜：上勒化为顿点，下勒翻作斜挑，指尖依然是上下成对的回响。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.35, y: 0.25, p: 0.32 },
              { x: 0.46, y: 0.33, p: 0.74 },
              { x: 0.56, y: 0.41, p: 0.94 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.3, y: 0.77, p: 0.92 },
              { x: 0.47, y: 0.65, p: 0.64 },
              { x: 0.66, y: 0.5, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'r-yan',
        radical: '言',
        code: 'R A',
        tag: '叠层收颈',
        title: '雅言叠勒 · 居中承启',
        insight: '双勒收紧为「言」字中段紧挨的两道短横，上承冠点长横、下托方口，正是层叠骨相。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.33, y: 0.43, p: 0.72 },
              { x: 0.5, y: 0.41, p: 0.5 },
              { x: 0.67, y: 0.4, p: 0.78 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.33, y: 0.55, p: 0.72 },
              { x: 0.5, y: 0.53, p: 0.5 },
              { x: 0.67, y: 0.52, p: 0.78 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.45, y: 0.12, p: 0.3 },
              { x: 0.51, y: 0.17, p: 0.76 },
              { x: 0.55, y: 0.22, p: 0.9 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.17, y: 0.31, p: 0.8 },
              { x: 0.5, y: 0.28, p: 0.54 },
              { x: 0.83, y: 0.27, p: 0.86 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.66, p: 0.72 },
              { x: 0.34, y: 0.78, p: 0.58 },
              { x: 0.36, y: 0.89, p: 0.68 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.34, y: 0.67, p: 0.62 },
              { x: 0.52, y: 0.65, p: 0.54 },
              { x: 0.67, y: 0.65, p: 0.8 },
              { x: 0.65, y: 0.77, p: 0.62 },
              { x: 0.63, y: 0.87, p: 0.7 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.37, y: 0.86, p: 0.68 },
              { x: 0.51, y: 0.85, p: 0.54 },
              { x: 0.65, y: 0.84, p: 0.74 },
            ],
          },
        ],
      },
      {
        id: 'r-yang',
        radical: '羊',
        code: 'R Y A',
        tag: '三横并阶',
        title: '叠横贯柱 · 阶梯呼应',
        insight: '两道朱砂双勒悬于中上成平行阶梯，再添羊角、长底横与悬针竖贯通中轴。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.34, p: 0.76 },
              { x: 0.5, y: 0.32, p: 0.54 },
              { x: 0.74, y: 0.31, p: 0.8 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.29, y: 0.5, p: 0.74 },
              { x: 0.5, y: 0.48, p: 0.54 },
              { x: 0.71, y: 0.47, p: 0.78 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.14, p: 0.34 },
              { x: 0.37, y: 0.2, p: 0.74 },
              { x: 0.41, y: 0.26, p: 0.86 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.68, y: 0.13, p: 0.78 },
              { x: 0.62, y: 0.2, p: 0.56 },
              { x: 0.57, y: 0.27, p: 0.22 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.66, p: 0.84 },
              { x: 0.5, y: 0.63, p: 0.58 },
              { x: 0.84, y: 0.62, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.33, p: 0.74 },
              { x: 0.5, y: 0.56, p: 0.6 },
              { x: 0.5, y: 0.78, p: 0.44 },
              { x: 0.5, y: 0.92, p: 0.14 },
            ],
          },
        ],
      },
      {
        id: 'r-min',
        radical: '皿',
        code: 'R M I',
        tag: '上下托宫',
        title: '双栏承器 · 宽勒托底',
        insight: '双勒向两端撑开，上勒作器口、下勒作宽厚的承托底座，中间立起柱肋便化作「皿」。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.33, p: 0.74 },
              { x: 0.5, y: 0.31, p: 0.54 },
              { x: 0.76, y: 0.3, p: 0.82 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.12, y: 0.74, p: 0.88 },
              { x: 0.42, y: 0.72, p: 0.6 },
              { x: 0.7, y: 0.71, p: 0.68 },
              { x: 0.88, y: 0.72, p: 0.92 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.33, p: 0.74 },
              { x: 0.26, y: 0.53, p: 0.58 },
              { x: 0.28, y: 0.72, p: 0.7 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.76, y: 0.31, p: 0.78 },
              { x: 0.74, y: 0.52, p: 0.6 },
              { x: 0.71, y: 0.71, p: 0.7 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.42, y: 0.33, p: 0.64 },
              { x: 0.43, y: 0.52, p: 0.52 },
              { x: 0.44, y: 0.71, p: 0.62 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.58, y: 0.32, p: 0.64 },
              { x: 0.57, y: 0.52, p: 0.52 },
              { x: 0.56, y: 0.71, p: 0.62 },
            ],
          },
        ],
      },
      {
        id: 'r-chen',
        radical: '辰',
        code: 'R C E',
        tag: '藏锋入室',
        title: '厂下双勒 · 舒展撇捺',
        insight: '即便藏于广庇「厂」檐之下，腹中依旧是两道平行双勒，随后顺势展放竖提与长捺。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.36, y: 0.34, p: 0.72 },
              { x: 0.55, y: 0.32, p: 0.52 },
              { x: 0.74, y: 0.31, p: 0.78 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.49, p: 0.78 },
              { x: 0.56, y: 0.47, p: 0.56 },
              { x: 0.82, y: 0.46, p: 0.84 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.18, p: 0.8 },
              { x: 0.52, y: 0.16, p: 0.54 },
              { x: 0.8, y: 0.15, p: 0.84 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.26, y: 0.19, p: 0.76 },
              { x: 0.24, y: 0.45, p: 0.6 },
              { x: 0.2, y: 0.68, p: 0.44 },
              { x: 0.12, y: 0.86, p: 0.16 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.42, y: 0.5, p: 0.74 },
              { x: 0.42, y: 0.72, p: 0.58 },
              { x: 0.42, y: 0.85, p: 0.78 },
              { x: 0.56, y: 0.77, p: 0.24 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.74, y: 0.54, p: 0.72 },
              { x: 0.68, y: 0.61, p: 0.52 },
              { x: 0.61, y: 0.67, p: 0.22 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.53, p: 0.5 },
              { x: 0.63, y: 0.67, p: 0.68 },
              { x: 0.75, y: 0.79, p: 0.84 },
              { x: 0.88, y: 0.85, p: 0.18 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 4. T · 阻力受阻 ====================
  {
    key: 't',
    hand: 'L',
    row: 'top',
    homeKey: 'F',
    fingerLabel: '左食内',
    reachLabel: '由 F 向右上斜伸吃力',
    techniqueName: '阻力受阻',
    sealText: ['阻', '力'],
    topoSymbol: '⊣',
    topoInvariant: '伸指遇阻 · 推进撞壁回弹',
    nodes: [
      {
        id: 't-dian',
        radical: '丶',
        code: 'T U',
        tag: '横斜挡路',
        title: '斜点横挡 · 食指遇阻',
        insight: '左食指由 F 斜伸向 T（↗）最吃力，眼前一点恰如斜板横亘正前方，寸步受阻。',
        coreStrokes: [
          {
            dunbiStart: false,
            points: [
              { x: 0.38, y: 0.3, p: 0.24 },
              { x: 0.48, y: 0.44, p: 0.68 },
              { x: 0.58, y: 0.62, p: 0.98 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 't-shou',
        radical: '扌',
        code: 'T O',
        tag: '竖壁挡路',
        title: '竖钩立壁 · 截断去势',
        insight: '不必管斜提，只感受前方一道竖钩立壁正迎面截断左食指 F→T（↗）的推力。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.24, y: 0.64, p: 0.88 },
              { x: 0.48, y: 0.53, p: 0.58 },
              { x: 0.72, y: 0.41, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.36, p: 0.74 },
              { x: 0.48, y: 0.34, p: 0.54 },
              { x: 0.7, y: 0.32, p: 0.8 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.15, p: 0.82 },
              { x: 0.52, y: 0.56, p: 0.62 },
              { x: 0.52, y: 0.84, p: 0.82 },
              { x: 0.38, y: 0.76, p: 0.2 },
            ],
          },
        ],
      },
      {
        id: 't-bi',
        radical: '匕',
        code: 'T I',
        tag: '强弓阻力壁',
        title: '整张强弓 · 顶死刺锋',
        insight: '索性忘掉短撇，眼前整张厚重弓形竖弯钩（乚）就是最强的盾壁——F→T 推上去根本刺不进！',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.72, y: 0.28, p: 0.86 },
              { x: 0.54, y: 0.4, p: 0.58 },
              { x: 0.36, y: 0.5, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.36, y: 0.2, p: 0.8 },
              { x: 0.35, y: 0.62, p: 0.64 },
              { x: 0.42, y: 0.78, p: 0.74 },
              { x: 0.76, y: 0.78, p: 0.82 },
              { x: 0.82, y: 0.63, p: 0.18 },
            ],
          },
        ],
      },
      {
        id: 't-qian',
        radical: '欠',
        code: 'T K A',
        tag: '斜堤钩壁',
        title: '横钩捺坡 · 双重拦阻',
        insight: '忘掉两侧撇笔，只剩横钩顶盖与长捺斜堤合围在 F→T（↗）路径前方，阻力沉实。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.44, y: 0.15, p: 0.84 },
              { x: 0.34, y: 0.33, p: 0.56 },
              { x: 0.22, y: 0.48, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.36, y: 0.34, p: 0.68 },
              { x: 0.72, y: 0.3, p: 0.84 },
              { x: 0.63, y: 0.46, p: 0.2 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.43, p: 0.78 },
              { x: 0.44, y: 0.66, p: 0.58 },
              { x: 0.2, y: 0.86, p: 0.16 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.48, y: 0.56, p: 0.54 },
              { x: 0.64, y: 0.73, p: 0.82 },
              { x: 0.86, y: 0.85, p: 0.18 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 5. Y · 抗阻斜推 ====================
  {
    key: 'y',
    hand: 'R',
    row: 'top',
    homeKey: 'J',
    fingerLabel: '右食内',
    reachLabel: '由 J 向左上斜伸吃力',
    techniqueName: '抗阻斜推',
    sealText: ['抗', '阻'],
    topoSymbol: '⊢',
    topoInvariant: '右食斜推遇阻 · 右下起势撞击全红壁',
    nodes: [
      {
        id: 'y-da',
        radical: '大',
        code: 'Y D A',
        tag: '捺脚推壁',
        title: '右下斜捺起推 · 横撇拦阻',
        insight: '右食指由 J 向左上斜推（↖）同样吃力，右下捺尾蓝锋起势即撞上横梁左撇全红阻力壁。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.16, p: 0.82 },
              { x: 0.47, y: 0.48, p: 0.62 },
              { x: 0.34, y: 0.72, p: 0.44 },
              { x: 0.14, y: 0.86, p: 0.16 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.46, p: 0.54 },
              { x: 0.64, y: 0.68, p: 0.78 },
              { x: 0.86, y: 0.84, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.18, y: 0.44, p: 0.82 },
              { x: 0.5, y: 0.41, p: 0.56 },
              { x: 0.82, y: 0.4, p: 0.86 },
            ],
          },
        ],
      },
      {
        id: 'y-fu',
        radical: '夫',
        code: 'Y F U',
        tag: '双横阻推',
        title: '捺尾上推 · 双横迎压',
        insight: '右下捺角蓝色起势朝左上顶推，两道厚横连同左撇合成叠层阻力墙稳稳挡回。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.14, p: 0.82 },
              { x: 0.48, y: 0.5, p: 0.62 },
              { x: 0.35, y: 0.74, p: 0.44 },
              { x: 0.15, y: 0.88, p: 0.16 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.52, p: 0.54 },
              { x: 0.65, y: 0.72, p: 0.8 },
              { x: 0.86, y: 0.86, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.25, y: 0.32, p: 0.76 },
              { x: 0.5, y: 0.3, p: 0.54 },
              { x: 0.75, y: 0.29, p: 0.8 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.52, p: 0.82 },
              { x: 0.5, y: 0.5, p: 0.56 },
              { x: 0.84, y: 0.49, p: 0.86 },
            ],
          },
        ],
      },
      {
        id: 'y-wang',
        radical: '王',
        code: 'Y A',
        tag: '三横阻壁',
        title: '三横一柱 · 铁壁挡前',
        insight: '底横右端一小段蓝线标出右下起推点，配合青绿指路矢（↖）直撞整片红框三横铁壁。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.24, p: 0.8 },
              { x: 0.5, y: 0.54, p: 0.64 },
              { x: 0.5, y: 0.78, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.15, y: 0.8, p: 0.88 },
              { x: 0.5, y: 0.78, p: 0.6 },
              { x: 0.85, y: 0.78, p: 0.92 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.24, p: 0.78 },
              { x: 0.5, y: 0.22, p: 0.54 },
              { x: 0.76, y: 0.21, p: 0.82 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.27, y: 0.51, p: 0.76 },
              { x: 0.5, y: 0.49, p: 0.54 },
              { x: 0.73, y: 0.48, p: 0.8 },
            ],
          },
        ],
      },
      {
        id: 'y-fei',
        radical: '非',
        code: 'Y F E',
        tag: '双壁羽栏',
        title: '双竖六羽 · 满屏重阻',
        insight: '右下翼尾蓝线标出起推起点，沿青绿指路矢（↖）顶撞双竖六羽全红重阻壁垒。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.41, y: 0.16, p: 0.8 },
              { x: 0.41, y: 0.52, p: 0.62 },
              { x: 0.41, y: 0.86, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.59, y: 0.16, p: 0.8 },
              { x: 0.59, y: 0.52, p: 0.62 },
              { x: 0.59, y: 0.86, p: 0.74 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.18, y: 0.34, p: 0.72 },
              { x: 0.39, y: 0.33, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.19, y: 0.53, p: 0.72 },
              { x: 0.39, y: 0.52, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.16, y: 0.74, p: 0.82 },
              { x: 0.39, y: 0.69, p: 0.44 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.61, y: 0.33, p: 0.72 },
              { x: 0.82, y: 0.31, p: 0.78 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.61, y: 0.52, p: 0.72 },
              { x: 0.8, y: 0.5, p: 0.78 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.61, y: 0.71, p: 0.72 },
              { x: 0.84, y: 0.7, p: 0.82 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 6. P · 裹锋怀抱 ====================
  {
    key: 'p',
    hand: 'R',
    row: 'top',
    homeKey: ';',
    fingerLabel: '右小指',
    reachLabel: '由 ; 向上轻绕',
    techniqueName: '裹锋怀抱',
    sealText: ['裹', '锋'],
    topoSymbol: '勹',
    topoInvariant: '曲臂半围 · 怀抱内守',
    nodes: [
      {
        id: 'p-bao',
        radical: '勹',
        code: 'P A',
        tag: '怀抱母体',
        title: '撇开横折 · 曲臂环抱',
        insight: '右小指上绕至键盘右缘，短撇开肩、横折钩如长臂柔和环抱，留出温润内空。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.4, y: 0.16, p: 0.82 },
              { x: 0.3, y: 0.34, p: 0.58 },
              { x: 0.18, y: 0.48, p: 0.18 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.34, y: 0.32, p: 0.72 },
              { x: 0.68, y: 0.29, p: 0.86 },
              { x: 0.76, y: 0.32, p: 0.84 },
              { x: 0.74, y: 0.62, p: 0.68 },
              { x: 0.66, y: 0.84, p: 0.84 },
              { x: 0.52, y: 0.76, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'p-ba',
        radical: '巴',
        code: 'P A',
        tag: '圆裹回托',
        title: '上围下抱 · 圆转成环',
        insight: '上折收紧成冠，下方的竖弯钩如怀抱向上兜起，形成圆融饱满的包覆感。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.25, y: 0.25, p: 0.76 },
              { x: 0.72, y: 0.23, p: 0.86 },
              { x: 0.7, y: 0.52, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.26, y: 0.25, p: 0.76 },
              { x: 0.26, y: 0.68, p: 0.66 },
              { x: 0.34, y: 0.82, p: 0.76 },
              { x: 0.76, y: 0.81, p: 0.84 },
              { x: 0.83, y: 0.66, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.49, y: 0.25, p: 0.7 },
              { x: 0.49, y: 0.51, p: 0.64 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.28, y: 0.53, p: 0.72 },
              { x: 0.7, y: 0.51, p: 0.78 },
            ],
          },
        ],
      },
      {
        id: 'p-er',
        radical: '儿',
        code: 'P E',
        tag: '双足怀抱',
        title: '撇钩对望 · 内空如拱',
        insight: '左竖撇柔和外展，右竖弯钩宽舒承托，一左一右如同打开怀抱迎风而立。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.38, y: 0.2, p: 0.8 },
              { x: 0.36, y: 0.56, p: 0.6 },
              { x: 0.28, y: 0.76, p: 0.44 },
              { x: 0.16, y: 0.86, p: 0.16 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.58, y: 0.2, p: 0.8 },
              { x: 0.57, y: 0.66, p: 0.66 },
              { x: 0.64, y: 0.81, p: 0.76 },
              { x: 0.84, y: 0.81, p: 0.84 },
              { x: 0.88, y: 0.67, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'p-huo',
        radical: '火',
        code: 'P O',
        tag: '双星捧焰',
        title: '左右捧火 · 焰心舒展',
        insight: '外侧两点向心合抱如双掌捧火，中间人字撇捺炽热升腾，外裹内扬。',
        coreStrokes: [
          {
            dunbiStart: false,
            points: [
              { x: 0.22, y: 0.38, p: 0.36 },
              { x: 0.29, y: 0.48, p: 0.86 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.78, y: 0.34, p: 0.84 },
              { x: 0.68, y: 0.44, p: 0.56 },
              { x: 0.59, y: 0.51, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.16, p: 0.82 },
              { x: 0.48, y: 0.52, p: 0.62 },
              { x: 0.34, y: 0.74, p: 0.44 },
              { x: 0.16, y: 0.86, p: 0.16 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.49, y: 0.52, p: 0.54 },
              { x: 0.66, y: 0.72, p: 0.82 },
              { x: 0.86, y: 0.85, p: 0.18 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 7. S · 重顿托底 ====================
  {
    key: 's',
    hand: 'L',
    row: 'home',
    homeKey: 'S',
    fingerLabel: '左无名',
    reachLabel: 'S 基准位原位沉按',
    techniqueName: '重顿托底',
    sealText: ['重', '顿'],
    topoSymbol: '┻',
    topoInvariant: '中立沉按 · 厚底托举',
    nodes: [
      {
        id: 's-tu',
        radical: '土',
        code: 'S U',
        tag: '厚土母体',
        title: '一柱立地 · 长横托底',
        insight: '左无名指原位沉按如柱扎厚土，中竖稳立、底横重顿铺开，承托万钧。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.18, p: 0.84 },
              { x: 0.5, y: 0.5, p: 0.66 },
              { x: 0.5, y: 0.77, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.79, p: 0.9 },
              { x: 0.5, y: 0.77, p: 0.62 },
              { x: 0.86, y: 0.77, p: 0.94 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.27, y: 0.47, p: 0.76 },
              { x: 0.5, y: 0.45, p: 0.56 },
              { x: 0.73, y: 0.44, p: 0.8 },
            ],
          },
        ],
      },
      {
        id: 's-shan',
        radical: '山',
        code: 'S S A',
        tag: '三峰坐基',
        title: '中峰耸峙 · 竖折托山',
        insight: '中竖化作主峰挺拔而立，下横连左壁化为厚重竖折底座，稳稳托起三座山峦。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.18, p: 0.84 },
              { x: 0.5, y: 0.5, p: 0.66 },
              { x: 0.5, y: 0.76, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.22, y: 0.44, p: 0.78 },
              { x: 0.21, y: 0.76, p: 0.88 },
              { x: 0.5, y: 0.75, p: 0.64 },
              { x: 0.78, y: 0.74, p: 0.86 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.79, y: 0.41, p: 0.82 },
              { x: 0.78, y: 0.64, p: 0.66 },
              { x: 0.77, y: 0.84, p: 0.76 },
            ],
          },
        ],
      },
      {
        id: 's-shi',
        radical: '士',
        code: 'S I',
        tag: '宽肩稳立',
        title: '上宽下稳 · 竖柱扎根',
        insight: '仍是一竖配底横的沉按托基，仅把上横拉宽为肩，便从厚「土」立作端正之「士」。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.17, p: 0.84 },
              { x: 0.5, y: 0.48, p: 0.66 },
              { x: 0.5, y: 0.78, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.79, p: 0.84 },
              { x: 0.5, y: 0.77, p: 0.6 },
              { x: 0.74, y: 0.77, p: 0.88 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.15, y: 0.46, p: 0.84 },
              { x: 0.5, y: 0.43, p: 0.58 },
              { x: 0.85, y: 0.42, p: 0.88 },
            ],
          },
        ],
      },
      {
        id: 's-niu',
        radical: '牛',
        code: 'S N U',
        tag: '贯底雄横',
        title: '牛角斜起 · 长横中贯',
        insight: '中竖沉稳贯通全字，长横雄厚托势，左上短撇与短横相呼应，浑厚如拓荒老牛。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.15, p: 0.84 },
              { x: 0.52, y: 0.56, p: 0.64 },
              { x: 0.52, y: 0.88, p: 0.24 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.6, p: 0.88 },
              { x: 0.52, y: 0.57, p: 0.6 },
              { x: 0.86, y: 0.56, p: 0.92 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.34, y: 0.22, p: 0.78 },
              { x: 0.28, y: 0.36, p: 0.54 },
              { x: 0.22, y: 0.48, p: 0.18 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.38, p: 0.74 },
              { x: 0.54, y: 0.36, p: 0.54 },
              { x: 0.76, y: 0.35, p: 0.8 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 8. D · 方折围宫 ====================
  {
    key: 'd',
    hand: 'L',
    row: 'home',
    homeKey: 'D',
    fingerLabel: '左中指',
    reachLabel: 'D 基准位原位立按',
    techniqueName: '方折围宫',
    sealText: ['围', '宫'],
    topoSymbol: '▭',
    topoInvariant: '方折立壁 · 四隅围宫',
    nodes: [
      {
        id: 'd-kou',
        radical: '口',
        code: 'D O',
        tag: '围宫母体',
        title: '方折立壁 · 气聚中宫',
        insight: '左中指最稳居中，原位落按如立起方正宫墙：左壁下倾、横折方峻，一横封底。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.28, p: 0.8 },
              { x: 0.26, y: 0.54, p: 0.64 },
              { x: 0.28, y: 0.78, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.29, p: 0.7 },
              { x: 0.52, y: 0.27, p: 0.56 },
              { x: 0.76, y: 0.27, p: 0.88 },
              { x: 0.74, y: 0.53, p: 0.66 },
              { x: 0.72, y: 0.76, p: 0.78 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.29, y: 0.76, p: 0.74 },
              { x: 0.52, y: 0.75, p: 0.58 },
              { x: 0.73, y: 0.74, p: 0.82 },
            ],
          },
        ],
      },
      {
        id: 'd-mu',
        radical: '目',
        code: 'D M U',
        tag: '修长直宫',
        title: '长宫立眸 · 双横藏睛',
        insight: '将「口」的方折宫墙纵向拉长，宫内匀排三横，化作炯炯有神的修长之「目」。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.17, p: 0.8 },
              { x: 0.3, y: 0.52, p: 0.62 },
              { x: 0.3, y: 0.86, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.18, p: 0.68 },
              { x: 0.54, y: 0.17, p: 0.54 },
              { x: 0.7, y: 0.17, p: 0.86 },
              { x: 0.7, y: 0.52, p: 0.64 },
              { x: 0.7, y: 0.85, p: 0.78 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.4, p: 0.68 },
              { x: 0.68, y: 0.39, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.61, p: 0.68 },
              { x: 0.68, y: 0.6, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.83, p: 0.72 },
              { x: 0.69, y: 0.82, p: 0.78 },
            ],
          },
        ],
      },
      {
        id: 'd-zao',
        radical: '早',
        code: 'D A',
        tag: '悬宫升日',
        title: '上悬日宫 · 下承十字',
        insight: '方折围宫轻升上半格化作晨「日」，下方宽展十字稳柱，如朝阳跃出地平线。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.27, y: 0.17, p: 0.76 },
              { x: 0.29, y: 0.34, p: 0.6 },
              { x: 0.31, y: 0.5, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.29, y: 0.18, p: 0.66 },
              { x: 0.54, y: 0.16, p: 0.54 },
              { x: 0.73, y: 0.16, p: 0.84 },
              { x: 0.71, y: 0.33, p: 0.62 },
              { x: 0.69, y: 0.49, p: 0.74 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.34, p: 0.66 },
              { x: 0.69, y: 0.32, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.49, p: 0.7 },
              { x: 0.68, y: 0.48, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.68, p: 0.84 },
              { x: 0.5, y: 0.66, p: 0.58 },
              { x: 0.86, y: 0.65, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.5, p: 0.76 },
              { x: 0.5, y: 0.74, p: 0.58 },
              { x: 0.5, y: 0.92, p: 0.18 },
            ],
          },
        ],
      },
      {
        id: 'd-yu',
        radical: '雨',
        code: 'D Y U',
        tag: '广檐垂宫',
        title: '天檐阔宫 · 四滴落雨',
        insight: '宫墙向两侧撑开作宽檐垂帘，中间一竖定脊，四点细雨在宫内轻落。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.19, y: 0.41, p: 0.78 },
              { x: 0.19, y: 0.64, p: 0.62 },
              { x: 0.19, y: 0.85, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.21, y: 0.42, p: 0.68 },
              { x: 0.54, y: 0.4, p: 0.56 },
              { x: 0.81, y: 0.4, p: 0.86 },
              { x: 0.81, y: 0.7, p: 0.68 },
              { x: 0.81, y: 0.85, p: 0.82 },
              { x: 0.7, y: 0.78, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.2, y: 0.22, p: 0.8 },
              { x: 0.5, y: 0.2, p: 0.56 },
              { x: 0.8, y: 0.19, p: 0.84 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.21, p: 0.78 },
              { x: 0.5, y: 0.56, p: 0.6 },
              { x: 0.5, y: 0.84, p: 0.72 },
            ],
          },
          {
            points: [
              { x: 0.3, y: 0.53, p: 0.34 },
              { x: 0.37, y: 0.58, p: 0.78 },
            ],
          },
          {
            points: [
              { x: 0.3, y: 0.69, p: 0.34 },
              { x: 0.37, y: 0.74, p: 0.78 },
            ],
          },
          {
            points: [
              { x: 0.62, y: 0.53, p: 0.34 },
              { x: 0.7, y: 0.58, p: 0.78 },
            ],
          },
          {
            points: [
              { x: 0.62, y: 0.69, p: 0.34 },
              { x: 0.7, y: 0.74, p: 0.78 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 9. F · 横勒定界 ====================
  {
    key: 'f',
    hand: 'L',
    row: 'home',
    homeKey: 'F',
    fingerLabel: '左食指',
    reachLabel: 'F 定位凸点稳按',
    techniqueName: '横勒定界',
    sealText: ['定', '界'],
    topoSymbol: '━',
    topoInvariant: '一横贯势 · 基准定界',
    nodes: [
      {
        id: 'f-yi',
        radical: '一',
        code: 'F I',
        tag: '定界母体',
        title: '沧海一横 · 顿起回锋',
        insight: '左食指触及 F 键盲打凸点，如大笔顿落划出一道通天横勒，起笔藏锋、收笔稳驻。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.12, y: 0.52, p: 0.9 },
              { x: 0.38, y: 0.49, p: 0.6 },
              { x: 0.66, y: 0.48, p: 0.68 },
              { x: 0.88, y: 0.49, p: 0.96 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'f-chang',
        radical: '厂',
        code: 'F A',
        tag: '横檐垂崖',
        title: '高横定顶 · 左崖长垂',
        insight: '基准主横升至顶部作广崖屋檐，左端顺势垂下一道修长舒展的悬崖撇锋。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.22, y: 0.22, p: 0.86 },
              { x: 0.52, y: 0.2, p: 0.58 },
              { x: 0.84, y: 0.19, p: 0.9 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.25, y: 0.23, p: 0.82 },
              { x: 0.24, y: 0.52, p: 0.62 },
              { x: 0.2, y: 0.74, p: 0.42 },
              { x: 0.12, y: 0.88, p: 0.16 },
            ],
          },
        ],
      },
      {
        id: 'f-zheng',
        radical: '正',
        code: 'F E',
        tag: '顶横镇止',
        title: '一横定天 · 下止端正',
        insight: '「一」定其上、「止」立其下，正是「正」字的造字本意——一横定界，百邪不侵。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.2, y: 0.22, p: 0.84 },
              { x: 0.5, y: 0.2, p: 0.58 },
              { x: 0.8, y: 0.19, p: 0.88 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.22, p: 0.8 },
              { x: 0.5, y: 0.54, p: 0.62 },
              { x: 0.5, y: 0.8, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.51, y: 0.51, p: 0.72 },
              { x: 0.76, y: 0.49, p: 0.8 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.28, y: 0.47, p: 0.78 },
              { x: 0.28, y: 0.8, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.82, p: 0.86 },
              { x: 0.5, y: 0.8, p: 0.58 },
              { x: 0.86, y: 0.79, p: 0.9 },
            ],
          },
        ],
      },
      {
        id: 'f-nv',
        radical: '女',
        code: 'F U',
        tag: '横梁锁势',
        title: '婉转交织 · 长横定衡',
        insight: '撇点与斜撇婀娜交错，唯有一道贯穿左右的朱砂主横稳稳锁住全字重心。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.43, p: 0.84 },
              { x: 0.5, y: 0.4, p: 0.58 },
              { x: 0.86, y: 0.39, p: 0.88 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.45, y: 0.16, p: 0.8 },
              { x: 0.34, y: 0.52, p: 0.62 },
              { x: 0.32, y: 0.6, p: 0.72 },
              { x: 0.56, y: 0.72, p: 0.76 },
              { x: 0.74, y: 0.85, p: 0.84 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.66, y: 0.38, p: 0.78 },
              { x: 0.56, y: 0.66, p: 0.6 },
              { x: 0.38, y: 0.81, p: 0.42 },
              { x: 0.18, y: 0.87, p: 0.16 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 10. G · 藏锋回环 ====================
  {
    key: 'g',
    hand: 'L',
    row: 'home',
    homeKey: 'F',
    fingerLabel: '左食内',
    reachLabel: '由 F 向右平移内扣',
    techniqueName: '藏锋回环',
    sealText: ['回', '环'],
    topoSymbol: '↻',
    topoInvariant: '曲折回扣 · 聚气成环',
    nodes: [
      {
        id: 'g-si',
        radical: '厶',
        code: 'G I',
        tag: '回环母体',
        title: '撇折回扣 · 顿点锁气',
        insight: '左食指右移内扣至 G，笔锋斜下急折回拉，再以右下重顿一点收拢气脉成环。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.52, y: 0.2, p: 0.82 },
              { x: 0.36, y: 0.5, p: 0.62 },
              { x: 0.22, y: 0.74, p: 0.86 },
              { x: 0.48, y: 0.7, p: 0.64 },
              { x: 0.74, y: 0.66, p: 0.76 },
            ],
          },
          {
            dunbiStart: false,
            points: [
              { x: 0.65, y: 0.5, p: 0.36 },
              { x: 0.74, y: 0.64, p: 0.76 },
              { x: 0.8, y: 0.78, p: 0.94 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'g-gong',
        radical: '弓',
        code: 'G G O',
        tag: '三折满弓',
        title: '回环三折 · 蓄弦待发',
        insight: '折转之势连作三回，上下盘旋如满弓蓄劲，末笔内勾紧扣，力藏锋内。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.28, y: 0.2, p: 0.76 },
              { x: 0.7, y: 0.18, p: 0.84 },
              { x: 0.66, y: 0.38, p: 0.76 },
              { x: 0.32, y: 0.4, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.32, y: 0.4, p: 0.74 },
              { x: 0.28, y: 0.57, p: 0.8 },
              { x: 0.72, y: 0.55, p: 0.86 },
              { x: 0.66, y: 0.78, p: 0.74 },
              { x: 0.58, y: 0.87, p: 0.82 },
              { x: 0.45, y: 0.79, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'g-tian',
        radical: '田',
        code: 'G T A',
        tag: '四壁守中',
        title: '闭环田格 · 十字聚心',
        insight: '回环闭合为方正四壁，内部十字回扣守中，每一笔都向中心凝聚不散。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.22, y: 0.22, p: 0.78 },
              { x: 0.24, y: 0.52, p: 0.62 },
              { x: 0.26, y: 0.8, p: 0.78 },
              { x: 0.52, y: 0.79, p: 0.62 },
              { x: 0.76, y: 0.78, p: 0.82 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.23, p: 0.68 },
              { x: 0.54, y: 0.21, p: 0.56 },
              { x: 0.78, y: 0.21, p: 0.86 },
              { x: 0.76, y: 0.52, p: 0.64 },
              { x: 0.74, y: 0.78, p: 0.78 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.23, p: 0.72 },
              { x: 0.5, y: 0.77, p: 0.68 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.51, p: 0.7 },
              { x: 0.74, y: 0.49, p: 0.74 },
            ],
          },
        ],
      },
      {
        id: 'g-feng',
        radical: '丰',
        code: 'G E',
        tag: '叠横聚轴',
        title: '三横内收 · 悬竖贯气',
        insight: '上二横微仰回环聚势，下长横稳托，一道中锋竖笔直贯而出，丰茂沉着。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.29, p: 0.76 },
              { x: 0.5, y: 0.26, p: 0.54 },
              { x: 0.76, y: 0.25, p: 0.82 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.27, y: 0.48, p: 0.74 },
              { x: 0.5, y: 0.46, p: 0.54 },
              { x: 0.73, y: 0.45, p: 0.8 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.68, p: 0.84 },
              { x: 0.5, y: 0.66, p: 0.58 },
              { x: 0.84, y: 0.65, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.13, p: 0.82 },
              { x: 0.5, y: 0.54, p: 0.62 },
              { x: 0.5, y: 0.92, p: 0.16 },
            ],
          },
        ],
      },
    ],
  },
];
