import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ArrowRight, Gauge, Timer } from 'lucide-react';
import {
  getLast7DaysGrowthSeries,
  GrowthDayPoint,
  SchemeMasteryStore,
} from '../engine/mastery';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';

type ChartViewMode = 'split' | 'cpm' | 'latency';

interface GrowthAnalyticsPanelProps {
  mastery: SchemeMasteryStore;
  onStartQuickPractice: () => void;
}

interface CustomTooltipPayloadItem {
  payload?: GrowthDayPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  metric: 'cpm' | 'latency';
  isWash: boolean;
  t: (text: string) => string;
}

const REFLEX_TARGET_MS = 350;

const GrowthTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  metric,
  isWash,
  t,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const hasValue = metric === 'cpm' ? point.cpm !== null : point.avgLatencyMs !== null;

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur-md ${
        isWash
          ? 'bg-[#FAF9F6]/96 border-[#141413]/16 text-[#141413]'
          : 'bg-[#0F1521]/95 border-[#F2EEE6]/16 text-[#F2EEE6]'
      }`}
    >
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="font-mono-tabular font-semibold">
          {point.shortDate}
          {point.isToday ? ` · ${t('今日')}` : ''}
        </span>
        {point.accuracyPct !== null && (
          <span
            className={`font-mono-tabular text-[11px] ${
              isWash ? 'text-[#5A5A54]' : 'text-[#9BA5B6]'
            }`}
          >
            {t('準率')} {point.accuracyPct}%
          </span>
        )}
      </div>

      {!hasValue ? (
        <div className={`text-[11px] ${isWash ? 'text-[#6D6D67]' : 'text-[#8E99AD]'}`}>
          {t('當日無練習紀錄')}
        </div>
      ) : metric === 'cpm' ? (
        <div className="space-y-0.5 font-mono-tabular">
          <div className="flex items-baseline justify-between gap-4">
            <span className={isWash ? 'text-[#4F4F4A]' : 'text-[#AAB3C2]'}>{t('平均速率')}</span>
            <span
              className={`text-sm font-bold ${
                isWash ? 'text-[#1B6B5C]' : 'text-[#57C492]'
              }`}
            >
              {point.cpm} {t('字/分')}
            </span>
          </div>
          {point.bestCpm !== null && point.bestCpm > (point.cpm ?? 0) && (
            <div className="flex items-baseline justify-between gap-4 text-[11px]">
              <span className={isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'}>{t('單局峰值')}</span>
              <span>
                {point.bestCpm} {t('字/分')}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-4 text-[11px]">
            <span className={isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'}>{t('完成字數')}</span>
            <span>
              {point.charsCleared} {t('字')}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5 font-mono-tabular">
          <div className="flex items-baseline justify-between gap-4">
            <span className={isWash ? 'text-[#4F4F4A]' : 'text-[#AAB3C2]'}>{t('字根時延')}</span>
            <span
              className={`text-sm font-bold ${
                isWash ? 'text-[#A86716]' : 'text-[#F0B24A]'
              }`}
            >
              {point.avgLatencyMs} ms
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-[11px]">
            <span className={isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'}>{t('擊鍵樣本')}</span>
            <span>
              {point.keySamples} {t('鍵')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const GrowthAnalyticsPanel: React.FC<GrowthAnalyticsPanelProps> = ({
  mastery,
  onStartQuickPractice,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';
  const [viewMode, setViewMode] = useState<ChartViewMode>('split');

  const series = useMemo(() => getLast7DaysGrowthSeries(mastery), [mastery]);

  // Translate "今日" on the X-axis cleanly according to active script mode
  const chartData = useMemo(
    () =>
      series.days.map((d) => ({
        ...d,
        axisLabel: d.isToday ? t('今日') : d.shortDate,
      })),
    [series.days, t]
  );

  // Palette tuned to harmonize with both Xuan-paper wash and Obsidian night themes
  const gridStroke = isWash ? 'rgba(20, 20, 19, 0.09)' : 'rgba(242, 238, 230, 0.09)';
  const tickColor = isWash ? '#64645E' : '#8F99AB';
  const cpmStroke = isWash ? '#1B6B5C' : '#57C492';
  const latencyStroke = isWash ? '#B36B14' : '#E8B356';
  const refLineStroke = isWash ? 'rgba(27, 107, 92, 0.45)' : 'rgba(87, 196, 146, 0.45)';
  const dotStroke = isWash ? '#F9F8F5' : '#121824';

  const hasAnyData = series.activeDays > 0;
  const hasTrendLine = series.activeDays >= 2;

  const latencyMaxDomain = useMemo(() => {
    const vals = series.days
      .map((d) => d.avgLatencyMs)
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return 900;
    const peak = Math.max(...vals, REFLEX_TARGET_MS + 100);
    return Math.ceil(peak / 100) * 100;
  }, [series.days]);

  const cpmMaxDomain = useMemo(() => {
    const vals = series.days
      .map((d) => d.cpm)
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return 60;
    const peak = Math.max(...vals, 30);
    return Math.ceil((peak + 8) / 10) * 10;
  }, [series.days]);

  const viewTabs: Array<{ id: ChartViewMode; label: string }> = [
    { id: 'split', label: t('雙圖並覽') },
    { id: 'cpm', label: t('CPM 成長') },
    { id: 'latency', label: t('反應時延') },
  ];

  const showCpm = viewMode === 'split' || viewMode === 'cpm';
  const showLatency = viewMode === 'split' || viewMode === 'latency';

  return (
    <section
      aria-label={t('近一週記憶成長曲線')}
      className={`w-full rounded-xl border backdrop-blur-sm wash-enter-soft ${
        isWash
          ? 'bg-[#F9F8F5]/90 border-[#141413]/15 text-[#141413] shadow-xs'
          : 'bg-[#121824]/88 border-[#F2EEE6]/12 text-[#F2EEE6] shadow-lg'
      }`}
    >
      {/* Top Header & Segmented View Switch */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b ${
          isWash ? 'border-[#141413]/10' : 'border-[#F2EEE6]/10'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity
              className={`w-4 h-4 shrink-0 ${
                isWash ? 'text-[#1B6B5C]' : 'text-[#57C492]'
              }`}
            />
            <h2 className="text-sm font-semibold tracking-wide whitespace-nowrap">
              {t('近一週記憶成長曲線')}
            </h2>
          </div>
          <p
            className={`mt-0.5 text-xs font-mono-tabular ${
              isWash ? 'text-[#5A5A54]' : 'text-[#9BA5B6]'
            }`}
          >
            {hasAnyData
              ? `${t('近 7 日活躍')} ${series.activeDays} ${t('天')} · ${t('累計')} ${series.totalChars7d} ${t('字')} · ${t('擊鍵')} ${series.totalKeys7d} ${t('次')}`
              : t('自動追蹤近七日每分鐘字數與字根反應時延，量化肌肉記憶成形軌跡')}
          </p>
        </div>

        <div
          role="group"
          aria-label={t('切換成長圖表視圖')}
          className={`inline-flex items-center p-0.5 rounded-lg border ${
            isWash
              ? 'bg-[#FFFFFF]/80 border-[#141413]/12'
              : 'bg-[#0E141F]/90 border-[#F2EEE6]/12'
          }`}
        >
          {viewTabs.map((tab) => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  setViewMode(tab.id);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? isWash
                      ? 'bg-[#181817] text-[#F8F7F3] shadow-xs'
                      : 'bg-[#1F2A3E] text-[#F6F2EA] shadow-xs'
                    : isWash
                      ? 'text-[#5A5A54] hover:text-[#141413]'
                      : 'text-[#8F99AB] hover:text-[#F2EEE6]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Unboxed Tabular KPI Summary Strip */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x border-b ${
          isWash
            ? 'divide-[#141413]/10 border-[#141413]/10'
            : 'divide-[#F2EEE6]/10 border-[#F2EEE6]/10'
        }`}
      >
        <div className="px-4 sm:px-5 py-3">
          <div className={`text-[11px] ${isWash ? 'text-[#5A5A54]' : 'text-[#8F99AB]'}`}>
            {t('最新速率 (CPM)')}
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono-tabular">
            <span className="text-lg font-bold tracking-tight">
              {series.latestCpm !== null ? series.latestCpm : '—'}
            </span>
            <span className={`text-[11px] ${isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'}`}>
              {t('字/分')}
            </span>
            {series.cpmDelta !== null && (
              <span
                className={`text-[11px] font-semibold ${
                  series.cpmDelta >= 0
                    ? isWash
                      ? 'text-[#1B6B5C]'
                      : 'text-[#57C492]'
                    : isWash
                      ? 'text-[#B83B2A]'
                      : 'text-[#EE6B5A]'
                }`}
              >
                {series.cpmDelta >= 0 ? `+${series.cpmDelta}` : series.cpmDelta}
              </span>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3">
          <div className={`text-[11px] ${isWash ? 'text-[#5A5A54]' : 'text-[#8F99AB]'}`}>
            {t('七日均速 · 峰值')}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono-tabular">
            <span className="text-lg font-bold tracking-tight">
              {series.avgCpm7d !== null ? series.avgCpm7d : '—'}
            </span>
            <span className={`text-xs ${isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'}`}>
              / {series.peakCpm7d !== null ? series.peakCpm7d : '—'}
            </span>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3">
          <div className={`text-[11px] ${isWash ? 'text-[#5A5A54]' : 'text-[#8F99AB]'}`}>
            {t('字根反應時延')}
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono-tabular">
            <span className="text-lg font-bold tracking-tight">
              {series.latestLatencyMs !== null ? series.latestLatencyMs : '—'}
            </span>
            <span className={`text-[11px] ${isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'}`}>
              ms
            </span>
            {series.latencyDeltaMs !== null && (
              <span
                className={`text-[11px] font-semibold ${
                  series.latencyDeltaMs <= 0
                    ? isWash
                      ? 'text-[#1B6B5C]'
                      : 'text-[#57C492]'
                    : isWash
                      ? 'text-[#A86716]'
                      : 'text-[#E8B356]'
                }`}
              >
                {series.latencyDeltaMs > 0
                  ? `+${series.latencyDeltaMs}`
                  : series.latencyDeltaMs}
                ms
              </span>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3">
          <div className={`text-[11px] ${isWash ? 'text-[#5A5A54]' : 'text-[#8F99AB]'}`}>
            {t('肌肉反射門檻')}
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono-tabular">
            <span className="text-lg font-bold tracking-tight">≤ {REFLEX_TARGET_MS}</span>
            <span className={`text-[11px] ${isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'}`}>
              ms
            </span>
            {series.latestLatencyMs !== null && (
              <span
                className={`text-[11px] font-medium ${
                  series.latestLatencyMs <= REFLEX_TARGET_MS
                    ? isWash
                      ? 'text-[#1B6B5C]'
                      : 'text-[#57C492]'
                    : isWash
                      ? 'text-[#5A5A54]'
                      : 'text-[#9BA5B6]'
                }`}
              >
                {series.latestLatencyMs <= REFLEX_TARGET_MS
                  ? t('已達標')
                  : `${t('差')} ${series.latestLatencyMs - REFLEX_TARGET_MS}ms`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart Body */}
      {!hasAnyData ? (
        <div className="px-5 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <p className="text-sm font-medium">
              {t('尚未產生近七日練習曲線')}
            </p>
            <p className={`text-xs leading-relaxed ${isWash ? 'text-[#5A5A54]' : 'text-[#9BA5B6]'}`}>
              {t(
                '在五重道場、文心實戰室、簡碼速成或黃庭抄經閣完成擊鍵後，系統將按日自動累計 CPM 成長曲線與字根反應時延（本地持久化，無需登入）。'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onStartQuickPractice();
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isWash
                ? 'bg-[#181817] hover:bg-[#2C2C29] text-[#F8F7F3]'
                : 'bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white'
            }`}
          >
            <span>{t('開始首局練習')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div
            className={`grid grid-cols-1 ${
              viewMode === 'split'
                ? `lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x ${
                    isWash ? 'divide-[#141413]/10' : 'divide-[#F2EEE6]/10'
                  }`
                : ''
            }`}
          >
            {/* Chart 1: CPM Growth Curve */}
            {showCpm && (
              <div className="px-4 sm:px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Gauge
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isWash ? 'text-[#1B6B5C]' : 'text-[#57C492]'
                      }`}
                    />
                    <h3 className="text-xs font-semibold tracking-wide">
                      {t('CPM（每分鐘字數）成長曲線')}
                    </h3>
                  </div>
                  <span
                    className={`text-[11px] font-mono-tabular ${
                      isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'
                    }`}
                  >
                    {t('越高越快')}
                  </span>
                </div>

                <div className="w-full h-[204px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="dojoCpmFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={cpmStroke} stopOpacity={isWash ? 0.24 : 0.32} />
                          <stop offset="100%" stopColor={cpmStroke} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                      <XAxis
                        dataKey="axisLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: tickColor,
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}
                        dy={6}
                      />
                      <YAxis
                        domain={[0, cpmMaxDomain]}
                        axisLine={false}
                        tickLine={false}
                        width={42}
                        tick={{
                          fill: tickColor,
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}
                      />
                      {series.avgCpm7d !== null && hasTrendLine && (
                        <ReferenceLine
                          y={series.avgCpm7d}
                          stroke={refLineStroke}
                          strokeDasharray="4 4"
                          label={{
                            value: `${t('均')} ${series.avgCpm7d}`,
                            position: 'insideTopRight',
                            fill: cpmStroke,
                            fontSize: 10,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                          }}
                        />
                      )}
                      <Tooltip
                        cursor={{ stroke: gridStroke, strokeWidth: 1.5 }}
                        content={<GrowthTooltip metric="cpm" isWash={isWash} t={t} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="cpm"
                        stroke={cpmStroke}
                        strokeWidth={2.2}
                        fill="url(#dojoCpmFill)"
                        connectNulls
                        dot={{
                          r: 3.5,
                          fill: cpmStroke,
                          stroke: dotStroke,
                          strokeWidth: 1.5,
                        }}
                        activeDot={{
                          r: 5.5,
                          fill: cpmStroke,
                          stroke: dotStroke,
                          strokeWidth: 2,
                        }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Chart 2: Radical Reaction Latency Trend */}
            {showLatency && (
              <div className="px-4 sm:px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Timer
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isWash ? 'text-[#B36B14]' : 'text-[#E8B356]'
                      }`}
                    />
                    <h3 className="text-xs font-semibold tracking-wide">
                      {t('字根反應時延趨勢')}
                    </h3>
                  </div>
                  <span
                    className={`text-[11px] font-mono-tabular ${
                      isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'
                    }`}
                  >
                    {t('越低越熟')} · {REFLEX_TARGET_MS}ms {t('反射線')}
                  </span>
                </div>

                <div className="w-full h-[204px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="dojoLatencyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={latencyStroke}
                            stopOpacity={isWash ? 0.22 : 0.28}
                          />
                          <stop offset="100%" stopColor={latencyStroke} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                      <XAxis
                        dataKey="axisLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: tickColor,
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}
                        dy={6}
                      />
                      <YAxis
                        domain={[0, latencyMaxDomain]}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                        tick={{
                          fill: tickColor,
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}
                      />
                      <ReferenceLine
                        y={REFLEX_TARGET_MS}
                        stroke={refLineStroke}
                        strokeDasharray="4 4"
                        label={{
                          value: `${REFLEX_TARGET_MS}ms`,
                          position: 'insideTopRight',
                          fill: cpmStroke,
                          fontSize: 10,
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}
                      />
                      <Tooltip
                        cursor={{ stroke: gridStroke, strokeWidth: 1.5 }}
                        content={<GrowthTooltip metric="latency" isWash={isWash} t={t} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="avgLatencyMs"
                        stroke={latencyStroke}
                        strokeWidth={2.2}
                        fill="url(#dojoLatencyFill)"
                        connectNulls
                        dot={{
                          r: 3.5,
                          fill: latencyStroke,
                          stroke: dotStroke,
                          strokeWidth: 1.5,
                        }}
                        activeDot={{
                          r: 5.5,
                          fill: latencyStroke,
                          stroke: dotStroke,
                          strokeWidth: 2,
                        }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {!hasTrendLine && (
            <div
              className={`px-4 sm:px-5 py-2 border-t text-[11px] flex items-center justify-between gap-2 ${
                isWash
                  ? 'border-[#141413]/10 text-[#64645E]'
                  : 'border-[#F2EEE6]/10 text-[#8F99AB]'
              }`}
            >
              <span>
                {t('已記錄 1 天數據點 · 連續練習 2 天以上後自動連成近七日成長曲線')}
              </span>
              <span className="font-mono-tabular hidden sm:inline">
                {t('今日累計')} {series.totalChars7d} {t('字')}
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
};
