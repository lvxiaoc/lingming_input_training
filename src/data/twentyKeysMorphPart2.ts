import { KeyTopologyMorphSpec } from './twentyKeysMorphTypes';

// Second 10 Lingming consonant keys: Right Home Row (H J K L) + Bottom Row (X C V B N M)
export const TWENTY_KEY_MORPHS_PART2: KeyTopologyMorphSpec[] = [
  // ==================== 11. H · 平顶垂露 ====================
  {
    key: 'h',
    hand: 'R',
    row: 'home',
    homeKey: 'J',
    fingerLabel: '右食内',
    reachLabel: '由 J 向左平移内扣',
    techniqueName: '平顶垂露',
    sealText: ['垂', '露'],
    topoSymbol: '⊤',
    topoInvariant: '平顶冠盖 · 垂露下悬',
    nodes: [
      {
        id: 'h-ding',
        radical: '丁',
        code: 'H D I',
        tag: '垂露母体',
        title: '平横作顶 · 竖钩垂露',
        insight: '右食指由 J 向左平扣 H 键，如顶横平铺、中锋一竖垂露而下，末梢轻勾回峰。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.25, p: 0.86 },
              { x: 0.5, y: 0.23, p: 0.58 },
              { x: 0.86, y: 0.22, p: 0.9 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.24, p: 0.78 },
              { x: 0.52, y: 0.62, p: 0.64 },
              { x: 0.52, y: 0.84, p: 0.86 },
              { x: 0.37, y: 0.75, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'h-ri',
        radical: '日',
        code: 'H R I',
        tag: '平顶方阳',
        title: '顶折垂落 · 旭日守心',
        insight: '平顶折笔直垂成右壁，左壁并立、中横守心，暖阳自顶而下沉稳悬照。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.21, p: 0.72 },
              { x: 0.54, y: 0.19, p: 0.56 },
              { x: 0.71, y: 0.19, p: 0.86 },
              { x: 0.7, y: 0.52, p: 0.64 },
              { x: 0.69, y: 0.83, p: 0.78 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.2, p: 0.8 },
              { x: 0.3, y: 0.52, p: 0.62 },
              { x: 0.3, y: 0.84, p: 0.76 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.51, p: 0.7 },
              { x: 0.68, y: 0.5, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.82, p: 0.74 },
              { x: 0.69, y: 0.81, p: 0.8 },
            ],
          },
        ],
      },
      {
        id: 'h-guang',
        radical: '广',
        code: 'H G A',
        tag: '冠点广檐',
        title: '高冠平檐 · 左壁垂庇',
        insight: '顶横之上添一冠点，左端垂下修长护撇，平顶之下自然生出广厦空间。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.29, p: 0.82 },
              { x: 0.54, y: 0.26, p: 0.56 },
              { x: 0.84, y: 0.25, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.27, y: 0.3, p: 0.8 },
              { x: 0.25, y: 0.56, p: 0.6 },
              { x: 0.21, y: 0.76, p: 0.42 },
              { x: 0.13, y: 0.88, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            points: [
              { x: 0.48, y: 0.12, p: 0.32 },
              { x: 0.54, y: 0.2, p: 0.88 },
            ],
          },
        ],
      },
      {
        id: 'h-wen',
        radical: '文',
        code: 'H W E',
        tag: '平顶文心',
        title: '点横定顶 · 撇捺交章',
        insight: '高点配平横作冠，下垂一撇与长捺从容交叉，如锦绣文章自顶垂落。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.32, p: 0.84 },
              { x: 0.5, y: 0.29, p: 0.56 },
              { x: 0.84, y: 0.28, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.64, y: 0.32, p: 0.8 },
              { x: 0.52, y: 0.58, p: 0.6 },
              { x: 0.34, y: 0.76, p: 0.42 },
              { x: 0.16, y: 0.86, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            points: [
              { x: 0.46, y: 0.13, p: 0.32 },
              { x: 0.52, y: 0.22, p: 0.88 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.32, y: 0.42, p: 0.56 },
              { x: 0.52, y: 0.62, p: 0.72 },
              { x: 0.7, y: 0.78, p: 0.86 },
              { x: 0.88, y: 0.85, p: 0.18 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 12. J · 侧锋斜切 ====================
  {
    key: 'j',
    hand: 'R',
    row: 'home',
    homeKey: 'J',
    fingerLabel: '右食指',
    reachLabel: 'J 定位凸点稳按',
    techniqueName: '侧锋斜切',
    sealText: ['斜', '切'],
    topoSymbol: '↙',
    topoInvariant: '侧锋斜入 · 撇立相生',
    nodes: [
      {
        id: 'j-ren',
        radical: '亻',
        code: 'J E',
        tag: '斜切母体',
        title: '侧撇斜入 · 垂柱稳立',
        insight: '右食指触及 J 键定位凸点，侧锋一撇凌空斜切，中腹垂竖稳落，干练挺拔。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.64, y: 0.16, p: 0.86 },
              { x: 0.5, y: 0.38, p: 0.62 },
              { x: 0.34, y: 0.54, p: 0.42 },
              { x: 0.22, y: 0.63, p: 0.16 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.47, y: 0.43, p: 0.8 },
              { x: 0.47, y: 0.66, p: 0.64 },
              { x: 0.47, y: 0.88, p: 0.76 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'j-cun',
        radical: '寸',
        code: 'J C U',
        tag: '斜点定寸',
        title: '长横竖钩 · 侧点切心',
        insight: '横竖稳架之外，腹心一记侧锋斜点恰如脉门定寸，灵动而不失法度。',
        coreStrokes: [
          {
            points: [
              { x: 0.32, y: 0.52, p: 0.34 },
              { x: 0.4, y: 0.6, p: 0.78 },
              { x: 0.45, y: 0.67, p: 0.92 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.66, y: 0.16, p: 0.84 },
              { x: 0.66, y: 0.58, p: 0.66 },
              { x: 0.66, y: 0.84, p: 0.86 },
              { x: 0.51, y: 0.76, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.41, p: 0.84 },
              { x: 0.52, y: 0.38, p: 0.58 },
              { x: 0.86, y: 0.37, p: 0.88 },
            ],
          },
        ],
      },
      {
        id: 'j-zhi',
        radical: '夂',
        code: 'J V I',
        tag: '双斜交步',
        title: '侧撇起势 · 横撇交捺',
        insight: '首笔短撇斜切开篇，横撇顺势再斜，末笔舒展长捺交错前行，步履生风。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.46, y: 0.14, p: 0.84 },
              { x: 0.36, y: 0.34, p: 0.6 },
              { x: 0.24, y: 0.5, p: 0.18 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.4, y: 0.3, p: 0.72 },
              { x: 0.68, y: 0.28, p: 0.86 },
              { x: 0.54, y: 0.56, p: 0.62 },
              { x: 0.36, y: 0.76, p: 0.42 },
              { x: 0.18, y: 0.86, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            flickEnd: true,
            points: [
              { x: 0.32, y: 0.44, p: 0.56 },
              { x: 0.52, y: 0.64, p: 0.74 },
              { x: 0.72, y: 0.79, p: 0.86 },
              { x: 0.88, y: 0.85, p: 0.18 },
            ],
          },
        ],
      },
      {
        id: 'j-sheng',
        radical: '生',
        code: 'J E',
        tag: '侧撇萌生',
        title: '斜芽初破 · 三横生发',
        insight: '左上侧锋一撇破土而出，中竖贯起三道平横，草木欣欣生发之势跃然纸上。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.34, y: 0.2, p: 0.82 },
              { x: 0.27, y: 0.36, p: 0.58 },
              { x: 0.19, y: 0.5, p: 0.18 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.52, y: 0.16, p: 0.84 },
              { x: 0.52, y: 0.52, p: 0.64 },
              { x: 0.52, y: 0.8, p: 0.74 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.38, p: 0.74 },
              { x: 0.76, y: 0.35, p: 0.82 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.28, y: 0.58, p: 0.74 },
              { x: 0.74, y: 0.56, p: 0.8 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.81, p: 0.86 },
              { x: 0.52, y: 0.79, p: 0.6 },
              { x: 0.86, y: 0.79, p: 0.9 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 13. K · 中锋直入 ====================
  {
    key: 'k',
    hand: 'R',
    row: 'home',
    homeKey: 'K',
    fingerLabel: '右中指',
    reachLabel: 'K 基准位垂直立按',
    techniqueName: '中锋直入',
    sealText: ['直', '入'],
    topoSymbol: '│',
    topoInvariant: '中锋直刺 · 锥画沙骨',
    nodes: [
      {
        id: 'k-gun',
        radical: '丨',
        code: 'K I',
        tag: '中锋母体',
        title: '一竖贯天 · 如锥画沙',
        insight: '右中指挺拔最长，原位垂直按落如中锋直入，笔毫居中行进，劲挺绝无偏斜。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.14, p: 0.88 },
              { x: 0.5, y: 0.44, p: 0.66 },
              { x: 0.5, y: 0.72, p: 0.56 },
              { x: 0.5, y: 0.9, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'k-shang',
        radical: '上',
        code: 'K A',
        tag: '直锋顶天',
        title: '中锋挺立 · 一横指上',
        insight: '中锋主竖挺直立于底横之上，腰间短横轻指右方，气势拔地而起。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.48, y: 0.16, p: 0.86 },
              { x: 0.48, y: 0.5, p: 0.66 },
              { x: 0.48, y: 0.8, p: 0.76 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.46, p: 0.74 },
              { x: 0.76, y: 0.44, p: 0.82 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.81, p: 0.88 },
              { x: 0.5, y: 0.79, p: 0.6 },
              { x: 0.84, y: 0.79, p: 0.92 },
            ],
          },
        ],
      },
      {
        id: 'k-bai',
        radical: '白',
        code: 'K B A',
        tag: '顶锋点白',
        title: '顶撇轻入 · 方白承明',
        insight: '首笔短撇自中轴直落点破「日」顶，如晨光一束直入明室，澄澈分明。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.14, p: 0.86 },
              { x: 0.46, y: 0.24, p: 0.58 },
              { x: 0.41, y: 0.33, p: 0.22 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.27, y: 0.33, p: 0.78 },
              { x: 0.28, y: 0.6, p: 0.62 },
              { x: 0.29, y: 0.85, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.29, y: 0.34, p: 0.68 },
              { x: 0.72, y: 0.32, p: 0.86 },
              { x: 0.71, y: 0.6, p: 0.64 },
              { x: 0.7, y: 0.84, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.58, p: 0.7 },
              { x: 0.69, y: 0.57, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.83, p: 0.74 },
              { x: 0.7, y: 0.82, p: 0.8 },
            ],
          },
        ],
      },
      {
        id: 'k-li',
        radical: '力',
        code: 'K L I',
        tag: '中锋斜破',
        title: '劲撇斜贯 · 弯钩蓄力',
        insight: '中锋长撇自顶贯下斜破折钩，笔力如弯刀出鞘，筋骨毕现。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.15, p: 0.86 },
              { x: 0.44, y: 0.48, p: 0.66 },
              { x: 0.32, y: 0.72, p: 0.46 },
              { x: 0.16, y: 0.88, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.24, y: 0.38, p: 0.78 },
              { x: 0.74, y: 0.34, p: 0.88 },
              { x: 0.72, y: 0.68, p: 0.74 },
              { x: 0.64, y: 0.85, p: 0.86 },
              { x: 0.5, y: 0.77, p: 0.2 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 14. L · 悬针贯立 ====================
  {
    key: 'l',
    hand: 'R',
    row: 'home',
    homeKey: 'L',
    fingerLabel: '右无名',
    reachLabel: 'L 基准位修长落按',
    techniqueName: '悬针贯立',
    sealText: ['悬', '针'],
    topoSymbol: '╂',
    topoInvariant: '悬针贯通 · 修长垂立',
    nodes: [
      {
        id: 'l-shi',
        radical: '十',
        code: 'L I',
        tag: '悬针母体',
        title: '一横平展 · 悬针直贯',
        insight: '右无名指修长按落 L 键，先铺平横，再以悬针竖凌厉贯下，尾锋尖细如针悬空。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.43, p: 0.84 },
              { x: 0.5, y: 0.4, p: 0.58 },
              { x: 0.86, y: 0.39, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.15, p: 0.86 },
              { x: 0.5, y: 0.52, p: 0.66 },
              { x: 0.5, y: 0.76, p: 0.44 },
              { x: 0.5, y: 0.92, p: 0.12 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'l-yue',
        radical: '月',
        code: 'L E',
        tag: '双柱垂月',
        title: '修长双壁 · 新月悬空',
        insight: '悬针贯立化作「月」之左右修长双柱，内嵌两道轻横，清瘦高雅如秋月悬天。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.33, y: 0.18, p: 0.82 },
              { x: 0.32, y: 0.54, p: 0.64 },
              { x: 0.28, y: 0.76, p: 0.44 },
              { x: 0.2, y: 0.88, p: 0.16 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.34, y: 0.19, p: 0.7 },
              { x: 0.68, y: 0.17, p: 0.86 },
              { x: 0.68, y: 0.56, p: 0.66 },
              { x: 0.68, y: 0.85, p: 0.84 },
              { x: 0.56, y: 0.77, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.34, y: 0.4, p: 0.68 },
              { x: 0.66, y: 0.39, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.33, y: 0.58, p: 0.68 },
              { x: 0.66, y: 0.57, p: 0.72 },
            ],
          },
        ],
      },
      {
        id: 'l-shou',
        radical: '手',
        code: 'L S O',
        tag: '弯锋贯手',
        title: '顶撇双横 · 中弯贯底',
        insight: '中竖微带弧度如掌心筋脉贯通到底，配顶撇与双横，舒展而富弹性。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.56, p: 0.84 },
              { x: 0.5, y: 0.53, p: 0.58 },
              { x: 0.84, y: 0.52, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.48, y: 0.24, p: 0.78 },
              { x: 0.52, y: 0.56, p: 0.66 },
              { x: 0.51, y: 0.84, p: 0.86 },
              { x: 0.37, y: 0.77, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.66, y: 0.16, p: 0.8 },
              { x: 0.48, y: 0.22, p: 0.56 },
              { x: 0.28, y: 0.26, p: 0.2 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.38, p: 0.74 },
              { x: 0.74, y: 0.35, p: 0.8 },
            ],
          },
        ],
      },
      {
        id: 'l-gu',
        radical: '古',
        code: 'L G U',
        tag: '悬十承口',
        title: '高悬十字 · 下口相承',
        insight: '完整的「十」字悬立上半，下托古朴方口，一针贯气直通口心。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.36, p: 0.84 },
              { x: 0.5, y: 0.34, p: 0.58 },
              { x: 0.84, y: 0.33, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.14, p: 0.84 },
              { x: 0.5, y: 0.38, p: 0.64 },
              { x: 0.5, y: 0.57, p: 0.72 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.29, y: 0.57, p: 0.76 },
              { x: 0.31, y: 0.84, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.58, p: 0.68 },
              { x: 0.7, y: 0.56, p: 0.84 },
              { x: 0.68, y: 0.82, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.82, p: 0.74 },
              { x: 0.69, y: 0.81, p: 0.8 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 15. X · 中柱努立 ====================
  {
    key: 'x',
    hand: 'L',
    row: 'bot',
    homeKey: 'S',
    fingerLabel: '左无名',
    reachLabel: '由 S 向下回收',
    techniqueName: '中柱努立',
    sealText: ['努', '立'],
    topoSymbol: '┼',
    topoInvariant: '刚柱直努 · 贯木撑架',
    nodes: [
      {
        id: 'x-mu',
        radical: '木',
        code: 'X U',
        tag: '直柱母体',
        title: '横竖撑架 · 枝叶分披',
        insight: '左无名指向下收劲，中柱如永字「努」笔挺直下压，横梁架定、撇捺如枝舒展。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.18, y: 0.4, p: 0.84 },
              { x: 0.5, y: 0.37, p: 0.58 },
              { x: 0.82, y: 0.36, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.14, p: 0.86 },
              { x: 0.5, y: 0.52, p: 0.68 },
              { x: 0.5, y: 0.88, p: 0.8 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.49, y: 0.4, p: 0.76 },
              { x: 0.36, y: 0.64, p: 0.54 },
              { x: 0.16, y: 0.82, p: 0.16 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.51, y: 0.42, p: 0.54 },
              { x: 0.66, y: 0.64, p: 0.78 },
              { x: 0.86, y: 0.81, p: 0.18 },
            ],
          },
        ],
      },
      {
        id: 'x-li',
        radical: '里',
        code: 'X L I',
        tag: '通天中柱',
        title: '一柱贯里 · 田土相合',
        insight: '刚健中柱一贯到底，把上方之「田」与下方之「土」串成厚重沉稳的乡「里」。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.15, y: 0.83, p: 0.88 },
              { x: 0.5, y: 0.81, p: 0.62 },
              { x: 0.85, y: 0.81, p: 0.92 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.19, p: 0.82 },
              { x: 0.5, y: 0.52, p: 0.66 },
              { x: 0.5, y: 0.81, p: 0.76 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.25, y: 0.19, p: 0.76 },
              { x: 0.27, y: 0.51, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.27, y: 0.2, p: 0.66 },
              { x: 0.74, y: 0.18, p: 0.84 },
              { x: 0.72, y: 0.5, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.28, y: 0.35, p: 0.68 },
              { x: 0.72, y: 0.34, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.29, y: 0.5, p: 0.7 },
              { x: 0.71, y: 0.49, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.66, p: 0.74 },
              { x: 0.74, y: 0.64, p: 0.8 },
            ],
          },
        ],
      },
      {
        id: 'x-jia',
        radical: '甲',
        code: 'X J A',
        tag: '破壳直努',
        title: '长柱破日 · 雄立当先',
        insight: '刚直中柱一举穿破方宫底部长驱直下，正像草木破甲而出，独占鳌头。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.38, p: 0.72 },
              { x: 0.74, y: 0.37, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.2, p: 0.84 },
              { x: 0.5, y: 0.58, p: 0.66 },
              { x: 0.5, y: 0.91, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.23, y: 0.2, p: 0.78 },
              { x: 0.25, y: 0.56, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.25, y: 0.21, p: 0.68 },
              { x: 0.76, y: 0.19, p: 0.86 },
              { x: 0.74, y: 0.55, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.55, p: 0.72 },
              { x: 0.73, y: 0.54, p: 0.78 },
            ],
          },
        ],
      },
      {
        id: 'x-fang',
        radical: '匚',
        code: 'X F A',
        tag: '方柱折匣',
        title: '刚直立壁 · 方折收匣',
        insight: '顶横平铺，左壁以刚硬努笔直下折转成底，端方峻整如藏器木匣。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.2, y: 0.24, p: 0.84 },
              { x: 0.52, y: 0.22, p: 0.58 },
              { x: 0.82, y: 0.21, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.23, y: 0.25, p: 0.84 },
              { x: 0.23, y: 0.78, p: 0.88 },
              { x: 0.54, y: 0.77, p: 0.62 },
              { x: 0.84, y: 0.76, p: 0.9 },
            ],
          },
        ],
        extraStrokes: [],
      },
    ],
  },

  // ==================== 16. C · 折笔内敛 ====================
  {
    key: 'c',
    hand: 'L',
    row: 'bot',
    homeKey: 'D',
    fingerLabel: '左中指',
    reachLabel: '由 D 向下内收',
    techniqueName: '折笔内敛',
    sealText: ['内', '敛'],
    topoSymbol: '∠',
    topoInvariant: '锐折回扣 · 绞转内收',
    nodes: [
      {
        id: 'c-si',
        radical: '纟',
        code: 'C I',
        tag: '内敛母体',
        title: '双绞撇折 · 提锋收丝',
        insight: '左中指向下回扣 C 键，笔锋两度急折内收如捻丝成线，末笔轻提聚气。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.54, y: 0.16, p: 0.82 },
              { x: 0.34, y: 0.42, p: 0.84 },
              { x: 0.58, y: 0.4, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.66, y: 0.34, p: 0.82 },
              { x: 0.34, y: 0.62, p: 0.86 },
              { x: 0.64, y: 0.58, p: 0.76 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.28, y: 0.82, p: 0.86 },
              { x: 0.5, y: 0.75, p: 0.6 },
              { x: 0.72, y: 0.69, p: 0.2 },
            ],
          },
        ],
      },
      {
        id: 'c-ji',
        radical: '己',
        code: 'C J I',
        tag: '折腰回首',
        title: '上折收敛 · 弯钩回抱',
        insight: '上半横折向内紧收，下半竖弯钩圆转回首，敛锋守己不露圭角。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.22, p: 0.78 },
              { x: 0.72, y: 0.2, p: 0.86 },
              { x: 0.69, y: 0.48, p: 0.78 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.28, y: 0.49, p: 0.78 },
              { x: 0.27, y: 0.74, p: 0.72 },
              { x: 0.36, y: 0.84, p: 0.8 },
              { x: 0.76, y: 0.83, p: 0.86 },
              { x: 0.83, y: 0.68, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.49, p: 0.72 },
              { x: 0.69, y: 0.47, p: 0.78 },
            ],
          },
        ],
      },
      {
        id: 'c-bei',
        radical: '贝',
        code: 'C B E',
        tag: '敛框双足',
        title: '方贝内守 · 撇点轻落',
        insight: '瘦长方框向内收敛，腹中一撇斜出配右下顿点，含蓄而精致。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.18, p: 0.8 },
              { x: 0.3, y: 0.62, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.19, p: 0.7 },
              { x: 0.7, y: 0.17, p: 0.86 },
              { x: 0.7, y: 0.61, p: 0.76 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.36, p: 0.78 },
              { x: 0.46, y: 0.64, p: 0.6 },
              { x: 0.24, y: 0.86, p: 0.16 },
            ],
          },
          {
            points: [
              { x: 0.55, y: 0.66, p: 0.36 },
              { x: 0.68, y: 0.77, p: 0.76 },
              { x: 0.78, y: 0.86, p: 0.92 },
            ],
          },
        ],
      },
      {
        id: 'c-ba',
        radical: '丷',
        code: 'C A',
        tag: '双点内望',
        title: '倒八呼应 · 气聚中枢',
        insight: '左点下顿、右撇斜切，两笔笔势皆朝中心收拢，宛若两道内敛的眼神交会。',
        coreStrokes: [
          {
            points: [
              { x: 0.24, y: 0.34, p: 0.34 },
              { x: 0.34, y: 0.48, p: 0.78 },
              { x: 0.4, y: 0.62, p: 0.94 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.76, y: 0.3, p: 0.86 },
              { x: 0.65, y: 0.48, p: 0.6 },
              { x: 0.55, y: 0.64, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [],
      },
    ],
  },

  // ==================== 17. V · 直掠分流 ====================
  {
    key: 'v',
    hand: 'L',
    row: 'bot',
    homeKey: 'F',
    fingerLabel: '左食指',
    reachLabel: '由 F 向下收拢',
    techniqueName: '直掠分流',
    sealText: ['分', '流'],
    topoSymbol: '╽',
    topoInvariant: '主干直下 · 流水掠分',
    nodes: [
      {
        id: 'v-shui',
        radical: '水',
        code: 'V I',
        tag: '分流母体',
        title: '中河直泻 · 左右分波',
        insight: '左食指向下轻掠，中竖钩如主河奔泻，左右折撇与斜捺如清波向两侧分流。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.15, p: 0.84 },
              { x: 0.5, y: 0.56, p: 0.66 },
              { x: 0.5, y: 0.85, p: 0.86 },
              { x: 0.37, y: 0.77, p: 0.2 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.18, y: 0.45, p: 0.74 },
              { x: 0.38, y: 0.42, p: 0.82 },
              { x: 0.28, y: 0.64, p: 0.54 },
              { x: 0.14, y: 0.8, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.78, y: 0.32, p: 0.82 },
              { x: 0.65, y: 0.43, p: 0.56 },
              { x: 0.54, y: 0.5, p: 0.2 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.53, y: 0.48, p: 0.54 },
              { x: 0.68, y: 0.68, p: 0.82 },
              { x: 0.88, y: 0.82, p: 0.18 },
            ],
          },
        ],
      },
      {
        id: 'v-sandian',
        radical: '氵',
        code: 'V I',
        tag: '三滴流弧',
        title: '三水成弧 · 末笔跃提',
        insight: '奔流收束为三点水弧：上二点顺势滴落，末笔自下急提如水花溅起。',
        coreStrokes: [
          {
            points: [
              { x: 0.38, y: 0.19, p: 0.34 },
              { x: 0.48, y: 0.27, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.34, y: 0.82, p: 0.9 },
              { x: 0.46, y: 0.68, p: 0.6 },
              { x: 0.58, y: 0.54, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            points: [
              { x: 0.3, y: 0.42, p: 0.34 },
              { x: 0.41, y: 0.5, p: 0.88 },
            ],
          },
        ],
      },
      {
        id: 'v-lidao',
        radical: '刂',
        code: 'V D A',
        tag: '双锋直切',
        title: '立刀并列 · 直掠分界',
        insight: '短竖与长竖钩并肩直落，宛如寒水破冰、快刀分流，锋芒利落。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.64, y: 0.16, p: 0.86 },
              { x: 0.64, y: 0.58, p: 0.66 },
              { x: 0.64, y: 0.85, p: 0.86 },
              { x: 0.5, y: 0.76, p: 0.2 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.38, y: 0.3, p: 0.8 },
              { x: 0.38, y: 0.5, p: 0.64 },
              { x: 0.38, y: 0.67, p: 0.74 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'v-dao',
        radical: '刀',
        code: 'V A',
        tag: '折钩斜掠',
        title: '刀背弯钩 · 凌空掠撇',
        insight: '横折钩如刀背蓄势，腹中一记清亮长撇自上斜掠分流，势如破竹。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.24, y: 0.26, p: 0.8 },
              { x: 0.76, y: 0.23, p: 0.88 },
              { x: 0.74, y: 0.62, p: 0.74 },
              { x: 0.65, y: 0.84, p: 0.86 },
              { x: 0.5, y: 0.75, p: 0.2 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.27, p: 0.8 },
              { x: 0.42, y: 0.56, p: 0.6 },
              { x: 0.28, y: 0.76, p: 0.42 },
              { x: 0.14, y: 0.86, p: 0.16 },
            ],
          },
        ],
        extraStrokes: [],
      },
    ],
  },

  // ==================== 18. B · 覆盖压锋 ====================
  {
    key: 'b',
    hand: 'L',
    row: 'bot',
    homeKey: 'F',
    fingerLabel: '左食内',
    reachLabel: '由 F 向右下斜扣',
    techniqueName: '覆盖压锋',
    sealText: ['压', '锋'],
    topoSymbol: '冖',
    topoInvariant: '穹顶覆压 · 庇护下承',
    nodes: [
      {
        id: 'b-mi',
        radical: '冖',
        code: 'B I',
        tag: '盖顶母体',
        title: '左角垂点 · 长钩覆压',
        insight: '左食指向右下斜探扣住 B 键，如宽大穹顶自左向右平覆压下，钩锋向内微收。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.22, y: 0.34, p: 0.78 },
              { x: 0.17, y: 0.48, p: 0.66 },
              { x: 0.15, y: 0.58, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.22, y: 0.36, p: 0.72 },
              { x: 0.54, y: 0.33, p: 0.58 },
              { x: 0.84, y: 0.32, p: 0.88 },
              { x: 0.74, y: 0.52, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'b-men',
        radical: '门',
        code: 'B M E',
        tag: '高门覆合',
        title: '左柱悬点 · 右折长垂',
        insight: '穹顶左右拉深落地，一点定门额，左竖与右横折钩如重门覆护庭院。',
        coreStrokes: [
          {
            points: [
              { x: 0.28, y: 0.16, p: 0.34 },
              { x: 0.38, y: 0.24, p: 0.86 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.48, y: 0.24, p: 0.74 },
              { x: 0.77, y: 0.22, p: 0.86 },
              { x: 0.77, y: 0.62, p: 0.68 },
              { x: 0.77, y: 0.86, p: 0.86 },
              { x: 0.64, y: 0.77, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.3, p: 0.82 },
              { x: 0.24, y: 0.6, p: 0.64 },
              { x: 0.24, y: 0.86, p: 0.76 },
            ],
          },
        ],
      },
      {
        id: 'b-li',
        radical: '立',
        code: 'B L I',
        tag: '冠顶稳立',
        title: '顶冠压势 · 阔底端立',
        insight: '上点配平横如冠盖压顶，下撑两点与宽阔底横，上覆下承稳如磐石。',
        coreStrokes: [
          {
            points: [
              { x: 0.46, y: 0.15, p: 0.34 },
              { x: 0.52, y: 0.24, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.22, y: 0.34, p: 0.82 },
              { x: 0.5, y: 0.32, p: 0.58 },
              { x: 0.78, y: 0.31, p: 0.86 },
            ],
          },
        ],
        extraStrokes: [
          {
            points: [
              { x: 0.34, y: 0.45, p: 0.36 },
              { x: 0.39, y: 0.66, p: 0.86 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.66, y: 0.42, p: 0.82 },
              { x: 0.6, y: 0.62, p: 0.56 },
              { x: 0.55, y: 0.76, p: 0.22 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.14, y: 0.8, p: 0.88 },
              { x: 0.5, y: 0.78, p: 0.6 },
              { x: 0.86, y: 0.78, p: 0.92 },
            ],
          },
        ],
      },
      {
        id: 'b-chong',
        radical: '虫',
        code: 'B O',
        tag: '方甲贯提',
        title: '扁口压腹 · 贯竖跃提',
        insight: '扁口方折压住中腹，中竖直穿到底再以长提配顿点收锋，饱满灵动。',
        coreStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.24, y: 0.36, p: 0.76 },
              { x: 0.27, y: 0.58, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.26, y: 0.37, p: 0.68 },
              { x: 0.74, y: 0.35, p: 0.84 },
              { x: 0.71, y: 0.57, p: 0.76 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.28, y: 0.57, p: 0.7 },
              { x: 0.7, y: 0.56, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.5, y: 0.16, p: 0.84 },
              { x: 0.5, y: 0.76, p: 0.7 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.2, y: 0.82, p: 0.86 },
              { x: 0.5, y: 0.77, p: 0.64 },
              { x: 0.74, y: 0.72, p: 0.3 },
            ],
          },
          {
            points: [
              { x: 0.69, y: 0.65, p: 0.36 },
              { x: 0.82, y: 0.82, p: 0.9 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 19. N · 撇捺撑合 ====================
  {
    key: 'n',
    hand: 'R',
    row: 'bot',
    homeKey: 'J',
    fingerLabel: '右食内',
    reachLabel: '由 J 向左下斜收',
    techniqueName: '撇捺撑合',
    sealText: ['撑', '合'],
    topoSymbol: '人',
    topoInvariant: '斜倚互撑 · 八字立基',
    nodes: [
      {
        id: 'n-ren',
        radical: '人',
        code: 'N E',
        tag: '撑合母体',
        title: '一撇一捺 · 互倚立人',
        insight: '右食指向左下斜收 N 键，撇如梁、捺如柱，两笔相依互撑而顶天立地。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.16, p: 0.86 },
              { x: 0.45, y: 0.48, p: 0.66 },
              { x: 0.32, y: 0.72, p: 0.46 },
              { x: 0.15, y: 0.86, p: 0.16 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.46, y: 0.46, p: 0.54 },
              { x: 0.62, y: 0.68, p: 0.82 },
              { x: 0.86, y: 0.84, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [],
      },
      {
        id: 'n-he',
        radical: '合',
        code: 'N H E',
        tag: '人盖合口',
        title: '宽盖相撑 · 一口合声',
        insight: '撇捺升作宽阔屋顶「人字头」，其下短横承接方口，万物归拢合一。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.14, p: 0.84 },
              { x: 0.34, y: 0.34, p: 0.6 },
              { x: 0.14, y: 0.49, p: 0.16 },
            ],
          },
          {
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.18, p: 0.56 },
              { x: 0.68, y: 0.36, p: 0.8 },
              { x: 0.87, y: 0.48, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.34, y: 0.48, p: 0.74 },
              { x: 0.66, y: 0.46, p: 0.8 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.3, y: 0.61, p: 0.76 },
              { x: 0.32, y: 0.86, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.32, y: 0.62, p: 0.68 },
              { x: 0.69, y: 0.6, p: 0.84 },
              { x: 0.67, y: 0.84, p: 0.74 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.33, y: 0.84, p: 0.74 },
              { x: 0.68, y: 0.83, p: 0.8 },
            ],
          },
        ],
      },
      {
        id: 'n-xiao',
        radical: '小',
        code: 'N X A',
        tag: '双翅分撑',
        title: '中钩挺立 · 两点对称',
        insight: '撇捺化作中柱两侧对称分撑的灵动两点，一轻一重托起中锋竖钩。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.32, y: 0.4, p: 0.84 },
              { x: 0.24, y: 0.56, p: 0.56 },
              { x: 0.16, y: 0.68, p: 0.18 },
            ],
          },
          {
            points: [
              { x: 0.68, y: 0.41, p: 0.36 },
              { x: 0.78, y: 0.56, p: 0.78 },
              { x: 0.84, y: 0.68, p: 0.94 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.5, y: 0.16, p: 0.84 },
              { x: 0.5, y: 0.58, p: 0.66 },
              { x: 0.5, y: 0.84, p: 0.86 },
              { x: 0.37, y: 0.76, p: 0.2 },
            ],
          },
        ],
      },
      {
        id: 'n-zi',
        radical: '自',
        code: 'N V I',
        tag: '立壁自撑',
        title: '顶撇引壁 · 双墙自守',
        insight: '撇捺收敛为顶撇与端正双壁，内含三横稳守中宫，自成气象。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.52, y: 0.12, p: 0.84 },
              { x: 0.46, y: 0.22, p: 0.56 },
              { x: 0.42, y: 0.29, p: 0.22 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.3, p: 0.7 },
              { x: 0.71, y: 0.28, p: 0.86 },
              { x: 0.7, y: 0.84, p: 0.78 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.29, y: 0.29, p: 0.8 },
              { x: 0.3, y: 0.85, p: 0.76 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.48, p: 0.68 },
              { x: 0.69, y: 0.47, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.65, p: 0.68 },
              { x: 0.69, y: 0.64, p: 0.72 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.31, y: 0.83, p: 0.74 },
              { x: 0.69, y: 0.82, p: 0.8 },
            ],
          },
        ],
      },
    ],
  },

  // ==================== 20. M · 磔锋外趯 ====================
  {
    key: 'm',
    hand: 'R',
    row: 'bot',
    homeKey: 'J',
    fingerLabel: '右食指',
    reachLabel: '由 J 向下收按',
    techniqueName: '磔锋外趯',
    sealText: ['外', '趯'],
    topoSymbol: '╰',
    topoInvariant: '弯弧蓄劲 · 斜戈外趯',
    nodes: [
      {
        id: 'm-ge',
        radical: '戈',
        code: 'M G E',
        tag: '斜戈母体',
        title: '长戈斜趯 · 劲弧出锋',
        insight: '右食指由 J 向下收落 M 键，一道修长斜钩如弯弓蓄力，末梢陡然向上趯锋而出。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.48, y: 0.14, p: 0.86 },
              { x: 0.54, y: 0.48, p: 0.68 },
              { x: 0.68, y: 0.76, p: 0.8 },
              { x: 0.83, y: 0.85, p: 0.88 },
              { x: 0.87, y: 0.67, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.18, y: 0.42, p: 0.82 },
              { x: 0.52, y: 0.38, p: 0.58 },
              { x: 0.82, y: 0.34, p: 0.86 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.72, y: 0.46, p: 0.8 },
              { x: 0.52, y: 0.66, p: 0.56 },
              { x: 0.24, y: 0.82, p: 0.16 },
            ],
          },
          {
            points: [
              { x: 0.68, y: 0.17, p: 0.34 },
              { x: 0.78, y: 0.25, p: 0.88 },
            ],
          },
        ],
      },
      {
        id: 'm-xin',
        radical: '心',
        code: 'M X I',
        tag: '卧月托心',
        title: '仰月卧钩 · 三星飞舞',
        insight: '斜戈平卧作仰月弯钩，柔和蓄势后向左上挑出，三点错落如星光绕月。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.31, y: 0.42, p: 0.76 },
              { x: 0.34, y: 0.68, p: 0.72 },
              { x: 0.5, y: 0.79, p: 0.82 },
              { x: 0.74, y: 0.78, p: 0.88 },
              { x: 0.72, y: 0.62, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            points: [
              { x: 0.2, y: 0.48, p: 0.36 },
              { x: 0.15, y: 0.66, p: 0.86 },
            ],
          },
          {
            points: [
              { x: 0.46, y: 0.28, p: 0.34 },
              { x: 0.55, y: 0.4, p: 0.88 },
            ],
          },
          {
            points: [
              { x: 0.78, y: 0.4, p: 0.34 },
              { x: 0.88, y: 0.54, p: 0.88 },
            ],
          },
        ],
      },
      {
        id: 'm-qi',
        radical: '七',
        code: 'M I',
        tag: '横穿弯趯',
        title: '斜横破势 · 竖弯外趯',
        insight: '长斜横凌空一穿，竖弯钩圆转托底外趯而出，极简两笔便见奇崛风骨。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.45, y: 0.18, p: 0.84 },
              { x: 0.44, y: 0.66, p: 0.68 },
              { x: 0.52, y: 0.8, p: 0.78 },
              { x: 0.82, y: 0.79, p: 0.86 },
              { x: 0.86, y: 0.64, p: 0.18 },
            ],
          },
        ],
        extraStrokes: [
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.52, p: 0.84 },
              { x: 0.5, y: 0.44, p: 0.58 },
              { x: 0.82, y: 0.38, p: 0.88 },
            ],
          },
        ],
      },
      {
        id: 'm-fang',
        radical: '方',
        code: 'M F A',
        tag: '折钩回趯',
        title: '方冠横展 · 弯钩蓄趯',
        insight: '点横定顶，腹中横折钩带柔韧弯弧向下回趯，左撇舒展平衡全局。',
        coreStrokes: [
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.48, y: 0.47, p: 0.76 },
              { x: 0.72, y: 0.45, p: 0.84 },
              { x: 0.68, y: 0.72, p: 0.72 },
              { x: 0.6, y: 0.86, p: 0.84 },
              { x: 0.46, y: 0.78, p: 0.2 },
            ],
          },
        ],
        extraStrokes: [
          {
            points: [
              { x: 0.46, y: 0.14, p: 0.34 },
              { x: 0.52, y: 0.23, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            points: [
              { x: 0.16, y: 0.33, p: 0.84 },
              { x: 0.5, y: 0.3, p: 0.58 },
              { x: 0.84, y: 0.29, p: 0.88 },
            ],
          },
          {
            dunbiStart: true,
            flickEnd: true,
            points: [
              { x: 0.48, y: 0.32, p: 0.8 },
              { x: 0.4, y: 0.6, p: 0.6 },
              { x: 0.28, y: 0.78, p: 0.42 },
              { x: 0.16, y: 0.87, p: 0.16 },
            ],
          },
        ],
      },
    ],
  },
];
