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
import { ExtremeDrillStudio } from './components/ExtremeDrillStudio';
import { synth } from './audio/synth';
import { speech } from './audio/speech';

type GameState =
  | 'TITLE_MENU'
  | 'CAMPAIGN_MAP'
  | 'PALACE_CLOUD'
  | 'DRILL_STUDIO'
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
    'TITLE_MENU' | 'CAMPAIGN_MAP' | 'PLAYING'
  >('TITLE_MENU');
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
  const [activeStage, setActiveStage] = useState<CampaignStage | null>(null);
  const [activeCustomDeck, setActiveCustomDeck] = useState<GlyphEntry[] | null>(null);
  const [isWeakDrill, setIsWeakDrill] = useState(false);
  const [lastStageBadge, setLastStageBadge] = useState<{
    earnedStars: 0 | 1 | 2 | 3;
    isNewRecord: boolean;
  } | null>(null);

  const [focusKeys, setFocusKeys] = useState<string[] | null>(null);
  const [chamberReturnTo, setChamberReturnTo] = useState<'CAMPAIGN_MAP' | 'PALACE_CLOUD'>('PALACE_CLOUD');
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
        } else {
          setResetSignal((n) => n + 1);
          setGameState('PLAYING');
        }
      }
    },
    [activeStage, gameState, launchCampaignStage]
  );

  const launchWeakDrill = useCallback((weakEntries: WeakEntryInfo[]) => {
    synth.playClick();
    const deck = buildWeakSpotDrillDeck(
      weakEntries.map((w) => w.entry),
      12
    );
    if (deck.length === 0) return;
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
      setRoundResult(result);
      setAutoAdvancePaused(false);
      setAutoAdvanceSec(result.weakEntries && result.weakEntries.length > 0 ? 6 : 4);
      setGameState(result.reason === 'gameover' ? 'GAME_OVER' : 'ROUND_SUMMARY');
    },
    [activeScheme.isLingming, activeStage, campaignProgress, focusKeys, isWeakDrill, scaffoldMode]
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

  const openPalaceCloud = (from: 'TITLE_MENU' | 'CAMPAIGN_MAP' | 'PLAYING') => {
    synth.playClick();
    if (!activeScheme.isLingming) {
      switchScheme(BUILTIN_SCHEMES[0]);
    }
    setReturnStateFromPalace(from);
    setGameState('PALACE_CLOUD');
  };

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
      from: 'CAMPAIGN_MAP' | 'PALACE_CLOUD' = 'PALACE_CLOUD'
    ) => {
      if (!activeScheme.isLingming) {
        switchScheme(BUILTIN_SCHEMES[0]);
      }
      setChamberReturnTo(from);
      startPlay(
        'reflex',
        chamberKey ? [chamberKey] : [],
        scope,
        blind ? 'blind' : 'adaptive'
      );
    },
    [activeScheme.isLingming, startPlay, switchScheme]
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
    focusKeys,
    gameState,
    handleLaunchChamberDrill,
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

  const rawEchoChamberKey = useMemo(() => {
    if (!activeScheme.isLingming || mode === 'arcade' || !target || target.typed.length < 1) {
      return null;
    }
    const candidate = target.palace?.chamberKey || target.code[0];
    return LINGMING_CHAMBER_BY_KEY[candidate] ? candidate : null;
  }, [activeScheme.isLingming, mode, target]);

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

  const showCloudEcho = Boolean(rawEchoChamberKey && gameState === 'PLAYING');

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
    mode,
    focusKeys,
    activeStage,
    launchCampaignStage,
    startPlay,
    autoAdvanceEnabled,
    autoAdvancePaused,
  ]);

  return (
    <UiScriptContext.Provider value={uiScript}>
    <div className="relative w-screen h-screen overflow-hidden bg-[#0B0F17] text-[#F2EEE6] flex flex-col">
      {/* ==================== TITLE SCREEN ==================== */}
      {gameState === 'TITLE_MENU' && (
        <div className="relative w-full h-full flex flex-col justify-between overflow-hidden">
          {!heroImgFailed ? (
            <img
              src={TITLE_ART_URL}
              alt={t('墨鍵道場木質書桌與機械鍵盤')}
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#121722] via-[#171D29] to-[#0E1218]" />
          )}

          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(11,14,20,0.95) 0%, rgba(11,14,20,0.82) 44%, rgba(11,14,20,0.22) 76%, rgba(11,14,20,0.14) 100%)',
            }}
          />

          {/* Top quiet status & audio row */}
          <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-6">
            <div className="flex items-center gap-3 text-xs text-[#9FA8B8]">
              <span className="text-[#E5E0D5] font-medium">{t(activeScheme.shortName)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-[#D89B3C]">
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
              <button
                type="button"
                onClick={toggleSpeech}
                title={t('開關字根代表性發音朗讀')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  speechEnabled
                    ? 'bg-[#14201E]/85 hover:bg-[#1B2B28] border-[#2EA87E]/35 text-[#88DEC0]'
                    : 'bg-[#151A24]/85 hover:bg-[#1F2736] border-[#F2EEE6]/10 text-[#9AA3B2]'
                }`}
              >
                <AudioLines className="w-3.5 h-3.5" />
                <span>{t(speechEnabled ? '字根發音：開' : '字根發音：關')}</span>
              </button>
              <button
                type="button"
                onClick={toggleMute}
                title={t(muted ? '按鍵音效：已關閉（預設靜音，點擊開啟）' : '按鍵音效：已開啟（點擊關閉）')}
                aria-label={t(muted ? '開啟按鍵音效' : '關閉按鍵音效')}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#151A24]/85 hover:bg-[#1F2736] border border-[#F2EEE6]/10 text-[#C8C3B8] transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Center-left Hero Lockup — Brand + 3 Primary Entries */}
          <div className="relative z-10 px-6 sm:px-10 my-auto max-w-2xl">
            <svg
              viewBox="0 0 430 92"
              className="w-full max-w-[400px] h-auto mb-8"
              aria-label={t('墨鍵道場 · 靈明記憶宮殿')}
            >
              <rect
                x="2"
                y="12"
                width="54"
                height="54"
                rx="6"
                fill="#C93E2D"
                stroke="#E8715F"
                strokeWidth="1.5"
              />
              <rect
                x="7"
                y="17"
                width="44"
                height="44"
                rx="3"
                fill="none"
                stroke="#F5EFE6"
                strokeOpacity="0.65"
                strokeWidth="1"
              />
              <text
                x="29"
                y="48"
                textAnchor="middle"
                fill="#F7F3EC"
                fontSize="26"
                fontWeight="700"
                fontFamily="'Noto Serif TC', serif"
              >
                {t('靈')}
              </text>

              <text
                x="74"
                y="50"
                fill="#F6F2EA"
                fontSize="44"
                fontWeight="700"
                letterSpacing="4"
                fontFamily="'Noto Serif TC', serif"
              >
                {t('墨鍵道場')}
              </text>

              <line x1="74" y1="66" x2="128" y2="66" stroke="#D89B3C" strokeWidth="1.5" />
              <text
                x="138"
                y="70"
                fill="#B8B0A0"
                fontSize="13"
                letterSpacing="1.8"
                fontFamily="'Plus Jakarta Sans', sans-serif"
              >
                {t('靈明輸入法 · 記憶宮殿與零掃視訓練')}
              </text>
            </svg>

            {/* Three Primary Entries */}
            <div className="grid grid-cols-1 sm:grid-cols-3 items-stretch gap-3 max-w-2xl">
              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setGameState('CAMPAIGN_MAP');
                }}
                className="flex flex-col items-start justify-center gap-1 px-5 py-4 bg-[#D94A38] hover:bg-[#E45643] active:scale-[0.99] text-white rounded-xl shadow-lg transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2 text-base font-bold whitespace-nowrap">
                  <MapIcon className="w-4 h-4 shrink-0" />
                  <span>{t('五重道場闖關')}</span>
                </div>
                <span className="text-xs text-white/80 font-mono-tabular whitespace-nowrap">
                  {t('循序破關')} · {t(campaignSummary.nextRecommendedStage.indexLabel)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => startPlay(mode)}
                className="flex flex-col items-start justify-center gap-1 px-5 py-4 bg-[#161D2A]/92 hover:bg-[#1E2738] active:scale-[0.99] border border-[#F2EEE6]/16 text-[#F2EEE6] rounded-xl transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2 text-base font-bold whitespace-nowrap">
                  <Play className="w-4 h-4 fill-current text-[#2EA87E] shrink-0" />
                  <span>{t('自由鍛煉')}</span>
                </div>
                <span className="text-xs text-[#9AA3B2] whitespace-nowrap">
                  {t(MODE_OPTIONS.find((m) => m.id === mode)?.label ?? '記憶宮殿反射')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  synth.playClick();
                  setGameState('DRILL_STUDIO');
                }}
                className="flex flex-col items-start justify-center gap-1 px-5 py-4 bg-[#161D2A]/92 hover:bg-[#1E2738] active:scale-[0.99] border border-[#D89B3C]/35 text-[#F2EEE6] rounded-xl transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2 text-base font-bold whitespace-nowrap">
                  <Flame className="w-4 h-4 text-[#D89B3C] shrink-0" />
                  <span>{t('極限苦練室')}</span>
                </div>
                <span className="text-xs text-[#C8B58A] font-mono-tabular whitespace-nowrap">
                  {Object.keys(mastery.slowGlyphs || {}).length > 0
                    ? `${t('實戰盲打')} · ${t('慢字')} ${Object.keys(mastery.slowGlyphs || {}).length}`
                    : `${t('實戰連打')} · ${t('抓慢回爐')}`}
                </span>
              </button>
            </div>
          </div>

          {/* Quiet bottom line */}
          <div className="relative z-10 px-6 sm:px-10 pb-5 flex items-center justify-between text-xs text-[#8D96A6]">
            <span>{t('Enter / Space 進入五重道場')}</span>
            <span className="hidden sm:inline font-mono-tabular text-[#6F7888]">
              {t('最高紀錄')} {mastery.bestScore}
            </span>
          </div>
        </div>
      )}

      {/* ==================== 5-CHAPTER CAMPAIGN SCROLL MAP ==================== */}
      {gameState === 'CAMPAIGN_MAP' && (
        <CampaignMapView
          progress={campaignProgress}
          scriptMode={scriptMode}
          initialChapterId={
            activeStage?.chapterId ??
            (chamberReturnTo === 'CAMPAIGN_MAP' && singleChamberKey ? 3 : undefined)
          }
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          onBackToTitle={() => setGameState('TITLE_MENU')}
          onOpenPalaceCloud={() => openPalaceCloud('CAMPAIGN_MAP')}
          onLaunchStage={launchCampaignStage}
          onLaunchChamberDrill={(key, scope, blind) =>
            handleLaunchChamberDrill(key, scope, blind, 'CAMPAIGN_MAP')
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
          speechEnabled={speechEnabled}
          onToggleSpeech={toggleSpeech}
          onBack={() => setGameState(returnStateFromPalace)}
          onLaunchChamberDrill={(key, scope, blind) =>
            handleLaunchChamberDrill(key, scope, blind, 'PALACE_CLOUD')
          }
        />
      )}

      {/* ==================== EXTREME DELIBERATE PRACTICE STUDIO ==================== */}
      {gameState === 'DRILL_STUDIO' && (
        <ExtremeDrillStudio
          mastery={mastery}
          onMasteryChange={handleMasteryChange}
          scriptMode={scriptMode}
          onChangeScriptMode={(next) => handleChangeScriptMode(next)}
          muted={muted}
          onToggleMute={toggleMute}
          onBack={() => setGameState('TITLE_MENU')}
        />
      )}

      {/* ==================== ACTIVE PLAY SHELL ==================== */}
      {gameState !== 'TITLE_MENU' &&
        gameState !== 'CAMPAIGN_MAP' &&
        gameState !== 'PALACE_CLOUD' &&
        gameState !== 'DRILL_STUDIO' && (
        <div className="w-full h-full flex flex-col">
          {/* Compact low-occlusion perimeter HUD */}
          <header className="shrink-0 h-12 px-4 sm:px-6 bg-[#0B0E15] border-b border-[#F2EEE6]/8 flex items-center justify-between gap-3 z-30">
            <div className="flex items-center gap-2 text-xs min-w-0">
              {activeStage ? (
                <>
                  <span className="font-display text-sm font-bold text-[#F5F1E8] whitespace-nowrap">
                    {t(activeStage.indexLabel)} · {t(activeStage.title)}
                  </span>
                  {isWeakDrill ? (
                    <>
                      <span aria-hidden="true" className="text-[#505868]">·</span>
                      <span className="text-[#34D399] whitespace-nowrap">{t('弱點複訓')}</span>
                    </>
                  ) : activeStage.chapterId === 4 ? (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[#505868]">·</span>
                      <span className="hidden md:inline text-[#D89B3C] truncate">
                        {t('僅輸入高亮筆畫字根全碼')} · {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  ) : activeStage.chapterId === 2 || activeStage.chapterId === 5 ? (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[#505868]">·</span>
                      <span className="hidden md:inline text-[#9BA3B2] truncate">
                        {t(`第 ${activeStage.chapterId} 關`)} · {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[#505868]">·</span>
                      <span className="hidden md:inline text-[#9BA3B2] truncate">
                        {t(`第 ${activeStage.chapterId} 關 · 全字根`)} · {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="font-display text-sm font-bold text-[#F5F1E8] whitespace-nowrap">
                    {singleChamberKey
                      ? `${singleChamberKey.toUpperCase()} ${t('鍵宮殿')}（${
                          LINGMING_CHAMBER_BY_KEY[singleChamberKey]?.primaryAnchor || ''
                        }）`
                      : t(MODE_OPTIONS.find((m) => m.id === mode)?.label ?? '')}
                  </span>
                  <span aria-hidden="true" className="text-[#505868]">·</span>
                  <span className="text-[#9BA3B2] truncate">
                    {singleChamberKey ? t('逐鍵巡禮') : t(activeScheme.shortName)}
                  </span>
                  {activeScheme.isLingming && singleChamberKey && (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[#505868]">·</span>
                      <span className="hidden md:inline text-[#7CE5BC] whitespace-nowrap">
                        {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  )}
                  {activeScheme.isLingming && !singleChamberKey && (
                    <>
                      <span aria-hidden="true" className="hidden md:inline text-[#505868]">·</span>
                      <span className="hidden md:inline text-[#D89B3C] whitespace-nowrap">
                        {t(SCOPE_OPTIONS.find((s) => s.id === trainingScope)?.label ?? '')}
                      </span>
                      <span aria-hidden="true" className="hidden lg:inline text-[#505868]">·</span>
                      <span className="hidden lg:inline text-[#7CE5BC] whitespace-nowrap">
                        {t(SCRIPT_MODE_LABELS[scriptMode])}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Tabular telemetry meters */}
            <div className="flex items-center gap-3.5 sm:gap-5 text-xs font-mono-tabular">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[#7D8696] font-sans">{t('得分')}</span>
                <span className="text-sm font-semibold text-[#F5F1E8]">{hud.score}</span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-[#7D8696] font-sans">{t('連擊')}</span>
                <span
                  className={`text-sm font-semibold ${
                    hud.combo >= 10
                      ? 'text-[#D89B3C]'
                      : hud.combo >= 3
                        ? 'text-[#2EA87E]'
                        : 'text-[#C8C3B8]'
                  }`}
                >
                  {hud.combo}x
                </span>
              </div>

              <div className="hidden sm:flex items-baseline gap-1.5">
                <span className="text-[#7D8696] font-sans">{t('均速')}</span>
                <span className="text-sm font-semibold text-[#E5E0D5]">
                  {hud.avgKeyMs > 0 ? `${hud.avgKeyMs}ms` : '--'}
                </span>
              </div>

              <div className="hidden md:flex items-baseline gap-1.5">
                <span className="text-[#7D8696] font-sans">{t('準確')}</span>
                <span className="text-sm font-semibold text-[#E5E0D5]">{hud.accuracy}%</span>
              </div>

              {(mode === 'arcade' || (activeStage?.isBossTrial && !isWeakDrill)) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[#7D8696] font-sans">{t('墨印')}</span>
                  <div className="flex items-center gap-1" aria-label={t(`剩餘 ${hud.lives} 點墨印`)}>
                    {Array.from({ length: hud.maxLives }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-[2px] ${
                          i < hud.lives ? 'bg-[#D94A38]' : 'bg-[#F2EEE6]/12'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(mode !== 'arcade' || Boolean(activeStage)) && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[#7D8696] font-sans">{t('進度')}</span>
                  <span className="text-sm font-semibold text-[#E5E0D5]">
                    {hud.cleared}/{hud.targetGoal}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Functional controls including instant Depth/Split A-B comparison! */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleLayoutMode}
                title={t('即時對比「疊層景深零掃視」與「上下分區」')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#CFE0F5] hover:text-white bg-[#151D2B] hover:bg-[#1F2B40] border border-[#4F86C6]/35 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#58A6E0]" />
                <span className="hidden lg:inline">
                  {t(layoutMode === 'depth' ? 'Alice 景深' : '上下分區')}
                </span>
              </button>

              {activeScheme.isLingming && (
                <button
                  type="button"
                  onClick={() => openPalaceCloud('PLAYING')}
                  title={t('查看筆畫鍵位雲圖記憶宮殿')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#E8C57B] hover:text-white bg-[#171D28] hover:bg-[#232C3D] border border-[#D89B3C]/35 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-[#D89B3C]" />
                  <span className="hidden sm:inline">{t('雲圖')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleHideCodeHints}
                title={t(hideCodeHints ? '目前隱藏下方鍵碼槽（按 Tab 可臨時偷看），點擊顯示' : '隱藏下方鍵位編碼槽，保持極簡勿打擾')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  hideCodeHints
                    ? 'bg-[#17252B] hover:bg-[#1F323A] border-[#38A885]/45 text-[#7CE5BC]'
                    : 'bg-[#161B24] hover:bg-[#202735] border-[#F2EEE6]/10 text-[#C8C3B8]'
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border bg-[#161B24] hover:bg-[#202735] border-[#F2EEE6]/10 text-[#C8C3B8] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#7CE5BC]" />
                  <span className="hidden xl:inline">
                    {t(cloudEchoMotion === 'fade' ? '雲圖漸顯' : '鍵位放大')}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={cycleScaffold}
                title={t('切換漸隱 / 默背模式')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#C8C3B8] hover:text-[#F5F1E8] bg-[#161B24] hover:bg-[#202735] border border-[#F2EEE6]/10 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                {scaffoldMode === 'blind' ? (
                  <EyeOff className="w-3.5 h-3.5 text-[#2EA87E]" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-[#D89B3C]" />
                )}
                <span className="hidden xl:inline">{t(SCAFFOLD_LABELS[scaffoldMode])}</span>
              </button>

              <button
                type="button"
                onClick={() => setHintPulseTick((t) => t + 1)}
                title={t('瞬間拉焦顯示提示 (Tab)')}
                className="px-2.5 py-1.5 text-xs font-medium text-[#9BA3B2] hover:text-[#F5F1E8] bg-[#161B24] hover:bg-[#202735] border border-[#F2EEE6]/10 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                {t('拉焦')}
              </button>

              <button
                type="button"
                onClick={toggleSpeech}
                title={t(speechEnabled ? '關閉字根發音朗讀' : '開啟字根發音朗讀')}
                aria-label={t(speechEnabled ? '關閉字根發音' : '開啟字根發音')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                  speechEnabled
                    ? 'bg-[#142722] hover:bg-[#1B352E] border-[#2EA87E]/45 text-[#7CE5BC]'
                    : 'bg-[#161B24] hover:bg-[#202735] border-[#F2EEE6]/10 text-[#7F8898]'
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
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#9BA3B2] hover:text-[#F5F1E8] hover:bg-[#1E2430] transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() =>
                  setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'))
                }
                aria-label={t('暫停')}
                className="w-8 h-8 flex items-center justify-center rounded-md text-[#9BA3B2] hover:text-[#F5F1E8] hover:bg-[#1E2430] transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ==================== UNIFIED STAGE ==================== */}
          <main ref={stageRef} className="flex-1 min-h-0 relative overflow-hidden bg-[#0B0F17]">
            {/* Layer 0: Alice Split Keyboard backdrop */}
            {layoutMode === 'depth' && (
              <div className="absolute inset-0 z-10">
                <BlurredKeyboardBackdrop
                  scheme={activeScheme}
                  target={target}
                  mastery={mastery}
                />
              </div>
            )}

            {/* Layer 1: Reactive Key-1 Memory Palace Cloud Stimulus — pure原地漸顯 or Alice 鍵位放大 */}
            {activeScheme.isLingming && mode !== 'arcade' && echoMemory && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 z-[15] flex items-center justify-center will-change-transform"
                style={{
                  top:
                    layoutMode === 'depth'
                      ? `calc(${depthMetrics.centerYRatio * 100}% + ${depthMetrics.glyphYOffset}px)`
                      : 'calc(48% - 16px)',
                  width: layoutMode === 'depth' ? `${depthMetrics.echoBoxSize}px` : '900px',
                  height: layoutMode === 'depth' ? `${depthMetrics.echoBoxSize}px` : '900px',
                  opacity: !showCloudEcho ? 0 : echoPose.settled ? 1 : cloudEchoMotion === 'keyzoom' ? 0.08 : 0,
                  transform:
                    !showCloudEcho || echoPose.settled || cloudEchoMotion === 'fade'
                      ? 'translate(-50%, -50%) scale(1)'
                      : `translate(calc(-50% + ${echoPose.startDx.toFixed(1)}px), calc(-50% + ${echoPose.startDy.toFixed(1)}px)) scale(${echoPose.startScale})`,
                  transition: !showCloudEcho
                    ? 'opacity 140ms ease-out'
                    : echoPose.settled
                      ? cloudEchoMotion === 'keyzoom'
                        ? 'opacity 250ms ease-out, transform 340ms cubic-bezier(0.16, 1, 0.3, 1)'
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

            {/* Layer 2 (Foreground · Crisp Warm-Ivory 60fps Interactive Canvas) */}
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/72 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('遊戲暫停')}
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#151A24] border border-[#F2EEE6]/12 rounded-xl p-6 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-[#F5F1E8]">{t('暫停鍛煉')}</h2>
            <p className="text-xs text-[#949DAD] mt-1">
              {activeStage
                ? `${t(activeStage.indexLabel)} · ${t(activeStage.title)}`
                : `${t(activeScheme.name)} · ${t(layoutMode === 'depth' ? '疊層景深（零掃視）' : '上下分區')}`}
            </p>

            <div className="grid grid-cols-3 gap-3 my-5 py-4 border-y border-[#F2EEE6]/8 text-center font-mono-tabular">
              <div>
                <div className="text-xs text-[#7F8898] font-sans">{t('得分')}</div>
                <div className="text-lg font-bold text-[#F5F1E8] mt-0.5">{hud.score}</div>
              </div>
              <div>
                <div className="text-xs text-[#7F8898] font-sans">{t('準確率')}</div>
                <div className="text-lg font-bold text-[#2EA87E] mt-0.5">{hud.accuracy}%</div>
              </div>
              <div>
                <div className="text-xs text-[#7F8898] font-sans">{t('均鍵延遲')}</div>
                <div className="text-lg font-bold text-[#D89B3C] mt-0.5">
                  {hud.avgKeyMs > 0 ? `${hud.avgKeyMs}ms` : '--'}
                </div>
              </div>
            </div>

            {!activeStage && !singleChamberKey && (
              <div className="mb-4">
                <div className="text-xs text-[#8F98A8] mb-2">{t('切換鍛煉模式')}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => startPlay(opt.id, null, trainingScope)}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        mode === opt.id
                          ? 'bg-[#262F40] border-[#D94A38]/70 text-[#F5F1E8]'
                          : 'bg-[#10141C] border-[#F2EEE6]/10 text-[#9BA3B2] hover:text-white'
                      }`}
                    >
                      {t(opt.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeScheme.isLingming && !activeStage && !singleChamberKey && (
              <div className="mb-4">
                <div className="text-xs text-[#8F98A8] mb-2">{t('切換靈明訓練層級')}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SCOPE_OPTIONS.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => startPlay(mode, focusKeys, sc.id)}
                      className={`py-2 px-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        trainingScope === sc.id
                          ? 'bg-[#1F2A38] border-[#D89B3C] text-[#F2D59B]'
                          : 'bg-[#10141C] border-[#F2EEE6]/10 text-[#9BA3B2] hover:text-white'
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
                <div className="text-xs text-[#8F98A8] mb-2">
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
                          ? 'bg-[#152823] border-[#2EA87E]/55 text-[#7CE5BC]'
                          : 'bg-[#10141C] border-[#F2EEE6]/10 text-[#9BA3B2] hover:text-white'
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
                className="w-full py-2.5 text-sm font-semibold bg-[#D94A38] hover:bg-[#E25644] text-white rounded-lg transition-colors cursor-pointer"
              >
                {t('繼續鍛煉')}
              </button>
              <button
                type="button"
                onClick={() => openPalaceCloud('PLAYING')}
                className="w-full py-2.5 text-sm font-medium bg-[#1B2230] hover:bg-[#252F42] border border-[#D89B3C]/35 text-[#F2D59B] rounded-lg transition-colors cursor-pointer"
              >
                {t('開啟筆畫鍵位雲圖 · 記憶宮殿')}
              </button>
              <button
                type="button"
                onClick={() =>
                  activeStage ? launchCampaignStage(activeStage) : startPlay(mode, focusKeys)
                }
                className="w-full py-2.5 text-sm font-medium bg-[#1E2533] hover:bg-[#273042] text-[#E5E0D5] rounded-lg transition-colors cursor-pointer"
              >
                {t(activeStage ? '重新開始本節' : '重新開始本局')}
              </button>
              {(activeStage || singleChamberKey) && (
                <button
                  type="button"
                  onClick={() => setGameState(activeStage ? 'CAMPAIGN_MAP' : chamberReturnTo)}
                  className="w-full py-2.5 text-xs font-medium bg-[#10141C] hover:bg-[#19202D] border border-[#F2EEE6]/10 text-[#C8C3B8] rounded-lg transition-colors cursor-pointer"
                >
                  {t(
                    activeStage
                      ? '返回五重關卡卷軸'
                      : chamberReturnTo === 'CAMPAIGN_MAP'
                        ? '返回第三關逐鍵巡禮'
                        : '返回記憶宮殿雲圖'
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={toggleHideCodeHints}
                className={`w-full py-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  hideCodeHints
                    ? 'bg-[#152823] hover:bg-[#1C352E] border-[#2EA87E]/45 text-[#7CE5BC]'
                    : 'bg-[#10141C] hover:bg-[#19202D] border-[#F2EEE6]/10 text-[#9BA3B2]'
                }`}
              >
                {t(hideCodeHints ? '下方鍵位提示：已隱藏（極簡勿打擾，按 Tab 偷看）' : '下方鍵位提示：已顯示（點擊隱藏）')}
              </button>
              {activeScheme.isLingming && (
                <button
                  type="button"
                  onClick={toggleCloudEchoMotion}
                  className="w-full py-2.5 text-xs font-medium rounded-lg border bg-[#10141C] hover:bg-[#19202D] border-[#F2EEE6]/10 text-[#C8C3B8] transition-colors cursor-pointer"
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
                    ? 'bg-[#152823] hover:bg-[#1C352E] border-[#2EA87E]/45 text-[#7CE5BC]'
                    : 'bg-[#10141C] hover:bg-[#19202D] border-[#F2EEE6]/10 text-[#9BA3B2]'
                }`}
              >
                {t(speechEnabled ? '字根代表發音：已開啟（點擊關閉）' : '字根代表發音：已關閉（點擊開啟）')}
              </button>
              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="w-full py-1.5 text-xs font-medium text-[#7D8696] hover:text-[#F5F1E8] transition-colors cursor-pointer"
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/78 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('回合結算')}
        >
          <div className="w-full max-w-lg bg-[#151A24] border border-[#F2EEE6]/12 rounded-xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#F5F1E8]">
                  {activeStage
                    ? isWeakDrill
                      ? `${t(activeStage.indexLabel)} · ${t('弱點複訓完成')}`
                      : gameState === 'GAME_OVER'
                        ? `${t(activeStage.title)} · ${t('墨印耗盡')}`
                        : activeStage.isBossTrial
                          ? `${t(activeStage.title)} · ${t('檢定通過')}`
                          : `${t(activeStage.indexLabel)} · ${t(activeStage.title)} ${t('完成')}`
                    : singleChamberKey
                      ? `${singleChamberKey.toUpperCase()} ${t('鍵宮殿第')} ${
                          campaignProgress.chambers[singleChamberKey]?.clears || 1
                        } ${t('遍完成')}`
                      : gameState === 'GAME_OVER'
                        ? t('墨印耗盡 · 本陣結束')
                        : t('鍛煉完成 · 肌肉記憶已記錄')}
                </h2>
                <p className="text-xs text-[#949DAD] mt-1 font-mono-tabular">
                  {activeStage
                    ? `${roundResult.cleared} ${t('題')} · ${t('耗時')} ${roundResult.durationSec} ${t('秒')}${
                        lastStageBadge?.isNewRecord ? ` · ${t('刷新紀錄')}` : ''
                      }`
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
                            ? 'fill-[#D94A38] text-[#D94A38]'
                            : 'fill-[#D89B3C] text-[#D89B3C]'
                          : 'text-[#313949]'
                      }`}
                    />
                  ))}
                </div>
              ) : (
                roundResult.promotedCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2EA87E] whitespace-nowrap">
                    <Sparkles className="w-4 h-4" />
                    <span>{roundResult.promotedCount} {t('項晉級')}</span>
                  </div>
                )
              )}
            </div>

            {/* When finishing a single Palace Chamber, render the full completed Stroke Cloud right inside the summary! */}
            {singleChamberKey ? (
              <div className="my-4 h-52 bg-[#0F141C] rounded-xl border border-[#F2EEE6]/8 flex items-center justify-center p-2">
                <StrokeCloudStage
                  chamberKey={singleChamberKey}
                  completedChars={completedChars}
                  variant="palace"
                  scriptMode={scriptMode}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5 py-4 border-y border-[#F2EEE6]/8 font-mono-tabular">
                  <div>
                    <div className="text-xs text-[#7F8898] font-sans">{t('總分')}</div>
                    <div className="text-xl font-bold text-[#F5F1E8] mt-0.5">{roundResult.score}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#7F8898] font-sans">{t('最高連擊')}</div>
                    <div className="text-xl font-bold text-[#D89B3C] mt-0.5">
                      {roundResult.maxCombo}x
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#7F8898] font-sans">{t('準確率')}</div>
                    <div className="text-xl font-bold text-[#2EA87E] mt-0.5">
                      {roundResult.accuracy}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#7F8898] font-sans">{t('均鍵反應')}</div>
                    <div className="text-xl font-bold text-[#E5E0D5] mt-0.5">
                      {roundResult.avgKeyMs > 0 ? `${roundResult.avgKeyMs}ms` : '--'}
                    </div>
                  </div>
                </div>

                {activeStage ? (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs mb-2.5">
                      <span className="font-medium text-[#B8BECA]">
                        {t('本節錯題與慢鍵診斷')}
                      </span>
                      <span className="font-mono-tabular text-[#7F8898]">
                        {t('三星條件')} ≥{activeStage.threeStarAccuracy}% · ≤{activeStage.threeStarAvgMs}ms
                      </span>
                    </div>

                    {roundResult.weakEntries && roundResult.weakEntries.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {roundResult.weakEntries.slice(0, 4).map((wk, idx) => {
                          const displayChar = wk.entry.xray?.radicalChar || wk.entry.char;
                          return (
                            <div
                              key={`${wk.entry.id}_${idx}`}
                              className="p-2.5 rounded-lg bg-[#10141C] border border-[#F2EEE6]/8 text-center"
                            >
                              <div className="font-display text-xl font-bold text-[#F5F1E8] leading-tight">
                                {displayChar}
                              </div>
                              <div className="font-mono-tabular text-xs font-bold text-[#D89B3C] mt-0.5">
                                {wk.entry.code.toUpperCase()}
                              </div>
                              <div className="font-mono-tabular text-[10px] text-[#8B93A3] mt-0.5">
                                {wk.errors > 0 ? `${t('錯')} ${wk.errors} ${t('次')}` : `${wk.avgMs}ms`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-3 px-3.5 rounded-lg bg-[#10161D] border border-[#2EA87E]/25 text-xs text-[#7CE5BC]">
                        {t('本節節奏流暢且無明顯誤按，條件反射已穩定成型。')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-xs font-medium text-[#B8BECA] mb-2.5">
                      {t('記憶曲線診斷 · 最需強化的 5 個宮殿鍵位')}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {weakestKeys.map((wk) => (
                        <div
                          key={wk.key}
                          className="p-2.5 rounded-lg bg-[#10141C] border border-[#F2EEE6]/8 text-center"
                        >
                          <div className="font-mono-tabular text-[11px] font-bold text-[#D89B3C]">
                            {wk.key.toUpperCase()}
                          </div>
                          <div className="font-display text-lg font-bold text-[#F5F1E8] leading-tight my-0.5">
                            {wk.primary}
                          </div>
                          <div className="font-mono-tabular text-[10px] text-[#8B93A3]">
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[#D94A38] hover:bg-[#E45643] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[#D94A38] hover:bg-[#E45643] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('再戰本節（Enter）')}</span>
                      </button>
                    )}

                    {weakList.length > 0 && !isWeakDrill && (
                      <button
                        type="button"
                        onClick={() => launchWeakDrill(weakList)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[#2EA87E] hover:bg-[#36BC8E] text-[#0A1410] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Target className="w-4 h-4" />
                        <span>{t('針對弱點複訓')}</span>
                      </button>
                    )}

                    {nextProgression && (
                      <button
                        type="button"
                        onClick={() => launchCampaignStage(activeStage)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[#1E2533] hover:bg-[#273042] text-[#F2EEE6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('重練沖星')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setGameState('CAMPAIGN_MAP')}
                      className="py-2.5 px-3 text-xs font-medium text-[#949DAD] hover:text-[#F5F1E8] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t('返回卷軸地圖')}
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[#2EA87E] hover:bg-[#36BC8E] text-[#0A1410] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[#1E2533] hover:bg-[#273042] text-[#F2EEE6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[#161C27] hover:bg-[#222B3C] border border-[#F2EEE6]/12 text-[#F2EEE6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <EyeOff className="w-4 h-4 text-[#D89B3C]" />
                      <span>{t(scaffoldMode === 'blind' ? '切回雲圖提示' : '換成默背')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGameState(chamberReturnTo)}
                      className="py-2.5 px-3 text-xs font-medium text-[#949DAD] hover:text-[#F5F1E8] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t(chamberReturnTo === 'CAMPAIGN_MAP' ? '返回第三關逐鍵' : '返回雲圖')}
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
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold bg-[#D94A38] hover:bg-[#E25644] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-semibold bg-[#D94A38] hover:bg-[#E25644] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
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
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[#2EA87E] hover:bg-[#36BC8E] text-[#0A1410] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Target className="w-4 h-4" />
                        <span>{t('弱鍵突擊')}</span>
                      </button>
                    )}

                    {nextProgression && (
                      <button
                        type="button"
                        onClick={() => startPlay(mode, focusKeys)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium bg-[#1E2533] hover:bg-[#273042] text-[#F2EEE6] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('再練本組')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setGameState('TITLE_MENU')}
                      className="py-2.5 px-3 text-xs font-medium text-[#949DAD] hover:text-[#F5F1E8] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {t('主畫面')}
                    </button>
                  </div>
                );
              })()
            )}

            {/* Quiet auto-advance footer strip when a next stage exists */}
            {gameState === 'ROUND_SUMMARY' && nextProgression && (
              <div className="mt-3 pt-2.5 border-t border-[#F2EEE6]/8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#848E9F]">
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
                      className="text-[#D89B3C] hover:text-[#F2D59B] transition-colors cursor-pointer"
                    >
                      {t('停在本頁 (Esc)')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleAutoAdvance}
                    className="text-[#949DAD] hover:text-[#F5F1E8] transition-colors cursor-pointer"
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
    </UiScriptContext.Provider>
  );
}
