import React, { useEffect, useRef } from 'react';
import { GlyphEntry, PalaceMeta, ShapeCodeScheme } from '../data/schemes';
import { CodeRole } from '../data/lingming';
import {
  getEffectiveScaffoldLevel,
  pickAdaptiveEntry,
  recordGlyphCompletion,
  recordKeyResult,
  ScaffoldMode,
  SchemeMasteryStore,
  TrainingScope,
} from './mastery';
import { synth } from '../audio/synth';
import { getRadicalReading, speech } from '../audio/speech';
import { getDepthFocusMetrics } from './palaceSizing';
import { matchesScript, ScriptMode } from '../data/scriptFilter';
import { uiText, useUiScript } from '../data/uiScript';
import { useThemeMode } from '../data/theme';
import type { CampaignStageKind } from '../data/campaign';

export type GameMode = 'reflex' | 'arcade' | 'weakkey';
export type LayoutMode = 'depth' | 'split';

export interface WeakEntryInfo {
  entry: GlyphEntry;
  errors: number;
  avgMs: number;
}

export interface ActiveTargetSnapshot {
  char: string;
  code: string;
  typed: string;
  nextKey: string;
  nextRole?: CodeRole;
  parts: string[];
  palace?: PalaceMeta;
  xray?: GlyphEntry['xray'];
  wordPair?: string;
  wordCharIdx?: number;
  scaffoldLevel: 0 | 1 | 2 | 3;
  hesitationMs: number;
  glyphLevel: 0 | 1 | 2 | 3;
  lastErrorKey: string | null;
  lastErrorTick: number;
  lastStrikeKey: string | null;
  lastStrikeCorrect: boolean;
  lastStrikeTick: number;
  tabHintActive: boolean;
}

export interface HudSnapshot {
  score: number;
  combo: number;
  maxCombo: number;
  cleared: number;
  targetGoal: number;
  lives: number;
  maxLives: number;
  wave: number;
  accuracy: number;
  cpm: number;
  avgKeyMs: number;
  promotedCount: number;
}

export interface RoundResult {
  reason: 'cleared' | 'gameover';
  score: number;
  maxCombo: number;
  cleared: number;
  accuracy: number;
  cpm: number;
  avgKeyMs: number;
  promotedCount: number;
  durationSec: number;
  weakEntries?: WeakEntryInfo[];
}

interface FallingTile {
  uid: number;
  entry: GlyphEntry;
  x: number;
  y: number;
  vy: number;
  typed: string;
  hadError: boolean;
  consecutiveErrors: number;
  spawnedAt: number;
  lastKeyAt: number;
  scale: number;
  flash: number;
  shake: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

interface InkRipple {
  active: boolean;
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  maxAlpha: number;
  age: number;
  duration: number;
  decay: number;
  color: string;
  lineWidth: number;
  dashed: boolean;
}

interface InkPlume {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rStart: number;
  rMax: number;
  aspect: number;
  angle: number;
  age: number;
  duration: number;
  peakAlpha: number;
  isError: boolean;
}

interface InkDissolveGlyph {
  active: boolean;
  char: string;
  x: number;
  y: number;
  glyphSize: number;
  glyphY: number;
  age: number;
  duration: number;
}

interface FloatText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  subText: string;
  alpha: number;
  age: number;
  duration: number;
  color: string;
}

interface GameCanvasProps {
  scheme: ShapeCodeScheme;
  mode: GameMode;
  layoutMode: LayoutMode;
  trainingScope: TrainingScope;
  paused: boolean;
  scaffoldMode: ScaffoldMode;
  hideCodeHints?: boolean;
  focusKeys: string[] | null;
  customDeck?: GlyphEntry[] | null;
  isBossTrial?: boolean;
  arcadeGoal?: number;
  stageKind?: CampaignStageKind;
  scriptMode?: ScriptMode;
  masteryRef: React.MutableRefObject<SchemeMasteryStore>;
  onMasteryChange: (next: SchemeMasteryStore) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
  onTargetUpdate: (target: ActiveTargetSnapshot | null) => void;
  onGlyphCleared?: (char: string) => void;
  onRoundEnd: (result: RoundResult) => void;
  virtualKeyEvent: { key: string; tick: number } | null;
  hintPulseTick: number;
  resetSignal: number;
}

const ARENA_BG_URL = `${import.meta.env.BASE_URL}src/assets/images/arena_ink_texture_1795311702492.jpg`;

const MAX_PARTICLES = 120;
const MAX_RIPPLES = 24;
const MAX_PLUMES = 42;
const MAX_DISSOLVES = 8;
const MAX_FLOATS = 24;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  scheme,
  mode,
  layoutMode,
  trainingScope,
  paused,
  scaffoldMode,
  hideCodeHints = false,
  focusKeys,
  customDeck = null,
  isBossTrial = false,
  arcadeGoal = 0,
  stageKind,
  scriptMode = 'both',
  masteryRef,
  onMasteryChange,
  onHudUpdate,
  onTargetUpdate,
  onGlyphCleared,
  onRoundEnd,
  virtualKeyEvent,
  hintPulseTick,
  resetSignal,
}) => {
  const uiScript = useUiScript();
  const themeMode = useThemeMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathCacheRef = useRef<Map<string, Path2D>>(new Map());

  const propsRef = useRef({
    scheme,
    mode,
    layoutMode,
    trainingScope,
    paused,
    scaffoldMode,
    hideCodeHints,
    focusKeys,
    customDeck,
    isBossTrial,
    arcadeGoal,
    stageKind,
    scriptMode,
    uiScript,
    themeMode,
    onMasteryChange,
    onHudUpdate,
    onTargetUpdate,
    onGlyphCleared,
    onRoundEnd,
  });
  propsRef.current = {
    scheme,
    mode,
    layoutMode,
    trainingScope,
    paused,
    scaffoldMode,
    hideCodeHints,
    focusKeys,
    customDeck,
    isBossTrial,
    arcadeGoal,
    stageKind,
    scriptMode,
    uiScript,
    themeMode,
    onMasteryChange,
    onHudUpdate,
    onTargetUpdate,
    onGlyphCleared,
    onRoundEnd,
  };

  const simRef = useRef({
    uidSeq: 1,
    tiles: [] as FallingTile[],
    queue: [] as GlyphEntry[],
    chamberDeck: [] as GlyphEntry[],
    weakStats: new Map<string, { entry: GlyphEntry; errors: number; totalMs: number; count: number }>(),
    activeUid: null as number | null,
    particles: Array.from({ length: MAX_PARTICLES }, (): Particle => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      alpha: 0,
      decay: 1.5,
      color: '#D89B3C',
    })),
    ripples: Array.from({ length: MAX_RIPPLES }, (): InkRipple => ({
      active: false,
      x: 0,
      y: 0,
      r: 8,
      maxR: 72,
      alpha: 0,
      maxAlpha: 0.35,
      age: 0,
      duration: 0.72,
      decay: 1.6,
      color: '#2EA87E',
      lineWidth: 2,
      dashed: false,
    })),
    plumes: Array.from({ length: MAX_PLUMES }, (): InkPlume => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rStart: 12,
      rMax: 68,
      aspect: 1,
      angle: 0,
      age: 0,
      duration: 0.78,
      peakAlpha: 0.24,
      isError: false,
    })),
    dissolves: Array.from({ length: MAX_DISSOLVES }, (): InkDissolveGlyph => ({
      active: false,
      char: '',
      x: 0,
      y: 0,
      glyphSize: 64,
      glyphY: 0,
      age: 0,
      duration: 0.56,
    })),
    floats: Array.from({ length: MAX_FLOATS }, (): FloatText => ({
      active: false,
      x: 0,
      y: 0,
      vy: -42,
      text: '',
      subText: '',
      alpha: 0,
      age: 0,
      duration: 0.9,
      color: '#F2EEE6',
    })),
    score: 0,
    combo: 0,
    maxCombo: 0,
    cleared: 0,
    targetGoal: 30,
    lives: 5,
    maxLives: 5,
    wave: 1,
    totalKeys: 0,
    correctKeys: 0,
    keyLatencySum: 0,
    keyLatencyCount: 0,
    promotedCount: 0,
    elapsedSec: 0,
    spawnTimer: 0,
    hitstopTimer: 0,
    camShake: 0,
    forcedHintUntil: 0,
    tabHintUntil: 0,
    imeWarningUntil: 0,
    lastErrorKey: null as string | null,
    lastErrorTick: 0,
    lastStrikeKey: null as string | null,
    lastStrikeCorrect: true,
    lastStrikeTick: 0,
    lastHudSync: 0,
    lastTargetSync: 0,
    width: 960,
    height: 440,
    bgImage: null as HTMLImageElement | null,
    bgLoaded: false,
    ringPhase: 0,
    ended: false,
  });

  useEffect(() => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = ARENA_BG_URL;
    img.onload = () => {
      simRef.current.bgImage = img;
      simRef.current.bgLoaded = true;
    };
  }, []);

  const emitInkPlumes = (
    x: number,
    y: number,
    plumeCount = 4,
    baseRadius = 64,
    peakAlpha = 0.22,
    isError = false
  ) => {
    const { plumes } = simRef.current;
    let spawned = 0;
    for (let i = 0; i < plumes.length && spawned < plumeCount; i++) {
      const pl = plumes[i];
      if (!pl.active) {
        const theta = (Math.PI * 2 * spawned) / Math.max(1, plumeCount) + (Math.random() - 0.5) * 1.1;
        const offsetR = spawned === 0 ? 0 : 6 + Math.random() * 20;
        const driftSpeed = spawned === 0 ? 1.5 : 5 + Math.random() * 14;
        pl.active = true;
        pl.x = x + Math.cos(theta) * offsetR;
        pl.y = y + Math.sin(theta) * offsetR * 0.78;
        pl.vx = Math.cos(theta) * driftSpeed;
        pl.vy = Math.sin(theta) * driftSpeed - (spawned === 0 ? 0 : 3);
        pl.rStart = spawned === 0 ? baseRadius * 0.22 : baseRadius * (0.14 + Math.random() * 0.12);
        pl.rMax = spawned === 0 ? baseRadius * 1.38 : baseRadius * (0.82 + Math.random() * 0.56);
        pl.aspect = 0.72 + Math.random() * 0.44;
        pl.angle = Math.random() * Math.PI;
        pl.age = 0;
        pl.duration = (isError ? 0.62 : 0.86) + Math.random() * 0.28;
        pl.peakAlpha = spawned === 0 ? peakAlpha : peakAlpha * (0.58 + Math.random() * 0.30);
        pl.isError = isError;
        spawned++;
      }
    }
  };

  const emitDissolveGlyph = (
    char: string,
    x: number,
    y: number,
    glyphSize: number,
    glyphY: number
  ) => {
    const { dissolves } = simRef.current;
    for (let i = 0; i < dissolves.length; i++) {
      const d = dissolves[i];
      if (!d.active) {
        d.active = true;
        d.char = char;
        d.x = x;
        d.y = y;
        d.glyphSize = glyphSize;
        d.glyphY = glyphY;
        d.age = 0;
        d.duration = 0.58;
        return;
      }
    }
  };

  const emitParticles = (x: number, y: number, color: string, count = 24) => {
    if (propsRef.current.themeMode === 'wash') {
      // In sumi-ink mode, never launch jumping dots — emit organic soaking ink-wash plumes instead
      const plumeCount = count >= 30 ? 6 : count >= 18 ? 4 : 3;
      const baseR = count >= 30 ? 96 : count >= 18 ? 74 : 52;
      const peakA = count >= 30 ? 0.25 : count >= 18 ? 0.21 : 0.15;
      emitInkPlumes(x, y, plumeCount, baseR, peakA, false);
      return;
    }
    const { particles } = simRef.current;
    let spawned = 0;
    for (let i = 0; i < particles.length && spawned < count; i++) {
      const p = particles[i];
      if (!p.active) {
        const angle = (Math.PI * 2 * spawned) / count + (Math.random() - 0.5) * 0.45;
        const speed = 70 + Math.random() * 190;
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 35;
        p.size = 2.2 + Math.random() * 3.6;
        p.alpha = 1;
        p.decay = 1.35 + Math.random() * 0.9;
        p.color = spawned % 3 === 0 ? '#F2EEE6' : color;
        spawned++;
      }
    }
  };

  const emitInkRipples = (
    x: number,
    y: number,
    color: string,
    ringCount = 2,
    baseMaxR = 78,
    dashed = false
  ) => {
    const isWash = propsRef.current.themeMode === 'wash';
    if (isWash) {
      // Pure ink-in-water tonal diffusion — never draw concentric circle lines or hollow rings in wash mode
      emitInkPlumes(
        x,
        y,
        Math.min(3, Math.max(1, ringCount)),
        baseMaxR * 1.08,
        dashed ? 0.16 : 0.13,
        dashed
      );
      return;
    }
    const { ripples } = simRef.current;
    let spawned = 0;
    for (let i = 0; i < ripples.length && spawned < ringCount; i++) {
      const rp = ripples[i];
      if (!rp.active) {
        rp.active = true;
        rp.x = x;
        rp.y = y;
        rp.r = 12 + spawned * 8;
        rp.maxR = baseMaxR + spawned * 24;
        rp.maxAlpha = 0.32 - spawned * 0.1;
        rp.alpha = rp.maxAlpha;
        rp.age = 0;
        rp.duration = 0.6;
        rp.decay = 1.7;
        rp.color = color;
        rp.lineWidth = 1.5;
        rp.dashed = dashed;
        spawned++;
      }
    }
  };

  const emitFloat = (x: number, y: number, text: string, subText: string, color: string) => {
    const { floats } = simRef.current;
    const isWash = propsRef.current.themeMode === 'wash';
    for (let i = 0; i < floats.length; i++) {
      const f = floats[i];
      if (!f.active) {
        f.active = true;
        f.x = x;
        f.y = y;
        f.vy = isWash ? -20 : -48;
        f.text = text;
        f.subText = subText;
        f.alpha = isWash ? 0 : 1;
        f.age = 0;
        f.duration = isWash ? 0.96 : 0.87;
        f.color = color;
        return;
      }
    }
  };

  const syncHud = () => {
    const s = simRef.current;
    const accuracy = s.totalKeys > 0 ? Math.round((s.correctKeys / s.totalKeys) * 100) : 100;
    const cpm = s.elapsedSec > 1.5 ? Math.round((s.cleared / s.elapsedSec) * 60) : 0;
    const avgKeyMs = s.keyLatencyCount > 0 ? Math.round(s.keyLatencySum / s.keyLatencyCount) : 0;
    propsRef.current.onHudUpdate({
      score: s.score,
      combo: s.combo,
      maxCombo: s.maxCombo,
      cleared: s.cleared,
      targetGoal: s.targetGoal,
      lives: s.lives,
      maxLives: s.maxLives,
      wave: s.wave,
      accuracy,
      cpm,
      avgKeyMs,
      promotedCount: s.promotedCount,
    });
  };

  const getActiveTile = (): FallingTile | null => {
    const s = simRef.current;
    if (s.tiles.length === 0) return null;
    if (s.activeUid !== null) {
      const found = s.tiles.find((t) => t.uid === s.activeUid);
      if (found) return found;
    }
    let best = s.tiles[0];
    for (let i = 1; i < s.tiles.length; i++) {
      if (s.tiles[i].y > best.y) best = s.tiles[i];
    }
    s.activeUid = best.uid;
    return best;
  };

  const syncTarget = (nowMs: number) => {
    const s = simRef.current;
    const active = getActiveTile();
    if (!active) {
      propsRef.current.onTargetUpdate(null);
      return;
    }
    const gm = masteryRef.current.glyphs[active.entry.id];
    const glyphLevel = gm ? gm.level : 0;
    const hesitationMs = Math.max(0, nowMs - active.lastKeyAt);
    const tabHintActive = nowMs < s.tabHintUntil;
    const forced = nowMs < s.forcedHintUntil || tabHintActive;
    const scaffoldLevel = getEffectiveScaffoldLevel(
      propsRef.current.scaffoldMode,
      glyphLevel,
      hesitationMs,
      forced
    );
    const nextIdx = active.typed.length;
    const nextKey = active.entry.code[nextIdx] || '';
    const nextRole = active.entry.roles?.[nextIdx];
    propsRef.current.onTargetUpdate({
      char: active.entry.char,
      code: active.entry.code,
      typed: active.typed,
      nextKey,
      nextRole,
      parts: active.entry.parts,
      palace: active.entry.palace,
      xray: active.entry.xray,
      wordPair: active.entry.wordPair,
      wordCharIdx: active.entry.wordCharIdx,
      scaffoldLevel,
      hesitationMs,
      glyphLevel,
      lastErrorKey: s.lastErrorKey,
      lastErrorTick: s.lastErrorTick,
      lastStrikeKey: s.lastStrikeKey,
      lastStrikeCorrect: s.lastStrikeCorrect,
      lastStrikeTick: s.lastStrikeTick,
      tabHintActive,
    });
  };

  const getSortedWeakEntries = (): WeakEntryInfo[] => {
    const arr = Array.from(simRef.current.weakStats.values())
      .map((item) => ({
        entry: item.entry,
        errors: item.errors,
        avgMs: item.count > 0 ? Math.round(item.totalMs / item.count) : 0,
      }))
      .filter((x) => x.errors > 0 || x.avgMs > 1200)
      .sort((a, b) => b.errors * 900 + b.avgMs - (a.errors * 900 + a.avgMs));

    const seen = new Set<string>();
    const out: WeakEntryInfo[] = [];
    for (const item of arr) {
      const k = item.entry.xray?.radicalChar || item.entry.char;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
      if (out.length >= 3) break;
    }
    return out;
  };

  const getFilteredEntries = (entries: GlyphEntry[]): GlyphEntry[] => {
    const sm = propsRef.current.scriptMode;
    if (!sm || sm === 'both') return entries;
    return entries.filter((e) => matchesScript(e.script, sm));
  };

  const spawnNextReflexTile = (nowMs: number) => {
    const s = simRef.current;
    const { scheme: sc, mode: md, focusKeys: fk, trainingScope: scope, customDeck: cDeck } =
      propsRef.current;
    const maxTier: 1 | 2 | 3 =
      md === 'weakkey' ? 2 : s.cleared < 8 ? 1 : s.cleared < 18 ? 2 : 3;

    const isFixedDeck = Boolean((cDeck && cDeck.length > 0) || (fk && fk.length === 1));
    const filteredPool = getFilteredEntries(sc.entries);

    // Single-chamber pass mode or campaign stage deck: walk sequentially so chained steps stay ordered!
    const pullNext = (exclude: Set<string>): GlyphEntry => {
      if (s.chamberDeck.length > 0) {
        return s.chamberDeck.shift()!;
      }
      return pickAdaptiveEntry(filteredPool, masteryRef.current, fk, exclude, maxTier, scope);
    };

    const usedIds = new Set<string>([
      ...s.tiles.map((t) => t.entry.id),
      ...s.queue.map((e) => e.id),
    ]);
    while (s.queue.length < 3 && (s.chamberDeck.length > 0 || !isFixedDeck)) {
      const picked = pullNext(usedIds);
      usedIds.add(picked.id);
      s.queue.push(picked);
    }

    const entry = s.queue.shift();
    if (!entry) return;

    const isWash = propsRef.current.themeMode === 'wash';
    const tile: FallingTile = {
      uid: s.uidSeq++,
      entry,
      x: 0.5,
      y: s.height * 0.48,
      vy: 0,
      typed: '',
      hadError: false,
      consecutiveErrors: 0,
      spawnedAt: nowMs,
      lastKeyAt: nowMs,
      scale:
        entry.xray?.completedIndices && entry.xray.completedIndices.length > 0
          ? 1
          : isWash
            ? 1.035
            : 0.86,
      flash: 0.45,
      shake: 0,
    };
    s.tiles = [tile];
    s.activeUid = tile.uid;
    if (isWash) {
      const depthMetrics = getDepthFocusMetrics(s.width, s.height, propsRef.current.hideCodeHints);
      const ey = propsRef.current.layoutMode === 'depth' ? s.height * depthMetrics.centerYRatio : tile.y;
      emitInkPlumes(s.width * 0.5, ey, 2, 72, 0.14, false);
    }

    const nextUsed = new Set<string>([tile.entry.id, ...s.queue.map((e) => e.id)]);
    while (s.queue.length < 3 && (s.chamberDeck.length > 0 || !isFixedDeck)) {
      const picked = pullNext(nextUsed);
      nextUsed.add(picked.id);
      s.queue.push(picked);
    }
  };

  const spawnArcadeTile = (nowMs: number) => {
    const s = simRef.current;
    const { scheme: sc, focusKeys: fk, trainingScope: scope } = propsRef.current;
    const maxTier: 1 | 2 | 3 = s.wave === 1 ? 1 : s.wave === 2 ? 2 : 3;
    const usedIds = new Set<string>(s.tiles.map((t) => t.entry.id));
    const filteredPool = getFilteredEntries(sc.entries);

    const existingFirstKeys = new Set(s.tiles.map((t) => t.entry.code[0]));
    let entry = pickAdaptiveEntry(filteredPool, masteryRef.current, fk, usedIds, maxTier, scope);
    for (let attempt = 0; attempt < 6; attempt++) {
      if (!existingFirstKeys.has(entry.code[0])) break;
      entry = pickAdaptiveEntry(filteredPool, masteryRef.current, fk, usedIds, maxTier, scope);
    }

    const lanes = [0.16, 0.33, 0.5, 0.67, 0.84];
    let bestLane = lanes[Math.floor(Math.random() * lanes.length)];
    let bestScore = -1;
    for (const lx of lanes) {
      let minDy = 9999;
      for (const t of s.tiles) {
        if (Math.abs(t.x - lx) < 0.14) {
          minDy = Math.min(minDy, t.y);
        }
      }
      if (minDy > bestScore) {
        bestScore = minDy;
        bestLane = lx;
      }
    }

    const baseSpeed = 30 + (s.wave - 1) * 7.5 + Math.min(26, s.cleared * 0.45);
    const lenFactor = entry.code.length >= 3 ? 0.84 : 1.0;

    const tile: FallingTile = {
      uid: s.uidSeq++,
      entry,
      x: bestLane,
      y: -36,
      vy: baseSpeed * lenFactor,
      typed: '',
      hadError: false,
      consecutiveErrors: 0,
      spawnedAt: nowMs,
      lastKeyAt: nowMs,
      scale: 0.9,
      flash: 0.3,
      shake: 0,
    };
    s.tiles.push(tile);
    if (s.activeUid === null) {
      s.activeUid = tile.uid;
    }
  };

  useEffect(() => {
    const s = simRef.current;
    const nowMs = performance.now();
    s.tiles = [];
    s.queue = [];
    s.chamberDeck = [];
    s.weakStats.clear();
    s.activeUid = null;
    s.score = 0;
    s.combo = 0;
    s.maxCombo = 0;
    s.cleared = 0;
    s.lives = mode === 'arcade' ? 5 : isBossTrial ? 3 : 5;
    s.maxLives = mode === 'arcade' ? 5 : isBossTrial ? 3 : 5;
    s.wave = 1;
    s.totalKeys = 0;
    s.correctKeys = 0;
    s.keyLatencySum = 0;
    s.keyLatencyCount = 0;
    s.promotedCount = 0;
    s.elapsedSec = 0;
    s.spawnTimer = 0.25;
    s.hitstopTimer = 0;
    s.camShake = 0;
    s.forcedHintUntil = 0;
    s.tabHintUntil = 0;
    s.imeWarningUntil = 0;
    s.lastErrorKey = null;
    s.lastErrorTick = 0;
    s.lastStrikeKey = null;
    s.lastStrikeCorrect = true;
    s.lastStrikeTick = 0;
    s.ended = false;
    s.particles.forEach((p) => (p.active = false));
    s.ripples.forEach((rp) => (rp.active = false));
    s.plumes.forEach((pl) => (pl.active = false));
    s.dissolves.forEach((d) => (d.active = false));
    s.floats.forEach((f) => (f.active = false));

    // Priority 1: Explicit campaign or weak-spot deck
    if (mode !== 'arcade' && customDeck && customDeck.length > 0) {
      s.chamberDeck = [...customDeck];
      s.targetGoal = customDeck.length;
    } else if (mode === 'reflex' && focusKeys && focusKeys.length === 1 && scheme.isLingming) {
      // Single Lingming Palace Chamber pass deck (filtered by scriptMode)
      const targetChamber = focusKeys[0];
      const desiredKind = trainingScope === 'da' ? 'da' : 'root';
      const chamberItems = getFilteredEntries(scheme.entries).filter(
        (e) => e.kind === desiredKind && e.palace?.chamberKey === targetChamber
      );
      if (chamberItems.length > 0) {
        s.chamberDeck = [...chamberItems];
        s.targetGoal = chamberItems.length;
      } else {
        s.targetGoal = 20;
      }
    } else {
      s.targetGoal =
        mode === 'arcade' ? arcadeGoal : mode === 'reflex' ? 30 : mode === 'weakkey' ? 25 : 0;
    }

    if (mode === 'reflex' || mode === 'weakkey') {
      spawnNextReflexTile(nowMs);
    } else {
      spawnArcadeTile(nowMs);
      s.spawnTimer = 1.65;
    }

    syncHud();
    syncTarget(nowMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme.id, mode, trainingScope, scriptMode, resetSignal]);

  useEffect(() => {
    if (paused && !simRef.current.ended) {
      speech.stop();
    }
  }, [paused]);

  useEffect(() => {
    return () => {
      speech.stop();
    };
  }, []);

  useEffect(() => {
    if (hintPulseTick > 0) {
      const now = performance.now();
      simRef.current.forcedHintUntil = now + 2400;
      simRef.current.tabHintUntil = now + 1800;
      syncTarget(now);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintPulseTick]);

  const processKeyInput = (rawKey: string) => {
    const s = simRef.current;
    if (propsRef.current.paused || s.ended) return;

    const nowMs = performance.now();
    const key = rawKey.toLowerCase();

    if (key === 'backspace') {
      const active = getActiveTile();
      if (active && active.typed.length > 0) {
        active.typed = active.typed.slice(0, -1);
        active.consecutiveErrors = 0;
        s.lastErrorKey = null;
        synth.playClick();
        syncTarget(nowMs);
      }
      return;
    }

    if (key === 'space') {
      const active = getActiveTile();
      if (active && active.typed.length > 0) {
        active.typed = '';
        active.consecutiveErrors = 0;
        s.lastErrorKey = null;
        synth.playClick();
        emitFloat(
          active.x * s.width,
          active.y + 42,
          uiText('已清空重輸', propsRef.current.uiScript),
          '',
          propsRef.current.themeMode === 'wash' ? '#4C4C48' : '#8FA0B8'
        );
        syncTarget(nowMs);
      }
      return;
    }

    if (!/^[a-z]$/.test(key)) return;

    let active = getActiveTile();
    if (!active) return;

    if (
      propsRef.current.mode === 'arcade' &&
      active.typed.length === 0 &&
      active.entry.code[0] !== key
    ) {
      const candidates = s.tiles
        .filter((t) => t.entry.code[0] === key)
        .sort((a, b) => b.y - a.y);
      if (candidates.length > 0) {
        active = candidates[0];
        s.activeUid = active.uid;
      }
    }

    const expectedKey = active.entry.code[active.typed.length];
    const keyLatency = Math.max(80, nowMs - active.lastKeyAt);
    s.totalKeys++;

    if (key === expectedKey) {
      s.correctKeys++;
      s.keyLatencySum += Math.min(2200, keyLatency);
      s.keyLatencyCount++;
      const isWashInput = propsRef.current.themeMode === 'wash';
      active.typed += key;
      active.consecutiveErrors = 0;
      active.lastKeyAt = nowMs;
      active.scale = isWashInput ? 1.02 : 1.14;
      active.flash = 0.85;
      s.lastErrorKey = null;
      s.lastStrikeKey = key;
      s.lastStrikeCorrect = true;
      s.lastStrikeTick = nowMs;

      masteryRef.current = recordKeyResult(masteryRef.current, expectedKey, true, keyLatency);

      // Speak representative pronunciation immediately upon hitting the first primary key correctly!
      if (active.typed.length === 1) {
        speech.speakGlyph(active.entry.xray?.radicalChar || active.entry.char, {
          isLingming: Boolean(propsRef.current.scheme.isLingming),
        });
      }

      const isComplete = active.typed === active.entry.code;
      if (isComplete) {
        s.tabHintUntil = 0;
        s.forcedHintUntil = 0;
        s.combo++;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        s.cleared++;

        const totalMs = Math.max(120, nowMs - active.spawnedAt);
        const statKey = active.entry.xray?.radicalChar || active.entry.char;
        const prevStat = s.weakStats.get(statKey);
        if (prevStat) {
          prevStat.totalMs += totalMs;
          prevStat.count += 1;
        } else {
          s.weakStats.set(statKey, {
            entry: active.entry,
            errors: 0,
            totalMs,
            count: 1,
          });
        }

        const speedBonus = totalMs / active.entry.code.length < 360 ? 45 : 15;
        const comboMult = 1 + Math.min(2.5, Math.floor(s.combo / 5) * 0.25);
        const pts = Math.round((40 * active.entry.code.length + speedBonus) * comboMult);
        s.score += pts;

        const { nextStore, promoted } = recordGlyphCompletion(
          masteryRef.current,
          active.entry.id,
          active.hadError,
          totalMs,
          active.entry.code.length
        );
        if (s.score > nextStore.bestScore) {
          nextStore.bestScore = s.score;
        }
        masteryRef.current = nextStore;
        if (promoted) s.promotedCount++;
        propsRef.current.onMasteryChange(nextStore);
        propsRef.current.onGlyphCleared?.(active.entry.xray?.radicalChar || active.entry.char);

        const zoneId = propsRef.current.scheme.keyMap[expectedKey]?.zoneId;
        const zoneColor =
          propsRef.current.scheme.zones.find((z) => z.id === zoneId)?.color || '#D89B3C';

        const px = active.x * s.width;
        const depthMetricsNow = getDepthFocusMetrics(
          s.width,
          s.height,
          propsRef.current.hideCodeHints
        );
        const py =
          propsRef.current.mode !== 'arcade' && propsRef.current.layoutMode === 'depth'
            ? s.height * depthMetricsNow.centerYRatio
            : active.y;
        const isWash = propsRef.current.themeMode === 'wash';
        if (isWash) {
          const dissolveSize =
            propsRef.current.mode !== 'arcade' && propsRef.current.layoutMode === 'depth'
              ? propsRef.current.scheme.isLingming
                ? depthMetricsNow.glyphSize
                : Math.max(48, Math.round(depthMetricsNow.glyphSize * 1.35))
              : propsRef.current.mode !== 'arcade'
                ? 72
                : 40;
          const dissolveYOff =
            propsRef.current.mode !== 'arcade' && propsRef.current.layoutMode === 'depth'
              ? depthMetricsNow.glyphYOffset
              : propsRef.current.mode !== 'arcade'
                ? -16
                : -15;
          emitDissolveGlyph(active.entry.char, px, py, dissolveSize, dissolveYOff);
        }
        emitParticles(px, py, isWash ? '#141413' : zoneColor, s.combo % 10 === 0 ? 38 : 22);
        emitInkRipples(px, py, isWash ? '#141413' : zoneColor, s.combo % 10 === 0 ? 3 : 2, isWash ? 96 : 68, false);

        const floatStartY =
          propsRef.current.mode !== 'arcade'
            ? py - (isWash ? 104 : 88)
            : py - 24;
        if (propsRef.current.isBossTrial && s.combo > 0 && s.combo % 12 === 0 && s.lives < s.maxLives) {
          s.lives = Math.min(s.maxLives, s.lives + 1);
          emitFloat(
            px,
            floatStartY - 30,
            uiText('墨印回復 +1', propsRef.current.uiScript),
            uiText(`${s.combo} 連擊`, propsRef.current.uiScript),
            propsRef.current.themeMode === 'wash' ? '#141413' : '#38A885'
          );
        }

        const speedTag =
          totalMs / active.entry.code.length < 320
            ? uiText('神速', propsRef.current.uiScript)
            : promoted
              ? uiText('記憶晉級', propsRef.current.uiScript)
              : `${Math.round(totalMs)}ms`;
        emitFloat(
          px,
          floatStartY,
          `+${pts}`,
          speedTag,
          promoted
            ? propsRef.current.themeMode === 'wash'
              ? '#141413'
              : '#2EA87E'
            : propsRef.current.themeMode === 'wash'
              ? '#242422'
              : '#F2EEE6'
        );

        if (s.combo > 0 && s.combo % 10 === 0) {
          synth.playMilestone();
          s.hitstopTimer = 0.048;
          s.camShake = 4.5;
        } else {
          synth.playKeyHit(s.combo, true);
          if (active.entry.code.length >= 3) {
            s.hitstopTimer = 0.025;
            s.camShake = 2.2;
          }
        }

        s.tiles = s.tiles.filter((t) => t.uid !== active!.uid);
        s.activeUid = null;

        if (propsRef.current.mode === 'arcade') {
          if (s.targetGoal > 0 && s.cleared >= s.targetGoal) {
            s.ended = true;
            syncHud();
            const accuracy = s.totalKeys > 0 ? Math.round((s.correctKeys / s.totalKeys) * 100) : 100;
            const cpm = s.elapsedSec > 0.5 ? Math.round((s.cleared / s.elapsedSec) * 60) : 0;
            const avgKeyMs =
              s.keyLatencyCount > 0 ? Math.round(s.keyLatencySum / s.keyLatencyCount) : 0;
            propsRef.current.onRoundEnd({
              reason: 'cleared',
              score: s.score,
              maxCombo: s.maxCombo,
              cleared: s.cleared,
              accuracy,
              cpm,
              avgKeyMs,
              promotedCount: s.promotedCount,
              durationSec: Math.round(s.elapsedSec),
              weakEntries: getSortedWeakEntries(),
            });
            return;
          }
          const nextWave = 1 + Math.floor(s.cleared / 10);
          if (nextWave > s.wave) {
            s.wave = nextWave;
            emitFloat(
              s.width * 0.5,
              s.height * 0.25,
              uiText(`第 ${s.wave} 陣`, propsRef.current.uiScript),
              uiText('進階詞根解鎖', propsRef.current.uiScript),
              propsRef.current.themeMode === 'wash' ? '#2B2B28' : '#D89B3C'
            );
          }
          if (s.tiles.length === 0) {
            spawnArcadeTile(nowMs);
            s.spawnTimer = Math.max(1.15, 2.3 - s.wave * 0.16);
          }
        } else {
          if (s.targetGoal > 0 && s.cleared >= s.targetGoal) {
            s.ended = true;
            syncHud();
            const accuracy = s.totalKeys > 0 ? Math.round((s.correctKeys / s.totalKeys) * 100) : 100;
            const cpm = s.elapsedSec > 0.5 ? Math.round((s.cleared / s.elapsedSec) * 60) : 0;
            const avgKeyMs =
              s.keyLatencyCount > 0 ? Math.round(s.keyLatencySum / s.keyLatencyCount) : 0;
            propsRef.current.onRoundEnd({
              reason: 'cleared',
              score: s.score,
              maxCombo: s.maxCombo,
              cleared: s.cleared,
              accuracy,
              cpm,
              avgKeyMs,
              promotedCount: s.promotedCount,
              durationSec: Math.round(s.elapsedSec),
              weakEntries: getSortedWeakEntries(),
            });
            return;
          }
          spawnNextReflexTile(nowMs);
        }
      } else {
        synth.playKeyHit(s.combo, false);
        const isWash = propsRef.current.themeMode === 'wash';
        const dm = getDepthFocusMetrics(s.width, s.height, propsRef.current.hideCodeHints);
        const hitY =
          propsRef.current.mode !== 'arcade' && propsRef.current.layoutMode === 'depth'
            ? s.height * dm.centerYRatio
            : active.y;
        emitParticles(active.x * s.width, hitY + (isWash ? 0 : 18), isWash ? '#484844' : '#D89B3C', 7);
        emitInkRipples(active.x * s.width, hitY, isWash ? '#181817' : '#D89B3C', 1, isWash ? 66 : 56, false);
        propsRef.current.onMasteryChange(masteryRef.current);
      }
    } else {
      // Wrong key: stay locked on current target, allow Space/Backspace reset, and auto-reveal hint on repeated error
      const isFirstErrorOnTile = !active.hadError;
      s.combo = 0;
      active.hadError = true;
      active.consecutiveErrors += 1;
      active.shake = 12;
      s.camShake = propsRef.current.themeMode === 'wash' ? 2.4 : 4.6;
      s.lastErrorKey = key;
      s.lastErrorTick = nowMs;
      s.lastStrikeKey = key;
      s.lastStrikeCorrect = false;
      s.lastStrikeTick = nowMs;
      const isWash = propsRef.current.themeMode === 'wash';
      const dm = getDepthFocusMetrics(s.width, s.height, propsRef.current.hideCodeHints);
      const errY =
        propsRef.current.mode !== 'arcade' && propsRef.current.layoutMode === 'depth'
          ? s.height * dm.centerYRatio
          : active.y;
      emitInkRipples(active.x * s.width, errY, isWash ? '#141413' : '#F04E3E', isWash ? 2 : 1, 72, isWash);
      if (isWash) {
        emitInkPlumes(active.x * s.width, errY, 3, 62, 0.22, true);
      }
      if (active.consecutiveErrors >= 2) {
        s.forcedHintUntil = nowMs + 4500;
        s.tabHintUntil = nowMs + 4500;
      }
      synth.playKeyMiss();

      const statKey = active.entry.xray?.radicalChar || active.entry.char;
      const prevStat = s.weakStats.get(statKey);
      if (prevStat) {
        prevStat.errors += 1;
      } else {
        s.weakStats.set(statKey, {
          entry: active.entry,
          errors: 1,
          totalMs: 0,
          count: 0,
        });
      }

      masteryRef.current = recordKeyResult(masteryRef.current, expectedKey, false, keyLatency);
      propsRef.current.onMasteryChange(masteryRef.current);

      if (propsRef.current.isBossTrial && propsRef.current.mode !== 'arcade' && isFirstErrorOnTile) {
        s.lives = Math.max(0, s.lives - 1);
        emitFloat(
          active.x * s.width,
          active.y - 42,
          uiText('墨印受損 -1', propsRef.current.uiScript),
          uiText(`餘 ${s.lives} 印`, propsRef.current.uiScript),
          propsRef.current.themeMode === 'wash' ? '#141413' : '#D94A38'
        );
        if (s.lives <= 0) {
          s.ended = true;
          syncHud();
          const accuracy = s.totalKeys > 0 ? Math.round((s.correctKeys / s.totalKeys) * 100) : 100;
          const cpm = s.elapsedSec > 0.5 ? Math.round((s.cleared / s.elapsedSec) * 60) : 0;
          const avgKeyMs =
            s.keyLatencyCount > 0 ? Math.round(s.keyLatencySum / s.keyLatencyCount) : 0;
          propsRef.current.onRoundEnd({
            reason: 'gameover',
            score: s.score,
            maxCombo: s.maxCombo,
            cleared: s.cleared,
            accuracy,
            cpm,
            avgKeyMs,
            promotedCount: s.promotedCount,
            durationSec: Math.round(s.elapsedSec),
            weakEntries: getSortedWeakEntries(),
          });
          return;
        }
      }
    }

    syncHud();
    syncTarget(nowMs);
  };

  useEffect(() => {
    if (virtualKeyEvent && virtualKeyEvent.tick > 0) {
      processKeyInput(virtualKeyEvent.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualKeyEvent]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (propsRef.current.paused || simRef.current.ended) return;

      // Space clears current mid-sequence input so user can restart cleanly from key 1
      if (e.key === ' ' || (e.key === 'Process' && e.code === 'Space')) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        e.preventDefault();
        processKeyInput('space');
        return;
      }
      if (e.key === 'Enter') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const now = performance.now();
        simRef.current.forcedHintUntil = now + 2600;
        simRef.current.tabHintUntil = now + 2200;
        syncTarget(now);
        return;
      }
      if (e.key === 'Backspace' || (e.key === 'Process' && e.code === 'Backspace')) {
        e.preventDefault();
        processKeyInput('backspace');
        return;
      }
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        e.preventDefault();
        processKeyInput(e.key);
        return;
      }
      // If user left OS Chinese IME enabled, still rescue physical KeyA..KeyZ presses & show non-blocking reminder
      if ((e.key === 'Process' || e.isComposing) && /^Key([A-Z])$/.test(e.code)) {
        const physicalLetter = RegExp.$1;
        simRef.current.imeWarningUntil = performance.now() + 3400;
        e.preventDefault();
        processKeyInput(physicalLetter);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      simRef.current.width = rect.width;
      simRef.current.height = rect.height;

      if (propsRef.current.mode !== 'arcade' && simRef.current.tiles.length === 1) {
        simRef.current.tiles[0].y = rect.height * 0.48;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);

    const drawRoundedRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const tick = (nowMs: number) => {
      const rawDt = (nowMs - lastTime) / 1000;
      lastTime = nowMs;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const s = simRef.current;
      const {
        paused: isPaused,
        mode: curMode,
        layoutMode: curLayout,
        scheme: curScheme,
        scaffoldMode: curScaffold,
        hideCodeHints: curHideCodeHints,
      } = propsRef.current;

      if (!isPaused && !s.ended) {
        s.ringPhase += dt * 2.2;
        if (s.hitstopTimer > 0) {
          s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
        } else {
          s.elapsedSec += dt;

          if (curMode === 'arcade') {
            s.spawnTimer -= dt;
            const maxConcurrent = Math.min(5, 2 + Math.floor(s.wave * 0.7));
            if (s.spawnTimer <= 0 && s.tiles.length < maxConcurrent) {
              spawnArcadeTile(nowMs);
              s.spawnTimer = Math.max(1.25, 2.75 - s.wave * 0.18);
            }

            const dangerLineY = s.height - 34;
            const survived: FallingTile[] = [];
            let lostLife = false;

            for (const tile of s.tiles) {
              tile.y += tile.vy * dt;
              if (tile.y + 44 >= dangerLineY) {
                lostLife = true;
                s.lives = Math.max(0, s.lives - 1);
                s.combo = 0;
                s.camShake = 7;
                const statKey = tile.entry.xray?.radicalChar || tile.entry.char;
                const prevStat = s.weakStats.get(statKey);
                if (prevStat) {
                  prevStat.errors += 1;
                } else {
                  s.weakStats.set(statKey, {
                    entry: tile.entry,
                    errors: 1,
                    totalMs: 0,
                    count: 0,
                  });
                }
                emitParticles(
                  tile.x * s.width,
                  dangerLineY,
                  propsRef.current.themeMode === 'wash' ? '#141413' : '#D94A38',
                  24
                );
                emitFloat(
                  tile.x * s.width,
                  dangerLineY - 24,
                  uiText('漏字', propsRef.current.uiScript),
                  tile.entry.char + ' · ' + tile.entry.code.toUpperCase(),
                  propsRef.current.themeMode === 'wash' ? '#141413' : '#D94A38'
                );
                synth.playLifeLost();
                if (s.activeUid === tile.uid) s.activeUid = null;
              } else {
                survived.push(tile);
              }
            }
            s.tiles = survived;

            if (lostLife) {
              syncHud();
              if (s.lives <= 0) {
                s.ended = true;
                const accuracy =
                  s.totalKeys > 0 ? Math.round((s.correctKeys / s.totalKeys) * 100) : 100;
                const cpm =
                  s.elapsedSec > 0.5 ? Math.round((s.cleared / s.elapsedSec) * 60) : 0;
                const avgKeyMs =
                  s.keyLatencyCount > 0 ? Math.round(s.keyLatencySum / s.keyLatencyCount) : 0;
                propsRef.current.onRoundEnd({
                  reason: 'gameover',
                  score: s.score,
                  maxCombo: s.maxCombo,
                  cleared: s.cleared,
                  accuracy,
                  cpm,
                  avgKeyMs,
                  promotedCount: s.promotedCount,
                  durationSec: Math.round(s.elapsedSec),
                  weakEntries: getSortedWeakEntries(),
                });
              } else if (s.tiles.length === 0) {
                spawnArcadeTile(nowMs);
              }
              syncTarget(nowMs);
            }
          }

          for (const tile of s.tiles) {
            tile.scale += (1 - tile.scale) * Math.min(1, dt * 14);
            tile.flash = Math.max(0, tile.flash - dt * 3.4);
            tile.shake = Math.max(0, tile.shake - dt * 36);
          }

          s.camShake = Math.max(0, s.camShake - dt * 22);

          for (const p of s.particles) {
            if (!p.active) continue;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 320 * dt;
            p.alpha -= p.decay * dt;
            if (p.alpha <= 0) p.active = false;
          }

          for (const pl of s.plumes) {
            if (!pl.active) continue;
            pl.age += dt;
            const drag = Math.exp(-3.4 * dt);
            pl.vx *= drag;
            pl.vy *= drag;
            pl.x += pl.vx * dt;
            pl.y += pl.vy * dt;
            if (pl.age >= pl.duration) pl.active = false;
          }

          for (const d of s.dissolves) {
            if (!d.active) continue;
            d.age += dt;
            if (d.age >= d.duration) d.active = false;
          }

          const isWashTick = propsRef.current.themeMode === 'wash';
          for (const rp of s.ripples) {
            if (!rp.active) continue;
            rp.age += dt;
            if (isWashTick) {
              const tNorm = Math.min(1, rp.age / rp.duration);
              const easeOut = 1 - Math.pow(1 - tNorm, 2.3);
              rp.r = 14 + (rp.maxR - 14) * easeOut;
              rp.alpha =
                tNorm < 0.2
                  ? rp.maxAlpha * (tNorm / 0.2)
                  : rp.maxAlpha * Math.pow(1 - (tNorm - 0.2) / 0.8, 1.35);
              if (tNorm >= 1) rp.active = false;
            } else {
              rp.r += (rp.maxR - rp.r) * Math.min(1, dt * 6.5);
              rp.alpha -= rp.decay * dt;
              if (rp.alpha <= 0) rp.active = false;
            }
          }

          for (const f of s.floats) {
            if (!f.active) continue;
            f.age += dt;
            if (isWashTick) {
              const tNorm = Math.min(1, f.age / f.duration);
              f.vy *= Math.exp(-2.1 * dt);
              f.y += f.vy * dt;
              f.alpha =
                tNorm < 0.18
                  ? tNorm / 0.18
                  : tNorm < 0.42
                    ? 1
                    : Math.max(0, 1 - (tNorm - 0.42) / 0.58);
              if (tNorm >= 1) f.active = false;
            } else {
              f.y += f.vy * dt;
              f.alpha -= dt * 1.15;
              if (f.alpha <= 0) f.active = false;
            }
          }

          if (nowMs - s.lastTargetSync > 240) {
            s.lastTargetSync = nowMs;
            syncTarget(nowMs);
          }
          if (nowMs - s.lastHudSync > 550) {
            s.lastHudSync = nowMs;
            syncHud();
          }
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = canvas.width / Math.max(1, s.width);
          ctx.save();
          ctx.scale(dpr, dpr);

          const isWash = propsRef.current.themeMode === 'wash';

          // In 'depth' mode (疊層景深), canvas stays transparent so Layer 0 (Blurred Keyboard) & Layer 1 (Stroke Cloud) shine cleanly through!
          ctx.clearRect(0, 0, s.width, s.height);
          if (curLayout === 'split') {
            if (isWash) {
              const paperGrad = ctx.createLinearGradient(0, 0, s.width, s.height);
              paperGrad.addColorStop(0, 'rgba(243, 241, 236, 0.86)');
              paperGrad.addColorStop(0.55, 'rgba(238, 236, 229, 0.84)');
              paperGrad.addColorStop(1, 'rgba(229, 226, 218, 0.88)');
              ctx.fillStyle = paperGrad;
              ctx.fillRect(0, 0, s.width, s.height);

              // Corner sumi ink-wash ambient clouds
              const tlMist = ctx.createRadialGradient(
                s.width * 0.12,
                s.height * 0.15,
                10,
                s.width * 0.12,
                s.height * 0.15,
                Math.max(220, s.width * 0.34)
              );
              tlMist.addColorStop(0, 'rgba(20, 20, 18, 0.068)');
              tlMist.addColorStop(0.55, 'rgba(64, 64, 60, 0.025)');
              tlMist.addColorStop(1, 'rgba(243, 241, 236, 0)');
              ctx.fillStyle = tlMist;
              ctx.fillRect(0, 0, s.width, s.height);

              const brMist = ctx.createRadialGradient(
                s.width * 0.88,
                s.height * 0.85,
                10,
                s.width * 0.88,
                s.height * 0.85,
                Math.max(220, s.width * 0.32)
              );
              brMist.addColorStop(0, 'rgba(28, 28, 26, 0.062)');
              brMist.addColorStop(0.6, 'rgba(92, 92, 86, 0.024)');
              brMist.addColorStop(1, 'rgba(243, 241, 236, 0)');
              ctx.fillStyle = brMist;
              ctx.fillRect(0, 0, s.width, s.height);
            } else {
              ctx.fillStyle = '#11151D';
              ctx.fillRect(0, 0, s.width, s.height);
              if (s.bgLoaded && s.bgImage) {
                ctx.save();
                ctx.globalAlpha = 0.55;
                ctx.drawImage(s.bgImage, 0, 0, s.width, s.height);
                ctx.restore();
              }
            }
          }

          if (s.camShake > 0.1) {
            const sx = (Math.random() - 0.5) * s.camShake * 1.4;
            const sy = (Math.random() - 0.5) * s.camShake * 1.4;
            ctx.translate(sx, sy);
          }

          if (curLayout === 'split') {
            ctx.strokeStyle = isWash ? 'rgba(20, 20, 18, 0.042)' : 'rgba(242, 238, 230, 0.035)';
            ctx.lineWidth = 1;
            for (let gx = 64; gx < s.width; gx += 64) {
              ctx.beginPath();
              ctx.moveTo(gx, 0);
              ctx.lineTo(gx, s.height);
              ctx.stroke();
            }
          }

          const depthMetrics = getDepthFocusMetrics(s.width, s.height, curHideCodeHints);

          if (curMode === 'arcade') {
            const dangerY = s.height - 34;
            const grad = ctx.createLinearGradient(0, dangerY, s.width, dangerY);
            const dangerRgb = isWash ? '20, 20, 18' : '217, 74, 56';
            grad.addColorStop(0, `rgba(${dangerRgb}, 0.04)`);
            grad.addColorStop(0.5, isWash ? 'rgba(20, 20, 18, 0.34)' : `rgba(${dangerRgb}, 0.65)`);
            grad.addColorStop(1, `rgba(${dangerRgb}, 0.04)`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = isWash ? 1.2 : 1.5;
            ctx.beginPath();
            ctx.moveTo(24, dangerY);
            ctx.lineTo(s.width - 24, dangerY);
            ctx.stroke();

            ctx.fillStyle = `rgba(${dangerRgb}, ${isWash ? 0.58 : 0.72})`;
            ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(uiText('防線', propsRef.current.uiScript), s.width - 28, dangerY - 6);
          } else {
            const cx = s.width * 0.5;
            const cy = s.height * (curLayout === 'depth' ? depthMetrics.centerYRatio : 0.48);

            if (curLayout === 'split') {
              const pulseR = 112 + Math.sin(s.ringPhase) * 4;
              if (isWash) {
                const haloGrad = ctx.createRadialGradient(cx, cy, pulseR * 0.25, cx, cy, pulseR * 1.32);
                haloGrad.addColorStop(0, 'rgba(20, 20, 18, 0.055)');
                haloGrad.addColorStop(0.55, 'rgba(56, 56, 52, 0.028)');
                haloGrad.addColorStop(1, 'rgba(243, 241, 236, 0)');
                ctx.fillStyle = haloGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, pulseR * 1.32, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.strokeStyle = 'rgba(216, 155, 60, 0.16)';
                ctx.lineWidth = 1.25;
                ctx.beginPath();
                ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
          }

          // Active guide beam only in split mode (in depth mode the keyboard is right behind!)
          if (curLayout === 'split') {
            const activeTile = getActiveTile();
            if (activeTile && (!isWash || curMode === 'arcade')) {
              const ax = activeTile.x * s.width;
              const ay = activeTile.y + (curMode === 'arcade' ? 48 : 86);
              const beamGrad = ctx.createLinearGradient(ax, ay, ax, s.height);
              if (isWash) {
                beamGrad.addColorStop(0, 'rgba(20, 20, 18, 0.14)');
                beamGrad.addColorStop(1, 'rgba(20, 20, 18, 0.0)');
                ctx.strokeStyle = beamGrad;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax, s.height);
                ctx.stroke();
              } else {
                beamGrad.addColorStop(0, 'rgba(216, 155, 60, 0.26)');
                beamGrad.addColorStop(1, 'rgba(216, 155, 60, 0.0)');
                ctx.strokeStyle = beamGrad;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 5]);
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax, s.height);
                ctx.stroke();
                ctx.setLineDash([]);
              }
            }
          }

          // Draw tiles (Foreground Focal Plane — crisp warm ivory & cinnabar/gold contrast!)
          for (const tile of s.tiles) {
            const isActive = tile.uid === s.activeUid;
            const isFocusMode = curMode !== 'arcade';
            const cardW = isFocusMode ? 236 : 132;
            const cardH = isFocusMode ? 180 : 114;
            const shakeOff = tile.shake > 0.2 ? Math.sin(nowMs * 0.08) * tile.shake * 0.6 : 0;
            const cx = tile.x * s.width + shakeOff;
            const cy =
              isFocusMode && curLayout === 'depth' ? s.height * depthMetrics.centerYRatio : tile.y;

            const glyphSize =
              isFocusMode && curLayout === 'depth'
                ? curScheme.isLingming
                  ? depthMetrics.glyphSize
                  : Math.max(48, Math.round(depthMetrics.glyphSize * 1.35))
                : isFocusMode
                  ? 72
                  : 40;
            const glyphY =
              isFocusMode && curLayout === 'depth'
                ? depthMetrics.glyphYOffset
                : isFocusMode
                  ? -16
                  : -15;

            const gm = masteryRef.current.glyphs[tile.entry.id];
            const glyphLevel = gm ? gm.level : 0;
            const hesitationMs = Math.max(0, nowMs - tile.lastKeyAt);
            const forced = nowMs < s.forcedHintUntil || nowMs < s.tabHintUntil;
            const scaffoldLevel = getEffectiveScaffoldLevel(
              curScaffold,
              glyphLevel,
              hesitationMs,
              forced
            );

            const nextCharKey = tile.entry.code[tile.typed.length] || tile.entry.code[0];
            const zoneId = curScheme.keyMap[nextCharKey]?.zoneId;
            const rawZoneColor =
              curScheme.zones.find((z) => z.id === zoneId)?.color || '#D89B3C';
            const zoneColor = isWash
              ? zoneId === 'left-con' || zoneId === 'phil'
                ? '#181817'
                : zoneId === 'right-con' || zoneId === 'stroke'
                  ? '#4E4E4A'
                  : zoneId === 'vowel' || zoneId === 'shape'
                    ? '#6A6A64'
                    : '#3A3A36'
              : rawZoneColor;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(tile.scale, tile.scale);
            if (isWash) {
              const spawnAge = Math.max(0, (nowMs - tile.spawnedAt) / 1000);
              const enterAlpha = Math.min(1, spawnAge / 0.24);
              ctx.globalAlpha *= enterAlpha;
            }

            if (curLayout === 'depth' && isFocusMode) {
              // Pure minimal sanctuary — soft ink-in-water tonal pool on strike/error (zero circle outlines)
              if (isWash && tile.flash > 0.04) {
                const haloR = Math.max(42, Math.round(glyphSize * (1.36 - tile.flash * 0.2)));
                const washGrad = ctx.createRadialGradient(0, glyphY, 4, 0, glyphY, haloR);
                washGrad.addColorStop(0, `rgba(20, 20, 18, ${(tile.flash * 0.15).toFixed(3)})`);
                washGrad.addColorStop(0.55, `rgba(56, 56, 52, ${(tile.flash * 0.065).toFixed(3)})`);
                washGrad.addColorStop(1, 'rgba(243, 241, 236, 0)');
                ctx.fillStyle = washGrad;
                ctx.beginPath();
                ctx.arc(0, glyphY, haloR, 0, Math.PI * 2);
                ctx.fill();
              }
              if (tile.shake > 1) {
                if (isWash) {
                  const errStrength = Math.min(1, tile.shake / 12);
                  const errR = Math.max(46, Math.round(glyphSize * 1.45));
                  const errGrad = ctx.createRadialGradient(0, glyphY, 2, 0, glyphY, errR);
                  errGrad.addColorStop(0, `rgba(16, 16, 15, ${(errStrength * 0.24).toFixed(3)})`);
                  errGrad.addColorStop(0.45, `rgba(38, 38, 36, ${(errStrength * 0.12).toFixed(3)})`);
                  errGrad.addColorStop(1, 'rgba(243, 241, 236, 0)');
                  ctx.fillStyle = errGrad;
                  ctx.beginPath();
                  ctx.arc(0, glyphY, errR, 0, Math.PI * 2);
                  ctx.fill();
                } else {
                  ctx.strokeStyle = 'rgba(240, 78, 62, 0.7)';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.arc(0, glyphY, Math.max(30, Math.round(glyphSize * 1.05)), 0, Math.PI * 2);
                  ctx.stroke();
                }
              }
            } else {
              drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, isFocusMode ? 14 : 11);
              ctx.fillStyle = isWash
                ? isActive
                  ? curLayout === 'depth'
                    ? 'rgba(248, 247, 243, 0.95)'
                    : '#F8F7F3'
                  : 'rgba(235, 233, 226, 0.90)'
                : isActive
                  ? curLayout === 'depth'
                    ? 'rgba(16, 21, 30, 0.90)'
                    : '#1A202C'
                  : 'rgba(16, 21, 30, 0.82)';
              ctx.fill();

              ctx.lineWidth = isActive ? 1.8 : 1;
              ctx.strokeStyle =
                tile.shake > 1
                  ? isWash
                    ? '#141413'
                    : '#D94A38'
                  : isActive
                    ? zoneColor
                    : isWash
                      ? 'rgba(20, 20, 18, 0.16)'
                      : 'rgba(242, 238, 230, 0.14)';
              ctx.stroke();

              if (tile.flash > 0.02) {
                ctx.fillStyle = isWash
                  ? `rgba(20, 20, 18, ${tile.flash * 0.08})`
                  : `rgba(242, 238, 230, ${tile.flash * 0.14})`;
                ctx.fill();
              }

              ctx.fillStyle = zoneColor;
              ctx.globalAlpha = isActive ? 0.9 : 0.4;
              drawRoundedRect(ctx, -cardW / 2 + 16, -cardH / 2, cardW - 32, 3, 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            }

            // Entry kind & pinyin (shown in split mode only; depth mode stays ultra-clean!)
            if (isFocusMode && curLayout === 'split' && tile.entry.kind) {
              ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.58)' : 'rgba(242, 238, 230, 0.56)';
              ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
              ctx.textAlign = 'center';
              const kindText = uiText(
                tile.entry.kind === 'da'
                  ? '大碼定位'
                  : tile.entry.kind === 'root'
                    ? tile.entry.palace?.isXiao
                      ? '小根 · 大韻'
                      : '大根 · 大聲韻'
                    : '靈明單字',
                propsRef.current.uiScript
              );
              const reading =
                scaffoldLevel === 0
                  ? getRadicalReading(tile.entry.char, {
                      isLingming: Boolean(curScheme.isLingming),
                    })
                  : null;
              const topLine =
                reading && reading.pinyin ? `${kindText} · ${reading.pinyin}` : kindText;
              ctx.fillText(topLine, 0, -cardH / 2 + 16);
            }

            // Primary Foreground Chinese Glyph — clean, scaled 1:1 with the full Memory Palace cloud!

            // Subtle Stage 4 chain progress badge or Stage 5 word flow partner char
            if (tile.entry.xray?.totalSteps) {
              ctx.save();
              ctx.fillStyle = isWash ? '#181817' : '#7CE5BC';
              ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(
                uiText(
                  `筆順連點 ${tile.entry.xray.stepIndex}/${tile.entry.xray.totalSteps}`,
                  propsRef.current.uiScript
                ),
                0,
                Math.round(glyphY - glyphSize * 0.72 - 14)
              );
              ctx.restore();
            } else if (tile.entry.wordPair && tile.entry.wordCharIdx !== undefined) {
              const partnerIdx = tile.entry.wordCharIdx === 0 ? 1 : 0;
              const partnerChar = tile.entry.wordPair[partnerIdx];
              if (partnerChar) {
                const offsetX =
                  tile.entry.wordCharIdx === 0
                    ? glyphSize * 1.18
                    : -glyphSize * 1.18;
                ctx.save();
                ctx.fillStyle =
                  tile.entry.wordCharIdx === 0
                    ? isWash
                      ? 'rgba(20, 20, 18, 0.28)'
                      : 'rgba(242, 238, 230, 0.28)'
                    : isWash
                      ? 'rgba(20, 20, 18, 0.62)'
                      : 'rgba(56, 168, 133, 0.56)';
                ctx.font = `600 ${Math.round(glyphSize * 0.78)}px "Noto Serif TC", serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(partnerChar, offsetX, glyphY);
                ctx.restore();
              }
            }

            ctx.fillStyle = isWash ? '#141413' : '#FFF9EE';
            if (tile.entry.xray) {
              // Stage 4: MakeMeAHanzi exact vector strokes inside 1024x1024 box (translate(0, 900) scale(1, -1))
              const xr = tile.entry.xray;
              const activeSet = new Set(xr.activeIndices);
              const doneSet = new Set(xr.completedIndices || []);
              const u = (glyphSize * 1.08) / 1024;
              ctx.save();
              ctx.translate(0, glyphY);
              ctx.scale(u, -u);
              ctx.translate(-512, -388);

              // Pass 1: Faint ink base strokes
              ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.16)' : 'rgba(242, 238, 230, 0.16)';
              for (let i = 0; i < xr.strokes.length; i++) {
                if (activeSet.has(i) || doneSet.has(i)) continue;
                const sp = xr.strokes[i];
                let p2d = pathCacheRef.current.get(sp);
                if (!p2d) {
                  p2d = new Path2D(sp);
                  pathCacheRef.current.set(sp, p2d);
                }
                ctx.fill(p2d);
              }

              // Pass 2: Earlier completed radical strokes in multi-step chaining (medium ink)
              if (doneSet.size > 0) {
                ctx.fillStyle = isWash ? 'rgba(68, 68, 64, 0.72)' : 'rgba(56, 168, 133, 0.65)';
                for (const i of doneSet) {
                  const sp = xr.strokes[i];
                  if (!sp) continue;
                  let p2d = pathCacheRef.current.get(sp);
                  if (!p2d) {
                    p2d = new Path2D(sp);
                    pathCacheRef.current.set(sp, p2d);
                  }
                  ctx.fill(p2d);
                }
              }

              // Pass 3: Highlighted target radical strokes (deep sumi ink or crisp warm ivory)
              ctx.fillStyle = isWash ? '#141413' : '#FFF9EE';
              for (const i of activeSet) {
                const sp = xr.strokes[i];
                if (!sp) continue;
                let p2d = pathCacheRef.current.get(sp);
                if (!p2d) {
                  p2d = new Path2D(sp);
                  pathCacheRef.current.set(sp, p2d);
                }
                ctx.fill(p2d);
              }
              ctx.restore();
            } else if (tile.entry.char === '𠂇') {
              // Crisp Songti calligraphic two-stroke render for CJK Ext-B 「𠂇」 so it never shows as a missing-font box
              ctx.save();
              ctx.translate(0, glyphY);
              const u = glyphSize / 100;
              ctx.scale(u, u);
              ctx.translate(-50, -52);
              // Stroke 1: Upper horizontal bar (橫)
              ctx.beginPath();
              ctx.moveTo(12, 31.5);
              ctx.lineTo(77, 29.2);
              ctx.quadraticCurveTo(82, 28.8, 86.5, 32.5);
              ctx.quadraticCurveTo(87.5, 34.4, 85, 35.6);
              ctx.lineTo(14.5, 36.8);
              ctx.quadraticCurveTo(11.5, 36.2, 12, 31.5);
              ctx.closePath();
              ctx.fill();
              // Stroke 2: Sweeping left-falling stroke (長撇)
              ctx.beginPath();
              ctx.moveTo(51, 12.5);
              ctx.quadraticCurveTo(56.5, 14, 58.2, 18.2);
              ctx.bezierCurveTo(53.5, 37, 46, 58, 34.5, 73.5);
              ctx.bezierCurveTo(26.5, 83.5, 17.5, 89.5, 11.2, 92.2);
              ctx.bezierCurveTo(10.2, 91.2, 10.6, 89.4, 12.2, 88);
              ctx.bezierCurveTo(22.5, 79.5, 33.8, 63.5, 41.2, 44.5);
              ctx.bezierCurveTo(45.8, 32.5, 48.2, 21.5, 48.8, 14.5);
              ctx.quadraticCurveTo(49.2, 12.2, 51, 12.5);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            } else {
              ctx.font = `700 ${glyphSize}px "Noto Serif TC", serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(tile.entry.char, 0, glyphY);
            }

            // Stage 2 quiet structural decomposition dots or Tab-peek / Split parts line
            const isStage2 = propsRef.current.stageKind === 'primary_hanzi';
            if (isStage2 && isFocusMode && scaffoldLevel >= 2 && tile.entry.parts.length > 1) {
              const dotCount = tile.entry.parts.length;
              const dotGap = 10;
              const startDotX = -((dotCount - 1) * dotGap) / 2;
              const dotY = Math.round(glyphY + glyphSize * 0.65 + 7);
              const approxRootsDone = Math.min(
                dotCount,
                Math.floor((tile.typed.length / Math.max(1, tile.entry.code.length)) * dotCount)
              );
              for (let di = 0; di < dotCount; di++) {
                ctx.beginPath();
                ctx.arc(startDotX + di * dotGap, dotY, 2.4, 0, Math.PI * 2);
                ctx.fillStyle =
                  di < approxRootsDone
                    ? isWash
                      ? 'rgba(20, 20, 18, 0.85)'
                      : 'rgba(56, 168, 133, 0.85)'
                    : isWash
                      ? 'rgba(20, 20, 18, 0.22)'
                      : 'rgba(242, 238, 230, 0.24)';
                ctx.fill();
              }
            }

            // Memory Palace Lineage or Decomposition (split mode, Stage 2 adaptive scaffold, or Tab peek)
            if (
              scaffoldLevel <= 1 &&
              (curLayout === 'split' ||
                nowMs < s.tabHintUntil ||
                (isStage2 && scaffoldLevel === 0))
            ) {
              ctx.fillStyle = isWash
                ? scaffoldLevel === 0
                  ? 'rgba(20, 20, 18, 0.86)'
                  : 'rgba(20, 20, 18, 0.50)'
                : scaffoldLevel === 0
                  ? 'rgba(255, 245, 224, 0.88)'
                  : 'rgba(242, 238, 230, 0.48)';
              ctx.font = isFocusMode
                ? '500 13px "Plus Jakarta Sans", sans-serif'
                : '500 11px "Plus Jakarta Sans", sans-serif';
              const partsLine = tile.entry.parts.join(' · ');
              const partsY = isFocusMode
                ? curLayout === 'depth'
                  ? Math.round(glyphY - glyphSize * 0.65 - 14)
                  : 38
                : 18;
              ctx.fillText(partsLine, 0, partsY);
            }

            // Role-coded full code slots (da / sheng / yun) — completely hidden when hideCodeHints is enabled (until Tab peek)!
            const showCodeSlots = !curHideCodeHints || nowMs < s.tabHintUntil;
            const slotY = isFocusMode
              ? curLayout === 'depth'
                ? Math.round(glyphY + glyphSize * 0.65 + 16)
                : 54
              : 33;
            const slotH = isFocusMode ? 32 : 19;

            if (showCodeSlots) {
              const codeChars = tile.entry.code.split('');
              const slotW = isFocusMode ? 36 : 20;
              const slotGap = isFocusMode ? 9 : 5;
              const totalW = codeChars.length * slotW + (codeChars.length - 1) * slotGap;
              let startX = -totalW / 2;

              codeChars.forEach((ch, idx) => {
                const isTyped = idx < tile.typed.length;
                const isCurrent = idx === tile.typed.length && isActive;
                const role = tile.entry.roles?.[idx];
                const isYun = role === 'yun';
                const slotBorderColor = isYun ? (isWash ? '#4E4E4A' : '#E8B356') : zoneColor;

                drawRoundedRect(ctx, startX, slotY, slotW, slotH, 6);
                if (isTyped) {
                  ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.14)' : 'rgba(46, 168, 126, 0.30)';
                  ctx.fill();
                  ctx.strokeStyle = isWash ? '#181817' : '#38C793';
                  ctx.lineWidth = 1.3;
                  ctx.stroke();
                } else if (isCurrent) {
                  ctx.fillStyle = isYun
                    ? isWash
                      ? 'rgba(48, 48, 44, 0.12)'
                      : 'rgba(216, 155, 60, 0.24)'
                    : isWash
                      ? 'rgba(20, 20, 18, 0.10)'
                      : 'rgba(56, 168, 133, 0.22)';
                  ctx.fill();
                  ctx.strokeStyle = slotBorderColor;
                  ctx.lineWidth = 1.4;
                  ctx.stroke();
                } else {
                  ctx.fillStyle = isWash ? 'rgba(248, 247, 243, 0.85)' : 'rgba(15, 20, 29, 0.72)';
                  ctx.fill();
                  ctx.strokeStyle = isYun
                    ? isWash
                      ? 'rgba(48, 48, 44, 0.36)'
                      : 'rgba(216, 155, 60, 0.4)'
                    : isWash
                      ? 'rgba(20, 20, 18, 0.20)'
                      : 'rgba(242, 238, 230, 0.16)';
                  ctx.lineWidth = 1;
                  ctx.stroke();
                }

                let letterAlpha = 0;
                if (isTyped) letterAlpha = 1;
                else if (scaffoldLevel === 0) letterAlpha = 0.98;
                else if (scaffoldLevel === 1) letterAlpha = isCurrent ? 0.5 : 0.24;

                if (letterAlpha > 0) {
                  ctx.fillStyle = isTyped
                    ? isWash
                      ? '#111110'
                      : '#6AF0BE'
                    : isYun
                      ? isWash
                        ? `rgba(60, 60, 56, ${letterAlpha})`
                        : `rgba(245, 200, 110, ${letterAlpha})`
                      : isWash
                        ? `rgba(20, 20, 18, ${letterAlpha})`
                        : `rgba(255, 249, 238, ${letterAlpha})`;
                  ctx.font = isFocusMode
                    ? '700 15px "JetBrains Mono", monospace'
                    : '600 11px "JetBrains Mono", monospace';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  const displayLetter = role === 'da' || !role ? ch.toUpperCase() : ch.toLowerCase();
                  ctx.fillText(displayLetter, startX + slotW / 2, slotY + slotH / 2 + 0.5);
                } else if (isCurrent) {
                  ctx.fillStyle = slotBorderColor;
                  ctx.beginPath();
                  ctx.arc(startX + slotW / 2, slotY + slotH / 2, 2.4, 0, Math.PI * 2);
                  ctx.fill();
                }

                startX += slotW + slotGap;
              });
            } else if (tile.typed.length > 0 && isFocusMode) {
              // Ultra-minimal whisper-quiet progress dots when code hints are hidden and user is mid-sequence
              const codeLen = tile.entry.code.length;
              const dotGap = 11;
              const totalDotW = (codeLen - 1) * dotGap;
              for (let i = 0; i < codeLen; i++) {
                ctx.fillStyle =
                  i < tile.typed.length
                    ? isWash
                      ? 'rgba(20, 20, 18, 0.80)'
                      : 'rgba(52, 211, 153, 0.75)'
                    : isWash
                      ? 'rgba(20, 20, 18, 0.18)'
                      : 'rgba(242, 238, 230, 0.14)';
                ctx.beginPath();
                ctx.arc(-totalDotW / 2 + i * dotGap, 62, 2.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }

            // Explicit error reminder & recovery hint when user strikes wrong key
            if (
              isFocusMode &&
              isActive &&
              ((s.lastErrorKey && nowMs - s.lastErrorTick < 2600) ||
                nowMs < s.imeWarningUntil)
            ) {
              const showImeHint = nowMs < s.imeWarningUntil;
              const isRescueActive = tile.consecutiveErrors >= 2;
              const msg = showImeHint
                ? '系統中文輸入法開啟中 · 建議切回英文鍵盤'
                : isRescueActive
                  ? '已自動顯示鍵碼提示（Space 清空重輸）'
                  : tile.typed.length > 0
                    ? `誤按 ${s.lastErrorKey!.toUpperCase()} · 再錯將提示（Space 重輸）`
                    : `誤按 ${s.lastErrorKey!.toUpperCase()} · 再錯將自動顯示鍵碼`;
              ctx.fillStyle = showImeHint
                ? isWash
                  ? '#3E3E3A'
                  : '#F2D59B'
                : isRescueActive
                  ? isWash
                    ? '#2D2D2A'
                    : '#E8B356'
                  : isWash
                    ? '#141413'
                    : '#F06454';
              ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(
                uiText(msg, propsRef.current.uiScript),
                0,
                showCodeSlots ? slotY + slotH + 16 : 82
              );
            }

            ctx.restore();
          }

          // Completed glyph ink-dissolve afterimages in wash mode (擴散淡出)
          if (isWash) {
            for (const d of s.dissolves) {
              if (!d.active) continue;
              const tNorm = Math.min(1, d.age / d.duration);
              const ease = 1 - Math.pow(1 - tNorm, 2);
              const scale = 1 + ease * 0.14;
              const fade = Math.pow(1 - tNorm, 1.55);
              ctx.save();
              ctx.translate(d.x, d.y);
              ctx.scale(scale, scale);

              // Soft absorbing ink mist behind fading glyph
              const haloR = d.glyphSize * (0.95 + ease * 0.55);
              const dGrad = ctx.createRadialGradient(0, d.glyphY, 2, 0, d.glyphY, haloR);
              dGrad.addColorStop(0, `rgba(20, 20, 18, ${(fade * 0.16).toFixed(3)})`);
              dGrad.addColorStop(0.55, `rgba(56, 56, 52, ${(fade * 0.065).toFixed(3)})`);
              dGrad.addColorStop(1, 'rgba(243, 241, 236, 0)');
              ctx.fillStyle = dGrad;
              ctx.beginPath();
              ctx.arc(0, d.glyphY, haloR, 0, Math.PI * 2);
              ctx.fill();

              if (d.char !== '𠂇') {
                ctx.globalAlpha = fade * 0.42;
                ctx.fillStyle = '#141413';
                ctx.font = `700 ${d.glyphSize}px "Noto Serif TC", serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(d.char, 0, d.glyphY);
              }
              ctx.restore();
            }
          }

          // Organic sumi ink-in-water diffusion plumes in wash mode (水墨滴入水中濃淡暈散)
          if (isWash) {
            for (const pl of s.plumes) {
              if (!pl.active) continue;
              const tNorm = Math.min(1, pl.age / pl.duration);
              const easeOut = 1 - Math.pow(1 - tNorm, 2.35);
              const r = pl.rStart + (pl.rMax - pl.rStart) * easeOut;
              const envAlpha =
                tNorm < 0.2
                  ? pl.peakAlpha * (tNorm / 0.2)
                  : pl.peakAlpha * Math.pow(1 - (tNorm - 0.2) / 0.8, 1.55);
              if (envAlpha <= 0.003) continue;

              ctx.save();
              ctx.translate(pl.x, pl.y);
              ctx.rotate(pl.angle);
              ctx.scale(1, pl.aspect);
              const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
              const baseDark = pl.isError ? '14, 14, 13' : '22, 22, 20';
              grad.addColorStop(0, `rgba(${baseDark}, ${(envAlpha * 0.96).toFixed(3)})`);
              grad.addColorStop(0.28, `rgba(38, 38, 35, ${(envAlpha * 0.62).toFixed(3)})`);
              grad.addColorStop(0.62, `rgba(74, 74, 69, ${(envAlpha * 0.22).toFixed(3)})`);
              grad.addColorStop(0.86, `rgba(112, 112, 106, ${(envAlpha * 0.05).toFixed(3)})`);
              grad.addColorStop(1, 'rgba(243, 241, 236, 0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(0, 0, r, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // Crisp geometric ripples in night mode only (wash mode uses purely borderless ink-in-water plumes above)
          if (!isWash) {
            for (const rp of s.ripples) {
              if (!rp.active) continue;
              ctx.save();
              ctx.globalAlpha = Math.max(0, rp.alpha);
              ctx.strokeStyle = rp.color;
              ctx.lineWidth = rp.lineWidth;
              ctx.beginPath();
              ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }

          // Particles (night ink sparks only; wash mode uses organic plumes above!)
          if (!isWash) {
            for (const p of s.particles) {
              if (!p.active) continue;
              ctx.save();
              ctx.globalAlpha = Math.max(0, p.alpha);
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // Float popups (soft ink bleed-in & dissolve in wash mode)
          for (const f of s.floats) {
            if (!f.active) continue;
            ctx.save();
            ctx.globalAlpha = Math.max(0, f.alpha);
            ctx.textAlign = 'center';
            ctx.fillStyle = f.color;
            ctx.font = isWash
              ? '700 15px "Noto Serif TC", Georgia, serif'
              : '700 15px "JetBrains Mono", monospace';
            ctx.fillText(f.text, f.x, f.y);
            if (f.subText) {
              ctx.fillStyle = isWash ? 'rgba(20, 20, 18, 0.72)' : 'rgba(242, 238, 230, 0.78)';
              ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
              ctx.fillText(f.subText, f.x, f.y + 16);
            }
            ctx.restore();
          }

          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none ${
        layoutMode === 'split' ? 'bg-[var(--dojo-canvas)]' : 'bg-transparent'
      }`}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
