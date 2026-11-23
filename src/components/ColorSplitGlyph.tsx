import React from 'react';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import type { ThemeMode } from '../data/theme';

// Harmonious mineral / nocturnal palettes for up to 4 decomposed radicals
const NIGHT_ROOT_RGB: Array<[number, number, number]> = [
  [59, 209, 160],  // 松青
  [240, 178, 74],  // 琥珀
  [178, 138, 248], // 堇紫
  [238, 107, 90],  // 朱砂
];

const WASH_ROOT_RGB: Array<[number, number, number]> = [
  [27, 107, 92],   // 石青
  [181, 116, 26],  // 赭黃
  [71, 88, 168],   // 花青
  [184, 59, 42],   // 朱砂
];

const NIGHT_INK_RGB: [number, number, number] = [245, 241, 232];
const WASH_INK_RGB: [number, number, number] = [22, 22, 20];

export function blendRgb(
  from: [number, number, number],
  to: [number, number, number],
  t: number
): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * clamped);
  const g = Math.round(from[1] + (to[1] - from[1]) * clamped);
  const b = Math.round(from[2] + (to[2] - from[2]) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getRootColor(rootIndex: number, themeMode: ThemeMode, colorMix: number): string {
  const isWash = themeMode === 'wash';
  const palette = isWash ? WASH_ROOT_RGB : NIGHT_ROOT_RGB;
  const ink = isWash ? WASH_INK_RGB : NIGHT_INK_RGB;
  const pigment = palette[rootIndex % palette.length];
  return blendRgb(ink, pigment, colorMix);
}

// Lookup index for PUA radical vector outlines from PALACE_PDF_CHAMBERS (built lazily once)
let puaPathLookup: Map<string, { path: string; cx: number; cy: number; r: number }> | null = null;
function getPuaPath(ch: string) {
  if (!puaPathLookup) {
    puaPathLookup = new Map();
    for (const chamber of Object.values(PALACE_PDF_CHAMBERS)) {
      if (chamber.monument.rawChar) {
        puaPathLookup.set(chamber.monument.rawChar, {
          path: chamber.monument.path,
          cx: chamber.monument.cx,
          cy: chamber.monument.cy,
          r: chamber.monument.r,
        });
      }
      for (const n of chamber.nodes) {
        if (n.path && !puaPathLookup.has(n.rawChar)) {
          puaPathLookup.set(n.rawChar, { path: n.path, cx: n.cx, cy: n.cy, r: n.r });
        }
      }
    }
  }
  return puaPathLookup.get(ch);
}

export function isPuaChar(ch: string): boolean {
  if (!ch) return false;
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 0xe000 && cp <= 0xf8ff;
}

export const RadicalSymbol: React.FC<{
  glyph: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ glyph, className = '', style }) => {
  if (!glyph) return null;
  if (isPuaChar(glyph)) {
    const info = getPuaPath(glyph);
    if (info && info.path) {
      const half = Math.max(info.r * 1.28, 3.2);
      const vb = `${(info.cx - half).toFixed(2)} ${(info.cy - half).toFixed(2)} ${(half * 2).toFixed(2)} ${(half * 2).toFixed(2)}`;
      return (
        <svg
          viewBox={vb}
          className={`inline-block w-[1.05em] h-[1.05em] align-[-0.14em] ${className}`}
          style={style}
          aria-label={glyph}
        >
          <path d={info.path} fill="currentColor" shapeRendering="geometricPrecision" />
        </svg>
      );
    }
  }
  return (
    <span className={className} style={style}>
      {glyph}
    </span>
  );
};

interface ColorSplitGlyphProps {
  char: string;
  strokes?: string[];
  strokeRootIndices?: number[];
  themeMode: ThemeMode;
  /** 1.0 = full multi-color radical split; 0.0 = pure monochromatic calligraphy ink */
  colorMix: number;
  /** Optional active root index to emphasize gently when guiding / rescuing */
  activeRootIdx?: number | null;
  /** True when user just mistyped — adds crisp vermilion ring pulse */
  errorFlash?: boolean;
  sizeClass?: string;
}

export const ColorSplitGlyph: React.FC<ColorSplitGlyphProps> = ({
  char,
  strokes,
  strokeRootIndices,
  themeMode,
  colorMix,
  activeRootIdx = null,
  errorFlash = false,
  sizeClass = 'w-44 h-44 sm:w-52 sm:h-52',
}) => {
  const isWash = themeMode === 'wash';
  const hasStrokes = Boolean(strokes && strokes.length > 0);

  if (!hasStrokes) {
    // Graceful typographic fallback for the ~1.3% ultra-rare classical Daoist glyphs not in MakeMeAHanzi
    const inkColor = getRootColor(0, themeMode, Math.min(0.4, colorMix));
    return (
      <div
        className={`${sizeClass} relative flex items-center justify-center select-none`}
        aria-label={char}
      >
        <span
          className="font-display font-bold leading-none transition-colors duration-300"
          style={{
            fontSize: '7.5rem',
            color: errorFlash ? (isWash ? '#B83B2A' : '#EE6B5A') : inkColor,
          }}
        >
          {char}
        </span>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} relative flex items-center justify-center select-none`}>
      <svg
        viewBox="0 0 1024 1024"
        className="w-full h-full overflow-visible"
        role="img"
        aria-label={char}
      >
        {/* Subtle rice-paper / ink-slate 米字格 guide */}
        <g
          stroke={isWash ? 'rgba(24,24,22,0.09)' : 'rgba(242,238,230,0.07)'}
          strokeWidth="3"
          fill="none"
        >
          <rect x="28" y="28" width="968" height="968" rx="48" />
          <line x1="512" y1="28" x2="512" y2="996" strokeDasharray="16 18" />
          <line x1="28" y1="512" x2="996" y2="512" strokeDasharray="16 18" />
        </g>

        <g transform="translate(0, 900) scale(1, -1)">
          {strokes!.map((d, idx) => {
            const rootIdx = strokeRootIndices?.[idx] ?? 0;
            const isDimmed =
              colorMix >= 0.45 &&
              activeRootIdx !== null &&
              activeRootIdx !== undefined &&
              rootIdx !== activeRootIdx;
            const fill = errorFlash
              ? isWash
                ? '#B83B2A'
                : '#EE6B5A'
              : getRootColor(rootIdx, themeMode, colorMix);
            return (
              <path
                key={idx}
                d={d}
                fill={fill}
                fillOpacity={isDimmed ? 0.55 : 0.96}
                style={{
                  transition: 'fill 320ms ease, fill-opacity 240ms ease',
                }}
                shapeRendering="geometricPrecision"
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};
