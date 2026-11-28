import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Gauge,
  Keyboard,
  Maximize2,
  Minimize2,
  PenLine,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Shuffle,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { TWENTY_KEY_MORPH_BY_KEY, TWENTY_KEY_MORPHS } from '../data/twentyKeysMorph';
import {
  buildCustomTextTopologyDeck,
  buildGroupTopologyDeck,
  buildSingleKeyTopologyDeck,
  computeMedianMs,
  getNextMorphKey,
  rerollSingleItemCarrier,
  TOPOLOGY_GROUP_PRESETS,
  TopologyDrillItem,
  TopologyDrillOrder,
  TopologyGroupPresetId,
  TopologyKeyScope,
  TopologyMorphDirection,
  TopologyTriggerStyle,
  TopologyVisualMode,
  WRITING_STREAM_PRESETS,
} from '../data/topologyMuscleTraining';
import { ScriptMode } from '../data/scriptFilter';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { synth } from '../audio/synth';
import {
  drawCrystallizedCornerMark,
  drawDecayingPillarStroke,
  drawExpandingPillarStroke,
  drawInwardPillarLightStreams,
  drawMiZiPaper,
  drawOutwardPillarLightStreams,
  renderStaticConvergenceStamp,
  sampleCatmullRom,
} from '../utils/topologyBrushRenderer';

interface TopologyMuscleTrainerProps {
  initialKey?: string;
  initialOrder?: TopologyDrillOrder;
  initialVisualMode?: TopologyVisualMode;
  scriptMode: ScriptMode;
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onBackToTheater: (focusKey: string) => void;
}

const QWERTY_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const VISUAL_MODE_OPTIONS: Array<{
  id: TopologyVisualMode;
  label: string;
  tip: string;
}> = [
  {
    id: 'converge_guide',
    label: '随速演变',
    tip: '按你的真实输入速度演练字根⇄拓扑共形动画（快捷键 1）',
  },
  {
    id: 'flash_reflex',
    label: '全字盲打',
    tip: '隐藏焦形提示；击对瞬间按你的速度闪现收敛/扩张印证（快捷键 2）',
  },
  {
    id: 'hanzi_xray',
    label: '实字捕形',
    tip: '在真实汉字笔画中识别局部字根，并印证对应焦形（快捷键 3）',
  },
];

const ORDER_OPTIONS: Array<{
  id: 'sequential' | 'key_shuffle' | 'cross_key_jump';
  label: string;
  tip: string;
}> = [
  { id: 'sequential', label: '本键循序', tip: '按频次顺次演练当前键位全部字根（快捷键 4）' },
  { id: 'key_shuffle', label: '本键乱序', tip: '打乱当前键位字根次序（快捷键 5）' },
  {
    id: 'cross_key_jump',
    label: '20 键跳跃',
    tip: '跨全部 20 键随机跳跃且相邻不重键（快捷键 6）',
  },
];

interface DirectionCompareStats {
  hits: number;
  misses: number;
  latencies: number[];
}

interface StageAnim {
  id: number;
  item: TopologyDrillItem;
  kind: 'da_ignite' | 'sheng_spread' | 'full_spread' | 'single_converge';
  fromP: number;
  toP: number;
  durationMs: number;
  holdMs: number;
  completedCode?: string;
  isCompleteSweep: boolean;
}

interface MissSlotInfo {
  slotIndex: number;
  slotLabel: string;
  expectedChar: string;
  typedChar: string;
}

function getCodeSlotLabels(codeLen: number, scope: TopologyKeyScope): string[] {
  if (scope === 'da' || codeLen <= 1) return ['大码'];
  if (codeLen === 2) return ['大码', '韵码'];
  return ['大码', '声码', '韵码'];
}

/** Small crisp canvas badge rendering the key's crystallized focal shape stamp */
const FocalStampBadge: React.FC<{
  item: TopologyDrillItem;
  isWash: boolean;
  size?: number;
}> = ({ item, isWash, size = 76 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    renderStaticConvergenceStamp(ctx, item.convergence, item.radical, 0, 0, size, {
      isWash,
      showPaper: true,
      showGhostGlyph: true,
      showWatermark: false,
      ghostAlpha: isWash ? 0.16 : 0.2,
    });
  }, [item, isWash, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className="block rounded-lg"
      aria-hidden="true"
    />
  );
};

export const TopologyMuscleTrainer: React.FC<TopologyMuscleTrainerProps> = ({
  initialKey = 'h',
  initialOrder = 'sequential',
  initialVisualMode = 'converge_guide',
  scriptMode,
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  onBackToTheater,
}) => {
  const isWash = themeMode === 'wash';

  const [focusKey, setFocusKey] = useState<string>(() =>
    TWENTY_KEY_MORPH_BY_KEY.has(initialKey.toLowerCase()) ? initialKey.toLowerCase() : 'h'
  );
  const [visualMode, setVisualMode] = useState<TopologyVisualMode>(initialVisualMode);
  const [morphDirection, setMorphDirection] = useState<TopologyMorphDirection>('converge');
  const [triggerStyle, setTriggerStyle] = useState<TopologyTriggerStyle>('key_strike');
  const [drillOrder, setDrillOrder] = useState<TopologyDrillOrder>(initialOrder);
  const [groupPresetId, setGroupPresetId] = useState<TopologyGroupPresetId>('all_20_core');
  const [keyScope, setKeyScope] = useState<TopologyKeyScope>('full');
  const [showTactileDeck, setShowTactileDeck] = useState<boolean>(true);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [customModalOpen, setCustomModalOpen] = useState<boolean>(false);
  const [customDraft, setCustomDraft] = useState<string>(WRITING_STREAM_PRESETS[0].text);
  const [customNotice, setCustomNotice] = useState<string | null>(null);
  const [customStreamLabel, setCustomStreamLabel] = useState<string | null>(null);
  const [chromeCalm, setChromeCalm] = useState<boolean>(false);
  const [weakDrillLabel, setWeakDrillLabel] = useState<string | null>(null);

  // Adaptive live typing speed (EMA of recent inter-keystroke intervals, clamped 180..1450ms)
  const [livePaceMs, setLivePaceMs] = useState<number>(640);
  const [paceLockedSlow, setPaceLockedSlow] = useState<boolean>(false);

  // Active deck & progression state
  const [deck, setDeck] = useState<TopologyDrillItem[]>(() => {
    if (initialOrder === 'cross_key_jump') {
      return buildGroupTopologyDeck('all_20_core', scriptMode);
    }
    return buildSingleKeyTopologyDeck(
      TWENTY_KEY_MORPH_BY_KEY.has(initialKey.toLowerCase()) ? initialKey.toLowerCase() : 'h',
      initialOrder === 'key_shuffle',
      scriptMode
    );
  });
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [typedCode, setTypedCode] = useState<string>('');
  const [completedUids, setCompletedUids] = useState<Set<string>>(() => new Set());
  const [roundDone, setRoundDone] = useState<boolean>(false);

  // Visual & neuro-motor feedback state
  const [hintRevealed, setHintRevealed] = useState<boolean>(false);
  const [errorFlash, setErrorFlash] = useState<boolean>(false);
  const [missInfo, setMissInfo] = useState<MissSlotInfo | null>(null);
  const [wrongStruckKey, setWrongStruckKey] = useState<string | null>(null);
  const [lastCorrectKey, setLastCorrectKey] = useState<{ key: string; tick: number } | null>(null);
  const [hitBurst, setHitBurst] = useState<{
    tick: number;
    key: string;
    code: string;
    radical: string;
    homeKey: string;
    shapeSymbol: string;
    shapeLabel: string;
    latencyMs: number;
  } | null>(null);
  // Real-time per-keystroke calligraphic stage animation (主键→红共形, 声码→红半扩, 韵码→红全扩)
  const [stageAnim, setStageAnim] = useState<StageAnim | null>(null);
  const [replayNonce, setReplayNonce] = useState<number>(0);

  // Real performance metrics + live A/B comparison between Converge vs Expand
  const [hitsCount, setHitsCount] = useState<number>(0);
  const [missesCount, setMissesCount] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [bestCombo, setBestCombo] = useState<number>(0);
  const [latenciesMs, setLatenciesMs] = useState<number[]>([]);
  const [weakItemsMap, setWeakItemsMap] = useState<Record<string, TopologyDrillItem>>({});
  const [abStats, setAbStats] = useState<Record<TopologyMorphDirection, DirectionCompareStats>>({
    converge: { hits: 0, misses: 0, latencies: [] },
    expand: { hits: 0, misses: 0, latencies: [] },
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const itemStartMsRef = useRef<number>(performance.now());
  const errorTimerRef = useRef<number | null>(null);
  const sweepTimerRef = useRef<number | null>(null);
  const burstTimerRef = useRef<number | null>(null);
  const keyPulseTimerRef = useRef<number | null>(null);

  const activeItem = deck[activeIdx] ?? deck[0] ?? null;
  const activeKey = activeItem?.key ?? focusKey;
  const activeSpec =
    activeItem?.spec ?? TWENTY_KEY_MORPH_BY_KEY.get(focusKey) ?? TWENTY_KEY_MORPHS[0];

  const effectivePaceMs = paceLockedSlow ? Math.round(livePaceMs * 1.75) : livePaceMs;

  const targetCode = useMemo(() => {
    if (!activeItem) return '';
    return keyScope === 'da' ? activeItem.key : activeItem.ma;
  }, [activeItem, keyScope]);

  const accuracy = useMemo(() => {
    const total = hitsCount + missesCount;
    return total === 0 ? 100 : Math.round((hitsCount / total) * 100);
  }, [hitsCount, missesCount]);

  const medianLatencyMs = useMemo(() => computeMedianMs(latenciesMs), [latenciesMs]);
  const weakItemsList = useMemo(() => Object.values(weakItemsMap), [weakItemsMap]);

  const convergeMedian = useMemo(
    () => computeMedianMs(abStats.converge.latencies),
    [abStats.converge.latencies]
  );
  const expandMedian = useMemo(
    () => computeMedianMs(abStats.expand.latencies),
    [abStats.expand.latencies]
  );
  const convergeAcc = useMemo(() => {
    const total = abStats.converge.hits + abStats.converge.misses;
    return total === 0 ? 100 : Math.round((abStats.converge.hits / total) * 100);
  }, [abStats.converge.hits, abStats.converge.misses]);
  const expandAcc = useMemo(() => {
    const total = abStats.expand.hits + abStats.expand.misses;
    return total === 0 ? 100 : Math.round((abStats.expand.hits / total) * 100);
  }, [abStats.expand.hits, abStats.expand.misses]);

  const hasAbComparison =
    abStats.converge.latencies.length >= 2 && abStats.expand.latencies.length >= 2;

  const clearTimers = useCallback(() => {
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    if (sweepTimerRef.current) window.clearTimeout(sweepTimerRef.current);
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    if (keyPulseTimerRef.current) window.clearTimeout(keyPulseTimerRef.current);
    errorTimerRef.current = null;
    sweepTimerRef.current = null;
    burstTimerRef.current = null;
    keyPulseTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const resetMetricsAndWalk = useCallback(() => {
    clearTimers();
    setActiveIdx(0);
    setTypedCode('');
    setCompletedUids(new Set());
    setRoundDone(false);
    setHintRevealed(false);
    setErrorFlash(false);
    setMissInfo(null);
    setWrongStruckKey(null);
    setLastCorrectKey(null);
    setStageAnim(null);
    setHitBurst(null);
    setHitsCount(0);
    setMissesCount(0);
    setCombo(0);
    setBestCombo(0);
    setLatenciesMs([]);
    setWeakItemsMap({});
    setReplayNonce((n) => n + 1);
    itemStartMsRef.current = performance.now();
  }, [clearTimers]);

  const buildPreviousCarrierLookup = useCallback((items: TopologyDrillItem[]) => {
    const map: Record<string, string> = {};
    for (const it of items) {
      if (it.carrier?.char) map[it.uid] = it.carrier.char;
    }
    return map;
  }, []);

  const launchSingleKey = useCallback(
    (nextKey: string, order: 'sequential' | 'key_shuffle' = 'sequential') => {
      const k = nextKey.toLowerCase();
      if (!TWENTY_KEY_MORPH_BY_KEY.has(k)) return;
      synth.playClick();
      setFocusKey(k);
      setDrillOrder(order);
      setWeakDrillLabel(null);
      setCustomStreamLabel(null);
      setDeck((prev) =>
        buildSingleKeyTopologyDeck(
          k,
          order === 'key_shuffle',
          scriptMode,
          buildPreviousCarrierLookup(prev)
        )
      );
      setPickerOpen(false);
      setCustomModalOpen(false);
      setChromeCalm(false);
      resetMetricsAndWalk();
    },
    [buildPreviousCarrierLookup, resetMetricsAndWalk, scriptMode]
  );

  const launchGroupPreset = useCallback(
    (presetId: TopologyGroupPresetId, asCrossJump = false) => {
      synth.playClick();
      setGroupPresetId(presetId);
      setDrillOrder(asCrossJump ? 'cross_key_jump' : 'group_drill');
      setWeakDrillLabel(null);
      setCustomStreamLabel(null);
      setDeck((prev) =>
        buildGroupTopologyDeck(presetId, scriptMode, buildPreviousCarrierLookup(prev))
      );
      setPickerOpen(false);
      setCustomModalOpen(false);
      setChromeCalm(false);
      resetMetricsAndWalk();
    },
    [buildPreviousCarrierLookup, resetMetricsAndWalk, scriptMode]
  );

  const launchCustomStream = useCallback(
    (rawText: string, label?: string) => {
      const { items, unmatchedChars } = buildCustomTextTopologyDeck(rawText, scriptMode);
      if (items.length === 0) {
        setCustomNotice('未识别到可演练的灵明字根或拆解汉字，请尝试输入如「木日月山水」或「明月松间照」。');
        return;
      }
      synth.playClick();
      setCustomNotice(
        unmatchedChars.length > 0
          ? `已提取 ${items.length} 枚字根（跳过未收录字符：${unmatchedChars.slice(0, 6).join('')}）`
          : null
      );
      setDrillOrder('custom_stream');
      setWeakDrillLabel(null);
      setCustomStreamLabel(
        label || `自输字根流 (${items.length} 根)`
      );
      setDeck(items);
      setCustomModalOpen(false);
      setPickerOpen(false);
      setChromeCalm(false);
      resetMetricsAndWalk();
    },
    [resetMetricsAndWalk, scriptMode]
  );

  const launchWeakDrill = useCallback(() => {
    if (weakItemsList.length === 0) return;
    synth.playClick();
    const copy = [...weakItemsList];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setWeakDrillLabel(`生疏特训 (${copy.length} 根)`);
    setDeck(copy);
    setChromeCalm(false);
    resetMetricsAndWalk();
  }, [resetMetricsAndWalk, weakItemsList]);

  const selectOrderMode = useCallback(
    (nextOrder: 'sequential' | 'key_shuffle' | 'cross_key_jump') => {
      if (nextOrder === 'cross_key_jump') {
        launchGroupPreset('all_20_core', true);
      } else {
        launchSingleKey(activeKey, nextOrder);
      }
    },
    [activeKey, launchGroupPreset, launchSingleKey]
  );

  const handleReshuffleOrReroll = useCallback(() => {
    synth.playClick();
    if (weakDrillLabel || drillOrder === 'custom_stream') {
      const copy = [...deck];
      if (weakDrillLabel) {
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
      }
      setDeck(copy);
      resetMetricsAndWalk();
      return;
    }

    if (drillOrder === 'cross_key_jump' || drillOrder === 'group_drill') {
      setDeck((prev) =>
        buildGroupTopologyDeck(groupPresetId, scriptMode, buildPreviousCarrierLookup(prev))
      );
      resetMetricsAndWalk();
      return;
    }

    setDeck((prev) =>
      buildSingleKeyTopologyDeck(
        focusKey,
        drillOrder === 'key_shuffle',
        scriptMode,
        buildPreviousCarrierLookup(prev)
      )
    );
    resetMetricsAndWalk();
  }, [
    buildPreviousCarrierLookup,
    deck,
    drillOrder,
    focusKey,
    groupPresetId,
    resetMetricsAndWalk,
    scriptMode,
    weakDrillLabel,
  ]);

  const handleRerollActiveCarrier = useCallback(() => {
    if (!activeItem) return;
    synth.playClick();
    setDeck((prev) =>
      prev.map((it, i) => (i === activeIdx ? rerollSingleItemCarrier(it, scriptMode) : it))
    );
  }, [activeIdx, activeItem, scriptMode]);

  const jumpToItem = useCallback(
    (nextIdx: number) => {
      if (nextIdx < 0 || nextIdx >= deck.length) return;
      clearTimers();
      synth.playClick();
      setActiveIdx(nextIdx);
      setTypedCode('');
      setHintRevealed(false);
      setErrorFlash(false);
      setMissInfo(null);
      setWrongStruckKey(null);
      setLastCorrectKey(null);
      setStageAnim(null);
      setRoundDone(false);
      setReplayNonce((n) => n + 1);
      itemStartMsRef.current = performance.now();
    },
    [clearTimers, deck.length]
  );

  // Reset per-item reaction timer whenever activeIdx changes
  useEffect(() => {
    itemStartMsRef.current = performance.now();
  }, [activeIdx, deck]);

  // Living 60fps Real-Time Red Calligraphic Feedback Engine:
  //   - Before 主键: crisp waiting radical (black sumi ink)
  //   - 主键 correct (`da_ignite`): outer strokes recede & blazing VERMILION RED topological focal shape ignites immediately
  //   - 声码 correct (`sheng_spread`): VERMILION RED rapidly spreads halfway outward from the focal shape
  //   - 韵码 correct (`full_spread`): VERMILION RED surges rapidly to 100% across the ENTIRE radical!
  useEffect(() => {
    if (visualMode === 'hanzi_xray') return;
    const canvas = canvasRef.current;
    const renderItem = stageAnim?.item ?? activeItem;
    if (!canvas || !renderItem) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 440;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const conv = renderItem.convergence;
    const cornerArmSampled = conv.cornerArms.map((s) => sampleCatmullRom(s.points, 36));
    const inkRgb = isWash ? '24, 24, 22' : '242, 236, 226';
    const vermilionRgb = isWash ? '184, 42, 34' : '240, 92, 72';
    const amberRgb = isWash ? '214, 96, 44' : '248, 146, 86';
    const ghostAlpha = isWash ? 0.145 : 0.165;

    const dir: TopologyMorphDirection = morphDirection;
    const isHoldingIdle =
      !stageAnim &&
      !hintRevealed &&
      !roundDone &&
      (visualMode === 'flash_reflex' || triggerStyle === 'key_strike');

    // Auto-play pace timings (only used in `pace_flow` or when `Tab` hint is triggered without stageAnim)
    const totalAutoMs = Math.max(240, Math.min(1800, Math.round(effectivePaceMs * 0.92)));
    const leadInMs = Math.round(totalAutoMs * 0.14);
    const morphDurMs = Math.max(150, Math.round(totalAutoMs * 0.72));
    const settleDurMs = Math.max(80, Math.round(totalAutoMs * 0.14));
    const morphEnd = leadInMs + morphDurMs;
    const settleEnd = morphEnd + settleDurMs;

    const startTime = performance.now();
    let rafId = 0;

    const drawSeal = (alphaScale = 1) => {
      ctx.save();
      const sx = size - 40;
      const sy = size - 52;
      ctx.strokeStyle = `rgba(${vermilionRgb}, ${0.56 * alphaScale})`;
      ctx.lineWidth = 1.25;
      ctx.strokeRect(sx, sy, 20, 32);
      ctx.fillStyle = `rgba(${vermilionRgb}, ${0.8 * alphaScale})`;
      ctx.font = '700 11px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(renderItem.spec.sealText[0], sx + 10, sy + 9);
      ctx.fillText(renderItem.spec.sealText[1], sx + 10, sy + 23);
      ctx.restore();
    };

    const drawWatermark = (opacity = 0.03) => {
      ctx.save();
      ctx.fillStyle = isWash
        ? `rgba(20, 20, 18, ${opacity})`
        : `rgba(244, 239, 230, ${opacity})`;
      ctx.font = '700 278px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(renderItem.radical, size * 0.5, size * 0.53);
      ctx.restore();
    };

    const draw = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, size, size);
      drawMiZiPaper(ctx, size, isWash);

      // === REAL-TIME FINGER-STRIKE STAGE ANIMATIONS (ALL VERMILION RED) ===
      if (stageAnim) {
        drawWatermark(0.028);
        const dur = Math.max(1, stageAnim.durationMs);
        const rawT = Math.max(0, Math.min(1, elapsed / dur));

        if (stageAnim.kind === 'da_ignite') {
          // BEAT 1 (主键正确): Red topological focal shape EXPANDS OUTWARD from its center point (cornerVertex)!
          const bloomT = 1 - Math.pow(1 - rawT, 2.2);
          const pad = size * 0.09;
          const inner = size - pad * 2;
          const vx = pad + conv.cornerVertex.x * inner;
          const vy = pad + conv.cornerVertex.y * inner;

          // Compute exact max radial extent of this key's topological focal mark from (vx, vy)
          let maxFocalDist = 48;
          const considerPt = (nx: number, ny: number) => {
            const d = Math.hypot(pad + nx * inner - vx, pad + ny * inner - vy);
            if (d > maxFocalDist) maxFocalDist = d;
          };
          for (const arm of cornerArmSampled) {
            for (const pt of arm) considerPt(pt.x, pt.y);
          }
          if (conv.virtualLinks) {
            for (const lnk of conv.virtualLinks) {
              considerPt(lnk.from.x, lnk.from.y);
              considerPt(lnk.to.x, lnk.to.y);
            }
          }
          if (conv.negativeBox) {
            const { x, y, w, h } = conv.negativeBox;
            considerPt(x, y);
            considerPt(x + w, y);
            considerPt(x, y + h);
            considerPt(x + w, y + h);
          }
          if (conv.accentBeads) {
            for (const b of conv.accentBeads) considerPt(b.x, b.y);
          }
          if (conv.embraceArc) {
            considerPt(conv.embraceArc.start.x, conv.embraceArc.start.y);
            considerPt(conv.embraceArc.ctrl.x, conv.embraceArc.ctrl.y);
            considerPt(conv.embraceArc.end.x, conv.embraceArc.end.y);
          }
          if (conv.flickTip) {
            considerPt(conv.flickTip.from.x, conv.flickTip.from.y);
            considerPt(conv.flickTip.to.x, conv.flickTip.to.y);
          }
          if (conv.resistanceCue) {
            considerPt(conv.resistanceCue.thrustFrom.x, conv.resistanceCue.thrustFrom.y);
            considerPt(conv.resistanceCue.thrustTo.x, conv.resistanceCue.thrustTo.y);
            considerPt(conv.resistanceCue.deflectTo.x, conv.resistanceCue.deflectTo.y);
            if (conv.resistanceCue.referenceStrokes) {
              for (const rs of conv.resistanceCue.referenceStrokes) {
                for (const pt of rs.points) considerPt(pt.x, pt.y);
              }
            }
          }
          const maxFocalR = maxFocalDist + 24;

          // Softly settle outer ink strokes to quiet ghost without any competing inward streams
          const bgGhost = ghostAlpha + (0.86 - ghostAlpha) * Math.pow(1 - rawT, 2.0);
          conv.sampledStrokes.forEach((st) => {
            drawExpandingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              0,
              isWash,
              bgGhost,
              true
            );
          });

          const lockT = rawT < 1 ? 0.35 + bloomT * 0.65 : 1.05 + (elapsed - dur) / 1000;

          if (rawT < 1) {
            const clipR = 4 + bloomT * maxFocalR;
            const scaleBloom = 0.88 + 0.12 * bloomT;

            // Radially reveal & expand the vermilion topological focal shape outward from (vx, vy)
            ctx.save();
            ctx.beginPath();
            ctx.arc(vx, vy, clipR, 0, Math.PI * 2);
            ctx.clip();
            ctx.translate(vx, vy);
            ctx.scale(scaleBloom, scaleBloom);
            ctx.translate(-vx, -vy);
            drawCrystallizedCornerMark(
              ctx,
              conv,
              cornerArmSampled,
              size,
              vermilionRgb,
              amberRgb,
              lockT,
              isWash
            );
            ctx.restore();

            // Crisp expanding red wavefront ring radiating from center point (vx, vy)
            ctx.save();
            const ringAlpha = (1 - bloomT) * 0.72;
            ctx.strokeStyle = `rgba(${vermilionRgb}, ${ringAlpha})`;
            ctx.lineWidth = 2.4 * (1 - bloomT * 0.45);
            ctx.beginPath();
            ctx.arc(vx, vy, clipR, 0, Math.PI * 2);
            ctx.stroke();

            // Inner glowing red spark at exact center point (vx, vy)
            const sparkAlpha = Math.max(0, 1 - rawT * 1.25);
            if (sparkAlpha > 0.02) {
              const sparkR = 14 + bloomT * 10;
              const spark = ctx.createRadialGradient(vx, vy, 1, vx, vy, sparkR);
              spark.addColorStop(0, `rgba(${vermilionRgb}, ${0.95 * sparkAlpha})`);
              spark.addColorStop(0.5, `rgba(${amberRgb}, ${0.55 * sparkAlpha})`);
              spark.addColorStop(1, `rgba(${vermilionRgb}, 0)`);
              ctx.fillStyle = spark;
              ctx.beginPath();
              ctx.arc(vx, vy, sparkR, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          } else {
            drawCrystallizedCornerMark(
              ctx,
              conv,
              cornerArmSampled,
              size,
              vermilionRgb,
              amberRgb,
              lockT,
              isWash
            );
          }

          drawSeal(1);
          if (elapsed < dur + 220) {
            rafId = window.requestAnimationFrame(draw);
          }
          return;
        }

        if (stageAnim.kind === 'single_converge') {
          // Single-key converge mode: outer strokes swiftly converge inward to vermilion focal shape
          const convP = 1 - Math.pow(1 - rawT, 2.0);
          conv.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              convP,
              isWash,
              false,
              ghostAlpha
            );
          });
          if (rawT < 0.96) {
            drawInwardPillarLightStreams(
              ctx,
              conv,
              size,
              vermilionRgb,
              amberRgb,
              convP,
              isWash
            );
          }
          const lockT = rawT < 1 ? rawT * 0.92 : 1.05 + (elapsed - dur) / 1000;
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            lockT,
            isWash
          );
          drawSeal(1);
          if (elapsed < dur + 240) {
            rafId = window.requestAnimationFrame(draw);
          }
          return;
        }

        // BEAT 2 (声码正确 -> 红半扩 0→0.54) & BEAT 3 (韵码正确 -> 红全扩 0.54/0→1.0)
        const easedT = 1 - Math.pow(1 - rawT, 1.8);
        const expandP = stageAnim.fromP + (stageAnim.toP - stageAnim.fromP) * easedT;
        const isAnimatingSpread = rawT < 1;

        conv.sampledStrokes.forEach((st) => {
          drawExpandingPillarStroke(
            ctx,
            st.points,
            size,
            inkRgb,
            vermilionRgb,
            amberRgb,
            expandP,
            isWash,
            ghostAlpha,
            true // settleToCore = true -> rich vermilion red diffusion across the entire radical!
          );
        });

        if (isAnimatingSpread) {
          drawOutwardPillarLightStreams(
            ctx,
            conv,
            size,
            vermilionRgb,
            amberRgb,
            expandP,
            isWash
          );
        }

        // Keep the vermilion red topological focal heart visibly anchored inside the spreading red strokes
        const cueFade =
          stageAnim.kind === 'full_spread' ? Math.max(0, 1 - expandP * 1.45) : 1;
        ctx.save();
        ctx.globalAlpha = stageAnim.kind === 'full_spread' ? Math.max(0.45, 0.92 - expandP * 0.35) : 0.95;
        drawCrystallizedCornerMark(
          ctx,
          conv,
          cornerArmSampled,
          size,
          vermilionRgb,
          amberRgb,
          isAnimatingSpread ? 0.5 : 1.05,
          isWash,
          !isAnimatingSpread,
          cueFade
        );
        ctx.restore();

        drawSeal(1);
        if (isAnimatingSpread || (stageAnim.isCompleteSweep && elapsed < dur + stageAnim.holdMs)) {
          rafId = window.requestAnimationFrame(draw);
        }
        return;
      }

      // === IDLE WAITING FRAME BEFORE 主键 IS STRUCK ===
      if (isHoldingIdle) {
        if (dir === 'expand' && visualMode === 'converge_guide' && keyScope === 'da') {
          // Single-key expand mode: focal shape ready to burst on single 主键
          drawWatermark(0.025);
          conv.sampledStrokes.forEach((st) => {
            drawExpandingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              0,
              isWash,
              ghostAlpha,
              true
            );
          });
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            0.9,
            isWash
          );
          drawSeal(0.85);
        } else {
          // Full-code mode (and converge / blind modes): show crisp sumi-ink radical waiting for 主键!
          // Pressing 主键 accurately will immediately ignite the vermilion red topological common shape.
          conv.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              0,
              isWash,
              false
            );
          });
        }
        return; // static crisp waiting frame
      }

      // === AUTO-PREVIEW / TAB-HINT MORPH AT USER'S LIVE TYPING PACE ===
      drawWatermark(0.03);

      if (dir === 'converge') {
        if (elapsed < leadInMs) {
          conv.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              0,
              isWash,
              false
            );
          });
        } else if (elapsed < morphEnd) {
          const rawT = (elapsed - leadInMs) / Math.max(1, morphDurMs);
          const convP = Math.max(0, Math.min(1, Math.pow(rawT, 1.12)));

          conv.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              convP,
              isWash,
              false
            );
          });
          drawInwardPillarLightStreams(ctx, conv, size, vermilionRgb, amberRgb, convP, isWash);
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            convP - 1,
            isWash
          );
        } else if (elapsed < settleEnd) {
          const lt = (elapsed - morphEnd) / Math.max(1, settleDurMs);
          conv.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              1,
              isWash,
              false
            );
          });
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            lt,
            isWash
          );
        } else {
          const holdSec = (elapsed - settleEnd) / 1000;
          conv.sampledStrokes.forEach((st) => {
            drawDecayingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              1,
              isWash,
              false
            );
          });
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            1.05 + holdSec,
            isWash
          );
        }
      } else {
        // Outward red diffusion preview
        if (elapsed < leadInMs) {
          conv.sampledStrokes.forEach((st) => {
            drawExpandingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              0,
              isWash,
              ghostAlpha,
              true
            );
          });
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            0.85,
            isWash
          );
        } else if (elapsed < morphEnd) {
          const rawT = (elapsed - leadInMs) / Math.max(1, morphDurMs);
          const expandP = Math.max(0, Math.min(1, 1 - Math.pow(1 - rawT, 1.45)));

          conv.sampledStrokes.forEach((st) => {
            drawExpandingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              expandP,
              isWash,
              ghostAlpha,
              true
            );
          });
          drawOutwardPillarLightStreams(ctx, conv, size, vermilionRgb, amberRgb, expandP, isWash);
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            Math.max(-0.4, 0.78 - expandP * 0.6),
            isWash
          );
        } else {
          conv.sampledStrokes.forEach((st) => {
            drawExpandingPillarStroke(
              ctx,
              st.points,
              size,
              inkRgb,
              vermilionRgb,
              amberRgb,
              1,
              isWash,
              ghostAlpha,
              true
            );
          });
          ctx.save();
          ctx.globalAlpha = 0.55;
          drawCrystallizedCornerMark(
            ctx,
            conv,
            cornerArmSampled,
            size,
            vermilionRgb,
            amberRgb,
            0.4,
            isWash,
            true
          );
          ctx.restore();
        }
      }

      drawSeal(1);
      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    activeItem,
    effectivePaceMs,
    hintRevealed,
    isWash,
    keyScope,
    morphDirection,
    replayNonce,
    roundDone,
    stageAnim,
    triggerStyle,
    visualMode,
  ]);

  // Zero-Latency Keyboard Loop: NEVER drops fast keystrokes even while a speed-synced sweep plays!
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.tagName === 'SELECT' ||
          targetEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (customModalOpen) {
          setCustomModalOpen(false);
        } else if (pickerOpen) {
          setPickerOpen(false);
        } else if (typedCode.length > 0 || missInfo) {
          setTypedCode('');
          setMissInfo(null);
          setErrorFlash(false);
          setWrongStruckKey(null);
          setStageAnim(null);
        } else {
          onBackToTheater(activeKey);
        }
        return;
      }

      if (pickerOpen || customModalOpen) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        if (!roundDone && activeItem) {
          synth.playClick();
          setStageAnim(null);
          setHintRevealed(true);
          setReplayNonce((n) => n + 1);
        }
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        setMissInfo(null);
        setErrorFlash(false);
        setWrongStruckKey(null);
        if (typedCode.length > 0 && activeItem) {
          const next = typedCode.slice(0, -1);
          setTypedCode(next);
          if (next.length === 0) {
            setStageAnim(null);
          } else if (next.length === 1) {
            setStageAnim({
              id: Date.now(),
              item: activeItem,
              kind: 'da_ignite',
              fromP: 0,
              toP: 0,
              durationMs: 1,
              holdMs: 0,
              isCompleteSweep: false,
            });
          }
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (deck.length > 0) {
          jumpToItem((activeIdx + 1) % deck.length);
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jumpToItem(Math.max(0, activeIdx - 1));
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        launchSingleKey(
          getNextMorphKey(activeKey, -1),
          drillOrder === 'key_shuffle' ? 'key_shuffle' : 'sequential'
        );
        return;
      }

      if (e.key === ']') {
        e.preventDefault();
        launchSingleKey(
          getNextMorphKey(activeKey, 1),
          drillOrder === 'key_shuffle' ? 'key_shuffle' : 'sequential'
        );
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        synth.playClick();
        setVisualMode('converge_guide');
        setHintRevealed(false);
        setStageAnim(null);
        setReplayNonce((n) => n + 1);
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        synth.playClick();
        setVisualMode('flash_reflex');
        setHintRevealed(false);
        setStageAnim(null);
        setReplayNonce((n) => n + 1);
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        synth.playClick();
        setVisualMode('hanzi_xray');
        setHintRevealed(false);
        setStageAnim(null);
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        selectOrderMode('sequential');
        return;
      }
      if (e.key === '5') {
        e.preventDefault();
        selectOrderMode('key_shuffle');
        return;
      }
      if (e.key === '6') {
        e.preventDefault();
        selectOrderMode('cross_key_jump');
        return;
      }
      if (e.key === '7') {
        e.preventDefault();
        synth.playClick();
        setMorphDirection('converge');
        setStageAnim(null);
        setReplayNonce((n) => n + 1);
        return;
      }
      if (e.key === '8') {
        e.preventDefault();
        synth.playClick();
        setMorphDirection('expand');
        setStageAnim(null);
        setReplayNonce((n) => n + 1);
        return;
      }
      if (e.key === '9') {
        e.preventDefault();
        synth.playClick();
        setTriggerStyle((prev) => (prev === 'key_strike' ? 'pace_flow' : 'key_strike'));
        setStageAnim(null);
        setReplayNonce((n) => n + 1);
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        handleReshuffleOrReroll();
        return;
      }

      if (roundDone && e.key === 'Enter') {
        e.preventDefault();
        if (weakItemsList.length > 0 && !weakDrillLabel) {
          launchWeakDrill();
        } else if (drillOrder === 'sequential' && !weakDrillLabel) {
          launchSingleKey(getNextMorphKey(activeKey, 1), 'sequential');
        } else {
          handleReshuffleOrReroll();
        }
        return;
      }

      if (!/^[a-zA-Z]$/.test(e.key) || !activeItem || roundDone) return;
      e.preventDefault();

      setChromeCalm(true);

      // If the previous radical's completion red-bloom hold is still playing when the user hits the next key,
      // cancel its hold timer immediately so fast typists NEVER lose a keystroke.
      if (stageAnim?.isCompleteSweep) {
        if (sweepTimerRef.current) {
          window.clearTimeout(sweepTimerRef.current);
          sweepTimerRef.current = null;
        }
        setStageAnim(null);
      }

      const ch = e.key.toLowerCase();
      const slotIdx = typedCode.length;
      const expectedChar = targetCode[slotIdx];
      if (!expectedChar) return;

      if (ch === expectedChar) {
        const nextTyped = typedCode + ch;
        const isComplete = nextTyped.length >= targetCode.length;
        const nextCombo = combo + 1;

        setCombo(nextCombo);
        setBestCombo((b) => Math.max(b, nextCombo));
        setHitsCount((h) => h + 1);
        setErrorFlash(false);
        setMissInfo(null);
        setWrongStruckKey(null);
        setLastCorrectKey({ key: ch, tick: Date.now() });
        if (keyPulseTimerRef.current) window.clearTimeout(keyPulseTimerRef.current);
        keyPulseTimerRef.current = window.setTimeout(() => {
          setLastCorrectKey(null);
        }, 280);
        synth.playKeyHit(nextCombo, isComplete);

        if (isComplete) {
          const latency = Math.max(70, Math.round(performance.now() - itemStartMsRef.current));
          setLatenciesMs((prev) => [...prev, latency]);

          const clampedSample = Math.max(180, Math.min(1500, latency));
          const nextPace = Math.max(
            180,
            Math.min(1450, Math.round(livePaceMs * 0.6 + clampedSample * 0.4))
          );
          setLivePaceMs(nextPace);

          const dirSnapshot = morphDirection;
          setAbStats((prev) => ({
            ...prev,
            [dirSnapshot]: {
              hits: prev[dirSnapshot].hits + 1,
              misses: prev[dirSnapshot].misses,
              latencies: [...prev[dirSnapshot].latencies, latency],
            },
          }));

          const weakThresholdMs = targetCode.length > 1 ? 2400 : 1650;
          if (latency > weakThresholdMs) {
            setWeakItemsMap((prev) => ({ ...prev, [activeItem.uid]: activeItem }));
          }

          setHitBurst({
            tick: Date.now(),
            key: activeItem.key,
            code: targetCode,
            radical: activeItem.radical,
            homeKey: activeItem.spec.homeKey.toLowerCase(),
            shapeSymbol: activeItem.convergence.shapeSymbol,
            shapeLabel: activeItem.convergence.shapeLabel,
            latencyMs: latency,
          });
          if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
          burstTimerRef.current = window.setTimeout(() => {
            setHitBurst(null);
          }, 560);

          setCompletedUids((prev) => {
            const next = new Set(prev);
            next.add(activeItem.uid);
            return next;
          });
          setTypedCode('');
          setHintRevealed(false);

          // BEAT 3 (韵码正确 -> 红色迅速扩散至整个字根!)
          // On 3-key 大根, smoothly surge red from 54% -> 100%; on 2-key 小根, surge 0% -> 100% from red focal shape!
          const hitItemSnapshot = activeItem;
          const isSingleConverge = keyScope === 'da' && morphDirection === 'converge';
          const startSpreadP = targetCode.length >= 3 ? 0.54 : 0;
          const spreadDur = Math.max(
            165,
            Math.min(
              paceLockedSlow ? 520 : 270,
              Math.round((paceLockedSlow ? nextPace * 0.72 : nextPace) * 0.34)
            )
          );
          const holdDur = paceLockedSlow ? 260 : 175;

          const isLastItem = activeIdx + 1 >= deck.length;
          if (visualMode !== 'hanzi_xray') {
            if (sweepTimerRef.current) window.clearTimeout(sweepTimerRef.current);
            setStageAnim({
              id: Date.now(),
              item: hitItemSnapshot,
              kind: isSingleConverge ? 'single_converge' : 'full_spread',
              fromP: startSpreadP,
              toP: 1,
              durationMs: spreadDur,
              holdMs: holdDur,
              completedCode: targetCode,
              isCompleteSweep: true,
            });
            sweepTimerRef.current = window.setTimeout(() => {
              setStageAnim(null);
              if (isLastItem) {
                setRoundDone(true);
                setChromeCalm(false);
                synth.playMilestone();
              }
            }, spreadDur + holdDur);
          } else if (isLastItem) {
            setRoundDone(true);
            setChromeCalm(false);
            synth.playMilestone();
          }

          if (!isLastItem) {
            setActiveIdx((i) => i + 1);
            setReplayNonce((n) => n + 1);
          }
        } else {
          // REAL-TIME INTERMEDIATE FEEDBACK:
          // - Slot 0 (主键/大码 correct) -> IMMEDIATELY ignite red topological common shape (`da_ignite`)!
          // - Slot 1 (声码 correct on 3-key 大根) -> IMMEDIATELY spread red halfway outward (`sheng_spread`: 0 -> 0.54)!
          setTypedCode(nextTyped);
          if (visualMode !== 'hanzi_xray') {
            if (nextTyped.length === 1) {
              setStageAnim({
                id: Date.now(),
                item: activeItem,
                kind: 'da_ignite',
                fromP: 0,
                toP: 0,
                durationMs: paceLockedSlow ? 320 : 185,
                holdMs: 0,
                isCompleteSweep: false,
              });
            } else if (nextTyped.length === 2) {
              setStageAnim({
                id: Date.now(),
                item: activeItem,
                kind: 'sheng_spread',
                fromP: 0,
                toP: 0.54,
                durationMs: 160,
                holdMs: 0,
                isCompleteSweep: false,
              });
            }
          }
        }
      } else {
        // Instant miss feedback on wrong 主键 / 声码 / 韵码:
        // Freeze red progression right where it is (no false focal ignition or false spread!)
        const slotLabels = getCodeSlotLabels(targetCode.length, keyScope);
        const failedLabel = slotLabels[slotIdx] ?? '键码';
        setCombo(0);
        setMissesCount((m) => m + 1);
        setErrorFlash(true);
        setWrongStruckKey(ch);
        setMissInfo({
          slotIndex: slotIdx,
          slotLabel: failedLabel,
          expectedChar,
          typedChar: ch,
        });
        setWeakItemsMap((prev) => ({ ...prev, [activeItem.uid]: activeItem }));
        const dirSnapshot = morphDirection;
        setAbStats((prev) => ({
          ...prev,
          [dirSnapshot]: {
            ...prev[dirSnapshot],
            misses: prev[dirSnapshot].misses + 1,
          },
        }));
        synth.playKeyMiss();

        if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = window.setTimeout(() => {
          setErrorFlash(false);
          setWrongStruckKey(null);
        }, 480);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeIdx,
    activeItem,
    activeKey,
    combo,
    customModalOpen,
    deck.length,
    drillOrder,
    handleReshuffleOrReroll,
    jumpToItem,
    keyScope,
    launchSingleKey,
    launchWeakDrill,
    livePaceMs,
    missInfo,
    morphDirection,
    onBackToTheater,
    paceLockedSlow,
    pickerOpen,
    roundDone,
    selectOrderMode,
    stageAnim,
    targetCode,
    triggerStyle,
    typedCode,
    visualMode,
    weakDrillLabel,
    weakItemsList.length,
  ]);

  const progressRatio = deck.length > 0 ? Math.min(1, completedUids.size / deck.length) : 0;
  const activeJade = isWash ? '#0D7A67' : '#43E8B0';
  const activeVermilion = isWash ? '#B02E24' : '#EC624A';
  const nextKey = getNextMorphKey(activeKey, 1);
  const nextSpec = TWENTY_KEY_MORPH_BY_KEY.get(nextKey);

  const currentPresetLabel = useMemo(() => {
    if (weakDrillLabel) return weakDrillLabel;
    if (customStreamLabel) return customStreamLabel;
    if (drillOrder === 'cross_key_jump' || drillOrder === 'group_drill') {
      const p = TOPOLOGY_GROUP_PRESETS.find((x) => x.id === groupPresetId);
      return p?.label ?? '全 20 键跨跳';
    }
    return `${activeSpec.key.toUpperCase()} · ${activeSpec.techniqueName}`;
  }, [
    activeSpec.key,
    activeSpec.techniqueName,
    customStreamLabel,
    drillOrder,
    groupPresetId,
    weakDrillLabel,
  ]);

  // Live speed in radicals per minute for intuitive writing rhythm readout
  const liveRpm = Math.max(20, Math.min(360, Math.round(60000 / Math.max(180, effectivePaceMs))));

  const showCueLine =
    !roundDone &&
    activeItem &&
    (visualMode === 'converge_guide' || hintRevealed || Boolean(stageAnim));

  const carrier = activeItem?.carrier ?? null;
  const hasVectorCarrier = Boolean(carrier?.strokes && carrier.strokes.length > 0);
  const carrierHighlightSet = useMemo(
    () => new Set<number>(carrier?.highlightIndices ?? []),
    [carrier?.highlightIndices]
  );

  // Writing-flow look-ahead window: 3 previous + current + 4 upcoming radicals
  const ribbonWindow = useMemo(() => {
    const start = Math.max(0, activeIdx - 3);
    const end = Math.min(deck.length, activeIdx + 5);
    return deck.slice(start, end).map((it, offset) => ({
      item: it,
      idx: start + offset,
    }));
  }, [activeIdx, deck]);

  return (
    <div
      onMouseMove={() => {
        if (chromeCalm) setChromeCalm(false);
      }}
      className="relative z-10 w-full h-full flex flex-col overflow-hidden select-none wash-enter"
      style={{
        background: isWash
          ? 'radial-gradient(circle at 50% 46%, #F7F5EE 0%, #F1EFE7 58%, #EBE8DF 100%)'
          : 'radial-gradient(circle at 50% 46%, #111622 0%, #0A0E16 62%, #070A10 100%)',
      }}
    >
      {/* Auto-Hiding Distraction-Free Header */}
      <header
        className={`relative z-30 shrink-0 h-14 px-3 sm:px-5 flex items-center justify-between gap-2 transition-opacity duration-500 ${
          chromeCalm && !pickerOpen && !customModalOpen
            ? 'opacity-0 hover:opacity-95 focus-within:opacity-95'
            : 'opacity-95'
        }`}
      >
        {/* Left: Back to Theater & Scope Picker + Custom Radical Input */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBackToTheater(activeKey);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface)]/85 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>剧场</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setPickerOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[var(--dojo-text-bright)] bg-[var(--dojo-surface)]/85 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs"
          >
            <Target className="w-3.5 h-3.5 text-[var(--dojo-crimson-text)] shrink-0" />
            <span className="font-display max-w-[130px] truncate">{currentPresetLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--dojo-text-muted)] shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setCustomNotice(null);
              setCustomModalOpen(true);
            }}
            title="输入任意字根串或中文写作句段，按你的速度对照收敛与扩张"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs ${
              drillOrder === 'custom_stream'
                ? 'border-[var(--dojo-pine)] bg-[var(--dojo-pine-wash)] text-[var(--dojo-pine-text)]'
                : 'border-[var(--dojo-border)] bg-[var(--dojo-surface)]/85 hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)]'
            }`}
          >
            <PenLine className="w-3.5 h-3.5 text-[var(--dojo-crimson)] shrink-0" />
            <span>自输字根</span>
          </button>
        </div>

        {/* Center: Primary A/B Cognition Direction Toggle (收敛 vs 扩张) + Visual Mode + Order */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
          {/* Core Experiment Switch: 字根→共形 (Converge) vs 共形→字根 (Expand) */}
          <div
            role="group"
            aria-label="切换思维方向：收敛或扩张"
            className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)]/90 border border-[var(--dojo-crimson)]/35 backdrop-blur-xs shrink-0"
          >
            <button
              type="button"
              title="收敛：字根 → 拓扑共形（先见全形，随速度向焦形敛锋 · 快捷键 7）"
              onClick={() => {
                synth.playClick();
                setMorphDirection('converge');
                setStageAnim(null);
                setReplayNonce((n) => n + 1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                morphDirection === 'converge'
                  ? 'bg-[var(--dojo-crimson)] text-white shadow-xs'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5 shrink-0" />
              <span>收敛 · 字根→共形</span>
            </button>
            <button
              type="button"
              title="扩张：拓扑共形 → 字根（先定焦形，随速度向外生发全字根 · 快捷键 8）"
              onClick={() => {
                synth.playClick();
                setMorphDirection('expand');
                setStageAnim(null);
                setReplayNonce((n) => n + 1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                morphDirection === 'expand'
                  ? 'bg-[var(--dojo-pine)] text-white shadow-xs'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span>扩张 · 共形→字根</span>
            </button>
          </div>

          <div
            role="group"
            aria-label="切换肌肉记忆视觉模式"
            className="hidden lg:inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)]/85 border border-[var(--dojo-border)] backdrop-blur-xs shrink-0"
          >
            {VISUAL_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.tip}
                onClick={() => {
                  synth.playClick();
                  setVisualMode(opt.id);
                  setHintRevealed(false);
                  setStageAnim(null);
                  setReplayNonce((n) => n + 1);
                }}
                className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  visualMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {opt.id === 'hanzi_xray' && <ScanSearch className="w-3.5 h-3.5 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="切换训练范围与出题顺序"
            className="hidden xl:inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)]/85 border border-[var(--dojo-border)] backdrop-blur-xs shrink-0"
          >
            {ORDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.tip}
                onClick={() => selectOrderMode(opt.id)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  drillOrder === opt.id && !weakDrillLabel
                    ? opt.id === 'cross_key_jump'
                      ? 'bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] shadow-xs font-semibold'
                      : 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] shadow-xs font-semibold'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Trigger Timing, Key Scope, Tactile Deck, Theme & Sound */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setTriggerStyle((prev) => (prev === 'key_strike' ? 'pace_flow' : 'key_strike'));
              setStageAnim(null);
              setReplayNonce((n) => n + 1);
            }}
            title={
              triggerStyle === 'key_strike'
                ? '当前：击键触发（主键点亮红共形，声韵正确红扩散全字根 · 快捷键 9）'
                : '当前：出现随速自演（字根出现即按你的实时速度自动演进 · 快捷键 9）'
            }
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)]/85 hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs"
          >
            <Gauge className="w-3.5 h-3.5 text-[var(--dojo-crimson)] shrink-0" />
            <span>{triggerStyle === 'key_strike' ? '击键触发' : '随速自演'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setKeyScope((prev) => (prev === 'full' ? 'da' : 'full'));
              setTypedCode('');
              setMissInfo(null);
              setErrorFlash(false);
              setWrongStruckKey(null);
              setStageAnim(null);
            }}
            title="切换完整灵明码校验（主键显红共形，声码韵码正确红色扩散全字根）或单键大码（1 键）"
            className={`hidden sm:inline-flex items-center px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs ${
              keyScope === 'full'
                ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)]/45 text-[var(--dojo-crimson-text)]'
                : 'bg-[var(--dojo-surface)]/85 border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
            }`}
          >
            {keyScope === 'full' ? '全码 · 声韵' : '单键大码'}
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setShowTactileDeck((v) => !v);
            }}
            title="开关底部指法反射键位带"
            className={`hidden 2xl:inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs ${
              showTactileDeck
                ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                : 'bg-[var(--dojo-surface)]/85 border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>指法带</span>
          </button>

          <div className="hidden 2xl:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)]/85 border border-[var(--dojo-border)] rounded-lg backdrop-blur-xs">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeThemeMode(opt.id)}
                className={`px-1.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  themeMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {opt.short}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? '开启音效' : '静音'}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--dojo-surface)]/85 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] cursor-pointer backdrop-blur-xs shrink-0"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Custom Radical / Writing Sentence Input Modal */}
      {customModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
          onClick={() => setCustomModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)] shadow-2xl p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                  自输字根 / 写作句段 · 随速思维对照
                </h2>
                <p className="text-xs text-[var(--dojo-text-sub)] mt-0.5">
                  直接输入任意字根（如「木日月山水」）、中文句子（自动拆为字根流）或辅音键位，按你的打字节拍体验「收敛」与「扩张」
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                aria-label="关闭自输字根弹窗"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label
                htmlFor="custom-radical-stream-input"
                className="block text-xs font-semibold text-[var(--dojo-text-sub)] mb-1.5"
              >
                输入要练习的字根串或写作短句
              </label>
              <textarea
                id="custom-radical-stream-input"
                rows={3}
                value={customDraft}
                onChange={(e) => {
                  setCustomDraft(e.target.value);
                  setCustomNotice(null);
                }}
                placeholder="例如：木日月山水火口人女心  或  明月松间照清泉石上流"
                className="w-full rounded-xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface-inset)] px-3.5 py-2.5 text-sm font-display text-[var(--dojo-text-bright)] focus:outline-none focus:border-[var(--dojo-crimson)] resize-none"
              />
              {customNotice && (
                <p className="mt-1.5 text-xs text-[var(--dojo-crimson-text)]">{customNotice}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-[var(--dojo-text-sub)]">
                一键载入写作思维测试预设
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {WRITING_STREAM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setCustomDraft(preset.text);
                      launchCustomStream(preset.text, preset.label.slice(0, 8));
                    }}
                    className="text-left px-3 py-2 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-display font-bold text-[var(--dojo-text-bright)]">
                      {preset.label}
                    </div>
                    <div className="text-[11px] text-[var(--dojo-text-sub)] mt-0.5">
                      {preset.brief}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dojo-border)]">
              <button
                type="button"
                onClick={() => setCustomModalOpen(false)}
                className="px-3.5 py-2 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-xs font-medium text-[var(--dojo-text)] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => launchCustomStream(customDraft)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-xs font-semibold text-white cursor-pointer"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>开始随速对照练习</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating 20-Key & Group Drill Picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl rounded-2xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)] shadow-2xl p-5 flex flex-col gap-4 max-h-[82vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                  选择肌肉记忆范围与视觉模式
                </h2>
                <p className="text-xs text-[var(--dojo-text-sub)] mt-0.5">
                  既可单键循序吃透焦形，也可按手区 / 20 键跨跳 / 自输写作句段对照收敛与扩张
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="关闭选择面板"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compact Mode & Order Controls for narrower viewports */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[var(--dojo-border)] lg:hidden">
              {VISUAL_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setVisualMode(opt.id);
                    setHintRevealed(false);
                    setStageAnim(null);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                    visualMode === opt.id
                      ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                      : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] text-[var(--dojo-text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Group Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TOPOLOGY_GROUP_PRESETS.map((preset) => {
                const isSelected =
                  (drillOrder === 'cross_key_jump' || drillOrder === 'group_drill') &&
                  groupPresetId === preset.id &&
                  !weakDrillLabel;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      launchGroupPreset(preset.id, preset.id === 'all_20_core')
                    }
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)]'
                        : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-bold ${
                          isSelected
                            ? 'text-[var(--dojo-crimson-text)]'
                            : 'text-[var(--dojo-text-bright)]'
                        }`}
                      >
                        {preset.label}
                      </span>
                      <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-sub)]">
                        {preset.keys.length} 键
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--dojo-text-sub)]">
                      {preset.brief}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Single-Key 20 Consonant Selector */}
            <div className="pt-3 border-t border-[var(--dojo-border)]">
              <div className="text-xs font-semibold text-[var(--dojo-text-sub)] mb-2">
                单键深练 · 点击任一键位开始本键拓扑演变练习
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                {TWENTY_KEY_MORPHS.map((spec) => {
                  const isCur =
                    (drillOrder === 'sequential' || drillOrder === 'key_shuffle') &&
                    focusKey === spec.key &&
                    !weakDrillLabel;
                  return (
                    <button
                      key={spec.key}
                      type="button"
                      onClick={() =>
                        launchSingleKey(
                          spec.key,
                          drillOrder === 'key_shuffle' ? 'key_shuffle' : 'sequential'
                        )
                      }
                      className={`px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                        isCur
                          ? 'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)]'
                          : 'border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)]'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-mono-tabular text-sm font-bold uppercase">
                          {spec.key}
                        </span>
                        <span className="font-mono-tabular text-xs opacity-75">
                          {spec.topoSymbol}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium truncate opacity-90">
                        {spec.techniqueName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN FULL-VIEWPORT ZEN STAGE */}
      <main className="relative flex-1 min-h-0 w-full flex flex-col items-center justify-center px-4 overflow-hidden">
        {!roundDone && activeItem ? (
          <div className="relative flex flex-col items-center justify-center w-full max-w-2xl">
            {/* Writing-Flow Look-Ahead Ribbon (simulates continuous writing working memory!) */}
            <div
              aria-label="写作字根流预览"
              className="mb-2 flex items-baseline justify-center gap-3.5 sm:gap-5 h-9"
            >
              {ribbonWindow.map(({ item, idx }) => {
                const isPast = idx < activeIdx;
                const isCurrent = idx === activeIdx;
                const distance = Math.abs(idx - activeIdx);
                return (
                  <button
                    key={item.uid}
                    type="button"
                    onClick={() => jumpToItem(idx)}
                    title={
                      item.sourceChar
                        ? `来自「${item.sourceChar}」的字根「${item.radical}」`
                        : `字根「${item.radical}」`
                    }
                    className={`flex flex-col items-center transition-all duration-150 cursor-pointer ${
                      isCurrent
                        ? 'scale-115'
                        : isPast
                          ? 'opacity-30 hover:opacity-65'
                          : distance === 1
                            ? 'opacity-65 hover:opacity-95'
                            : distance === 2
                              ? 'opacity-42 hover:opacity-80'
                              : 'opacity-25 hover:opacity-65'
                    }`}
                  >
                    <span
                      className={`font-display leading-none ${
                        isCurrent
                          ? morphDirection === 'expand'
                            ? 'text-2xl font-bold text-[var(--dojo-pine-text)]'
                            : 'text-2xl font-bold text-[var(--dojo-crimson-text)]'
                          : 'text-lg font-medium text-[var(--dojo-text)]'
                      }`}
                    >
                      {item.radical}
                    </span>
                    {isCurrent && item.sourceChar && (
                      <span className="mt-0.5 text-[10px] font-mono-tabular text-[var(--dojo-text-muted)] leading-none">
                        字「{item.sourceChar}」
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quiet Context & Live Speed Kicker (zero pills, clean typographic separators) */}
            <div className="mb-2.5 h-5 flex items-center gap-2 text-xs text-[var(--dojo-text-sub)]">
              <span
                className={
                  morphDirection === 'expand'
                    ? 'font-semibold text-[var(--dojo-pine-text)]'
                    : 'font-semibold text-[var(--dojo-crimson-text)]'
                }
              >
                {morphDirection === 'converge' ? '收敛 · 字根→共形' : '扩张 · 共形→字根'}
              </span>
              <span aria-hidden="true">·</span>
              {showCueLine ? (
                <>
                  <span>{activeItem.convergence.shapeLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    {activeItem.spec.homeKey}→{activeItem.spec.key.toUpperCase()}{' '}
                    {activeItem.motor.arrowSymbol}
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setStageAnim(null);
                    setHintRevealed(true);
                    setReplayNonce((n) => n + 1);
                  }}
                  className="inline-flex items-center gap-1 text-[var(--dojo-text-sub)] hover:text-[var(--dojo-crimson-text)] underline underline-offset-4 cursor-pointer"
                >
                  {hintRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>显露焦形 (Tab)</span>
                </button>
              )}
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setPaceLockedSlow((v) => !v);
                }}
                title="点击切换实时随速或慢速细观（1.75× 时长）"
                className="hidden sm:inline font-mono-tabular text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] cursor-pointer"
              >
                {paceLockedSlow ? `慢观 ${effectivePaceMs}ms` : `随速 ${effectivePaceMs}ms (${liveRpm}/分)`}
              </button>
            </div>

            {/* Dominant Focal Anchor: Centered Xuan-Paper Bidirectional Canvas OR X-Ray Hanzi Stage */}
            <div
              className={`relative rounded-2xl overflow-hidden border transition-all duration-150 shadow-md ${
                errorFlash
                  ? 'border-amber-600 ring-2 ring-amber-500/35 -translate-x-1 scale-[0.985]'
                  : stageAnim
                    ? stageAnim.isCompleteSweep
                      ? 'border-[var(--dojo-crimson)] ring-2 ring-[var(--dojo-crimson)]/25 scale-[1.012]'
                      : 'border-[var(--dojo-crimson)]/65 scale-[1.004]'
                    : 'border-[var(--dojo-border-strong)]'
              }`}
              style={{
                width: showTactileDeck
                  ? 'min(72vw, 46vh, 385px)'
                  : 'min(78vw, 56vh, 435px)',
                height: showTactileDeck
                  ? 'min(72vw, 46vh, 385px)'
                  : 'min(78vw, 56vh, 435px)',
                background: isWash ? '#FCFBF6' : '#101521',
              }}
            >
              {visualMode !== 'hanzi_xray' ? (
                <canvas
                  ref={canvasRef}
                  className="w-full h-full block"
                  aria-label="书法拓扑随速收敛与扩张练习画布"
                />
              ) : (
                <div
                  onClick={handleRerollActiveCarrier}
                  title="点击换一个包含同字根的汉字"
                  className="relative w-full h-full flex items-center justify-center cursor-pointer"
                >
                  <svg
                    viewBox="0 0 100 100"
                    className="pointer-events-none absolute inset-0 w-full h-full"
                    aria-hidden="true"
                  >
                    <rect
                      x="7"
                      y="7"
                      width="86"
                      height="86"
                      fill="none"
                      stroke={isWash ? 'rgba(176,46,36,0.18)' : 'rgba(232,92,68,0.18)'}
                      strokeWidth="0.45"
                    />
                    <line
                      x1="50"
                      y1="7"
                      x2="50"
                      y2="93"
                      stroke={isWash ? 'rgba(176,46,36,0.10)' : 'rgba(232,92,68,0.10)'}
                      strokeWidth="0.35"
                      strokeDasharray="2 2.5"
                    />
                    <line
                      x1="7"
                      y1="50"
                      x2="93"
                      y2="50"
                      stroke={isWash ? 'rgba(176,46,36,0.10)' : 'rgba(232,92,68,0.10)'}
                      strokeWidth="0.35"
                      strokeDasharray="2 2.5"
                    />
                  </svg>

                  {hasVectorCarrier && carrier?.strokes ? (
                    <svg
                      viewBox="0 0 1024 1024"
                      className="w-[74%] h-[74%] relative z-10"
                      role="img"
                      aria-label={`实字 ${carrier.char} 中识别字根`}
                    >
                      <g transform="translate(0 900) scale(1 -1)">
                        {carrier.strokes.map((d, idx) => {
                          const isTarget =
                            carrierHighlightSet.size === 0 || carrierHighlightSet.has(idx);
                          if (isTarget) return null;
                          return (
                            <path
                              key={`ctx_${idx}`}
                              d={d}
                              fill={isWash ? '#2A2925' : '#E2DDD3'}
                              fillOpacity={isWash ? 0.22 : 0.24}
                              shapeRendering="geometricPrecision"
                            />
                          );
                        })}
                        {carrier.strokes.map((d, idx) => {
                          const isTarget =
                            carrierHighlightSet.size === 0 || carrierHighlightSet.has(idx);
                          if (!isTarget) return null;
                          return (
                            <path
                              key={`rad_${idx}`}
                              d={d}
                              fill={
                                errorFlash || hintRevealed
                                  ? activeVermilion
                                  : isWash
                                    ? '#151412'
                                    : '#F5EFE6'
                              }
                              fillOpacity={1}
                              shapeRendering="geometricPrecision"
                            />
                          );
                        })}
                      </g>
                    </svg>
                  ) : (
                    <span className="relative z-10 font-display text-[164px] font-bold leading-none text-[var(--dojo-text-bright)]">
                      {carrier?.char || activeItem.radical}
                    </span>
                  )}

                  {hintRevealed && (
                    <div className="absolute right-3 bottom-3 z-20 rounded-xl border border-[var(--dojo-crimson)]/40 bg-[var(--dojo-surface)]/92 p-1 shadow-md">
                      <FocalStampBadge item={activeItem} isWash={isWash} size={76} />
                    </div>
                  )}

                  <span className="absolute left-3.5 bottom-3 text-[11px] text-[var(--dojo-text-muted)]">
                    点击汉字换字
                  </span>
                </div>
              )}

              {/* Tactile Red Hit Ripple Overlay */}
              {hitBurst && (
                <div
                  key={`ripple_${hitBurst.tick}`}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <div
                    className="w-28 h-28 rounded-full border-2 animate-ping"
                    style={{
                      borderColor: activeVermilion,
                      animationIterationCount: 1,
                      animationDuration: '300ms',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Explicit 主键(大码) · 声码 · 韵码 Real-Time Red Feedback Strip */}
            {(() => {
              const slotLabels = getCodeSlotLabels(targetCode.length, keyScope);
              const expectedNextKey = targetCode[typedCode.length] ?? activeItem.key;
              const isCompleteShowing = Boolean(stageAnim?.isCompleteSweep && stageAnim.completedCode);
              return (
                <div className="mt-2.5 min-h-[30px] flex flex-wrap items-center justify-center gap-3">
                  {isCompleteShowing && stageAnim ? (
                    <div
                      className="flex items-center gap-2 text-xs font-mono-tabular font-semibold"
                      style={{ color: activeVermilion }}
                    >
                      <span className="uppercase tracking-widest">
                        {(stageAnim.completedCode ?? '').split('').join(' · ')}
                      </span>
                      <span>✓</span>
                      <span className="font-sans font-medium opacity-90">
                        {stageAnim.kind === 'single_converge'
                          ? `已敛锋归「${stageAnim.item.convergence.shapeSymbol}」`
                          : `已红色扩散成「${stageAnim.item.radical}」`}
                      </span>
                      {hitBurst && (
                        <span className="opacity-75">
                          · {hitBurst.latencyMs} ms{combo >= 3 ? ` · ${combo} 连击` : ''}
                        </span>
                      )}
                    </div>
                  ) : keyScope === 'full' ? (
                    <div className="flex items-center gap-3" aria-label="大码声码韵码校验槽">
                      <div className="flex items-center gap-2">
                        {slotLabels.map((slotLabel, idx) => {
                          const isFilled = idx < typedCode.length;
                          const isCurrent = idx === typedCode.length;
                          const isFailedSlot = missInfo?.slotIndex === idx;
                          const displayChar = isFilled
                            ? typedCode[idx].toUpperCase()
                            : isFailedSlot || hintRevealed
                              ? (targetCode[idx] ?? '').toUpperCase()
                              : '·';
                          return (
                            <div
                              key={`${slotLabel}_${idx}`}
                              className={`flex items-baseline gap-1 px-2 py-0.5 border-b-2 transition-colors duration-150 ${
                                isFilled
                                  ? 'border-[var(--dojo-crimson)] text-[var(--dojo-crimson-text)]'
                                  : isFailedSlot
                                    ? 'border-amber-600 text-amber-700 dark:text-amber-300'
                                    : isCurrent
                                      ? 'border-[var(--dojo-text-bright)]/75 text-[var(--dojo-text-bright)]'
                                      : 'border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                              }`}
                            >
                              <span className="text-[10px] opacity-80">{slotLabel}</span>
                              <span className="font-mono-tabular text-xs font-bold min-w-[12px] text-center uppercase">
                                {displayChar}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {missInfo ? (
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {missInfo.slotLabel}应为{' '}
                          <strong className="font-mono-tabular uppercase text-[var(--dojo-crimson-text)]">
                            {missInfo.expectedChar}
                          </strong>
                          <span className="opacity-75 ml-1 font-mono-tabular uppercase">
                            (误按 {missInfo.typedChar})
                          </span>
                        </span>
                      ) : (
                        <span className="hidden sm:inline text-xs text-[var(--dojo-text-muted)]">
                          {typedCode.length === 0
                            ? '按主键显红共形，续输声韵红扩散全字根'
                            : typedCode.length === 1
                              ? `红共形已显 · 待输${slotLabels[1] ?? '韵码'}`
                              : `已红半扩 · 待输${slotLabels[2] ?? '韵码'}全字根扩散`}
                        </span>
                      )}
                    </div>
                  ) : missInfo || errorFlash ? (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      目标{' '}
                      <strong className="font-mono-tabular text-[var(--dojo-crimson-text)]">
                        {expectedNextKey.toUpperCase()}
                      </strong>
                      （{activeItem.spec.fingerLabel} · {activeItem.spec.homeKey}→
                      {activeItem.spec.key.toUpperCase()} {activeItem.motor.arrowSymbol} ·{' '}
                      {activeItem.convergence.shapeSymbol}）
                    </span>
                  ) : hitBurst ? (
                    <span
                      className="text-xs font-mono-tabular font-semibold"
                      style={{ color: activeVermilion }}
                    >
                      {hitBurst.code.toUpperCase()} {hitBurst.shapeSymbol} · {hitBurst.latencyMs} ms
                      {combo >= 3 ? ` · ${combo} 连击` : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--dojo-text-muted)]">
                      {triggerStyle === 'key_strike'
                        ? morphDirection === 'converge'
                          ? '按主键瞬间由字根收敛成红共形'
                          : '按主键瞬间由红共形扩散全字根'
                        : '直接敲击实体键盘对应大码，动画随你的手速自适应'}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Optional Whisper-Quiet Tactile Finger-Displacement Deck (instant red hit / amber miss / pulsing target) */}
            {showTactileDeck && (
              <div
                aria-label="指法反射键位带"
                className="mt-2.5 w-full max-w-[520px] flex flex-col gap-1 opacity-90"
              >
                {QWERTY_ROWS.map((row, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="flex justify-center gap-1"
                    style={{
                      paddingLeft: rowIdx === 1 ? '1rem' : rowIdx === 2 ? '2.1rem' : '0',
                    }}
                  >
                    {row.map((k) => {
                      const isVowel = VOWELS.has(k);
                      const expectedKey = targetCode[typedCode.length] ?? activeItem.key;
                      const isStepHitKey = lastCorrectKey?.key === k;
                      const isCompleteHitKey = !lastCorrectKey && hitBurst?.key === k;
                      const isHitKey = isStepHitKey || isCompleteHitKey;
                      const isHitHome =
                        !isHitKey &&
                        typedCode.length === 0 &&
                        hitBurst?.homeKey === k &&
                        hitBurst.key !== k;
                      const isWrongKey = wrongStruckKey === k;
                      const isExpectedHint =
                        (hintRevealed || Boolean(missInfo)) && expectedKey === k;
                      const isHintHome =
                        (hintRevealed || Boolean(missInfo)) &&
                        typedCode.length === 0 &&
                        activeItem.spec.homeKey.toLowerCase() === k &&
                        activeItem.key !== k;

                      let cls =
                        'border-[var(--dojo-border)]/75 bg-[var(--dojo-surface)]/65 text-[var(--dojo-text-muted)]';
                      if (isVowel) {
                        cls =
                          keyScope === 'full'
                            ? 'border-[var(--dojo-ochre)]/35 bg-[var(--dojo-surface)]/45 text-[var(--dojo-text-sub)]'
                            : 'border-dashed border-[var(--dojo-border)]/45 bg-transparent text-[var(--dojo-text-muted)]/45';
                      }
                      if (isHitKey) {
                        cls =
                          'border-[var(--dojo-crimson)] bg-[var(--dojo-crimson)] text-white font-bold scale-105 shadow-xs';
                      } else if (isHitHome) {
                        cls =
                          'border-[var(--dojo-crimson)]/55 bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] font-semibold';
                      } else if (isWrongKey) {
                        cls =
                          'border-amber-600 bg-amber-500/25 text-amber-800 dark:text-amber-300 font-bold scale-95';
                      } else if (isExpectedHint) {
                        cls =
                          'border-2 border-[var(--dojo-crimson)] bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] font-bold scale-105';
                      } else if (isHintHome) {
                        cls =
                          'border-[var(--dojo-crimson)]/45 bg-[var(--dojo-crimson-wash)]/60 text-[var(--dojo-crimson-text)] font-semibold';
                      }

                      return (
                        <div
                          key={k}
                          className={`w-9 h-7 sm:w-10 sm:h-7 rounded-md border flex items-center justify-center font-mono-tabular text-[11px] uppercase transition-all duration-100 ${cls}`}
                        >
                          {k}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Calm Round Completion & A/B Writing Cognition Summary Card */
          <div className="relative z-30 w-full max-w-md mx-4 rounded-2xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)]/95 backdrop-blur-md p-6 text-center shadow-2xl flex flex-col items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center border"
              style={{
                backgroundColor: isWash
                  ? 'rgba(13, 122, 103, 0.10)'
                  : 'rgba(67, 232, 176, 0.12)',
                borderColor: activeJade,
              }}
            >
              <Check className="w-6 h-6" style={{ color: activeJade }} />
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-[var(--dojo-text-bright)]">
                {currentPresetLabel} · 本轮练习完成
              </h3>
              <div className="mt-2 flex items-center justify-center gap-2 text-xs font-mono-tabular text-[var(--dojo-text-sub)]">
                <span>
                  {morphDirection === 'converge' ? '收敛模式' : '扩张模式'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{deck.length} 根</span>
                <span aria-hidden="true">·</span>
                <span>准确 {accuracy}%</span>
                <span aria-hidden="true">·</span>
                <span>中位 {medianLatencyMs} ms</span>
              </div>
            </div>

            {/* Real Empirical A/B Comparison between Converge vs Expand */}
            {hasAbComparison && (
              <div className="w-full rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] p-3 text-left">
                <div className="text-[11px] font-semibold text-[var(--dojo-text-sub)] mb-2">
                  写作思维实测对照（收敛 vs 扩张）
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                  <div className="p-2 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                    <div className="text-[11px] text-[var(--dojo-crimson-text)] font-semibold">
                      收敛 · 字根→共形
                    </div>
                    <div className="mt-1 text-sm font-bold text-[var(--dojo-text-bright)]">
                      {convergeMedian} ms · {convergeAcc}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-border)]">
                    <div className="text-[11px] text-[var(--dojo-pine-text)] font-semibold">
                      扩张 · 共形→字根
                    </div>
                    <div className="mt-1 text-sm font-bold text-[var(--dojo-text-bright)]">
                      {expandMedian} ms · {expandAcc}%
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weak / Hesitated Radicals Review List */}
            {weakItemsList.length > 0 && (
              <div className="w-full rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] p-3 text-left">
                <div className="text-[11px] font-semibold text-[var(--dojo-text-sub)] mb-2">
                  本轮生疏 / 迟疑字根（{weakItemsList.length} 枚）
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {weakItemsList.slice(0, 12).map((w) => (
                    <span
                      key={w.uid}
                      className="inline-flex items-baseline gap-1 text-xs font-mono-tabular"
                    >
                      <span className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                        {w.radical}
                      </span>
                      <span className="text-[var(--dojo-crimson-text)] font-bold uppercase">
                        {keyScope === 'full' ? w.ma : w.key}
                      </span>
                      <span className="text-[var(--dojo-text-muted)]">
                        {w.convergence.shapeSymbol}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="w-full flex flex-col gap-2">
              {/* Primary A/B Flip CTA: immediately test the opposite direction on the exact same deck! */}
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setMorphDirection((d) => (d === 'converge' ? 'expand' : 'converge'));
                  resetMetricsAndWalk();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-xl transition-opacity cursor-pointer"
              >
                {morphDirection === 'converge' ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
                <span>
                  {morphDirection === 'converge'
                    ? '用同一组字根切换「扩张：共形→字根」对照体验'
                    : '用同一组字根切换「收敛：字根→共形」对照体验'}
                </span>
              </button>

              {weakItemsList.length > 0 && (
                <button
                  type="button"
                  onClick={launchWeakDrill}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-xl transition-colors cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>专攻本轮生疏字根（{weakItemsList.length} 根）</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {drillOrder === 'sequential' && !weakDrillLabel ? (
                  <button
                    type="button"
                    onClick={() => launchSingleKey(nextKey, 'sequential')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text-bright)] rounded-xl transition-colors cursor-pointer"
                  >
                    <span>下一键 {nextKey.toUpperCase()}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReshuffleOrReroll}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text)] rounded-xl transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>重练本轮</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    onBackToTheater(weakItemsList[0]?.key ?? activeKey);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text)] rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>回剧场细看</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Whisper-Quiet Auto-Hiding Bottom Controls + Live A/B Telemetry + 2px Hairline */}
      <footer className="relative z-30 shrink-0 px-4 sm:px-6 pb-3 pt-1 flex items-center justify-between gap-3 text-[11px] text-[var(--dojo-text-muted)]">
        <div
          className={`flex items-center gap-2 transition-opacity duration-500 ${
            chromeCalm && !pickerOpen && !customModalOpen
              ? 'opacity-0 hover:opacity-95'
              : 'opacity-75 hover:opacity-100'
          }`}
        >
          <button
            type="button"
            disabled={activeIdx <= 0}
            onClick={() => jumpToItem(activeIdx - 1)}
            className="inline-flex items-center gap-0.5 hover:text-[var(--dojo-text-bright)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>上一根</span>
          </button>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <button
            type="button"
            onClick={() => {
              if (deck.length > 0) jumpToItem((activeIdx + 1) % deck.length);
            }}
            className="inline-flex items-center gap-0.5 hover:text-[var(--dojo-text-bright)] cursor-pointer whitespace-nowrap"
          >
            <span>下一根</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span aria-hidden="true" className="hidden md:inline opacity-40">
            ·
          </span>
          <span className="hidden md:inline">
            7 收敛 · 8 扩张 · 9 切触发 · Tab 显焦形 · 0 重洗
          </span>
        </div>

        <div
          className={`flex items-center gap-2.5 font-mono-tabular transition-opacity duration-500 ${
            chromeCalm && !pickerOpen && !customModalOpen
              ? 'opacity-0 hover:opacity-95'
              : 'opacity-75 hover:opacity-100'
          }`}
        >
          {hasAbComparison && (
            <>
              <span className="hidden lg:inline text-[var(--dojo-text-sub)]">
                对照 收敛 {convergeMedian}ms ({convergeAcc}%) / 扩张 {expandMedian}ms ({expandAcc}%)
              </span>
              <span aria-hidden="true" className="hidden lg:inline opacity-40">
                ·
              </span>
            </>
          )}
          {medianLatencyMs > 0 && <span>中位 {medianLatencyMs} ms</span>}
          {hitsCount + missesCount > 0 && (
            <>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span>准确 {accuracy}%</span>
            </>
          )}
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span>
            {Math.min(completedUids.size, deck.length)} / {deck.length}
          </span>
        </div>

        {/* Hairline 2px Ink Progress */}
        <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-[var(--dojo-border)]/35">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${(progressRatio * 100).toFixed(1)}%`,
              backgroundColor: morphDirection === 'expand' ? activeJade : activeVermilion,
            }}
          />
        </div>
      </footer>
    </div>
  );
};
