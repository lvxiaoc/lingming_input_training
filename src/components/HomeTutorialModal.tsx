import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Flame,
  Keyboard,
  Map as MapIcon,
  Play,
  Route,
  X,
} from 'lucide-react';
import { StrokeCloudStage, StrokeCloudSelection } from './StrokeCloudStage';
import { PALACE_STROKE_SCHEMAS } from '../data/palaceStrokePaths';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import { ScriptMode } from '../data/scriptFilter';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';

export type TutorialTabId = 'palace' | 'path' | 'shortcuts';

interface PalaceExamplePreset {
  key: string;
  anchor: string;
  title: string;
  patternLabel: string;
  summary: string;
  steps: string[];
  hanziExamples: Array<{
    char: string;
    parts: string;
    code: string;
    note: string;
  }>;
}

const PALACE_EXAMPLE_PRESETS: PalaceExamplePreset[] = [
  {
    key: 'x',
    anchor: '木',
    title: 'X 鍵 · 木宮（簡潔入門）',
    patternLabel: '三筆開展 · 6 個高頻延伸字根',
    summary:
      '以最高頻主根「木」居中立柱，其餘字根依字頻由高至低順「上橫 → 左撇 → 右捺」自然落位，一眼即可建立整座宮殿的空間座標。',
    steps: [
      '上橫起勢：先落「朩（xu）」與高頻字根「里（xli）」，承托左右兩肩。',
      '左撇延展：順左斜撇收錄「匚（xfa）」及其變體，貼合撇畫走勢。',
      '右捺收尾：沿右捺向下舒展「習（xi）」與「甲（xja）」，形成清晰三角記憶面。',
    ],
    hanziExamples: [
      { char: '本', parts: '木 + 一', code: 'xfi', note: '直接聯想 X 鍵木宮主根' },
      { char: '林', parts: '木 + 木', code: 'xxu', note: '雙木並列連擊 X' },
      { char: '理', parts: '王 + 里', code: 'yxli', note: '「里」位居木宮上橫第 2 順位' },
    ],
  },
  {
    key: 'd',
    anchor: '口',
    title: 'D 鍵 · 口宮（封框筆順）',
    patternLabel: '閉框環繞 · 12 個常見部件',
    summary:
      '順「口」字書寫筆順「左豎 → 橫折 → 底橫」逆轉展開，將目、斤、耳、面、雨等常見部件依頻率沿四邊框依序安放。',
    steps: [
      '左豎下行：自左上依頻率排列「〇（do）」「目（dmu）」「斤（dji）」。',
      '橫折繞框：越頂橫右折而下，依序收錄「耳」「而」「皮」「面」「雨」「早」。',
      '底橫封口：底部自左向右承接「舟（dvo）」與「曲（dku）」，完成閉環記憶。',
    ],
    hanziExamples: [
      { char: '吐', parts: '口 + 土', code: 'dsu', note: 'D 鍵口宮接 S 鍵土宮' },
      { char: '想', parts: '木 + 目 + 心', code: 'xdmx', note: '「目」就在口宮左豎第 2 位' },
      { char: '品', parts: '口 + 口 + 口', code: 'dddo', note: '三口疊字連擊 D' },
    ],
  },
  {
    key: 'v',
    anchor: '水',
    title: 'V 鍵 · 水宮（中軸兩翼）',
    patternLabel: '主幹分翼 · 17 個水系與延伸根',
    summary:
      '「水」字以中豎鉤立為核心主軸，最高頻的「氵、氺、刂、米、巾、刀」集中沿中軸落位，再分別向左右兩翼展開其餘部件。',
    steps: [
      '中豎鉤主脈：優先串聯最高頻「氺 / 氵 / 刂（vi）」「米（vmi）」「巾（vji）」「刀（va）」。',
      '左橫撇翼：向左展開「且（vke）」「亦（vyi）」等中頻字根。',
      '右撇捺翼：向右收束「鬼（vgi）」「甶（vfu）」等外圍延伸部件。',
    ],
    hanziExamples: [
      { char: '江', parts: '氵 + 工', code: 'vgo', note: '「氵」位於水宮中豎最頂端高頻位' },
      { char: '泉', parts: '白 + 水', code: 'kbvi', note: 'K 鍵白宮銜接 V 鍵水宮主根' },
      { char: '來', parts: '一 + 米', code: 'fvmi', note: '「米」正處水宮中軸第 4 順位' },
    ],
  },
  {
    key: 's',
    anchor: '土',
    title: 'S 鍵 · 土宮（高頻階梯）',
    patternLabel: '橫豎雙托 · 23 個高頻偏旁',
    summary:
      '嚴格貫徹「字頻順位 ＝ 空間排布順序 ＝ 筆畫路徑編號」：先上橫、次中豎，再以底橫上下雙列自左向右承托其餘字根。',
    steps: [
      '上橫起筆：收錄高頻「也（se）」「耂（sla）」「尤（syo）」，一眼直達。',
      '中豎貫穿：沿中柱由上而下排列「豕（ssi）」「牛（snu）」「士（si）」「山（ssa）」。',
      '底橫雙托：下方兩排依頻率展開「九」「廴」「黑」「鳥」「烏」「魚」。',
    ],
    hanziExamples: [
      { char: '他', parts: '亻 + 也', code: 'jse', note: '「也」居土宮上橫首位，極易定位' },
      { char: '仙', parts: '人 + 山', code: 'nssa', note: '「山」落於土宮中豎下段' },
      { char: '岩', parts: '山 + 石', code: 'ssps', note: '結合土宮「山」與石部件組字' },
    ],
  },
];

const SHORTCUT_ROWS = [
  {
    key: 'A–Y',
    action: '直接輸入靈明字根鍵位（請保持系統輸入法為英文狀態；若偵測中文輸入法攔截將自動提示）',
  },
  {
    key: 'Tab',
    action: '練習或文心實戰途中原地閃看字根鍵位、筆畫切分與提示，不打斷輸入節奏',
  },
  {
    key: 'Space',
    action: '清空當前尚未打完的字根緩衝，或於主畫面進入五重道場',
  },
  {
    key: 'Backspace',
    action: '退回刪除最後輸入的一個鍵位',
  },
  {
    key: 'Esc',
    action: '暫停練習、關閉說明視窗或清空當前緩衝',
  },
  {
    key: 'Enter',
    action: '進入關卡、或於結算後立即展開下一輪練習',
  },
];

interface HomeTutorialModalProps {
  initialTab?: TutorialTabId;
  initialChamberKey?: string;
  scriptMode: ScriptMode;
  onClose: () => void;
  onOpenCampaign: () => void;
  onStartFreePlay: () => void;
  onOpenDrillStudio: () => void;
  onOpenPalaceCloud: () => void;
  onLaunchChamberDrill: (key: string) => void;
}

export const HomeTutorialModal: React.FC<HomeTutorialModalProps> = ({
  initialTab = 'palace',
  initialChamberKey = 'x',
  scriptMode,
  onClose,
  onOpenCampaign,
  onStartFreePlay,
  onOpenDrillStudio,
  onOpenPalaceCloud,
  onLaunchChamberDrill,
}) => {
  const t = useUiText();
  const theme = useThemeMode();
  const isWash = theme === 'wash';

  const [activeTab, setActiveTab] = useState<TutorialTabId>(initialTab);
  const [chamberKey, setChamberKey] = useState<string>(
    PALACE_EXAMPLE_PRESETS.some((p) => p.key === initialChamberKey) ? initialChamberKey : 'x'
  );
  const [showStrokeFlow, setShowStrokeFlow] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<StrokeCloudSelection | null>(null);

  useEffect(() => {
    setSelectedNode(null);
  }, [chamberKey]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const preset = useMemo(
    () => PALACE_EXAMPLE_PRESETS.find((p) => p.key === chamberKey) || PALACE_EXAMPLE_PRESETS[0],
    [chamberKey]
  );

  const strokeSchema = PALACE_STROKE_SCHEMAS[chamberKey];
  const chamberData = PALACE_PDF_CHAMBERS[chamberKey];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('墨鍵道場說明教程與記憶宮殿示例')}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/55 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isWash
            ? 'bg-[#F6F4EE] border-[#141413]/18 text-[#141413]'
            : 'bg-[#111621] border-[#F2EEE6]/14 text-[#F2EEE6]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`shrink-0 px-5 sm:px-7 py-4 border-b flex flex-wrap items-center justify-between gap-3 ${
            isWash ? 'border-[#141413]/10 bg-[#EFECE4]/70' : 'border-[#F2EEE6]/10 bg-[#151B28]'
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen
                className={`w-4 h-4 shrink-0 ${
                  isWash ? 'text-[#181817]' : 'text-[#D89B3C]'
                }`}
              />
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-wide truncate">
                {t('墨鍵道場 · 說明教程與記憶宮殿示例')}
              </h2>
            </div>
            <p
              className={`text-xs mt-0.5 ${
                isWash ? 'text-[#5A5A54]' : 'text-[#9CA5B5]'
              }`}
            >
              {t('用空間記憶宮殿與三景深零掃視訓練，取代死記口訣')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Segmented Tab Switcher */}
            <div
              role="tablist"
              aria-label={t('教程章節')}
              className={`inline-flex items-center p-1 rounded-lg border ${
                isWash
                  ? 'bg-[#E7E4DC]/80 border-[#141413]/12'
                  : 'bg-[#0C1018] border-[#F2EEE6]/10'
              }`}
            >
              {(
                [
                  { id: 'palace', label: '記憶宮殿示例' },
                  { id: 'path', label: '三步上手路徑' },
                  { id: 'shortcuts', label: '規則與快捷鍵' },
                ] as Array<{ id: TutorialTabId; label: string }>
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? isWash
                          ? 'bg-[#181817] text-[#F8F7F3]'
                          : 'bg-[#20293B] text-[#F6F2EA]'
                        : isWash
                          ? 'text-[#555550] hover:text-[#141413]'
                          : 'text-[#9AA3B2] hover:text-[#F2EEE6]'
                    }`}
                  >
                    {t(tab.label)}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t('關閉說明教程')}
              className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                isWash
                  ? 'bg-[#FAF9F5] hover:bg-[#FFFFFF] border-[#141413]/14 text-[#3A3A36]'
                  : 'bg-[#182030] hover:bg-[#222D42] border-[#F2EEE6]/12 text-[#AEB6C4]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
          {/* ==================== TAB 1: MEMORY PALACE EXAMPLES ==================== */}
          {activeTab === 'palace' && (
            <div className="space-y-5">
              {/* Example chamber switcher bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`text-xs mr-1 ${
                      isWash ? 'text-[#5A5A54]' : 'text-[#9AA3B2]'
                    }`}
                  >
                    {t('切換示範宮殿：')}
                  </span>
                  {PALACE_EXAMPLE_PRESETS.map((item) => {
                    const active = item.key === chamberKey;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setChamberKey(item.key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? isWash
                              ? 'bg-[#181817] border-[#181817] text-[#F8F7F3]'
                              : 'bg-[#D89B3C]/18 border-[#D89B3C]/65 text-[#F6E5C0]'
                            : isWash
                              ? 'bg-[#FAF9F5] hover:bg-[#FFFFFF] border-[#141413]/14 text-[#353532]'
                              : 'bg-[#161E2D] hover:bg-[#1E283B] border-[#F2EEE6]/12 text-[#B8C0CE]'
                        }`}
                      >
                        <span className="font-mono-tabular font-bold">{item.key.toUpperCase()}</span>
                        <span className="font-display font-bold">{item.anchor}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowStrokeFlow((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                    showStrokeFlow
                      ? isWash
                        ? 'bg-[#181817]/10 border-[#181817]/35 text-[#141413]'
                        : 'bg-[#2EA87E]/15 border-[#2EA87E]/45 text-[#7AE4BE]'
                      : isWash
                        ? 'bg-[#FAF9F5] border-[#141413]/14 text-[#5A5A54]'
                        : 'bg-[#161E2D] border-[#F2EEE6]/12 text-[#9AA3B2]'
                  }`}
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>{t(showStrokeFlow ? '筆畫關聯路徑：開' : '筆畫關聯路徑：關')}</span>
                </button>
              </div>

              {/* Two-zone Interactive Educational Sandbox (60% Stage / 40% Guided Explanation) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Left: Live Interactive Memory Palace Canvas */}
                <div
                  className={`lg:col-span-7 rounded-xl border p-4 flex flex-col justify-between ${
                    isWash
                      ? 'bg-[#FAF9F5] border-[#141413]/14'
                      : 'bg-[#0C1018] border-[#F2EEE6]/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-display font-bold text-sm truncate">
                        {t(preset.title)}
                      </span>
                      <span
                        aria-hidden="true"
                        className={isWash ? 'text-[#8C8B84]' : 'text-[#545E70]'}
                      >
                        ·
                      </span>
                      <span
                        className={`truncate ${
                          isWash ? 'text-[#5A5A54]' : 'text-[#9AA3B2]'
                        }`}
                      >
                        {t(preset.patternLabel)}
                      </span>
                    </div>
                    <span
                      className={`font-mono-tabular shrink-0 ${
                        isWash ? 'text-[#5A5A54]' : 'text-[#9AA3B2]'
                      }`}
                    >
                      {chamberData ? `${chamberData.nodes.length + 1} ${t('根')}` : ''}
                    </span>
                  </div>

                  {/* Interactive StrokeCloudStage */}
                  <div className="relative w-full aspect-[4/3] max-h-[340px] mx-auto">
                    <StrokeCloudStage
                      chamberKey={chamberKey}
                      variant="palace"
                      scriptMode={scriptMode}
                      showStrokeFlow={showStrokeFlow}
                      selectedChar={selectedNode?.char ?? null}
                      selectedNodeId={selectedNode?.id ?? null}
                      onSelectNode={(node) => setSelectedNode(node)}
                    />
                  </div>

                  {/* Live clicked-node inspector bar or gentle prompt */}
                  <div
                    className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                      isWash ? 'border-[#141413]/10' : 'border-[#F2EEE6]/10'
                    }`}
                  >
                    {selectedNode ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-bold">
                          {selectedNode.char}
                        </span>
                        <span
                          className={`font-mono-tabular font-semibold ${
                            isWash ? 'text-[#141413]' : 'text-[#E8C57B]'
                          }`}
                        >
                          {t('全碼')} {selectedNode.ma}
                        </span>
                        <span aria-hidden="true" className="opacity-40">
                          ·
                        </span>
                        <span className={isWash ? 'text-[#5A5A54]' : 'text-[#9AA3B2]'}>
                          {selectedNode.rank === 1
                            ? t('第 1 順位 · 中央主根立柱')
                            : `${t('字頻順位')} #${selectedNode.rank} · ${t('大碼鍵')} ${chamberKey.toUpperCase()}`}
                        </span>
                      </div>
                    ) : (
                      <span className={isWash ? 'text-[#5A5A54]' : 'text-[#9AA3B2]'}>
                        {t('點擊圖中任意字根，即可即時查看它的全碼與字頻順位')}
                      </span>
                    )}

                    {strokeSchema && (
                      <span
                        className={`font-mono-tabular ${
                          isWash ? 'text-[#4A4A46]' : 'text-[#8F9BB0]'
                        }`}
                      >
                        {t('筆順')}：{t(strokeSchema.strokeFormula)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Structured Concept Deck + Verified Hanzi Examples */}
                <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-1.5">
                        {t('這座記憶宮殿怎麼讀？')}
                      </h3>
                      <p
                        className={`text-xs leading-relaxed ${
                          isWash ? 'text-[#454541]' : 'text-[#B4BCCB]'
                        }`}
                      >
                        {t(preset.summary)}
                      </p>
                    </div>

                    <ol className="space-y-2">
                      {preset.steps.map((step, idx) => (
                        <li
                          key={idx}
                          className={`text-xs leading-relaxed flex items-start gap-2.5 ${
                            isWash ? 'text-[#2D2D2A]' : 'text-[#CFD5E0]'
                          }`}
                        >
                          <span
                            className={`font-mono-tabular font-semibold shrink-0 mt-0.5 ${
                              isWash ? 'text-[#141413]' : 'text-[#D89B3C]'
                            }`}
                          >
                            0{idx + 1}.
                          </span>
                          <span>{t(step)}</span>
                        </li>
                      ))}
                    </ol>

                    {/* Verified Real Hanzi Examples */}
                    <div
                      className={`pt-3 border-t ${
                        isWash ? 'border-[#141413]/10' : 'border-[#F2EEE6]/10'
                      }`}
                    >
                      <h4 className="text-xs font-semibold mb-2">
                        {t('實戰拆字聯想舉例')}
                      </h4>
                      <div className="space-y-2">
                        {preset.hanziExamples.map((ex) => (
                          <div
                            key={ex.char}
                            className={`flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg border ${
                              isWash
                                ? 'bg-[#FAF9F5] border-[#141413]/10'
                                : 'bg-[#161E2D]/80 border-[#F2EEE6]/8'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="font-display text-base font-bold shrink-0">
                                {t(ex.char)}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-medium truncate">
                                  {t(ex.parts)}
                                </div>
                                <div
                                  className={`text-[11px] truncate ${
                                    isWash ? 'text-[#62625C]' : 'text-[#8E98AA]'
                                  }`}
                                >
                                  {t(ex.note)}
                                </div>
                              </div>
                            </div>
                            <span
                              className={`font-mono-tabular text-xs font-bold shrink-0 ${
                                isWash ? 'text-[#141413]' : 'text-[#7AE4BE]'
                              }`}
                            >
                              {ex.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Direct action buttons for this example chamber */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLaunchChamberDrill(chamberKey);
                      }}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        isWash
                          ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                          : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {t('直接練習')} {chamberKey.toUpperCase()} {t('鍵')}（{preset.anchor}）
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPalaceCloud();
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                        isWash
                          ? 'bg-[#FAF9F5] hover:bg-[#FFFFFF] border-[#141413]/16 text-[#141413]'
                          : 'bg-[#172030] hover:bg-[#212D42] border-[#F2EEE6]/14 text-[#E6E2DA]'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>{t('看全部 25 鍵')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Honest cognitive design note */}
              <div
                className={`pt-3 border-t text-xs leading-relaxed ${
                  isWash
                    ? 'border-[#141413]/10 text-[#5A5A54]'
                    : 'border-[#F2EEE6]/10 text-[#97A0B0]'
                }`}
              >
                <strong className={isWash ? 'text-[#181817]' : 'text-[#E8E2D6]'}>
                  {t('設計說明：')}
                </strong>
                {t(
                  '我們依據基本字根的筆畫順序與字頻建立局部記憶宮殿，這與象形文字「依形記意、循筆成象」的記憶機理相契合；這套空間模擬旨在幫助你更快建立鍵位與字根的整體直覺，實際長期記憶效果仍歡迎在練習中持續驗證。'
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: 3-STEP TRAINING PATH ==================== */}
          {activeTab === 'path' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${
                    isWash
                      ? 'bg-[#FAF9F5] border-[#141413]/14'
                      : 'bg-[#151C2A] border-[#F2EEE6]/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div
                      className={`text-xs font-mono-tabular ${
                        isWash ? 'text-[#5A5A54]' : 'text-[#D89B3C]'
                      }`}
                    >
                      01 · {t('系統入門')}
                    </div>
                    <h3 className="font-display text-base font-bold flex items-center gap-2">
                      <MapIcon className="w-4 h-4 shrink-0" />
                      <span>{t('五重道場闖關')}</span>
                    </h3>
                    <p
                      className={`text-xs leading-relaxed ${
                        isWash ? 'text-[#4A4A46]' : 'text-[#AEB6C4]'
                      }`}
                    >
                      {t(
                        '由「立柱二十主根 → 主根組字 → 逐鍵記憶宮殿 → 字中辨根 → 整字實戰」共 5 章 20 關循序破關，零口訣壓力建立肌肉記憶。'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCampaign();
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      isWash
                        ? 'bg-[#181817] hover:bg-[#2C2C2A] text-[#F8F7F3]'
                        : 'bg-[#C93E2D] hover:bg-[#DC4B39] text-white'
                    }`}
                  >
                    <span>{t('進入五重道場')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${
                    isWash
                      ? 'bg-[#FAF9F5] border-[#141413]/14'
                      : 'bg-[#151C2A] border-[#F2EEE6]/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div
                      className={`text-xs font-mono-tabular ${
                        isWash ? 'text-[#5A5A54]' : 'text-[#7AE4BE]'
                      }`}
                    >
                      02 · {t('反射強化')}
                    </div>
                    <h3 className="font-display text-base font-bold flex items-center gap-2">
                      <Play className="w-4 h-4 shrink-0" />
                      <span>{t('自由鍛煉與疾風落字')}</span>
                    </h3>
                    <p
                      className={`text-xs leading-relaxed ${
                        isWash ? 'text-[#4A4A46]' : 'text-[#AEB6C4]'
                      }`}
                    >
                      {t(
                        '支援「Alice 景深零掃視」與「觸感鍵盤」即時切換；可在記憶宮殿反射、60fps 疾風落字與弱鍵突擊間自由練功，並可切換純黑白「宣紙水墨」體驗墨滴暈散特效。'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartFreePlay();
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      isWash
                        ? 'bg-[#FFFFFF] hover:bg-[#F3F1EC] border-[#141413]/18 text-[#141413]'
                        : 'bg-[#1C2638] hover:bg-[#25324A] border-[#F2EEE6]/16 text-[#F2EEE6]'
                    }`}
                  >
                    <span>{t('立即開始自由鍛煉')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
                  className={`rounded-xl border p-5 flex flex-col justify-between gap-4 ${
                    isWash
                      ? 'bg-[#FAF9F5] border-[#141413]/14'
                      : 'bg-[#151C2A] border-[#F2EEE6]/10'
                  }`}
                >
                  <div className="space-y-2">
                    <div
                      className={`text-xs font-mono-tabular ${
                        isWash ? 'text-[#5A5A54]' : 'text-[#E8B356]'
                      }`}
                    >
                      03 · {t('盲打實戰')}
                    </div>
                    <h3 className="font-display text-base font-bold flex items-center gap-2">
                      <Flame className="w-4 h-4 shrink-0" />
                      <span>{t('文心實戰室')}</span>
                    </h3>
                    <p
                      className={`text-xs leading-relaxed ${
                        isWash ? 'text-[#4A4A46]' : 'text-[#AEB6C4]'
                      }`}
                    >
                      {t(
                        '貼入任意文章或練習內建短文與難拆結構；猶豫超時或誤按會自動收入「慢字／錯字精修池」，必須連續 3 次無誤直出才算畢業。'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDrillStudio();
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      isWash
                        ? 'bg-[#FFFFFF] hover:bg-[#F3F1EC] border-[#141413]/18 text-[#141413]'
                        : 'bg-[#1C2638] hover:bg-[#25324A] border-[#D89B3C]/35 text-[#F2EEE6]'
                    }`}
                  >
                    <span>{t('進入文心實戰室')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                className={`pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs leading-relaxed ${
                  isWash
                    ? 'border-[#141413]/10 text-[#4A4A46]'
                    : 'border-[#F2EEE6]/10 text-[#AEB6C4]'
                }`}
              >
                <div>
                  <div className={`font-semibold mb-1 ${isWash ? 'text-[#141413]' : 'text-[#F2EEE6]'}`}>
                    {t('繁簡雙軌分流')}
                  </div>
                  {t(
                    '在道場地圖或宮殿雲圖中可隨時切換「僅簡體 / 僅繁體 / 繁簡全集」，系統會自動淡化非目標字集字根並同步切換介面用字。'
                  )}
                </div>
                <div>
                  <div className={`font-semibold mb-1 ${isWash ? 'text-[#141413]' : 'text-[#F2EEE6]'}`}>
                    {t('漸隱鷹架（Adaptive Scaffolding）')}
                  </div>
                  {t(
                    '隨著你對某個鍵位與字根反應越來越快，背景雲圖與提示會自動由實轉虛，幫助你自然跨入純盲打狀態。'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: RULES & SHORTCUTS ==================== */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-5">
              <div
                className={`rounded-xl border p-4 space-y-2 ${
                  isWash
                    ? 'bg-[#FAF9F5] border-[#141413]/14'
                    : 'bg-[#151C2A] border-[#F2EEE6]/10'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Keyboard className="w-4 h-4 shrink-0" />
                  <span>{t('靈明形碼快速入門要點')}</span>
                </div>
                <ul
                  className={`text-xs leading-relaxed space-y-1.5 ${
                    isWash ? 'text-[#454541]' : 'text-[#B4BCCB]'
                  }`}
                >
                  <li>
                    <strong className={isWash ? 'text-[#141413]' : 'text-[#F2EEE6]'}>
                      {t('A 區 20 輔音記憶宮殿：')}
                    </strong>
                    {t('20 個輔音鍵各自對應一座以最高頻主根立柱的字根宮殿，負責承擔漢字的首要形碼大碼。')}
                  </li>
                  <li>
                    <strong className={isWash ? 'text-[#141413]' : 'text-[#F2EEE6]'}>
                      {t('B 區 5 韻腹收尾（A E I O U）：')}
                    </strong>
                    {t('用於單字或字根全碼的韻腹終止補碼，讓擊鍵自然落在左右手交替節奏中（Z 鍵保留不用）。')}
                  </li>
                  <li>
                    <strong className={isWash ? 'text-[#141413]' : 'text-[#F2EEE6]'}>
                      {t('一二三末 · 大根免三：')}
                    </strong>
                    {t('依漢字書寫筆順依次取根，熟練後僅需極少按鍵即可直出整字，無須停頓思考口訣。')}
                  </li>
                </ul>
              </div>

              <div
                className={`rounded-xl border overflow-hidden ${
                  isWash ? 'border-[#141413]/14' : 'border-[#F2EEE6]/10'
                }`}
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr
                      className={
                        isWash
                          ? 'bg-[#EFECE4] text-[#3A3A36]'
                          : 'bg-[#172030] text-[#B8C0CE]'
                      }
                    >
                      <th className="py-2.5 px-4 font-semibold w-32">{t('按鍵')}</th>
                      <th className="py-2.5 px-4 font-semibold">{t('功能說明')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHORTCUT_ROWS.map((row) => (
                      <tr
                        key={row.key}
                        className={`border-t ${
                          isWash
                            ? 'border-[#141413]/10 bg-[#FAF9F5]'
                            : 'border-[#F2EEE6]/8 bg-[#111621]'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono-tabular font-semibold whitespace-nowrap">
                          {row.key}
                        </td>
                        <td
                          className={`py-2.5 px-4 leading-relaxed ${
                            isWash ? 'text-[#3F3F3B]' : 'text-[#C2C9D6]'
                          }`}
                        >
                          {t(row.action)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
