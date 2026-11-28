import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  RefreshCw,
  RotateCcw,
  Route,
  ScanSearch,
  Shuffle,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { PALACE_PDF_CHAMBERS, PdfStrokeTier } from '../data/palacePdfData';
import { loadPalaceOverrides, PALACE_OVERRIDES_EVENT, PalaceOverridesMap } from '../data/palaceEditor';
import { buildChamberStrokeFlow } from '../data/palaceStrokePaths';
import { getNextPalaceKey } from '../data/palaceStrokes';
import { PALACE_ROW_GROUPS } from '../data/campaign';
import {
  buildCloudWalkSequence,
  buildCrossKeyJumpDeck,
  CloudWalkStep,
  CrossKeyJumpDeck,
  getCarriersForCloudStep,
  PalaceCloudTrainMode,
  PalaceWalkOrder,
  sampleEnhancedCloudCarriers,
  shuffleCloudSteps,
  VariantHanziCarrier,
} from '../data/palaceCloudTraining';
import { SCRIPT_MODE_OPTIONS, ScriptMode } from '../data/scriptFilter';
import { THEME_OPTIONS, ThemeMode } from '../data/theme';
import { uiMnemonic, useUiScript, useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';
import { speech } from '../audio/speech';
import { PalaceStrokeFlowOverlay, PDF_TIER_COLORS } from './StrokeCloudStage';
import {
  computeHighlightedRadicalNormRect,
  resolveCloudStepFocal,
  TopologyFocalSvgOverlay,
} from './TopologyFocalSvgOverlay';

interface PalaceCloudTrainerProps {
  initialKey?: string;
  initialMode?: PalaceCloudTrainMode;
  initialOrder?: PalaceWalkOrder;
  scriptMode: ScriptMode;
  onChangeScriptMode: (next: ScriptMode) => void;
  themeMode: ThemeMode;
  onChangeThemeMode: (next: ThemeMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  speechEnabled: boolean;
  onToggleSpeech: () => void;
  onBack: () => void;
}

type KeyScope = 'full' | 'da';

// Celadon / jade ink tones inspired by the calligraphic cloud reference on light Xuan paper
const WASH_CLOUD_TIER_COLORS: Record<PdfStrokeTier, string> = {
  primary: '#2A3330',
  var_primary: '#5C8A28',
  rank2_5: '#3D9C8C',
  var_2_5: '#4AA896',
  rank6_9: '#59A8B8',
  var_6_9: '#5D8CB8',
  rest: '#8F6A5E',
};

const ORDER_OPTIONS: Array<{ id: PalaceWalkOrder; label: string; tip: string }> = [
  { id: 'sequential', label: '循序', tip: '按本鍵記憶宮殿順序逐根確認方位（快捷鍵 3）' },
  { id: 'chamber_shuffle', label: '本宮亂序', tip: '打亂本鍵宮殿字根順序，隨機測試單鍵方位（快捷鍵 4）' },
  { id: 'cross_key_jump', label: '跨鍵跳躍', tip: '高難度：跨 20 個宮殿隨機跳躍字根並切換對應雲圖（快捷鍵 5）' },
];

export const PalaceCloudTrainer: React.FC<PalaceCloudTrainerProps> = ({
  initialKey = 'q',
  initialMode = 'template',
  initialOrder = 'sequential',
  scriptMode,
  onChangeScriptMode,
  themeMode,
  onChangeThemeMode,
  muted,
  onToggleMute,
  speechEnabled,
  onToggleSpeech,
  onBack,
}) => {
  const t = useUiText();
  const uiScript = useUiScript();
  const isWash = themeMode === 'wash';

  const [chamberKey, setChamberKey] = useState<string>(() =>
    PALACE_PDF_CHAMBERS[initialKey.toLowerCase()] ? initialKey.toLowerCase() : 'q'
  );
  const [trainMode, setTrainMode] = useState<PalaceCloudTrainMode>(initialMode);
  const [walkOrder, setWalkOrder] = useState<PalaceWalkOrder>(initialOrder);
  const [keyScope, setKeyScope] = useState<KeyScope>('full');
  const [centerFocus, setCenterFocus] = useState<boolean>(true);
  const [showTopoFocus, setShowTopoFocus] = useState<boolean>(false);
  const [showStrokeFlow, setShowStrokeFlow] = useState<boolean>(false);
  const [includeMonument, setIncludeMonument] = useState<boolean>(false);
  const [chamberPickerOpen, setChamberPickerOpen] = useState<boolean>(false);
  const [chromeCalm, setChromeCalm] = useState<boolean>(false);
  const [overrides, setOverrides] = useState<PalaceOverridesMap>(() => loadPalaceOverrides());

  // Walk progression state
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [typedCode, setTypedCode] = useState<string>('');
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [errorFlash, setErrorFlash] = useState<boolean>(false);
  const [hitRippleTick, setHitRippleTick] = useState<number>(0);
  const [roundDone, setRoundDone] = useState<boolean>(false);

  // Quiet accuracy counters
  const [hitsCount, setHitsCount] = useState<number>(0);
  const [missesCount, setMissesCount] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);

  // Single-chamber shuffled queue + random Hanzi carriers
  const [shuffledChamberSteps, setShuffledChamberSteps] = useState<CloudWalkStep[]>([]);
  const [carriersMap, setCarriersMap] = useState<Record<string, VariantHanziCarrier | null>>({});

  // Cross-key 20-palace jump deck + per-key carriers
  const [crossDeck, setCrossDeck] = useState<CrossKeyJumpDeck>(() => ({
    stepsByKey: {},
    deck: [],
    carriersByKey: {},
  }));

  const errorTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const syncOverrides = () => setOverrides(loadPalaceOverrides());
    window.addEventListener(PALACE_OVERRIDES_EVENT, syncOverrides);
    return () => window.removeEventListener(PALACE_OVERRIDES_EVENT, syncOverrides);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    };
  }, []);

  const chamberSteps = useMemo(
    () => buildCloudWalkSequence(chamberKey, scriptMode, includeMonument, overrides),
    [chamberKey, scriptMode, includeMonument, overrides]
  );

  // Sync single-chamber deck & carriers when chamber / script / monument-toggle changes
  useEffect(() => {
    const freshCarriers = sampleEnhancedCloudCarriers(chamberSteps, chamberKey, scriptMode);
    setCarriersMap(freshCarriers);
    setShuffledChamberSteps(shuffleCloudSteps(chamberSteps));
    if (walkOrder !== 'cross_key_jump') {
      setActiveIdx(0);
      setTypedCode('');
      setCompletedIds(new Set());
      setRoundDone(false);
      setHitsCount(0);
      setMissesCount(0);
      setCombo(0);
      setErrorFlash(false);
    }
  }, [chamberKey, chamberSteps, scriptMode, walkOrder]);

  // Sync 20-key cross-jump deck when entering cross_key_jump or changing script/monument/overrides
  useEffect(() => {
    if (walkOrder !== 'cross_key_jump') return;
    const deck = buildCrossKeyJumpDeck(scriptMode, includeMonument, overrides);
    setCrossDeck(deck);
    setActiveIdx(0);
    setTypedCode('');
    setCompletedIds(new Set());
    setRoundDone(false);
    setHitsCount(0);
    setMissesCount(0);
    setCombo(0);
    setErrorFlash(false);
  }, [walkOrder, scriptMode, includeMonument, overrides]);

  const queueSteps = useMemo(() => {
    if (walkOrder === 'cross_key_jump') return crossDeck.deck;
    if (walkOrder === 'chamber_shuffle') return shuffledChamberSteps;
    return chamberSteps;
  }, [walkOrder, crossDeck.deck, shuffledChamberSteps, chamberSteps]);

  const activeStep = queueSteps[activeIdx] || queueSteps[0] || null;

  // In cross_key_jump, render the Memory Palace belonging to whichever key the current random target lives on
  const renderKey =
    walkOrder === 'cross_key_jump' && activeStep
      ? activeStep.chamberKey
      : chamberKey;

  const renderSteps = useMemo(() => {
    if (walkOrder === 'cross_key_jump') {
      return crossDeck.stepsByKey[renderKey] || [];
    }
    return chamberSteps;
  }, [walkOrder, crossDeck.stepsByKey, renderKey, chamberSteps]);

  const renderCarriers = useMemo(() => {
    if (walkOrder === 'cross_key_jump') {
      return crossDeck.carriersByKey[renderKey] || {};
    }
    return carriersMap;
  }, [walkOrder, crossDeck.carriersByKey, renderKey, carriersMap]);

  const activeChamber = LINGMING_CHAMBER_BY_KEY[renderKey];
  const activePdf = PALACE_PDF_CHAMBERS[renderKey];

  const strokeFlow = useMemo(
    () => (showStrokeFlow ? buildChamberStrokeFlow(renderKey, overrides) : null),
    [renderKey, overrides, showStrokeFlow]
  );

  const targetCode = useMemo(() => {
    if (!activeStep) return '';
    return keyScope === 'da' ? activeStep.ma.slice(0, 1) : activeStep.ma;
  }, [activeStep, keyScope]);

  const accuracy = useMemo(() => {
    const total = hitsCount + missesCount;
    return total === 0 ? 100 : Math.round((hitsCount / total) * 100);
  }, [hitsCount, missesCount]);

  // Speak active glyph gently when speech is enabled
  useEffect(() => {
    if (!speechEnabled || !activeStep || roundDone) return;
    const carrier = renderCarriers[activeStep.nodeId];
    if (trainMode === 'variant_cloud' && carrier?.char) {
      speech.speakGlyph(carrier.char);
    } else {
      const targetChar = activeStep.isPua ? activeStep.parentChar : activeStep.char;
      if (targetChar) speech.speakGlyph(targetChar);
    }
  }, [activeStep, renderCarriers, roundDone, speechEnabled, trainMode]);

  const resetProgressOnly = useCallback(() => {
    setActiveIdx(0);
    setTypedCode('');
    setCompletedIds(new Set());
    setRoundDone(false);
    setHitsCount(0);
    setMissesCount(0);
    setCombo(0);
    setErrorFlash(false);
  }, []);

  const handleReshuffleOrReroll = useCallback(
    (rerollCarriersToo = true) => {
      synth.playClick();
      if (walkOrder === 'cross_key_jump') {
        const nextDeck = buildCrossKeyJumpDeck(
          scriptMode,
          includeMonument,
          overrides,
          rerollCarriersToo ? crossDeck.carriersByKey : undefined
        );
        setCrossDeck(nextDeck);
        resetProgressOnly();
        return;
      }

      if (walkOrder === 'chamber_shuffle') {
        setShuffledChamberSteps(shuffleCloudSteps(chamberSteps));
      }
      if (rerollCarriersToo) {
        setCarriersMap((prev) =>
          sampleEnhancedCloudCarriers(chamberSteps, chamberKey, scriptMode, prev)
        );
      }
      resetProgressOnly();
    },
    [
      chamberKey,
      chamberSteps,
      crossDeck.carriersByKey,
      includeMonument,
      overrides,
      resetProgressOnly,
      scriptMode,
      walkOrder,
    ]
  );

  const handleRerollSingleCarrier = useCallback(
    (step: CloudWalkStep) => {
      synth.playClick();
      const stepKey = step.chamberKey || renderKey;
      const candidates = getCarriersForCloudStep(step, stepKey, scriptMode);
      if (candidates.length <= 1) return;
      const curChar = renderCarriers[step.nodeId]?.char;
      const filtered = candidates.filter((c) => c.char !== curChar);
      const withXray = filtered.filter((c) => c.strokes && c.highlightIndices.length > 0);
      const pool = withXray.length > 0 ? withXray : filtered;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!pick) return;

      if (walkOrder === 'cross_key_jump') {
        setCrossDeck((prev) => ({
          ...prev,
          carriersByKey: {
            ...prev.carriersByKey,
            [stepKey]: {
              ...(prev.carriersByKey[stepKey] || {}),
              [step.nodeId]: pick,
            },
          },
        }));
      } else {
        setCarriersMap((prev) => ({ ...prev, [step.nodeId]: pick }));
      }
    },
    [renderCarriers, renderKey, scriptMode, walkOrder]
  );

  const jumpToStep = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= queueSteps.length) return;
      synth.playClick();
      setActiveIdx(idx);
      setTypedCode('');
      setErrorFlash(false);
      setRoundDone(false);
    },
    [queueSteps.length]
  );

  const switchChamber = useCallback(
    (nextKey: string) => {
      const k = nextKey.toLowerCase();
      if (!PALACE_PDF_CHAMBERS[k]) return;
      synth.playClick();
      setChamberKey(k);
      if (walkOrder === 'cross_key_jump') {
        setWalkOrder('sequential');
      }
      setChamberPickerOpen(false);
      setChromeCalm(false);
    },
    [walkOrder]
  );

  const selectWalkOrder = useCallback(
    (nextOrder: PalaceWalkOrder) => {
      synth.playClick();
      setWalkOrder(nextOrder);
      if (nextOrder === 'chamber_shuffle') {
        setShuffledChamberSteps(shuffleCloudSteps(chamberSteps));
        resetProgressOnly();
      } else if (nextOrder === 'sequential') {
        resetProgressOnly();
      }
    },
    [chamberSteps, resetProgressOnly]
  );

  // Keyboard flow: zero-mouse zen control
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
        if (chamberPickerOpen) {
          setChamberPickerOpen(false);
        } else if (typedCode.length > 0) {
          setTypedCode('');
        } else {
          onBack();
        }
        return;
      }

      if (chamberPickerOpen) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (typedCode.length > 0) {
          setTypedCode((prev) => prev.slice(0, -1));
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (activeIdx + 1 < queueSteps.length) jumpToStep(activeIdx + 1);
        else jumpToStep(0);
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jumpToStep(Math.max(0, activeIdx - 1));
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        const flat = PALACE_ROW_GROUPS.flatMap((g) => g.keys);
        const cur = flat.indexOf(renderKey);
        switchChamber(flat[(cur - 1 + flat.length) % flat.length]);
        return;
      }

      if (e.key === ']') {
        e.preventDefault();
        switchChamber(getNextPalaceKey(renderKey));
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        synth.playClick();
        setTrainMode('template');
        return;
      }

      if (e.key === '2') {
        e.preventDefault();
        synth.playClick();
        setTrainMode('variant_cloud');
        return;
      }

      if (e.key === '3') {
        e.preventDefault();
        selectWalkOrder('sequential');
        return;
      }

      if (e.key === '4') {
        e.preventDefault();
        selectWalkOrder('chamber_shuffle');
        return;
      }

      if (e.key === '5') {
        e.preventDefault();
        selectWalkOrder('cross_key_jump');
        return;
      }

      if (e.key === '6') {
        e.preventDefault();
        synth.playClick();
        setShowTopoFocus((v) => !v);
        return;
      }

      if (e.key === '0') {
        e.preventDefault();
        handleReshuffleOrReroll(true);
        return;
      }

      if (roundDone && e.key === 'Enter') {
        e.preventDefault();
        if (walkOrder === 'sequential' && trainMode !== 'variant_cloud') {
          switchChamber(getNextPalaceKey(renderKey));
        } else {
          handleReshuffleOrReroll(true);
        }
        return;
      }

      if (!/^[a-zA-Z]$/.test(e.key) || !activeStep || roundDone) return;
      e.preventDefault();

      // Fade top/bottom chrome cleanly once typing rhythm starts
      setChromeCalm(true);

      const ch = e.key.toLowerCase();
      const expectedChar = targetCode[typedCode.length];
      if (!expectedChar) return;

      if (ch === expectedChar) {
        const nextTyped = typedCode + ch;
        const isStepComplete = nextTyped.length >= targetCode.length;
        const nextCombo = combo + 1;

        setCombo(nextCombo);
        setHitsCount((h) => h + 1);
        setErrorFlash(false);
        synth.playKeyHit(nextCombo, isStepComplete);

        if (isStepComplete) {
          setHitRippleTick((n) => n + 1);
          setCompletedIds((prev) => {
            const next = new Set(prev);
            next.add(activeStep.nodeId);
            return next;
          });
          setTypedCode('');
          if (activeIdx + 1 < queueSteps.length) {
            setActiveIdx(activeIdx + 1);
          } else {
            setRoundDone(true);
            setChromeCalm(false);
            synth.playMilestone();
          }
        } else {
          setTypedCode(nextTyped);
        }
      } else {
        setCombo(0);
        setMissesCount((m) => m + 1);
        setErrorFlash(true);
        synth.playKeyMiss();
        // Reset stale prefix cache on error so re-typing from key 1 works cleanly;
        // if the user already pressed key 1 of a non-doubled code to restart, accept it immediately.
        const shouldRestartFromFirst =
          typedCode.length > 0 &&
          ch === targetCode[0] &&
          targetCode[1] !== targetCode[0];
        setTypedCode(shouldRestartFromFirst ? ch : '');
        if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
        errorTimerRef.current = window.setTimeout(() => setErrorFlash(false), 360);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeIdx,
    activeStep,
    chamberPickerOpen,
    combo,
    handleReshuffleOrReroll,
    jumpToStep,
    onBack,
    queueSteps.length,
    renderKey,
    roundDone,
    selectWalkOrder,
    switchChamber,
    targetCode,
    trainMode,
    typedCode,
    walkOrder,
  ]);

  if (!activeChamber || !activePdf) return null;

  const monument = activePdf.monument;
  const monOv = overrides[monument.id];
  const isMonumentActive = Boolean(activeStep?.isMonument && !roundDone);
  const nextKey = getNextPalaceKey(renderKey);
  const nextAnchor = LINGMING_CHAMBER_BY_KEY[nextKey]?.primaryAnchor || '';

  // Camera shift: when centerFocus is ON and a step is active, translate the whole cloud
  // so (activeStep.cx, activeStep.cy) lands dead-center at (50%, 50%) of the viewport!
  const shiftPctX = centerFocus && activeStep && !roundDone ? 50 - activeStep.cx : 0;
  const shiftPctY = centerFocus && activeStep && !roundDone ? 50 - activeStep.cy : 0;
  const shouldBreatheCentered = centerFocus && !roundDone && !errorFlash;
  const monCx = monument.cx + (monOv?.dx ?? 0);
  const monCy = monument.cy + (monOv?.dy ?? 0);
  const monScale = monOv?.scale ?? 1;

  const progressRatio =
    queueSteps.length > 0 ? Math.min(1, completedIds.size / queueSteps.length) : 0;

  // Palette tuned to match both the midnight zen writing screen and celadon Xuan paper reference
  const activeJade = isWash ? '#0D7A67' : '#43E8B0';
  const activeGlowColor = errorFlash
    ? isWash ? '#B83B2A' : '#EE6B5A'
    : activeJade;
  const doneTint = isWash ? '#2E8B78' : '#32A884';
  const topoFocalColor = isWash ? '#C43125' : '#FF6B57';
  const topoHaloColor = isWash ? '#F2F6F4' : '#0A1019';
  const monumentFocal = showTopoFocus
    ? resolveCloudStepFocal(renderKey, monument.displayChar, monument.displayChar, monument.ma)
    : null;

  return (
    <div
      onMouseMove={() => {
        if (chromeCalm) setChromeCalm(false);
      }}
      className="relative z-10 w-full h-full flex flex-col overflow-hidden select-none wash-enter"
      style={{
        background: isWash
          ? 'radial-gradient(circle at 50% 48%, #EEF4F1 0%, #F4F5F2 56%, #F6F5F0 100%)'
          : 'radial-gradient(circle at 50% 48%, #0E1520 0%, #090D14 62%, #070A10 100%)',
      }}
    >
      {/* Auto-Hiding Distraction-Free Header */}
      <header
        className={`relative z-30 shrink-0 h-13 px-3 sm:px-6 flex items-center justify-between gap-2 transition-opacity duration-500 ${
          chromeCalm && !chamberPickerOpen
            ? 'opacity-0 hover:opacity-95 focus-within:opacity-95'
            : 'opacity-90'
        }`}
      >
        {/* Left: Return & Chamber Selector */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface)]/80 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setChamberPickerOpen((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--dojo-text-bright)] bg-[var(--dojo-surface)]/80 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs"
          >
            {walkOrder === 'cross_key_jump' ? (
              <>
                <Shuffle className="w-3.5 h-3.5 text-[var(--dojo-crimson-text)]" />
                <span className="font-display">
                  {t('跨鍵')} · {activeChamber.primaryAnchor}
                  {t('宮')}
                </span>
              </>
            ) : (
              <>
                <span className="font-mono-tabular text-[var(--dojo-ochre)] uppercase font-bold">
                  {renderKey}
                </span>
                <span className="font-display">
                  {activeChamber.primaryAnchor}
                  {t('宮')}
                </span>
              </>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-[var(--dojo-text-muted)]" />
          </button>
        </div>

        {/* Center: Visual Cloud Mode + Progression Order Segmented Controls */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
          <div
            role="group"
            aria-label={t('切換記憶宮殿雲圖模式')}
            className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)]/80 border border-[var(--dojo-border)] backdrop-blur-xs shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setTrainMode('template');
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                trainMode === 'template'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
              }`}
            >
              {t('基本雲圖')}
            </button>
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setTrainMode('variant_cloud');
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                trainMode === 'variant_cloud'
                  ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-pine-text)] shadow-xs'
                  : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
              }`}
            >
              <ScanSearch className="w-3.5 h-3.5 shrink-0" />
              <span>{t('萬象變根漢字')}</span>
            </button>
          </div>

          <div
            role="group"
            aria-label={t('切換出題順序與跨鍵跳躍難度')}
            className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)]/80 border border-[var(--dojo-border)] backdrop-blur-xs shrink-0"
          >
            {ORDER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={t(opt.tip)}
                onClick={() => selectWalkOrder(opt.id)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  walkOrder === opt.id
                    ? opt.id === 'cross_key_jump'
                      ? 'bg-[var(--dojo-crimson-wash)] text-[var(--dojo-crimson-text)] shadow-xs'
                      : 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)] shadow-xs'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>

          {(trainMode === 'variant_cloud' || walkOrder !== 'sequential') && (
            <button
              type="button"
              onClick={() => handleReshuffleOrReroll(true)}
              title={t('重新洗牌與隨機抽換漢字（快捷鍵 0）')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[var(--dojo-pine-wash)] hover:bg-[var(--dojo-pine)]/25 border border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)] transition-colors whitespace-nowrap cursor-pointer backdrop-blur-xs shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t(walkOrder === 'sequential' ? '換漢字' : '重洗')}
              </span>
            </button>
          )}
        </div>

        {/* Right: Quiet Focus, Code & Appearance Toggles */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setShowTopoFocus((v) => !v);
            }}
            title={t('開關顯示收斂後的拓撲共性焦點（小叉叉、小框框、小直角等，快捷鍵 6）')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs ${
              showTopoFocus
                ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)]/50 text-[var(--dojo-crimson-text)]'
                : 'bg-[var(--dojo-surface)]/80 hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
            }`}
          >
            <Target className="w-3.5 h-3.5 shrink-0" />
            <span>{t('拓撲焦點')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setCenterFocus((v) => !v);
            }}
            title={t(centerFocus ? '已開啟雲圖移動、目標居中與呼吸節奏（點擊切換固定雲圖）' : '已固定雲圖（點擊開啟雲圖跟隨居中與呼吸節奏）')}
            className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer backdrop-blur-xs ${
              centerFocus
                ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                : 'bg-[var(--dojo-surface)]/80 border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{t(centerFocus ? '居中呼吸' : '固定雲圖')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setKeyScope((prev) => (prev === 'full' ? 'da' : 'full'));
              setTypedCode('');
            }}
            title={t('切換全碼（2–3 鍵）或單鍵大碼掃描')}
            className="hidden sm:inline-flex items-center px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)]/80 hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer backdrop-blur-xs"
          >
            {t(keyScope === 'full' ? '全碼' : '單鍵')}
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setShowStrokeFlow((v) => !v);
            }}
            title={t('開關筆順記憶導線')}
            className={`hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer backdrop-blur-xs ${
              showStrokeFlow
                ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                : 'bg-[var(--dojo-surface)]/80 border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
          </button>

          <div className="hidden xl:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)]/80 border border-[var(--dojo-border)] rounded-lg backdrop-blur-xs">
            {SCRIPT_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeScriptMode(opt.id);
                }}
                className={`px-1.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  scriptMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)]'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <div className="hidden xl:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)]/80 border border-[var(--dojo-border)] rounded-lg backdrop-blur-xs">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeThemeMode(opt.id)}
                className={`px-1.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  themeMode === opt.id
                    ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)]'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleSpeech}
            title={t('開關朗讀發音')}
            className={`hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors cursor-pointer backdrop-blur-xs ${
              speechEnabled
                ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                : 'bg-[var(--dojo-surface)]/80 border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
            }`}
          >
            <AudioLines className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={t(muted ? '開啟音效' : '關閉音效')}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--dojo-surface)]/80 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] cursor-pointer backdrop-blur-xs"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Floating 20-Chamber Popover Picker (Hidden during distraction-free practice) */}
      {chamberPickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center pt-16 px-4 bg-black/35 backdrop-blur-xs"
          onClick={() => setChamberPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)] shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-base font-bold text-[var(--dojo-text-bright)]">
                  {t('切換記憶宮殿')}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    setIncludeMonument((v) => !v);
                  }}
                  className="text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-ochre)] underline underline-offset-4 cursor-pointer"
                >
                  {t(includeMonument ? '目前含主字根起點' : '目前僅練分支字根（點擊含主根）')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setChamberPickerOpen(false)}
                aria-label={t('關閉')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {PALACE_ROW_GROUPS.map((grp) => (
                <div key={grp.label} className="flex flex-wrap items-center gap-2">
                  <span className="w-16 text-[11px] text-[var(--dojo-text-muted)] shrink-0">
                    {t(grp.label)}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {grp.keys.map((k) => {
                      const ch = LINGMING_CHAMBER_BY_KEY[k];
                      const isCur = renderKey === k && walkOrder !== 'cross_key_jump';
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => switchChamber(k)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors cursor-pointer ${
                            isCur
                              ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)] font-bold'
                              : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text)]'
                          }`}
                        >
                          <span className="font-mono-tabular text-xs uppercase text-[var(--dojo-ochre)]">
                            {k}
                          </span>
                          <span className="font-display font-bold">
                            {ch?.primaryAnchor || ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 pt-3 border-t border-[var(--dojo-border)] text-xs text-[var(--dojo-text-sub)]">
              {t('口訣')} · {uiMnemonic(activeChamber.mnemonic, uiScript)}
            </p>
          </div>
        </div>
      )}

      {/* MAIN FULL-VIEWPORT ZEN STAGE: Moving Cloud with Stationary Centered Focal Point */}
      <main className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
        {/* Moving Cloud Canvas:
            A square 100x100 SVG coordinate plane translated by (50 - activeStep.cx)%, (50 - activeStep.cy)%
            so the currently targeted radical / variant Hanzi glides effortlessly into dead screen center! */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: 'min(82vw, 66vh, 560px)',
            height: 'min(82vw, 66vh, 560px)',
            transform: `translate3d(${shiftPctX.toFixed(3)}%, ${shiftPctY.toFixed(3)}%, 0)`,
            transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full overflow-visible"
            role="img"
            aria-label={`${renderKey.toUpperCase()} ${t('鍵位記憶宮殿雲圖')}`}
          >
            <defs>
              {/* Soft atmospheric mist halo behind the giant main radical */}
              <radialGradient id={`zenCloudMist_${renderKey}`} cx="50%" cy="50%" r="52%">
                <stop
                  offset="0%"
                  stopColor={isWash ? '#2F7D6E' : '#2FA88B'}
                  stopOpacity={isWash ? '0.10' : '0.11'}
                />
                <stop
                  offset="55%"
                  stopColor={isWash ? '#559187' : '#162F38'}
                  stopOpacity={isWash ? '0.04' : '0.04'}
                />
                <stop offset="100%" stopColor={isWash ? '#F4F5F2' : '#090D14'} stopOpacity="0" />
              </radialGradient>

              {/* Soft local mist cushion right behind the active centered target so it always stays crisp over monument strokes */}
              <radialGradient id="zenTargetCushion" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor={isWash ? '#F2F6F4' : '#0A1019'}
                  stopOpacity={isWash ? '0.86' : '0.78'}
                />
                <stop
                  offset="58%"
                  stopColor={isWash ? '#F2F6F4' : '#0A1019'}
                  stopOpacity={isWash ? '0.45' : '0.34'}
                />
                <stop offset="100%" stopColor={isWash ? '#F2F6F4' : '#0A1019'} stopOpacity="0" />
              </radialGradient>

              {/* Gentle luminous bloom for active emerald/jade target */}
              <filter id="zenActiveGlow" x="-45%" y="-45%" width="190%" height="190%">
                <feGaussianBlur stdDeviation={isWash ? '0.65' : '1.05'} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Ambient Palace Aura */}
            <circle cx="50" cy="50" r="56" fill={`url(#zenCloudMist_${renderKey})`} />

            {/* #1 Monumental Main Radical (又 / 白 / etc.) — Anchors spatial orientation */}
            <g
              transform={`translate(${monCx.toFixed(2)} ${monCy.toFixed(2)})`}
              onClick={() => {
                const mIdx = queueSteps.findIndex(
                  (s) => s.chamberKey === renderKey && s.isMonument
                );
                if (mIdx >= 0) jumpToStep(mIdx);
              }}
              className={includeMonument ? 'cursor-pointer' : undefined}
            >
              <g
                key={isMonumentActive && shouldBreatheCentered ? `mon_breathe_${monument.id}` : monument.id}
                className={isMonumentActive && shouldBreatheCentered ? 'palace-monument-breathe' : undefined}
              >
                <path
                  d={monument.path}
                  fill={
                    isMonumentActive
                      ? activeGlowColor
                      : isWash
                        ? '#2E3633'
                        : '#466163'
                  }
                  fillOpacity={
                    roundDone
                      ? isWash ? 0.42 : 0.36
                      : isMonumentActive
                        ? isWash ? 0.85 : 0.72
                        : isWash
                          ? 0.72
                          : 0.34
                  }
                  transform={`scale(${monScale.toFixed(3)}) translate(${(-monument.cx).toFixed(2)} ${(-monument.cy).toFixed(2)})`}
                  style={{ transition: 'fill 260ms ease, fill-opacity 260ms ease' }}
                  shapeRendering="geometricPrecision"
                />
                {showTopoFocus && monumentFocal && (
                  <TopologyFocalSvgOverlay
                    focal={monumentFocal}
                    targetRect={{
                      x: -(monument.r * monScale * 0.82),
                      y: -(monument.r * monScale * 0.82),
                      w: monument.r * monScale * 1.64,
                      h: monument.r * monScale * 1.64,
                    }}
                    strokeColor={topoFocalColor}
                    haloColor={topoHaloColor}
                    strokeWidth={isMonumentActive ? 1.45 : 1.05}
                    opacity={isMonumentActive ? 0.92 : 0.36}
                  />
                )}
              </g>
            </g>

            {/* Optional Calligraphic Stroke Flow Path */}
            {strokeFlow && (
              <PalaceStrokeFlowOverlay flow={strokeFlow} isWash={isWash} animate />
            )}

            {/* Branch Radicals (Mode 1: Template Vector Glyphs | Mode 2: Borderless X-Ray Hanzi like reference!) */}
            {renderSteps.map((step) => {
              if (step.isMonument) return null;

              const isActive = !roundDone && activeStep?.nodeId === step.nodeId;
              const isDone = completedIds.has(step.nodeId);
              const carrier = renderCarriers[step.nodeId];

              const tierColor = isWash
                ? WASH_CLOUD_TIER_COLORS[step.tier]
                : PDF_TIER_COLORS[step.tier];

              const handleNodeClick = () => {
                if (isActive && trainMode === 'variant_cloud') {
                  handleRerollSingleCarrier(step);
                  return;
                }
                const qIdx = queueSteps.findIndex((q) => q.nodeId === step.nodeId);
                if (qIdx >= 0) jumpToStep(qIdx);
              };

              if (trainMode === 'template') {
                const ov = overrides[step.nodeId];
                const baseDx = ov?.dx ?? 0;
                const baseDy = ov?.dy ?? 0;
                const baseScale = ov?.scale ?? 1;
                const origCx = step.cx - baseDx;
                const origCy = step.cy - baseDy;

                const scaleBoost = isActive ? 1.42 : 1;
                const fill = isActive
                  ? activeGlowColor
                  : isDone
                    ? doneTint
                    : tierColor;
                const opacity = roundDone
                  ? 0.85
                  : isActive
                    ? 1
                    : isDone
                      ? isWash ? 0.44 : 0.36
                      : isWash ? 0.68 : 0.46;

                const nodeBreathes = isActive && shouldBreatheCentered;
                const stepFocal = showTopoFocus
                  ? resolveCloudStepFocal(step.chamberKey || renderKey, step.char, step.parentChar, step.ma)
                  : null;
                const templateFocalHalf = Math.max(2.6, step.r * baseScale * scaleBoost * 0.96);

                return (
                  <g
                    key={step.nodeId}
                    transform={`translate(${step.cx.toFixed(2)} ${step.cy.toFixed(2)})`}
                    onClick={handleNodeClick}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={Math.max(4.8, step.r * 1.4)}
                      fill="transparent"
                    />
                    {isActive && (
                      <circle
                        key={nodeBreathes ? `cush_${step.nodeId}` : `cush_static_${step.nodeId}`}
                        cx={0}
                        cy={0}
                        r={Math.max(6.8, step.r * 2.15)}
                        fill="url(#zenTargetCushion)"
                        className={nodeBreathes ? 'palace-cushion-breathe' : undefined}
                      />
                    )}
                    {nodeBreathes && (
                      <circle
                        key={`ring_${step.nodeId}`}
                        cx={0}
                        cy={0}
                        r={Math.max(5.4, step.r * 1.68)}
                        fill="none"
                        stroke={showTopoFocus ? topoFocalColor : activeGlowColor}
                        strokeWidth="0.32"
                        className="palace-breath-ring pointer-events-none"
                      />
                    )}
                    <g
                      key={nodeBreathes ? `breathe_${step.nodeId}` : `still_${step.nodeId}`}
                      className={nodeBreathes ? 'palace-radical-breathe' : undefined}
                    >
                      <g
                        transform={`scale(${(baseScale * scaleBoost).toFixed(3)}) translate(${(-origCx).toFixed(2)} ${(-origCy).toFixed(2)})`}
                        filter={isActive && !showTopoFocus ? 'url(#zenActiveGlow)' : undefined}
                        style={{ transition: 'opacity 220ms ease' }}
                      >
                        <path
                          d={step.path}
                          fill={fill}
                          fillOpacity={showTopoFocus ? opacity * (isActive ? 0.56 : 0.62) : opacity}
                          shapeRendering="geometricPrecision"
                        />
                      </g>
                      {showTopoFocus && stepFocal && (
                        <TopologyFocalSvgOverlay
                          focal={stepFocal}
                          targetRect={{
                            x: -templateFocalHalf,
                            y: -templateFocalHalf,
                            w: templateFocalHalf * 2,
                            h: templateFocalHalf * 2,
                          }}
                          strokeColor={topoFocalColor}
                          haloColor={topoHaloColor}
                          strokeWidth={isActive ? 0.62 : 0.42}
                          opacity={roundDone ? 0.9 : isActive ? 1 : isDone ? 0.48 : 0.84}
                        />
                      )}
                    </g>
                  </g>
                );
              }

              // Mode 2: Enhanced Random-Hanzi Variant Cloud
              const baseBox = Math.max(7.2, Math.min(11.4, step.r * 2.25));
              const boxSize = baseBox * (isActive ? 1.48 : 1);
              const half = boxSize / 2;
              const hasVectorCarrier = Boolean(carrier?.strokes && carrier.strokes.length > 0);
              const highlightSet = new Set<number>(carrier?.highlightIndices ?? []);

              const targetStrokeColor = isActive
                ? activeGlowColor
                : isDone
                  ? doneTint
                  : tierColor;
              const contextStrokeColor = isWash ? '#48504D' : '#CBD5E1';

              const targetOpacity = roundDone
                ? 0.9
                : isActive
                  ? 1
                  : isDone
                    ? isWash ? 0.46 : 0.36
                    : isWash ? 0.78 : 0.56;
              const contextOpacity = roundDone
                ? isWash ? 0.28 : 0.24
                : isActive
                  ? isWash ? 0.34 : 0.36
                  : isDone
                    ? isWash ? 0.14 : 0.12
                    : isWash ? 0.24 : 0.18;
              const variantBreathes = isActive && shouldBreatheCentered;
              const variantFocal = showTopoFocus
                ? resolveCloudStepFocal(step.chamberKey || renderKey, step.char, step.parentChar, step.ma)
                : null;
              const variantFocalRect = (() => {
                if (!showTopoFocus || !variantFocal) return null;
                if (hasVectorCarrier && carrier?.strokes) {
                  const nr = computeHighlightedRadicalNormRect(
                    carrier.char,
                    carrier.strokes,
                    carrier.highlightIndices ?? []
                  );
                  return {
                    x: -half + nr.x * boxSize,
                    y: -half + nr.y * boxSize,
                    w: nr.w * boxSize,
                    h: nr.h * boxSize,
                  };
                }
                return {
                  x: -half * 0.78,
                  y: -half * 0.78,
                  w: boxSize * 0.78,
                  h: boxSize * 0.78,
                };
              })();

              return (
                <g
                  key={step.nodeId}
                  transform={`translate(${step.cx.toFixed(2)} ${step.cy.toFixed(2)})`}
                  onClick={handleNodeClick}
                  className="cursor-pointer"
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={Math.max(5.2, half * 1.15)}
                    fill="transparent"
                  />
                  {isActive && (
                    <circle
                      key={variantBreathes ? `vcush_${step.nodeId}` : `vcush_static_${step.nodeId}`}
                      cx={0}
                      cy={0}
                      r={half * 1.65}
                      fill="url(#zenTargetCushion)"
                      className={variantBreathes ? 'palace-cushion-breathe' : undefined}
                    />
                  )}
                  {variantBreathes && (
                    <circle
                      key={`vring_${step.nodeId}`}
                      cx={0}
                      cy={0}
                      r={half * 1.24}
                      fill="none"
                      stroke={showTopoFocus ? topoFocalColor : activeGlowColor}
                      strokeWidth="0.32"
                      className="palace-breath-ring pointer-events-none"
                    />
                  )}

                  <g
                    key={variantBreathes ? `vbreathe_${step.nodeId}` : `vstill_${step.nodeId}`}
                    className={variantBreathes ? 'palace-radical-breathe' : undefined}
                  >
                    {hasVectorCarrier && carrier?.strokes ? (
                      <g
                        transform={`translate(${(-half).toFixed(2)} ${(-half).toFixed(2)}) scale(${(boxSize / 1024).toFixed(5)}) translate(0 900) scale(1 -1)`}
                        filter={isActive && !showTopoFocus ? 'url(#zenActiveGlow)' : undefined}
                      >
                        {carrier.strokes.map((d, sIdx) => {
                          const isTarget = highlightSet.size === 0 || highlightSet.has(sIdx);
                          if (isTarget) return null;
                          return (
                            <path
                              key={`ctx_${sIdx}`}
                              d={d}
                              fill={contextStrokeColor}
                              fillOpacity={showTopoFocus ? contextOpacity * 0.85 : contextOpacity}
                              shapeRendering="geometricPrecision"
                            />
                          );
                        })}
                        {carrier.strokes.map((d, sIdx) => {
                          const isTarget = highlightSet.size === 0 || highlightSet.has(sIdx);
                          if (!isTarget) return null;
                          return (
                            <path
                              key={`hit_${sIdx}`}
                              d={d}
                              fill={targetStrokeColor}
                              fillOpacity={showTopoFocus ? targetOpacity * (isActive ? 0.52 : 0.58) : targetOpacity}
                              shapeRendering="geometricPrecision"
                            />
                          );
                        })}
                      </g>
                    ) : carrier?.char ? (
                      <text
                        x={0}
                        y={boxSize * 0.32}
                        textAnchor="middle"
                        fontSize={boxSize * 0.86}
                        fontWeight={isActive ? '700' : '600'}
                        fontFamily="'Noto Serif TC', serif"
                        fill={targetStrokeColor}
                        fillOpacity={showTopoFocus ? targetOpacity * 0.58 : targetOpacity}
                        filter={isActive && !showTopoFocus ? 'url(#zenActiveGlow)' : undefined}
                      >
                        {carrier.char}
                      </text>
                    ) : (
                      <g
                        transform={`scale(${((overrides[step.nodeId]?.scale ?? 1) * (isActive ? 1.42 : 1)).toFixed(3)}) translate(${(-(step.cx - (overrides[step.nodeId]?.dx ?? 0))).toFixed(2)} ${(-(step.cy - (overrides[step.nodeId]?.dy ?? 0))).toFixed(2)})`}
                        filter={isActive && !showTopoFocus ? 'url(#zenActiveGlow)' : undefined}
                      >
                        <path
                          d={step.path}
                          fill={targetStrokeColor}
                          fillOpacity={showTopoFocus ? targetOpacity * 0.58 : targetOpacity}
                          shapeRendering="geometricPrecision"
                        />
                      </g>
                    )}

                    {/* Final converged topological common focal shape (tiny crisp ✕ / □ / ┌ / <) */}
                    {showTopoFocus && variantFocal && variantFocalRect && (
                      <TopologyFocalSvgOverlay
                        focal={variantFocal}
                        targetRect={variantFocalRect}
                        strokeColor={topoFocalColor}
                        haloColor={topoHaloColor}
                        strokeWidth={isActive ? 0.58 : 0.42}
                        opacity={roundDone ? 0.92 : isActive ? 1 : isDone ? 0.46 : 0.85}
                      />
                    )}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Pure Distraction-Free Feedback (Zero English codes, zero top explanatory badges) */}
        {!roundDone && activeStep && (
          <>
            {centerFocus && hitRippleTick > 0 && (
              <div
                key={`ripple_${hitRippleTick}`}
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 animate-ping"
                style={{
                  borderColor: activeJade,
                  animationIterationCount: 1,
                  animationDuration: '380ms',
                }}
              />
            )}

            {/* Minimal ink dots only when mid-sequence on a 2-3 key code (never shows English letters) */}
            {targetCode.length > 1 && typedCode.length > 0 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
                style={{
                  top: centerFocus ? 'calc(50% + 56px)' : 'calc(100% - 64px)',
                }}
              >
                {Array.from({ length: targetCode.length }).map((_, idx) => {
                  const filled = idx < typedCode.length;
                  return (
                    <span
                      key={idx}
                      className="w-2 h-2 rounded-full transition-all duration-150"
                      style={{
                        backgroundColor: filled ? activeJade : 'transparent',
                        border: `1.5px solid ${filled ? activeJade : isWash ? 'rgba(28,36,33,0.28)' : 'rgba(242,238,230,0.28)'}`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Calm Completion Card Floating Over Full Illuminated Palace */}
        {roundDone && (
          <div className="relative z-30 w-full max-w-sm mx-4 rounded-2xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)]/92 backdrop-blur-md p-6 text-center shadow-2xl flex flex-col items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center border"
              style={{
                backgroundColor: isWash ? 'rgba(13, 122, 103, 0.10)' : 'rgba(67, 232, 176, 0.12)',
                borderColor: activeJade,
              }}
            >
              <Check className="w-6 h-6" style={{ color: activeJade }} />
            </div>

            <div>
              <h3 className="font-display text-xl font-bold text-[var(--dojo-text-bright)]">
                {walkOrder === 'cross_key_jump'
                  ? t('全宮殿跨鍵跳躍完成')
                  : `${renderKey.toUpperCase()} · ${activeChamber.primaryAnchor}${t('宮 方位記憶完成')}`}
              </h3>
              <p className="mt-1 text-xs text-[var(--dojo-text-sub)]">
                {t(`完成 ${queueSteps.length} 處雲圖定位 · 準確率 ${accuracy}%`)}
              </p>
            </div>

            <div className="w-full flex flex-col gap-2">
              {walkOrder === 'cross_key_jump' || walkOrder === 'chamber_shuffle' ? (
                <button
                  type="button"
                  onClick={() => handleReshuffleOrReroll(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-xl transition-opacity cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>
                    {t(
                      walkOrder === 'cross_key_jump'
                        ? '重新洗牌 20 鍵再跳一輪'
                        : '重新打亂本宮再走一遍'
                    )}
                  </span>
                </button>
              ) : trainMode === 'variant_cloud' ? (
                <button
                  type="button"
                  onClick={() => handleReshuffleOrReroll(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-xl transition-opacity cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{t('換一批變根漢字再走一遍')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => selectWalkOrder('cross_key_jump')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[var(--dojo-pine)] hover:opacity-90 text-white rounded-xl transition-opacity cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>{t('挑戰：跨鍵隨機跳躍')}</span>
                </button>
              )}

              {walkOrder !== 'cross_key_jump' && (
                <button
                  type="button"
                  onClick={() => switchChamber(nextKey)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-xl transition-colors cursor-pointer"
                >
                  <span>
                    {t('下一宮殿：')} {nextKey.toUpperCase()}（{nextAnchor}）
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  if (walkOrder !== 'sequential') {
                    selectWalkOrder('sequential');
                  } else {
                    resetProgressOnly();
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text)] rounded-xl transition-colors cursor-pointer"
              >
                {walkOrder !== 'sequential' ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{t(walkOrder !== 'sequential' ? '切回循序模式' : '重走本宮')}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Whisper-Quiet Auto-Hiding Bottom Controls + 2px Hairline */}
      <footer className="relative z-30 shrink-0 px-4 sm:px-6 pb-3 pt-1 flex items-center justify-between gap-3 text-[11px] text-[var(--dojo-text-muted)]">
        <div
          className={`flex items-center gap-2 transition-opacity duration-500 ${
            chromeCalm && !chamberPickerOpen
              ? 'opacity-0 hover:opacity-95'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <button
            type="button"
            disabled={activeIdx <= 0}
            onClick={() => jumpToStep(activeIdx - 1)}
            className="inline-flex items-center gap-0.5 hover:text-[var(--dojo-text-bright)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{t('上一根')}</span>
          </button>
          <span aria-hidden="true" className="opacity-40">·</span>
          <button
            type="button"
            onClick={() => {
              if (activeIdx + 1 < queueSteps.length) jumpToStep(activeIdx + 1);
              else jumpToStep(0);
            }}
            className="inline-flex items-center gap-0.5 hover:text-[var(--dojo-text-bright)] cursor-pointer"
          >
            <span>{t('下一根')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          className={`flex items-center gap-2 font-mono-tabular transition-opacity duration-500 ${
            chromeCalm && !chamberPickerOpen
              ? 'opacity-0 hover:opacity-95'
              : 'opacity-70 hover:opacity-100'
          }`}
        >
          <span>
            {Math.min(completedIds.size, queueSteps.length)} / {queueSteps.length}
          </span>
        </div>

        {/* Hairline 2px ink progress along very bottom edge */}
        <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-[var(--dojo-border)]/35">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${(progressRatio * 100).toFixed(1)}%`,
              backgroundColor: activeJade,
            }}
          />
        </div>
      </footer>
    </div>
  );
};
