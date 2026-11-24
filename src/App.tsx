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
  Star,
  Map as MapIcon,
  Shield,
  Flame,
  BookOpen,
  Zap,
  ScrollText,
  ScanSearch,
  GraduationCap,
} from 'lucide-react';
import {
  BUILTIN_SCHEMES,
  GlyphEntry,
  ShapeCodeScheme,
} from './data/schemes';
import { LINGMING_CHAMBER_BY_KEY } from './data/lingming';
import { getNextPalaceKey } from './data/palaceStrokes';
import {
  buildCampaignStageDeck,
  buildChamberXrayDeck,
  buildWeakSpotDrillDeck,
  CAMPAIGN_STAGE_BY_ID,
  CampaignProgressStore,
  CampaignStage,
  getCampaignSummary,
  getNextCampaignStage,
  getNextUnclearPalaceKey,
  loadCampaignProgress,
  PALACE_GUIDED_KEYS,
  recordCampaignStageResult,
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
  WeakEntryInfo,
} from './engine/GameCanvas';
import { getDepthFocusMetrics } from './engine/palaceSizing';
import {
  getMasterySummary,
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
import { CampaignMapView } from './components/CampaignMapView';
import { DrillTab, ExtremeDrillStudio } from './components/ExtremeDrillStudio';
import { ShortCodeDojo, ShortCodeTier } from './components/ShortCodeDojo';
import { FadeMode, HuangtingDojo } from './components/HuangtingDojo';
import { HomeTutorialModal, TutorialTabId } from './components/HomeTutorialModal';
import { NoviceAcademy } from './components/NoviceAcademy';
import { NovicePracticeAction } from './data/noviceCurriculum';
import { WeakKeyRadarCard } from './components/WeakKeyRadarCard';
import { CorrectionReportCard } from './components/CorrectionReportCard';
import { GrowthAnalyticsPanel } from './components/GrowthAnalyticsPanel';
import { FirebaseErrorBoundary } from './components/FirebaseErrorBoundary';
import { KeystrokeCloudToggle, KeystrokePalaceCloud } from './components/KeystrokePalaceCloud';
import { RhythmMetronome } from './components/RhythmMetronome';
import { synth } from './audio/synth';
import { speech } from './audio/speech';

type GameState =
  | 'TITLE_MENU'
  | 'NOVICE_ACADEMY'
  | 'CAMPAIGN_MAP'
  | 'PALACE_CLOUD'
  | 'DRILL_STUDIO'
  | 'SHORT_CODE_DOJO'
  | 'HUANGTING_DOJO'
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
    id: 'arcade',
    label: '疾風落字',
    brief: '60fps 節奏落字與連擊加乘，隨波次解鎖大碼、全字根與靈明單字',
  },
  {
    id: 'weakkey',
    label: '弱鍵突擊',
    brief: '鎖定反應最慢與易錯的 5 個輔音宮殿鍵位，進行高密度靶向重塑',
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
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [returnStateFromPalace, setReturnStateFromPalace] = useState<
    'TITLE_MENU' | 'CAMPAIGN_MAP' | 'PLAYING' | 'NOVICE_ACADEMY'
  >('TITLE_MENU');
  const [subDojoReturnTo, setSubDojoReturnTo] = useState<'TITLE_MENU' | 'NOVICE_ACADEMY'>('TITLE_MENU');
  const [playReturnTo, setPlayReturnTo] = useState<'TITLE_MENU' | 'NOVICE_ACADEMY'>('TITLE_MENU');
  const [campaignInitialChapter, setCampaignInitialChapter] = useState<1 | 2 | 3 | 4 | 5 | undefined>(
    undefined
  );
  const [drillLaunchPreset, setDrillLaunchPreset] = useState<{
    tab?: DrillTab;
    customText?: string;
    openPaste?: boolean;
  }>({});
  const [shortCodeInitialTier, setShortCodeInitialTier] = useState<ShortCodeTier | undefined>(
    undefined
  );
  const [huangtingInitialFade, setHuangtingInitialFade] = useState<FadeMode | undefined>(undefined);
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
  const [activeStage, setActiveStage] = useState<CampaignStage | null>(null);
  const [activeCustomDeck, setActiveCustomDeck] = useState<GlyphEntry[] | null>(null);
  const [isWeakDrill, setIsWeakDrill] = useState(false);
  const [lastStageBadge, setLastStageBadge] = useState<{
    earnedStars: 0 | 1 | 2 | 3;
    isNewRecord: boolean;
  } | null>(null);

  const [focusKeys, setFocusKeys] = useState<string[] | null>(null);
  const [chamberReturnTo, setChamberReturnTo] = useState<
    'CAMPAIGN_MAP' | 'PALACE_CLOUD' | 'NOVICE_ACADEMY'
  >('PALACE_CLOUD');
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
  const [tutorialModal, setTutorialModal] = useState<{
    open: boolean;
    tab: TutorialTabId;
    chamberKey: string;
  }>({ open: false, tab: 'palace', chamberKey: 'x' });
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

  const masterySummary = useMemo(
    () => getMasterySummary(activeScheme, mastery, scriptMode),
    [activeScheme, mastery, scriptMode]
  );

  const campaignSummary = useMemo(
    () => getCampaignSummary(campaignProgress),
    [campaignProgress]
  );

  const startPlay = useCallback(
    (
      selectedMode: GameMode = mode,
      overrideFocusKeys: string[] | null = null,
      overrideScope?: TrainingScope,
      overrideScaffold?: ScaffoldMode
    ) => {
      synth.playClick();
      setActiveStage(null);
      setActiveCustomDeck(null);
      setChamberXrayMode(null);
      setIsWeakDrill(false);
      setLastStageBadge(null);
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

  const launchCampaignStage = useCallback(
    (stage: CampaignStage, overrideScriptMode?: ScriptMode) => {
      synth.playClick();
      const lingming = BUILTIN_SCHEMES[0];
      const storeForDeck = activeScheme.isLingming
        ? masteryRef.current
        : loadMasteryStore(lingming.id);
      if (!activeScheme.isLingming) {
        switchScheme(lingming);
      }
      const effectiveScript = overrideScriptMode ?? scriptMode;
      const deck = buildCampaignStageDeck(stage, lingming, storeForDeck, effectiveScript);
      setActiveStage(stage);
      setChamberXrayMode(null);
      setIsWeakDrill(false);
      setLastStageBadge(null);
      setFocusKeys(null);
      setMode(stage.mode);
      setTrainingScope(stage.chapterId === 5 ? 'char' : 'root');
      setScaffoldMode(stage.defaultScaffold);
      setActiveCustomDeck(deck.length > 0 ? deck : null);
      setCompletedChars(new Set());
      setRoundResult(null);
      setResetSignal((n) => n + 1);
      setGameState('PLAYING');
    },
    [activeScheme.isLingming, scriptMode, switchScheme]
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
        if (activeStage) {
          launchCampaignStage(activeStage, next);
        } else if (chamberXrayMode?.active) {
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
    [activeStage, chamberXrayMode, gameState, launchCampaignStage]
  );

  const launchWeakDrill = useCallback((weakEntries: WeakEntryInfo[]) => {
    synth.playClick();
    const deck = buildWeakSpotDrillDeck(
      weakEntries.map((w) => w.entry),
      12
    );
    if (deck.length === 0) return;
    setChamberXrayMode(null);
    setIsWeakDrill(true);
    setLastStageBadge(null);
    setFocusKeys(null);
    setMode('reflex');
    setActiveCustomDeck(deck);
    setCompletedChars(new Set());
    setRoundResult(null);
    setResetSignal((n) => n + 1);
    setGameState('PLAYING');
  }, []);

  const handleGlyphCleared = useCallback((ch: string) => {
    setCompletedChars((prev) => {
      const next = new Set(prev);
      next.add(ch);
      return next;
    });
  }, []);

  const handleRoundEnd = useCallback(
    (result: RoundResult) => {
      let updatedStore = campaignProgress;
      if (
        result.reason === 'cleared' &&
        focusKeys &&
        focusKeys.length === 1 &&
        activeScheme.isLingming
      ) {
        updatedStore = recordChamberPass(
          updatedStore,
          focusKeys[0],
          result.accuracy,
          result.avgKeyMs,
          scaffoldMode === 'blind'
        );
        setCampaignProgress(updatedStore);
      }
      if (activeStage && !isWeakDrill) {
        const passed = result.reason === 'cleared';
        const { nextStore, earnedStars, isNewRecord } = recordCampaignStageResult(
          updatedStore,
          activeStage,
          result.score,
          result.accuracy,
          result.avgKeyMs,
          passed
        );
        setCampaignProgress(nextStore);
        setLastStageBadge({ earnedStars, isNewRecord });
      } else {
        setLastStageBadge(null);
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
    [
      activeScheme.isLingming,
      activeStage,
      campaignProgress,
      focusKeys,
      handleMasteryChange,
      isWeakDrill,
      scaffoldMode,
    ]
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
    (from: 'TITLE_MENU' | 'CAMPAIGN_MAP' | 'PLAYING' | 'NOVICE_ACADEMY') => {
      synth.playClick();
      if (!activeScheme.isLingming) {
        switchScheme(BUILTIN_SCHEMES[0]);
      }
      setReturnStateFromPalace(from);
      setGameState('PALACE_CLOUD');
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
      from: 'CAMPAIGN_MAP' | 'PALACE_CLOUD' | 'NOVICE_ACADEMY' = 'PALACE_CLOUD'
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
      setPlayReturnTo(from === 'NOVICE_ACADEMY' ? 'NOVICE_ACADEMY' : 'TITLE_MENU');
    },
    [activeScheme.isLingming, startPlay, switchScheme]
  );

  const handleLaunchChamberXrayDrill = useCallback(
    (
      chamberKey: string | null,
      blind = false,
      from: 'CAMPAIGN_MAP' | 'PALACE_CLOUD' | 'NOVICE_ACADEMY' = 'CAMPAIGN_MAP'
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
      setActiveStage(null);
      setIsWeakDrill(false);
      setLastStageBadge(null);
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

  const handleNoviceAction = useCallback(
    (action: NovicePracticeAction) => {
      synth.playClick();
      switch (action.kind) {
        case 'stage': {
          const st = CAMPAIGN_STAGE_BY_ID[action.stageId];
          if (st) {
            setSubDojoReturnTo('NOVICE_ACADEMY');
            setPlayReturnTo('NOVICE_ACADEMY');
            launchCampaignStage(st);
          }
          break;
        }
        case 'campaign_chapter': {
          setSubDojoReturnTo('NOVICE_ACADEMY');
          setCampaignInitialChapter(action.chapterId);
          setGameState('CAMPAIGN_MAP');
          break;
        }
        case 'palace_cloud': {
          openPalaceCloud('NOVICE_ACADEMY');
          break;
        }
        case 'chamber_drill': {
          handleLaunchChamberDrill(
            action.chamberKey,
            'root',
            Boolean(action.blind),
            'NOVICE_ACADEMY'
          );
          break;
        }
        case 'free_play': {
          startPlay(action.mode, null, action.scope, action.scaffold);
          setPlayReturnTo('NOVICE_ACADEMY');
          break;
        }
        case 'drill_studio': {
          setSubDojoReturnTo('NOVICE_ACADEMY');
          setDrillLaunchPreset({
            tab: action.tab,
            customText: action.customText,
            openPaste: action.openPaste,
          });
          setGameState('DRILL_STUDIO');
          break;
        }
        case 'short_code': {
          setSubDojoReturnTo('NOVICE_ACADEMY');
          setShortCodeInitialTier(action.tier);
          setGameState('SHORT_CODE_DOJO');
          break;
        }
        case 'huangting': {
          setSubDojoReturnTo('NOVICE_ACADEMY');
          setHuangtingInitialFade(action.fadeMode);
          setGameState('HUANGTING_DOJO');
          break;
        }
      }
    },
    [handleLaunchChamberDrill, launchCampaignStage, openPalaceCloud, startPlay]
  );

  const singleChamberKey =
    focusKeys && focusKeys.length === 1 && activeScheme.isLingming ? focusKeys[0] : null;
  const nextPalaceKey = singleChamberKey
    ? chamberReturnTo === 'CAMPAIGN_MAP'
      ? PALACE_GUIDED_KEYS[
          (PALACE_GUIDED_KEYS.indexOf(singleChamberKey) + 1) % PALACE_GUIDED_KEYS.length
        ]
      : getNextPalaceKey(singleChamberKey)
    : null;

  const nextProgression = useMemo<{
    label: string;
    isBoss?: boolean;
    run: () => void;
  } | null>(() => {
    if (gameState !== 'ROUND_SUMMARY') return null;

    // 1. Weak-spot micro-drill finished: if parent stage is cleared, advance to next stage; else re-test parent stage
    if (activeStage && isWeakDrill) {
      const parentStars = campaignProgress.stages[activeStage.id]?.stars ?? 0;
      if (parentStars > 0) {
        if (activeStage.id === '2-boss') {
          const hasUnclear = PALACE_GUIDED_KEYS.some(
            (k) => (campaignProgress.chambers?.[k]?.clears ?? 0) === 0
          );
          if (hasUnclear) {
            const firstKey = getNextUnclearPalaceKey(campaignProgress.chambers || {});
            const anchor = LINGMING_CHAMBER_BY_KEY[firstKey]?.primaryAnchor || '';
            return {
              label: `${t('進入第三關逐鍵：')}${firstKey.toUpperCase()}（${anchor}）`,
              run: () => handleLaunchChamberDrill(firstKey, 'root', false, 'CAMPAIGN_MAP'),
            };
          }
        }
        const nextStage = getNextCampaignStage(activeStage.id);
        if (nextStage) {
          return {
            label: `${t('下一節：')}${t(nextStage.indexLabel)}`,
            isBoss: nextStage.isBossTrial,
            run: () => launchCampaignStage(nextStage),
          };
        }
      }
      return {
        label: `${t('重測原小節：')}${t(activeStage.indexLabel)}`,
        isBoss: activeStage.isBossTrial,
        run: () => launchCampaignStage(activeStage),
      };
    }

    // 2. Main 5-Chapter Campaign stage cleared
    if (activeStage) {
      if (activeStage.id === '2-boss') {
        const hasUnclear = PALACE_GUIDED_KEYS.some(
          (k) => (campaignProgress.chambers?.[k]?.clears ?? 0) === 0
        );
        if (hasUnclear) {
          const firstKey = getNextUnclearPalaceKey(campaignProgress.chambers || {});
          const anchor = LINGMING_CHAMBER_BY_KEY[firstKey]?.primaryAnchor || '';
          return {
            label: `${t('進入第三關逐鍵：')}${firstKey.toUpperCase()}（${anchor}）`,
            run: () => handleLaunchChamberDrill(firstKey, 'root', false, 'CAMPAIGN_MAP'),
          };
        }
      }
      const nextStage = getNextCampaignStage(activeStage.id);
      if (!nextStage) return null;
      return {
        label: `${t('下一節：')}${t(nextStage.indexLabel)}`,
        isBoss: nextStage.isBossTrial,
        run: () => launchCampaignStage(nextStage),
      };
    }

    // 2.5 Memory Palace In-Character X-Ray Challenge cleared
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

    // 3. Single-Key Memory Palace round cleared
    if (singleChamberKey && nextPalaceKey) {
      const all20Cleared = PALACE_GUIDED_KEYS.every(
        (k) => (campaignProgress.chambers?.[k]?.clears ?? 0) > 0
      );
      const isLastGuidedKey =
        singleChamberKey === PALACE_GUIDED_KEYS[PALACE_GUIDED_KEYS.length - 1];
      const stage31 = CAMPAIGN_STAGE_BY_ID['3-1'];
      if (chamberReturnTo === 'CAMPAIGN_MAP' && isLastGuidedKey && all20Cleared && stage31) {
        return {
          label: t('進入 3-1 · 高頻殿堂混測'),
          run: () => launchCampaignStage(stage31),
        };
      }
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

    // 4. Free Play sub-stage progression
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
          label: t('下一階段：疾風落字'),
          run: () => startPlay('arcade', null, 'char'),
        };
      }
      if (mode === 'arcade') {
        return {
          label: t('下一陣：記憶宮殿反射'),
          run: () => startPlay('reflex', null, 'root'),
        };
      }
      if (mode === 'weakkey') {
        return {
          label: t('下一輪：更新弱鍵突擊'),
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
    activeStage,
    campaignProgress.chambers,
    campaignProgress.stages,
    chamberReturnTo,
    chamberXrayMode,
    focusKeys,
    gameState,
    handleLaunchChamberDrill,
    handleLaunchChamberXrayDrill,
    isWeakDrill,
    launchCampaignStage,
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
        if (tutorialModal.open) return;
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
          synth.playClick();
          setGameState('CAMPAIGN_MAP');
        }
      } else if (gameState === 'CAMPAIGN_MAP') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setGameState('TITLE_MENU');
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
          } else if (activeStage) {
            launchCampaignStage(activeStage);
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
          if (activeStage) {
            launchCampaignStage(activeStage);
          } else {
            startPlay(mode, focusKeys);
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    tutorialModal.open,
    mode,
    focusKeys,
    activeStage,
    launchCampaignStage,
    startPlay,
    autoAdvanceEnabled,
    autoAdvancePaused,
  ]);

  return (
    <FirebaseErrorBoundary>
    <KeystrokeCloudContext.Provider value={keystrokeCloudCtx}>
    <UiScriptContext.Provider value={uiScript}>
    <ThemeContext.Provider value={themeMode}>
    <div className="relative w-screen h-screen overflow-hidden bg-[var(--dojo-canvas)] text-[var(--dojo-text)] flex flex-col">
      {/* Global Xuan-paper texture & ambient ink-wash clouds across ALL views in wash mode */}
      {isWash && (
        <div
          aria-hidden="true"
          className="dojo-ink-paper-bg pointer-events-none fixed inset-0 z-0 overflow-hidden"
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
                ? 'linear-gradient(90deg, rgba(243,241,236,0.92) 0%, rgba(243,241,236,0.80) 46%, rgba(243,241,236,0.34) 78%, rgba(243,241,236,0.14) 100%)'
                : 'linear-gradient(90deg, rgba(11,14,20,0.95) 0%, rgba(11,14,20,0.82) 44%, rgba(11,14,20,0.22) 76%, rgba(11,14,20,0.14) 100%)',
            }}
          />

          {/* Top quiet status, theme switch & audio row */}
          <div className="relative z-10 flex items-center justify-between gap-3 px-6 sm:px-10 pt-6">
            <div className="flex items-center gap-3 text-xs text-[var(--dojo-text-sub)]">
              <span className="text-[var(--dojo-text-bright)] font-medium">{t(activeScheme.shortName)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-[var(--dojo-ochre)]">
                {t('段位')} {t(campaignSummary.rank.title)} · ★ {campaignSummary.totalStars}/
                {campaignSummary.maxStars}
              </span>
              {masterySummary.avgKeyMs > 0 && (
                <>
                  <span aria-hidden="true" className="hidden md:inline">·</span>
                  <span className="hidden md:inline font-mono-tabular">
                    {t('均速')} {masterySummary.avgKeyMs}ms
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Visual Theme Switcher: 玄墨夜練 / 宣紙水墨 */}
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  speechEnabled
                    ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/35 text-[var(--dojo-pine-text)]'
                    : 'bg-[var(--dojo-surface)]/90 hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)]'
                }`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t(speechEnabled ? '字根發音：開' : '字根發音：關')}</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                title={t(muted ? '按鍵音效：已關閉（預設靜音，點擊開啟）' : '按鍵音效：已開啟（點擊關閉）')}
                aria-label={t(muted ? '開啟按鍵音效' : '關閉按鍵音效')}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--dojo-surface)]/90 hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)] transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Main Hero Row: Left Brand & Entries + Right Compact Weak-Key Radar Chart */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 py-6 my-auto flex flex-col lg:flex-row lg:items-end justify-between gap-6 lg:gap-10">
          <div className="flex-1 min-w-0 max-w-2xl wash-enter">
            <svg
              viewBox="0 0 430 92"
              className="w-full max-w-[380px] h-auto mb-6"
              aria-label={t('墨鍵道場 · 靈明記憶宮殿')}
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
                letterSpacing="1.8"
                fontFamily="'Plus Jakarta Sans', sans-serif"
              >
                {t('靈明輸入法 · 記憶宮殿與零掃視訓練')}
              </text>
            </svg>

            {/* Three Primary Entries */}
            <div className="grid grid-cols-1 sm:grid-cols-3 items-stretch gap-3 max-w-2xl wash-enter-soft">
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setSubDojoReturnTo('TITLE_MENU');
                  setCampaignInitialChapter(undefined);
                  setGameState('CAMPAIGN_MAP');
                }}
                className="flex flex-col items-start justify-center gap-1 px-5 py-4 bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] active:scale-[0.99] text-white rounded-xl shadow-lg transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2 text-base font-bold whitespace-nowrap">
                  <MapIcon className="w-4 h-4 shrink-0" />
                  <span>{t('五重道場闖關')}</span>
                </div>
                <span className="text-xs text-white/85 font-mono-tabular whitespace-nowrap">
                  {t('循序破關')} · {t(campaignSummary.nextRecommendedStage.indexLabel)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPlayReturnTo('TITLE_MENU');
                  startPlay(mode);
                }}
                className={`flex flex-col items-start justify-center gap-1 px-5 py-4 active:scale-[0.99] border rounded-xl transition-all cursor-pointer text-left ${
                  isWash
                    ? 'bg-[#F9F8F5]/95 hover:bg-[#FFFFFF] border-[#141413]/18 text-[#141413] shadow-sm'
                    : 'bg-[#161D2A]/92 hover:bg-[#1E2738] border-[#F2EEE6]/16 text-[#F2EEE6]'
                }`}
              >
                <div className="flex items-center gap-2 text-base font-bold whitespace-nowrap">
                  <Play className="w-4 h-4 fill-current text-[var(--dojo-pine)] shrink-0" />
                  <span>{t('自由鍛煉')}</span>
                </div>
                <span className="text-xs text-[var(--dojo-text-sub)] whitespace-nowrap">
                  {t(MODE_OPTIONS.find((m) => m.id === mode)?.label ?? '記憶宮殿反射')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setSubDojoReturnTo('TITLE_MENU');
                  setDrillLaunchPreset({});
                  setGameState('DRILL_STUDIO');
                }}
                className={`flex flex-col items-start justify-center gap-1 px-5 py-4 active:scale-[0.99] border rounded-xl transition-all cursor-pointer text-left ${
                  isWash
                    ? 'bg-[#F9F8F5]/95 hover:bg-[#FFFFFF] border-[#141413]/28 text-[#141413] shadow-sm'
                    : 'bg-[#161D2A]/92 hover:bg-[#1E2738] border-[#D89B3C]/35 text-[#F2EEE6]'
                }`}
              >
                <div className="flex items-center gap-2 text-base font-bold whitespace-nowrap">
                  <Flame className="w-4 h-4 text-[var(--dojo-ochre)] shrink-0" />
                  <span>{t('文心實戰室')}</span>
                </div>
                <span className="text-xs text-[var(--dojo-ochre)] font-mono-tabular whitespace-nowrap">
                  {Object.keys(mastery.slowGlyphs || {}).length > 0
                    ? `${t('實戰盲打')} · ${t('慢字')} ${Object.keys(mastery.slowGlyphs || {}).length}`
                    : `${t('行雲連打')} · ${t('慢字精修')}`}
                </span>
              </button>
            </div>

            {/* Two Specialized Training Spaces: Short-Code Dojo & Huangting Scripture Dojo */}
            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 items-stretch gap-2.5 max-w-2xl wash-enter-soft">
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setSubDojoReturnTo('TITLE_MENU');
                  setShortCodeInitialTier(undefined);
                  setGameState('SHORT_CODE_DOJO');
                }}
                className={`flex items-center justify-between gap-3 px-4 py-3 active:scale-[0.99] border rounded-xl transition-all cursor-pointer text-left ${
                  isWash
                    ? 'bg-[#F9F8F5]/92 hover:bg-[#FFFFFF] border-[#141413]/18 text-[#141413] shadow-xs'
                    : 'bg-[#151D2B]/90 hover:bg-[#1D2739] border-[#4A9468]/32 text-[#F2EEE6]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                    <Zap className="w-4 h-4 text-[var(--dojo-pine)] shrink-0" />
                    <span>{t('簡碼速成')}</span>
                  </div>
                  <div className="text-[11px] text-[var(--dojo-text-sub)] mt-0.5 truncate">
                    {t('一二三碼直出 · 常用字均長提速')}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--dojo-text-muted)] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setSubDojoReturnTo('TITLE_MENU');
                  setHuangtingInitialFade(undefined);
                  setGameState('HUANGTING_DOJO');
                }}
                className={`flex items-center justify-between gap-3 px-4 py-3 active:scale-[0.99] border rounded-xl transition-all cursor-pointer text-left ${
                  isWash
                    ? 'bg-[#F9F8F5]/92 hover:bg-[#FFFFFF] border-[#141413]/22 text-[#141413] shadow-xs'
                    : 'bg-[#151D2B]/90 hover:bg-[#1D2739] border-[#D89B3C]/35 text-[#F2EEE6]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                    <ScrollText className="w-4 h-4 text-[var(--dojo-ochre)] shrink-0" />
                    <span>{t('黃庭抄經閣')}</span>
                  </div>
                  <div className="text-[11px] text-[var(--dojo-text-sub)] mt-0.5 truncate">
                    {t('三十六章誦抄 · 熟度漸隱分色拆解')}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--dojo-text-muted)] shrink-0" />
              </button>
            </div>

            {/* Dedicated 14-Day Novice Cognitive & Motor-Memory Academy Entry */}
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setGameState('NOVICE_ACADEMY');
              }}
              className={`mt-2.5 w-full max-w-2xl flex items-center justify-between gap-3 px-4 py-3 active:scale-[0.995] border rounded-xl transition-all cursor-pointer text-left wash-enter-soft ${
                isWash
                  ? 'bg-[#F9F8F5]/94 hover:bg-[#FFFFFF] border-[#141413]/24 text-[#141413] shadow-xs'
                  : 'bg-gradient-to-r from-[#172133]/92 via-[#151D2B]/92 to-[#1D2434]/92 hover:border-[#D89B3C]/55 border-[#D89B3C]/34 text-[#F2EEE6]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                    isWash
                      ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                      : 'bg-[#D89B3C]/14 border-[#D89B3C]/35 text-[#E8C57B]'
                  }`}
                >
                  <GraduationCap className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                    <span>{t('新手 14 天速成學院（從零到自由書寫）')}</span>
                  </div>
                  <div className="text-[11px] text-[var(--dojo-text-sub)] mt-0.5 truncate">
                    {t('記憶規律 · 肌肉記憶心理特徵 · 7 大難點破壁 · 每日自練模組直達')}
                  </div>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--dojo-ochre)] shrink-0 whitespace-nowrap">
                <span>{t('進入課程')}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>

            {/* Homepage Tutorial & Interactive Memory Palace Example Strip */}
            <div
              className={`mt-3 max-w-2xl rounded-xl border px-4 py-3 backdrop-blur-sm wash-enter-soft ${
                isWash
                  ? 'bg-[#F9F8F5]/88 border-[#141413]/14 text-[#141413]'
                  : 'bg-[#121824]/86 border-[#F2EEE6]/12 text-[#F2EEE6]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen
                    className={`w-4 h-4 shrink-0 ${
                      isWash ? 'text-[#181817]' : 'text-[#D89B3C]'
                    }`}
                  />
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {t('首頁說明教程 · 記憶宮殿示例')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setTutorialModal({ open: true, tab: 'palace', chamberKey: 'x' });
                    }}
                    className={`inline-flex items-center gap-1 font-medium hover:underline transition-colors whitespace-nowrap cursor-pointer ${
                      isWash ? 'text-[#181817]' : 'text-[#E8C57B]'
                    }`}
                  >
                    <span>{t('打開完整教程')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <span aria-hidden="true" className="opacity-30">·</span>
                  <button
                    type="button"
                    onClick={() => openPalaceCloud('TITLE_MENU')}
                    className={`inline-flex items-center gap-1 hover:underline transition-colors whitespace-nowrap cursor-pointer ${
                      isWash ? 'text-[#4F4F4A]' : 'text-[#AEB6C4] hover:text-[#F2EEE6]'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{t('25 鍵宮殿圖')}</span>
                  </button>
                </div>
              </div>

              <p
                className={`text-xs leading-relaxed mb-3 ${
                  isWash ? 'text-[#4F4F4A]' : 'text-[#AAB3C2]'
                }`}
              >
                {t(
                  '依基本字根的筆畫順序與字頻建立空間記憶宮殿，讓字根排布貼合象形記憶機理。點選範例鍵位立即查看筆順路徑與拆字舉例：'
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: 'x', anchor: '木', hint: '上橫→左撇→右捺' },
                    { key: 'd', anchor: '口', hint: '左豎→橫折→底橫' },
                    { key: 'v', anchor: '水', hint: '中豎鉤→左右翼' },
                    { key: 's', anchor: '土', hint: '上橫→中豎→底橫' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setTutorialModal({ open: true, tab: 'palace', chamberKey: item.key });
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap cursor-pointer ${
                      isWash
                        ? 'bg-[#FFFFFF]/90 hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/14 text-[#181817]'
                        : 'bg-[#182030]/90 hover:bg-[#232F46] border-[#F2EEE6]/12 text-[#ECE8DF]'
                    }`}
                  >
                    <span className="font-mono-tabular font-bold">
                      {item.key.toUpperCase()}
                    </span>
                    <span className="font-display font-bold">{item.anchor}</span>
                    <span
                      className={`text-[11px] hidden sm:inline ${
                        isWash ? 'opacity-70' : 'text-[#9BA5B6]'
                      }`}
                    >
                      {t(item.hint)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Weak-Key Radar Chart + Cloud Correction Report Card */}
          <div className="flex flex-col gap-3 w-full lg:w-[318px] xl:w-[332px] shrink-0">
            <WeakKeyRadarCard
              weakestKeys={weakestKeys}
              hasPracticedData={Object.values(mastery.keys).some((k) => k.attempts > 0)}
              onStartWeakKeyDrill={(keys) => startPlay('weakkey', keys, 'root')}
              onLaunchChamberDrill={(key) =>
                handleLaunchChamberDrill(key, 'root', false, 'PALACE_CLOUD')
              }
            />
            <CorrectionReportCard />
          </div>
          </div>

          {/* Weekly Growth Visualization Panel (Recharts: 7-Day CPM & Radical Latency) */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-10 pb-6">
            <GrowthAnalyticsPanel
              mastery={mastery}
              onStartQuickPractice={() => startPlay(mode)}
            />
          </div>

          {/* Quiet bottom line */}
          <div className="relative z-10 px-6 sm:px-10 pb-5 flex items-center justify-between text-xs text-[var(--dojo-text-muted)]">
            <span>{t('Enter / Space 進入五重道場')}</span>
            <span className="hidden sm:inline font-mono-tabular">
              {t('最高紀錄')} {mastery.bestScore}
            </span>
          </div>

          {/* Interactive Homepage Tutorial & Memory Palace Examples Modal */}
          {tutorialModal.open && (
            <HomeTutorialModal
              initialTab={tutorialModal.tab}
              initialChamberKey={tutorialModal.chamberKey}
              scriptMode={scriptMode}
              onClose={() => setTutorialModal((prev) => ({ ...prev, open: false }))}
              onOpenCampaign={() => {
                synth.playClick();
                setSubDojoReturnTo('TITLE_MENU');
                setCampaignInitialChapter(undefined);
                setGameState('CAMPAIGN_MAP');
              }}
              onStartFreePlay={() => {
                setPlayReturnTo('TITLE_MENU');
                startPlay(mode);
              }}
              onOpenDrillStudio={() => {
                synth.playClick();
                setSubDojoReturnTo('TITLE_MENU');
                setDrillLaunchPreset({});
                setGameState('DRILL_STUDIO');
              }}
              onOpenPalaceCloud={() => openPalaceCloud('TITLE_MENU')}
              onLaunchChamberDrill={(key) =>
                handleLaunchChamberDrill(key, 'root', false, 'PALACE_CLOUD')
              }
              onOpenNoviceAcademy={() => {
                synth.playClick();
                setGameState('NOVICE_ACADEMY');
              }}
            />
          )}
          </div>
        </div>
      )}

      {/* ==================== 14-DAY NOVICE SPEED-MASTERY ACADEMY ==================== */}
      {gameState === 'NOVICE_ACADEMY' && (
        <NoviceAcademy
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          themeMode={themeMode}
          onChangeThemeMode={handleChangeThemeMode}
          onBack={() => setGameState('TITLE_MENU')}
          onLaunchAction={handleNoviceAction}
        />
      )}

      {/* ==================== 5-CHAPTER CAMPAIGN SCROLL MAP ==================== */}
      {gameState === 'CAMPAIGN_MAP' && (
        <CampaignMapView
          progress={campaignProgress}
          scriptMode={scriptMode}
          initialChapterId={
            campaignInitialChapter ??
            activeStage?.chapterId ??
            (chamberReturnTo === 'CAMPAIGN_MAP' && singleChamberKey ? 3 : undefined)
          }
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          onChangeThemeMode={handleChangeThemeMode}
          onBackToTitle={() => {
            setCampaignInitialChapter(undefined);
            setGameState(subDojoReturnTo);
          }}
          onOpenPalaceCloud={() => openPalaceCloud('CAMPAIGN_MAP')}
          onLaunchStage={(st) => {
            setPlayReturnTo('TITLE_MENU');
            launchCampaignStage(st);
          }}
          onLaunchChamberDrill={(key, scope, blind) =>
            handleLaunchChamberDrill(key, scope, blind, 'CAMPAIGN_MAP')
          }
          onLaunchChamberXrayDrill={(key, blind) =>
            handleLaunchChamberXrayDrill(key, blind, 'CAMPAIGN_MAP')
          }
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
          onBack={() => setGameState(returnStateFromPalace)}
          onLaunchChamberDrill={(key, scope, blind) =>
            handleLaunchChamberDrill(key, scope, blind, 'PALACE_CLOUD')
          }
          onLaunchChamberXrayDrill={(key, blind) =>
            handleLaunchChamberXrayDrill(key, blind, 'PALACE_CLOUD')
          }
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

      {/* ==================== LINGMING SHORT-CODE DOJO ==================== */}
      {gameState === 'SHORT_CODE_DOJO' && (
        <ShortCodeDojo
          mastery={mastery}
          onMasteryChange={handleMasteryChange}
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          onChangeThemeMode={handleChangeThemeMode}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState(subDojoReturnTo)}
          initialTier={shortCodeInitialTier}
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
          initialFadeMode={huangtingInitialFade}
        />
      )}

      {/* ==================== ACTIVE PLAY SHELL ==================== */}
      {gameState !== 'TITLE_MENU' &&
        gameState !== 'NOVICE_ACADEMY' &&
        gameState !== 'CAMPAIGN_MAP' &&
        gameState !== 'PALACE_CLOUD' &&
        gameState !== 'DRILL_STUDIO' &&
        gameState !== 'SHORT_CODE_DOJO' &&
        gameState !== 'HUANGTING_DOJO' && (
        <div className="relative z-10 w-full h-full flex flex-col">
          {/* Compact low-occlusion perimeter HUD */}
          <header className="shrink-0 h-12 px-4 sm:px-6 bg-[var(--dojo-header)] wash:bg-[var(--dojo-header)]/88 wash:backdrop-blur-sm border-b border-[var(--dojo-border)] flex items-center justify-between gap-3 z-30">
            <div className="flex items-center gap-2 text-xs min-w-0 overflow-hidden">
              {activeStage ? (
                <>
                  <span className="font-display text-sm font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
                    {t(activeStage.indexLabel)} · {t(activeStage.title)}
                  </span>
                  {isWeakDrill ? (
                    <>
                      <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                      <span className="text-[var(--dojo-pine-text)] whitespace-nowrap">{t('弱點複訓')}</span>
                    </>
                  ) : activeStage.chapterId === 4 ? (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[var(--dojo-text-muted)]">·</span>
                      <span className="hidden md:inline text-[var(--dojo-ochre)] truncate">
                        {t('僅輸入高亮筆畫字根全碼')} · {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  ) : activeStage.chapterId === 2 || activeStage.chapterId === 5 ? (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[var(--dojo-text-muted)]">·</span>
                      <span className="hidden md:inline text-[var(--dojo-text-sub)] truncate">
                        {t(`第 ${activeStage.chapterId} 關`)} · {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[var(--dojo-text-muted)]">·</span>
                      <span className="hidden md:inline text-[var(--dojo-text-sub)] truncate">
                        {t(`第 ${activeStage.chapterId} 關 · 全字根`)} · {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  )}
                </>
              ) : chamberXrayMode?.active ? (
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
                      : t(MODE_OPTIONS.find((m) => m.id === mode)?.label ?? '')}
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

            {/* Tabular telemetry meters */}
            <div className="shrink-0 flex items-center gap-3 xl:gap-4 text-xs font-mono-tabular whitespace-nowrap">
              <div className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[var(--dojo-text-muted)] font-sans">{t('得分')}</span>
                <span className="text-sm font-semibold text-[var(--dojo-text-bright)]">{hud.score}</span>
              </div>

              <div className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[var(--dojo-text-muted)] font-sans">{t('連擊')}</span>
                <span
                  className={`text-sm font-semibold ${
                    hud.combo >= 10
                      ? 'text-[var(--dojo-ochre)]'
                      : hud.combo >= 3
                        ? 'text-[var(--dojo-pine-text)]'
                        : 'text-[var(--dojo-text-sub)]'
                  }`}
                >
                  {hud.combo}x
                </span>
              </div>

              <div className="hidden sm:flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[var(--dojo-text-muted)] font-sans">{t('均速')}</span>
                <span className="text-sm font-semibold text-[var(--dojo-text)]">
                  {hud.avgKeyMs > 0 ? `${hud.avgKeyMs}ms` : '--'}
                </span>
              </div>

              <div className="hidden md:flex items-baseline gap-1 whitespace-nowrap">
                <span className="text-[var(--dojo-text-muted)] font-sans">{t('準確')}</span>
                <span className="text-sm font-semibold text-[var(--dojo-text)]">{hud.accuracy}%</span>
              </div>

              {(mode === 'arcade' || (activeStage?.isBossTrial && !isWeakDrill)) && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span className="text-[var(--dojo-text-muted)] font-sans">{t('墨印')}</span>
                  <div className="flex items-center gap-1" aria-label={t(`剩餘 ${hud.lives} 點墨印`)}>
                    {Array.from({ length: hud.maxLives }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-[2px] ${
                          i < hud.lives ? 'bg-[var(--dojo-crimson)]' : 'bg-[var(--dojo-border-strong)]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(mode !== 'arcade' || Boolean(activeStage)) && (
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-[var(--dojo-text-muted)] font-sans">{t('進度')}</span>
                  <span className="text-sm font-semibold text-[var(--dojo-text)]">
                    {hud.cleared}/{hud.targetGoal}
                  </span>
                </div>
              )}
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
                isBossTrial={Boolean(activeStage?.isBossTrial && !isWeakDrill)}
                arcadeGoal={activeStage?.mode === 'arcade' ? activeStage.targetGoal : 0}
                stageKind={activeStage?.kind}
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
          aria-label={t('遊戲暫停')}
        >
          <div className="wash-enter w-full max-w-md max-h-[90vh] overflow-y-auto bg-[var(--dojo-surface)] wash:bg-[#F5F3EE]/96 border border-[var(--dojo-border)] rounded-xl p-6 shadow-2xl wash:shadow-[0_18px_50px_rgba(20,20,18,0.18)]">
            <h2 className="font-display text-2xl font-bold text-[var(--dojo-text-bright)]">{t('暫停鍛煉')}</h2>
            <p className="text-xs text-[var(--dojo-text-sub)] mt-1">
              {activeStage
                ? `${t(activeStage.indexLabel)} · ${t(activeStage.title)}`
                : `${t(activeScheme.name)} · ${t(layoutMode === 'depth' ? '疊層景深（零掃視）' : '上下分區')}`}
            </p>

            <div className="grid grid-cols-3 gap-3 my-5 py-4 border-y border-[var(--dojo-border)] text-center font-mono-tabular">
              <div>
                <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('得分')}</div>
                <div className="text-lg font-bold text-[var(--dojo-text-bright)] mt-0.5">{hud.score}</div>
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

            {!activeStage && !singleChamberKey && !chamberXrayMode?.active && (
              <div className="mb-4">
                <div className="text-xs text-[var(--dojo-text-sub)] mb-2">{t('切換鍛煉模式')}</div>
                <div className="grid grid-cols-3 gap-1.5">
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

            {activeScheme.isLingming && !activeStage && !singleChamberKey && !chamberXrayMode?.active && (
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
                  activeStage
                    ? launchCampaignStage(activeStage)
                    : chamberXrayMode?.active
                      ? handleLaunchChamberXrayDrill(
                          chamberXrayMode.key,
                          scaffoldMode === 'blind',
                          chamberReturnTo
                        )
                      : startPlay(mode, focusKeys)
                }
                className="w-full py-2.5 text-sm font-medium bg-[var(--dojo-surface-2)] hover:brightness-105 text-[var(--dojo-text)] rounded-lg transition-colors cursor-pointer"
              >
                {t(
                  activeStage
                    ? '重新開始本節'
                    : chamberXrayMode?.active
                      ? '換一批隨機漢字重練'
                      : '重新開始本局'
                )}
              </button>
              {(activeStage || singleChamberKey || chamberXrayMode?.active) && (
                <button
                  type="button"
                  onClick={() =>
                    setGameState(
                      playReturnTo === 'NOVICE_ACADEMY'
                        ? 'NOVICE_ACADEMY'
                        : activeStage
                          ? 'CAMPAIGN_MAP'
                          : chamberReturnTo
                    )
                  }
                  className="w-full py-2.5 text-xs font-medium bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] rounded-lg transition-colors cursor-pointer"
                >
                  {t(
                    playReturnTo === 'NOVICE_ACADEMY'
                      ? '返回新手速成學院'
                      : activeStage
                        ? '返回五重關卡卷軸'
                        : chamberReturnTo === 'CAMPAIGN_MAP'
                          ? chamberXrayMode?.active
                            ? '返回五重關卡卷軸'
                            : '返回第三關逐鍵巡禮'
                          : '返回記憶宮殿雲圖'
                  )}
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
                onClick={() => setGameState(playReturnTo)}
                className="w-full py-1.5 text-xs font-medium text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
              >
                {t(playReturnTo === 'NOVICE_ACADEMY' ? '返回速成學院' : '返回主畫面')}
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
                  {activeStage
                    ? isWeakDrill
                      ? `${t(activeStage.indexLabel)} · ${t('弱點複訓完成')}`
                      : gameState === 'GAME_OVER'
                        ? `${t(activeStage.title)} · ${t('墨印耗盡')}`
                        : activeStage.isBossTrial
                          ? `${t(activeStage.title)} · ${t('檢定通過')}`
                          : `${t(activeStage.indexLabel)} · ${t(activeStage.title)} ${t('完成')}`
                    : chamberXrayMode?.active
                      ? chamberXrayMode.key
                        ? `${chamberXrayMode.key.toUpperCase()} ${t('鍵宮殿 · 字中辨根完成')}`
                        : t('全宮殿隨機字中辨根完成')
                      : singleChamberKey
                        ? `${singleChamberKey.toUpperCase()} ${t('鍵宮殿第')} ${
                            campaignProgress.chambers[singleChamberKey]?.clears || 1
                          } ${t('遍完成')}`
                        : gameState === 'GAME_OVER'
                          ? t('墨印耗盡 · 本陣結束')
                          : t('鍛煉完成 · 肌肉記憶已記錄')}
                </h2>
                <p className="text-xs text-[var(--dojo-text-sub)] mt-1 font-mono-tabular">
                  {activeStage
                    ? `${roundResult.cleared} ${t('題')} · ${t('耗時')} ${roundResult.durationSec} ${t('秒')}${
                        lastStageBadge?.isNewRecord ? ` · ${t('刷新紀錄')}` : ''
                      }`
                    : chamberXrayMode?.active
                      ? `${roundResult.cleared} ${t('個隨機載體漢字')} · ${t('準確率')} ${roundResult.accuracy}% · ${t('均速')} ${roundResult.avgKeyMs || '--'}ms`
                      : singleChamberKey
                        ? `${roundResult.cleared} ${t('個字根')} · ${t('準確率')} ${roundResult.accuracy}% · ${t('均速')} ${roundResult.avgKeyMs || '--'}ms`
                        : `${t(activeScheme.shortName)} · ${t('耗時')} ${roundResult.durationSec} ${t('秒')}`}
                </p>
              </div>

              {activeStage && !isWeakDrill && lastStageBadge ? (
                <div className="flex items-center gap-1 shrink-0 pt-1" aria-label={t(`獲得 ${lastStageBadge.earnedStars} 星`)}>
                  {[1, 2, 3].map((n) => (
                    <Star
                      key={n}
                      className={`w-5 h-5 ${
                        n <= lastStageBadge.earnedStars
                          ? activeStage.isBossTrial
                            ? 'fill-[var(--dojo-crimson)] text-[var(--dojo-crimson)]'
                            : 'fill-[var(--dojo-ochre)] text-[var(--dojo-ochre)]'
                          : 'text-[var(--dojo-border-strong)]'
                      }`}
                    />
                  ))}
                </div>
              ) : (
                roundResult.promotedCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dojo-pine)] whitespace-nowrap">
                    <Sparkles className="w-4 h-4" />
                    <span>{roundResult.promotedCount} {t('項晉級')}</span>
                  </div>
                )
              )}
            </div>

            {/* When finishing a single Palace Chamber (isolated root mode), render the completed Stroke Cloud */}
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
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('總分')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-text-bright)] mt-0.5">{roundResult.score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('最高連擊')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-ochre)] mt-0.5">
                      {roundResult.maxCombo}x
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('準確率')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-pine)] mt-0.5">
                      {roundResult.accuracy}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--dojo-text-muted)] font-sans">{t('均鍵反應')}</div>
                    <div className="text-xl font-bold text-[var(--dojo-text)] mt-0.5">
                      {roundResult.avgKeyMs > 0 ? `${roundResult.avgKeyMs}ms` : '--'}
                    </div>
                  </div>
                </div>

                {activeStage || chamberXrayMode?.active ? (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs mb-2.5">
                      <span className="font-medium text-[var(--dojo-text-sub)]">
                        {t(chamberXrayMode?.active ? '本輪易錯與慢反應字根' : '本節錯題與慢鍵診斷')}
                      </span>
                      {activeStage ? (
                        <span className="font-mono-tabular text-[var(--dojo-text-muted)]">
                          {t('三星條件')} ≥{activeStage.threeStarAccuracy}% · ≤{activeStage.threeStarAvgMs}ms
                        </span>
                      ) : (
                        <span className="font-mono-tabular text-[var(--dojo-text-muted)]">
                          {t('每次重練隨機抽取不同漢字載體')}
                        </span>
                      )}
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
                                {wk.errors > 0 ? `${t('錯')} ${wk.errors} ${t('次')}` : `${wk.avgMs}ms`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-3 px-3.5 rounded-lg bg-[var(--dojo-pine-wash)] border border-[var(--dojo-pine)]/25 text-xs text-[var(--dojo-pine-text)]">
                        {t('本節節奏流暢且無明顯誤按，條件反射已穩定成型。')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-xs font-medium text-[var(--dojo-text-sub)] mb-2.5">
                      {t('記憶曲線診斷 · 最需強化的 5 個宮殿鍵位')}
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

            {/* Campaign Stage Summary Actions vs Single Chamber vs Free Play */}
            {activeStage ? (
              (() => {
                const weakList = roundResult.weakEntries ?? [];
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {nextProgression.isBoss ? (
                          <Shield className="w-4 h-4" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                        <span>
                          {nextProgression.label}
                          {countdownSuffix}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => launchCampaignStage(activeStage)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('再戰本節（Enter）')}</span>
                      </button>
                    )}

                    {weakList.length > 0 && !isWeakDrill && (
                      <button
                        type="button"
                        onClick={() => launchWeakDrill(weakList)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[var(--dojo-pine)] hover:brightness-110 text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Target className="w-4 h-4" />
                        <span>{t('針對弱點複訓')}</span>
                      </button>
                    )}

                    {nextProgression && (
                      <button
                        type="button"
                        onClick={() => launchCampaignStage(activeStage)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[var(--dojo-surface-2)] hover:brightness-105 text-[var(--dojo-text)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('重練沖星')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setGameState(playReturnTo === 'NOVICE_ACADEMY' ? 'NOVICE_ACADEMY' : 'CAMPAIGN_MAP')
                      }
                      className="py-2.5 px-3 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t(playReturnTo === 'NOVICE_ACADEMY' ? '返回速成學院' : '返回卷軸地圖')}
                    </button>
                  </div>
                );
              })()
            ) : chamberXrayMode?.active ? (
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
                      {t(chamberReturnTo === 'CAMPAIGN_MAP' ? '返回關卡卷軸' : '返回雲圖')}
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
                      {t(
                        chamberReturnTo === 'CAMPAIGN_MAP'
                          ? '返回第三關逐鍵'
                          : chamberReturnTo === 'NOVICE_ACADEMY'
                            ? '返回速成學院'
                            : '返回雲圖'
                      )}
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
                        <span>{t('弱鍵突擊')}</span>
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
                      onClick={() => setGameState(playReturnTo)}
                      className="py-2.5 px-3 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t(playReturnTo === 'NOVICE_ACADEMY' ? '返回速成學院' : '主畫面')}
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
