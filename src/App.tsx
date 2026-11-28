import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Target,
  Eye,
  EyeOff,
  Sparkles,
  Compass,
  Layers,
  ArrowRight,
  AudioLines,
  Keyboard,
  Flame,
  ScrollText,
  ScanSearch,
  Search,
  BookOpen,
  ArrowLeftRight,
  Feather,
} from 'lucide-react';
import {
  BUILTIN_SCHEMES,
  GlyphEntry,
  ShapeCodeScheme,
} from './data/schemes';
import { LINGMING_CHAMBER_BY_KEY } from './data/lingming';
import { getNextPalaceKey } from './data/palaceStrokes';
import {
  buildChamberXrayDeck,
  CampaignProgressStore,
  loadCampaignProgress,
  recordChamberPass,
} from './data/campaign';
import {
  loadScriptMode,
  loadUiScript,
  saveScriptMode,
  saveUiScript,
  SCRIPT_MODE_LABELS,
  SCRIPT_MODE_OPTIONS,
  ScriptMode,
  UiScript,
} from './data/scriptFilter';
import { UiScriptContext, uiText } from './data/uiScript';
import {
  loadThemeMode,
  saveThemeMode,
  THEME_OPTIONS,
  ThemeContext,
  ThemeMode,
} from './data/theme';
import {
  KeystrokeCloudContext,
  loadKeystrokeCloudEnabled,
  resolveDaSlotFromRoles,
  saveKeystrokeCloudEnabled,
  useKeystrokeCloudPulse,
} from './data/keystrokeCloud';
import {
  ActiveTargetSnapshot,
  GameCanvas,
  GameMode,
  HudSnapshot,
  LayoutMode,
  RoundResult,
} from './engine/GameCanvas';
import { getDepthFocusMetrics } from './engine/palaceSizing';
import {
  getWeakestKeys,
  loadMasteryStore,
  recordDailyBestCpm,
  saveMasteryStore,
  ScaffoldMode,
  SchemeMasteryStore,
  TrainingScope,
} from './engine/mastery';
import { TactileKeyboard } from './components/TactileKeyboard';
import { BlurredKeyboardBackdrop } from './components/BlurredKeyboardBackdrop';
import { StrokeCloudStage } from './components/StrokeCloudStage';
import { MemoryPalaceCloud } from './components/MemoryPalaceCloud';
import { DrillTab, ExtremeDrillStudio } from './components/ExtremeDrillStudio';
import { HuangtingDojo } from './components/HuangtingDojo';
import { DecompositionLab, DecompositionTab } from './components/DecompositionLab';
import { PalaceCloudTrainer } from './components/PalaceCloudTrainer';
import { KineticVerificationLab } from './components/KineticVerificationLab';
import { WriterSingleKeyStudio } from './components/WriterSingleKeyStudio';
import { CalligraphyTopologyStudio } from './components/CalligraphyTopologyStudio';
import { TwentyKeyTopologyTheater } from './components/TwentyKeyTopologyTheater';
import { TopologyMuscleTrainer } from './components/TopologyMuscleTrainer';
import { TopologicalJourneyPalace } from './components/TopologicalJourneyPalace';
import type { PalaceCloudTrainMode, PalaceWalkOrder } from './data/palaceCloudTraining';
import type { TopologyDrillOrder } from './data/topologyMuscleTraining';
import { FirebaseErrorBoundary } from './components/FirebaseErrorBoundary';
import { KeystrokeCloudToggle, KeystrokePalaceCloud } from './components/KeystrokePalaceCloud';
import { RhythmMetronome } from './components/RhythmMetronome';
import { synth } from './audio/synth';
import { speech } from './audio/speech';

type GameState =
  | 'TITLE_MENU'
  | 'PALACE_CLOUD'
  | 'PALACE_TRAINER'
  | 'DECOMPOSITION_LAB'
  | 'DRILL_STUDIO'
  | 'HUANGTING_DOJO'
  | 'KINETIC_LAB'
  | 'WRITER_SINGLE_KEY'
  | 'CALLIGRAPHY_TOPOLOGY'
  | 'TWENTY_KEY_THEATER'
  | 'TOPOLOGY_TRAINER'
  | 'TOPOLOGICAL_PALACE'
  | 'PLAYING'
  | 'PAUSED'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

const TITLE_ART_URL = `${import.meta.env.BASE_URL}src/assets/images/dojo_title_backdrop_1795311703232.jpg`;

const MODE_OPTIONS: Array<{ id: GameMode; label: string; brief: string }> = [
  {
    id: 'reflex',
    label: '記憶宮殿反射',
    brief: '疊層三景深零掃視鍛煉：遠景虛化鍵盤 ＋ 中景巨字筆畫雲圖 ＋ 前景打字焦點',
  },
  {
    id: 'weakkey',
    label: '弱鍵聚焦',
    brief: '針對反應較慢與容易猶豫的 5 個輔音宮殿鍵位，進行平靜肌肉重塑',
  },
];

const SCOPE_OPTIONS: Array<{ id: TrainingScope; label: string }> = [
  { id: 'root', label: '全字根完整碼 (2-3鍵)' },
  { id: 'char', label: '靈明單字 (自分割)' },
  { id: 'all', label: '全層自適應' },
  { id: 'da', label: '僅大碼 (1鍵入門)' },
];

const SCAFFOLD_LABELS: Record<ScaffoldMode, string> = {
  adaptive: '自適應漸隱',
  full: '全程提示',
  blind: '默背盲打',
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TWENTY_KEY_THEATER');
  const [topoFocusKey, setTopoFocusKey] = useState<string>('h');
  const [topoTrainerOrder, setTopoTrainerOrder] = useState<TopologyDrillOrder>('sequential');
  const [returnStateFromPalace, setReturnStateFromPalace] = useState<'TITLE_MENU' | 'PLAYING'>(
    'TITLE_MENU'
  );
  const [subDojoReturnTo, setSubDojoReturnTo] = useState<'TITLE_MENU' | 'DECOMPOSITION_LAB'>(
    'TITLE_MENU'
  );
  const [decompositionTab, setDecompositionTab] = useState<DecompositionTab>('rules');
  const [palaceMapInitialView, setPalaceMapInitialView] = useState<'keyboard' | 'atlas'>('keyboard');
  const [palaceTrainerConfig, setPalaceTrainerConfig] = useState<{
    key: string;
    mode: PalaceCloudTrainMode;
    order: PalaceWalkOrder;
    returnTo: 'TITLE_MENU' | 'PALACE_CLOUD';
  }>({ key: 'q', mode: 'template', order: 'sequential', returnTo: 'TITLE_MENU' });
  const [drillLaunchPreset, setDrillLaunchPreset] = useState<{
    tab?: DrillTab;
    customText?: string;
    openPaste?: boolean;
  }>({});
  const [mode, setMode] = useState<GameMode>('reflex');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('depth');
  const [trainingScope, setTrainingScope] = useState<TrainingScope>('root');
  const [scaffoldMode, setScaffoldMode] = useState<ScaffoldMode>('adaptive');
  const [hideCodeHints, setHideCodeHints] = useState<boolean>(() => {
    try {
      return localStorage.getItem('inkkey_hide_code_hints') === 'true';
    } catch {
      return false;
    }
  });
  const [cloudEchoMotion, setCloudEchoMotion] = useState<'fade' | 'keyzoom'>(() => {
    try {
      return localStorage.getItem('inkkey_cloud_echo_motion') === 'keyzoom' ? 'keyzoom' : 'fade';
    } catch {
      return 'fade';
    }
  });
  const [muted, setMuted] = useState<boolean>(() => synth.isMuted());
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => speech.isEnabled());
  const [activeScheme, setActiveScheme] = useState<ShapeCodeScheme>(BUILTIN_SCHEMES[0]);

  const [mastery, setMastery] = useState<SchemeMasteryStore>(() =>
    loadMasteryStore(BUILTIN_SCHEMES[0].id)
  );
  const masteryRef = useRef<SchemeMasteryStore>(mastery);

  const [campaignProgress, setCampaignProgress] = useState<CampaignProgressStore>(() =>
    loadCampaignProgress()
  );
  const [scriptMode, setScriptMode] = useState<ScriptMode>(() => loadScriptMode());
  const [uiScript, setUiScript] = useState<UiScript>(() => loadUiScript(loadScriptMode()));
  const t = useCallback((text: string) => uiText(text, uiScript), [uiScript]);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());
  const isWash = themeMode === 'wash';
  const handleChangeThemeMode = useCallback((next: ThemeMode) => {
    synth.playClick();
    setThemeMode(next);
    saveThemeMode(next);
  }, []);
  const [keystrokeCloudEnabled, setKeystrokeCloudEnabled] = useState<boolean>(() =>
    loadKeystrokeCloudEnabled()
  );
  const handleSetKeystrokeCloudEnabled = useCallback((next: boolean) => {
    setKeystrokeCloudEnabled(next);
    saveKeystrokeCloudEnabled(next);
  }, []);
  const handleToggleKeystrokeCloud = useCallback(() => {
    setKeystrokeCloudEnabled((prev) => {
      const next = !prev;
      saveKeystrokeCloudEnabled(next);
      return next;
    });
  }, []);
  const keystrokeCloudCtx = useMemo(
    () => ({
      enabled: keystrokeCloudEnabled,
      setEnabled: handleSetKeystrokeCloudEnabled,
      toggle: handleToggleKeystrokeCloud,
    }),
    [keystrokeCloudEnabled, handleSetKeystrokeCloudEnabled, handleToggleKeystrokeCloud]
  );
  const playingCloudPulse = useKeystrokeCloudPulse(keystrokeCloudEnabled);
  const { trigger: triggerPlayingCloud, clear: clearPlayingCloud } = playingCloudPulse;
  const [arcadeCloudPos, setArcadeCloudPos] = useState<{ xPct: number; yPct: number }>({
    xPct: 50,
    yPct: 45,
  });
  const [activeCustomDeck, setActiveCustomDeck] = useState<GlyphEntry[] | null>(null);

  const [focusKeys, setFocusKeys] = useState<string[] | null>(null);
  const [chamberReturnTo, setChamberReturnTo] = useState<'PALACE_CLOUD' | 'TITLE_MENU'>(
    'PALACE_CLOUD'
  );
  const [chamberXrayMode, setChamberXrayMode] = useState<{
    active: boolean;
    key: string | null;
  } | null>(null);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('inkkey_auto_advance') !== 'false';
    } catch {
      return true;
    }
  });
  const [autoAdvancePaused, setAutoAdvancePaused] = useState(false);
  const [autoAdvanceSec, setAutoAdvanceSec] = useState(4);
  const [completedChars, setCompletedChars] = useState<Set<string>>(() => new Set());
  const [hud, setHud] = useState<HudSnapshot>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    cleared: 0,
    targetGoal: 30,
    lives: 5,
    maxLives: 5,
    wave: 1,
    accuracy: 100,
    cpm: 0,
    avgKeyMs: 0,
    promotedCount: 0,
  });
  const [target, setTarget] = useState<ActiveTargetSnapshot | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [virtualKeyEvent, setVirtualKeyEvent] = useState<{ key: string; tick: number } | null>(
    null
  );
  const [hintPulseTick, setHintPulseTick] = useState(0);
  const [resetSignal, setResetSignal] = useState(1);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [echoMemory, setEchoMemory] = useState<{
    chamberKey: string;
    activeChar: string | null;
  } | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? Math.max(480, window.innerHeight - 48) : 720,
  }));
  const [echoPose, setEchoPose] = useState<{
    startDx: number;
    startDy: number;
    startScale: number;
    settled: boolean;
  }>({ startDx: 0, startDy: 0, startScale: 1, settled: false });

  const depthMetrics = useMemo(
    () => getDepthFocusMetrics(stageSize.width, stageSize.height, hideCodeHints),
    [stageSize.width, stageSize.height, hideCodeHints]
  );

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setStageSize((prev) =>
          Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
            ? prev
            : { width: r.width, height: r.height }
        );
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gameState, layoutMode]);

  useEffect(() => {
    document.documentElement.lang = uiScript === 'simp' ? 'zh-Hans' : 'zh-Hant';
    document.title = uiText('墨鍵道場 · 靈明輸入法筆畫雲圖與記憶宮殿訓練', uiScript);
  }, [uiScript]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.classList.toggle('wash', themeMode === 'wash');
    saveThemeMode(themeMode);
  }, [themeMode]);

  const switchScheme = useCallback((nextScheme: ShapeCodeScheme) => {
    setActiveScheme(nextScheme);
    const loaded = loadMasteryStore(nextScheme.id);
    masteryRef.current = loaded;
    setMastery(loaded);
    if (!nextScheme.isLingming) {
      setTrainingScope('all');
    } else {
      setTrainingScope('root');
    }
  }, []);

  const handleMasteryChange = useCallback(
    (next: SchemeMasteryStore) => {
      masteryRef.current = next;
      setMastery(next);
      saveMasteryStore(activeScheme.id, next);
    },
    [activeScheme.id]
  );

  const weakestKeys = useMemo(
    () => getWeakestKeys(activeScheme, mastery, 5, scriptMode),
    [activeScheme, mastery, scriptMode]
  );

  const startPlay = useCallback(
    (
      selectedMode: GameMode = mode,
      overrideFocusKeys: string[] | null = null,
      overrideScope?: TrainingScope,
      overrideScaffold?: ScaffoldMode
    ) => {
      synth.playClick();
      setActiveCustomDeck(null);
      setChamberXrayMode(null);
      setMode(selectedMode);
      if (overrideScope) setTrainingScope(overrideScope);
      if (overrideScaffold) setScaffoldMode(overrideScaffold);
      if (overrideFocusKeys !== null) {
        setFocusKeys(overrideFocusKeys.length > 0 ? overrideFocusKeys : null);
      } else if (selectedMode === 'weakkey') {
        const keys = getWeakestKeys(activeScheme, masteryRef.current, 5, scriptMode).map(
          (w) => w.key
        );
        setFocusKeys(keys);
      } else {
        setFocusKeys(null);
      }
      setCompletedChars(new Set());
      setRoundResult(null);
      setResetSignal((n) => n + 1);
      setGameState('PLAYING');
    },
    [activeScheme, mode, scriptMode]
  );

  const handleChangeScriptMode = useCallback(
    (next: ScriptMode, restartPlayingIfNeeded = false) => {
      setScriptMode(next);
      saveScriptMode(next);
      if (next === 'trad' || next === 'simp') {
        setUiScript(next);
        saveUiScript(next);
      }
      if (restartPlayingIfNeeded && (gameState === 'PAUSED' || gameState === 'PLAYING')) {
        if (chamberXrayMode?.active) {
          const deck = buildChamberXrayDeck(
            chamberXrayMode.key,
            next,
            chamberXrayMode.key ? 20 : 24
          );
          setActiveCustomDeck(deck.length > 0 ? deck : null);
          setCompletedChars(new Set());
          setRoundResult(null);
          setResetSignal((n) => n + 1);
          setGameState('PLAYING');
        } else {
          setResetSignal((n) => n + 1);
          setGameState('PLAYING');
        }
      }
    },
    [chamberXrayMode, gameState]
  );

  const handleGlyphCleared = useCallback((ch: string) => {
    setCompletedChars((prev) => {
      const next = new Set(prev);
      next.add(ch);
      return next;
    });
  }, []);

  const handleRoundEnd = useCallback(
    (result: RoundResult) => {
      if (
        result.reason === 'cleared' &&
        focusKeys &&
        focusKeys.length === 1 &&
        activeScheme.isLingming
      ) {
        const updatedStore = recordChamberPass(
          campaignProgress,
          focusKeys[0],
          result.accuracy,
          result.avgKeyMs,
          scaffoldMode === 'blind'
        );
        setCampaignProgress(updatedStore);
      }
      if (result.cpm > 0) {
        const withPeakCpm = recordDailyBestCpm(masteryRef.current, result.cpm);
        if (withPeakCpm !== masteryRef.current) {
          handleMasteryChange(withPeakCpm);
        }
      }
      setRoundResult(result);
      setAutoAdvancePaused(false);
      setAutoAdvanceSec(result.weakEntries && result.weakEntries.length > 0 ? 6 : 4);
      setGameState(result.reason === 'gameover' ? 'GAME_OVER' : 'ROUND_SUMMARY');
    },
    [activeScheme.isLingming, campaignProgress, focusKeys, handleMasteryChange, scaffoldMode]
  );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    synth.setMuted(next);
    if (!next) synth.playClick();
  };

  const toggleSpeech = () => {
    const next = !speechEnabled;
    setSpeechEnabled(next);
    speech.setEnabled(next);
    synth.playClick();
  };

  const toggleHideCodeHints = () => {
    setHideCodeHints((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('inkkey_hide_code_hints', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
    synth.playClick();
  };

  const toggleCloudEchoMotion = () => {
    setCloudEchoMotion((prev) => {
      const next = prev === 'fade' ? 'keyzoom' : 'fade';
      try {
        localStorage.setItem('inkkey_cloud_echo_motion', next);
      } catch {
        // Ignore
      }
      return next;
    });
    synth.playClick();
  };

  const cycleScaffold = () => {
    synth.playClick();
    setScaffoldMode((prev) =>
      prev === 'adaptive' ? 'full' : prev === 'full' ? 'blind' : 'adaptive'
    );
  };

  const toggleLayoutMode = () => {
    synth.playClick();
    setLayoutMode((prev) => (prev === 'depth' ? 'split' : 'depth'));
  };

  const openPalaceCloud = useCallback(
    (from: 'TITLE_MENU' | 'PLAYING', viewMode: 'keyboard' | 'atlas' = 'keyboard') => {
      synth.playClick();
      if (!activeScheme.isLingming) {
        switchScheme(BUILTIN_SCHEMES[0]);
      }
      setPalaceMapInitialView(viewMode);
      setReturnStateFromPalace(from);
      setGameState('PALACE_CLOUD');
    },
    [activeScheme.isLingming, switchScheme]
  );

  const openPalaceTrainer = useCallback(
    (
      chamberKey: string,
      trainerMode: PalaceCloudTrainMode,
      from: 'TITLE_MENU' | 'PALACE_CLOUD',
      order: PalaceWalkOrder = 'sequential'
    ) => {
      synth.playClick();
      if (!activeScheme.isLingming) {
        switchScheme(BUILTIN_SCHEMES[0]);
      }
      setPalaceTrainerConfig({ key: chamberKey, mode: trainerMode, order, returnTo: from });
      setGameState('PALACE_TRAINER');
    },
    [activeScheme.isLingming, switchScheme]
  );

  const toggleAutoAdvance = () => {
    setAutoAdvanceEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('inkkey_auto_advance', String(next));
      } catch {
        // Ignore
      }
      if (next) {
        setAutoAdvancePaused(false);
        setAutoAdvanceSec(4);
      }
      return next;
    });
    synth.playClick();
  };

  const handleLaunchChamberDrill = useCallback(
    (
      chamberKey: string | null,
      scope: 'da' | 'root',
      blind = false,
      from: 'PALACE_CLOUD' | 'TITLE_MENU' = 'PALACE_CLOUD'
    ) => {
      if (!activeScheme.isLingming) {
        switchScheme(BUILTIN_SCHEMES[0]);
      }
      setChamberReturnTo(from);
      setChamberXrayMode(null);
      startPlay(
        'reflex',
        chamberKey ? [chamberKey] : [],
        scope,
        blind ? 'blind' : 'adaptive'
      );
    },
    [activeScheme.isLingming, startPlay, switchScheme]
  );

  const handleLaunchChamberXrayDrill = useCallback(
    (
      chamberKey: string | null,
      blind = false,
      from: 'PALACE_CLOUD' | 'TITLE_MENU' = 'PALACE_CLOUD'
    ) => {
      synth.playClick();
      if (!activeScheme.isLingming) {
        switchScheme(BUILTIN_SCHEMES[0]);
      }
      const deck = buildChamberXrayDeck(
        chamberKey,
        scriptMode,
        chamberKey ? 20 : 24
      );
      setChamberReturnTo(from);
      setChamberXrayMode({ active: true, key: chamberKey });
      setFocusKeys(chamberKey ? [chamberKey] : null);
      setMode('reflex');
      setTrainingScope('root');
      setScaffoldMode(blind ? 'blind' : 'adaptive');
      setActiveCustomDeck(deck.length > 0 ? deck : null);
      setCompletedChars(new Set());
      setRoundResult(null);
      setResetSignal((n) => n + 1);
      setGameState('PLAYING');
    },
    [activeScheme.isLingming, scriptMode, switchScheme]
  );

  const singleChamberKey =
    focusKeys && focusKeys.length === 1 && activeScheme.isLingming ? focusKeys[0] : null;
  const nextPalaceKey = singleChamberKey ? getNextPalaceKey(singleChamberKey) : null;

  const nextProgression = useMemo<{
    label: string;
    run: () => void;
  } | null>(() => {
    if (gameState !== 'ROUND_SUMMARY') return null;

    // 1. Memory Palace In-Character X-Ray Challenge cleared
    if (chamberXrayMode?.active) {
      return {
        label: t('換一批隨機漢字再練'),
        run: () =>
          handleLaunchChamberXrayDrill(
            chamberXrayMode.key,
            scaffoldMode === 'blind',
            chamberReturnTo
          ),
      };
    }

    // 2. Single-Key Memory Palace round cleared
    if (singleChamberKey && nextPalaceKey) {
      const nextAnchor = LINGMING_CHAMBER_BY_KEY[nextPalaceKey]?.primaryAnchor || '';
      return {
        label: `${t('下一鍵：')}${nextPalaceKey.toUpperCase()}（${nextAnchor}）`,
        run: () =>
          startPlay(
            'reflex',
            [nextPalaceKey],
            trainingScope,
            scaffoldMode === 'blind' ? 'blind' : 'adaptive'
          ),
      };
    }

    // 3. Free Play progression across depth layers
    if (activeScheme.isLingming) {
      if (mode === 'reflex') {
        if (trainingScope === 'da') {
          return {
            label: t('下一階段：全字根完整碼'),
            run: () => startPlay('reflex', null, 'root'),
          };
        }
        if (trainingScope === 'root') {
          return {
            label: t('下一階段：靈明單字 (自分割)'),
            run: () => startPlay('reflex', null, 'char'),
          };
        }
        if (trainingScope === 'char') {
          return {
            label: t('下一階段：全層自適應'),
            run: () => startPlay('reflex', null, 'all'),
          };
        }
        return {
          label: t('再練一輪：全字根雲圖反射'),
          run: () => startPlay('reflex', null, 'root'),
        };
      }
      if (mode === 'weakkey') {
        return {
          label: t('下一輪：更新弱鍵聚焦'),
          run: () => startPlay('weakkey', null, 'root'),
        };
      }
    }

    return {
      label: t('繼續下一輪'),
      run: () => startPlay(mode, focusKeys),
    };
  }, [
    activeScheme.isLingming,
    chamberReturnTo,
    chamberXrayMode,
    focusKeys,
    gameState,
    handleLaunchChamberXrayDrill,
    mode,
    nextPalaceKey,
    scaffoldMode,
    singleChamberKey,
    startPlay,
    t,
    trainingScope,
  ]);

  const nextProgressionRef = useRef<(() => void) | null>(null);
  nextProgressionRef.current = nextProgression?.run ?? null;
  const hasNextProgression = Boolean(nextProgression);

  useEffect(() => {
    if (
      gameState !== 'ROUND_SUMMARY' ||
      !autoAdvanceEnabled ||
      autoAdvancePaused ||
      !hasNextProgression
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setAutoAdvanceSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => {
            nextProgressionRef.current?.();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameState, autoAdvanceEnabled, autoAdvancePaused, hasNextProgression]);

  // Single-radical / X-ray targets use the centered 1:1 Memory Palace echo;
  // multi-root Chinese characters & Arcade mode use the proportionally bounded flanking KeystrokePalaceCloud.
  const isCenteredPalaceTarget = Boolean(target && (target.palace || target.xray));

  const rawEchoChamberKey = useMemo(() => {
    if (
      !keystrokeCloudEnabled ||
      !activeScheme.isLingming ||
      mode === 'arcade' ||
      !target ||
      !isCenteredPalaceTarget ||
      target.typed.length < 1
    ) {
      return null;
    }
    const candidate = target.palace?.chamberKey || target.code[0];
    return LINGMING_CHAMBER_BY_KEY[candidate] ? candidate : null;
  }, [keystrokeCloudEnabled, activeScheme.isLingming, mode, target, isCenteredPalaceTarget]);

  const rawEchoChar = useMemo(() => {
    if (!target || !rawEchoChamberKey) return null;
    if (target.xray) return target.xray.radicalChar;
    return target.palace ? target.char : target.parts[0] || target.char;
  }, [target, rawEchoChamberKey]);

  useEffect(() => {
    if (rawEchoChamberKey) {
      setEchoMemory({ chamberKey: rawEchoChamberKey, activeChar: rawEchoChar });
    }
  }, [rawEchoChamberKey, rawEchoChar]);

  const showCloudEcho = Boolean(
    keystrokeCloudEnabled && rawEchoChamberKey && gameState === 'PLAYING'
  );

  // Trigger proportional flanking KeystrokePalaceCloud on consonant keystrokes (hit & miss) for multi-root chars & Arcade
  useEffect(() => {
    if (gameState !== 'PLAYING' || !activeScheme.isLingming || !keystrokeCloudEnabled) {
      clearPlayingCloud();
      return;
    }
    const useFlankCloud = mode === 'arcade' || Boolean(target && !isCenteredPalaceTarget);
    if (!useFlankCloud) {
      clearPlayingCloud();
      return;
    }

    const onFlankKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      if (!target) return;
      const letter = e.key.toLowerCase();
      const pos = target.typed.length;
      const expected = target.code[pos];
      if (!expected) return;

      // Only trigger radical palace cloud for 大碼 (the 1st key of a radical); never for 聲碼 or 韻碼
      const daSlot = resolveDaSlotFromRoles(target.code, target.parts, target.roles, pos);
      if (!daSlot) return;

      if (mode === 'arcade') {
        const rawX = (target.stageXRatio ?? 0.5) * 100;
        const rawY = (target.stageYRatio ?? 0.45) * 100;
        setArcadeCloudPos({
          xPct: Math.max(18, Math.min(82, rawX)),
          yPct: Math.max(20, Math.min(78, rawY)),
        });
      }

      if (letter === expected) {
        const isComplete = pos + 1 >= target.code.length;
        triggerPlayingCloud(
          daSlot.chamberKey,
          daSlot.radical,
          'hit',
          letter,
          isComplete ? 1650 : 2100
        );
      } else {
        triggerPlayingCloud(daSlot.chamberKey, daSlot.radical, 'miss', letter, 2600);
      }
    };

    window.addEventListener('keydown', onFlankKeyDown);
    return () => window.removeEventListener('keydown', onFlankKeyDown);
  }, [
    gameState,
    activeScheme.isLingming,
    keystrokeCloudEnabled,
    mode,
    target,
    isCenteredPalaceTarget,
    triggerPlayingCloud,
    clearPlayingCloud,
  ]);

  useEffect(() => {
    if (!showCloudEcho || !rawEchoChamberKey) {
      setEchoPose((prev) => (prev.settled ? { ...prev, settled: false } : prev));
      return;
    }

    let startDx = 0;
    let startDy = 0;
    let startScale = 1;

    if (cloudEchoMotion === 'keyzoom' && stageRef.current) {
      const stageRect = stageRef.current.getBoundingClientRect();
      const keyEl = stageRef.current.querySelector(
        `[data-alice-key="${rawEchoChamberKey}"]`
      ) as HTMLElement | null;
      const targetX = stageRect.width * 0.5;
      const targetY =
        layoutMode === 'depth'
          ? stageRect.height * depthMetrics.centerYRatio + depthMetrics.glyphYOffset
          : stageRect.height * 0.48 - 16;

      if (keyEl) {
        const keyRect = keyEl.getBoundingClientRect();
        const keyCx = keyRect.left - stageRect.left + keyRect.width * 0.5;
        const keyCy = keyRect.top - stageRect.top + keyRect.height * 0.5;
        startDx = keyCx - targetX;
        startDy = keyCy - targetY;
        startScale = 0.08;
      } else {
        startDx = 0;
        startDy = 110;
        startScale = 0.18;
      }
    }

    setEchoPose({ startDx, startDy, startScale, settled: false });

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setEchoPose({ startDx, startDy, startScale, settled: true });
      });
    });

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [showCloudEcho, rawEchoChamberKey, rawEchoChar, cloudEchoMotion, layoutMode, depthMetrics]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'TITLE_MENU') {
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
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startPlay('reflex', null, 'root');
        }
      } else if (gameState === 'PLAYING') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setGameState('PAUSED');
        }
      } else if (gameState === 'PAUSED') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setGameState('PLAYING');
        }
      } else if (gameState === 'ROUND_SUMMARY') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (nextProgressionRef.current) {
            nextProgressionRef.current();
          } else {
            startPlay(mode, focusKeys);
          }
        } else if (e.key === 'Escape' && autoAdvanceEnabled && !autoAdvancePaused) {
          e.preventDefault();
          setAutoAdvancePaused(true);
        }
      } else if (gameState === 'GAME_OVER') {
        if (e.key === 'Enter') {
          e.preventDefault();
          startPlay(mode, focusKeys);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    mode,
    focusKeys,
    startPlay,
    autoAdvanceEnabled,
    autoAdvancePaused,
  ]);

  return (
    <FirebaseErrorBoundary>
    <KeystrokeCloudContext.Provider value={keystrokeCloudCtx}>
    <UiScriptContext.Provider value={uiScript}>
    <ThemeContext.Provider value={themeMode}>
    <div className="dojo-app-shell relative w-screen h-screen overflow-hidden bg-[var(--dojo-canvas)] text-[var(--dojo-text)] flex flex-col">
      {/* Global Xuan-paper texture & ambient ink-wash clouds across ALL views in wash mode */}
      {isWash && (
        <div
          aria-hidden="true"
          className="dojo-ink-paper-bg no-print pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          <svg
            viewBox="0 0 1200 800"
            preserveAspectRatio="none"
            className="dojo-ink-mist-layer absolute inset-0 w-full h-full opacity-[0.62]"
          >
            <defs>
              <radialGradient id="globalInkMistTL" cx="12%" cy="15%" r="44%">
                <stop offset="0%" stopColor="#141413" stopOpacity="0.13" />
                <stop offset="50%" stopColor="#5E5E59" stopOpacity="0.055" />
                <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="globalInkMistBR" cx="88%" cy="86%" r="46%">
                <stop offset="0%" stopColor="#262624" stopOpacity="0.10" />
                <stop offset="48%" stopColor="#52524D" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="globalInkMistTR" cx="86%" cy="16%" r="36%">
                <stop offset="0%" stopColor="#3B3B38" stopOpacity="0.075" />
                <stop offset="55%" stopColor="#6E6E68" stopOpacity="0.032" />
                <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
              </radialGradient>
              <filter id="globalInkCloudBlur" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="26" />
              </filter>
            </defs>
            <ellipse
              cx="120"
              cy="110"
              rx="380"
              ry="220"
              fill="url(#globalInkMistTL)"
              filter="url(#globalInkCloudBlur)"
            />
            <ellipse
              cx="1040"
              cy="125"
              rx="320"
              ry="180"
              fill="url(#globalInkMistTR)"
              filter="url(#globalInkCloudBlur)"
            />
            <ellipse
              cx="1050"
              cy="700"
              rx="420"
              ry="240"
              fill="url(#globalInkMistBR)"
              filter="url(#globalInkCloudBlur)"
            />
            {/* Distant ink-wash mountain & valley mist ridges */}
            <path
              d="M-60 765 Q 165 620, 380 705 T 810 675 T 1260 610 L 1260 840 L -60 840 Z"
              fill="#222220"
              fillOpacity="0.062"
              filter="url(#globalInkCloudBlur)"
            />
            <path
              d="M-40 805 Q 240 695, 510 755 T 1010 700 T 1260 665 L 1260 840 L -40 840 Z"
              fill="#141413"
              fillOpacity="0.045"
              filter="url(#globalInkCloudBlur)"
            />
          </svg>
        </div>
      )}

      {/* ==================== TITLE SCREEN ==================== */}
      {gameState === 'TITLE_MENU' && (
        <div className="relative z-10 w-full h-full overflow-y-auto overflow-x-hidden">
          <div className="relative min-h-full w-full flex flex-col justify-between">
            {!heroImgFailed ? (
              <img
                src={TITLE_ART_URL}
                alt={t('墨鍵道場木質書桌與機械鍵盤')}
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-300 ${
                  isWash ? 'opacity-22 grayscale contrast-95 mix-blend-multiply' : ''
                }`}
              />
            ) : (
              <div
                className={`absolute inset-0 bg-gradient-to-br ${
                  isWash
                    ? 'from-[#F3F1EC]/60 via-[#EAE8E1]/60 to-[#DFDDD5]/60'
                    : 'from-[#121722] via-[#171D29] to-[#0E1218]'
                }`}
              />
            )}

            <div
              className="absolute inset-0 transition-opacity duration-300"
              style={{
                background: isWash
                  ? 'linear-gradient(105deg, rgba(243,241,236,0.94) 0%, rgba(243,241,236,0.86) 52%, rgba(243,241,236,0.46) 86%, rgba(243,241,236,0.22) 100%)'
                  : 'linear-gradient(105deg, rgba(11,14,20,0.96) 0%, rgba(11,14,20,0.86) 52%, rgba(11,14,20,0.34) 84%, rgba(11,14,20,0.20) 100%)',
              }}
            />

            {/* Top bar: quiet identity & essential preferences */}
            <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 sm:px-10 pt-6">
              <div className="flex items-center gap-2.5 text-xs text-[var(--dojo-text-sub)] whitespace-nowrap">
                <span className="text-[var(--dojo-text-bright)] font-medium">
                  {t(activeScheme.shortName)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{t('作家打底道場')}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Script scope toggle: 簡 / 繁 / 雙 */}
                <div
                  role="group"
                  aria-label={t('切換繁簡練字範圍')}
                  className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)]/92 border border-[var(--dojo-border)] backdrop-blur-sm"
                >
                  {SCRIPT_MODE_OPTIONS.map((opt) => {
                    const active = scriptMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          handleChangeScriptMode(opt.id);
                        }}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                            : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                        }`}
                      >
                        {t(opt.short)}
                      </button>
                    );
                  })}
                </div>

                {/* Theme switcher */}
                <div
                  role="group"
                  aria-label={t('切換道場視覺色調')}
                  className="inline-flex items-center p-0.5 rounded-lg bg-[var(--dojo-surface)]/92 border border-[var(--dojo-border)] backdrop-blur-sm"
                >
                  {THEME_OPTIONS.map((opt) => {
                    const active = themeMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleChangeThemeMode(opt.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)] shadow-xs'
                            : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`w-2 h-2 rounded-full border ${
                            opt.id === 'night'
                              ? 'bg-[#121722] border-[#6E788A]'
                              : 'bg-[#F3F1EC] border-[#242422]/75'
                          }`}
                        />
                        <span className="hidden sm:inline">{t(opt.label)}</span>
                        <span className="sm:hidden">{t(opt.short)}</span>
                      </button>
                    );
                  })}
                </div>

                <KeystrokeCloudToggle />

                <button
                  type="button"
                  onClick={toggleSpeech}
                  title={t('開關字根代表性發音朗讀')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    speechEnabled
                      ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/35 text-[var(--dojo-pine-text)]'
                      : 'bg-[var(--dojo-surface)]/90 hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                  }`}
                >
                  <AudioLines className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {t(speechEnabled ? '字根發音：開' : '字根發音：關')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  title={t(muted ? '按鍵音效：已關閉（點擊開啟）' : '按鍵音效：已開啟（點擊靜音）')}
                  aria-label={t(muted ? '開啟按鍵音效' : '關閉按鍵音效')}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--dojo-surface)]/90 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] transition-colors shrink-0 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </header>

            {/* Center: Brand Seal + Two Calm Writer Pillars */}
            <div className="relative z-10 w-full max-w-5xl mx-auto px-6 sm:px-10 py-8 my-auto">
              <div className="mb-8 wash-enter">
                <svg
                  viewBox="0 0 460 92"
                  className="w-full max-w-[400px] h-auto"
                  aria-label={t('墨鍵道場 · 靈明輸入法記憶宮殿與拆字')}
                >
                  <rect
                    x="2"
                    y="12"
                    width="54"
                    height="54"
                    rx="6"
                    fill={isWash ? '#181817' : '#C93E2D'}
                    stroke={isWash ? '#383834' : '#E8715F'}
                    strokeWidth="1.5"
                  />
                  <rect
                    x="7"
                    y="17"
                    width="44"
                    height="44"
                    rx="3"
                    fill="none"
                    stroke={isWash ? '#F3F1EC' : '#F5EFE6'}
                    strokeOpacity="0.65"
                    strokeWidth="1"
                  />
                  <text
                    x="29"
                    y="48"
                    textAnchor="middle"
                    fill={isWash ? '#F8F7F3' : '#F7F3EC'}
                    fontSize="26"
                    fontWeight="700"
                    fontFamily="'Noto Serif TC', serif"
                  >
                    {t('靈')}
                  </text>

                  <text
                    x="74"
                    y="50"
                    fill={isWash ? '#141413' : '#F6F2EA'}
                    fontSize="44"
                    fontWeight="700"
                    letterSpacing="4"
                    fontFamily="'Noto Serif TC', serif"
                  >
                    {t('墨鍵道場')}
                  </text>

                  <line
                    x1="74"
                    y1="66"
                    x2="128"
                    y2="66"
                    stroke={isWash ? '#444440' : '#D89B3C'}
                    strokeWidth="1.5"
                  />
                  <text
                    x="138"
                    y="70"
                    fill={isWash ? '#52524E' : '#B8B0A0'}
                    fontSize="13"
                    letterSpacing="1.6"
                    fontFamily="'Plus Jakarta Sans', sans-serif"
                  >
                    {t('記憶宮殿建形 · 拆字原則通理 · 作家無擾打底')}
                  </text>
                </svg>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 wash-enter-soft">
                {/* Pillar 01: Memory Palace & Cloud Muscle Reflex */}
                <section
                  aria-labelledby="pillar-palace-title"
                  className={`flex flex-col justify-between gap-5 p-6 rounded-2xl border backdrop-blur-md transition-colors ${
                    isWash
                      ? 'bg-[#F9F8F5]/94 border-[#141413]/15 text-[#141413] shadow-sm'
                      : 'bg-[#121824]/90 border-[#F2EEE6]/14 text-[#F2EEE6]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-[var(--dojo-ochre)] mb-2">
                      <span>01 · {t('建立字根空間形感')}</span>
                      <span>{t('手眼直覺')}</span>
                    </div>
                    <h2
                      id="pillar-palace-title"
                      className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]"
                    >
                      {t('記憶宮殿 · 雲圖肌肉反射')}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--dojo-text-sub)]">
                      {t('以象形筆畫建立 25 鍵空間記憶宮殿，落指即現雲圖。不追速率與積分，只把字根分布刻入肌肉。')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => startPlay('reflex', null, 'root')}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] active:scale-[0.995] text-white rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2.5 text-base font-bold whitespace-nowrap">
                        <Play className="w-4 h-4 fill-current shrink-0" />
                        <span>{t('開始雲圖肌肉反射')}</span>
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openPalaceTrainer('q', 'template', 'TITLE_MENU', 'sequential')}
                        title={t('沿字根雲圖結構逐根移動焦點打字，確立各字根相對於主根的大致方位')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-ochre)]/45 bg-[var(--dojo-ochre-wash)] hover:opacity-90 text-[var(--dojo-ochre)] transition-opacity whitespace-nowrap cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('雲圖循序打字')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPalaceTrainer('q', 'variant_cloud', 'TITLE_MENU', 'sequential')}
                        title={t('維持原雲圖空間排布，隨機替換包含分支字根與變形根的漢字並高亮筆畫')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-pine)]/45 bg-[var(--dojo-pine-wash)] hover:opacity-90 text-[var(--dojo-pine-text)] transition-opacity whitespace-nowrap cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('萬象變根漢字雲圖')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPalaceTrainer('q', 'template', 'TITLE_MENU', 'cross_key_jump')}
                        title={t('高難度進階：跨 20 個宮殿隨機跳躍打亂字根，切換對應宮殿雲圖測試方位直覺')}
                        className="col-span-2 inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-crimson)]/40 bg-[var(--dojo-crimson-wash)] hover:opacity-90 text-[var(--dojo-crimson-text)] transition-opacity whitespace-nowrap cursor-pointer"
                      >
                        <Target className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('跨鍵跳躍 · 隨機亂序雲圖測試')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setGameState('TOPOLOGICAL_PALACE');
                        }}
                        title={t('以書法拓撲筆勢作為記憶宮殿行進路線，將全部 249 個簡體字根按起勢與聲韻順序排布並支援實鍵閉環練習')}
                        className="col-span-2 inline-flex items-center justify-between gap-3 px-4 py-3 text-xs font-semibold rounded-lg border border-[var(--dojo-crimson)]/50 bg-[var(--dojo-crimson-wash)] hover:opacity-92 text-[var(--dojo-crimson-text)] transition-opacity cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Compass className="w-4 h-4 shrink-0" />
                          <span>{t('筆勢行徑 · 新拓撲記憶宮殿')}</span>
                        </span>
                        <span className="text-[11px] font-mono-tabular opacity-85 whitespace-nowrap">
                          {t('20 宮 249 根 · 起勢＋聲韻')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setGameState('TWENTY_KEY_THEATER');
                        }}
                        title={t('完整收錄靈明 20 個輔音鍵的書法拓撲演變動畫與運指方向圖，支援實鍵試筆與臨帖行氣')}
                        className="col-span-2 inline-flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <Feather className="w-4 h-4 text-[var(--dojo-crimson)] shrink-0" />
                          <span>{t('二十筆勢 · 書法拓撲演變劇場')}</span>
                        </span>
                        <span className="text-[11px] font-mono-tabular text-[var(--dojo-text-sub)] whitespace-nowrap">
                          {t('20 鍵 82 根水墨動畫')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPalaceCloud('TITLE_MENU', 'keyboard')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5 text-[var(--dojo-ochre)] shrink-0" />
                        <span>{t('25 鍵宮殿圖譜')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openPalaceCloud('TITLE_MENU', 'atlas')}
                        title={t('以十指上下姿勢鏈與動作感覺圖示記憶 26 鍵位置')}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-pine)]/40 bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[var(--dojo-pine)] shrink-0" />
                        <span>{t('指尖動作圖示')}</span>
                      </button>

                      <div className="col-span-2 grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleLaunchChamberXrayDrill(null, false, 'TITLE_MENU')}
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <ScanSearch className="w-3.5 h-3.5 text-[var(--dojo-pine)] shrink-0" />
                          <span>{t('字中辨根')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => startPlay('weakkey', null, 'root')}
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Target className="w-3.5 h-3.5 text-[var(--dojo-crimson)] shrink-0" />
                          <span>{t('弱點字根聚焦')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => startPlay('reflex', null, 'char')}
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5 text-[var(--dojo-text-sub)] shrink-0" />
                          <span>{t('整字自分割練習')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Pillar 02: Character Decomposition Principles & Lookup */}
                <section
                  aria-labelledby="pillar-split-title"
                  className={`flex flex-col justify-between gap-5 p-6 rounded-2xl border backdrop-blur-md transition-colors ${
                    isWash
                      ? 'bg-[#F9F8F5]/94 border-[#141413]/15 text-[#141413] shadow-sm'
                      : 'bg-[#121824]/90 border-[#F2EEE6]/14 text-[#F2EEE6]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs font-mono-tabular text-[var(--dojo-pine-text)] mb-2">
                      <span>02 · {t('通曉拆字理則')}</span>
                      <span>{t('查碼即練')}</span>
                    </div>
                    <h2
                      id="pillar-split-title"
                      className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]"
                    >
                      {t('拆字原則 · 彩墨通理與查碼')}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--dojo-text-sub)]">
                      {t('掌握「順筆取根、取大優先、四碼封頂、簡碼直上」四則；隨時查驗單字拆法並以散文短句實感過渡。')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setSubDojoReturnTo('TITLE_MENU');
                        setDecompositionTab('rules');
                        setGameState('DECOMPOSITION_LAB');
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 active:scale-[0.995] border rounded-xl transition-all cursor-pointer ${
                        isWash
                          ? 'bg-[#181817] hover:bg-[#2C2C2A] border-[#181817] text-[#F8F7F3] shadow-sm'
                          : 'bg-[var(--dojo-pine)] hover:brightness-110 border-[var(--dojo-pine)] text-white shadow-md'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2.5 text-base font-bold whitespace-nowrap">
                        <BookOpen className="w-4 h-4 shrink-0" />
                        <span>{t('拆字原則與查碼試練')}</span>
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setSubDojoReturnTo('TITLE_MENU');
                          setDecompositionTab('lookup');
                          setGameState('DECOMPOSITION_LAB');
                        }}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5 text-[var(--dojo-ochre)] shrink-0" />
                        <span>{t('查字拆碼')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setSubDojoReturnTo('TITLE_MENU');
                          setDecompositionTab('check');
                          setGameState('DECOMPOSITION_LAB');
                        }}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[var(--dojo-pine)] shrink-0" />
                        <span>{t('通理自測 (12字)')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setSubDojoReturnTo('TITLE_MENU');
                          setDrillLaunchPreset({ tab: 'hardsplit' });
                          setGameState('DRILL_STUDIO');
                        }}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5 text-[var(--dojo-ochre)] shrink-0" />
                        <span>{t('彩墨實戰短文')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setSubDojoReturnTo('TITLE_MENU');
                          setGameState('HUANGTING_DOJO');
                        }}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <ScrollText className="w-3.5 h-3.5 text-[var(--dojo-text-sub)] shrink-0" />
                        <span>{t('靜心抄經試寫')}</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Clean writer pure-shape single-key studio entry */}
              <div className="mt-5 rounded-xl border border-[var(--dojo-border)] bg-[var(--dojo-surface)] wash:bg-[var(--dojo-surface)]/92 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono-tabular text-[var(--dojo-ochre)]">
                      {t('作家純形單鍵工坊')}
                    </span>
                    <span className="text-[var(--dojo-text-muted)]">·</span>
                    <span className="text-[var(--dojo-text-sub)]">
                      {t('25 鍵無 X · 零並擊零音托 · 四碼定長 100% 自分割')}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--dojo-text)]">
                    {t('素形單鍵 · 臨紙試寫與自由起草台')}
                    <span className="text-xs text-[var(--dojo-text-muted)] ml-2">
                      {t('專為普通實體鍵盤設計，75% 左右交替，可直接試寫散文並反查 1,067 簡體字四碼')}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setGameState('WRITER_SINGLE_KEY');
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Keyboard className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('進入素形單鍵試寫')}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setGameState('KINETIC_LAB');
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('並擊對照實驗室')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quiet writer philosophy footer */}
            <footer className="relative z-10 px-6 sm:px-10 pb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--dojo-text-muted)]">
              <span>
                {t('熟習字根雲圖分布與拆字法則後，即可在 Obsidian 裡直接以原輸入法自然書寫 · 貴在知行合一')}
              </span>
              <span className="hidden sm:inline font-mono-tabular">
                {t('Enter / Space 開始雲圖肌肉反射')}
              </span>
            </footer>
          </div>
        </div>
      )}

      {/* ==================== DECOMPOSITION PRINCIPLES & LOOKUP LAB ==================== */}
      {gameState === 'DECOMPOSITION_LAB' && (
        <DecompositionLab
          initialTab={decompositionTab}
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState('TITLE_MENU')}
          onOpenDrillStudio={() => {
            setSubDojoReturnTo('DECOMPOSITION_LAB');
            setDrillLaunchPreset({ tab: 'hardsplit' });
            setGameState('DRILL_STUDIO');
          }}
          onOpenHuangtingDojo={() => {
            setSubDojoReturnTo('DECOMPOSITION_LAB');
            setGameState('HUANGTING_DOJO');
          }}
        />
      )}

      {/* ==================== INTERACTIVE MEMORY PALACE CLOUD VIEW ==================== */}
      {gameState === 'PALACE_CLOUD' && (
        <MemoryPalaceCloud
          mastery={mastery}
          chamberPasses={campaignProgress.chambers}
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          onChangeThemeMode={handleChangeThemeMode}
          speechEnabled={speechEnabled}
          onToggleSpeech={toggleSpeech}
          initialMapView={palaceMapInitialView}
          onBack={() => setGameState(returnStateFromPalace)}
          onLaunchChamberDrill={(key, scope, blind) =>
            handleLaunchChamberDrill(key, scope, blind, 'PALACE_CLOUD')
          }
          onLaunchChamberXrayDrill={(key, blind) =>
            handleLaunchChamberXrayDrill(key, blind, 'PALACE_CLOUD')
          }
          onLaunchCloudTrainer={(key, trainerMode) =>
            openPalaceTrainer(key, trainerMode, 'PALACE_CLOUD')
          }
        />
      )}

      {/* ==================== VISUAL FOCUS CLOUD TRAINER (TEMPLATE & VARIANT-HANZI CLOUD) ==================== */}
      {gameState === 'PALACE_TRAINER' && (
        <PalaceCloudTrainer
          initialKey={palaceTrainerConfig.key}
          initialMode={palaceTrainerConfig.mode}
          initialOrder={palaceTrainerConfig.order}
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          speechEnabled={speechEnabled}
          onToggleSpeech={toggleSpeech}
          onBack={() => setGameState(palaceTrainerConfig.returnTo)}
        />
      )}

      {/* ==================== WENXIN LIVE PRACTICE STUDIO ==================== */}
      {gameState === 'DRILL_STUDIO' && (
        <ExtremeDrillStudio
          mastery={mastery}
          onMasteryChange={handleMasteryChange}
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState(subDojoReturnTo)}
          initialTab={drillLaunchPreset.tab}
          initialCustomText={drillLaunchPreset.customText}
          initialOpenPaste={drillLaunchPreset.openPaste}
        />
      )}

      {/* ==================== HUANGTING JING SCRIPTURE TRANSCRIPTION DOJO ==================== */}
      {gameState === 'HUANGTING_DOJO' && (
        <HuangtingDojo
          mastery={mastery}
          onMasteryChange={handleMasteryChange}
          defaultScript={scriptMode === 'simp' ? 'simp' : 'trad'}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState(subDojoReturnTo)}
        />
      )}

      {/* ==================== KINETIC HOME-ROW ALTERNATION VERIFICATION LAB ==================== */}
      {gameState === 'KINETIC_LAB' && (
        <KineticVerificationLab
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState('TITLE_MENU')}
        />
      )}

      {/* ==================== WRITER SINGLE-KEY PURE-SHAPE STUDIO ==================== */}
      {gameState === 'WRITER_SINGLE_KEY' && (
        <WriterSingleKeyStudio
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState('TITLE_MENU')}
          onOpenChordLab={() => setGameState('KINETIC_LAB')}
        />
      )}

      {/* ==================== NEW TOPOLOGICAL BRUSH-PATH MEMORY PALACE ==================== */}
      {gameState === 'TOPOLOGICAL_PALACE' && (
        <TopologicalJourneyPalace
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          initialKey={topoFocusKey}
          onOpenMorphTheater={(k) => {
            setTopoFocusKey(k);
            setGameState('TWENTY_KEY_THEATER');
          }}
          onOpenLegacyPalace={() => openPalaceCloud('TITLE_MENU', 'keyboard')}
          onBackToDojo={() => setGameState('TITLE_MENU')}
        />
      )}

      {/* ==================== TWENTY-KEY CALLIGRAPHY TOPOLOGY EXHIBITION THEATER ==================== */}
      {gameState === 'TWENTY_KEY_THEATER' && (
        <TwentyKeyTopologyTheater
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          initialKey={topoFocusKey}
          onOpenMuscleTrainer={(k, order = 'sequential') => {
            setTopoFocusKey(k);
            setTopoTrainerOrder(order);
            setGameState('TOPOLOGY_TRAINER');
          }}
          onOpenTopologicalPalace={(k) => {
            setTopoFocusKey(k);
            setGameState('TOPOLOGICAL_PALACE');
          }}
          onOpenPracticeStudio={() => setGameState('CALLIGRAPHY_TOPOLOGY')}
          onBackToDojo={() => setGameState('TITLE_MENU')}
        />
      )}

      {/* ==================== TWENTY-KEY TOPOLOGY MUSCLE-MEMORY TRAINER ==================== */}
      {gameState === 'TOPOLOGY_TRAINER' && (
        <TopologyMuscleTrainer
          initialKey={topoFocusKey}
          initialOrder={topoTrainerOrder}
          scriptMode={scriptMode}
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBackToTheater={(k) => {
            setTopoFocusKey(k);
            setGameState('TWENTY_KEY_THEATER');
          }}
        />
      )}

      {/* ==================== CALLIGRAPHY TOPOLOGY PRACTICE & FREE-BRUSH STUDIO ==================== */}
      {gameState === 'CALLIGRAPHY_TOPOLOGY' && (
        <CalligraphyTopologyStudio
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState('TWENTY_KEY_THEATER')}
        />
      )}

      {/* ==================== ACTIVE PLAY SHELL ==================== */}
      {gameState !== 'TITLE_MENU' &&
        gameState !== 'DECOMPOSITION_LAB' &&
        gameState !== 'PALACE_CLOUD' &&
        gameState !== 'PALACE_TRAINER' &&
        gameState !== 'DRILL_STUDIO' &&
        gameState !== 'HUANGTING_DOJO' &&
        gameState !== 'KINETIC_LAB' &&
        gameState !== 'WRITER_SINGLE_KEY' &&
        gameState !== 'CALLIGRAPHY_TOPOLOGY' &&
        gameState !== 'TWENTY_KEY_THEATER' &&
        gameState !== 'TOPOLOGY_TRAINER' &&
        gameState !== 'TOPOLOGICAL_PALACE' && (
        <div className="relative z-10 w-full h-full flex flex-col">
          {/* Compact low-occlusion perimeter HUD */}
          <header className="shrink-0 h-12 px-4 sm:px-6 bg-[var(--dojo-header)] wash:bg-[var(--dojo-header)]/88 wash:backdrop-blur-sm border-b border-[var(--dojo-border)] flex items-center justify-between gap-3 z-30">
            <div className="flex items-center gap-2 text-xs min-w-0 overflow-hidden">
              {chamberXrayMode?.active ? (
                <>
                  <span className="font-display text-sm font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
                    {chamberXrayMode.key
                      ? `${chamberXrayMode.key.toUpperCase()} ${t('鍵宮殿')}（${
                          LINGMING_CHAMBER_BY_KEY[chamberXrayMode.key]?.primaryAnchor || ''
                        }）· ${t('字中辨根')}`
                      : t('全宮殿隨機字中辨根')}
                  </span>
                  <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                  <span className="text-[var(--dojo-ochre)] truncate">
                    {t('僅輸入高亮筆畫字根全碼')} · {t(SCRIPT_MODE_LABELS[scriptMode])}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-display text-sm font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
                    {singleChamberKey
                      ? `${singleChamberKey.toUpperCase()} ${t('鍵宮殿')}（${
                          LINGMING_CHAMBER_BY_KEY[singleChamberKey]?.primaryAnchor || ''
                        }）`
                      : t(MODE_OPTIONS.find((m) => m.id === mode)?.label ?? '記憶宮殿反射')}
                  </span>
                  <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                  <span className="text-[var(--dojo-text-sub)] truncate">
                    {singleChamberKey ? t('逐鍵巡禮') : t(activeScheme.shortName)}
                  </span>
                  {activeScheme.isLingming && singleChamberKey && (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[var(--dojo-text-muted)]">·</span>
                      <span className="hidden md:inline text-[var(--dojo-pine-text)] whitespace-nowrap">
                        {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  )}
                  {activeScheme.isLingming && !singleChamberKey && (
                    <>
                      <span aria-hidden="true" className="hidden md:inline shrink-0 text-[var(--dojo-text-muted)]">·</span>
                      <span className="hidden md:inline text-[var(--dojo-ochre)] truncate">
                        {t(SCOPE_OPTIONS.find((s) => s.id === trainingScope)?.label ?? '')}
                      </span>
                      <span aria-hidden="true" className="hidden xl:inline shrink-0 text-[var(--dojo-text-muted)]">·</span>
                      <span className="hidden xl:inline shrink-0 text-[var(--dojo-pine-text)] whitespace-nowrap">
                        {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Quiet writer telemetry meters */}
            <div className="shrink-0 flex items-center gap-3 xl:gap-4 text-xs font-mono-tabular whitespace-nowrap">
              <div className="hidden sm:flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[var(--dojo-text-muted)] font-sans">{t('均鍵')}</span>
                <span className="text-sm font-semibold text-[var(--dojo-text)]">
                  {hud.avgKeyMs > 0 ? `${hud.avgKeyMs}ms` : '--'}
                </span>
              </div>

              <div className="hidden md:flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[var(--dojo-text-muted)] font-sans">{t('準確')}</span>
                <span className="text-sm font-semibold text-[var(--dojo-pine-text)]">{hud.accuracy}%</span>
              </div>

              <div className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[var(--dojo-text-muted)] font-sans">{t('進度')}</span>
                <span className="text-sm font-semibold text-[var(--dojo-text-bright)]">
                  {hud.cleared}/{hud.targetGoal}
                </span>
              </div>
            </div>

            {/* Right: Functional controls including instant Depth/Split A-B & Theme comparison */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleLayoutMode}
                title={t('即時對比「疊層景深零掃視」與「上下分區」')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--dojo-text)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border-strong)] rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#3B7CC4] wash:text-[#181817]" />
                <span className="hidden lg:inline">
                  {t(layoutMode === 'depth' ? 'Alice 景深' : '上下分區')}
                </span>
              </button>

              {activeScheme.isLingming && <KeystrokeCloudToggle compact />}

              {activeScheme.isLingming && (
                <button
                  type="button"
                  onClick={() => openPalaceCloud('PLAYING')}
                  title={t('查看筆畫鍵位雲圖記憶宮殿')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--dojo-ochre)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-ochre)]/35 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                  <span className="hidden sm:inline">{t('雲圖')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleHideCodeHints}
                title={t(hideCodeHints ? '目前隱藏下方鍵碼槽（按 Tab 可臨時偷看），點擊顯示' : '隱藏下方鍵位編碼槽，保持極簡勿打擾')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  hideCodeHints
                    ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                    : 'bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t(hideCodeHints ? '鍵碼隱藏' : '顯示鍵碼')}</span>
              </button>

              {activeScheme.isLingming && (
                <button
                  type="button"
                  onClick={toggleCloudEchoMotion}
                  title={t('切換背景雲圖出場方式：原地漸顯（極簡勿打擾） vs 從背景 Alice 鍵位放大到前螢幕')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--dojo-pine)]" />
                  <span className="hidden xl:inline">
                    {t(cloudEchoMotion === 'fade' ? '雲圖漸顯' : '鍵位放大')}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={cycleScaffold}
                title={t('切換漸隱 / 默背模式')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                {scaffoldMode === 'blind' ? (
                  <EyeOff className="w-3.5 h-3.5 text-[var(--dojo-pine)]" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-[var(--dojo-ochre)]" />
                )}
                <span className="hidden xl:inline">{t(SCAFFOLD_LABELS[scaffoldMode])}</span>
              </button>

              <button
                type="button"
                onClick={() => setHintPulseTick((n) => n + 1)}
                title={t('瞬間拉焦顯示提示 (Tab)')}
                className="px-2.5 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                {t('拉焦')}
              </button>

              {/* Compact theme toggle inside active play */}
              <div
                role="group"
                aria-label={t('切換道場視覺色調')}
                className="hidden sm:inline-flex items-center p-0.5 rounded-md border border-[var(--dojo-border)] bg-[var(--dojo-surface)]"
              >
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChangeThemeMode(opt.id)}
                    title={t(opt.label)}
                    className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                      themeMode === opt.id
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-text-bright)]'
                        : 'text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    {t(opt.short)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleSpeech}
                title={t(speechEnabled ? '關閉字根發音朗讀' : '開啟字根發音朗讀')}
                aria-label={t(speechEnabled ? '關閉字根發音' : '開啟字根發音')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  speechEnabled
                    ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                    : 'bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                }`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t(speechEnabled ? '發音開' : '發音關')}</span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                title={t(muted ? '按鍵音效：已關閉（點擊開啟）' : '按鍵音效：已開啟（點擊靜音）')}
                aria-label={t(muted ? '開啟按鍵音效' : '關閉按鍵音效')}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() =>
                  setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'))
                }
                aria-label={t('暫停')}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] hover:bg-[var(--dojo-surface-2)] transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ==================== UNIFIED STAGE ==================== */}
          <main ref={stageRef} className="flex-1 min-h-0 relative overflow-hidden bg-[var(--dojo-canvas)] wash:bg-transparent">
            {/* Layer 0: Alice Split Keyboard backdrop */}
            {layoutMode === 'depth' && (
              <div className="absolute inset-0 z-10 wash-enter">
                <BlurredKeyboardBackdrop
                  scheme={activeScheme}
                  target={target}
                  mastery={mastery}
                />
              </div>
            )}

            {/* Layer 1: Reactive Key-1 Memory Palace Cloud Stimulus — pure原地漸顯 / 水墨暈染 or Alice 鍵位放大 */}
            {activeScheme.isLingming && mode !== 'arcade' && echoMemory && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 z-[15] flex items-center justify-center will-change-transform"
                style={{
                  top:
                    layoutMode === 'depth'
                      ? `calc(${depthMetrics.centerYRatio * 100}% + ${depthMetrics.glyphYOffset}px)`
                      : 'calc(48% - 16px)',
                  width: layoutMode === 'depth' ? `${depthMetrics.echoBoxSize}px` : '560px',
                  height: layoutMode === 'depth' ? `${depthMetrics.echoBoxSize}px` : '560px',
                  opacity: !showCloudEcho ? 0 : echoPose.settled ? 1 : cloudEchoMotion === 'keyzoom' ? 0.08 : 0,
                  filter: isWash
                    ? !showCloudEcho
                      ? 'blur(4px)'
                      : echoPose.settled
                        ? 'blur(0px)'
                        : 'blur(6px)'
                    : 'none',
                  transform:
                    !showCloudEcho || echoPose.settled || cloudEchoMotion === 'fade'
                      ? 'translate(-50%, -50%) scale(1)'
                      : `translate(calc(-50% + ${echoPose.startDx.toFixed(1)}px), calc(-50% + ${echoPose.startDy.toFixed(1)}px)) scale(${echoPose.startScale})`,
                  transition: !showCloudEcho
                    ? isWash
                      ? 'opacity 160ms ease-out, filter 160ms ease-out'
                      : 'opacity 140ms ease-out'
                    : echoPose.settled
                      ? cloudEchoMotion === 'keyzoom'
                        ? isWash
                          ? 'opacity 280ms ease-out, filter 320ms ease-out, transform 340ms cubic-bezier(0.16, 1, 0.3, 1)'
                          : 'opacity 250ms ease-out, transform 340ms cubic-bezier(0.16, 1, 0.3, 1)'
                        : isWash
                          ? 'opacity 300ms ease-out, filter 340ms ease-out'
                          : 'opacity 260ms ease-out'
                      : 'none',
                }}
              >
                <StrokeCloudStage
                  chamberKey={echoMemory.chamberKey}
                  activeChar={echoMemory.activeChar}
                  variant="echo"
                  scriptMode={scriptMode}
                  anchorOnActive
                />
              </div>
            )}

            {/* Layer 1B: 100% Target-Coincident Palace Cloud for Multi-Root Characters & Arcade */}
            {activeScheme.isLingming && keystrokeCloudEnabled && (
              <KeystrokePalaceCloud
                pulse={playingCloudPulse.pulse}
                visible={playingCloudPulse.visible && gameState === 'PLAYING'}
                scriptMode={scriptMode}
                placement="coincident"
                boxPx={
                  mode === 'arcade'
                    ? 340
                    : layoutMode === 'depth'
                      ? depthMetrics.echoBoxSize
                      : 460
                }
                className="absolute -translate-x-1/2 -translate-y-1/2 z-[16]"
                style={
                  mode === 'arcade'
                    ? {
                        left: `${arcadeCloudPos.xPct.toFixed(1)}%`,
                        top: `${arcadeCloudPos.yPct.toFixed(1)}%`,
                      }
                    : {
                        left: '50%',
                        top:
                          layoutMode === 'depth'
                            ? `calc(${depthMetrics.centerYRatio * 100}% + ${depthMetrics.glyphYOffset}px)`
                            : 'calc(48% - 16px)',
                      }
                }
              />
            )}

            {/* Layer 2 (Foreground · High-contrast 60fps Interactive Canvas) */}
            <div className="relative z-20 w-full h-full">
              <GameCanvas
                scheme={activeScheme}
                mode={mode}
                layoutMode={layoutMode}
                trainingScope={trainingScope}
                paused={gameState !== 'PLAYING'}
                scaffoldMode={scaffoldMode}
                hideCodeHints={hideCodeHints}
                focusKeys={focusKeys}
                customDeck={activeCustomDeck}
                scriptMode={scriptMode}
                masteryRef={masteryRef}
                onMasteryChange={handleMasteryChange}
                onHudUpdate={setHud}
                onTargetUpdate={setTarget}
                onGlyphCleared={handleGlyphCleared}
                onRoundEnd={handleRoundEnd}
                virtualKeyEvent={virtualKeyEvent}
                hintPulseTick={hintPulseTick}
                resetSignal={resetSignal}
              />
            </div>

            {/* Layer 3: Curve-Driven Rhythm Metronome & Invisible Beat Track */}
            <RhythmMetronome
              mastery={mastery}
              liveCpm={hud.cpm}
              trainingScope={trainingScope}
              paused={gameState !== 'PLAYING'}
              lastStrikeTick={target?.lastStrikeTick ?? 0}
              lastStrikeCorrect={target?.lastStrikeCorrect ?? true}
            />
          </main>

          {/* SPLIT MODE ONLY: Classic bottom mechanical keyboard */}
          {layoutMode === 'split' && (
            <div className="shrink-0 z-30">
              <TactileKeyboard
                scheme={activeScheme}
                target={target}
                mastery={mastery}
                onVirtualKey={(key) =>
                  setVirtualKeyEvent({ key, tick: performance.now() })
                }
              />
            </div>
          )}
        </div>
      )}

      {/* ==================== PAUSE MODAL ==================== */}
      {gameState === 'PAUSED' && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${
            isWash ? 'bg-[#141413]/35 backdrop-blur-[2px]' : 'bg-black/72'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={t('暫停鍛煉')}
        >
          <div className="wash-enter w-full max-w-md max-h-[90vh] overflow-y-auto bg-[var(--dojo-surface)] wash:bg-[#F5F3EE]/96 border border-[var(--dojo-border)] rounded-xl p-6 shadow-2xl wash:shadow-[0_18px_50px_rgba(20,20,18,0.18)]">
            <h2 className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]">{t('暫停鍛煉')}</h2>
            <p className="text-xs text-[var(--dojo-text-sub)] mt-1">
              {`${t(activeScheme.name)} · ${t(layoutMode === 'depth' ? '疊層景深（零掃視）' : '上下分區')}`}
            </p>

            <div className="grid grid-cols-3 gap-3 my-5 py-4 border-y border-[var(--dojo-border)] text-center font-mono-tabular">
              <div>
                <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('已完成')}</div>
                <div className="text-lg font-bold text-[var(--dojo-text-bright)] mt-0.5">
                  {hud.cleared}/{hud.targetGoal}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('準確率')}</div>
                <div className="text-lg font-bold text-[var(--dojo-pine)] mt-0.5">{hud.accuracy}%</div>
              </div>
              <div>
                <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('均鍵延遲')}</div>
                <div className="text-lg font-bold text-[var(--dojo-ochre)] mt-0.5">
                  {hud.avgKeyMs > 0 ? `${hud.avgKeyMs}ms` : '--'}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs text-[var(--dojo-text-sub)] mb-2">{t('道場視覺色調')}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChangeThemeMode(opt.id)}
                    className={`py-2 px-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                      themeMode === opt.id
                        ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                        : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-2 h-2 rounded-full border ${
                        opt.id === 'night'
                          ? 'bg-[#121722] border-[#6E788A]'
                          : 'bg-[#F3F1EC] border-[#242422]/75'
                      }`}
                    />
                    <span>{t(opt.label)}</span>
                  </button>
                ))}
              </div>
            </div>

            {!singleChamberKey && !chamberXrayMode?.active && (
              <div className="mb-4">
                <div className="text-xs text-[var(--dojo-text-sub)] mb-2">{t('切換練習方式')}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => startPlay(opt.id, null, trainingScope)}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        mode === opt.id
                          ? 'bg-[var(--dojo-crimson-wash)] border-[var(--dojo-crimson)]/70 text-[var(--dojo-text-bright)]'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeScheme.isLingming && !singleChamberKey && !chamberXrayMode?.active && (
              <div className="mb-4">
                <div className="text-xs text-[var(--dojo-text-sub)] mb-2">{t('切換靈明訓練層級')}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SCOPE_OPTIONS.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => startPlay(mode, focusKeys, sc.id)}
                      className={`py-2 px-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        trainingScope === sc.id
                          ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)] text-[var(--dojo-text-bright)]'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t(sc.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeScheme.isLingming && (
              <div className="mb-4">
                <div className="text-xs text-[var(--dojo-text-sub)] mb-2">
                  {t('繁簡訓練範圍（字根與拆字同步分流）')}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SCRIPT_MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        handleChangeScriptMode(opt.id, true);
                      }}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        scriptMode === opt.id
                          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/55 text-[var(--dojo-pine-text)]'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t(opt.short)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setGameState('PLAYING')}
                className="w-full py-2.5 text-sm font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors cursor-pointer"
              >
                {t('繼續鍛煉')}
              </button>
              <button
                type="button"
                onClick={() => openPalaceCloud('PLAYING')}
                className="w-full py-2.5 text-sm font-medium bg-[var(--dojo-surface-2)] hover:brightness-105 border border-[var(--dojo-ochre)]/35 text-[var(--dojo-ochre)] rounded-lg transition-colors cursor-pointer"
              >
                {t('開啟筆畫鍵位雲圖 · 記憶宮殿')}
              </button>
              <button
                type="button"
                onClick={() =>
                  chamberXrayMode?.active
                    ? handleLaunchChamberXrayDrill(
                        chamberXrayMode.key,
                        scaffoldMode === 'blind',
                        chamberReturnTo
                      )
                    : startPlay(mode, focusKeys)
                }
                className="w-full py-2.5 text-sm font-medium bg-[var(--dojo-surface-2)] hover:brightness-105 text-[var(--dojo-text)] rounded-lg transition-colors cursor-pointer"
              >
                {t(chamberXrayMode?.active ? '換一批隨機漢字重練' : '重新開始本輪')}
              </button>
              {(singleChamberKey || chamberXrayMode?.active) && chamberReturnTo === 'PALACE_CLOUD' && (
                <button
                  type="button"
                  onClick={() => setGameState('PALACE_CLOUD')}
                  className="w-full py-2.5 text-xs font-medium bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] rounded-lg transition-colors cursor-pointer"
                >
                  {t('返回記憶宮殿雲圖')}
                </button>
              )}
              <button
                type="button"
                onClick={toggleHideCodeHints}
                className={`w-full py-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  hideCodeHints
                    ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                    : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                }`}
              >
                {t(hideCodeHints ? '下方鍵位提示：已隱藏（極簡勿打擾，按 Tab 偷看）' : '下方鍵位提示：已顯示（點擊隱藏）')}
              </button>
              {activeScheme.isLingming && (
                <button
                  type="button"
                  onClick={toggleCloudEchoMotion}
                  className="w-full py-2.5 text-xs font-medium rounded-lg border bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] transition-colors cursor-pointer"
                >
                  {t(
                    cloudEchoMotion === 'fade'
                      ? '背景雲圖出場：原地漸顯（點擊切換為從 Alice 鍵位放大）'
                      : '背景雲圖出場：從 Alice 鍵位放大（點擊切換為原地漸顯）'
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={toggleSpeech}
                className={`w-full py-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  speechEnabled
                    ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/45 text-[var(--dojo-pine-text)]'
                    : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                }`}
              >
                {t(speechEnabled ? '字根代表發音：已開啟（點擊關閉）' : '字根代表發音：已關閉（點擊開啟）')}
              </button>
              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="w-full py-1.5 text-xs font-medium text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
              >
                {t('返回主畫面')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ROUND SUMMARY / CHAMBER PASS COMPLETE MODAL ==================== */}
      {(gameState === 'ROUND_SUMMARY' || gameState === 'GAME_OVER') && roundResult && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 ${
            isWash ? 'bg-[#141413]/35 backdrop-blur-[2px]' : 'bg-black/78'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={t('回合結算')}
        >
          <div className="wash-enter w-full max-w-lg bg-[var(--dojo-surface)] wash:bg-[#F5F3EE]/96 border border-[var(--dojo-border)] rounded-xl p-6 sm:p-7 shadow-2xl wash:shadow-[0_18px_50px_rgba(20,20,18,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]">
                  {chamberXrayMode?.active
                    ? chamberXrayMode.key
                      ? `${chamberXrayMode.key.toUpperCase()} ${t('鍵宮殿 · 字中辨根完成')}`
                      : t('全宮殿隨機字中辨根完成')
                    : singleChamberKey
                      ? `${singleChamberKey.toUpperCase()} ${t('鍵宮殿第')} ${
                          campaignProgress.chambers[singleChamberKey]?.clears || 1
                        } ${t('遍完成')}`
                      : t('本輪完成 · 肌肉形感已記錄')}
                </h2>
                <p className="text-xs text-[var(--dojo-text-sub)] mt-1 font-mono-tabular">
                  {chamberXrayMode?.active
                    ? `${roundResult.cleared} ${t('個隨機載體漢字')} · ${t('準確率')} ${roundResult.accuracy}% · ${t('均鍵')} ${roundResult.avgKeyMs || '--'}ms`
                    : singleChamberKey
                      ? `${roundResult.cleared} ${t('個字根')} · ${t('準確率')} ${roundResult.accuracy}% · ${t('均鍵')} ${roundResult.avgKeyMs || '--'}ms`
                      : `${t(activeScheme.shortName)} · ${t('耗時')} ${roundResult.durationSec} ${t('秒')}`}
                </p>
              </div>

              {roundResult.promotedCount > 0 && (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-pine)] whitespace-nowrap">
                  <Sparkles className="w-4 h-4" />
                  <span>{roundResult.promotedCount} {t('項熟度提升')}</span>
                </div>
              )}
            </div>

            {singleChamberKey && !chamberXrayMode?.active ? (
              <div className="my-4 h-52 bg-[var(--dojo-surface-inset)] rounded-xl border border-[var(--dojo-border)] flex items-center justify-center p-2">
                <StrokeCloudStage
                  chamberKey={singleChamberKey}
                  completedChars={completedChars}
                  variant="palace"
                  scriptMode={scriptMode}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 py-4 border-y border-[var(--dojo-border)] font-mono-tabular">
                  <div>
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('完成數量')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-text-bright)] mt-0.5">{roundResult.cleared}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('準確率')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-pine)] mt-0.5">
                      {roundResult.accuracy}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('均鍵反應')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-ochre)] mt-0.5">
                      {roundResult.avgKeyMs > 0 ? `${roundResult.avgKeyMs}ms` : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('用時')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-text)] mt-0.5">
                      {roundResult.durationSec}s
                    </div>
                  </div>
                </div>

                {chamberXrayMode?.active ? (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs mb-2.5">
                      <span className="font-medium text-[var(--dojo-text-sub)]">
                        {t('本輪可再留意的字根')}
                      </span>
                      <span className="font-mono-tabular text-[var(--dojo-text-muted)]">
                        {t('每次重練隨機抽取不同漢字載體')}
                      </span>
                    </div>

                    {roundResult.weakEntries && roundResult.weakEntries.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {roundResult.weakEntries.slice(0, 4).map((wk, idx) => {
                          const displayChar = wk.entry.xray?.radicalChar || wk.entry.char;
                          return (
                            <div
                              key={`${wk.entry.id}_${idx}`}
                              className="p-2.5 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] text-center"
                            >
                              <div className="font-display text-xl font-bold text-[var(--dojo-text-bright)] leading-tight">
                                {displayChar}
                              </div>
                              <div className="font-mono-tabular text-xs font-bold text-[var(--dojo-ochre)] mt-0.5">
                                {wk.entry.code.toUpperCase()}
                              </div>
                              <div className="font-mono-tabular text-[10px] text-[var(--dojo-text-muted)] mt-0.5">
                                {wk.errors > 0 ? `${t('誤')} ${wk.errors} ${t('次')}` : `${wk.avgMs}ms`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-3 px-3.5 rounded-lg bg-[var(--dojo-pine-wash)] border border-[var(--dojo-pine)]/25 text-xs text-[var(--dojo-pine-text)]">
                        {t('本節辨根自然流暢，字中拆解直覺清晰。')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-xs font-medium text-[var(--dojo-text-sub)] mb-2.5">
                      {t('較需溫習的 5 個宮殿鍵位')}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {weakestKeys.map((wk) => (
                        <div
                          key={wk.key}
                          className="p-2.5 rounded-lg bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] text-center"
                        >
                          <div className="font-mono-tabular text-[11px] font-bold text-[var(--dojo-ochre)]">
                            {wk.key.toUpperCase()}
                          </div>
                          <div className="font-display text-lg font-bold text-[var(--dojo-text-bright)] leading-tight my-0.5">
                            {wk.primary}
                          </div>
                          <div className="font-mono-tabular text-[10px] text-[var(--dojo-text-muted)]">
                            {wk.attempts > 0 ? `${wk.emaLatencyMs}ms` : t('未練')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Chamber X-ray vs Single Chamber vs Free Play Actions */}
            {chamberXrayMode?.active ? (
              (() => {
                const countdownSuffix =
                  nextProgression && autoAdvanceEnabled && !autoAdvancePaused && autoAdvanceSec > 0
                    ? `（${autoAdvanceSec}s）`
                    : '';
                const nextAnchor = nextPalaceKey
                  ? LINGMING_CHAMBER_BY_KEY[nextPalaceKey]?.primaryAnchor || ''
                  : '';
                return (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchChamberXrayDrill(
                          chamberXrayMode.key,
                          scaffoldMode === 'blind',
                          chamberReturnTo
                        )
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <ScanSearch className="w-4 h-4" />
                      <span>
                        {t('換一批隨機漢字再練')}
                        {countdownSuffix}
                      </span>
                    </button>

                    {chamberXrayMode.key && nextPalaceKey && (
                      <button
                        type="button"
                        onClick={() =>
                          handleLaunchChamberXrayDrill(
                            nextPalaceKey,
                            scaffoldMode === 'blind',
                            chamberReturnTo
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-pine)] hover:brightness-110 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>
                          {t('下一鍵：')}{nextPalaceKey.toUpperCase()}（{nextAnchor}）
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchChamberXrayDrill(
                          chamberXrayMode.key,
                          scaffoldMode !== 'blind',
                          chamberReturnTo
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <EyeOff className="w-4 h-4 text-[var(--dojo-ochre)]" />
                      <span>{t(scaffoldMode === 'blind' ? '切回漸隱提示' : '換成盲打辨根')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGameState(chamberReturnTo)}
                      className="py-2.5 px-3 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t(chamberReturnTo === 'PALACE_CLOUD' ? '返回雲圖' : '返回主畫面')}
                    </button>
                  </div>
                );
              })()
            ) : singleChamberKey && nextPalaceKey ? (
              (() => {
                const countdownSuffix =
                  nextProgression && autoAdvanceEnabled && !autoAdvancePaused && autoAdvanceSec > 0
                    ? `（${autoAdvanceSec}s）`
                    : '';
                return (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {nextProgression && (
                      <button
                        type="button"
                        onClick={nextProgression.run}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-pine)] hover:brightness-110 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <span>
                          {nextProgression.label}
                          {countdownSuffix}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => startPlay('reflex', [singleChamberKey], trainingScope)}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[var(--dojo-surface-2)] hover:brightness-105 text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t('再練一遍')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        startPlay(
                          'reflex',
                          [singleChamberKey],
                          trainingScope,
                          scaffoldMode === 'blind' ? 'adaptive' : 'blind'
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <EyeOff className="w-4 h-4 text-[var(--dojo-ochre)]" />
                      <span>{t(scaffoldMode === 'blind' ? '切回雲圖提示' : '換成默背')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGameState(chamberReturnTo)}
                      className="py-2.5 px-3 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t(chamberReturnTo === 'PALACE_CLOUD' ? '返回雲圖' : '返回主畫面')}
                    </button>
                  </div>
                );
              })()
            ) : (
              (() => {
                const countdownSuffix =
                  nextProgression && autoAdvanceEnabled && !autoAdvancePaused && autoAdvanceSec > 0
                    ? `（${autoAdvanceSec}s）`
                    : '';
                return (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {nextProgression ? (
                      <button
                        type="button"
                        onClick={nextProgression.run}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>
                          {nextProgression.label}
                          {countdownSuffix}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startPlay(mode, focusKeys)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('再來一局（Enter）')}</span>
                      </button>
                    )}

                    {mode !== 'weakkey' && (
                      <button
                        type="button"
                        onClick={() =>
                          startPlay(
                            'weakkey',
                            weakestKeys.map((w) => w.key),
                            activeScheme.isLingming ? 'root' : 'all'
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[var(--dojo-pine)] hover:brightness-110 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Target className="w-4 h-4" />
                        <span>{t('弱鍵聚焦')}</span>
                      </button>
                    )}

                    {nextProgression && (
                      <button
                        type="button"
                        onClick={() => startPlay(mode, focusKeys)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[var(--dojo-surface-2)] hover:brightness-105 text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('再練本組')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setGameState('TITLE_MENU')}
                      className="py-2.5 px-3 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t('主畫面')}
                    </button>
                  </div>
                );
              })()
            )}

            {/* Quiet auto-advance footer strip when a next stage exists */}
            {gameState === 'ROUND_SUMMARY' && nextProgression && (
              <div className="mt-3 pt-2.5 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--dojo-text-muted)]">
                <span className="font-mono-tabular">
                  {autoAdvanceEnabled && !autoAdvancePaused
                    ? `${autoAdvanceSec} ${t('秒後自動進入下一階段 · Enter 立即前往')}`
                    : t('按 Enter 立即進入下一階段')}
                </span>
                <div className="flex items-center gap-3">
                  {autoAdvanceEnabled && !autoAdvancePaused && (
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setAutoAdvancePaused(true);
                      }}
                      className="text-[var(--dojo-ochre)] hover:underline transition-colors cursor-pointer"
                    >
                      {t('停在本頁 (Esc)')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleAutoAdvance}
                    className="text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
                  >
                    {t(
                      autoAdvanceEnabled
                        ? autoAdvancePaused
                          ? '恢復自動連進'
                          : '自動連進：開'
                        : '自動連進：關（開啟）'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
    </ThemeContext.Provider>
    </UiScriptContext.Provider>
    </KeystrokeCloudContext.Provider>
    </FirebaseErrorBoundary>
  );
}
