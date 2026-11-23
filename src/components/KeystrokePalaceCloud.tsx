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
          ? '擊鍵字根雲圖：已開啟（每次擊鍵自動浮現對應鍵位記憶宮殿雲圖，點擊關閉）'
          : '擊鍵字根雲圖：已關閉（點擊開啟，全站練習擊鍵即顯對應鍵位雲圖）'
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
      <span className={compact ? 'hidden sm:inline' : 'hidden sm:inline'}>
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
   * Proportionally bounded cloud diameters so large target characters are never dwarfed or collided:
   * - sm: 184px (mobile / tight panels)
   * - md: 224px (ShortCodeDojo, ExtremeDrillStudio, Arcade, Desk Mode)
   * - lg: 256px (Huangting Depth Mode left flank)
   */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg', number> = {
  sm: 184,
  md: 224,
  lg: 256,
};

export const KeystrokePalaceCloud: React.FC<KeystrokePalaceCloudProps> = ({
  pulse,
  visible,
  scriptMode = 'both',
  size = 'md',
  className = '',
}) => {
  const t = useUiText();
  const isWash = useThemeMode() === 'wash';

  if (!pulse) return null;

  const px = SIZE_MAP[size];
  const chamber = LINGMING_CHAMBER_BY_KEY[pulse.chamberKey];
  if (!chamber) return null;

  const isMiss = pulse.status === 'miss';
  const keyUpper = pulse.chamberKey.toUpperCase();

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
      }}
    >
      {/* Proportionally bounded full-chamber cloud (anchorOnActive=false keeps 1:1 Memory Palace silhouette) */}
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

      {/* Whisper-quiet Palace Chamber Seal below the cloud */}
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
