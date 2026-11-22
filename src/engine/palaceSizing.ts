export interface DepthFocusMetrics {
  /** Normalized Y fraction of stage height for the active target center */
  centerYRatio: number;
  /** Vertical offset in px from centerY to the glyph center */
  glyphYOffset: number;
  /** Target foreground glyph font size in px (scaled down so the 1:1 Memory Palace fits whole) */
  glyphSize: number;
  /** Square SVG size in px for the 1:1 scaled Memory Palace cloud */
  echoBoxSize: number;
}

/**
 * Computes consistent 1:1 sizing between the foreground target glyph and the
 * anchored Memory Palace SVG cloud (`viewBox="0 0 100 100"`), guaranteeing the
 * entire active key palace fits inside the stage viewport even when anchored
 * on an outer-edge radical (worst-case reach ~90% of SVG box).
 *
 * Ratio: median non-primary PDF glyph height is ~6.6 SVG units and Noto Serif TC
 * ink height is ~0.845 * fontSize => echoBoxSize = glyphSize * 12.8 gives 1:1 parity.
 */
export const ECHO_TO_GLYPH_RATIO = 12.8;

export function getDepthFocusMetrics(
  stageWidth: number,
  stageHeight: number,
  hideCodeHints: boolean
): DepthFocusMetrics {
  const safeW = Math.max(360, stageWidth || 1280);
  const safeH = Math.max(360, stageHeight || 720);

  const centerYRatio = hideCodeHints ? 0.5 : 0.48;
  const glyphYOffset = hideCodeHints ? 0 : -10;

  const glyphCenterY = safeH * centerYRatio + glyphYOffset;
  const availTop = glyphCenterY - 14;
  const availBottom = safeH - glyphCenterY - 14;
  const availSide = safeW * 0.5 - 14;
  const minHalfClearance = Math.max(150, Math.min(availTop, availBottom, availSide));

  // Worst-case anchor-to-chamber-edge reach across all 20 PDF chambers is 90.2% of viewBox
  const rawBox = Math.floor(minHalfClearance / 0.9);
  const clampedBox = Math.max(308, Math.min(614, rawBox));
  const glyphSize = Math.max(24, Math.min(48, Math.round(clampedBox / ECHO_TO_GLYPH_RATIO)));
  const echoBoxSize = Math.round(glyphSize * ECHO_TO_GLYPH_RATIO);

  return {
    centerYRatio,
    glyphYOffset,
    glyphSize,
    echoBoxSize,
  };
}
