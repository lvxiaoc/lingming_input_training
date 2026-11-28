import {
  ENDING_VECTOR_META,
  EndingVectorId,
  HOME_GROUP_ANCHORS,
  inferRadicalKinesthetics,
  InitialStrokeId,
  KineticStageId,
  runKineticSimulation,
} from './kineticCodeSystem';
import { LINGMING_ROOT_MAP } from './lingming';
import {
  getPureShapeRadicalSpec,
  getPureShapeRightKey,
  getWholeCharSecondBeatSpec,
  PURE_SHAPE_EXT_KEY_TAGS,
  PURE_SHAPE_LEFT_FAMILIES,
  PURE_SHAPE_LEFT_MAP,
  PURE_SHAPE_RIGHT_MAP,
  PURE_SHAPE_SOLO_26,
  PURE_SHAPE_SOLO_RADICALS,
  TRAD_TO_SIMP_TWIN,
} from './pureShapeRadicals';
import { CharScript, ScriptMode } from './scriptFilter';

export type PianoFingerGroup = 'L5' | 'L4' | 'L3' | 'L2' | 'R2' | 'R3' | 'R4' | 'R5';
export type PianoChordTier = 1 | 2 | 3;
export type PianoChordMode = 'dyad_unique' | 'dyad_intuitive' | 'dyad_balanced' | 'triad_unique';
export type PianoSpatialShapeId =
  | 'solo_anchor'
  | 'horiz_bridge'
  | 'diag_up_right'
  | 'diag_down_right'
  | 'diag_up_left'
  | 'diag_down_left'
  | 'triad_up'
  | 'triad_level'
  | 'triad_down';

export interface PianoKeyMeta {
  key: string;
  hand: 'L' | 'R';
  row: 'top' | 'home' | 'bot';
  rowVal: 1 | 0 | -1; // +1 top, 0 home, -1 bot
  col: number; // 1..8 (zero pinky!)
  fingerGroup: PianoFingerGroup;
  fingerLabel: string;
  isHome: boolean;
  noteName: string;
}

export interface FixedDirectionRule {
  vectorId: EndingVectorId;
  arrow: string;
  label: string;
  short: string;
  rightKey: string; // Pressed by Right hand when Home Anchor is Left (S/D/F/G)
  leftMirrorKey: string; // Pressed by Left hand when Home Anchor is Right (H/J/K/L)
  rowTier: 'top' | 'home' | 'bot';
  cue: string;
}

// 10 Fixed, Mirror-Symmetric Spatial Direction Keys (100% invariant — human-deducible!)
export const PIANO_FIXED_DIRECTION_RULES: FixedDirectionRule[] = [
  { vectorId: 'up_gather', arrow: '↖', label: '聚頂上收', short: '聚頂', rightKey: 'y', leftMirrorKey: 't', rowTier: 'top', cue: '上排內側：頂蓋聚收' },
  { vectorId: 'up_lift', arrow: '↑', label: '微揚上提', short: '上提', rightKey: 'u', leftMirrorKey: 'r', rowTier: 'top', cue: '上排食指：挑提上揚' },
  { vectorId: 'up_right_open', arrow: '↗', label: '右上開口', short: '右上開', rightKey: 'i', leftMirrorKey: 'e', rowTier: 'top', cue: '上排中指：向上敞開' },
  { vectorId: 'up_right_far', arrow: '↗', label: '遠翼高展', short: '高展', rightKey: 'o', leftMirrorKey: 'w', rowTier: 'top', cue: '上排無名：遠距斜展' },
  { vectorId: 'center_close', arrow: '←', label: '歸中封口', short: '封口', rightKey: 'h', leftMirrorKey: 'g', rowTier: 'home', cue: '中排內側：封口合抱' },
  { vectorId: 'center_settle', arrow: '●', label: '中宮平定', short: '平定', rightKey: 'j', leftMirrorKey: 'f', rowTier: 'home', cue: '中排食指：橫平豎正' },
  { vectorId: 'center_spread', arrow: '↔', label: '並立分撐', short: '分撐', rightKey: 'k', leftMirrorKey: 'd', rowTier: 'home', cue: '中排中指：左右撐立' },
  { vectorId: 'right_extend', arrow: '→', label: '右展拖勢', short: '右展', rightKey: 'l', leftMirrorKey: 's', rowTier: 'home', cue: '中排無名：向右拖展' },
  { vectorId: 'down_plumb', arrow: '↓', label: '垂豎直落', short: '垂落', rightKey: 'n', leftMirrorKey: 'b', rowTier: 'bot', cue: '下排內側：一豎直垂' },
  { vectorId: 'down_splay', arrow: '↘', label: '撇捺下散', short: '下散', rightKey: 'm', leftMirrorKey: 'v', rowTier: 'bot', cue: '下排食指：下盤張散' },
];

const FIXED_DIR_BY_VECTOR = new Map<EndingVectorId, FixedDirectionRule>(
  PIANO_FIXED_DIRECTION_RULES.map((r) => [r.vectorId, r])
);

export interface PianoChordSpec {
  radical: string;
  freq: number;
  inCorpus: boolean; // false for the 12 ultra-rare Yuhao roots not present in the 1448 drill corpus
  originStroke: InitialStrokeId;
  endingVector: EndingVectorId;
  homeAnchorKey: string; // Core home cluster key: s/d/f/g/h/j/k/l
  homeAnchorLabel: string; // e.g., "F · 橫基定樁"
  homeShortTag: string; // e.g., "橫基"
  keys: string[]; // Canonical sorted lowercase keys, e.g. ['f', 'm']
  displayKeys: string[]; // Ergonomic display order: [homeAnchorKey, ...outerKeys]
  signature: string; // Order-independent sorted key signature: 'f+m'
  displayChord: string; // e.g. 'F+M'
  tier: PianoChordTier; // 1 = solo home tap, 2 = 2-finger cross-hand, 3 = 3-finger piano triad
  isCrossHand: boolean;
  spatialShape: PianoSpatialShapeId;
  spatialArrow: string;
  spatialLabel: string;
  directionRuleCue: string; // Clear human-deducible explanation, e.g., "F(橫基) + M(↘下散)"
  fingerCue: string; // e.g. "左食指 F + 右食指 M"
  ergonomicCost: number;
  sharedSiblingsCount: number; // How many radicals share this exact chord signature (1 in triad_unique)
}

export interface PianoChordCharEntry {
  char: string;
  script: CharScript;
  parts: string[];
  beats: PianoChordSpec[];
  beatCount: number;
  totalKeyPresses: number;
  signatureSequence: string; // e.g. "f+m · f"
  displaySequence: string; // e.g. "F+M · F"
  isCoreDrill: boolean;
  hasOnlyEasyBeats: boolean; // true if every beat is Tier 1 or Tier 2 (1–2 fingers)
}

export interface PianoChordCollisionGroup {
  signatureSequence: string;
  chars: PianoChordCharEntry[];
}

export interface PianoChordSimulationResult {
  mode: PianoChordMode;
  stageId: KineticStageId;
  scriptMode: ScriptMode;
  chords: PianoChordSpec[];
  chordByRadical: Map<string, PianoChordSpec>;
  chordBySignature: Map<string, PianoChordSpec>; // Primary (highest-frequency) radical on this chord
  chordsBySignature: Map<string, PianoChordSpec[]>; // All radicals sharing this chord (sorted by freq)
  chars: PianoChordCharEntry[];
  collisions: PianoChordCollisionGroup[];
  homeClusterSummary: Array<{
    homeKey: string;
    hand: 'L' | 'R';
    groupTitle: string;
    shortTag: string;
    soloRadical: string;
    totalRadicals: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
    sampleChords: PianoChordSpec[];
  }>;
  metrics: {
    totalChars: number;
    uniqueCodes: number;
    firstChoiceRate: number;
    compoundFirstChoiceRate: number; // Unique rate on 2+ radical compound characters
    collisionChars: number;
    avgBeatsPerChar: number;
    avgFingersPerBeat: number;
    maxFingersPerBeat: number;
    totalRadicals: number; // All 269 official Yuhao radicals!
    officialYuhaoTotal: number; // 269
    yuhaoCoveragePct: number; // 100.0%
    uniqueChordSlotsUsed: number;
    avgRadicalsPerSlot: number;
    slotUniquenessRate: number;
    tier1And2OccurrencePct: number; // 100% in dyad_intuitive & dyad_balanced!
    tier1OccurrencePct: number;
    tier2OccurrencePct: number;
    tier3OccurrencePct: number; // 0% in dyad_intuitive & dyad_balanced!
    crossHandBeatPct: number;
    pinkyRate: number; // strictly 0%
    sameFingerChordCount: number; // strictly 0
  };
}

export interface PianoModeComparison {
  dyadUnique: PianoChordSimulationResult;
  dyadIntuitive: PianoChordSimulationResult;
  dyadBalanced: PianoChordSimulationResult;
  triadUnique: PianoChordSimulationResult;
}

// 22 Zero-Pinky Comfort Keys with strict physical finger groups (no same-finger chords ever!)
export const PIANO_COMFORT_KEYS: Record<string, PianoKeyMeta> = {
  // Left Hand (Ring L4, Middle L3, Index L2)
  w: { key: 'w', hand: 'L', row: 'top', rowVal: 1, col: 1, fingerGroup: 'L4', fingerLabel: '左無名', isHome: false, noteName: 'G3' },
  s: { key: 's', hand: 'L', row: 'home', rowVal: 0, col: 1, fingerGroup: 'L4', fingerLabel: '左無名', isHome: true, noteName: 'F3' },
  x: { key: 'x', hand: 'L', row: 'bot', rowVal: -1, col: 1, fingerGroup: 'L4', fingerLabel: '左無名', isHome: false, noteName: 'E3' },

  e: { key: 'e', hand: 'L', row: 'top', rowVal: 1, col: 2, fingerGroup: 'L3', fingerLabel: '左中指', isHome: false, noteName: 'A3' },
  d: { key: 'd', hand: 'L', row: 'home', rowVal: 0, col: 2, fingerGroup: 'L3', fingerLabel: '左中指', isHome: true, noteName: 'G3' },
  c: { key: 'c', hand: 'L', row: 'bot', rowVal: -1, col: 2, fingerGroup: 'L3', fingerLabel: '左中指', isHome: false, noteName: 'G3' },

  r: { key: 'r', hand: 'L', row: 'top', rowVal: 1, col: 3, fingerGroup: 'L2', fingerLabel: '左食指', isHome: false, noteName: 'C4' },
  f: { key: 'f', hand: 'L', row: 'home', rowVal: 0, col: 3, fingerGroup: 'L2', fingerLabel: '左食指', isHome: true, noteName: 'A3' },
  v: { key: 'v', hand: 'L', row: 'bot', rowVal: -1, col: 3, fingerGroup: 'L2', fingerLabel: '左食指', isHome: false, noteName: 'B3' },

  t: { key: 't', hand: 'L', row: 'top', rowVal: 1, col: 4, fingerGroup: 'L2', fingerLabel: '左食內', isHome: false, noteName: 'D4' },
  g: { key: 'g', hand: 'L', row: 'home', rowVal: 0, col: 4, fingerGroup: 'L2', fingerLabel: '左食內', isHome: true, noteName: 'C4' },
  b: { key: 'b', hand: 'L', row: 'bot', rowVal: -1, col: 4, fingerGroup: 'L2', fingerLabel: '左食內', isHome: false, noteName: 'D4' },

  // Right Hand (Index R2, Middle R3, Ring R4)
  y: { key: 'y', hand: 'R', row: 'top', rowVal: 1, col: 5, fingerGroup: 'R2', fingerLabel: '右食內', isHome: false, noteName: 'E4' },
  h: { key: 'h', hand: 'R', row: 'home', rowVal: 0, col: 5, fingerGroup: 'R2', fingerLabel: '右食內', isHome: true, noteName: 'D4' },
  n: { key: 'n', hand: 'R', row: 'bot', rowVal: -1, col: 5, fingerGroup: 'R2', fingerLabel: '右食內', isHome: false, noteName: 'E4' },

  u: { key: 'u', hand: 'R', row: 'top', rowVal: 1, col: 6, fingerGroup: 'R2', fingerLabel: '右食指', isHome: false, noteName: 'G4' },
  j: { key: 'j', hand: 'R', row: 'home', rowVal: 0, col: 6, fingerGroup: 'R2', fingerLabel: '右食指', isHome: true, noteName: 'E4' },
  m: { key: 'm', hand: 'R', row: 'bot', rowVal: -1, col: 6, fingerGroup: 'R2', fingerLabel: '右食指', isHome: false, noteName: 'G4' },

  i: { key: 'i', hand: 'R', row: 'top', rowVal: 1, col: 7, fingerGroup: 'R3', fingerLabel: '右中指', isHome: false, noteName: 'A4' },
  k: { key: 'k', hand: 'R', row: 'home', rowVal: 0, col: 7, fingerGroup: 'R3', fingerLabel: '右中指', isHome: true, noteName: 'G4' },

  o: { key: 'o', hand: 'R', row: 'top', rowVal: 1, col: 8, fingerGroup: 'R4', fingerLabel: '右無名', isHome: false, noteName: 'C5' },
  l: { key: 'l', hand: 'R', row: 'home', rowVal: 0, col: 8, fingerGroup: 'R4', fingerLabel: '右無名', isHome: true, noteName: 'A4' },
};

// Pure 26-Letter QWERTY Map for Scheme A (15 Left x 11 Right = 165 cross-hand chords + 26 solo = 191 slots, ZERO punctuation!)
export const PIANO_FULL26_KEYS: Record<string, PianoKeyMeta> = {
  ...PIANO_COMFORT_KEYS,
  // Left Pinky 3 rows (Q A Z)
  q: { key: 'q', hand: 'L', row: 'top', rowVal: 1, col: 0, fingerGroup: 'L5', fingerLabel: '左小指', isHome: false, noteName: 'E3' },
  a: { key: 'a', hand: 'L', row: 'home', rowVal: 0, col: 0, fingerGroup: 'L5', fingerLabel: '左小指', isHome: true, noteName: 'D3' },
  z: { key: 'z', hand: 'L', row: 'bot', rowVal: -1, col: 0, fingerGroup: 'L5', fingerLabel: '左小指', isHome: false, noteName: 'C3' },
  // Right Top Pinky (P only — ZERO ; , . / punctuation keys!)
  p: { key: 'p', hand: 'R', row: 'top', rowVal: 1, col: 9, fingerGroup: 'R5', fingerLabel: '右小指', isHome: false, noteName: 'D5' },
};

export const PIANO_HOME_KEYS = ['s', 'd', 'f', 'g', 'h', 'j', 'k', 'l'] as const;
const LEFT_HOME_KEYS = ['s', 'd', 'f', 'g'];
const RIGHT_HOME_KEYS = ['h', 'j', 'k', 'l'];
const LEFT_ALL_KEYS = ['s', 'd', 'f', 'g', 'w', 'e', 'r', 't', 'x', 'c', 'v', 'b'];
const RIGHT_ALL_KEYS = ['h', 'j', 'k', 'l', 'y', 'u', 'i', 'o', 'n', 'm'];
const LEFT_FULL15_KEYS = ['a', 's', 'd', 'f', 'g', 'q', 'w', 'e', 'r', 't', 'z', 'x', 'c', 'v', 'b'];
const RIGHT_FULL11_KEYS = ['h', 'j', 'k', 'l', 'y', 'u', 'i', 'o', 'p', 'n', 'm'];

export function normalizeChordSignature(keys: Iterable<string>): string {
  return Array.from(
    new Set(
      Array.from(keys)
        .map((k) => k.trim().toLowerCase())
        .filter((k) => /^[a-z]$/.test(k))
    )
  )
    .sort()
    .join('+');
}

function getTargetVerticalBias(vec: EndingVectorId): 1 | 0 | -1 {
  if (
    vec === 'up_gather' ||
    vec === 'up_lift' ||
    vec === 'up_right_open' ||
    vec === 'up_right_far'
  ) {
    return 1;
  }
  if (vec === 'down_plumb' || vec === 'down_splay') {
    return -1;
  }
  return 0;
}

function getTargetHorizontalReach(vec: EndingVectorId): 'near' | 'mid' | 'far' {
  if (vec === 'up_gather' || vec === 'center_close' || vec === 'down_plumb') return 'near';
  if (vec === 'up_right_far' || vec === 'right_extend') return 'far';
  return 'mid';
}

interface CandidateChord {
  signature: string;
  keys: string[];
  displayKeys: string[];
  homeKey: string;
  tier: PianoChordTier;
  avgOppRow: number;
  oppReach: number;
  baseErgoCost: number;
  spatialShape: PianoSpatialShapeId;
  spatialArrow: string;
  spatialLabel: string;
}

function describeSpatialShape(
  homeKey: string,
  oppKeys: string[]
): {
  spatialShape: PianoSpatialShapeId;
  spatialArrow: string;
  spatialLabel: string;
} {
  if (oppKeys.length === 0) {
    return {
      spatialShape: 'solo_anchor',
      spatialArrow: '●',
      spatialLabel: '獨奏定錨',
    };
  }
  const homeMeta = PIANO_FULL26_KEYS[homeKey];
  const avgRow =
    oppKeys.reduce((sum, k) => sum + (PIANO_FULL26_KEYS[k]?.rowVal ?? 0), 0) / oppKeys.length;

  if (oppKeys.length === 1) {
    const opp = PIANO_FULL26_KEYS[oppKeys[0]];
    if (opp.rowVal === 0) {
      return {
        spatialShape: 'horiz_bridge',
        spatialArrow: '←→',
        spatialLabel: '橫橋合抱',
      };
    }
    if (homeMeta.hand === 'L') {
      return opp.rowVal > 0
        ? { spatialShape: 'diag_up_right', spatialArrow: '↙↗', spatialLabel: '右上斜展' }
        : { spatialShape: 'diag_down_right', spatialArrow: '↖↘', spatialLabel: '右下垂落' };
    } else {
      return opp.rowVal > 0
        ? { spatialShape: 'diag_up_left', spatialArrow: '↖↘', spatialLabel: '左上斜舉' }
        : { spatialShape: 'diag_down_left', spatialArrow: '↙↗', spatialLabel: '左下沉展' };
    }
  }

  if (avgRow >= 0.35) {
    return { spatialShape: 'triad_up', spatialArrow: '♫↑', spatialLabel: '三指上揚和弦' };
  }
  if (avgRow <= -0.35) {
    return { spatialShape: 'triad_down', spatialArrow: '♫↓', spatialLabel: '三指下沉和弦' };
  }
  return { spatialShape: 'triad_level', spatialArrow: '♫↔', spatialLabel: '三指平展和弦' };
}

function getKeyReachFromCenter(key: string): number {
  const meta = PIANO_COMFORT_KEYS[key];
  if (!meta) return 2;
  return meta.hand === 'L' ? 4 - meta.col : meta.col - 5; // 0..3
}

// Pre-build all 372 strictly distinct-finger, zero-pinky, order-independent candidate chords grouped by homeKey
function buildChordUniverse(): Map<string, CandidateChord[]> {
  const byHome = new Map<string, CandidateChord[]>();
  for (const hk of PIANO_HOME_KEYS) byHome.set(hk, []);

  // Tier 1: 8 Solo Home Taps
  for (const hk of PIANO_HOME_KEYS) {
    const shape = describeSpatialShape(hk, []);
    byHome.get(hk)!.push({
      signature: hk,
      keys: [hk],
      displayKeys: [hk],
      homeKey: hk,
      tier: 1,
      avgOppRow: 0,
      oppReach: 0,
      baseErgoCost: 0.4,
      ...shape,
    });
  }

  // Tier 2: 72 Cross-Hand 2-Finger Chords
  for (const hk of PIANO_HOME_KEYS) {
    const isLeft = LEFT_HOME_KEYS.includes(hk);
    const oppPool = isLeft ? RIGHT_ALL_KEYS : LEFT_ALL_KEYS;
    for (const ok of oppPool) {
      const oppMeta = PIANO_COMFORT_KEYS[ok];
      const keys = [hk, ok].sort();
      const sig = keys.join('+');
      const rowPenalty = oppMeta.rowVal === 0 ? 0.0 : oppMeta.rowVal === 1 ? 0.55 : 0.85;
      const reach = getKeyReachFromCenter(ok);
      const reachPenalty = reach === 1 ? 0.1 : reach === 2 ? 0.25 : reach === 0 ? 0.32 : 0.45;
      const shape = describeSpatialShape(hk, [ok]);
      byHome.get(hk)!.push({
        signature: sig,
        keys,
        displayKeys: [hk, ok],
        homeKey: hk,
        tier: 2,
        avgOppRow: oppMeta.rowVal,
        oppReach: reach,
        baseErgoCost: 1.0 + rowPenalty + reachPenalty,
        ...shape,
      });
    }
  }

  // Tier 3: 292 Cross-Hand 3-Finger Piano Triads (strictly distinct physical fingers!)
  for (const hk of PIANO_HOME_KEYS) {
    const isLeft = LEFT_HOME_KEYS.includes(hk);
    const oppPool = isLeft ? RIGHT_ALL_KEYS : LEFT_ALL_KEYS;
    for (let i = 0; i < oppPool.length; i++) {
      for (let j = i + 1; j < oppPool.length; j++) {
        const kA = oppPool[i];
        const kB = oppPool[j];
        const mA = PIANO_COMFORT_KEYS[kA];
        const mB = PIANO_COMFORT_KEYS[kB];
        if (mA.fingerGroup === mB.fingerGroup) continue;

        const rowDiff = Math.abs(mA.rowVal - mB.rowVal);
        const colSpan = Math.abs(mA.col - mB.col);
        const keys = [hk, kA, kB].sort();
        const sig = keys.join('+');
        const avgRow = (mA.rowVal + mB.rowVal) / 2;
        const avgReach = (getKeyReachFromCenter(kA) + getKeyReachFromCenter(kB)) / 2;
        const homeBonus = (mA.isHome ? 0 : 0.45) + (mB.isHome ? 0 : 0.45);
        const twistPenalty = rowDiff === 2 ? 1.8 : rowDiff === 1 ? 0.35 : 0;
        const spanPenalty = colSpan > 2 ? 0.5 : 0;
        const shape = describeSpatialShape(hk, [kA, kB]);

        byHome.get(hk)!.push({
          signature: sig,
          keys,
          displayKeys: [hk, kA, kB],
          homeKey: hk,
          tier: 3,
          avgOppRow: avgRow,
          oppReach: avgReach,
          baseErgoCost: 3.1 + homeBonus + twistPenalty + spanPenalty + avgReach * 0.12,
          ...shape,
        });
      }
    }
  }

  return byHome;
}

const CHORD_UNIVERSE = buildChordUniverse();

// Explicit home-family assignment for the 12 rare Yuhao radicals outside the 1448 drill corpus
const RARE_YUHAO_HOME_MAP: Record<string, string> = {
  鹵: 's', // 外框包圍
  鬥: 's', // 門框並立
  瓦: 'f', // 橫起
  尢: 'f', // 橫起斜彎
  瓜: 'd', // 撇起
  烏: 'd', // 撇起鳥形
  乌: 'd', // 撇起鳥形
  豸: 'd', // 撇起獸旁
  乜: 'g', // 折勾
  孑: 'g', // 橫撇折勾
  丩: 'l', // 豎提
  〇: 'h', // 圓框合口
};

export const PIANO_CURATED_STARTERS = [
  '明',
  '休',
  '好',
  '本',
  '想',
  '清',
  '信',
  '和',
  '安',
  '字',
  '时',
  '時',
  '林',
  '道',
  '速',
  '心',
  '天',
  '地',
  '人',
  '日',
  '月',
  '山',
  '水',
  '火',
];

interface UnifiedRadicalInput {
  radical: string;
  freq: number;
  inCorpus: boolean;
  originStroke: InitialStrokeId;
  endingVector: EndingVectorId;
  nativeHomeKey: string;
}

const simCache = new Map<string, PianoChordSimulationResult>();

export function runPianoChordSimulation(
  stageId: KineticStageId = 'full1448',
  scriptMode: ScriptMode = 'simp',
  mode: PianoChordMode = 'dyad_intuitive',
  wholeCharSecondBeat: boolean = true
): PianoChordSimulationResult {
  const cacheKey = `${mode}:${stageId}:${scriptMode}:${wholeCharSecondBeat ? 'wb1' : 'wb0'}`;
  const cached = simCache.get(cacheKey);
  if (cached) return cached;

  // Always compute full-corpus radical frequencies so every radical's chord stays 100% FIXED across stages!
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

  const colToHome = new Map<string, (typeof HOME_GROUP_ANCHORS)[number]>();
  for (const anchor of HOME_GROUP_ANCHORS) {
    for (const ck of anchor.columnKeys) {
      colToHome.set(ck, anchor);
    }
  }

  // Merge all corpus radicals + remaining rare official Yuhao radicals from LINGMING_ROOT_MAP (100% 269/269 coverage!)
  const unifiedMap = new Map<string, UnifiedRadicalInput>();
  for (const r of fullRefSim.radicals) {
    const anchor =
      colToHome.get(r.key1.key) ?? HOME_GROUP_ANCHORS.find((a) => a.key === 'f')!;
    unifiedMap.set(r.radical, {
      radical: r.radical,
      freq: r.freq,
      inCorpus: true,
      originStroke: r.originStroke,
      endingVector: r.endingVector,
      nativeHomeKey: anchor.key,
    });
  }

  for (const officialRad of LINGMING_ROOT_MAP.keys()) {
    if (unifiedMap.has(officialRad)) continue;
    const kin = inferRadicalKinesthetics(officialRad);
    const nativeHomeKey =
      RARE_YUHAO_HOME_MAP[officialRad] ??
      (kin.stroke === 'heng'
        ? 'f'
        : kin.stroke === 'zhe'
          ? 'g'
          : kin.stroke === 'pie'
            ? 'd'
            : kin.stroke === 'shu'
              ? 'l'
              : 'k');
    unifiedMap.set(officialRad, {
      radical: officialRad,
      freq: 0,
      inCorpus: false,
      originStroke: kin.stroke,
      endingVector: kin.vector,
      nativeHomeKey,
    });
  }

  const allRadicalsSorted = Array.from(unifiedMap.values()).sort(
    (a, b) => b.freq - a.freq || a.radical.localeCompare(b.radical)
  );

  const chordByRadical = new Map<string, PianoChordSpec>();
  const chordsBySignature = new Map<string, PianoChordSpec[]>();
  const assignedChords: PianoChordSpec[] = [];

  if (mode === 'dyad_unique') {
    // SCHEME A: PURE 26-LETTER A–Z CROSS-HAND MODE (15 Left x 11 Right = 165 cross-hand + 26 solo = 191 slots!)
    // - ZERO punctuation keys (; , . / completely removed!)
    // - ZERO 3-finger chords, ZERO same-hand chords (100% cross-hand or 1-finger solo!)
    // - Top 191 highest-frequency Simplified radicals get 100% 1-to-1 EXCLUSIVE slots!
    // - Bottom 46 ultra-rare Simplified radicals (freq 1-2) share ONLY the coldest same-family cross-hand slots!
    // - Explicitly deprioritizes X (high penalty) & favors comfortable P + home/top rows!
    const simpRefSim = runKineticSimulation(
      'three_row_dir8',
      'bidirectional',
      'full1448',
      'simp',
      'yuhao',
      'event_stream'
    );
    const simpFreqMap = new Map<string, number>();
    const standaloneSimpRoots = new Set<string>();
    for (const ch of simpRefSim.chars) {
      if (ch.parts.length === 1) standaloneSimpRoots.add(ch.parts[0]);
      for (const p of ch.parts) {
        simpFreqMap.set(p, (simpFreqMap.get(p) ?? 0) + 1);
      }
    }

    const Q_UMBRELLA = new Set(['八', '入', '合', '金', '钅', '食', '饣', '僉', '欠', '久', '勺', '儿', '几', '凡', '风', '爪', '爫', '竹']);
    const A_ENCLOSE = new Set(['厂', '丆', '匚', '石', '面', '西', '酉', '戈', '戊', '弋', '辰', '牙', '豕', '瓦', '臣', '页', '百', '豆', '而', '耳', '至']);
    const Z_HOOK = new Set(['也', '了', '九', '己', '已', '巳', '巴', '习', '弓', '乚', '乜', '孑', '民', '羽', '飞']);

    const LEFT_STROKE_GROUP: Record<string, InitialStrokeId> = {
      f: 'heng', r: 'heng', a: 'heng',
      s: 'shu', b: 'shu', d: 'shu',
      e: 'pie', c: 'pie', q: 'pie',
      v: 'dian', t: 'dian',
      w: 'zhe', g: 'zhe', x: 'zhe', z: 'zhe',
    };
    const RIGHT_EXPANSION_PAIR: Record<string, string[]> = {
      j: ['u', 'p'],
      u: ['j', 'p'],
      k: ['i', 'p'],
      i: ['k', 'p'],
      h: ['y', 'p'],
      y: ['h', 'p'],
      n: ['m', 'p'],
      m: ['n', 'p'],
      l: ['o', 'p'],
      o: ['l', 'p'],
    };

    const slotOccupancy = new Map<string, number>();
    const slotOwnerFreq = new Map<string, number>();
    const slotHasStandalone = new Set<string>();
    const all165: Array<{ lk: string; rk: string; sig: string; baseErgo: number }> = [];
    for (const lk of LEFT_FULL15_KEYS) {
      for (const rk of RIGHT_FULL11_KEYS) {
        const lm = PIANO_FULL26_KEYS[lk];
        const rm = PIANO_FULL26_KEYS[rk];
        let baseErgo = 1.0;
        baseErgo += lm.rowVal === 0 ? 0 : lm.rowVal === 1 ? 0.45 : 0.75;
        baseErgo += rm.rowVal === 0 ? 0 : rm.rowVal === 1 ? 0.45 : 0.75;
        // User-specific tactile tuning: P feels good; X feels worst!
        if (lk === 'x') baseErgo += 3.8;
        if (lk === 'z') baseErgo += 0.9;
        if (lk === 'q') baseErgo += 0.35;
        if (lk === 'a') baseErgo += 0.25;
        if (rk === 'p') baseErgo += 0.15;
        all165.push({ lk, rk, sig: [lk, rk].sort().join('+'), baseErgo });
      }
    }

    // Reserve all 26 A–Z solo taps exclusively (never shared!)
    for (const k of Object.values(PURE_SHAPE_SOLO_26)) {
      slotOccupancy.set(k, 999);
    }

    // Order radicals: Simplified-active FIRST (by Simplified freq desc), then rare non-twin, then Traditional twins last
    const orderedForUnique = [...allRadicalsSorted].sort((a, b) => {
      const fa = simpFreqMap.get(a.radical) ?? 0;
      const fb = simpFreqMap.get(b.radical) ?? 0;
      if ((fa > 0) !== (fb > 0)) return fa > 0 ? -1 : 1;
      if (fa !== fb) return fb - fa;
      const aTwin = TRAD_TO_SIMP_TWIN[a.radical] ? 1 : 0;
      const bTwin = TRAD_TO_SIMP_TWIN[b.radical] ? 1 : 0;
      if (aTwin !== bTwin) return aTwin - bTwin;
      return b.freq - a.freq || a.radical.localeCompare(b.radical);
    });

    const pendingTwins: UnifiedRadicalInput[] = [];

    for (const rad of orderedForUnique) {
      const pure = getPureShapeRadicalSpec(rad.radical, rad.originStroke);
      const idealRight = getPureShapeRightKey(pure.lastStroke, pure.strokes);
      const idealLeft = Q_UMBRELLA.has(rad.radical)
        ? 'q'
        : A_ENCLOSE.has(rad.radical)
          ? 'a'
          : Z_HOOK.has(rad.radical)
            ? 'z'
            : pure.leftKey;

      const soloKey = PURE_SHAPE_SOLO_26[rad.radical];
      if (soloKey) {
        const km = PIANO_FULL26_KEYS[soloKey];
        const isLeftSolo = km.hand === 'L';
        const leftMeta = PURE_SHAPE_LEFT_MAP.get(pure.leftKey);
        const extMeta = PURE_SHAPE_EXT_KEY_TAGS[soloKey];
        const shape = describeSpatialShape(soloKey, []);
        const spec: PianoChordSpec = {
          radical: rad.radical,
          freq: rad.freq,
          inCorpus: rad.inCorpus,
          originStroke: rad.originStroke,
          endingVector: rad.endingVector,
          homeAnchorKey: idealLeft,
          homeAnchorLabel: extMeta?.label ?? leftMeta?.label ?? `${idealLeft.toUpperCase()} 族`,
          homeShortTag: extMeta?.shortTag ?? leftMeta?.shortTag ?? idealLeft.toUpperCase(),
          keys: [soloKey],
          displayKeys: [soloKey],
          signature: soloKey,
          displayChord: soloKey.toUpperCase(),
          tier: 1,
          isCrossHand: false,
          spatialShape: shape.spatialShape,
          spatialArrow: '●',
          spatialLabel: '族長單指',
          directionRuleCue: isLeftSolo
            ? `${soloKey.toUpperCase()}(左手族長單指 · 獨享)`
            : `${soloKey.toUpperCase()}(右手高頻單指 · 獨享)`,
          fingerCue: `${km.fingerLabel} ${soloKey.toUpperCase()}`,
          ergonomicCost: 0.4,
          sharedSiblingsCount: 1,
        };
        chordByRadical.set(rad.radical, spec);
        chordsBySignature.set(spec.signature, [spec]);
        assignedChords.push(spec);
        continue;
      }

      const simpTwin = TRAD_TO_SIMP_TWIN[rad.radical];
      if (simpTwin && unifiedMap.has(simpTwin) && (simpFreqMap.get(rad.radical) ?? 0) === 0) {
        pendingTwins.push(rad);
        continue;
      }

      const idealStroke = LEFT_STROKE_GROUP[idealLeft] ?? rad.originStroke;
      const prefRightSibs = RIGHT_EXPANSION_PAIR[idealRight] ?? [];
      const idealRightRow = PIANO_FULL26_KEYS[idealRight]?.rowVal ?? 0;
      const isStandalone = standaloneSimpRoots.has(rad.radical);

      // Pick the best unused cross-hand slot; once all 165 cross-hand slots are claimed by the top 191 roots,
      // share ONLY the coldest (lowest-frequency owner) cross-hand slot — and NEVER pair two standalone whole-char roots!
      let bestSlot: (typeof all165)[number] = all165[0];
      let bestScore = Infinity;

      for (const slot of all165) {
        const occ = slotOccupancy.get(slot.sig) ?? 0;
        const ownerFreq = slotOwnerFreq.get(slot.sig) ?? 0;
        const standaloneCollisionPenalty = isStandalone && slotHasStandalone.has(slot.sig) ? 600 : 0;
        // Massive penalty for any occupied slot so ALL 165 cross-hand slots fill 1-to-1 first;
        // once full, heavily protect high-frequency owners & standalone whole chars!
        let score = occ * 120 + standaloneCollisionPenalty + ownerFreq * 4.5 + slot.baseErgo;

        if (slot.lk === idealLeft) {
          score += 0;
        } else if (LEFT_STROKE_GROUP[slot.lk] === idealStroke) {
          score += 2.1;
        } else {
          score += 9.5;
        }

        if (slot.rk === idealRight) {
          score += 0;
        } else if (prefRightSibs.includes(slot.rk)) {
          score += 1.2 + prefRightSibs.indexOf(slot.rk) * 0.35;
        } else if (PIANO_FULL26_KEYS[slot.rk].rowVal === idealRightRow) {
          score += 2.6;
        } else {
          score += 4.2;
        }

        if (score < bestScore) {
          bestScore = score;
          bestSlot = slot;
        }
      }

      const prevOcc = slotOccupancy.get(bestSlot.sig) ?? 0;
      slotOccupancy.set(bestSlot.sig, prevOcc + 1);
      if (isStandalone) slotHasStandalone.add(bestSlot.sig);
      const thisSimpFreq = simpFreqMap.get(rad.radical) ?? 0;
      slotOwnerFreq.set(bestSlot.sig, (slotOwnerFreq.get(bestSlot.sig) ?? 0) + thisSimpFreq);

      const lk = bestSlot.lk;
      const rk = bestSlot.rk;
      const lm = PIANO_FULL26_KEYS[lk];
      const rm = PIANO_FULL26_KEYS[rk];
      const leftMeta = PURE_SHAPE_LEFT_MAP.get(lk as never);
      const leftExt = PURE_SHAPE_EXT_KEY_TAGS[lk];
      const rightMeta = PURE_SHAPE_RIGHT_MAP.get(rk as never);
      const rightExt = PURE_SHAPE_EXT_KEY_TAGS[rk];
      const leftTag = leftMeta?.shortTag ?? leftExt?.shortTag ?? lk.toUpperCase();
      const rightTag = rightMeta?.shortTag ?? rightExt?.shortTag ?? rk.toUpperCase();
      const isExactPure = lk === idealLeft && rk === idealRight;
      const shape = describeSpatialShape(lk, [rk]);

      const spec: PianoChordSpec = {
        radical: rad.radical,
        freq: rad.freq,
        inCorpus: rad.inCorpus,
        originStroke: rad.originStroke,
        endingVector: rad.endingVector,
        homeAnchorKey: lk,
        homeAnchorLabel: leftMeta?.label ?? leftExt?.label ?? `${lk.toUpperCase()} 族`,
        homeShortTag: leftTag,
        keys: [lk, rk].sort(),
        displayKeys: [lk, rk],
        signature: bestSlot.sig,
        displayChord: `${lk.toUpperCase()}+${rk.toUpperCase()}`,
        tier: 2,
        isCrossHand: true,
        spatialShape: shape.spatialShape,
        spatialArrow: isExactPure ? '★' : '↔',
        spatialLabel: prevOcc === 0 ? (isExactPure ? `本位獨享(${pure.strokes}畫)` : `${rightTag}·獨享`) : `${rightTag}·冷根併槽`,
        directionRuleCue: `${lk.toUpperCase()}(${leftTag}) + ${rk.toUpperCase()}(${rightTag}${prevOcc === 0 ? (isExactPure ? '·本位' : '·鄰位獨享') : '·罕根共享'})`,
        fingerCue: `${lm.fingerLabel} ${lk.toUpperCase()} + ${rm.fingerLabel} ${rk.toUpperCase()}`,
        ergonomicCost: Number(bestSlot.baseErgo.toFixed(2)),
        sharedSiblingsCount: 1,
      };
      chordByRadical.set(rad.radical, spec);
      const list = chordsBySignature.get(spec.signature) ?? [];
      list.push(spec);
      chordsBySignature.set(spec.signature, list);
      assignedChords.push(spec);
    }

    // Bind purely Traditional twins to their Simplified twin's exact chord (0 impact on Simplified mode!)
    for (const rad of pendingTwins) {
      const twinKey = TRAD_TO_SIMP_TWIN[rad.radical];
      const twinSpec = twinKey ? chordByRadical.get(twinKey) : undefined;
      if (twinSpec) {
        const cloned: PianoChordSpec = {
          ...twinSpec,
          radical: rad.radical,
          freq: rad.freq,
          inCorpus: rad.inCorpus,
          directionRuleCue: `${twinSpec.displayChord}(繁簡同源 → ${twinKey})`,
        };
        chordByRadical.set(rad.radical, cloned);
        const list = chordsBySignature.get(cloned.signature) ?? [];
        list.push(cloned);
        chordsBySignature.set(cloned.signature, list);
        assignedChords.push(cloned);
      }
    }

    // Back-fill sharedSiblingsCount accurately
    for (const group of chordsBySignature.values()) {
      for (const spec of group) {
        spec.sharedSiblingsCount = group.length;
      }
    }
  } else if (mode === 'dyad_intuitive') {
    // 100% OBJECTIVE PURE-SHAPE 1–2 FINGER SYSTEM (ZERO 3-KEY CHORDS, ZERO SUBJECTIVE DIRECTION GUESSWORK!)
    // - 8 Iconic Solo Home Taps (一=F, 口=S, 丨=D, 又=G, 人=H, 氵=J, 宀=K, 辶=L)
    // - Every other radical = [Left 12 Objective Opening Family] + [Right 10 Objective Last-Stroke (一丨丿丶乛) x Complexity (≤4簡 vs ≥5繁)]!
    for (const rad of allRadicalsSorted) {
      const pure = getPureShapeRadicalSpec(rad.radical, rad.originStroke);
      const leftMeta = PURE_SHAPE_LEFT_MAP.get(pure.leftKey)!;
      const rightKey = getPureShapeRightKey(pure.lastStroke, pure.strokes);
      const rightMeta = PURE_SHAPE_RIGHT_MAP.get(rightKey)!;
      const soloKey = PURE_SHAPE_SOLO_RADICALS[rad.radical];

      let displayKeys: string[];
      let keys: string[];
      let tier: PianoChordTier;
      let directionRuleCue: string;
      let spatialArrow: string;
      let spatialLabel: string;
      let ergoCost: number;
      let anchorKey: string;

      if (soloKey) {
        displayKeys = [soloKey];
        keys = [soloKey];
        tier = 1;
        anchorKey = pure.leftKey;
        const isLeftSolo = PURE_SHAPE_LEFT_MAP.has(soloKey as never);
        directionRuleCue = isLeftSolo
          ? `${soloKey.toUpperCase()}(左手家族族長單指 · ${rad.radical})`
          : `${soloKey.toUpperCase()}(右手高頻單指王牌 · ${rad.radical})`;
        spatialArrow = '●';
        spatialLabel = '族長單指';
        ergoCost = 0.4;
      } else {
        displayKeys = [pure.leftKey, rightKey];
        keys = [pure.leftKey, rightKey].sort();
        tier = 2;
        anchorKey = pure.leftKey;
        directionRuleCue = `${pure.leftKey.toUpperCase()}(${leftMeta.shortTag}) + ${rightKey.toUpperCase()}(${rightMeta.shortTag}·${pure.strokes}畫)`;
        spatialArrow = `${leftMeta.strokeSymbol}→${rightMeta.strokeSymbol}`;
        spatialLabel = `${rightMeta.shortTag}(${pure.strokes}畫)`;
        const lm = PIANO_COMFORT_KEYS[pure.leftKey];
        const rm = PIANO_COMFORT_KEYS[rightKey];
        const rowPen = (lm.isHome ? 0 : 0.45) + (rm.isHome ? 0 : 0.45);
        ergoCost = Number((1.0 + rowPen).toFixed(2));
      }

      const signature = keys.join('+');
      const shape = describeSpatialShape(displayKeys[0], displayKeys.slice(1));
      const fingerCue = displayKeys
        .map((k) => {
          const m = PIANO_COMFORT_KEYS[k];
          return `${m?.fingerLabel ?? ''} ${k.toUpperCase()}`.trim();
        })
        .join(' + ');

      const spec: PianoChordSpec = {
        radical: rad.radical,
        freq: rad.freq,
        inCorpus: rad.inCorpus,
        originStroke: rad.originStroke,
        endingVector: rad.endingVector,
        homeAnchorKey: anchorKey,
        homeAnchorLabel: leftMeta.label,
        homeShortTag: leftMeta.shortTag,
        keys,
        displayKeys,
        signature,
        displayChord: displayKeys.map((k) => k.toUpperCase()).join('+'),
        tier,
        isCrossHand: tier >= 2,
        spatialShape: shape.spatialShape,
        spatialArrow,
        spatialLabel,
        directionRuleCue,
        fingerCue,
        ergonomicCost: ergoCost,
        sharedSiblingsCount: 1,
      };

      chordByRadical.set(rad.radical, spec);
      const list = chordsBySignature.get(signature) ?? [];
      list.push(spec);
      chordsBySignature.set(signature, list);
      assignedChords.push(spec);
    }

    // Back-fill sharedSiblingsCount for transparent UI display
    for (const group of chordsBySignature.values()) {
      for (const spec of group) {
        spec.sharedSiblingsCount = group.length;
      }
    }
  } else if (mode === 'dyad_balanced') {
    // 100% PURE 1–2 FINGER, ALL 128 CROSS-HAND SLOTS (8 Solo Home + 12 Left x 10 Right = 128 slots, ZERO 3-key chords!)
    // Balances all 269 official Yuhao radicals evenly (~2.1 roots/slot) while preserving native finger column & vertical momentum!
    const all128: Array<{
      sig: string;
      keys: string[];
      tier: 1 | 2;
      leftKey?: string;
      rightKey?: string;
      cost: number;
    }> = [];
    for (const hk of PIANO_HOME_KEYS) {
      all128.push({ sig: hk, keys: [hk], tier: 1, cost: 0.4 });
    }
    for (const lk of LEFT_ALL_KEYS) {
      for (const rk of RIGHT_ALL_KEYS) {
        const lm = PIANO_COMFORT_KEYS[lk];
        const rm = PIANO_COMFORT_KEYS[rk];
        const cost =
          1.0 +
          (lm.isHome ? 0 : 0.45) +
          (rm.isHome ? 0 : 0.45) +
          (lm.rowVal === -1 ? 0.25 : 0) +
          (rm.rowVal === -1 ? 0.25 : 0);
        all128.push({
          sig: [lk, rk].sort().join('+'),
          keys: [lk, rk].sort(),
          tier: 2,
          leftKey: lk,
          rightKey: rk,
          cost,
        });
      }
    }

    const usedCount = new Map<string, number>();

    for (const rad of allRadicalsSorted) {
      const anchor =
        HOME_GROUP_ANCHORS.find((a) => a.key === rad.nativeHomeKey) ??
        HOME_GROUP_ANCHORS.find((a) => a.key === 'f')!;
      const prefCol = new Set(anchor.columnKeys);
      const targetVert = getTargetVerticalBias(rad.endingVector);
      const rule = FIXED_DIR_BY_VECTOR.get(rad.endingVector);

      let best = all128[0];
      let bestScore = Infinity;

      for (const slot of all128) {
        const u = usedCount.get(slot.sig) ?? 0;
        let score = u * 80 + slot.cost;
        if (slot.tier === 1) {
          if (slot.sig !== anchor.key || u > 0) score += 240;
          else score -= 35;
        } else {
          const hasHome = slot.keys.includes(anchor.key);
          const hasCol = slot.keys.some((k) => prefCol.has(k));
          if (!hasHome) score += hasCol ? 3.8 : 18;
          const oppKey = anchor.hand === 'L' ? slot.rightKey! : slot.leftKey!;
          const oppRow = PIANO_COMFORT_KEYS[oppKey].rowVal;
          score += Math.abs(oppRow - targetVert) * 1.65;
          if (rule) {
            const idealOpp = anchor.hand === 'L' ? rule.rightKey : rule.leftMirrorKey;
            if (oppKey === idealOpp) score -= 0.75;
          }
        }
        if (score < bestScore) {
          bestScore = score;
          best = slot;
        }
      }

      usedCount.set(best.sig, (usedCount.get(best.sig) ?? 0) + 1);

      const primaryKey =
        best.tier === 1
          ? best.keys[0]
          : anchor.hand === 'L'
            ? best.leftKey!
            : best.rightKey!;
      const secondaryKeys =
        best.tier === 1 ? [] : [anchor.hand === 'L' ? best.rightKey! : best.leftKey!];
      const displayKeys = [primaryKey, ...secondaryKeys];
      const shape = describeSpatialShape(primaryKey, secondaryKeys);
      const fingerCue = displayKeys
        .map((k) => {
          const m = PIANO_COMFORT_KEYS[k];
          return `${m?.fingerLabel ?? ''} ${k.toUpperCase()}`.trim();
        })
        .join(' + ');
      const directionRuleCue =
        best.tier === 1
          ? `${primaryKey.toUpperCase()}(${anchor.shortTag}王牌獨奏)`
          : `${primaryKey.toUpperCase()}(${anchor.shortTag}縱列) + ${secondaryKeys[0].toUpperCase()}(${shape.spatialArrow}${shape.spatialLabel})`;

      const spec: PianoChordSpec = {
        radical: rad.radical,
        freq: rad.freq,
        inCorpus: rad.inCorpus,
        originStroke: rad.originStroke,
        endingVector: rad.endingVector,
        homeAnchorKey: anchor.key,
        homeAnchorLabel: anchor.groupTitle,
        homeShortTag: anchor.shortTag,
        keys: best.keys,
        displayKeys,
        signature: best.sig,
        displayChord: displayKeys.map((k) => k.toUpperCase()).join('+'),
        tier: best.tier,
        isCrossHand: best.tier >= 2,
        spatialShape: shape.spatialShape,
        spatialArrow: shape.spatialArrow,
        spatialLabel: shape.spatialLabel,
        directionRuleCue,
        fingerCue,
        ergonomicCost: Number(best.cost.toFixed(2)),
        sharedSiblingsCount: 1,
      };

      chordByRadical.set(rad.radical, spec);
      const list = chordsBySignature.get(best.sig) ?? [];
      list.push(spec);
      chordsBySignature.set(best.sig, list);
      assignedChords.push(spec);
    }

    for (const group of chordsBySignature.values()) {
      for (const spec of group) {
        spec.sharedSiblingsCount = group.length;
      }
    }
  } else {
    // TRIAD_UNIQUE MODE: 100% 1-to-1 unique chord per radical across all 269 Yuhao radicals (0 slot sharing)
    const usedSignatures = new Set<string>();

    for (const rad of allRadicalsSorted) {
      const anchor =
        HOME_GROUP_ANCHORS.find((a) => a.key === rad.nativeHomeKey) ??
        HOME_GROUP_ANCHORS.find((a) => a.key === 'f')!;
      const targetVert = getTargetVerticalBias(rad.endingVector);
      const targetReachLabel = getTargetHorizontalReach(rad.endingVector);
      const targetReachNum =
        targetReachLabel === 'near' ? 0.5 : targetReachLabel === 'far' ? 2.6 : 1.5;

      const isLeftAnchor = LEFT_HOME_KEYS.includes(anchor.key);
      const homeOrder = [
        anchor.key,
        ...(isLeftAnchor ? LEFT_HOME_KEYS : RIGHT_HOME_KEYS).filter((k) => k !== anchor.key),
        ...(isLeftAnchor ? RIGHT_HOME_KEYS : LEFT_HOME_KEYS),
      ];

      let bestCand: CandidateChord | null = null;
      let bestScore = Infinity;

      for (let hIdx = 0; hIdx < homeOrder.length; hIdx++) {
        const hk = homeOrder[hIdx];
        const homePen = hIdx === 0 ? 0 : hIdx < 4 ? 14 + hIdx * 2 : 34 + hIdx;
        const pool = CHORD_UNIVERSE.get(hk) ?? [];

        for (const cand of pool) {
          if (usedSignatures.has(cand.signature)) continue;
          const tierScore =
            cand.tier === 1
              ? hIdx === 0
                ? -20
                : 18
              : cand.tier === 2
                ? 0
                : 9.5;
          const vertMismatch =
            cand.tier === 1 ? 0 : Math.abs(cand.avgOppRow - targetVert) * 1.45;
          const reachMismatch =
            cand.tier === 1 ? 0 : Math.abs(cand.oppReach - targetReachNum) * 0.35;

          const score = homePen + tierScore + cand.baseErgoCost + vertMismatch + reachMismatch;
          if (score < bestScore) {
            bestScore = score;
            bestCand = cand;
          }
        }
        if (bestCand && hIdx === 0 && bestCand.tier <= 2) break;
      }

      if (!bestCand) continue;
      usedSignatures.add(bestCand.signature);

      const assignedAnchor =
        HOME_GROUP_ANCHORS.find((a) => a.key === bestCand!.homeKey) ?? anchor;
      const fingerCue = bestCand.displayKeys
        .map((k) => {
          const m = PIANO_COMFORT_KEYS[k];
          return `${m?.fingerLabel ?? ''} ${k.toUpperCase()}`.trim();
        })
        .join(' + ');

      const directionRuleCue =
        bestCand.tier === 1
          ? `${assignedAnchor.key.toUpperCase()}(${assignedAnchor.shortTag}獨奏)`
          : `${assignedAnchor.key.toUpperCase()}(${assignedAnchor.shortTag}) + ${bestCand.displayKeys
              .slice(1)
              .map((k) => k.toUpperCase())
              .join('+')}(${bestCand.spatialLabel})`;

      const spec: PianoChordSpec = {
        radical: rad.radical,
        freq: rad.freq,
        inCorpus: rad.inCorpus,
        originStroke: rad.originStroke,
        endingVector: rad.endingVector,
        homeAnchorKey: bestCand.homeKey,
        homeAnchorLabel: assignedAnchor.groupTitle,
        homeShortTag: assignedAnchor.shortTag,
        keys: bestCand.keys,
        displayKeys: bestCand.displayKeys,
        signature: bestCand.signature,
        displayChord: bestCand.displayKeys.map((k) => k.toUpperCase()).join('+'),
        tier: bestCand.tier,
        isCrossHand: bestCand.tier >= 2,
        spatialShape: bestCand.spatialShape,
        spatialArrow: bestCand.spatialArrow,
        spatialLabel: bestCand.spatialLabel,
        directionRuleCue,
        fingerCue,
        ergonomicCost: Number(bestCand.baseErgoCost.toFixed(2)),
        sharedSiblingsCount: 1,
      };

      chordByRadical.set(rad.radical, spec);
      chordsBySignature.set(spec.signature, [spec]);
      assignedChords.push(spec);
    }
  }

  const chordBySignature = new Map<string, PianoChordSpec>();
  for (const [sig, list] of chordsBySignature.entries()) {
    if (list.length > 0) chordBySignature.set(sig, list[0]);
  }

  // Evaluate character beat sequences on the requested stage & script filter
  const chars: PianoChordCharEntry[] = [];
  const seqMap = new Map<string, PianoChordCharEntry[]>();

  let totalBeats = 0;
  let totalFingerPresses = 0;
  let maxFingersPerBeat = 1;
  let tier1Occ = 0;
  let tier2Occ = 0;
  let tier3Occ = 0;
  let multiKeyBeats = 0;
  let crossHandMultiBeats = 0;
  let sameFingerChordCount = 0;

  for (const ch of assignedChords) {
    const fgSet = new Set(ch.keys.map((k) => PIANO_FULL26_KEYS[k]?.fingerGroup));
    if (fgSet.size !== ch.keys.length) sameFingerChordCount++;
  }

  for (const entry of stageSim.chars) {
    const beats: PianoChordSpec[] = [];
    for (const part of entry.parts) {
      const spec = chordByRadical.get(part);
      if (spec) beats.push(spec);
    }
    if (beats.length === 0) continue;

    // Optional 1-finger 2nd-stroke finishing tap for non-solo single-radical whole chars (獨體成字補1指次筆)
    if (
      mode === 'dyad_intuitive' &&
      wholeCharSecondBeat &&
      entry.parts.length === 1 &&
      !PURE_SHAPE_SOLO_RADICALS[entry.char]
    ) {
      const sec = getWholeCharSecondBeatSpec(entry.char);
      if (sec) {
        const rightMeta = PURE_SHAPE_RIGHT_MAP.get(sec.key)!;
        const km = PIANO_COMFORT_KEYS[sec.key];
        const secBeat: PianoChordSpec = {
          radical: `次筆${rightMeta.strokeSymbol}`,
          freq: 0,
          inCorpus: true,
          originStroke: sec.stroke,
          endingVector: 'center_settle',
          homeAnchorKey: sec.key,
          homeAnchorLabel: rightMeta.label,
          homeShortTag: rightMeta.shortTag,
          keys: [sec.key],
          displayKeys: [sec.key],
          signature: sec.key,
          displayChord: sec.key.toUpperCase(),
          tier: 1,
          isCrossHand: false,
          spatialShape: 'solo_anchor',
          spatialArrow: '↳',
          spatialLabel: `次筆${rightMeta.strokeSymbol}`,
          directionRuleCue: `獨體補次筆：${sec.key.toUpperCase()}(${sec.strokes >= 6 ? '多' : '少'}${rightMeta.strokeSymbol}·${sec.strokes}畫)`,
          fingerCue: `${km?.fingerLabel ?? ''} ${sec.key.toUpperCase()}`.trim(),
          ergonomicCost: km?.isHome ? 0.4 : 0.75,
          sharedSiblingsCount: 1,
        };
        beats.push(secBeat);
      }
    }

    const signatureSequence = beats.map((b) => b.signature).join(' · ');
    const displaySequence = beats.map((b) => b.displayChord).join(' · ');
    const totalKeyPresses = beats.reduce((sum, b) => sum + b.keys.length, 0);

    totalBeats += beats.length;
    totalFingerPresses += totalKeyPresses;
    for (const b of beats) {
      if (b.keys.length > maxFingersPerBeat) maxFingersPerBeat = b.keys.length;
      if (b.tier === 1) tier1Occ++;
      else if (b.tier === 2) tier2Occ++;
      else tier3Occ++;
      if (b.keys.length >= 2) {
        multiKeyBeats++;
        if (b.isCrossHand) crossHandMultiBeats++;
      }
    }

    const pianoChar: PianoChordCharEntry = {
      char: entry.char,
      script: entry.script,
      parts: entry.parts,
      beats,
      beatCount: beats.length,
      totalKeyPresses,
      signatureSequence,
      displaySequence,
      isCoreDrill: entry.isCoreDrill,
      hasOnlyEasyBeats: beats.every((b) => b.tier <= 2),
    };
    chars.push(pianoChar);
    const bucket = seqMap.get(signatureSequence) ?? [];
    bucket.push(pianoChar);
    seqMap.set(signatureSequence, bucket);
  }

  const collisions: PianoChordCollisionGroup[] = [];
  let collisionChars = 0;
  for (const [signatureSequence, group] of seqMap.entries()) {
    if (group.length > 1) {
      collisions.push({ signatureSequence, chars: group });
      collisionChars += group.length - 1;
    }
  }
  collisions.sort((a, b) => b.chars.length - a.chars.length);

  const uniqueCodes = seqMap.size;
  const totalChars = chars.length;
  const firstChoiceRate = totalChars > 0 ? (uniqueCodes / totalChars) * 100 : 100;
  const compoundChars = chars.filter((c) => c.parts.length >= 2);
  const compoundUnique = new Set(compoundChars.map((c) => c.signatureSequence)).size;
  const compoundFirstChoiceRate =
    compoundChars.length > 0 ? (compoundUnique / compoundChars.length) * 100 : 100;
  const avgBeatsPerChar = totalChars > 0 ? totalBeats / totalChars : 0;
  const avgFingersPerBeat = totalBeats > 0 ? totalFingerPresses / totalBeats : 0;
  const totalOcc = tier1Occ + tier2Occ + tier3Occ;

  const officialYuhaoTotal = LINGMING_ROOT_MAP.size;
  let coveredOfficial = 0;
  for (const r of LINGMING_ROOT_MAP.keys()) {
    if (chordByRadical.has(r)) coveredOfficial++;
  }

  const homeClusterSummary =
    mode === 'dyad_unique'
      ? [
          ...PURE_SHAPE_LEFT_FAMILIES.map((fam) => ({
            key: fam.key,
            label: fam.label,
            shortTag: fam.shortTag,
            soloLeader: fam.soloLeader,
          })),
          { key: 'q', label: 'Q · 傘撇八人', shortTag: '傘撇', soloLeader: '八' },
          { key: 'a', label: 'A · 廠匚半包', shortTag: '半包', soloLeader: '厂' },
          { key: 'z', label: 'Z · 乙己彎鉤', shortTag: '彎鉤', soloLeader: '也' },
        ].map((fam) => {
          const members = assignedChords.filter((c) => c.homeAnchorKey === fam.key);
          return {
            homeKey: fam.key,
            hand: 'L' as const,
            groupTitle: fam.label,
            shortTag: fam.shortTag,
            soloRadical: fam.soloLeader,
            totalRadicals: members.length,
            tier1Count: members.filter((c) => c.tier === 1).length,
            tier2Count: members.filter((c) => c.tier === 2).length,
            tier3Count: 0,
            sampleChords: members.slice(0, 8),
          };
        })
      : mode === 'dyad_intuitive'
        ? PURE_SHAPE_LEFT_FAMILIES.map((fam) => {
            const members = assignedChords.filter((c) => c.homeAnchorKey === fam.key);
            return {
              homeKey: fam.key,
              hand: 'L' as const,
              groupTitle: fam.label,
              shortTag: fam.shortTag,
              soloRadical: fam.soloLeader,
              totalRadicals: members.length,
              tier1Count: members.filter((c) => c.tier === 1).length,
              tier2Count: members.filter((c) => c.tier === 2).length,
              tier3Count: 0,
              sampleChords: members.slice(0, 8),
            };
          })
        : HOME_GROUP_ANCHORS.map((anchor) => {
            const members = assignedChords.filter((c) => c.homeAnchorKey === anchor.key);
            const solo = members.find((c) => c.tier === 1);
            return {
              homeKey: anchor.key,
              hand: anchor.hand,
              groupTitle: anchor.groupTitle,
              shortTag: anchor.shortTag,
              soloRadical: solo?.radical ?? members[0]?.radical ?? '',
              totalRadicals: members.length,
              tier1Count: members.filter((c) => c.tier === 1).length,
              tier2Count: members.filter((c) => c.tier === 2).length,
              tier3Count: members.filter((c) => c.tier === 3).length,
              sampleChords: members.slice(0, 8),
            };
          });

  const uniqueChordSlotsUsed = chordsBySignature.size;

  const result: PianoChordSimulationResult = {
    mode,
    stageId,
    scriptMode,
    chords: assignedChords,
    chordByRadical,
    chordBySignature,
    chordsBySignature,
    chars,
    collisions,
    homeClusterSummary,
    metrics: {
      totalChars,
      uniqueCodes,
      firstChoiceRate,
      compoundFirstChoiceRate,
      collisionChars,
      avgBeatsPerChar,
      avgFingersPerBeat,
      maxFingersPerBeat,
      totalRadicals: assignedChords.length,
      officialYuhaoTotal,
      yuhaoCoveragePct:
        officialYuhaoTotal > 0 ? (coveredOfficial / officialYuhaoTotal) * 100 : 100,
      uniqueChordSlotsUsed,
      avgRadicalsPerSlot:
        uniqueChordSlotsUsed > 0 ? assignedChords.length / uniqueChordSlotsUsed : 1,
      slotUniquenessRate:
        assignedChords.length > 0
          ? (uniqueChordSlotsUsed / assignedChords.length) * 100
          : 100,
      tier1And2OccurrencePct: totalOcc > 0 ? ((tier1Occ + tier2Occ) / totalOcc) * 100 : 0,
      tier1OccurrencePct: totalOcc > 0 ? (tier1Occ / totalOcc) * 100 : 0,
      tier2OccurrencePct: totalOcc > 0 ? (tier2Occ / totalOcc) * 100 : 0,
      tier3OccurrencePct: totalOcc > 0 ? (tier3Occ / totalOcc) * 100 : 0,
      crossHandBeatPct: multiKeyBeats > 0 ? (crossHandMultiBeats / multiKeyBeats) * 100 : 100,
      pinkyRate: 0,
      sameFingerChordCount,
    },
  };

  simCache.set(cacheKey, result);
  return result;
}

export function computePianoModeComparison(
  stageId: KineticStageId = 'full1448',
  scriptMode: ScriptMode = 'simp',
  wholeCharSecondBeat: boolean = true
): PianoModeComparison {
  return {
    dyadUnique: runPianoChordSimulation(stageId, scriptMode, 'dyad_unique', wholeCharSecondBeat),
    dyadIntuitive: runPianoChordSimulation(stageId, scriptMode, 'dyad_intuitive', wholeCharSecondBeat),
    dyadBalanced: runPianoChordSimulation(stageId, scriptMode, 'dyad_balanced', wholeCharSecondBeat),
    triadUnique: runPianoChordSimulation(stageId, scriptMode, 'triad_unique', wholeCharSecondBeat),
  };
}

export function describePianoChordEndingCue(vector: EndingVectorId): string {
  return ENDING_VECTOR_META[vector]?.short ?? '';
}
