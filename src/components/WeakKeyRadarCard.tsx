import React, { useMemo, useState } from 'react';
import { ArrowRight, Crosshair } from 'lucide-react';
import { WeakKeyInfo } from '../engine/mastery';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';

interface WeakKeyRadarCardProps {
  weakestKeys: WeakKeyInfo[];
  hasPracticedData: boolean;
  onStartWeakKeyDrill: (keys: string[]) => void;
  onLaunchChamberDrill: (chamberKey: string) => void;
}

interface RadarAxisDatum {
  info: WeakKeyInfo;
  masteryPct: number; // 0..100 (lower = weaker / deeper inward dent)
  isUntested: boolean;
  angleRad: number;
}

/**
 * Convert a WeakKeyInfo entry into an intuitive 0..100% chamber mastery score.
 * Lower values sit closer to the radar center so weak chambers visibly pull inward.
 */
function computeChamberMasteryPct(info: WeakKeyInfo): number {
  if (info.attempts <= 0) return 18;
  const speedScore = Math.max(0, Math.min(1, (1100 - info.emaLatencyMs) / (1100 - 220)));
  const accScore = Math.max(0, 1 - info.errorRate * 2.2);
  const confidence = 0.55 + 0.45 * Math.min(1, info.attempts / 12);
  return Math.round(Math.max(10, Math.min(98, (speedScore * 0.55 + accScore * 0.45) * confidence * 100)));
}

const CX = 142;
const CY = 122;
const OUTER_R = 66;
const LABEL_R = 94;
const GUIDE_RINGS = [0.25, 0.5, 0.75, 1] as const;
const TARGET_RING = 0.8;

function polarToCartesian(radius: number, angleRad: number): { x: number; y: number } {
  return {
    x: CX + radius * Math.cos(angleRad),
    y: CY + radius * Math.sin(angleRad),
  };
}

function buildPolygonPoints(radii: number[], angles: number[]): string {
  return radii
    .map((r, i) => {
      const pt = polarToCartesian(r, angles[i]);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');
}

export const WeakKeyRadarCard: React.FC<WeakKeyRadarCardProps> = ({
  weakestKeys,
  hasPracticedData,
  onStartWeakKeyDrill,
  onLaunchChamberDrill,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const axes = useMemo<RadarAxisDatum[]>(() => {
    const items = weakestKeys.slice(0, 5);
    const count = Math.max(3, items.length);
    return items.map((info, idx) => ({
      info,
      masteryPct: computeChamberMasteryPct(info),
      isUntested: info.attempts <= 0,
      angleRad: ((-90 + (360 / count) * idx) * Math.PI) / 180,
    }));
  }, [weakestKeys]);

  if (axes.length < 3) return null;

  const angles = axes.map((a) => a.angleRad);
  const dataPoints = buildPolygonPoints(
    axes.map((a) => (a.masteryPct / 100) * OUTER_R),
    angles
  );

  const activeIdx = hoveredIdx !== null && hoveredIdx < axes.length ? hoveredIdx : 0;
  const focusedAxis = axes[activeIdx];
  const avgMasteryPct = Math.round(
    axes.reduce((sum, a) => sum + a.masteryPct, 0) / axes.length
  );

  // Palette tuned for both Xuan-paper wash and obsidian night dojo
  const gridStroke = isWash ? 'rgba(24,24,22,0.12)' : 'rgba(242,238,230,0.11)';
  const axisStroke = isWash ? 'rgba(24,24,22,0.14)' : 'rgba(242,238,230,0.13)';
  const targetStroke = isWash ? 'rgba(27,107,92,0.42)' : 'rgba(74,148,104,0.45)';
  const polyStroke = isWash ? '#B83B2A' : '#E25A48';
  const polyFillStart = isWash ? 'rgba(184,59,42,0.28)' : 'rgba(226,90,72,0.34)';
  const polyFillEnd = isWash ? 'rgba(181,116,26,0.10)' : 'rgba(216,155,60,0.12)';
  const dotFill = isWash ? '#B83B2A' : '#F0B24A';
  const dotRing = isWash ? '#F9F8F5' : '#121824';

  return (
    <section
      aria-label={t('弱鍵雷達圖')}
      className={`w-full lg:w-[318px] xl:w-[332px] shrink-0 rounded-xl border px-4 py-3.5 backdrop-blur-sm wash-enter-soft ${
        isWash
          ? 'bg-[#F9F8F5]/90 border-[#141413]/15 text-[#141413] shadow-xs'
          : 'bg-[#121824]/88 border-[#F2EEE6]/12 text-[#F2EEE6] shadow-lg'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Crosshair
            className={`w-3.5 h-3.5 shrink-0 ${
              isWash ? 'text-[#B83B2A]' : 'text-[#E25A48]'
            }`}
          />
          <h2 className="text-sm font-semibold tracking-wide whitespace-nowrap">
            {t('弱鍵雷達圖')}
          </h2>
        </div>
        <span
          className={`text-[11px] font-mono-tabular whitespace-nowrap ${
            isWash ? 'text-[#5A5A54]' : 'text-[#9BA5B6]'
          }`}
        >
          {hasPracticedData
            ? `${t('最弱 5 宮')} · ${t('均掌')} ${avgMasteryPct}%`
            : t('待啟 5 宮')}
        </span>
      </div>

      {/* Handcrafted 5-Axis Pentagonal Radar Visualization */}
      <div className="relative w-full flex items-center justify-center my-0.5">
        <svg
          viewBox="0 0 284 236"
          className="w-full max-w-[288px] h-auto overflow-visible select-none"
          role="img"
          aria-label={t('掌握度最低五宮雷達圖')}
        >
          <defs>
            <radialGradient id="weakRadarFill" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor={polyFillEnd} />
              <stop offset="100%" stopColor={polyFillStart} />
            </radialGradient>
          </defs>

          {/* Concentric Pentagonal Guide Rings (25% / 50% / 75% / 100%) */}
          {GUIDE_RINGS.map((ratio) => (
            <polygon
              key={ratio}
              points={buildPolygonPoints(
                angles.map(() => OUTER_R * ratio),
                angles
              )}
              fill="none"
              stroke={gridStroke}
              strokeWidth={ratio === 1 ? 1.15 : 0.85}
            />
          ))}

          {/* 80% Muscle-Memory Reference Ring */}
          <polygon
            points={buildPolygonPoints(
              angles.map(() => OUTER_R * TARGET_RING),
              angles
            )}
            fill="none"
            stroke={targetStroke}
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Radial Spokes */}
          {axes.map((axis, idx) => {
            const outer = polarToCartesian(OUTER_R, axis.angleRad);
            const isActive = idx === activeIdx;
            return (
              <line
                key={`spoke_${axis.info.key}`}
                x1={CX}
                y1={CY}
                x2={outer.x}
                y2={outer.y}
                stroke={isActive ? polyStroke : axisStroke}
                strokeOpacity={isActive ? 0.55 : 1}
                strokeWidth={isActive ? 1.25 : 0.85}
              />
            );
          })}

          {/* Mastery Data Polygon */}
          <polygon
            points={dataPoints}
            fill="url(#weakRadarFill)"
            stroke={polyStroke}
            strokeWidth="1.75"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Data Vertices & Clickable Palace Labels */}
          {axes.map((axis, idx) => {
            const pt = polarToCartesian((axis.masteryPct / 100) * OUTER_R, axis.angleRad);
            const lbl = polarToCartesian(LABEL_R, axis.angleRad);
            const isActive = idx === activeIdx;
            const keyUpper = axis.info.key.toUpperCase();
            const statusText = axis.isUntested ? t('待啟') : `${axis.masteryPct}%`;
            const pctColor = axis.isUntested
              ? isWash
                ? '#787872'
                : '#8E99AD'
              : axis.masteryPct < 45
                ? isWash
                  ? '#B83B2A'
                  : '#EE6B5A'
                : axis.masteryPct < 75
                  ? isWash
                    ? '#A86716'
                    : '#E8B356'
                  : isWash
                    ? '#1B6B5C'
                    : '#57C492';

            return (
              <g
                key={axis.info.key}
                role="button"
                tabIndex={0}
                aria-label={`${keyUpper} ${axis.info.primary} ${t('掌握度')} ${statusText}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onFocus={() => setHoveredIdx(idx)}
                onBlur={() => setHoveredIdx(null)}
                onClick={() => {
                  synth.playClick();
                  onLaunchChamberDrill(axis.info.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    synth.playClick();
                    onLaunchChamberDrill(axis.info.key);
                  }
                }}
              >
                {/* Invisible generous hit area around label */}
                <circle cx={lbl.x} cy={lbl.y} r="22" fill="transparent" />

                {/* Vertex Marker */}
                {isActive && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="7"
                    fill={polyStroke}
                    fillOpacity="0.22"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 4.2 : 3.2}
                  fill={isActive ? polyStroke : dotFill}
                  stroke={dotRing}
                  strokeWidth="1.5"
                />

                {/* Key Letter + Monument Radical */}
                <text
                  x={lbl.x}
                  y={lbl.y - 3}
                  textAnchor="middle"
                  fill={
                    isActive
                      ? isWash
                        ? '#141413'
                        : '#FFFFFF'
                      : isWash
                        ? '#2A2A27'
                        : '#E6E1D8'
                  }
                  fontSize="12.5"
                  fontWeight="700"
                >
                  <tspan
                    fontFamily="'JetBrains Mono', ui-monospace, monospace"
                    fill={isActive ? polyStroke : undefined}
                  >
                    {keyUpper}
                  </tspan>
                  <tspan dx="3" fontFamily="'Noto Serif TC', serif">
                    {axis.info.primary}
                  </tspan>
                </text>

                {/* Live Mastery Percentage */}
                <text
                  x={lbl.x}
                  y={lbl.y + 11}
                  textAnchor="middle"
                  fill={pctColor}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                >
                  {statusText}
                </text>
              </g>
            );
          })}

          {/* Subtle Center Scale Hint */}
          <text
            x={CX}
            y={CY + 3}
            textAnchor="middle"
            fill={isWash ? 'rgba(24,24,22,0.34)' : 'rgba(242,238,230,0.30)'}
            fontSize="8.5"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
          >
            {t('弱')}
          </text>
        </svg>
      </div>

      {/* Active Chamber Diagnostic Readout */}
      <div
        className={`rounded-lg border px-2.5 py-2 text-[11px] flex items-center justify-between gap-2 ${
          isWash
            ? 'bg-[#FFFFFF]/80 border-[#141413]/10 text-[#3F3F3A]'
            : 'bg-[#0E141F]/80 border-[#F2EEE6]/10 text-[#C5CCD8]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="font-mono-tabular font-bold text-xs px-1.5 py-0.5 rounded bg-[var(--dojo-crimson)]/15 text-[var(--dojo-crimson-text)] shrink-0"
          >
            {focusedAxis.info.key.toUpperCase()}
          </span>
          <span className="font-display font-bold text-sm text-[var(--dojo-text-bright)] shrink-0">
            {focusedAxis.info.primary}
          </span>
          <span className="truncate font-mono-tabular opacity-85">
            {focusedAxis.isUntested
              ? t('尚未練習 · 點宮位即啟練')
              : `${focusedAxis.info.emaLatencyMs}ms · ${t('誤率')} ${Math.round(
                  focusedAxis.info.errorRate * 100
                )}%`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            synth.playClick();
            onLaunchChamberDrill(focusedAxis.info.key);
          }}
          className={`shrink-0 text-[11px] font-medium hover:underline cursor-pointer whitespace-nowrap ${
            isWash ? 'text-[#B83B2A]' : 'text-[#E8C57B]'
          }`}
        >
          {t('單宮特訓')}
        </button>
      </div>

      {/* Subtle Empty-State Hint or One-Click 5-Chamber Attack CTA */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className={`text-[11px] leading-snug ${
            isWash ? 'text-[#64645E]' : 'text-[#8F99AB]'
          }`}
        >
          {hasPracticedData
            ? t('越近圓心越待強化，點宮位直練')
            : t('完成任一局後即時呈現弱鍵輪廓')}
        </span>
        <button
          type="button"
          onClick={() => {
            synth.playClick();
            onStartWeakKeyDrill(axes.map((a) => a.info.key));
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            isWash
              ? 'bg-[#181817] hover:bg-[#2C2C29] text-[#F8F7F3]'
              : 'bg-[var(--dojo-crimson)] hover:bg-[var(--dojo-crimson-hover)] text-white'
          }`}
        >
          <span>{t('專攻五宮')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};
