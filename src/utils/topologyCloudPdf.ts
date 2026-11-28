import { jsPDF } from 'jspdf';
import {
  buildCornerConvergenceData,
  CornerConvergenceData,
} from '../data/cornerConvergence';
import { KEY_MOTOR_PROFILES } from '../data/kineticTwoBeat';
import {
  getSimpRadicalsForMorphKey,
  KeyTopologyMorphSpec,
  RadicalMorphNode,
  TWENTY_KEY_MORPH_BY_KEY,
  TWENTY_KEY_MORPHS,
} from '../data/twentyKeysMorph';
import { renderStaticConvergenceStamp } from './topologyBrushRenderer';

export const A4_EXPORT_W = 3508;
export const A4_EXPORT_H = 2480;

export interface CloudPosterRenderOptions {
  /** Logical canvas scale: 1.0 = 3508x2480 (300 DPI), 0.5 = preview */
  scale?: number;
  /** Whether to show faint decayed outer glyph strokes behind the crimson core */
  showGhostGlyph: boolean;
  /** Whether to show subtle radical watermark behind the strokes */
  showWatermark: boolean;
  /** Whether to show finger-travel arrow & home-key hint on Page 1 */
  showFingerVector: boolean;
}

const VOWEL_META: Record<string, { char: string; role: string; desc: string }> = {
  a: { char: '了', role: '润墨小码', desc: '左小指基准 · 四排高频收韵' },
  e: { char: '的', role: '润墨小码', desc: '左中指上探 · 高频润墨定字' },
  u: { char: '不', role: '润墨小码', desc: '右食指上探 · 否定收韵小码' },
  i: { char: '是', role: '润墨小码', desc: '右中指上探 · 判词收韵小码' },
  o: { char: '我', role: '润墨小码', desc: '右无名上探 · 称代收韵小码' },
  z: { char: '留', role: '留白待展', desc: '左小指下扣 · 暂留空白键位' },
};

const QWERTY_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const CONSONANT_QWERTY_ORDER: string[] = [
  'q',
  'w',
  'r',
  't',
  'y',
  'p',
  's',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  'x',
  'c',
  'v',
  'b',
  'n',
  'm',
];

const SERIF_FONT =
  '"Noto Serif SC", "Noto Serif TC", "Songti SC", "STSong", "PingFang SC", "Microsoft YaHei", serif';
const MONO_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS_FONT =
  '"Plus Jakarta Sans", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif';

const PAPER_BG = '#FAF8F2';
const PAPER_CARD = '#F5F2E9';
const PAPER_VOWEL = '#EFECE2';
const INK_DARK = '#1A1917';
const INK_SUB = '#58534B';
const INK_MUTED = '#847E74';
const CRIMSON = '#B02E24';
const AMBER = '#B86E14';
const PINE = '#1C725E';

/**
 * Draw a radical character with an explicit calligraphic fallback for Ext-B '𠂇'
 * so it never turns into a missing-glyph tofu box in exported PDFs.
 */
function drawRadicalChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  cx: number,
  cy: number,
  fontSize: number,
  color: string,
  weight: string | number = 700
) {
  if (ch === '𠂇') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const r = fontSize * 0.38;
    ctx.lineWidth = Math.max(1.5, fontSize * 0.095);
    // Horizontal bar across upper-middle
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.92, cy - r * 0.24);
    ctx.lineTo(cx + r * 0.92, cy - r * 0.24);
    ctx.stroke();
    // Swooping pie stroke down-left
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.04, cy - r * 0.92);
    ctx.quadraticCurveTo(cx - r * 0.08, cy + r * 0.14, cx - r * 0.86, cy + r * 0.88);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${fontSize}px ${SERIF_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, cx, cy);
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawXuanSheetBase(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, A4_EXPORT_W, A4_EXPORT_H);

  // Warm radial corner parchment depth
  const g1 = ctx.createRadialGradient(220, 180, 40, 220, 180, 1450);
  g1.addColorStop(0, 'rgba(184, 110, 20, 0.035)');
  g1.addColorStop(1, 'rgba(184, 110, 20, 0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, A4_EXPORT_W, A4_EXPORT_H);

  const g2 = ctx.createRadialGradient(3280, 2260, 40, 3280, 2260, 1500);
  g2.addColorStop(0, 'rgba(26, 25, 23, 0.032)');
  g2.addColorStop(1, 'rgba(26, 25, 23, 0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, A4_EXPORT_W, A4_EXPORT_H);

  // Outer archival border frame
  ctx.save();
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 36, A4_EXPORT_W - 80, A4_EXPORT_H - 72);
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(50, 46, A4_EXPORT_W - 100, A4_EXPORT_H - 92);
  ctx.restore();
}

function drawRedSealStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: string[]
) {
  ctx.save();
  ctx.fillStyle = 'rgba(176, 46, 36, 0.08)';
  ctx.strokeStyle = CRIMSON;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = CRIMSON;
  ctx.font = `700 ${Math.round(w * 0.42)}px ${SERIF_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const step = h / (lines.length + 0.35);
  lines.forEach((ch, idx) => {
    ctx.fillText(ch, x + w / 2, y + step * (idx + 0.72));
  });
  ctx.restore();
}

function drawPosterHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  sealChars: string[],
  pageLabel: string,
  opts: CloudPosterRenderOptions
) {
  drawRedSealStamp(ctx, 76, 68, 72, 114, sealChars);

  ctx.save();
  ctx.fillStyle = INK_DARK;
  ctx.font = `700 52px ${SERIF_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, 170, 68);

  ctx.fillStyle = INK_SUB;
  ctx.font = `500 23px ${SANS_FONT}`;
  ctx.fillText(subtitle, 172, 134);

  // Right-side legend & metadata block
  const rightX = A4_EXPORT_W - 76;
  ctx.textAlign = 'right';
  ctx.fillStyle = CRIMSON;
  ctx.font = `700 22px ${MONO_FONT}`;
  ctx.fillText(pageLabel, rightX, 72);

  const modeText = opts.showGhostGlyph
    ? '视图：全形残影 + 朱砂焦形'
    : '视图：纯朱砂拓扑焦形（排重检视）';
  ctx.fillStyle = INK_DARK;
  ctx.font = `600 21px ${SANS_FONT}`;
  ctx.fillText(modeText, rightX, 108);

  // Color key legend right-aligned
  const legendItems = [
    { color: CRIMSON, label: '朱砂 · 键位共性焦形' },
    { color: '#4A4640', label: '焦墨 · 字根外延残影' },
    { color: AMBER, label: '琥珀 · 顿笔 / 留白 / 孤珠' },
  ];
  let cursorX = rightX;
  const ly = 152;
  ctx.font = `500 18px ${SANS_FONT}`;
  for (let i = legendItems.length - 1; i >= 0; i--) {
    const item = legendItems[i];
    const textW = ctx.measureText(item.label).width;
    ctx.textAlign = 'right';
    ctx.fillStyle = INK_SUB;
    ctx.fillText(item.label, cursorX, ly);
    const dotX = cursorX - textW - 14;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(dotX, ly + 8, 6.5, 0, Math.PI * 2);
    ctx.fill();
    cursorX = dotX - 30;
  }

  // Divider line beneath header
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(76, 202);
  ctx.lineTo(A4_EXPORT_W - 76, 202);
  ctx.stroke();
  ctx.restore();
}

function getCanonicalConvergence(spec: KeyTopologyMorphSpec): {
  node: RadicalMorphNode;
  conv: CornerConvergenceData;
} {
  const node = spec.nodes[0];
  const conv = buildCornerConvergenceData(spec.key, node);
  return { node, conv };
}

function drawKeyCardPage1(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: CloudPosterRenderOptions
) {
  const spec = TWENTY_KEY_MORPH_BY_KEY.get(key);
  const vowel = VOWEL_META[key];

  if (!spec) {
    // Vowel / Z key card
    ctx.save();
    ctx.fillStyle = PAPER_VOWEL;
    ctx.strokeStyle = 'rgba(26, 25, 23, 0.20)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 5]);
    drawRoundedRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = INK_SUB;
    ctx.font = `700 36px ${MONO_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(key.toUpperCase(), x + 18, y + 16);

    ctx.textAlign = 'right';
    ctx.fillStyle = INK_MUTED;
    ctx.font = `600 17px ${SANS_FONT}`;
    ctx.fillText(vowel?.role ?? '润墨码', x + w - 18, y + 24);

    if (key === 'z') {
      ctx.strokeStyle = 'rgba(26, 25, 23, 0.14)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(x + 68, y + 148, w - 136, w - 136);
      ctx.setLineDash([]);
      ctx.fillStyle = INK_MUTED;
      ctx.font = `600 28px ${SERIF_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('空 · 待展', x + w / 2, y + 236);
    } else if (vowel) {
      ctx.fillStyle = 'rgba(26, 25, 23, 0.72)';
      ctx.font = `700 124px ${SERIF_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(vowel.char, x + w / 2, y + 240);
    }

    ctx.fillStyle = INK_SUB;
    ctx.font = `500 17px ${SANS_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(vowel?.desc ?? '', x + w / 2, y + 412);
    ctx.restore();
    return;
  }

  const { node: exemplar, conv } = getCanonicalConvergence(spec);
  const motor = KEY_MOTOR_PROFILES[spec.key];
  const allRadicals = getSimpRadicalsForMorphKey(spec.key);

  ctx.save();
  // Card frame
  ctx.fillStyle = PAPER_CARD;
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.22)';
  ctx.lineWidth = 1.8;
  drawRoundedRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();

  // Top header inside key card
  ctx.fillStyle = CRIMSON;
  ctx.font = `700 40px ${MONO_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(spec.key.toUpperCase(), x + 16, y + 12);

  // Technique name beside keycap letter
  ctx.fillStyle = INK_DARK;
  ctx.font = `700 20px ${SERIF_FONT}`;
  ctx.fillText(spec.techniqueName, x + 56, y + 18);

  // Top-right finger reach cue + count
  ctx.textAlign = 'right';
  if (opts.showFingerVector && motor) {
    const reachCue =
      spec.homeKey === spec.key.toUpperCase()
        ? `${spec.homeKey}原位`
        : `${spec.homeKey}→${spec.key.toUpperCase()} ${motor.arrowSymbol}`;
    ctx.fillStyle = PINE;
    ctx.font = `600 15px ${MONO_FONT}`;
    ctx.fillText(reachCue, x + w - 14, y + 14);
  }
  ctx.fillStyle = INK_MUTED;
  ctx.font = `600 14px ${MONO_FONT}`;
  ctx.fillText(`${allRadicals.length}根`, x + w - 14, y + 36);

  // Subtle horizontal separator under card title
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.11)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 58);
  ctx.lineTo(x + w - 14, y + 58);
  ctx.stroke();

  // Center canonical topological stamp
  const stampSize = 266;
  const stampX = x + (w - stampSize) / 2;
  const stampY = y + 66;

  renderStaticConvergenceStamp(ctx, conv, exemplar.radical, stampX, stampY, stampSize, {
    isWash: true,
    showPaper: true,
    showWatermark: opts.showWatermark,
    showGhostGlyph: opts.showGhostGlyph,
    ghostAlpha: 0.13,
  });

  // Thin crisp frame around the stamp
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.16)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(stampX, stampY, stampSize, stampSize);

  // Exemplar tag cleanly anchored in bottom-right of stamp box
  ctx.fillStyle = 'rgba(250, 248, 242, 0.88)';
  ctx.fillRect(stampX + stampSize - 76, stampY + stampSize - 28, 74, 26);
  ctx.fillStyle = INK_SUB;
  ctx.font = `600 14px ${SANS_FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`例「${exemplar.radical}」`, stampX + stampSize - 6, stampY + stampSize - 15);

  // Topological core label + concise rule
  const infoY = stampY + stampSize + 12;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CRIMSON;
  ctx.font = `700 20px ${SERIF_FONT}`;
  ctx.fillText(conv.shapeLabel, x + 16, infoY);

  // Wrap spec.topoInvariant cleanly within 2 lines
  ctx.fillStyle = INK_SUB;
  ctx.font = `500 15px ${SANS_FONT}`;
  const maxTextW = w - 32;
  const chars = Array.from(spec.topoInvariant);
  let line1 = '';
  let line2 = '';
  for (let i = 0; i < chars.length; i++) {
    const test = line1 + chars[i];
    if (ctx.measureText(test).width <= maxTextW) {
      line1 = test;
    } else {
      line2 = chars.slice(i).join('');
      break;
    }
  }
  ctx.fillText(line1, x + 16, infoY + 28);
  if (line2) {
    let trimmed = line2;
    while (trimmed.length > 2 && ctx.measureText(trimmed).width > maxTextW) {
      trimmed = trimmed.slice(0, -1);
    }
    ctx.fillText(trimmed, x + 16, infoY + 49);
  }

  // Divider above full simplified radical inventory
  const listTop = infoY + 76;
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.11)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 14, listTop);
  ctx.lineTo(x + w - 14, listTop);
  ctx.stroke();

  // Complete simplified radicals grid (up to 20 fit comfortably)
  const cols = allRadicals.length > 16 ? 8 : 7;
  const innerW = w - 28;
  const cellW = innerW / cols;
  const rowsCount = Math.ceil(allRadicals.length / cols);
  const availH = y + h - 10 - (listTop + 10);
  const rowPitch = Math.min(38, Math.max(29, availH / Math.max(1, rowsCount)));
  const radFontSize = rowsCount >= 3 ? 23 : 26;

  allRadicals.forEach((rad, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const rx = x + 14 + c * cellW + cellW / 2;
    const ry = listTop + 12 + r * rowPitch + rowPitch * 0.45;
    const isExemplar = rad === exemplar.radical;
    drawRadicalChar(
      ctx,
      rad,
      rx,
      ry,
      radFontSize,
      isExemplar ? CRIMSON : INK_DARK,
      isExemplar ? 700 : 500
    );
  });

  ctx.restore();
}

function drawRightRow3GuidePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.fillStyle = PAPER_VOWEL;
  ctx.strokeStyle = 'rgba(26, 25, 23, 0.18)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = INK_DARK;
  ctx.font = `700 26px ${SERIF_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('二十键拓扑造形总纲 · 排位与辨识备忘', x + 26, y + 24);

  ctx.strokeStyle = 'rgba(26, 25, 23, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 26, y + 66);
  ctx.lineTo(x + w - 26, y + 66);
  ctx.stroke();

  const notes = [
    {
      tag: '① 上排（Q W R T Y P）',
      body: '抬指上探之势：Q 正交十字 ╪、W 曲折上挑 ∿、R 双横平行 =、T 落笔一点 丶、Y 右肩横折小角 ┐、P 右廓外抱弧 ⟯。',
    },
    {
      tag: '② 中排（S D F · G H · J K L）',
      body: '基准落指之势：S 底横中竖倒丁 ┻、D 倒框开口向下 冂、F 基准单长横 ━、G 折左竖短横左开 コ、H 左肩横折 ┌、J 中右垂竖 ┫、K 竖撇成对 │、L 横右垂竖 ┣。',
    },
    {
      tag: '③ 下排（X C V B N M）',
      body: '收扣敛归之势：X 顿笔左下小折 └、C 开口朝上U形兜 ⊔、V 悬针中柱加双侧点 ·↓·、B 框内斜光留白心窗 ⬚（待细化共性）、N 撇捺人字开分 八、M 戈钩斜挑 ㇂。',
    },
    {
      tag: '④ 检视目的',
      body: '每键红形即该键「最有共性」的唯一拓扑特征；可切换「仅看纯朱砂焦形」检验 20 键两两不相混，再于第 2 页检视同键群根归纳。',
    },
  ];

  let ny = y + 86;
  notes.forEach((n) => {
    ctx.fillStyle = CRIMSON;
    ctx.font = `700 18px ${SANS_FONT}`;
    ctx.fillText(n.tag, x + 26, ny);
    ny += 28;

    ctx.fillStyle = INK_SUB;
    ctx.font = `500 16px ${SANS_FONT}`;
    const maxW = w - 52;
    const chars = Array.from(n.body);
    let line = '';
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, x + 26, ny);
        ny += 24;
        line = chars[i];
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x + 26, ny);
      ny += 24;
    }
    ny += 18;
  });

  ctx.restore();
}

function drawPureSilhouetteStrip(ctx: CanvasRenderingContext2D, yTop: number) {
  const x0 = 76;
  const totalW = A4_EXPORT_W - 152;
  const gap = 10;
  const tileW = Math.floor((totalW - gap * 19) / 20); // 158px
  const rowH = A4_EXPORT_H - 52 - yTop; // ~290px

  ctx.save();
  ctx.fillStyle = INK_DARK;
  ctx.font = `700 21px ${SERIF_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    '二十键纯朱砂焦形一字对比带（剥离外延残影 · 检验二十形互相区分度）',
    x0,
    yTop
  );

  ctx.fillStyle = INK_MUTED;
  ctx.font = `500 17px ${SANS_FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('顺序：QWERTY 键盘上→中→下三排', x0 + totalW, yTop + 3);

  const stripY = yTop + 34;
  const stampSize = tileW - 18; // 140px
  const tileH = Math.min(246, rowH - 36);

  CONSONANT_QWERTY_ORDER.forEach((key, idx) => {
    const spec = TWENTY_KEY_MORPH_BY_KEY.get(key);
    if (!spec) return;
    const { node, conv } = getCanonicalConvergence(spec);
    const tx = x0 + idx * (tileW + gap);

    ctx.fillStyle = PAPER_CARD;
    ctx.strokeStyle = 'rgba(26, 25, 23, 0.20)';
    ctx.lineWidth = 1.4;
    drawRoundedRect(ctx, tx, stripY, tileW, tileH, 10);
    ctx.fill();
    ctx.stroke();

    // Key badge + shapeSymbol
    ctx.fillStyle = CRIMSON;
    ctx.font = `700 23px ${MONO_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(spec.key.toUpperCase(), tx + 10, stripY + 8);

    ctx.fillStyle = INK_SUB;
    ctx.font = `600 16px ${MONO_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(conv.shapeSymbol, tx + tileW - 10, stripY + 10);

    const sx = tx + (tileW - stampSize) / 2;
    const sy = stripY + 38;
    renderStaticConvergenceStamp(ctx, conv, node.radical, sx, sy, stampSize, {
      isWash: true,
      showPaper: true,
      showWatermark: false,
      showGhostGlyph: false,
    });
    ctx.strokeStyle = 'rgba(26, 25, 23, 0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, stampSize, stampSize);

    // Bottom short descriptor + technique
    ctx.fillStyle = INK_DARK;
    ctx.font = `700 15px ${SERIF_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const shortName = conv.shapeLabel.split(' ')[0];
    ctx.fillText(shortName, tx + tileW / 2, sy + stampSize + 8);

    ctx.fillStyle = INK_MUTED;
    ctx.font = `500 13px ${SANS_FONT}`;
    ctx.fillText(spec.techniqueName, tx + tileW / 2, sy + stampSize + 29);
  });

  ctx.restore();
}

export function renderPage1KeyboardPoster(
  canvas: HTMLCanvasElement,
  opts: CloudPosterRenderOptions
) {
  const scale = opts.scale ?? 1;
  canvas.width = Math.round(A4_EXPORT_W * scale);
  canvas.height = Math.round(A4_EXPORT_H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawXuanSheetBase(ctx);

  drawPosterHeader(
    ctx,
    '靈明二十筆勢 · 拓撲共性鍵盤新雲圖',
    '一鍵歸納唯一拓撲焦形 · 全鍵 249 字根簡體圖譜與指法來向（A4 橫向實拍校對版）',
    ['新', '雲', '圖'],
    '第 1 頁 / 共 2 頁 · 鍵盤空間雲圖',
    opts
  );

  // Staggered 3-row QWERTY keyboard geometry inside 3508 x 2480
  const x0 = 76;
  const cardW = 316;
  const gapX = 21;
  const rowH = 624;
  const gapY = 18;
  const yStart = 218;
  const rowOffsets = [0, 148, 336];

  QWERTY_ROWS.forEach((rowKeys, rIdx) => {
    const ry = yStart + rIdx * (rowH + gapY);
    const rx0 = x0 + rowOffsets[rIdx];

    // Subtle home-row datum line behind Row 2
    if (rIdx === 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(28, 114, 94, 0.22)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(x0, ry + rowH / 2);
      ctx.lineTo(A4_EXPORT_W - 76, ry + rowH / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    rowKeys.forEach((k, cIdx) => {
      const cx = rx0 + cIdx * (cardW + gapX);
      drawKeyCardPage1(ctx, k, cx, ry, cardW, rowH, opts);
    });
  });

  // Right-side balanced editorial guide panel beside Row 3 (Z..M ends at 412 + 7*316 + 6*21 = 2750)
  const guideX = x0 + rowOffsets[2] + 7 * cardW + 6 * gapX + 26;
  const guideW = A4_EXPORT_W - 76 - guideX;
  const guideY = yStart + 2 * (rowH + gapY);
  drawRightRow3GuidePanel(ctx, guideX, guideY, guideW, rowH);

  // Bottom pure 20-key silhouette strip (y = 2146 .. 2426)
  drawPureSilhouetteStrip(ctx, yStart + 3 * rowH + 2 * gapY + 20);
}

/**
 * Pick up to 6 maximally diverse radicals per key so Page 2 exposes edge cases
 * (like multi-stroke / unusual shapes) right alongside the main archetype.
 */
export function pickDiverseExemplarsForKey(
  spec: KeyTopologyMorphSpec,
  limit = 6
): RadicalMorphNode[] {
  if (spec.nodes.length <= limit) return [...spec.nodes];
  const chosen: RadicalMorphNode[] = [spec.nodes[0]];
  const used = new Set<string>([spec.nodes[0].id]);

  // First prefer radicals with distinct tags / stroke counts / vertex quadrants
  const remaining = spec.nodes.slice(1);
  const scoreNode = (node: RadicalMorphNode, picked: RadicalMorphNode[]): number => {
    const conv = buildCornerConvergenceData(spec.key, node);
    const totalStrokes = node.coreStrokes.length + node.extraStrokes.length;
    let minDist = Infinity;
    for (const p of picked) {
      const pc = buildCornerConvergenceData(spec.key, p);
      const vDist = Math.hypot(
        conv.cornerVertex.x - pc.cornerVertex.x,
        conv.cornerVertex.y - pc.cornerVertex.y
      );
      const sDiff = Math.abs(
        totalStrokes - (p.coreStrokes.length + p.extraStrokes.length)
      ) * 0.12;
      const sameTagPenalty = node.tag === p.tag ? 0 : 0.35;
      const sameShapeBonus = conv.shapeType !== pc.shapeType ? 0.5 : 0;
      const d = vDist + sDiff + sameTagPenalty + sameShapeBonus;
      if (d < minDist) minDist = d;
    }
    return minDist;
  };

  while (chosen.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i++) {
      const s = scoreNode(remaining[i], chosen);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    const [pickedNode] = remaining.splice(bestIdx, 1);
    if (!used.has(pickedNode.id)) {
      used.add(pickedNode.id);
      chosen.push(pickedNode);
    }
  }
  return chosen;
}

export function renderPage2FamilyMatrix(
  canvas: HTMLCanvasElement,
  opts: CloudPosterRenderOptions
) {
  const scale = opts.scale ?? 1;
  canvas.width = Math.round(A4_EXPORT_W * scale);
  canvas.height = Math.round(A4_EXPORT_H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawXuanSheetBase(ctx);

  drawPosterHeader(
    ctx,
    '同鍵群根 · 一形歸納檢驗譜（20 鍵 × 多元字根斂形實證）',
    '每鍵選取最具差異之 6 枚代表字根並列收斂 · 檢驗同鍵異根是否皆能歸一',
    ['歸', '一', '譜'],
    '第 2 頁 / 共 2 頁 · 群根斂形對照',
    opts
  );

  // 5 columns x 4 rows across 3508 x 2480
  const x0 = 76;
  const y0 = 222;
  const cols = 5;
  const rows = 4;
  const gapX = 28;
  const gapY = 24;
  const colW = Math.floor((A4_EXPORT_W - 152 - gapX * (cols - 1)) / cols); // 648
  const rowH = Math.floor((A4_EXPORT_H - 52 - y0 - gapY * (rows - 1)) / rows); // 529

  CONSONANT_QWERTY_ORDER.forEach((key, idx) => {
    const spec = TWENTY_KEY_MORPH_BY_KEY.get(key);
    if (!spec) return;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const bx = x0 + col * (colW + gapX);
    const by = y0 + row * (rowH + gapY);

    ctx.save();
    ctx.fillStyle = PAPER_CARD;
    ctx.strokeStyle = 'rgba(26, 25, 23, 0.22)';
    ctx.lineWidth = 1.6;
    drawRoundedRect(ctx, bx, by, colW, rowH, 12);
    ctx.fill();
    ctx.stroke();

    const canonical = getCanonicalConvergence(spec);
    const allCount = getSimpRadicalsForMorphKey(spec.key).length;

    // Header row inside each key matrix cell
    ctx.fillStyle = CRIMSON;
    ctx.font = `700 32px ${MONO_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(spec.key.toUpperCase(), bx + 16, by + 12);

    ctx.fillStyle = INK_DARK;
    ctx.font = `700 20px ${SERIF_FONT}`;
    ctx.fillText(`${spec.techniqueName} · ${canonical.conv.shapeLabel}`, bx + 52, by + 16);

    ctx.fillStyle = INK_MUTED;
    ctx.font = `600 15px ${MONO_FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`共${allCount}根`, bx + colW - 16, by + 20);

    ctx.strokeStyle = 'rgba(26, 25, 23, 0.11)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 14, by + 54);
    ctx.lineTo(bx + colW - 14, by + 54);
    ctx.stroke();

    // 3x2 grid of converged stamps (up to 6 diverse radicals)
    const exemplars = pickDiverseExemplarsForKey(spec, 6);
    const stampSize = 180;
    const cellGapX = Math.floor((colW - 32 - stampSize * 3) / 2); // ~38
    const subRowH = 226;

    exemplars.forEach((node, nIdx) => {
      const sc = nIdx % 3;
      const sr = Math.floor(nIdx / 3);
      const sx = bx + 16 + sc * (stampSize + cellGapX);
      const sy = by + 64 + sr * subRowH;
      const conv = buildCornerConvergenceData(spec.key, node);

      renderStaticConvergenceStamp(ctx, conv, node.radical, sx, sy, stampSize, {
        isWash: true,
        showPaper: true,
        showWatermark: opts.showWatermark,
        showGhostGlyph: opts.showGhostGlyph,
        ghostAlpha: 0.14,
      });

      ctx.strokeStyle = 'rgba(26, 25, 23, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, stampSize, stampSize);

      // Radical & tag caption below each mini-stamp
      drawRadicalChar(
        ctx,
        node.radical,
        sx + 20,
        sy + stampSize + 20,
        22,
        nIdx === 0 ? CRIMSON : INK_DARK,
        700
      );

      ctx.fillStyle = INK_SUB;
      ctx.font = `500 15px ${SANS_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.tag, sx + 40, sy + stampSize + 20);

      ctx.fillStyle = INK_MUTED;
      ctx.font = `600 14px ${MONO_FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(conv.shapeSymbol, sx + stampSize - 4, sy + stampSize + 20);
    });

    ctx.restore();
  });
}

export async function exportTopologyCloudPdf(
  opts: Omit<CloudPosterRenderOptions, 'scale'> & { pages?: 'both' | 'page1' | 'page2' }
): Promise<void> {
  const mode = opts.pages ?? 'both';
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const renderOpts: CloudPosterRenderOptions = {
    scale: 1,
    showGhostGlyph: opts.showGhostGlyph,
    showWatermark: opts.showWatermark,
    showFingerVector: opts.showFingerVector,
  };

  const offscreen = document.createElement('canvas');

  if (mode === 'both' || mode === 'page1') {
    renderPage1KeyboardPoster(offscreen, renderOpts);
    const img1 = offscreen.toDataURL('image/jpeg', 0.93);
    pdf.addImage(img1, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
  }

  if (mode === 'both' || mode === 'page2') {
    if (mode === 'both') {
      pdf.addPage('a4', 'landscape');
    }
    renderPage2FamilyMatrix(offscreen, renderOpts);
    const img2 = offscreen.toDataURL('image/jpeg', 0.93);
    pdf.addImage(img2, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
  }

  const suffix = opts.showGhostGlyph ? '全形+焦形' : '纯朱砂焦形';
  const pageTag =
    mode === 'both' ? '双页全谱' : mode === 'page1' ? '第1页键盘云图' : '第2页群根检视';
  pdf.save(`灵明二十笔势-拓扑共性新云图-${suffix}-${pageTag}.pdf`);
}

export function exportPosterPng(
  page: 1 | 2,
  opts: Omit<CloudPosterRenderOptions, 'scale'>
): void {
  const offscreen = document.createElement('canvas');
  const renderOpts: CloudPosterRenderOptions = {
    scale: 1,
    showGhostGlyph: opts.showGhostGlyph,
    showWatermark: opts.showWatermark,
    showFingerVector: opts.showFingerVector,
  };
  if (page === 1) {
    renderPage1KeyboardPoster(offscreen, renderOpts);
  } else {
    renderPage2FamilyMatrix(offscreen, renderOpts);
  }
  const url = offscreen.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  const suffix = opts.showGhostGlyph ? '全形+焦形' : '纯朱砂焦形';
  link.download = `灵明二十笔势-第${page}页-${suffix}-300DPI.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function getAllTwentyKeysSummary(): Array<{
  key: string;
  techniqueName: string;
  shapeSymbol: string;
  shapeLabel: string;
  exemplar: string;
  count: number;
}> {
  return TWENTY_KEY_MORPHS.map((spec) => {
    const conv = buildCornerConvergenceData(spec.key, spec.nodes[0]);
    return {
      key: spec.key,
      techniqueName: spec.techniqueName,
      shapeSymbol: conv.shapeSymbol,
      shapeLabel: conv.shapeLabel,
      exemplar: spec.nodes[0].radical,
      count: getSimpRadicalsForMorphKey(spec.key).length,
    };
  });
}

export async function buildA4LandscapePrintDataUrls(
  opts: Omit<CloudPosterRenderOptions, 'scale'> & { pages?: 'both' | 'page1' | 'page2' }
): Promise<string[]> {
  const offscreen = document.createElement('canvas');
  const renderOpts: CloudPosterRenderOptions = {
    scale: 0.85,
    showGhostGlyph: opts.showGhostGlyph,
    showWatermark: opts.showWatermark,
    showFingerVector: opts.showFingerVector,
  };
  const urls: string[] = [];
  const mode = opts.pages ?? 'both';
  if (mode === 'both' || mode === 'page1') {
    renderPage1KeyboardPoster(offscreen, renderOpts);
    urls.push(offscreen.toDataURL('image/png'));
  }
  if (mode === 'both' || mode === 'page2') {
    renderPage2FamilyMatrix(offscreen, renderOpts);
    urls.push(offscreen.toDataURL('image/png'));
  }
  await Promise.all(
    urls.map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => undefined);
    })
  );
  return urls;
}

