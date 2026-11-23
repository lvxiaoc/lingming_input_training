import React from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { ScriptMode } from '../data/scriptFilter';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { KeystrokeCloudPulse, useKeystrokeCloud } from '../data/keystrokeCloud';
import { synth } from '../audio/synth';
import { StrokeCloudStage } from './StrokeCloudStage';
import { RadicalSymbol } from './ColorSplitGlyph';

interface KeystrokeCloudToggleProps {
  /** Compact header variant used inside sub-dojo toolbars */
  compact?: boolean;
  className?: string;
}

export const KeystrokeCloudToggle: React.FC<KeystrokeCloudToggleProps> = ({
  compact = false,
  className = '',
}) => {
  const t = useUiText();
  const { enabled, toggle } = useKeystrokeCloud();

  return (
    <button
      type="button"
      onClick={() => {
        synth.playClick();
        toggle();
      }}
      title={t(
        enabled
          ? '擊鍵字根雲圖：已開啟（僅輸入字根首碼／大碼時在目標重合位浮現記憶宮殿雲圖，聲碼與韻碼不干擾；點擊關閉）'
          : '擊鍵字根雲圖：已關閉（點擊開啟，擊鍵輸入字根首碼時於目標重合位顯影宮殿雲圖）'
      )}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
      } ${
        enabled
          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
          : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
      } ${className}`}
    >
      {enabled ? (
        <Cloud className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <CloudOff className="w-3.5 h-3.5 shrink-0 opacity-75" />
      )}
      <span className="hidden sm:inline">
        {compact
          ? t(enabled ? '擊鍵雲圖' : '雲圖已關')
          : t(enabled ? '擊鍵雲圖：開' : '擊鍵雲圖：關')}
      </span>
    </button>
  );
};

interface KeystrokePalaceCloudProps {
  pulse: KeystrokeCloudPulse | null;
  visible: boolean;
  scriptMode?: ScriptMode;
  /**
   * - 'coincident': 100% target-overlapping Memory Palace cloud (anchorOnActive=true, variant="echo")
   *   centered mathematically on the target glyph so gaze never drifts away from the character.
   * - 'flank': Compact side-mounted preview (kept only as an optional fallback).
   */
  placement?: 'coincident' | 'flank';
  /** Preset diameter or explicit px override (`boxPx`) */
  size?: 'sm' | 'md' | 'lg' | 'coincident-sm' | 'coincident' | 'coincident-lg';
  boxPx?: number;
  /** Optional style overrides for exact coordinate centering (e.g. GameCanvas stage) */
  style?: React.CSSProperties;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<KeystrokePalaceCloudProps['size']>, number> = {
  sm: 184,
  md: 224,
  lg: 256,
  'coincident-sm': 320,
  coincident: 400,
  'coincident-lg': 460,
};

export const KeystrokePalaceCloud: React.FC<KeystrokePalaceCloudProps> = ({
  pulse,
  visible,
  scriptMode = 'both',
  placement = 'coincident',
  size = 'coincident',
  boxPx,
  style,
  className = '',
}) => {
  const t = useUiText();
  const isWash = useThemeMode() === 'wash';

  if (!pulse) return null;

  const chamber = LINGMING_CHAMBER_BY_KEY[pulse.chamberKey];
  if (!chamber) return null;

  const isCoincident = placement === 'coincident';
  const px = boxPx ?? SIZE_MAP[size];
  const isMiss = pulse.status === 'miss';
  const keyUpper = pulse.chamberKey.toUpperCase();

  if (isCoincident) {
    // Pure zero-offset coincident wrapper: outer box is strictly the cloud square
    // so `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` locks the active radical dead-center on the target glyph.
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none ${className}`}
        style={{
          width: `${px}px`,
          height: `${px}px`,
          ...style,
        }}
      >
        <div
          className="relative w-full h-full flex items-center justify-center rounded-full"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            filter: isWash ? (visible ? 'blur(0px)' : 'blur(4px)') : 'none',
            transition: visible
              ? 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 220ms ease-out'
              : 'opacity 320ms ease-out, transform 320ms ease-out, filter 280ms ease-out',
            background: isWash
              ? isMiss
                ? 'radial-gradient(circle at 50% 50%, rgba(184,59,42,0.06) 0%, rgba(243,241,236,0.42) 44%, rgba(243,241,236,0) 74%)'
                : 'radial-gradient(circle at 50% 50%, rgba(243,241,236,0.46) 0%, rgba(243,241,236,0.24) 48%, rgba(243,241,236,0) 74%)'
              : isMiss
                ? 'radial-gradient(circle at 50% 50%, rgba(201,62,45,0.10) 0%, rgba(11,15,23,0.48) 44%, rgba(11,15,23,0) 74%)'
                : 'radial-gradient(circle at 50% 50%, rgba(15,22,34,0.44) 0%, rgba(11,15,23,0.22) 48%, rgba(11,15,23,0) 74%)',
          }}
        >
          <div className="w-full h-full">
            <StrokeCloudStage
              key={`${pulse.chamberKey}_${pulse.tick}`}
              chamberKey={pulse.chamberKey}
              activeChar={pulse.activeChar}
              variant="echo"
              anchorOnActive
              scriptMode={scriptMode}
            />
          </div>

          {/* Whisper-quiet Palace Chamber Seal floating at upper rim without shifting geometric center */}
          <div
            className={`absolute top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] whitespace-nowrap backdrop-blur-xs ${
              isMiss
                ? isWash
                  ? 'bg-[#FDF6F5]/92 border-[#B83B2A]/35 text-[#B83B2A]'
                  : 'bg-[#251318]/90 border-[#E25A48]/40 text-[#F28B7D]'
                : isWash
                  ? 'bg-[#F8F6F0]/86 border-[#141413]/14 text-[#2E2E2A]'
                  : 'bg-[#121927]/84 border-[#F2EEE6]/12 text-[#D6DCE8]'
            }`}
          >
            {isMiss && pulse.pressedKey && (
              <>
                <span className="font-mono-tabular opacity-75">
                  {t('誤')} {pulse.pressedKey.toUpperCase()}
                </span>
                <span aria-hidden="true" className="opacity-45">→</span>
              </>
            )}
            <span className="font-mono-tabular font-bold text-[var(--dojo-ochre)]">
              {keyUpper}
            </span>
            <span className="font-display font-semibold">
              {chamber.primaryAnchor}
              {t('宮')}
            </span>
            {pulse.activeChar && pulse.activeChar !== chamber.primaryAnchor && (
              <>
                <span aria-hidden="true" className="opacity-35">·</span>
                <RadicalSymbol
                  glyph={pulse.activeChar}
                  className="font-display font-bold text-xs text-[var(--dojo-text-bright)]"
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none flex flex-col items-center ${className}`}
      style={{
        opacity: visible ? 0.94 : 0,
        transform: visible ? 'scale(1) translateY(0px)' : 'scale(0.93) translateY(6px)',
        filter: isWash ? (visible ? 'blur(0px)' : 'blur(4px)') : 'none',
        transition: visible
          ? 'opacity 190ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 220ms ease-out'
          : 'opacity 360ms ease-out, transform 360ms ease-out, filter 300ms ease-out',
        ...style,
      }}
    >
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: `${px}px`,
          height: `${px}px`,
          background: isWash
            ? isMiss
              ? 'radial-gradient(circle at 50% 50%, rgba(184,59,42,0.08) 0%, rgba(243,241,236,0.72) 54%, rgba(243,241,236,0) 76%)'
              : 'radial-gradient(circle at 50% 50%, rgba(243,241,236,0.88) 0%, rgba(243,241,236,0.68) 54%, rgba(243,241,236,0) 76%)'
            : isMiss
              ? 'radial-gradient(circle at 50% 50%, rgba(201,62,45,0.12) 0%, rgba(11,15,23,0.76) 54%, rgba(11,15,23,0) 76%)'
              : 'radial-gradient(circle at 50% 50%, rgba(17,24,38,0.84) 0%, rgba(11,15,23,0.62) 54%, rgba(11,15,23,0) 76%)',
        }}
      >
        <div className="w-[88%] h-[88%]">
          <StrokeCloudStage
            key={`${pulse.chamberKey}_${pulse.tick}`}
            chamberKey={pulse.chamberKey}
            activeChar={pulse.activeChar}
            variant="palace"
            anchorOnActive={false}
            scriptMode={scriptMode}
          />
        </div>
      </div>

      <div
        className={`-mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] backdrop-blur-xs ${
          isMiss
            ? isWash
              ? 'bg-[#FDF6F5]/92 border-[#B83B2A]/35 text-[#B83B2A]'
              : 'bg-[#251318]/90 border-[#E25A48]/40 text-[#F28B7D]'
            : isWash
              ? 'bg-[#F8F6F0]/90 border-[#141413]/15 text-[#2E2E2A]'
              : 'bg-[#121927]/88 border-[#F2EEE6]/14 text-[#D6DCE8]'
        }`}
      >
        {isMiss && pulse.pressedKey && (
          <>
            <span className="font-mono-tabular opacity-75">
              {t('誤')} {pulse.pressedKey.toUpperCase()}
            </span>
            <span aria-hidden="true" className="opacity-45">→</span>
          </>
        )}
        <span className="font-mono-tabular font-bold text-[var(--dojo-ochre)]">
          {keyUpper}
        </span>
        <span className="font-display font-semibold">
          {chamber.primaryAnchor}
          {t('宮')}
        </span>
        {pulse.activeChar && pulse.activeChar !== chamber.primaryAnchor && (
          <>
            <span aria-hidden="true" className="opacity-35">·</span>
            <RadicalSymbol
              glyph={pulse.activeChar}
              className="font-display font-bold text-xs text-[var(--dojo-text-bright)]"
            />
          </>
        )}
      </div>
    </div>
  );
};
