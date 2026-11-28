import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BarChart3,
  Compass,
  Eye,
  EyeOff,
  Keyboard,
  Music,
  Play,
  RotateCcw,
  Scale,
  Search,
  Shuffle,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {
  computeLingmingVsKineticBenchmark,
  ENDING_VECTOR_META,
  EndingVectorId,
  HESHI_MIRROR_PAIRS,
  HOME_GROUP_ANCHORS,
  INITIAL_STROKE_META,
  InitialStrokeId,
  KINETIC_PREFIX_B_SET,
  KINETIC_PREFIX_B_SPECS,
  KineticAlternationMode,
  KineticBlockMode,
  KineticCharEntry,
  KineticKeySpec,
  KineticRadicalSpec,
  KineticRhythmMode,
  KineticStageId,
  KineticZoneId,
  OPPOSITE_DIR4_COMPASS,
  OPPOSITE_DIR8_COMPASS,
  runKineticSimulation,
  ZONE_DEFINITIONS,
} from '../data/kineticCodeSystem';
import {
  computePianoModeComparison,
  normalizeChordSignature,
  PIANO_COMFORT_KEYS,
  PIANO_CURATED_STARTERS,
  PIANO_FULL26_KEYS,
  PIANO_HOME_KEYS,
  PianoChordCharEntry,
  PianoChordMode,
  PianoChordSpec,
} from '../data/pianoChordSystem';
import {
  PURE_SHAPE_EXT_KEY_TAGS,
  PURE_SHAPE_LEFT_FAMILIES,
  PURE_SHAPE_LEFT_MAP,
  PURE_SHAPE_RIGHT_ENDINGS,
  PURE_SHAPE_RIGHT_MAP,
  PURE_SHAPE_SOLO_26_BY_KEY,
  PURE_SHAPE_SOLO_BY_KEY,
  PureShapeLeftKey,
  PureShapeRightKey,
} from '../data/pureShapeRadicals';
import { SCRIPT_MODE_OPTIONS, ScriptMode } from '../data/scriptFilter';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';
import { speech } from '../audio/speech';

interface KineticVerificationLabProps {
  scriptMode: ScriptMode;
  onChangeScriptMode: (next: ScriptMode) => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
}

type LabTab = 'piano' | 'practice' | 'atlas' | 'audit' | 'benchmark';

// Visual QWERTY coordinate map for clean ergonomic rendering (col 0..9, row 0..2)
const FULL_QWERTY_ROWS: Array<Array<{ key: string; hand: 'L' | 'R' }>> = [
  [
    { key: 'q', hand: 'L' },
    { key: 'w', hand: 'L' },
    { key: 'e', hand: 'L' },
    { key: 'r', hand: 'L' },
    { key: 't', hand: 'L' },
    { key: 'y', hand: 'R' },
    { key: 'u', hand: 'R' },
    { key: 'i', hand: 'R' },
    { key: 'o', hand: 'R' },
    { key: 'p', hand: 'R' },
  ],
  [
    { key: 'a', hand: 'L' },
    { key: 's', hand: 'L' },
    { key: 'd', hand: 'L' },
    { key: 'f', hand: 'L' },
    { key: 'g', hand: 'L' },
    { key: 'h', hand: 'R' },
    { key: 'j', hand: 'R' },
    { key: 'k', hand: 'R' },
    { key: 'l', hand: 'R' },
  ],
  [
    { key: 'z', hand: 'L' },
    { key: 'x', hand: 'L' },
    { key: 'c', hand: 'L' },
    { key: 'v', hand: 'L' },
    { key: 'b', hand: 'L' },
    { key: 'n', hand: 'R' },
    { key: 'm', hand: 'R' },
  ],
];

const ROW_STAGGER_PX = [0, 18, 42];
const KEY_PITCH_X = 56;
const KEY_PITCH_Y = 56;
const KEY_W = 48;
const KEY_H = 46;

function getKeyCenter(keyChar: string): { x: number; y: number } | null {
  for (let r = 0; r < FULL_QWERTY_ROWS.length; r++) {
    const row = FULL_QWERTY_ROWS[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c].key === keyChar) {
        const extraGap = row[c].hand === 'R' ? 22 : 0;
        const x = 16 + ROW_STAGGER_PX[r] + c * KEY_PITCH_X + extraGap + KEY_W / 2;
        const y = 16 + r * KEY_PITCH_Y + KEY_H / 2;
        return { x, y };
      }
    }
  }
  return null;
}

interface Vec2 {
  x: number;
  y: number;
}

interface TangentSpec {
  inVec: Vec2;
  outVec: Vec2;
  yOffset: number;
}

const ORIGIN_TANGENTS: Record<InitialStrokeId, TangentSpec> = {
  heng: { inVec: { x: 1.0, y: 0.0 }, outVec: { x: 1.0, y: -0.04 }, yOffset: 0 },
  shu: { inVec: { x: 0.16, y: 0.98 }, outVec: { x: 0.34, y: 0.94 }, yOffset: -6 },
  pie: { inVec: { x: -0.58, y: 0.81 }, outVec: { x: -0.36, y: 0.92 }, yOffset: -12 },
  dian: { inVec: { x: 0.62, y: 0.78 }, outVec: { x: 0.68, y: 0.74 }, yOffset: -16 },
  zhe: { inVec: { x: 0.86, y: -0.5 }, outVec: { x: 0.82, y: -0.56 }, yOffset: -8 },
};

const ENDING_TANGENTS: Record<EndingVectorId, TangentSpec> = {
  up_gather: { inVec: { x: 0.65, y: -0.76 }, outVec: { x: 0.25, y: -0.96 }, yOffset: -42 },
  up_lift: { inVec: { x: 0.85, y: -0.52 }, outVec: { x: 0.9, y: -0.45 }, yOffset: -34 },
  up_right_open: { inVec: { x: 0.76, y: -0.65 }, outVec: { x: 0.92, y: -0.38 }, yOffset: -38 },
  up_right_far: { inVec: { x: 0.68, y: -0.73 }, outVec: { x: 0.94, y: -0.56 }, yOffset: -46 },
  center_close: { inVec: { x: 0.42, y: 0.76 }, outVec: { x: -0.82, y: 0.28 }, yOffset: 2 },
  center_settle: { inVec: { x: 0.99, y: 0.08 }, outVec: { x: 0.96, y: 0.0 }, yOffset: 0 },
  center_spread: { inVec: { x: 0.92, y: 0.32 }, outVec: { x: 0.88, y: 0.42 }, yOffset: 8 },
  right_extend: { inVec: { x: 0.99, y: 0.06 }, outVec: { x: 1.1, y: 0.0 }, yOffset: 2 },
  down_plumb: { inVec: { x: 0.18, y: 0.98 }, outVec: { x: 0.08, y: 1.0 }, yOffset: 40 },
  down_splay: { inVec: { x: 0.62, y: 0.78 }, outVec: { x: 0.82, y: 0.68 }, yOffset: 44 },
};

interface FlowNode {
  keyIdx: number;
  radicalIdx: number;
  radical: string;
  keySpec: KineticKeySpec;
  role: 'origin' | 'ending' | 'heshi';
  originStroke: InitialStrokeId;
  endingVector: EndingVectorId;
  x: number;
  y: number;
  cue: string;
}

interface FlowSegment {
  idx: number;
  kind: 'intra' | 'bridge';
  fromNode: FlowNode;
  toNode: FlowNode;
  d: string;
  label: string;
}

function buildCubicBezierPath(
  p1: Vec2,
  p2: Vec2,
  outDir: Vec2,
  inDir: Vec2,
  scale = 0.42,
  clampBounds?: { minX: number; maxX: number; minY: number; maxY: number }
): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 4) {
    // Self-loop teardrop curve when consecutive keys repeat
    const loopW = 26;
    const loopH = p1.y > 70 ? -38 : 38;
    return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${(p1.x - loopW).toFixed(1)} ${(p1.y + loopH).toFixed(1)}, ${(p1.x + loopW).toFixed(1)} ${(p1.y + loopH).toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  const handle = Math.max(24, Math.min(76, dist * scale));
  let c1x = p1.x + outDir.x * handle;
  let c1y = p1.y + outDir.y * handle;
  let c2x = p2.x - inDir.x * handle;
  let c2y = p2.y - inDir.y * handle;

  if (clampBounds) {
    c1x = Math.max(clampBounds.minX, Math.min(clampBounds.maxX, c1x));
    c1y = Math.max(clampBounds.minY, Math.min(clampBounds.maxY, c1y));
    c2x = Math.max(clampBounds.minX, Math.min(clampBounds.maxX, c2x));
    c2y = Math.max(clampBounds.minY, Math.min(clampBounds.maxY, c2y));
  }

  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

function buildIntentFlowModel(
  entry: KineticCharEntry,
  rhythmMode: KineticRhythmMode
): {
  nodes: FlowNode[];
  segments: FlowSegment[];
  entryTailD: string;
  exitTailD: string;
  radicalGroups: Array<{
    radicalIdx: number;
    radical: string;
    x1: number;
    x2: number;
    originStroke: InitialStrokeId;
    endingVector: EndingVectorId;
  }>;
} {
  const rads = entry.radicals;
  const keys = entry.keySpecs;
  const rawNodes: Array<Omit<FlowNode, 'x' | 'y'>> = [];

  if (rhythmMode === 'heshi_1k') {
    for (let i = 0; i < Math.min(keys.length, rads.length); i++) {
      const r = rads[i];
      rawNodes.push({
        keyIdx: i,
        radicalIdx: i,
        radical: r.radical,
        keySpec: keys[i],
        role: 'heshi',
        originStroke: r.originStroke,
        endingVector: r.endingVector,
        cue: r.heshiCue,
      });
    }
  } else if (rhythmMode === 'heshi_compact') {
    if (rads.length === 1 && keys.length >= 2) {
      const r0 = rads[0];
      rawNodes.push(
        {
          keyIdx: 0,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[0],
          role: 'origin',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: `${INITIAL_STROKE_META[r0.originStroke].symbol}起`,
        },
        {
          keyIdx: 1,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[1],
          role: 'ending',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: ENDING_VECTOR_META[r0.endingVector].short,
        }
      );
    } else if (rads.length === 2 && keys.length >= 3) {
      const r0 = rads[0];
      const r1 = rads[1];
      rawNodes.push(
        {
          keyIdx: 0,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[0],
          role: 'origin',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: `${INITIAL_STROKE_META[r0.originStroke].symbol}起`,
        },
        {
          keyIdx: 1,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[1],
          role: 'ending',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: ENDING_VECTOR_META[r0.endingVector].short,
        },
        {
          keyIdx: 2,
          radicalIdx: 1,
          radical: r1.radical,
          keySpec: keys[2],
          role: 'heshi',
          originStroke: r1.originStroke,
          endingVector: r1.endingVector,
          cue: r1.heshiCue,
        }
      );
    } else {
      for (let i = 0; i < Math.min(keys.length, rads.length); i++) {
        const r = rads[i];
        rawNodes.push({
          keyIdx: i,
          radicalIdx: i,
          radical: r.radical,
          keySpec: keys[i],
          role: 'heshi',
          originStroke: r.originStroke,
          endingVector: r.endingVector,
          cue: r.heshiCue,
        });
      }
    }
  } else if (rhythmMode === 'event_stream') {
    for (let i = 0; i < keys.length; i++) {
      const rIdx = Math.min(rads.length - 1, Math.floor(i / 2));
      const r = rads[rIdx];
      const isOrigin = i % 2 === 0;
      rawNodes.push({
        keyIdx: i,
        radicalIdx: rIdx,
        radical: r.radical,
        keySpec: keys[i],
        role: isOrigin ? 'origin' : 'ending',
        originStroke: r.originStroke,
        endingVector: r.endingVector,
        cue: isOrigin
          ? `${INITIAL_STROKE_META[r.originStroke].symbol}起`
          : ENDING_VECTOR_META[r.endingVector].short,
      });
    }
  } else {
    // fixed4
    if (rads.length === 1 && keys.length >= 2) {
      const r0 = rads[0];
      rawNodes.push(
        {
          keyIdx: 0,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[0],
          role: 'origin',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: `${INITIAL_STROKE_META[r0.originStroke].symbol}起`,
        },
        {
          keyIdx: 1,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[1],
          role: 'ending',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: ENDING_VECTOR_META[r0.endingVector].short,
        }
      );
    } else if (rads.length === 2 && keys.length >= 4) {
      const r0 = rads[0];
      const r1 = rads[1];
      rawNodes.push(
        {
          keyIdx: 0,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[0],
          role: 'origin',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: `${INITIAL_STROKE_META[r0.originStroke].symbol}起`,
        },
        {
          keyIdx: 1,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[1],
          role: 'ending',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: ENDING_VECTOR_META[r0.endingVector].short,
        },
        {
          keyIdx: 2,
          radicalIdx: 1,
          radical: r1.radical,
          keySpec: keys[2],
          role: 'origin',
          originStroke: r1.originStroke,
          endingVector: r1.endingVector,
          cue: `${INITIAL_STROKE_META[r1.originStroke].symbol}起`,
        },
        {
          keyIdx: 3,
          radicalIdx: 1,
          radical: r1.radical,
          keySpec: keys[3],
          role: 'ending',
          originStroke: r1.originStroke,
          endingVector: r1.endingVector,
          cue: ENDING_VECTOR_META[r1.endingVector].short,
        }
      );
    } else if (rads.length >= 3 && keys.length >= 4) {
      const r0 = rads[0];
      const r1 = rads[1];
      const rLast = rads[rads.length - 1];
      rawNodes.push(
        {
          keyIdx: 0,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[0],
          role: 'origin',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: `${INITIAL_STROKE_META[r0.originStroke].symbol}起`,
        },
        {
          keyIdx: 1,
          radicalIdx: 0,
          radical: r0.radical,
          keySpec: keys[1],
          role: 'ending',
          originStroke: r0.originStroke,
          endingVector: r0.endingVector,
          cue: ENDING_VECTOR_META[r0.endingVector].short,
        },
        {
          keyIdx: 2,
          radicalIdx: 1,
          radical: r1.radical,
          keySpec: keys[2],
          role: 'origin',
          originStroke: r1.originStroke,
          endingVector: r1.endingVector,
          cue: `${INITIAL_STROKE_META[r1.originStroke].symbol}起`,
        },
        {
          keyIdx: 3,
          radicalIdx: rads.length - 1,
          radical: rLast.radical,
          keySpec: keys[3],
          role: 'ending',
          originStroke: rLast.originStroke,
          endingVector: rLast.endingVector,
          cue: ENDING_VECTOR_META[rLast.endingVector].short,
        }
      );
    }
  }

  const count = rawNodes.length;
  const centerY = 86;
  const minX = count === 1 ? 320 : count === 2 ? 175 : count === 3 ? 120 : 88;
  const maxX = count === 1 ? 320 : count === 2 ? 465 : count === 3 ? 520 : 552;

  const nodes: FlowNode[] = rawNodes.map((n, idx) => {
    const x = count === 1 ? 320 : minX + ((maxX - minX) * idx) / (count - 1);
    const originT = ORIGIN_TANGENTS[n.originStroke];
    const endT = ENDING_TANGENTS[n.endingVector];
    let yOffset = 0;
    if (n.role === 'origin') {
      const rowShift = n.keySpec.row === 'top' ? -14 : n.keySpec.row === 'bot' ? 14 : 0;
      yOffset = originT.yOffset + rowShift * 0.6;
    } else if (n.role === 'ending') {
      yOffset = endT.yOffset;
    } else {
      yOffset = originT.yOffset * 0.35 + endT.yOffset * 0.65;
    }
    return {
      ...n,
      x,
      y: Math.max(32, Math.min(138, centerY + yOffset)),
    };
  });

  const segments: FlowSegment[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const kind: 'intra' | 'bridge' = a.radicalIdx === b.radicalIdx ? 'intra' : 'bridge';

    const outVec =
      kind === 'intra'
        ? ORIGIN_TANGENTS[a.originStroke].outVec
        : ENDING_TANGENTS[a.endingVector].outVec;
    const inVec =
      kind === 'intra'
        ? ENDING_TANGENTS[b.endingVector].inVec
        : b.role === 'origin'
          ? ORIGIN_TANGENTS[b.originStroke].inVec
          : ENDING_TANGENTS[b.endingVector].inVec;

    const d = buildCubicBezierPath(
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
      outVec,
      inVec,
      kind === 'intra' ? 0.44 : 0.38
    );

    const label =
      kind === 'intra'
        ? `${a.radical} · ${INITIAL_STROKE_META[a.originStroke].symbol}起 → ${ENDING_VECTOR_META[b.endingVector].short}`
        : `${a.radical}(${ENDING_VECTOR_META[a.endingVector].short}) 渡氣 → ${b.radical}(${INITIAL_STROKE_META[b.originStroke].symbol}起)`;

    segments.push({ idx: i, kind, fromNode: a, toNode: b, d, label });
  }

  let entryTailD = '';
  let exitTailD = '';
  if (nodes.length > 0) {
    const first = nodes[0];
    const firstIn = ORIGIN_TANGENTS[first.originStroke].inVec;
    const pStart = {
      x: Math.max(22, first.x - 56 * Math.max(0.35, Math.abs(firstIn.x))),
      y: Math.max(26, Math.min(142, first.y - 44 * firstIn.y)),
    };
    entryTailD = buildCubicBezierPath(pStart, { x: first.x, y: first.y }, firstIn, firstIn, 0.38);

    const last = nodes[nodes.length - 1];
    const lastOut = ENDING_TANGENTS[last.endingVector].outVec;
    const pEnd = {
      x: Math.max(24, Math.min(618, last.x + 56 * lastOut.x)),
      y: Math.max(24, Math.min(144, last.y + 42 * lastOut.y)),
    };
    exitTailD = buildCubicBezierPath({ x: last.x, y: last.y }, pEnd, lastOut, lastOut, 0.38);
  }

  const groupMap = new Map<
    number,
    {
      radicalIdx: number;
      radical: string;
      x1: number;
      x2: number;
      originStroke: InitialStrokeId;
      endingVector: EndingVectorId;
    }
  >();
  for (const n of nodes) {
    const existing = groupMap.get(n.radicalIdx);
    if (!existing) {
      groupMap.set(n.radicalIdx, {
        radicalIdx: n.radicalIdx,
        radical: n.radical,
        x1: n.x,
        x2: n.x,
        originStroke: n.originStroke,
        endingVector: n.endingVector,
      });
    } else {
      existing.x1 = Math.min(existing.x1, n.x);
      existing.x2 = Math.max(existing.x2, n.x);
    }
  }

  return {
    nodes,
    segments,
    entryTailD,
    exitTailD,
    radicalGroups: [...groupMap.values()],
  };
}

const STAGE_OPTIONS: Array<{ id: KineticStageId; label: string; hint: string }> = [
  { id: 'starter12', label: '一階 · 12 基根起手', hint: '以最高頻 12 個字根組成約 45 個入門字' },
  { id: 'core48', label: '二階 · 48 常根 ~300 字', hint: '覆蓋日常核心 300 常用漢字' },
  { id: 'common500', label: '三階 · 常用 500 字', hint: '高頻 500 常用字交替實測' },
  { id: 'full1448', label: '全庫 · 千字壓力測試', hint: '涵蓋 1,000+ 繁簡古今全拆字庫' },
];

export const KineticVerificationLab: React.FC<KineticVerificationLabProps> = ({
  scriptMode,
  onChangeScriptMode,
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBack,
}) => {
  const t = useUiText();
  const isWash = themeMode === 'wash';

  const [zoneId, setZoneId] = useState<KineticZoneId>('kinetic_prefix22');
  const [altMode, setAltMode] = useState<KineticAlternationMode>('bidirectional');
  const [blockMode, setBlockMode] = useState<KineticBlockMode>('yuhao');
  const [rhythmMode, setRhythmMode] = useState<KineticRhythmMode>('fixed4');
  const [stageId, setStageId] = useState<KineticStageId>('common500');
  const [activeTab, setActiveTab] = useState<LabTab>('piano');

  const [blindMode, setBlindMode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeStrokeFilter, setActiveStrokeFilter] = useState<InitialStrokeId | 'all'>('all');
  const [activeHomeFilter, setActiveHomeFilter] = useState<string>('all');
  const [activePrefixFilter, setActivePrefixFilter] = useState<'all' | 'xiao' | 'da' | 'home' | 'top' | 'bot'>('all');
  const [inspectedRadical, setInspectedRadical] = useState<string | null>(null);

  // Piano Chord (同時並擊 · 不分順序) Lab State
  const [pianoChordMode, setPianoChordMode] = useState<PianoChordMode>('dyad_unique');
  const [pianoWholeSecondBeat, setPianoWholeSecondBeat] = useState<boolean>(true);
  const [pianoPlayMode, setPianoPlayMode] = useState<'drill' | 'freeplay'>('drill');
  const [pianoSoundOn, setPianoSoundOn] = useState<boolean>(true);
  const [pianoCharIdx, setPianoCharIdx] = useState<number>(0);
  const [pianoBeatIdx, setPianoBeatIdx] = useState<number>(0);
  const [pianoHeldKeys, setPianoHeldKeys] = useState<string[]>([]);
  const [pianoBufferKeys, setPianoBufferKeys] = useState<string[]>([]);
  const [pianoBeatsHit, setPianoBeatsHit] = useState<number>(0);
  const [pianoBeatsMissed, setPianoBeatsMissed] = useState<number>(0);
  const [pianoCombo, setPianoCombo] = useState<number>(0);
  const [pianoCompletedChars, setPianoCompletedChars] = useState<Set<string>>(() => new Set());
  const [pianoSelectedHomeFilter, setPianoSelectedHomeFilter] = useState<string>('all');
  const [pianoLastEvent, setPianoLastEvent] = useState<{
    signature: string;
    keys: string[];
    matchedChord: PianoChordSpec | null;
    matchedSiblings: PianoChordSpec[];
    status: 'hit' | 'char_done' | 'miss' | 'free';
    completedChar?: string;
    expectedChord?: PianoChordSpec;
  } | null>(null);
  const pianoHeldRef = useRef<Set<string>>(new Set());
  const pianoBufferRef = useRef<Set<string>>(new Set());

  const isKineticPrefixMode = zoneId === 'kinetic_prefix22';
  const isThreeRowMode = zoneId === 'three_row_dir8' || zoneId === 'three_row_full26';
  const isHomeDirMode = isThreeRowMode || zoneId === 'home_dir8' || zoneId === 'home_dir4';

  // Typing drill state
  const [deckOrder, setDeckOrder] = useState<number[]>([]);
  const [cursorIdx, setCursorIdx] = useState<number>(0);
  const [typed, setTyped] = useState<string>('');
  const [errorFlash, setErrorFlash] = useState<boolean>(false);
  const [combo, setCombo] = useState<number>(0);
  const [hits, setHits] = useState<number>(0);
  const [misses, setMisses] = useState<number>(0);
  const [completedChars, setCompletedChars] = useState<Set<string>>(() => new Set());
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const [hoveredFlowStep, setHoveredFlowStep] = useState<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const replayTimerRef = useRef<number | null>(null);

  const sim = useMemo(
    () => runKineticSimulation(zoneId, altMode, stageId, scriptMode, blockMode, rhythmMode),
    [zoneId, altMode, stageId, scriptMode, blockMode, rhythmMode]
  );

  const benchmark = useMemo(
    () => computeLingmingVsKineticBenchmark(stageId, scriptMode),
    [stageId, scriptMode]
  );

  const pianoComparison = useMemo(
    () => computePianoModeComparison(stageId, scriptMode, pianoWholeSecondBeat),
    [stageId, scriptMode, pianoWholeSecondBeat]
  );

  const pianoSim =
    pianoChordMode === 'dyad_unique'
      ? pianoComparison.dyadUnique
      : pianoChordMode === 'dyad_intuitive'
        ? pianoComparison.dyadIntuitive
        : pianoChordMode === 'dyad_balanced'
          ? pianoComparison.dyadBalanced
          : pianoComparison.triadUnique;

  const pianoDeckChars = useMemo<PianoChordCharEntry[]>(() => {
    const starterRank = new Map<string, number>();
    PIANO_CURATED_STARTERS.forEach((ch, idx) => starterRank.set(ch, idx));
    return [...pianoSim.chars].sort((a, b) => {
      const ra = starterRank.get(a.char);
      const rb = starterRank.get(b.char);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      if (a.hasOnlyEasyBeats !== b.hasOnlyEasyBeats) return a.hasOnlyEasyBeats ? -1 : 1;
      if (a.beatCount !== b.beatCount) return a.beatCount - b.beatCount;
      return 0;
    });
  }, [pianoSim.chars]);

  const currentPianoChar: PianoChordCharEntry | null =
    pianoDeckChars[pianoCharIdx] || pianoDeckChars[0] || null;
  const currentPianoBeat: PianoChordSpec | null =
    currentPianoChar?.beats[pianoBeatIdx] || currentPianoChar?.beats[0] || null;

  useEffect(() => {
    setPianoCharIdx(0);
    setPianoBeatIdx(0);
    setPianoLastEvent(null);
    setPianoCompletedChars(new Set());
  }, [pianoDeckChars]);

  // Keep deck order synced when stage/script changes
  useEffect(() => {
    setDeckOrder(sim.chars.map((_, idx) => idx));
    setCursorIdx(0);
    setTyped('');
    setReplayStep(null);
    setHoveredFlowStep(null);
    setErrorFlash(false);
    setCompletedChars(new Set());
  }, [sim.chars]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      if (replayTimerRef.current) window.clearInterval(replayTimerRef.current);
    };
  }, []);

  const orderedChars = useMemo(() => {
    if (deckOrder.length !== sim.chars.length) return sim.chars;
    return deckOrder.map((i) => sim.chars[i]).filter(Boolean);
  }, [deckOrder, sim.chars]);

  const currentCharEntry: KineticCharEntry | null =
    orderedChars[cursorIdx] || orderedChars[0] || null;

  const activeKeySet = useMemo(
    () => new Set(sim.keys.map((k) => k.key)),
    [sim.keys]
  );

  const keySpecByChar = useMemo(() => {
    const map = new Map<string, KineticKeySpec>();
    for (const k of sim.keys) map.set(k.key, k);
    return map;
  }, [sim.keys]);

  const mirrorMap = useMemo(() => {
    const map = new Map<string, { partner: string; expansion: string }>();
    for (const pair of HESHI_MIRROR_PAIRS) {
      map.set(pair.leftKey, { partner: pair.rightKey, expansion: pair.expansionLabel });
      map.set(pair.rightKey, { partner: pair.leftKey, expansion: pair.expansionLabel });
    }
    return map;
  }, []);

  // Determine which radical gesture is currently active on the keyboard diagram
  const activeGesturePreview = useMemo<{
    k1: KineticKeySpec;
    k2: KineticKeySpec;
    label: string;
    qiLabel: string;
    stepOffset: number;
    isSingleHeshi: boolean;
    mirrorKey?: string;
  } | null>(() => {
    if (activeTab === 'atlas' && inspectedRadical) {
      const r = sim.radicalMap.get(inspectedRadical);
      if (r) {
        const useHeshi = rhythmMode === 'heshi_1k';
        return {
          k1: useHeshi ? r.heshiKey : r.key1,
          k2: useHeshi ? r.heshiKey : r.key2,
          label: r.radical,
          qiLabel: useHeshi ? r.heshiCue : `${r.intentCue} · 合十(${r.heshiKey.key.toUpperCase()})`,
          stepOffset: 0,
          isSingleHeshi: useHeshi,
          mirrorKey: useHeshi ? mirrorMap.get(r.heshiKey.key)?.partner : undefined,
        };
      }
    }
    if (!currentCharEntry) return null;
    const rads = currentCharEntry.radicals;
    if (rads.length === 0) return null;

    if (rhythmMode === 'heshi_1k') {
      const activeRad = rads[Math.min(rads.length - 1, typed.length)];
      return {
        k1: activeRad.heshiKey,
        k2: activeRad.heshiKey,
        label: activeRad.radical,
        qiLabel: activeRad.heshiCue,
        stepOffset: 0,
        isSingleHeshi: true,
        mirrorKey: mirrorMap.get(activeRad.heshiKey.key)?.partner,
      };
    }

    if (rhythmMode === 'heshi_compact') {
      if (rads.length === 1) {
        const r0 = rads[0];
        return {
          k1: r0.key1,
          k2: r0.key2,
          label: r0.radical,
          qiLabel: r0.intentCue,
          stepOffset: typed.length,
          isSingleHeshi: false,
        };
      }
      if (rads.length === 2) {
        if (typed.length < 2) {
          const r0 = rads[0];
          return {
            k1: r0.key1,
            k2: r0.key2,
            label: r0.radical,
            qiLabel: r0.intentCue,
            stepOffset: typed.length,
            isSingleHeshi: false,
          };
        }
        const r1 = rads[1];
        return {
          k1: r1.heshiKey,
          k2: r1.heshiKey,
          label: r1.radical,
          qiLabel: r1.heshiCue,
          stepOffset: 0,
          isSingleHeshi: true,
          mirrorKey: mirrorMap.get(r1.heshiKey.key)?.partner,
        };
      }
      const activeRad = rads[Math.min(rads.length - 1, typed.length)];
      return {
        k1: activeRad.heshiKey,
        k2: activeRad.heshiKey,
        label: activeRad.radical,
        qiLabel: activeRad.heshiCue,
        stepOffset: 0,
        isSingleHeshi: true,
        mirrorKey: mirrorMap.get(activeRad.heshiKey.key)?.partner,
      };
    }

    if (rhythmMode === 'event_stream') {
      const eventIdx = Math.min(rads.length - 1, Math.floor(typed.length / 2));
      const activeRad = rads[eventIdx];
      return {
        k1: activeRad.key1,
        k2: activeRad.key2,
        label: activeRad.radical,
        qiLabel: activeRad.intentCue,
        stepOffset: typed.length % 2,
        isSingleHeshi: false,
      };
    }

    if (currentCharEntry.keySpecs.length === 2 || typed.length < 2) {
      const r0 = rads[0];
      return {
        k1: r0.key1,
        k2: r0.key2,
        label: r0.radical,
        qiLabel: r0.intentCue,
        stepOffset: typed.length,
        isSingleHeshi: false,
      };
    }

    if (rads.length === 2) {
      const r1 = rads[1];
      return {
        k1: r1.key1,
        k2: r1.key2,
        label: r1.radical,
        qiLabel: r1.intentCue,
        stepOffset: typed.length - 2,
        isSingleHeshi: false,
      };
    }

    const rLast = rads[rads.length - 1];
    return {
      k1: rads[1].key1,
      k2: rLast.key2,
      label: `${rads[1].radical}→${rLast.radical}`,
      qiLabel: `${INITIAL_STROKE_META[rads[1].originStroke].symbol}起(${rads[1].key1.key.toUpperCase()}) → ${ENDING_VECTOR_META[rLast.endingVector].short}(${rLast.key2.key.toUpperCase()})`,
      stepOffset: typed.length - 2,
      isSingleHeshi: false,
    };
  }, [activeTab, inspectedRadical, sim.radicalMap, currentCharEntry, typed.length, rhythmMode, mirrorMap]);

  const shuffleDeck = useCallback(() => {
    synth.playClick();
    const arr = sim.chars.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setDeckOrder(arr);
    setCursorIdx(0);
    setTyped('');
    setErrorFlash(false);
  }, [sim.chars]);

  const resetProgress = useCallback(() => {
    synth.playClick();
    setDeckOrder(sim.chars.map((_, i) => i));
    setCursorIdx(0);
    setTyped('');
    setErrorFlash(false);
    setCombo(0);
    setHits(0);
    setMisses(0);
    setCompletedChars(new Set());
  }, [sim.chars]);

  const jumpToChar = useCallback(
    (ch: string) => {
      if (activeTab === 'piano') {
        const pIdx = pianoDeckChars.findIndex((c) => c.char === ch);
        if (pIdx >= 0) {
          synth.playClick();
          setPianoCharIdx(pIdx);
          setPianoBeatIdx(0);
          setPianoLastEvent(null);
          setPianoPlayMode('drill');
        }
        return;
      }
      const idx = orderedChars.findIndex((c) => c.char === ch);
      if (idx >= 0) {
        synth.playClick();
        setCursorIdx(idx);
        setTyped('');
        setErrorFlash(false);
        setActiveTab('practice');
      }
    },
    [activeTab, orderedChars, pianoDeckChars]
  );

  // Commit an order-independent simultaneous piano chord (called on release-all or via simulated button)
  const commitPianoChord = useCallback(
    (rawKeys: string[]) => {
      const sig = normalizeChordSignature(rawKeys);
      if (!sig) return;
      const keys = sig.split('+');
      const matchedSiblings = pianoSim.chordsBySignature.get(sig) ?? [];
      const matched = matchedSiblings[0] ?? null;

      if (pianoPlayMode === 'freeplay') {
        synth.playPianoChord(keys, matchedSiblings.length > 0, pianoSoundOn);
        setPianoLastEvent({
          signature: sig,
          keys,
          matchedChord: matched,
          matchedSiblings,
          status: 'free',
        });
        return;
      }

      if (!currentPianoChar || !currentPianoBeat) return;

      if (sig === currentPianoBeat.signature) {
        const isLastBeat = pianoBeatIdx + 1 >= currentPianoChar.beats.length;
        synth.playPianoChord(keys, isLastBeat, pianoSoundOn);
        setPianoBeatsHit((h) => h + 1);
        setPianoCombo((c) => c + 1);

        if (isLastBeat) {
          if (!muted) speech.speakGlyph(currentPianoChar.char);
          setPianoCompletedChars((prev) => {
            const next = new Set(prev);
            next.add(currentPianoChar.char);
            return next;
          });
          setPianoLastEvent({
            signature: sig,
            keys,
            matchedChord: currentPianoBeat,
            matchedSiblings,
            status: 'char_done',
            completedChar: currentPianoChar.char,
          });
          setPianoBeatIdx(0);
          setPianoCharIdx((i) => (i + 1) % Math.max(1, pianoDeckChars.length));
        } else {
          setPianoLastEvent({
            signature: sig,
            keys,
            matchedChord: currentPianoBeat,
            matchedSiblings,
            status: 'hit',
          });
          setPianoBeatIdx((b) => b + 1);
        }
      } else {
        synth.playKeyMiss();
        setPianoBeatsMissed((m) => m + 1);
        setPianoCombo(0);
        setPianoLastEvent({
          signature: sig,
          keys,
          matchedChord: matched,
          matchedSiblings,
          status: 'miss',
          expectedChord: currentPianoBeat,
        });
      }
    },
    [
      currentPianoBeat,
      currentPianoChar,
      muted,
      pianoBeatIdx,
      pianoDeckChars.length,
      pianoPlayMode,
      pianoSim.chordsBySignature,
      pianoSoundOn,
    ]
  );

  // Order-independent Piano Chord physical keyboard engine (keydown accumulates chord, release-all commits!)
  useEffect(() => {
    if (activeTab !== 'piano') {
      pianoHeldRef.current.clear();
      pianoBufferRef.current.clear();
      setPianoHeldKeys([]);
      setPianoBufferKeys([]);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        pianoHeldRef.current.clear();
        pianoBufferRef.current.clear();
        setPianoHeldKeys([]);
        setPianoBufferKeys([]);
        setPianoBeatIdx(0);
        setPianoLastEvent(null);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setPianoBeatIdx((b) => Math.max(0, b - 1));
        return;
      }
      if (pianoPlayMode === 'drill' && (e.key === 'ArrowRight' || e.key === 'Tab')) {
        e.preventDefault();
        setPianoCharIdx((i) => (i + 1) % Math.max(1, pianoDeckChars.length));
        setPianoBeatIdx(0);
        setPianoLastEvent(null);
        return;
      }
      if (pianoPlayMode === 'drill' && e.key === 'ArrowLeft') {
        e.preventDefault();
        setPianoCharIdx(
          (i) => (i - 1 + Math.max(1, pianoDeckChars.length)) % Math.max(1, pianoDeckChars.length)
        );
        setPianoBeatIdx(0);
        setPianoLastEvent(null);
        return;
      }

      if (!/^[a-zA-Z]$/.test(e.key)) return;
      e.preventDefault();
      if (e.repeat) return;

      const ch = e.key.toLowerCase();
      pianoHeldRef.current.add(ch);
      pianoBufferRef.current.add(ch);
      setPianoHeldKeys(Array.from(pianoHeldRef.current).sort());
      setPianoBufferKeys(Array.from(pianoBufferRef.current).sort());
      synth.playPianoNote(ch, pianoSoundOn);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const ch = e.key.toLowerCase();
      if (!pianoHeldRef.current.has(ch)) return;
      pianoHeldRef.current.delete(ch);
      setPianoHeldKeys(Array.from(pianoHeldRef.current).sort());

      // Commit the entire order-independent chord the moment all held fingers lift!
      if (pianoHeldRef.current.size === 0 && pianoBufferRef.current.size > 0) {
        const captured = Array.from(pianoBufferRef.current);
        pianoBufferRef.current.clear();
        setPianoBufferKeys([]);
        commitPianoChord(captured);
      }
    };

    const onBlur = () => {
      pianoHeldRef.current.clear();
      pianoBufferRef.current.clear();
      setPianoHeldKeys([]);
      setPianoBufferKeys([]);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeTab, commitPianoChord, pianoDeckChars.length, pianoPlayMode, pianoSoundOn]);

  // Physical keyboard input handler for live verification
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== 'practice' || !currentCharEntry) return;
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setTyped('');
        setErrorFlash(false);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setTyped((prev) => prev.slice(0, -1));
        setErrorFlash(false);
        return;
      }
      if (e.key === 'Tab' || e.key === 'ArrowRight') {
        e.preventDefault();
        setCursorIdx((i) => (i + 1) % orderedChars.length);
        setTyped('');
        setErrorFlash(false);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursorIdx((i) => (i - 1 + orderedChars.length) % orderedChars.length);
        setTyped('');
        setErrorFlash(false);
        return;
      }

      if (!/^[a-zA-Z]$/.test(e.key)) return;
      e.preventDefault();
      if (replayTimerRef.current) {
        window.clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      setReplayStep(null);

      const ch = e.key.toLowerCase();
      const targetCode = currentCharEntry.code;
      const expected = targetCode[typed.length];
      if (!expected) return;

      if (ch === expected) {
        const nextTyped = typed + ch;
        const done = nextTyped.length >= targetCode.length;
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setHits((h) => h + 1);
        setErrorFlash(false);
        synth.playKeyHit(nextCombo, done);

        if (done) {
          speech.speakGlyph(currentCharEntry.char);
          setCompletedChars((prev) => {
            const next = new Set(prev);
            next.add(currentCharEntry.char);
            return next;
          });
          setTyped('');
          setCursorIdx((i) => (i + 1) % orderedChars.length);
        } else {
          setTyped(nextTyped);
        }
      } else {
        setCombo(0);
        setMisses((m) => m + 1);
        setErrorFlash(true);
        synth.playKeyMiss();
        const shouldRestart =
          typed.length > 0 && ch === targetCode[0] && targetCode[1] !== targetCode[0];
        setTyped(shouldRestart ? ch : '');
        if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = window.setTimeout(() => setErrorFlash(false), 320);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, combo, currentCharEntry, orderedChars.length, typed]);

  const accuracy = useMemo(() => {
    const total = hits + misses;
    return total === 0 ? 100 : Math.round((hits / total) * 100);
  }, [hits, misses]);

  // Audit breakdowns (distance 0..3 and row distribution)
  const auditStats = useMemo(() => {
    const distCounts = [0, 0, 0, 0];
    const rowCounts: Record<'top' | 'home' | 'bot', number> = { top: 0, home: 0, bot: 0 };
    let total = 0;
    for (const c of sim.chars) {
      for (const ks of c.keySpecs) {
        total++;
        distCounts[ks.dist]++;
        rowCounts[ks.row]++;
      }
    }
    return { distCounts, rowCounts, total: Math.max(1, total) };
  }, [sim.chars]);

  const filteredCorpusChars = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return sim.chars.slice(0, 72);
    return sim.chars
      .filter(
        (c) =>
          c.char.includes(q) ||
          c.code.includes(q.toLowerCase()) ||
          c.parts.some((p) => p.includes(q))
      )
      .slice(0, 72);
  }, [searchQuery, sim.chars]);

  const slotStats = useMemo(() => {
    const counts = new Map<string, number>();
    let totalOcc = 0;
    let homeK1Occ = 0;
    for (const r of sim.radicals) {
      counts.set(r.dyad, (counts.get(r.dyad) || 0) + 1);
      totalOcc += r.freq;
      if (r.key1.row === 'home') homeK1Occ += r.freq;
    }
    let soloCount = 0;
    let maxShare = 0;
    for (const c of counts.values()) {
      if (c === 1) soloCount += 1;
      if (c > maxShare) maxShare = c;
    }
    return {
      totalRadicals: sim.radicals.length,
      uniqueSlots: counts.size,
      soloCount,
      maxShare,
      homeK1Pct: totalOcc > 0 ? Math.round((homeK1Occ / totalOcc) * 1000) / 10 : 0,
    };
  }, [sim.radicals]);

  const visibleAtlasRadicals = useMemo(() => {
    const pool = sim.radicals.slice(
      0,
      stageId === 'starter12'
        ? 20
        : isKineticPrefixMode || isThreeRowMode
          ? 260
          : isHomeDirMode
            ? 140
            : 80
    );
    if (isKineticPrefixMode) {
      if (activePrefixFilter === 'all') return pool;
      if (activePrefixFilter === 'xiao') return pool.filter((r) => Boolean(r.prefixIsXiao));
      if (activePrefixFilter === 'da') return pool.filter((r) => !r.prefixIsXiao);
      if (activePrefixFilter === 'home') return pool.filter((r) => r.key1.row === 'home');
      if (activePrefixFilter === 'top') return pool.filter((r) => r.key1.row === 'top');
      return pool.filter((r) => r.key1.row === 'bot');
    }
    if (isHomeDirMode) {
      if (activeHomeFilter === 'all') return pool;
      if (activeHomeFilter === 'wing') {
        const wingSet = new Set(['q', 'a', 'z', 'p']);
        return pool.filter((r) => wingSet.has(r.key1.key));
      }
      if (isThreeRowMode) {
        const anchor = HOME_GROUP_ANCHORS.find((a) => a.key === activeHomeFilter);
        if (anchor) {
          return pool.filter((r) => anchor.columnKeys.includes(r.key1.key));
        }
      }
      return pool.filter((r) => r.key1.key === activeHomeFilter);
    }
    if (activeStrokeFilter === 'all') return pool;
    return pool.filter((r) => r.originStroke === activeStrokeFilter);
  }, [
    activeHomeFilter,
    activePrefixFilter,
    activeStrokeFilter,
    isHomeDirMode,
    isKineticPrefixMode,
    isThreeRowMode,
    sim.radicals,
    stageId,
  ]);

  const intentFlowModel = useMemo(() => {
    if (!currentCharEntry) return null;
    return buildIntentFlowModel(currentCharEntry, rhythmMode);
  }, [currentCharEntry, rhythmMode]);

  const activeFlowProgress = replayStep !== null ? replayStep : typed.length;

  const stopReplay = useCallback(() => {
    if (replayTimerRef.current) {
      window.clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayStep(null);
  }, []);

  const toggleReplay = useCallback(() => {
    if (!currentCharEntry) return;
    synth.playClick();
    if (replayStep !== null) {
      stopReplay();
      return;
    }
    const maxSteps = currentCharEntry.keySpecs.length;
    setReplayStep(0);
    let step = 0;
    replayTimerRef.current = window.setInterval(() => {
      step += 1;
      if (step > maxSteps) {
        if (replayTimerRef.current) {
          window.clearInterval(replayTimerRef.current);
          replayTimerRef.current = null;
        }
        setReplayStep(null);
      } else {
        setReplayStep(step);
      }
    }, 520);
  }, [currentCharEntry, replayStep, stopReplay]);

  // Cancel replay on character switch
  useEffect(() => {
    stopReplay();
  }, [cursorIdx, rhythmMode, blockMode, stopReplay]);

  const keyboardFlowSegments = useMemo(() => {
    if (!intentFlowModel || activeTab !== 'practice') return [];
    const bounds = { minX: 12, maxX: 624, minY: 10, maxY: 186 };
    return intentFlowModel.segments
      .map((seg) => {
        const p1 = getKeyCenter(seg.fromNode.keySpec.key);
        const p2 = getKeyCenter(seg.toNode.keySpec.key);
        if (!p1 || !p2) return null;
        const outDir =
          seg.kind === 'intra'
            ? ORIGIN_TANGENTS[seg.fromNode.originStroke].outVec
            : ENDING_TANGENTS[seg.fromNode.endingVector].outVec;
        const inDir =
          seg.kind === 'intra'
            ? ENDING_TANGENTS[seg.toNode.endingVector].inVec
            : seg.toNode.role === 'origin'
              ? ORIGIN_TANGENTS[seg.toNode.originStroke].inVec
              : ENDING_TANGENTS[seg.toNode.endingVector].inVec;
        // Blend calligraphic tangent with ergonomic arch lift for clean key-to-key visibility
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const unitX = dx / dist;
        const unitY = dy / dist;
        const blendedOut = {
          x: outDir.x * 0.55 + unitX * 0.45,
          y: outDir.y * 0.55 + unitY * 0.45 - 0.25,
        };
        const blendedIn = {
          x: inDir.x * 0.55 + unitX * 0.45,
          y: inDir.y * 0.55 + unitY * 0.45 + 0.2,
        };
        return {
          idx: seg.idx,
          kind: seg.kind,
          p1,
          p2,
          d: buildCubicBezierPath(p1, p2, blendedOut, blendedIn, 0.36, bounds),
        };
      })
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [activeTab, intentFlowModel]);

  const arcGeom = useMemo(() => {
    if (!activeGesturePreview) return null;
    const p1 = getKeyCenter(activeGesturePreview.k1.key);
    const p2 = getKeyCenter(activeGesturePreview.k2.key);
    if (!p1 || !p2) return null;
    const midX = (p1.x + p2.x) / 2;
    const curveLift = Math.min(48, Math.max(22, Math.abs(p2.x - p1.x) * 0.14));
    const ctrlY = Math.min(p1.y, p2.y) - curveLift;
    return {
      p1,
      p2,
      d: `M ${p1.x} ${p1.y} Q ${midX} ${ctrlY} ${p2.x} ${p2.y}`,
    };
  }, [activeGesturePreview]);

  const expectedKey =
    currentCharEntry && activeTab === 'practice'
      ? currentCharEntry.code[typed.length] || ''
      : '';

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="relative z-10 w-full h-full flex flex-col overflow-hidden bg-[var(--dojo-canvas)] text-[var(--dojo-text)]">
      {/* Header Bar */}
      <header className="shrink-0 h-14 px-5 sm:px-8 border-b border-[var(--dojo-border)] bg-[var(--dojo-header)]/92 backdrop-blur-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回道場')}</span>
          </button>

          <h1 className="font-display text-base sm:text-lg font-bold text-[var(--dojo-text-bright)] truncate">
            {t('雙手交替 · 起筆收意編碼驗證室')}
          </h1>

          <span className="hidden xl:inline text-xs text-[var(--dojo-text-sub)] whitespace-nowrap">
            {isKineticPrefixMode
              ? t('方向×距離重聚類 · A區16鍵(FDS|JKL零移) × B區6鍵(EGV|IHM勢距收尾) · 零小指免空格')
              : isThreeRowMode
                ? t('三排 8 條同指縱柱 (中排主根 ~67% · 上排次頻 · 下排低頻) × 對側 8 向 · 根內 100% 交替')
                : isHomeDirMode
                  ? t('中排 4+4 起手 (SDFG | HJKL) × 對側手方向收勢 · 根內 100% 交替')
                  : t('左手五筆起勢 (橫豎撇點折) × 右手收勢去向 (右上開口/平定/下散)')}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Script Scope */}
          <div
            role="group"
            aria-label={t('繁簡範圍')}
            className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]"
          >
            {SCRIPT_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeScriptMode(opt.id);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scriptMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          {/* Theme Switcher */}
          <div
            role="group"
            aria-label={t('視覺色調')}
            className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]"
          >
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeThemeMode(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  themeMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={t(muted ? '開啟音效' : '靜音')}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Scrollable Workbench */}
      <main className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col gap-5">
          {/* Parameter Control Strip */}
          <section
            aria-label={t('編碼參數配置')}
            className="flex flex-col gap-2.5 pb-4 border-b border-[var(--dojo-border)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Connected-Block Grouping Mode */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--dojo-text-sub)] whitespace-nowrap">
                    {t('切分粒度')}
                  </span>
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setBlockMode('connected');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        blockMode === 'connected'
                          ? 'bg-[var(--dojo-pine)] text-white'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('相連成塊歸一勢')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setBlockMode('yuhao');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        blockMode === 'yuhao'
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('宇浩原根細分')}
                    </button>
                  </div>
                </div>

                {/* Rhythm Mode: Heshi Compact / Heshi 1k / Full Event Stream / Fixed 4 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--dojo-text-sub)] whitespace-nowrap">
                    {t('編碼事件')}
                  </span>
                  <div className="inline-flex flex-wrap items-center p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setRhythmMode('heshi_compact');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        rhythmMode === 'heshi_compact'
                          ? 'bg-[var(--dojo-pine)] text-white'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('合十緊湊 (2~4鍵)')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setRhythmMode('heshi_1k');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        rhythmMode === 'heshi_1k'
                          ? 'bg-[var(--dojo-pine)] text-white'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('合十單鍵 (1塊1鍵)')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setRhythmMode('event_stream');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        rhythmMode === 'event_stream'
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('雙鍵全事件流')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setRhythmMode('fixed4');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        rhythmMode === 'fixed4'
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('定長四碼')}
                    </button>
                  </div>
                </div>

                {/* Alternation Polarity Mode */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--dojo-text-sub)] whitespace-nowrap">
                    {t('交替法則')}
                  </span>
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setAltMode('bidirectional');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        altMode === 'bidirectional'
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {isThreeRowMode
                        ? t('雙側 8 縱柱 (L↔R)')
                        : isHomeDirMode
                          ? t('雙側中排 4+4 (L↔R)')
                          : t('陰陽雙向 L↔R')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setAltMode('strict_lr');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        altMode === 'strict_lr'
                          ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                          : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {isHomeDirMode ? t('純左起全交替 L→R') : t('百發全交替 L→R')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Architecture / Comfort Zone Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--dojo-text-sub)] whitespace-nowrap">
                  {t('鍵區架構')}
                </span>
                <div className="inline-flex flex-wrap items-center p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                  {(
                    [
                      'kinetic_prefix22',
                      'three_row_dir8',
                      'three_row_full26',
                      'home_dir8',
                      'home_dir4',
                      'comfort22',
                      'comfort20',
                      'compact16',
                    ] as KineticZoneId[]
                  ).map((zid) => {
                    const isCompassArch =
                      zid === 'kinetic_prefix22' ||
                      zid === 'three_row_dir8' ||
                      zid === 'three_row_full26' ||
                      zid === 'home_dir8' ||
                      zid === 'home_dir4';
                    return (
                      <button
                        key={zid}
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          const enteringCompassArch =
                            isCompassArch && !isHomeDirMode && !isKineticPrefixMode;
                          setZoneId(zid);
                          if (zid !== 'three_row_full26' && activeHomeFilter === 'wing') {
                            setActiveHomeFilter('all');
                          }
                          if (zid === 'kinetic_prefix22') {
                            setBlockMode('yuhao');
                            setRhythmMode('fixed4');
                            setAltMode('bidirectional');
                          } else if (enteringCompassArch) {
                            setBlockMode('yuhao');
                            setRhythmMode('event_stream');
                            setAltMode('bidirectional');
                          }
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          zoneId === zid
                            ? isCompassArch
                              ? 'bg-[var(--dojo-pine)] text-white shadow-xs'
                              : 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                            : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                        }`}
                      >
                        {t(ZONE_DEFINITIONS[zid].label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Stage Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                {STAGE_OPTIONS.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    title={t(st.hint)}
                    onClick={() => {
                      synth.playClick();
                      setStageId(st.id);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      stageId === st.id
                        ? 'bg-[var(--dojo-crimson)] text-white'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    {t(st.label)}
                  </button>
                ))}
              </div>

              <span className="text-xs text-[var(--dojo-text-muted)]">
                {isKineticPrefixMode || isHomeDirMode
                  ? t(ZONE_DEFINITIONS[zoneId].subtitle)
                  : rhythmMode === 'heshi_compact'
                    ? t('合十緊湊：1塊起收2鍵，2塊「起收2鍵＋次塊合十1鍵」共3鍵，3塊+每塊1合十鍵（均長 ~2.95 鍵）')
                    : rhythmMode === 'heshi_1k'
                      ? t('合十純單鍵：左手橫撇折 ↔ 右手豎點合十對映，1塊1鍵（均長 ~2.35 鍵）')
                      : rhythmMode === 'event_stream'
                        ? t('雙鍵全事件流：每個相連字塊完整擊出「起筆 → 勢向」一組動作事件（2～8 鍵）')
                        : t('固定四碼截斷對照：三根及以上時僅取首根全碼＋次根首鍵＋末根末鍵')}
              </span>
            </div>
          </section>

          {/* 4-Metric Quantitative Verification Strip */}
          <section
            aria-label={t('編碼實測指標')}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div className="p-4 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
              <div className="text-xs text-[var(--dojo-text-sub)]">
                {t('無重碼首選率')}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono-tabular text-2xl font-bold text-[var(--dojo-text-bright)]">
                  {sim.metrics.firstChoiceRate.toFixed(1)}%
                </span>
                <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                  {sim.metrics.uniqueCodes} / {sim.metrics.totalChars} {t('字')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
              <div className="text-xs text-[var(--dojo-text-sub)]">
                {t('整字雙手交替率')}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono-tabular text-2xl font-bold text-[var(--dojo-pine-text)]">
                  {sim.metrics.wholeWordAltRate.toFixed(1)}%
                </span>
                <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                  {t('平均碼長')} {sim.metrics.avgCodeLength.toFixed(2)} {t('鍵')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
              <div className="text-xs text-[var(--dojo-text-sub)]">
                {t('中宮穩健鍵佔比')}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono-tabular text-2xl font-bold text-[var(--dojo-ochre)]">
                  {sim.metrics.homeRowRate.toFixed(1)}%
                </span>
                <span className="text-xs text-[var(--dojo-text-muted)]">
                  {t('中排 S D F G | H J K L')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
              <div className="text-xs text-[var(--dojo-text-sub)]">
                {t('同指連擊 · 平均離軸距')}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono-tabular text-2xl font-bold text-[var(--dojo-text-bright)]">
                  {sim.metrics.sameFingerRate.toFixed(1)}%
                </span>
                <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                  {t('距中橋')} {sim.metrics.avgCenterDist.toFixed(2)} {t('指')}
                </span>
              </div>
            </div>
          </section>

          {/* Two-Zone Educational Sandbox: Left Stage (65%) + Right Corpus Deck (35%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT / TOP ZONE: Interactive Stage */}
            <section className="lg:col-span-8 flex flex-col gap-4 p-5 rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
              {/* Stage Mode Sub-Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--dojo-border)]">
                <div className="inline-flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setActiveTab('piano');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'piano'
                        ? 'bg-[var(--dojo-ochre)] text-white shadow-xs'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>{t('鋼琴和弦並擊')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setActiveTab('practice');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'practice'
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>{t('鍵盤實感試打')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setActiveTab('atlas');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'atlas'
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{t('五筆起勢 × 去向圖譜')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setActiveTab('audit');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'audit'
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>{t('重碼與距離體檢')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setActiveTab('benchmark');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'benchmark'
                        ? 'bg-[var(--dojo-pine)] text-white shadow-xs'
                        : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>{t('靈明音託 vs 動力學對照')}</span>
                  </button>
                </div>

                {activeTab === 'piano' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setPianoPlayMode('drill');
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          pianoPlayMode === 'drill'
                            ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                            : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                        }`}
                      >
                        {t('實戰練字 (每拍一根)')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setPianoPlayMode('freeplay');
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          pianoPlayMode === 'freeplay'
                            ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                            : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                        }`}
                      >
                        {t('自由試彈和弦')}
                      </button>
                    </div>

                    {pianoChordMode === 'dyad_intuitive' && (
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setPianoWholeSecondBeat((v) => !v);
                          setPianoBeatIdx(0);
                          setPianoLastEvent(null);
                        }}
                        title={t('單字根獨體字（非 22 單鍵族長）在第 2 拍補按 1 指「次筆少/多畫」，零三鍵並大幅降重碼')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                          pianoWholeSecondBeat
                            ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                            : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                        }`}
                      >
                        <span>{t(pianoWholeSecondBeat ? '獨體補次筆 開' : '獨體補次筆 關')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPianoSoundOn((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        pianoSoundOn
                          ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)]'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                      }`}
                    >
                      {pianoSoundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span>{t(pianoSoundOn ? '鋼琴和弦音 開' : '鋼琴和弦音 關')}</span>
                    </button>
                  </div>
                )}

                {activeTab === 'practice' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setBlindMode((b) => !b);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        blindMode
                          ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)]'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {blindMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{t(blindMode ? '盲打隱碼' : '顯示動作碼')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={shuffleDeck}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>{t('打亂順序')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={resetProgress}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('重置')}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* TAB 0: PIANO CHORD SIMULTANEOUS CHORDING LAB */}
              {activeTab === 'piano' && (
                <div className="flex flex-col gap-4">
                  {/* Architecture Switcher + Live 3-Way Comparison Table */}
                  <div className="rounded-xl border border-[var(--dojo-ochre)]/35 bg-[var(--dojo-surface-inset)] p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4 text-[var(--dojo-ochre)] shrink-0" />
                          <h3 className="text-sm font-bold text-[var(--dojo-text-bright)]">
                            {t('雙手鋼琴並擊 · 全 269 宇浩字根 100% 覆蓋 · 不分先後鬆手即出')}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs text-[var(--dojo-text-sub)] leading-relaxed">
                          {pianoChordMode === 'dyad_unique'
                            ? t('純 26 字母跨手專版（零標點・零三鍵・零同手雙指・X鍵降權）：僅使用 A–Z 全部 26 字母（左 15 鍵含 QAZ × 右 11 鍵含 P），提供 191 個純跨手/單指槽。前 191 個高頻簡體字根 1 對 1 獨享，合體字直達理論極限 99.69%，右下标點鍵完全不參與編碼！')
                            : pianoChordMode === 'dyad_intuitive'
                              ? t('簡體純形專版（零三鍵・零小指・22 單指族長）：左手 12 鍵重分客觀起筆形態（F單橫/R交叉、S空框/B滿框、W純折/G折撇），右手 10 鍵定末筆五勢 × 少畫(≤4畫)/多畫(≥5畫)。22 個最高頻簡體族長直接單指輕點，約 40% 拍次只需 1 指！')
                              : pianoChordMode === 'dyad_balanced'
                                ? t('純雙指・全盤 128 槽版（零三鍵高效）：同樣零三鍵零小指，開放全部 12×10 雙手雙指槽，將 269 宇浩字根均攤至 128 槽（每槽僅 2.1 根），兼顧雙指輕手感與極低重碼率。')
                                : t('全獨佔・含三指和弦版（單根 0 共享）：269 個宇浩字根 1 對 1 獨佔單拍和弦，整字無重碼率最高，但約 26%~29% 拍次需三鍵齊按。')}
                        </p>
                      </div>
                    </div>

                    {/* 4-Way Piano Chord Architecture Selector + Live Metrics Comparison */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--dojo-border)] text-[11px] text-[var(--dojo-text-muted)]">
                            <th className="py-1.5 pr-2 font-medium">{t('並擊架構（點擊切換試打）')}</th>
                            <th className="py-1.5 px-2 font-medium text-right whitespace-nowrap">{t('最多齊按')}</th>
                            <th className="py-1.5 px-2 font-medium text-right whitespace-nowrap">{t('均指/拍')}</th>
                            <th className="py-1.5 px-2 font-medium text-right whitespace-nowrap">{t('全庫無重碼')}</th>
                            <th className="py-1.5 px-2 font-medium text-right whitespace-nowrap">{t('合體字無重碼')}</th>
                            <th className="py-1.5 pl-2 font-medium text-right whitespace-nowrap">{t('字根覆蓋')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--dojo-border)]/60">
                          {(
                            [
                              {
                                id: 'dyad_unique' as PianoChordMode,
                                title: '① 純 26 字母跨手 · 191 獨享槽（含 QAZ＋P，零標點）',
                                tag: '純字母',
                                sim: pianoComparison.dyadUnique,
                              },
                              {
                                id: 'dyad_intuitive' as PianoChordMode,
                                title: '② 簡體零小指純形 · 左12重分＋22單指族長（可推理）',
                                tag: '零小指',
                                sim: pianoComparison.dyadIntuitive,
                              },
                              {
                                id: 'dyad_balanced' as PianoChordMode,
                                title: '③ 零小指均衡 · 全盤 128 槽（零三鍵）',
                                tag: '零三鍵',
                                sim: pianoComparison.dyadBalanced,
                              },
                              {
                                id: 'triad_unique' as PianoChordMode,
                                title: '④ 零小指 0 共享 · 含三指和弦對照',
                                tag: '含三指',
                                sim: pianoComparison.triadUnique,
                              },
                            ] as const
                          ).map((row) => {
                            const selected = pianoChordMode === row.id;
                            const m = row.sim.metrics;
                            return (
                              <tr
                                key={row.id}
                                onClick={() => {
                                  synth.playClick();
                                  setPianoChordMode(row.id);
                                  setPianoBeatIdx(0);
                                  setPianoLastEvent(null);
                                }}
                                className={`transition-colors cursor-pointer ${
                                  selected
                                    ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-text-bright)]'
                                    : 'hover:bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)]'
                                }`}
                              >
                                <td className="py-2 pr-2 font-medium whitespace-nowrap">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                      selected ? 'bg-[var(--dojo-ochre)]' : 'bg-[var(--dojo-border-strong)]'
                                    }`}
                                  />
                                  <span className={selected ? 'font-bold text-[var(--dojo-text-bright)]' : ''}>
                                    {t(row.title)}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right font-mono-tabular whitespace-nowrap">
                                  <span
                                    className={
                                      m.maxFingersPerBeat <= 2
                                        ? 'text-[var(--dojo-pine-text)] font-bold'
                                        : 'text-[var(--dojo-ochre)] font-semibold'
                                    }
                                  >
                                    ≤ {m.maxFingersPerBeat}{t('指')}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right font-mono-tabular whitespace-nowrap">
                                  {m.avgFingersPerBeat.toFixed(2)}{t('指')}
                                </td>
                                <td className="py-2 px-2 text-right font-mono-tabular font-bold whitespace-nowrap">
                                  <span className="text-[var(--dojo-text-bright)]">
                                    {m.firstChoiceRate.toFixed(2)}%
                                  </span>
                                  <span className="ml-1 text-[10px] font-normal text-[var(--dojo-text-muted)]">
                                    ({m.collisionChars}{t('重')})
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-right font-mono-tabular font-semibold whitespace-nowrap text-[var(--dojo-pine-text)]">
                                  {m.compoundFirstChoiceRate.toFixed(2)}%
                                </td>
                                <td className="py-2 pl-2 text-right font-mono-tabular whitespace-nowrap text-[var(--dojo-pine-text)]">
                                  {m.totalRadicals}/{m.officialYuhaoTotal} (100%)
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Objective Pure-Shape Decoding Reference (Left Opening x Right Ending + Solo Leaders) */}
                    {(pianoChordMode === 'dyad_unique' || pianoChordMode === 'dyad_intuitive') && (
                      <div className="pt-2.5 border-t border-[var(--dojo-border)] grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <div className="text-[11px] font-semibold text-[var(--dojo-ochre)]">
                            {pianoChordMode === 'dyad_unique'
                              ? t('左手 15 鍵＝客觀起筆形態（含 Q傘撇 / A半包 / Z彎鉤，X鍵已降權）')
                              : t('左手 12 鍵＝客觀起筆形態（單點＝該族族長）')}
                          </div>
                          <div className={pianoChordMode === 'dyad_unique' ? 'grid grid-cols-5 gap-1' : 'grid grid-cols-3 gap-1'}>
                            {(pianoChordMode === 'dyad_unique'
                              ? [
                                  ...PURE_SHAPE_LEFT_FAMILIES,
                                  { key: 'q', soloLeader: '八', shortTag: '傘撇', rule: 'Q · 傘撇八人', examples: '八 入 合 金 钅 食 饣 欠 久 勺' },
                                  { key: 'a', soloLeader: '厂', shortTag: '半包', rule: 'A · 廠匚半包', examples: '厂 匚 石 面 西 酉 戈 戊 辰 牙' },
                                  { key: 'z', soloLeader: '也', shortTag: '彎鉤', rule: 'Z · 乙己彎鉤', examples: '也 了 九 己 已 巳 巴 习 弓 飞' },
                                ]
                              : PURE_SHAPE_LEFT_FAMILIES
                            ).map((f) => (
                              <div
                                key={f.key}
                                title={`${t(f.rule)}：${f.examples}`}
                                className="px-1.5 py-1 rounded border border-[var(--dojo-border)] bg-[var(--dojo-surface)] flex items-center justify-between gap-0.5 text-[10px]"
                              >
                                <span className="font-mono-tabular font-bold uppercase text-[var(--dojo-ochre)]">
                                  {f.key}
                                </span>
                                <span className="font-display font-bold text-[var(--dojo-text-bright)]">
                                  {f.soloLeader}
                                </span>
                                <span className="text-[var(--dojo-text-sub)] truncate">
                                  {t(f.shortTag)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="text-[11px] font-semibold text-[var(--dojo-pine-text)]">
                            {pianoChordMode === 'dyad_unique'
                              ? t('右手 11 字母鍵＝末筆五勢少/多畫 ＋ P 鍵擴容（零標點鍵）')
                              : t('右手 10 鍵＝末筆五勢 × 少畫(≤4畫)／多畫(≥5畫)（單點＝高頻王牌）')}
                          </div>
                          <div className={pianoChordMode === 'dyad_unique' ? 'grid grid-cols-6 gap-1' : 'grid grid-cols-5 gap-1'}>
                            {PURE_SHAPE_RIGHT_ENDINGS.map((r) => (
                              <div
                                key={r.key}
                                title={`${t(r.label)} · 單點＝${r.soloLeader}`}
                                className="px-1 py-1 rounded border border-[var(--dojo-border)] bg-[var(--dojo-surface)] flex flex-col items-center justify-center text-[10px]"
                              >
                                <div className="flex items-center gap-0.5 leading-none">
                                  <span className="font-mono-tabular font-bold uppercase text-[var(--dojo-pine-text)]">
                                    {r.key}
                                  </span>
                                  <span className="font-display font-bold text-[var(--dojo-text-bright)]">
                                    {r.soloLeader}
                                  </span>
                                </div>
                                <span className="mt-0.5 text-[9px] text-[var(--dojo-text-sub)] whitespace-nowrap">
                                  {t(r.shortTag)}
                                </span>
                              </div>
                            ))}
                            {pianoChordMode === 'dyad_unique' && (() => {
                              const ext = PURE_SHAPE_EXT_KEY_TAGS.p;
                              const solo = PURE_SHAPE_SOLO_26_BY_KEY.p;
                              return (
                                <div
                                  title={t(ext.label)}
                                  className="px-1 py-1 rounded border border-[var(--dojo-pine)]/35 bg-[var(--dojo-pine-wash)]/40 flex flex-col items-center justify-center text-[10px]"
                                >
                                  <div className="flex items-center gap-0.5 leading-none">
                                    <span className="font-mono-tabular font-bold uppercase text-[var(--dojo-pine-text)]">
                                      P
                                    </span>
                                    <span className="font-display font-bold text-[var(--dojo-text-bright)]">
                                      {solo}
                                    </span>
                                  </div>
                                  <span className="mt-0.5 text-[9px] text-[var(--dojo-text-sub)] whitespace-nowrap">
                                    {t(ext.shortTag)}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="text-[10px] text-[var(--dojo-text-muted)]">
                            {pianoChordMode === 'dyad_unique'
                              ? t('純 A–Z 26 字母：26 單點全為獨享族長，165 跨手雙指槽優先供前 191 高頻字根獨享，徹底解放右下标點鍵。')
                              : t('單點任一鍵即出對應大字族長（覆蓋約 40% 高頻拍次）；雙手齊按即出同族字根，獨體字開啟補次筆時再輕點 1 指次筆。')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SUB-MODE A: REAL CHARACTER CHORD DRILL */}
                  {pianoPlayMode === 'drill' && currentPianoChar && currentPianoBeat && (
                    <div className="rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] p-4 flex flex-col gap-4">
                      {/* Top Character + Beat Progress Row */}
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)] flex flex-col items-center justify-center shrink-0">
                            <span className="font-display text-5xl font-bold text-[var(--dojo-text-bright)] leading-none">
                              {currentPianoChar.char}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-[var(--dojo-ochre)]">
                                {t('共')} {currentPianoChar.beatCount} {t('拍完成此字')}
                              </span>
                              <span className="text-xs text-[var(--dojo-text-muted)]">·</span>
                              <span className="font-mono-tabular text-xs text-[var(--dojo-text-sub)]">
                                {t('第')} {pianoCharIdx + 1} / {pianoDeckChars.length} {t('字')}
                              </span>
                              <span className="text-xs text-[var(--dojo-text-muted)]">·</span>
                              <span className="font-mono-tabular text-xs text-[var(--dojo-pine-text)]">
                                {t('連拍')} {pianoCombo}
                              </span>
                            </div>

                            {/* Beat-by-beat chord sheet */}
                            <div className="flex flex-wrap items-center gap-2">
                              {currentPianoChar.beats.map((beat, bIdx) => {
                                const isDone = bIdx < pianoBeatIdx;
                                const isCurrent = bIdx === pianoBeatIdx;
                                return (
                                  <button
                                    key={`${currentPianoChar.char}_beat_${bIdx}`}
                                    type="button"
                                    onClick={() => {
                                      setPianoBeatIdx(bIdx);
                                      synth.playPianoChord(beat.keys, false, pianoSoundOn);
                                    }}
                                    className={`px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                                      isCurrent
                                        ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] shadow-xs'
                                        : isDone
                                          ? 'border-[var(--dojo-pine)]/50 bg-[var(--dojo-pine-wash)] opacity-80'
                                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] opacity-75 hover:opacity-100'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono-tabular text-[var(--dojo-text-muted)]">
                                        {t('第')}{bIdx + 1}{t('拍')}
                                      </span>
                                      <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)] leading-none">
                                        {beat.radical}
                                      </span>
                                      <span className="font-mono-tabular text-xs font-bold text-[var(--dojo-ochre)]">
                                        {beat.displayChord}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-[10px] text-[var(--dojo-text-sub)] whitespace-nowrap">
                                      {t(beat.directionRuleCue)}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => commitPianoChord(currentPianoBeat.keys)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[var(--dojo-ochre)]/50 bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{t('點按奏出此拍')} ({currentPianoBeat.displayChord})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setPianoCharIdx((i) => (i + 1) % Math.max(1, pianoDeckChars.length));
                              setPianoBeatIdx(0);
                              setPianoLastEvent(null);
                            }}
                            className="px-2.5 py-2 text-xs font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] cursor-pointer whitespace-nowrap"
                          >
                            {t('下一字')} →
                          </button>
                        </div>
                      </div>

                      {/* Live Simultaneous Chord Detector & Rule Explanation Strip */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[var(--dojo-border)]">
                        <div className="rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] px-3.5 py-2.5 flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] text-[var(--dojo-text-muted)]">
                            <span>{t('本拍推理邏輯（同時按下、不分先後、鬆手即出）')}</span>
                            <span className="font-mono-tabular text-[var(--dojo-ochre)] font-semibold">
                              {currentPianoBeat.tier === 1
                                ? t('單指獨奏')
                                : currentPianoBeat.tier === 2
                                  ? t('雙手雙指')
                                  : t('雙手三指和弦')}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-display text-xl font-bold text-[var(--dojo-text-bright)]">
                              {currentPianoBeat.radical}
                            </span>
                            <span className="font-mono-tabular text-sm font-bold text-[var(--dojo-ochre)]">
                              {currentPianoBeat.displayChord}
                            </span>
                            <span className="text-xs text-[var(--dojo-text-sub)]">
                              = {t(currentPianoBeat.directionRuleCue)}
                            </span>
                          </div>
                          {(() => {
                            const sibs = pianoSim.chordsBySignature.get(currentPianoBeat.signature) ?? [];
                            if (sibs.length <= 1) return null;
                            return (
                              <div className="text-[11px] text-[var(--dojo-text-muted)]">
                                {t('同和弦家族')} ({sibs.length})：{sibs.slice(0, 8).map((s) => s.radical).join(' · ')}
                                {sibs.length > 8 ? ' …' : ''}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] px-3.5 py-2.5 flex flex-col justify-center gap-1">
                          <div className="flex items-center justify-between text-[11px] text-[var(--dojo-text-muted)]">
                            <span>{t('即時琴鍵並擊偵測')}</span>
                            <span className="font-mono-tabular">
                              {t('命中')} {pianoBeatsHit} · {t('偏差')} {pianoBeatsMissed}
                            </span>
                          </div>
                          {pianoBufferKeys.length > 0 ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[var(--dojo-crimson)] font-semibold">
                                {t('正在蓄力按下：')}
                              </span>
                              <span className="font-mono-tabular text-sm font-bold uppercase text-[var(--dojo-text-bright)]">
                                {pianoBufferKeys.join(' + ')}
                              </span>
                              <span className="text-[var(--dojo-text-muted)]">
                                {pianoHeldKeys.length > 0 ? t('（鬆開所有手指即觸發）') : ''}
                              </span>
                            </div>
                          ) : pianoLastEvent ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {pianoLastEvent.status === 'char_done' ? (
                                <span className="text-[var(--dojo-pine-text)] font-semibold">
                                  ✓ {t('完成「')}{pianoLastEvent.completedChar}{t('」！奏出')}{' '}
                                  <span className="font-mono-tabular uppercase">
                                    {pianoLastEvent.signature}
                                  </span>
                                </span>
                              ) : pianoLastEvent.status === 'hit' ? (
                                <span className="text-[var(--dojo-pine-text)] font-semibold">
                                  ✓ {t('和弦命中：')}{' '}
                                  <span className="font-mono-tabular uppercase">
                                    {pianoLastEvent.signature}
                                  </span>{' '}
                                  → {pianoLastEvent.matchedChord?.radical}
                                </span>
                              ) : (
                                <span className="text-[var(--dojo-crimson)]">
                                  {t('剛按下')}{' '}
                                  <strong className="font-mono-tabular uppercase">
                                    {pianoLastEvent.signature}
                                  </strong>
                                  {pianoLastEvent.matchedSiblings.length > 0
                                    ? `（${t('對應')} ${pianoLastEvent.matchedSiblings.slice(0, 4).map((s) => s.radical).join('/')}）`
                                    : t('（未指派和弦槽）')}
                                  ，{t('本拍請同時按')}{' '}
                                  <strong className="font-mono-tabular text-[var(--dojo-ochre)]">
                                    {pianoLastEvent.expectedChord?.displayChord}
                                  </strong>
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-[var(--dojo-text-sub)]">
                              {t('請直接在實體鍵盤上同時按下')}{' '}
                              <strong className="font-mono-tabular text-[var(--dojo-ochre)]">
                                {currentPianoBeat.displayChord}
                              </strong>{' '}
                              {t('（先按哪個鍵都行，同時按下後一起鬆手！）')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-MODE B: FREEPLAY PIANO CHORD EXPLORER */}
                  {pianoPlayMode === 'freeplay' && (
                    <div className="rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] p-4 flex flex-col gap-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-[var(--dojo-text-bright)]">
                            {t('自由試彈模式 · 雙手各落 1 指同時按下再鬆手')}
                          </div>
                          <div className="text-[11px] text-[var(--dojo-text-sub)] mt-0.5">
                            {t('試著左手按住中排 F / D / G / S，同時右手點按上排 Y U I O、中排 H J K L 或下排 N M，立即檢視該和弦對應的全部字根！')}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] min-w-[240px]">
                          {pianoBufferKeys.length > 0 ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[var(--dojo-crimson)] font-semibold">{t('按住中')}</span>
                              <span className="font-mono-tabular text-sm font-bold uppercase text-[var(--dojo-text-bright)]">
                                {pianoBufferKeys.join(' + ')}
                              </span>
                            </div>
                          ) : pianoLastEvent?.status === 'free' ? (
                            <div className="flex items-center gap-2.5">
                              <span className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]">
                                {pianoLastEvent.matchedChord?.radical ?? '—'}
                              </span>
                              <div className="flex flex-col">
                                <span className="font-mono-tabular text-xs font-bold uppercase text-[var(--dojo-ochre)]">
                                  {pianoLastEvent.signature}
                                  {pianoLastEvent.matchedChord
                                    ? ` · ${t(pianoLastEvent.matchedChord.directionRuleCue)}`
                                    : ''}
                                </span>
                                <span className="text-[10px] text-[var(--dojo-text-muted)]">
                                  {pianoLastEvent.matchedSiblings.length > 1
                                    ? `${t('同槽共')} ${pianoLastEvent.matchedSiblings.length} ${t('根')}：${pianoLastEvent.matchedSiblings.slice(0, 8).map((s) => s.radical).join(' ')}`
                                    : pianoLastEvent.matchedChord
                                      ? t(pianoLastEvent.matchedChord.fingerCue)
                                      : t('此組合為留白和弦（可擴充詞組或簡碼）')}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--dojo-text-muted)]">
                              {t('等待雙手落鍵和弦…')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 8 Home-Row Family Filter & Audition Deck */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPianoSelectedHomeFilter('all')}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                            pianoSelectedHomeFilter === 'all'
                              ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] font-semibold'
                              : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)]'
                          }`}
                        >
                          {pianoChordMode === 'dyad_unique'
                            ? t('全部 15 族')
                            : pianoChordMode === 'dyad_intuitive'
                              ? t('全部 12 族')
                              : t('全部 8 族')}{' '}
                          ({pianoSim.chords.length})
                        </button>
                        {pianoSim.homeClusterSummary.map((h) => (
                          <button
                            key={h.homeKey}
                            type="button"
                            onClick={() => setPianoSelectedHomeFilter(h.homeKey)}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                              pianoSelectedHomeFilter === h.homeKey
                                ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] font-semibold'
                                : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                            }`}
                          >
                            <span className="font-mono-tabular font-bold uppercase mr-1">{h.homeKey}</span>
                            <span>{h.soloRadical}</span>
                            <span className="text-[10px] text-[var(--dojo-text-muted)] ml-1">
                              ({h.totalRadicals})
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Clickable Chord Audition Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[210px] overflow-y-auto pr-1">
                        {pianoSim.chords
                          .filter(
                            (c) =>
                              pianoSelectedHomeFilter === 'all' ||
                              c.homeAnchorKey === pianoSelectedHomeFilter
                          )
                          .slice(0, 45)
                          .map((ch) => {
                            const isLastHit = pianoLastEvent?.signature === ch.signature;
                            return (
                              <button
                                key={`${ch.radical}_${ch.signature}`}
                                type="button"
                                onClick={() => commitPianoChord(ch.keys)}
                                className={`px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                                  isLastHit
                                    ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)]'
                                    : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)] leading-none">
                                    {ch.radical}
                                  </span>
                                  <span className="font-mono-tabular text-xs font-bold text-[var(--dojo-ochre)]">
                                    {ch.displayChord}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--dojo-text-muted)]">
                                  <span className="truncate">
                                    {ch.spatialArrow} {t(ch.spatialLabel).slice(0, 4)}
                                  </span>
                                  <span className="font-mono-tabular shrink-0">{ch.tier}{t('指')}</span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 1: LIVE KINETIC PRACTICE */}
              {activeTab === 'practice' && currentCharEntry && (
                <div className="flex flex-col gap-5">
                  {/* Target Character & Radical Gesture Breakdown */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-3 px-4 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                    <div className="flex items-center gap-5">
                      <div
                        className={`w-24 h-24 rounded-2xl border flex items-center justify-center font-display text-6xl font-bold transition-transform duration-150 ${
                          errorFlash
                            ? 'border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)] scale-95'
                            : 'border-[var(--dojo-border-strong)] text-[var(--dojo-text-bright)]'
                        }`}
                      >
                        {currentCharEntry.char}
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--dojo-text-sub)]">
                          <span>
                            {blockMode === 'connected' ? t('相連氣塊拆勢') : t('宇浩／靈明拆字')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {cursorIdx + 1} / {orderedChars.length}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {t('準確率')} {accuracy}%
                          </span>
                          {currentCharEntry.rawParts.length > currentCharEntry.parts.length && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[var(--dojo-ochre)]">
                                {t('已合並相連筆畫')}: {currentCharEntry.rawParts.join('+')} → {currentCharEntry.parts.join(' ')}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Radical Gesture Event Sequence */}
                        <div className="flex flex-wrap items-center gap-2">
                          {currentCharEntry.radicals.map((rad, rIdx) => {
                            const totalRads = currentCharEntry.radicals.length;
                            let activeEventIdx = 0;
                            if (rhythmMode === 'heshi_1k') {
                              activeEventIdx = typed.length;
                            } else if (rhythmMode === 'heshi_compact') {
                              if (totalRads === 1) activeEventIdx = 0;
                              else if (totalRads === 2) activeEventIdx = typed.length < 2 ? 0 : 1;
                              else activeEventIdx = typed.length;
                            } else {
                              activeEventIdx = Math.floor(typed.length / 2);
                            }

                            const isSequentialMode = rhythmMode !== 'fixed4';
                            const isActiveEvent = isSequentialMode && rIdx === activeEventIdx;
                            const isDoneEvent = isSequentialMode && rIdx < activeEventIdx;
                            const isMiddleSkipped =
                              rhythmMode === 'fixed4' &&
                              totalRads >= 3 &&
                              rIdx > 0 &&
                              rIdx < totalRads - 1 &&
                              rIdx !== 1;

                            let cueCode = `${rad.key1.key.toUpperCase()}→${rad.key2.key.toUpperCase()}`;
                            if (rhythmMode === 'heshi_1k') {
                              cueCode = `${t('合十')} ${rad.heshiKey.key.toUpperCase()}`;
                            } else if (rhythmMode === 'heshi_compact') {
                              if (totalRads === 1) {
                                cueCode = `${rad.key1.key.toUpperCase()}→${rad.key2.key.toUpperCase()}`;
                              } else if (totalRads === 2) {
                                cueCode =
                                  rIdx === 0
                                    ? `${rad.key1.key.toUpperCase()}→${rad.key2.key.toUpperCase()}`
                                    : `${t('合十')} ${rad.heshiKey.key.toUpperCase()}`;
                              } else {
                                cueCode = `${t('合十')} ${rad.heshiKey.key.toUpperCase()}`;
                              }
                            } else if (rhythmMode === 'fixed4' && totalRads >= 3) {
                              if (rIdx === 1) cueCode = `${rad.key1.key.toUpperCase()}·`;
                              else if (rIdx === totalRads - 1) cueCode = `·${rad.key2.key.toUpperCase()}`;
                            }

                            return (
                              <div
                                key={`${rad.radical}_${rIdx}`}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                                  isActiveEvent
                                    ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)]'
                                    : isDoneEvent
                                      ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)]'
                                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)]'
                                } ${isMiddleSkipped ? 'opacity-45' : ''}`}
                              >
                                <span className="text-lg font-display font-bold text-[var(--dojo-text-bright)]">
                                  {rad.radical}
                                </span>
                                <span className="text-xs text-[var(--dojo-text-sub)]">
                                  {INITIAL_STROKE_META[rad.originStroke].symbol}{t('起')}→{t(ENDING_VECTOR_META[rad.endingVector].short)}
                                </span>
                                {!blindMode && (
                                  <span className="font-mono-tabular text-xs font-bold text-[var(--dojo-pine-text)]">
                                    {isMiddleSkipped ? t('略') : cueCode}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Live Keystroke Progress Slots */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {currentCharEntry.keySpecs.map((ks, kIdx) => {
                            const filled = kIdx < typed.length;
                            const isCurrent = kIdx === typed.length;
                            const isDualBoundary =
                              rhythmMode === 'event_stream' ||
                              (rhythmMode === 'heshi_compact' && currentCharEntry.radicals.length <= 2)
                                ? kIdx > 0 && kIdx % 2 === 0
                                : false;
                            return (
                              <React.Fragment key={`${ks.key}_${kIdx}`}>
                                {isDualBoundary && (
                                  <span aria-hidden="true" className="text-xs text-[var(--dojo-text-muted)] px-0.5">
                                    ·
                                  </span>
                                )}
                                <div
                                  className={`h-9 min-w-[44px] px-2.5 rounded-lg border flex items-center justify-center gap-1 font-mono-tabular text-xs font-bold transition-all ${
                                    filled
                                      ? 'bg-[var(--dojo-pine)] border-[var(--dojo-pine)] text-white'
                                      : isCurrent
                                        ? errorFlash
                                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                                          : 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] text-[var(--dojo-text-bright)]'
                                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text-muted)]'
                                  }`}
                                >
                                  <span>{ks.hand === 'L' ? t('左') : t('右')}</span>
                                  {!blindMode || filled ? (
                                    <span className="uppercase">{ks.key}</span>
                                  ) : (
                                    <span>{ks.row === 'top' ? '↑' : ks.row === 'bot' ? '↓' : '—'}</span>
                                  )}
                                </div>
                              </React.Fragment>
                            );
                          })}
                          <span className="ml-2 text-xs text-[var(--dojo-text-muted)]">
                            {t('直接敲擊鍵盤 · Esc 清空 · → 跳字')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Intent Flow Diagram (意向流向圖): Smooth Bezier Momentum Across Radicals */}
                  {intentFlowModel && (
                    <div className="p-3.5 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Wind className="w-3.5 h-3.5 text-[var(--dojo-ochre)] shrink-0" />
                          <span className="text-xs font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
                            {t('意向流向圖')}
                          </span>
                          <span aria-hidden="true" className="text-xs text-[var(--dojo-text-muted)]">·</span>
                          <span className="text-xs text-[var(--dojo-text-sub)] truncate">
                            {(() => {
                              if (hoveredFlowStep !== null && intentFlowModel.segments[hoveredFlowStep]) {
                                return t(intentFlowModel.segments[hoveredFlowStep].label);
                              }
                              if (activeFlowProgress === 0 && intentFlowModel.nodes[0]) {
                                const first = intentFlowModel.nodes[0];
                                return `${t('起勢預備')}：${first.radical} · ${INITIAL_STROKE_META[first.originStroke].symbol}${t('起')} → ${t(ENDING_VECTOR_META[first.endingVector].short)}`;
                              }
                              const activeSegIdx = activeFlowProgress - 1;
                              const activeSeg = intentFlowModel.segments[activeSegIdx];
                              if (activeSeg) {
                                return `${t('氣勢流動中')}：${t(activeSeg.label)}`;
                              }
                              const lastNode = intentFlowModel.nodes[intentFlowModel.nodes.length - 1];
                              return lastNode
                                ? `${t('收勢落印')}：${lastNode.radical} · ${t(ENDING_VECTOR_META[lastNode.endingVector].cue)}`
                                : t('沿筆勢流向連續擊鍵');
                            })()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[var(--dojo-text-muted)] shrink-0">
                          <span className="hidden sm:inline-flex items-center gap-1.5">
                            <span className="inline-block w-3 h-0.5 bg-[var(--dojo-pine)]" />
                            <span>{t('已落筆')}</span>
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-1.5">
                            <span className="inline-block w-3 h-0.5 bg-[var(--dojo-ochre)]" />
                            <span>{t('氣脈流動')}</span>
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-1.5">
                            <span className="inline-block w-3 border-t border-dashed border-[var(--dojo-text-muted)]" />
                            <span>{t('待續流向')}</span>
                          </span>

                          <button
                            type="button"
                            onClick={toggleReplay}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] text-[11px] font-medium text-[var(--dojo-text)] transition-colors cursor-pointer whitespace-nowrap"
                          >
                            {replayStep !== null ? (
                              <>
                                <Square className="w-2.5 h-2.5" />
                                <span>{t('停止')}</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-2.5 h-2.5" />
                                <span>{t('演練流向')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="w-full overflow-x-auto">
                        <svg
                          viewBox="0 0 640 168"
                          role="img"
                          aria-label={t('字根起筆與收勢意向流向貝塞爾圖')}
                          className="w-full min-w-[480px] h-[156px] block"
                        >
                          <defs>
                            <marker
                              id="flow-arrow-done"
                              viewBox="0 0 10 10"
                              refX="7"
                              refY="5"
                              markerWidth="5"
                              markerHeight="5"
                              orient="auto-start-reverse"
                            >
                              <path
                                d="M 0 1.5 L 9 5 L 0 8.5 z"
                                fill={isWash ? '#141413' : '#2ea87e'}
                              />
                            </marker>
                            <marker
                              id="flow-arrow-active"
                              viewBox="0 0 10 10"
                              refX="7"
                              refY="5"
                              markerWidth="5.5"
                              markerHeight="5.5"
                              orient="auto-start-reverse"
                            >
                              <path
                                d="M 0 1 L 10 5 L 0 9 z"
                                fill={isWash ? '#141413' : '#d89b3c'}
                              />
                            </marker>
                            <marker
                              id="flow-arrow-upcoming"
                              viewBox="0 0 10 10"
                              refX="7"
                              refY="5"
                              markerWidth="4.5"
                              markerHeight="4.5"
                              orient="auto-start-reverse"
                            >
                              <path
                                d="M 0 2 L 8 5 L 0 8 z"
                                fill={isWash ? '#75756f' : '#70798a'}
                              />
                            </marker>
                          </defs>

                          {/* Three Spatial Horizon Guides (上揚 / 中宮 / 下散) */}
                          {[
                            { y: 42, label: t('上揚聚頂') },
                            { y: 86, label: t('中宮平定') },
                            { y: 130, label: t('垂落張散') },
                          ].map((band) => (
                            <g key={band.y}>
                              <line
                                x1="46"
                                y1={band.y}
                                x2="616"
                                y2={band.y}
                                stroke="var(--dojo-border)"
                                strokeWidth="1"
                                strokeDasharray={band.y === 86 ? undefined : '2 4'}
                              />
                              <text
                                x="6"
                                y={band.y + 3}
                                fontSize="9"
                                fill="var(--dojo-text-muted)"
                              >
                                {band.label}
                              </text>
                            </g>
                          ))}

                          {/* Radical Enclosure Zones */}
                          {intentFlowModel.radicalGroups.map((grp) => {
                            const padX = grp.x1 === grp.x2 ? 36 : 28;
                            const rx = grp.x1 - padX;
                            const rw = grp.x2 - grp.x1 + padX * 2;
                            const isCurrentRad =
                              intentFlowModel.nodes[
                                Math.min(
                                  intentFlowModel.nodes.length - 1,
                                  activeFlowProgress
                                )
                              ]?.radicalIdx === grp.radicalIdx;
                            return (
                              <g key={`${grp.radical}_${grp.radicalIdx}`}>
                                <rect
                                  x={rx}
                                  y={16}
                                  width={rw}
                                  height={138}
                                  rx={10}
                                  fill={
                                    isCurrentRad
                                      ? isWash
                                        ? 'rgba(20,20,18,0.035)'
                                        : 'rgba(216,155,60,0.055)'
                                      : 'transparent'
                                  }
                                  stroke={
                                    isCurrentRad
                                      ? isWash
                                        ? 'rgba(20,20,18,0.22)'
                                        : 'rgba(216,155,60,0.34)'
                                      : 'var(--dojo-border)'
                                  }
                                  strokeWidth="1"
                                  strokeDasharray={isCurrentRad ? undefined : '3 3'}
                                />
                                <text
                                  x={(grp.x1 + grp.x2) / 2}
                                  y={30}
                                  textAnchor="middle"
                                  fontSize="13"
                                  fontWeight="700"
                                  className="font-display"
                                  fill={
                                    isCurrentRad
                                      ? 'var(--dojo-text-bright)'
                                      : 'var(--dojo-text-sub)'
                                  }
                                >
                                  {grp.radical}
                                </text>
                              </g>
                            );
                          })}

                          {/* Entry Lead-in Stroke Bezier */}
                          {intentFlowModel.entryTailD && (
                            <path
                              key={`entry_${currentCharEntry.char}_${activeFlowProgress === 0 ? 'active' : 'done'}`}
                              d={intentFlowModel.entryTailD}
                              pathLength={1}
                              fill="none"
                              stroke={
                                activeFlowProgress === 0
                                  ? isWash
                                    ? '#141413'
                                    : '#d89b3c'
                                  : isWash
                                    ? '#141413'
                                    : '#2ea87e'
                              }
                              strokeWidth={activeFlowProgress === 0 ? 2.6 : 2}
                              strokeOpacity={activeFlowProgress === 0 ? 0.92 : 0.72}
                              strokeLinecap="round"
                              className={activeFlowProgress === 0 ? 'kinetic-bezier-draw' : undefined}
                              markerEnd={
                                activeFlowProgress === 0
                                  ? 'url(#flow-arrow-active)'
                                  : 'url(#flow-arrow-done)'
                              }
                            />
                          )}

                          {/* Exit Momentum Tail Bezier */}
                          {intentFlowModel.exitTailD && (
                            <path
                              key={`exit_${currentCharEntry.char}_${activeFlowProgress >= intentFlowModel.nodes.length ? 'active' : 'wait'}`}
                              d={intentFlowModel.exitTailD}
                              pathLength={1}
                              fill="none"
                              stroke={
                                activeFlowProgress >= intentFlowModel.nodes.length
                                  ? isWash
                                    ? '#141413'
                                    : '#d89b3c'
                                  : isWash
                                    ? '#75756f'
                                    : '#70798a'
                              }
                              strokeWidth={
                                activeFlowProgress >= intentFlowModel.nodes.length ? 2.6 : 1.5
                              }
                              strokeDasharray={
                                activeFlowProgress >= intentFlowModel.nodes.length
                                  ? undefined
                                  : '3 4'
                              }
                              strokeOpacity={
                                activeFlowProgress >= intentFlowModel.nodes.length ? 0.92 : 0.45
                              }
                              strokeLinecap="round"
                              className={
                                activeFlowProgress >= intentFlowModel.nodes.length
                                  ? 'kinetic-bezier-draw'
                                  : undefined
                              }
                              markerEnd={
                                activeFlowProgress >= intentFlowModel.nodes.length
                                  ? 'url(#flow-arrow-active)'
                                  : 'url(#flow-arrow-upcoming)'
                              }
                            />
                          )}

                          {/* Segment Cubic Bezier Curves (Intra-Radical + Inter-Radical Bridge) */}
                          {intentFlowModel.segments.map((seg) => {
                            const isDone = seg.idx < activeFlowProgress - 1;
                            const isActive = seg.idx === activeFlowProgress - 1;
                            const isHovered = hoveredFlowStep === seg.idx;
                            const activeStroke = isWash ? '#141413' : '#d89b3c';
                            const doneStroke = isWash ? '#242422' : '#2ea87e';
                            const upcomingStroke = isWash ? '#75756f' : '#70798a';

                            return (
                              <g
                                key={`${currentCharEntry.char}_seg_${seg.idx}`}
                                onMouseEnter={() => setHoveredFlowStep(seg.idx)}
                                onMouseLeave={() => setHoveredFlowStep(null)}
                                className="cursor-pointer"
                              >
                                {/* Wide invisible hit target for easy hover */}
                                <path d={seg.d} fill="none" stroke="transparent" strokeWidth="14" />

                                {/* Soft qi glow under active or hovered curve */}
                                {(isActive || isHovered) && (
                                  <path
                                    d={seg.d}
                                    fill="none"
                                    stroke={activeStroke}
                                    strokeWidth="8"
                                    strokeOpacity={isWash ? 0.14 : 0.22}
                                    strokeLinecap="round"
                                  />
                                )}

                                <path
                                  key={
                                    isActive
                                      ? `active_${currentCharEntry.char}_${seg.idx}_${activeFlowProgress}`
                                      : `static_${seg.idx}`
                                  }
                                  d={seg.d}
                                  pathLength={isActive ? 1 : undefined}
                                  fill="none"
                                  stroke={
                                    isActive || isHovered
                                      ? activeStroke
                                      : isDone
                                        ? doneStroke
                                        : upcomingStroke
                                  }
                                  strokeWidth={isActive || isHovered ? 3.2 : isDone ? 2.6 : 1.75}
                                  strokeDasharray={
                                    !isActive && !isDone
                                      ? seg.kind === 'bridge'
                                        ? '5 4'
                                        : '3 3'
                                      : undefined
                                  }
                                  strokeOpacity={
                                    isActive || isHovered ? 0.96 : isDone ? 0.85 : 0.48
                                  }
                                  strokeLinecap="round"
                                  className={isActive ? 'kinetic-bezier-draw' : undefined}
                                  markerEnd={
                                    isActive || isHovered
                                      ? 'url(#flow-arrow-active)'
                                      : isDone
                                        ? 'url(#flow-arrow-done)'
                                        : 'url(#flow-arrow-upcoming)'
                                  }
                                />

                                {/* Traveling Qi Particle along Active Bezier Curve */}
                                {isActive && !prefersReducedMotion && (
                                  <circle
                                    r="3.8"
                                    fill={isWash ? '#141413' : '#fff9ee'}
                                    stroke={activeStroke}
                                    strokeWidth="1.5"
                                  >
                                    <animateMotion
                                      dur="0.72s"
                                      repeatCount="indefinite"
                                      path={seg.d}
                                    />
                                  </circle>
                                )}
                              </g>
                            );
                          })}

                          {/* Keystroke Nodes along Flow Path */}
                          {intentFlowModel.nodes.map((node) => {
                            const isDone = node.keyIdx < activeFlowProgress;
                            const isCurrent = node.keyIdx === activeFlowProgress;
                            const nodeFill = isDone
                              ? isWash
                                ? '#242422'
                                : '#2ea87e'
                              : isCurrent
                                ? isWash
                                  ? '#141413'
                                  : '#d89b3c'
                                : 'var(--dojo-surface)';
                            const nodeStroke = isDone
                              ? isWash
                                ? '#242422'
                                : '#2ea87e'
                              : isCurrent
                                ? isWash
                                  ? '#141413'
                                  : '#d89b3c'
                                : 'var(--dojo-border-strong)';
                            const nodeTextColor =
                              isDone || isCurrent ? '#fff9ee' : 'var(--dojo-text-bright)';

                            return (
                              <g key={`node_${node.keyIdx}`}>
                                {isCurrent && (
                                  <circle
                                    cx={node.x}
                                    cy={node.y}
                                    r="18"
                                    fill="none"
                                    stroke={isWash ? '#141413' : '#d89b3c'}
                                    strokeWidth="1.25"
                                    strokeOpacity="0.45"
                                    strokeDasharray="3 2"
                                  />
                                )}
                                <circle
                                  cx={node.x}
                                  cy={node.y}
                                  r={isCurrent ? 13 : 11}
                                  fill={nodeFill}
                                  stroke={nodeStroke}
                                  strokeWidth="1.75"
                                />
                                <text
                                  x={node.x}
                                  y={node.y + 4}
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight="700"
                                  className="font-mono-tabular uppercase"
                                  fill={nodeTextColor}
                                >
                                  {!blindMode || isDone
                                    ? node.keySpec.key.toUpperCase()
                                    : node.role === 'origin'
                                      ? INITIAL_STROKE_META[node.originStroke].symbol
                                      : node.keySpec.hand === 'L'
                                        ? t('左')
                                        : t('右')}
                                </text>
                                <text
                                  x={node.x}
                                  y={163}
                                  textAnchor="middle"
                                  fontSize="9.5"
                                  fill={
                                    isCurrent
                                      ? 'var(--dojo-text-bright)'
                                      : 'var(--dojo-text-muted)'
                                  }
                                >
                                  {t(node.cue)}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Direction x Distance Self-Delimiting A16 x B6 Live Reference Strip */}
                  {isKineticPrefixMode && (
                    <div className="p-3 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[var(--dojo-text-bright)]">
                          {t('動力學自分割 · A 區 16 鍵 (形區/肌動中碼) × B 區 6 鍵 (勢距終結)')}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-[var(--dojo-pine-text)]">
                          {t(
                            `前綴衝突 ${benchmark.kineticPrefix.prefixConflicts} (嚴格免空格) · 小指 ${benchmark.kineticPrefix.pinkyRate}% · 歐氏位移 ${benchmark.kineticPrefix.avgTravelPerChar}u`
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5">
                        <div className="xl:col-span-6 grid grid-cols-3 gap-1.5 text-[10px]">
                          <div className="px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
                            <div className="font-semibold text-[var(--dojo-text-bright)]">
                              {t('近距零移 (0.0u)')}
                            </div>
                            <div className="mt-0.5 font-mono-tabular font-bold uppercase text-[var(--dojo-pine-text)]">
                              F D S · J K L
                            </div>
                            <div className="text-[var(--dojo-text-muted)]">
                              {t('高頻核心字根主區')}
                            </div>
                          </div>
                          <div className="px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
                            <div className="font-semibold text-[var(--dojo-text-bright)]">
                              {t('上排中距 (~1.0u)')}
                            </div>
                            <div className="mt-0.5 font-mono-tabular font-bold uppercase text-[var(--dojo-text-bright)]">
                              R W T · U O Y
                            </div>
                            <div className="text-[var(--dojo-text-muted)]">
                              {t('次頻與上展方向')}
                            </div>
                          </div>
                          <div className="px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
                            <div className="font-semibold text-[var(--dojo-text-bright)]">
                              {t('下排遠距 (~1.1u)')}
                            </div>
                            <div className="mt-0.5 font-mono-tabular font-bold uppercase text-[var(--dojo-text-sub)]">
                              C X B · N
                            </div>
                            <div className="text-[var(--dojo-text-muted)]">
                              {t('低頻與下沉方向')}
                            </div>
                          </div>
                        </div>

                        <div className="xl:col-span-6 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {KINETIC_PREFIX_B_SPECS.map((bs) => {
                            const isActiveB =
                              activeGesturePreview?.k2.key === bs.key || expectedKey === bs.key;
                            return (
                              <div
                                key={bs.key}
                                title={t(bs.reachCue)}
                                className={`px-2 py-1.5 rounded-lg border flex flex-col items-center text-center transition-colors ${
                                  isActiveB
                                    ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] text-[var(--dojo-text-bright)]'
                                    : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)]'
                                }`}
                              >
                                <span className="font-mono-tabular text-xs font-bold uppercase text-[var(--dojo-ochre)]">
                                  {bs.key}
                                </span>
                                <span className="text-[10px] font-medium whitespace-nowrap">
                                  {bs.arrow} {t(bs.tierLabel.slice(0, 2))}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Home 4+4 / 3-Row Finger-Column x Opposite Compass Live Reference Strip */}
                  {isHomeDirMode && (
                    <div className="p-3 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[var(--dojo-text-bright)]">
                          {isThreeRowMode
                            ? t('三排 8 條同指縱柱 × 對側 8 方向羅盤')
                            : t('中排 4+4 起手分組 × 對側方向羅盤')}
                        </span>
                        <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
                          {t(
                            `獨立槽位 ${slotStats.uniqueSlots} 個 · 獨佔 ${slotStats.soloCount}/${slotStats.totalRadicals} 根 · 單槽最多 ${slotStats.maxShare} 根 · 首碼中排 ${slotStats.homeK1Pct}%`
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5">
                        {/* 8 Home Row Anchor Keys / Finger Columns */}
                        <div className="xl:col-span-7 grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                          {HOME_GROUP_ANCHORS.map((grp) => {
                            const disabledInStrictLr = altMode === 'strict_lr' && grp.hand === 'R';
                            const activeK1 = activeGesturePreview?.k1.key || '';
                            const isActiveHome = isThreeRowMode
                              ? grp.columnKeys.includes(activeK1)
                              : activeK1 === grp.key;
                            return (
                              <div
                                key={grp.key}
                                title={t(
                                  `${grp.groupTitle}（同指柱 ${grp.columnKeys.join('/').toUpperCase()}）：${grp.ruleCue} (${grp.anchorRadicals})`
                                )}
                                className={`px-2 py-1.5 rounded-lg border flex flex-col items-center text-center transition-colors ${
                                  disabledInStrictLr
                                    ? 'opacity-30 border-dashed border-[var(--dojo-border)]'
                                    : isActiveHome
                                      ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)]'
                                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)]'
                                }`}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="font-mono-tabular text-xs font-bold uppercase text-[var(--dojo-text-bright)]">
                                    {grp.key}
                                  </span>
                                  <span className="text-[10px] font-medium text-[var(--dojo-pine-text)]">
                                    {t(grp.shortTag)}
                                  </span>
                                </div>
                                {isThreeRowMode ? (
                                  <span className="mt-0.5 font-mono-tabular text-[9px] uppercase text-[var(--dojo-text-muted)] whitespace-nowrap">
                                    ↑{grp.topKey}
                                    {grp.botKey ? ` ↓${grp.botKey}` : ''}
                                  </span>
                                ) : (
                                  <span className="mt-0.5 text-[10px] text-[var(--dojo-text-muted)] truncate w-full">
                                    {grp.anchorRadicals.split(' ').slice(0, 3).join('')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Opposite-Hand 8 or 4 Direction Compass */}
                        <div className="xl:col-span-5 grid grid-cols-4 gap-1.5">
                          {(zoneId === 'home_dir4' ? OPPOSITE_DIR4_COMPASS : OPPOSITE_DIR8_COMPASS).map(
                            (dir) => {
                              const activeK2 = activeGesturePreview?.k2.key;
                              const isActiveDir =
                                activeK2 === dir.rightKey || activeK2 === dir.leftMirrorKey;
                              return (
                                <div
                                  key={dir.dirIdx}
                                  title={t(dir.cue)}
                                  className={`px-2 py-1 rounded-lg border flex items-center justify-between gap-1 text-[10px] transition-colors ${
                                    isActiveDir
                                      ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)] text-[var(--dojo-text-bright)]'
                                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text-sub)]'
                                  }`}
                                >
                                  <span className="font-medium whitespace-nowrap">
                                    {dir.arrow} {t(dir.label)}
                                  </span>
                                  <span className="font-mono-tabular font-bold uppercase text-[var(--dojo-text-muted)]">
                                    {altMode === 'strict_lr'
                                      ? dir.rightKey
                                      : `${dir.rightKey}/${dir.leftMirrorKey}`}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: INITIAL STROKE × ENDING VECTOR ATLAS */}
              {activeTab === 'atlas' && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {isKineticPrefixMode ? (
                      <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                        {(
                          [
                            { id: 'all', label: '全部字根' },
                            { id: 'xiao', label: '2 碼小根 (高頻)' },
                            { id: 'da', label: '3 碼大根 (對側中碼)' },
                            { id: 'home', label: '近距零移 FDS·JKL' },
                            { id: 'top', label: '上排中距 RWT·UOY' },
                            { id: 'bot', label: '下排遠距 CXB·N' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setActivePrefixFilter(f.id);
                            }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              activePrefixFilter === f.id
                                ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                            }`}
                          >
                            {t(f.label)}
                          </button>
                        ))}
                      </div>
                    ) : isHomeDirMode ? (
                      <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                        <button
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setActiveHomeFilter('all');
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            activeHomeFilter === 'all'
                              ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                              : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                          }`}
                        >
                          {isThreeRowMode ? t('全部 8 指柱') : t('全部中排 8 組')}
                        </button>
                        {HOME_GROUP_ANCHORS.map((grp) => (
                          <button
                            key={grp.key}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setActiveHomeFilter(grp.key);
                            }}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              activeHomeFilter === grp.key
                                ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                            }`}
                          >
                            <span className="uppercase font-mono-tabular mr-1">
                              {isThreeRowMode ? grp.columnKeys.join('') : grp.key}
                            </span>
                            {t(grp.shortTag)}
                          </button>
                        ))}
                        {zoneId === 'three_row_full26' && (
                          <button
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setActiveHomeFilter('wing');
                            }}
                            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              activeHomeFilter === 'wing'
                                ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                            }`}
                          >
                            <span className="uppercase font-mono-tabular mr-1">QAZP</span>
                            {t('外翼')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                        <button
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setActiveStrokeFilter('all');
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            activeStrokeFilter === 'all'
                              ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                              : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                          }`}
                        >
                          {t('全部五筆起勢')}
                        </button>
                        {(Object.keys(INITIAL_STROKE_META) as InitialStrokeId[]).map((sid) => (
                          <button
                            key={sid}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              setActiveStrokeFilter(sid);
                            }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              activeStrokeFilter === sid
                                ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                            }`}
                          >
                            {t(INITIAL_STROKE_META[sid].label)}
                          </button>
                        ))}
                      </div>
                    )}

                    <span className="text-xs text-[var(--dojo-text-sub)]">
                      {t('點選字根，下方鍵盤以箭頭繪出「起筆 → 去向」軌跡')}
                    </span>
                  </div>

                  {!isHomeDirMode && !isKineticPrefixMode && activeStrokeFilter !== 'all' && (
                    <div className="text-xs text-[var(--dojo-text-sub)] px-3 py-2 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                      <span className="font-semibold text-[var(--dojo-text-bright)]">
                        {t(INITIAL_STROKE_META[activeStrokeFilter].fingerCue)}
                      </span>
                      <span aria-hidden="true" className="mx-2">·</span>
                      <span>{t(INITIAL_STROKE_META[activeStrokeFilter].calligraphyCue)}</span>
                    </div>
                  )}

                  {isKineticPrefixMode ? (
                    <div className="px-3 py-2 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--dojo-text-sub)]">
                      <span className="font-semibold text-[var(--dojo-text-bright)]">
                        {t('動力學自分割聚類規則')}
                      </span>
                      <span>
                        {t(
                          '每張卡片右側同時顯示「動力碼 (大碼+對側中碼?+B區勢距終結)」與「/原靈明音託碼」，方便直接對比手感差異'
                        )}
                      </span>
                    </div>
                  ) : isHomeDirMode ? (
                    <div className="px-3 py-2 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--dojo-text-sub)]">
                      <span className="font-semibold text-[var(--dojo-text-bright)]">
                        {isThreeRowMode ? t('三排同指柱分層規則') : t('高頻優先佔位規則')}
                      </span>
                      <span>
                        {zoneId === 'three_row_full26'
                          ? t(
                              `已啟用全 26 鍵獨立槽位：${slotStats.soloCount}/${slotStats.totalRadicals} 個字根 1 對 1 零重碼，高頻 ${slotStats.homeK1Pct}% 仍穩居舒適中排，僅極罕用尾根落入 Q/A/Z/P 外翼`
                            )
                          : zoneId === 'three_row_dir8'
                            ? t(
                                `零小指三排 22 鍵共 ${slotStats.uniqueSlots} 個獨立槽位：前 64 高頻根全佔中排（貢獻 ${slotStats.homeK1Pct}% 頻次），次頻上排、低頻下排，單槽最多僅 ${slotStats.maxShare} 根`
                              )
                            : t(
                                `僅用中排起手共有 ${slotStats.uniqueSlots} 個槽位（單槽最多併 ${slotStats.maxShare} 根）；若要覆蓋宇浩全 269 根不重碼，建議切換至「三排指柱」或「三排全 26 鍵」`
                              )}
                      </span>
                    </div>
                  ) : (
                    /* Compact Praying-Hands Mirror Reference Bar */
                    <div className="px-3 py-2 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--dojo-text-sub)]">
                      <span className="font-semibold text-[var(--dojo-text-bright)]">
                        {t('手指合十鏡像')}
                      </span>
                      {HESHI_MIRROR_PAIRS.slice(0, 6).map((p) => (
                        <span key={p.leftKey} className="font-mono-tabular whitespace-nowrap">
                          <strong className="uppercase text-[var(--dojo-text-bright)]">
                            {p.leftKey}↔{p.rightKey}
                          </strong>{' '}
                          {t(p.expansionLabel)}
                        </span>
                      ))}
                      <span className="text-[var(--dojo-text-muted)]">
                        {t('左：橫撇折 ｜ 右：豎點')}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                    {visibleAtlasRadicals.map((rad: KineticRadicalSpec) => {
                      const active = inspectedRadical === rad.radical;
                      return (
                        <button
                          key={rad.radical}
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            speech.speakGlyph(rad.radical);
                            setInspectedRadical(rad.radical);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)]'
                              : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-display text-xl font-bold text-[var(--dojo-text-bright)]">
                                {rad.radical}
                              </span>
                              <span className="font-mono-tabular text-[10px] text-[var(--dojo-text-muted)]">
                                ×{rad.freq}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono-tabular text-xs font-bold uppercase">
                              {isKineticPrefixMode ? (
                                <>
                                  <span className="text-[var(--dojo-pine-text)]">
                                    {rad.dyad}
                                  </span>
                                  {rad.lingmingMa && (
                                    <span
                                      className="text-[10px] font-normal text-[var(--dojo-text-muted)]"
                                      title={t(`靈明原版音託碼：${rad.lingmingMa.toUpperCase()}`)}
                                    >
                                      /{rad.lingmingMa}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {!isHomeDirMode && (
                                    <>
                                      <span className="text-[var(--dojo-ochre)]" title={t(rad.heshiCue)}>
                                        {rad.heshiKey.key}
                                      </span>
                                      <span className="text-[var(--dojo-text-muted)] font-normal">/</span>
                                    </>
                                  )}
                                  <span className="text-[var(--dojo-pine-text)]">
                                    {rad.key1.key}→{rad.key2.key}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div
                            className="mt-1 text-[11px] text-[var(--dojo-text-sub)] truncate"
                            title={t(
                              isKineticPrefixMode || isHomeDirMode ? rad.intentCue : rad.heshiCue
                            )}
                          >
                            {t(isKineticPrefixMode || isHomeDirMode ? rad.intentCue : rad.heshiCue)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: COLLISION & DISTANCE AUDIT */}
              {activeTab === 'audit' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Distance from Center Bridge FG|HJ */}
                    <div className="p-3.5 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                      <div className="text-xs font-semibold text-[var(--dojo-text-bright)] mb-2.5">
                        {t('距中宮樞紐 (G/H) 指距分佈')}
                      </div>
                      <div className="flex flex-col gap-2">
                        {[
                          { label: 'd=0 · 中軸內橋 (G / H / Y / N)', idx: 0 },
                          { label: 'd=1 · 食指本位 (F / J / R / U / V / M)', idx: 1 },
                          { label: 'd=2 · 中指中距 (D / K / E / I / C)', idx: 2 },
                          { label: 'd=3 · 無名外翼 (S / L / W / O / X)', idx: 3 },
                        ].map((row) => {
                          const pct = Math.round(
                            (auditStats.distCounts[row.idx] / auditStats.total) * 100
                          );
                          return (
                            <div key={row.idx} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-xs text-[var(--dojo-text-sub)]">
                                <span>{t(row.label)}</span>
                                <span className="font-mono-tabular font-semibold text-[var(--dojo-text-bright)]">
                                  {pct}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[var(--dojo-surface)] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[var(--dojo-pine)]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row Direction Distribution */}
                    <div className="p-3.5 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                      <div className="text-xs font-semibold text-[var(--dojo-text-bright)] mb-2.5">
                        {t('上下氣韻行位分佈（無小指外緣）')}
                      </div>
                      <div className="flex flex-col gap-2">
                        {[
                          { label: '上排升騰 · 覆舉之勢', key: 'top' as const, color: 'bg-[var(--dojo-ochre)]' },
                          { label: '中排中宮 · 定樁立骨', key: 'home' as const, color: 'bg-[var(--dojo-pine)]' },
                          { label: '下排沉降 · 流脈落根', key: 'bot' as const, color: 'bg-[var(--dojo-crimson)]' },
                        ].map((r) => {
                          const pct = Math.round(
                            (auditStats.rowCounts[r.key] / auditStats.total) * 100
                          );
                          return (
                            <div key={r.key} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-xs text-[var(--dojo-text-sub)]">
                                <span>{t(r.label)}</span>
                                <span className="font-mono-tabular font-semibold text-[var(--dojo-text-bright)]">
                                  {pct}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[var(--dojo-surface)] overflow-hidden">
                                <div className={`h-full rounded-full ${r.color}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Real Collision List */}
                  <div className="p-3.5 rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-[var(--dojo-text-bright)]">
                        {t('當前範圍重碼組檢視')}（{sim.collisions.length} {t('組')}）
                      </span>
                      <span className="text-[var(--dojo-text-muted)]">
                        {t('點選漢字可直接切換至試打測試')}
                      </span>
                    </div>
                    {sim.collisions.length === 0 ? (
                      <div className="text-xs text-[var(--dojo-pine-text)] py-3">
                        {t('當前測試範圍零重碼！')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                        {sim.collisions.slice(0, 24).map((grp) => (
                          <div
                            key={grp.code}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-xs"
                          >
                            <span className="font-mono-tabular font-bold uppercase text-[var(--dojo-ochre)]">
                              {grp.code}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {grp.chars.map((c) => (
                                <button
                                  key={c.char}
                                  type="button"
                                  onClick={() => jumpToChar(c.char)}
                                  className="px-1.5 py-0.5 rounded hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] cursor-pointer"
                                  title={`${c.parts.join(' + ')}`}
                                >
                                  {c.char}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: OFFICIAL LINGMING (PHONETIC) VS KINETIC (DIRECTION x DISTANCE) A/B BENCHMARK */}
              {activeTab === 'benchmark' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--dojo-text-bright)]">
                        {t(
                          `同庫宇浩拆分 A/B 實測（${benchmark.totalChars} 字 · 音託原版 vs 方向×距離重聚類）`
                        )}
                      </h3>
                      <p className="text-xs text-[var(--dojo-text-sub)] mt-0.5">
                        {t(
                          '完全共用同一套宇浩字根拆分與四碼自分割文法，僅把「聲韻母音託」替換為「肌肉方向×遠近距離」'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setZoneId('kinetic_prefix22');
                        setBlockMode('yuhao');
                        setRhythmMode('fixed4');
                        setActiveTab('practice');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--dojo-pine)] text-white hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>{t('立即上手試打動力學自分割')}</span>
                    </button>
                  </div>

                  {/* Quantitative Comparison Table */}
                  <div className="rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--dojo-border)] text-[var(--dojo-text-muted)]">
                          <th className="py-2.5 px-3 font-semibold whitespace-nowrap">{t('實測維度')}</th>
                          <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                            {t('靈明原版 (音託 25 鍵)')}
                          </th>
                          <th className="py-2.5 px-3 font-semibold whitespace-nowrap text-[var(--dojo-pine-text)]">
                            {t('動力學自分割 (方向×距離 22 鍵)')}
                          </th>
                          <th className="py-2.5 px-3 font-semibold whitespace-nowrap">{t('相對變化')}</th>
                          <th className="py-2.5 px-3 font-semibold whitespace-nowrap text-[var(--dojo-text-muted)]">
                            {t('三排事件流參考')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--dojo-border)] font-mono-tabular">
                        {[
                          {
                            label: '免空格自分割 (前綴衝突)',
                            lm: `${benchmark.lingming.prefixConflicts}`,
                            kin: `${benchmark.kineticPrefix.prefixConflicts}`,
                            ref: `${benchmark.threeRowDir8.prefixConflicts}`,
                            delta: t('打平 · 嚴格免空格'),
                            good: true,
                          },
                          {
                            label: '無重碼首選率',
                            lm: `${benchmark.lingming.uniqueRate.toFixed(2)}% (${benchmark.lingming.collisionChars}重)`,
                            kin: `${benchmark.kineticPrefix.uniqueRate.toFixed(2)}% (${benchmark.kineticPrefix.collisionChars}重)`,
                            ref: `${benchmark.threeRowDir8.uniqueRate.toFixed(2)}%`,
                            delta: `${(benchmark.kineticPrefix.uniqueRate - benchmark.lingming.uniqueRate).toFixed(2)}%`,
                            good: benchmark.kineticPrefix.uniqueRate >= benchmark.lingming.uniqueRate,
                          },
                          {
                            label: '平均碼長 (鍵/字)',
                            lm: `${benchmark.lingming.avgCodeLength.toFixed(2)}`,
                            kin: `${benchmark.kineticPrefix.avgCodeLength.toFixed(2)}`,
                            ref: `${benchmark.threeRowDir8.avgCodeLength.toFixed(2)}`,
                            delta: `${benchmark.kineticPrefix.avgCodeLength - benchmark.lingming.avgCodeLength >= 0 ? '+' : ''}${(benchmark.kineticPrefix.avgCodeLength - benchmark.lingming.avgCodeLength).toFixed(2)}`,
                            good: benchmark.kineticPrefix.avgCodeLength <= benchmark.lingming.avgCodeLength + 0.06,
                          },
                          {
                            label: '左右手交替率',
                            lm: `${benchmark.lingming.altRate.toFixed(1)}%`,
                            kin: `${benchmark.kineticPrefix.altRate.toFixed(1)}%`,
                            ref: `${benchmark.threeRowDir8.altRate.toFixed(1)}%`,
                            delta: `+${(benchmark.kineticPrefix.altRate - benchmark.lingming.altRate).toFixed(1)}%`,
                            good: benchmark.kineticPrefix.altRate > benchmark.lingming.altRate,
                          },
                          {
                            label: '中排舒適區命中率',
                            lm: `${benchmark.lingming.homeRate.toFixed(1)}%`,
                            kin: `${benchmark.kineticPrefix.homeRate.toFixed(1)}%`,
                            ref: `${benchmark.threeRowDir8.homeRate.toFixed(1)}%`,
                            delta: `+${(benchmark.kineticPrefix.homeRate - benchmark.lingming.homeRate).toFixed(1)}%`,
                            good: benchmark.kineticPrefix.homeRate > benchmark.lingming.homeRate,
                          },
                          {
                            label: '同指連擊 / 跨排率',
                            lm: `${benchmark.lingming.sameFingerRate.toFixed(2)}%`,
                            kin: `${benchmark.kineticPrefix.sameFingerRate.toFixed(2)}%`,
                            ref: `${benchmark.threeRowDir8.sameFingerRate.toFixed(2)}%`,
                            delta: `${(benchmark.kineticPrefix.sameFingerRate - benchmark.lingming.sameFingerRate).toFixed(2)}%`,
                            good: benchmark.kineticPrefix.sameFingerRate < benchmark.lingming.sameFingerRate,
                          },
                          {
                            label: '小指負擔率 (Q/A/Z/P)',
                            lm: `${benchmark.lingming.pinkyRate.toFixed(2)}%`,
                            kin: `${benchmark.kineticPrefix.pinkyRate.toFixed(2)}%`,
                            ref: `${benchmark.threeRowDir8.pinkyRate.toFixed(2)}%`,
                            delta: t('歸零 (-100%)'),
                            good: true,
                          },
                          {
                            label: '單字手指歐氏位移',
                            lm: `${benchmark.lingming.avgTravelPerChar.toFixed(2)} u`,
                            kin: `${benchmark.kineticPrefix.avgTravelPerChar.toFixed(2)} u`,
                            ref: `${benchmark.threeRowDir8.avgTravelPerChar.toFixed(2)} u`,
                            delta: `${Math.round(((benchmark.kineticPrefix.avgTravelPerChar - benchmark.lingming.avgTravelPerChar) / Math.max(0.01, benchmark.lingming.avgTravelPerChar)) * 100)}%`,
                            good: benchmark.kineticPrefix.avgTravelPerChar < benchmark.lingming.avgTravelPerChar,
                          },
                        ].map((row) => (
                          <tr key={row.label} className="hover:bg-[var(--dojo-surface)]/60 transition-colors">
                            <td className="py-2 px-3 font-sans font-medium text-[var(--dojo-text-bright)] whitespace-nowrap">
                              {t(row.label)}
                            </td>
                            <td className="py-2 px-3 text-[var(--dojo-text-sub)] whitespace-nowrap">
                              {row.lm}
                            </td>
                            <td className="py-2 px-3 font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
                              {row.kin}
                            </td>
                            <td
                              className={`py-2 px-3 font-semibold whitespace-nowrap ${
                                row.good ? 'text-[var(--dojo-pine-text)]' : 'text-[var(--dojo-ochre)]'
                              }`}
                            >
                              {row.delta}
                            </td>
                            <td className="py-2 px-3 text-[var(--dojo-text-muted)] whitespace-nowrap">
                              {row.ref}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Side-by-Side Tradeoff Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]">
                      <div className="font-bold text-[var(--dojo-pine-text)] mb-1">
                        {t('肌肉動力學重聚類的核心紅利')}
                      </div>
                      <p className="text-[var(--dojo-text-sub)] leading-relaxed">
                        {t(
                          '在完全保留「免空格自分割」與 3.7x 短碼長的前提下，擺脫英文母音鍵位綁架：小指負擔徹底歸零，同指跨排近乎砍半，手指總位移縮短逾兩成，中排與左右交替均大幅提升。'
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]">
                      <div className="font-bold text-[var(--dojo-ochre)] mb-1">
                        {t('誠實的代價與學習曲線觀察')}
                      </div>
                      <p className="text-[var(--dojo-text-sub)] leading-relaxed">
                        {t(
                          '因少用 3 個小指鍵（22 鍵 vs 25 鍵），無重碼率略低 1.2～1.6%；上手初期無法靠拼音直覺反推小碼，但熟練後不需在「字形→讀音→英文鍵」間二次翻譯，有望直接形成純空間肌肉反射。'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Sample Characters Side-by-Side Comparison */}
                  <div className="p-3.5 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <span className="text-xs font-semibold text-[var(--dojo-text-bright)]">
                        {t('同字實戰擊鍵對比（點選任一字立即跳入動力學試打）')}
                      </span>
                      <span className="text-[11px] text-[var(--dojo-text-muted)]">
                        {t('位移單位 u = 標準鍵帽寬距 19.05mm')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                      {benchmark.samples.map((sp) => (
                        <button
                          key={sp.char}
                          type="button"
                          onClick={() => {
                            setZoneId('kinetic_prefix22');
                            setBlockMode('yuhao');
                            setRhythmMode('fixed4');
                            jumpToChar(sp.char);
                          }}
                          className="p-2.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] hover:border-[var(--dojo-pine)] text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)]">
                                {sp.char}
                              </span>
                              <span className="text-[10px] text-[var(--dojo-text-muted)]">
                                {sp.parts.join('＋')}
                              </span>
                            </div>
                            <span
                              className={`font-mono-tabular text-[10px] font-semibold ${
                                sp.kineticTravel <= sp.lingmingTravel
                                  ? 'text-[var(--dojo-pine-text)]'
                                  : 'text-[var(--dojo-ochre)]'
                              }`}
                            >
                              {sp.kineticTravel <= sp.lingmingTravel
                                ? `-${(sp.lingmingTravel - sp.kineticTravel).toFixed(2)}u`
                                : `+${(sp.kineticTravel - sp.lingmingTravel).toFixed(2)}u`}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono-tabular">
                            <span className="text-[var(--dojo-text-muted)]">
                              {t('靈明')}{' '}
                              <strong className="uppercase text-[var(--dojo-text-sub)]">
                                {sp.lingmingCode}
                              </strong>{' '}
                              ({sp.lingmingTravel}u
                              {sp.lingmingHasSameFinger ? `·${t('同指')}` : ''}
                              {sp.lingmingHasPinky ? `·${t('小指')}` : ''})
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between text-[11px] font-mono-tabular">
                            <span className="text-[var(--dojo-pine-text)]">
                              {t('動力')}{' '}
                              <strong className="uppercase text-[var(--dojo-text-bright)]">
                                {sp.kineticCode}
                              </strong>{' '}
                              ({sp.kineticTravel}u · {t('交')}{sp.kineticAltPct}%)
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Ergonomic Keyboard Map with Center Bridge & Alternating Arc / Piano Chord Vectors */}
              <div className="pt-2 border-t border-[var(--dojo-border)] flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-[var(--dojo-text-sub)]">
                    {activeTab === 'piano' ? (
                      <>
                        <Music className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                        {pianoPlayMode === 'drill' && currentPianoBeat ? (
                          <span>
                            <strong className="text-[var(--dojo-text-bright)] font-display text-sm mr-1">
                              {currentPianoBeat.radical}
                            </strong>
                            <span className="font-mono-tabular font-bold text-[var(--dojo-ochre)] mr-1.5">
                              {currentPianoBeat.displayChord}
                            </span>
                            <span>
                              {currentPianoBeat.spatialArrow} {t(currentPianoBeat.spatialLabel)}
                            </span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>{t(currentPianoBeat.fingerCue)}</span>
                          </span>
                        ) : (
                          <span>
                            {t('雙手鋼琴鍵盤：中排 8 鍵為主根家族，對側各排同時落指形成對角方位張力（紅＝當前按住）')}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--dojo-pine)]" />
                        {activeGesturePreview ? (
                          <span>
                            <strong className="text-[var(--dojo-text-bright)] font-display text-sm mr-1">
                              {activeGesturePreview.label}
                            </strong>
                            <span>{t(activeGesturePreview.qiLabel)}</span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span className="font-mono-tabular">
                              {activeGesturePreview.isSingleHeshi
                                ? `${activeGesturePreview.k1.finger}(${activeGesturePreview.k1.key.toUpperCase()})${
                                    activeGesturePreview.mirrorKey
                                      ? ` ∥ ${t('合十對映')} ${activeGesturePreview.mirrorKey.toUpperCase()}`
                                      : ''
                                  }`
                                : `${activeGesturePreview.k1.finger}(${activeGesturePreview.k1.key.toUpperCase()}) ↔ ${activeGesturePreview.k2.finger}(${activeGesturePreview.k2.key.toUpperCase()})`}
                            </span>
                          </span>
                        ) : (
                          <span>{t(ZONE_DEFINITIONS[zoneId].subtitle)}</span>
                        )}
                      </>
                    )}
                  </div>

                  <span className="text-[11px] text-[var(--dojo-text-muted)]">
                    {activeTab === 'piano'
                      ? t('金框＝中排主根 · 綠框＝對側方位鍵 · 紅框＝當前正按住（不分順序）')
                      : t('亮框為 FG | HJ 中宮樞紐 · 虛線中軸為手指合十鏡像面')}
                  </span>
                </div>

                {/* Keyboard Canvas */}
                <div className="w-full overflow-x-auto pb-1">
                  <div className="relative mx-auto w-[636px] h-[196px] rounded-xl bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                    {/* Center Hand Divider Line */}
                    <div
                      aria-hidden="true"
                      className="absolute top-3 bottom-3 border-l border-dashed border-[var(--dojo-border-strong)]"
                      style={{ left: '316px' }}
                    />

                    {/* Simultaneous Piano Chord Tension Geometry Overlay */}
                    {activeTab === 'piano' && (() => {
                      const activeChordKeys =
                        pianoBufferKeys.length > 0
                          ? pianoBufferKeys
                          : pianoPlayMode === 'drill' && currentPianoBeat
                            ? currentPianoBeat.displayKeys
                            : pianoLastEvent?.keys ?? [];
                      const centers = activeChordKeys
                        .map((k) => ({ key: k, pt: getKeyCenter(k) }))
                        .filter((item): item is { key: string; pt: { x: number; y: number } } =>
                          Boolean(item.pt)
                        );
                      if (centers.length === 0) return null;
                      const isLiveHeld = pianoBufferKeys.length > 0;
                      const lineColor = isLiveHeld
                        ? isWash
                          ? '#9E2A2B'
                          : '#F06A6A'
                        : isWash
                          ? '#141413'
                          : '#D89B3C';
                      const secondaryColor = isWash ? '#1E5B4C' : '#43E8B0';

                      return (
                        <svg
                          viewBox="0 0 636 196"
                          className="pointer-events-none absolute inset-0 w-full h-full z-20"
                        >
                          {centers.length === 1 ? (
                            <circle
                              cx={centers[0].pt.x}
                              cy={centers[0].pt.y}
                              r="24"
                              fill="none"
                              stroke={lineColor}
                              strokeWidth="2.5"
                              strokeOpacity="0.88"
                            />
                          ) : (
                            <>
                              {centers.slice(1).map((c) => (
                                <line
                                  key={`chord_vec_${centers[0].key}_${c.key}`}
                                  x1={centers[0].pt.x}
                                  y1={centers[0].pt.y}
                                  x2={c.pt.x}
                                  y2={c.pt.y}
                                  stroke={lineColor}
                                  strokeWidth="3"
                                  strokeOpacity="0.88"
                                  strokeLinecap="round"
                                />
                              ))}
                              {centers.length === 3 && (
                                <line
                                  x1={centers[1].pt.x}
                                  y1={centers[1].pt.y}
                                  x2={centers[2].pt.x}
                                  y2={centers[2].pt.y}
                                  stroke={secondaryColor}
                                  strokeWidth="2"
                                  strokeDasharray="4 3"
                                  strokeOpacity="0.78"
                                />
                              )}
                              {centers.map((c, idx) => (
                                <circle
                                  key={`chord_node_${c.key}`}
                                  cx={c.pt.x}
                                  cy={c.pt.y}
                                  r={idx === 0 ? 5.5 : 4.5}
                                  fill={idx === 0 ? lineColor : secondaryColor}
                                />
                              ))}
                            </>
                          )}
                        </svg>
                      );
                    })()}

                    {/* Multi-Step Trajectory Bezier Flow (Practice) or Single Gesture Arc / Heshi Ring (Atlas) */}
                    {activeTab !== 'piano' &&
                      ((activeTab === 'practice' && keyboardFlowSegments.length > 0) ||
                        (arcGeom && activeGesturePreview)) && (
                        <svg
                          viewBox="0 0 636 196"
                          className="pointer-events-none absolute inset-0 w-full h-full z-20"
                        >
                          <defs>
                            <marker
                              id="kinetic-arrow-head"
                              viewBox="0 0 10 10"
                              refX="8"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path
                                d="M 0 1 L 10 5 L 0 9 z"
                                fill={isWash ? '#141413' : '#43E8B0'}
                              />
                            </marker>
                            <marker
                              id="kinetic-arrow-ochre"
                              viewBox="0 0 10 10"
                              refX="8"
                              refY="5"
                              markerWidth="6"
                              markerHeight="6"
                              orient="auto-start-reverse"
                            >
                              <path
                                d="M 0 1 L 10 5 L 0 9 z"
                                fill={isWash ? '#141413' : '#D89B3C'}
                              />
                            </marker>
                          </defs>
                          {activeTab === 'practice' && keyboardFlowSegments.length > 0 ? (
                            <>
                              {keyboardFlowSegments.map((seg) => {
                                const isDone = seg.idx < activeFlowProgress - 1;
                                const isActive = seg.idx === activeFlowProgress - 1;
                                if (blindMode && !isDone && !isActive) return null;
                                const strokeColor = isActive
                                  ? isWash
                                    ? '#141413'
                                    : '#D89B3C'
                                  : isDone
                                    ? isWash
                                      ? '#242422'
                                      : '#43E8B0'
                                    : isWash
                                      ? '#75756f'
                                      : '#43E8B0';
                                return (
                                  <g key={`kb_flow_${seg.idx}`}>
                                    <path
                                      key={
                                        isActive
                                          ? `kb_act_${currentCharEntry?.char}_${seg.idx}_${activeFlowProgress}`
                                          : `kb_st_${seg.idx}`
                                      }
                                      d={seg.d}
                                      pathLength={isActive ? 1 : undefined}
                                      fill="none"
                                      stroke={strokeColor}
                                      strokeWidth={isActive ? 2.8 : isDone ? 2.2 : 1.5}
                                      strokeDasharray={
                                        isDone ? undefined : isActive ? undefined : '4 4'
                                      }
                                      strokeOpacity={isActive ? 0.95 : isDone ? 0.78 : 0.42}
                                      strokeLinecap="round"
                                      className={isActive ? 'kinetic-bezier-draw' : undefined}
                                      markerEnd={
                                        isActive
                                          ? 'url(#kinetic-arrow-ochre)'
                                          : 'url(#kinetic-arrow-head)'
                                      }
                                    />
                                    {isActive && (
                                      <circle
                                        cx={seg.p1.x}
                                        cy={seg.p1.y}
                                        r="4"
                                        fill={isWash ? '#141413' : '#D89B3C'}
                                      />
                                    )}
                                  </g>
                                );
                              })}
                            </>
                          ) : (
                            arcGeom &&
                            activeGesturePreview &&
                            (!activeGesturePreview.isSingleHeshi ? (
                              <>
                                <path
                                  d={arcGeom.d}
                                  fill="none"
                                  stroke={isWash ? '#141413' : '#43E8B0'}
                                  strokeWidth="2.5"
                                  strokeDasharray="5 4"
                                  strokeOpacity="0.88"
                                  markerEnd="url(#kinetic-arrow-head)"
                                />
                                <circle
                                  cx={arcGeom.p1.x}
                                  cy={arcGeom.p1.y}
                                  r="4.5"
                                  fill={isWash ? '#141413' : '#D89B3C'}
                                />
                              </>
                            ) : (
                              <>
                                <circle
                                  cx={arcGeom.p1.x}
                                  cy={arcGeom.p1.y}
                                  r="22"
                                  fill="none"
                                  stroke={isWash ? '#141413' : '#D89B3C'}
                                  strokeWidth="2"
                                  strokeOpacity="0.85"
                                />
                                {(() => {
                                  const mCenter = activeGesturePreview.mirrorKey
                                    ? getKeyCenter(activeGesturePreview.mirrorKey)
                                    : null;
                                  if (!mCenter) return null;
                                  return (
                                    <>
                                      <line
                                        x1={arcGeom.p1.x}
                                        y1={arcGeom.p1.y}
                                        x2={mCenter.x}
                                        y2={mCenter.y}
                                        stroke={isWash ? '#141413' : '#43E8B0'}
                                        strokeWidth="1.5"
                                        strokeDasharray="3 4"
                                        strokeOpacity="0.55"
                                      />
                                      <circle
                                        cx={mCenter.x}
                                        cy={mCenter.y}
                                        r="18"
                                        fill="none"
                                        stroke={isWash ? '#141413' : '#43E8B0'}
                                        strokeWidth="1.5"
                                        strokeDasharray="3 3"
                                        strokeOpacity="0.65"
                                      />
                                    </>
                                  );
                                })()}
                              </>
                            ))
                          )}
                        </svg>
                      )}

                    {/* Physical Keys */}
                    {FULL_QWERTY_ROWS.map((row, rIdx) =>
                      row.map((cell, cIdx) => {
                        const extraGap = cell.hand === 'R' ? 22 : 0;
                        const left = 16 + ROW_STAGGER_PX[rIdx] + cIdx * KEY_PITCH_X + extraGap;
                        const top = 16 + rIdx * KEY_PITCH_Y;

                        if (activeTab === 'piano') {
                          const isPureShape26 = pianoChordMode === 'dyad_unique';
                          const isPureShapeKeycap =
                            pianoChordMode === 'dyad_unique' || pianoChordMode === 'dyad_intuitive';
                          const pMeta = isPureShape26
                            ? PIANO_FULL26_KEYS[cell.key]
                            : PIANO_COMFORT_KEYS[cell.key];
                          const inPianoZone = Boolean(pMeta);
                          const isHeld = pianoHeldKeys.includes(cell.key);
                          const isInBuffer = pianoBufferKeys.includes(cell.key);
                          const isPianoHome =
                            (PIANO_HOME_KEYS as readonly string[]).includes(cell.key) ||
                            (isPureShape26 && cell.key === 'a');
                          const homeInfo = pianoSim.homeClusterSummary.find(
                            (h) => h.homeKey === cell.key
                          );
                          const isTargetAnchor =
                            pianoPlayMode === 'drill' &&
                            Boolean(currentPianoBeat?.keys.includes(cell.key)) &&
                            currentPianoBeat?.displayKeys[0] === cell.key;
                          const isTargetSpatial =
                            pianoPlayMode === 'drill' &&
                            Boolean(currentPianoBeat?.keys.includes(cell.key)) &&
                            !isTargetAnchor;
                          const isFreeLastKey =
                            pianoPlayMode === 'freeplay' &&
                            Boolean(pianoLastEvent?.keys.includes(cell.key));
                          const soloRadLabel = isPureShape26
                            ? PURE_SHAPE_SOLO_26_BY_KEY[cell.key]
                            : PURE_SHAPE_SOLO_BY_KEY[cell.key];
                          const pureShapeTag =
                            cell.hand === 'L'
                              ? PURE_SHAPE_LEFT_MAP.get(cell.key as PureShapeLeftKey)?.shortTag ??
                                PURE_SHAPE_EXT_KEY_TAGS[cell.key]?.shortTag ??
                                ''
                              : PURE_SHAPE_RIGHT_MAP.get(cell.key as PureShapeRightKey)?.shortTag ??
                                PURE_SHAPE_EXT_KEY_TAGS[cell.key]?.shortTag ??
                                '';

                          return (
                            <button
                              key={cell.key}
                              type="button"
                              disabled={!inPianoZone}
                              onClick={() => {
                                if (!inPianoZone) return;
                                synth.playPianoNote(cell.key, pianoSoundOn);
                              }}
                              title={
                                pMeta
                                  ? `${t(pMeta.fingerLabel)} ${cell.key.toUpperCase()} (${pMeta.noteName})`
                                  : t('外翼鍵區在零小指模式下停用')
                              }
                              style={{
                                left: `${left}px`,
                                top: `${top}px`,
                                width: `${KEY_W}px`,
                                height: `${KEY_H}px`,
                              }}
                              className={`absolute rounded-lg border flex flex-col items-center justify-center transition-all duration-100 ${
                                !inPianoZone
                                  ? 'opacity-20 border-dashed border-[var(--dojo-border)] bg-transparent text-[var(--dojo-text-muted)] cursor-default'
                                  : isHeld || isInBuffer
                                    ? 'z-30 border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-text-bright)] scale-95 shadow-inner cursor-pointer'
                                    : isTargetAnchor
                                      ? 'z-10 border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] text-[var(--dojo-text-bright)] scale-105 shadow-sm cursor-pointer'
                                      : isTargetSpatial || isFreeLastKey
                                        ? 'z-10 border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)] text-[var(--dojo-text-bright)] scale-105 shadow-sm cursor-pointer'
                                        : isPianoHome
                                          ? 'border-[var(--dojo-border-strong)] bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] hover:border-[var(--dojo-ochre)]/60 cursor-pointer'
                                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text)] hover:border-[var(--dojo-pine)]/60 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-baseline gap-0.5 leading-none">
                                <span className="font-mono-tabular text-xs font-bold uppercase">
                                  {cell.key}
                                </span>
                                {inPianoZone && isPureShapeKeycap && soloRadLabel && (
                                  <span className="font-display text-[11px] font-bold text-[var(--dojo-text-bright)]">
                                    {soloRadLabel}
                                  </span>
                                )}
                              </div>
                              {inPianoZone && (
                                <span
                                  className={`mt-1 text-[9px] leading-none whitespace-nowrap ${
                                    isPureShapeKeycap
                                      ? cell.hand === 'L'
                                        ? 'text-[var(--dojo-ochre)] font-semibold'
                                        : 'text-[var(--dojo-pine-text)] font-semibold'
                                      : isPianoHome
                                        ? 'text-[var(--dojo-ochre)] font-semibold'
                                        : 'text-[var(--dojo-text-muted)] font-mono-tabular'
                                  }`}
                                >
                                  {isPureShapeKeycap
                                    ? t(pureShapeTag)
                                    : homeInfo
                                      ? `${homeInfo.soloRadical}·${t(homeInfo.shortTag).slice(0, 1)}`
                                      : pMeta.noteName}
                                </span>
                              )}
                            </button>
                          );
                        }

                        const inZone = activeKeySet.has(cell.key);
                        const spec = keySpecByChar.get(cell.key);
                        const isBridge =
                          cell.key === 'f' ||
                          cell.key === 'g' ||
                          cell.key === 'h' ||
                          cell.key === 'j';
                        const isArcStart = activeGesturePreview?.k1.key === cell.key;
                        const isArcEnd = activeGesturePreview?.k2.key === cell.key;
                        const isExpected = expectedKey === cell.key && !blindMode;
                        const isHeshiDisplay =
                          !isHomeDirMode &&
                          (rhythmMode === 'heshi_1k' || Boolean(activeGesturePreview?.isSingleHeshi));
                        const heshiMirror = mirrorMap.get(cell.key);
                        const prefixBMeta = isKineticPrefixMode
                          ? KINETIC_PREFIX_B_SPECS.find((b) => b.key === cell.key)
                          : undefined;
                        const homeGroupMeta = isHomeDirMode
                          ? HOME_GROUP_ANCHORS.find((h) => h.key === cell.key)
                          : undefined;
                        const colGroupMeta = isThreeRowMode
                          ? HOME_GROUP_ANCHORS.find((h) => h.columnKeys.includes(cell.key))
                          : undefined;
                        const dirCompassMeta = isHomeDirMode
                          ? (zoneId === 'home_dir4' ? OPPOSITE_DIR4_COMPASS : OPPOSITE_DIR8_COMPASS).find(
                              (d) => d.rightKey === cell.key || d.leftMirrorKey === cell.key
                            )
                          : undefined;
                        const isOuterWing =
                          zoneId === 'three_row_full26' &&
                          (cell.key === 'q' || cell.key === 'a' || cell.key === 'z' || cell.key === 'p');
                        const roleHint = isKineticPrefixMode
                          ? prefixBMeta
                            ? t(prefixBMeta.shortTag)
                            : inZone
                              ? rIdx === 1
                                ? t('A零移')
                                : rIdx === 0
                                  ? t('A上')
                                  : t('A下')
                              : ''
                          : isHomeDirMode
                            ? homeGroupMeta
                              ? t(homeGroupMeta.shortTag)
                              : dirCompassMeta
                                ? t(dirCompassMeta.short)
                                : colGroupMeta
                                  ? `${colGroupMeta.key.toUpperCase()}${rIdx === 0 ? '↑' : '↓'}`
                                  : isOuterWing
                                    ? t('外翼')
                                    : ''
                            : isHeshiDisplay && heshiMirror
                              ? t(heshiMirror.expansion).slice(0, 2)
                              : spec?.strokeId
                                ? INITIAL_STROKE_META[spec.strokeId].symbol
                                : spec?.vectorId
                                  ? t(ENDING_VECTOR_META[spec.vectorId].short)
                                  : '';
                        const isPrefixBKey = isKineticPrefixMode && KINETIC_PREFIX_B_SET.has(cell.key);

                        return (
                          <div
                            key={cell.key}
                            title={spec ? t(spec.qiCue) : undefined}
                            style={{ left: `${left}px`, top: `${top}px`, width: `${KEY_W}px`, height: `${KEY_H}px` }}
                            className={`absolute rounded-lg border flex flex-col items-center justify-center transition-all duration-150 ${
                              !inZone
                                ? 'opacity-22 border-dashed border-[var(--dojo-border)] bg-transparent text-[var(--dojo-text-muted)]'
                                : isExpected
                                  ? 'z-10 border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)] text-[var(--dojo-text-bright)] scale-105 shadow-sm'
                                  : isArcStart || isArcEnd
                                    ? 'z-10 border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)] text-[var(--dojo-text-bright)]'
                                    : isPrefixBKey
                                      ? 'border-[var(--dojo-ochre)]/45 bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                      : isBridge
                                        ? 'border-[var(--dojo-border-strong)] bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-[var(--dojo-text)]'
                            }`}
                          >
                            <span className="font-mono-tabular text-xs font-bold uppercase leading-none">
                              {cell.key}
                            </span>
                            {inZone && spec && (
                              <span
                                className={`mt-1 text-[9px] leading-none whitespace-nowrap ${
                                  isPrefixBKey
                                    ? 'text-[var(--dojo-ochre)] font-semibold'
                                    : 'text-[var(--dojo-text-sub)]'
                                }`}
                              >
                                {roleHint}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* RIGHT ZONE: Corpus Browser & Quick Verification Lookup */}
            <aside className="lg:col-span-4 flex flex-col gap-3 p-5 rounded-2xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[var(--dojo-text-bright)]">
                  {activeTab === 'piano' ? t('鋼琴和弦譜抽檢') : t('拆字與動作碼抽檢')}
                </h2>
                <span className="font-mono-tabular text-xs text-[var(--dojo-text-muted)]">
                  {activeTab === 'piano'
                    ? `${pianoCompletedChars.size} / ${pianoDeckChars.length} ${t('已奏')}`
                    : `${completedChars.size} / ${orderedChars.length} ${t('已練')}`}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--dojo-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'piano'
                      ? t('輸入漢字、字根或和弦 (如 明、f+m)...')
                      : t('輸入漢字、字根或編碼 (如 fj)...')
                  }
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text-bright)] placeholder:text-[var(--dojo-text-muted)] focus:outline-none focus:border-[var(--dojo-pine)]"
                />
              </div>

              <div className="flex flex-col gap-1.5 max-h-[410px] overflow-y-auto pr-1">
                {activeTab === 'piano' ? (
                  (() => {
                    const q = searchQuery.trim().toLowerCase();
                    const list = q
                      ? pianoDeckChars.filter(
                          (item) =>
                            item.char.includes(q) ||
                            item.parts.some((p) => p.includes(q)) ||
                            item.signatureSequence.includes(q)
                        )
                      : pianoDeckChars.slice(0, 80);

                    if (list.length === 0) {
                      return (
                        <div className="py-8 text-center text-xs text-[var(--dojo-text-muted)]">
                          {t('當前階段字庫未收錄該字，可切換至「三階 500 字」或「全庫」')}
                        </div>
                      );
                    }

                    return list.map((item) => {
                      const isActive = currentPianoChar?.char === item.char;
                      const isDone = pianoCompletedChars.has(item.char);
                      return (
                        <button
                          key={`piano_${item.char}`}
                          type="button"
                          onClick={() => jumpToChar(item.char)}
                          className={`w-full px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'border-[var(--dojo-ochre)] bg-[var(--dojo-ochre-wash)]'
                              : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)] shrink-0">
                              {item.char}
                            </span>
                            <span className="text-xs text-[var(--dojo-text-sub)] truncate">
                              {item.parts.join(' · ')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono-tabular text-[11px] font-bold text-[var(--dojo-ochre)]">
                              {item.displaySequence}
                            </span>
                            <span className="font-mono-tabular text-[10px] text-[var(--dojo-text-muted)]">
                              {item.beatCount}{t('拍')}
                              {isDone ? ' ✓' : ''}
                            </span>
                          </div>
                        </button>
                      );
                    });
                  })()
                ) : filteredCorpusChars.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--dojo-text-muted)]">
                    {t('當前階段字庫未收錄該字，可切換至「三階 500 字」或「全庫」')}
                  </div>
                ) : (
                  filteredCorpusChars.map((item) => {
                    const isActive = currentCharEntry?.char === item.char;
                    const isDone = completedChars.has(item.char);
                    return (
                      <button
                        key={item.char}
                        type="button"
                        onClick={() => jumpToChar(item.char)}
                        className={`w-full px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)]'
                            : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)] shrink-0">
                            {item.char}
                          </span>
                          <span className="text-xs text-[var(--dojo-text-sub)] truncate">
                            {item.parts.join(' + ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-tabular text-xs font-bold uppercase text-[var(--dojo-pine-text)]">
                            {item.code}
                          </span>
                          <span className="font-mono-tabular text-[10px] text-[var(--dojo-text-muted)]">
                            {item.alternationCount}/{item.transitionCount}
                            {isDone ? ' ✓' : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};
