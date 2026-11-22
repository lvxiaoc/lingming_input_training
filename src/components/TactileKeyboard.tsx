import React, { useEffect, useState } from 'react';
import {
  FINGER_LABELS,
  KEY_FINGER_MAP,
  KEYBOARD_ROWS,
  ShapeCodeScheme,
} from '../data/schemes';
import { useUiText } from '../data/uiScript';
import { ActiveTargetSnapshot } from '../engine/GameCanvas';
import { SchemeMasteryStore } from '../engine/mastery';
import { useThemeMode } from '../data/theme';

interface TactileKeyboardProps {
  scheme: ShapeCodeScheme;
  target: ActiveTargetSnapshot | null;
  mastery: SchemeMasteryStore;
  onVirtualKey: (key: string) => void;
}

const ROLE_LABELS: Record<'da' | 'sheng' | 'yun', string> = {
  da: '大碼（輔音宮殿）',
  sheng: '聲碼（拼音聲母）',
  yun: '韻碼（元音終止）',
};

export const TactileKeyboard: React.FC<TactileKeyboardProps> = ({
  scheme,
  target,
  mastery,
  onVirtualKey,
}) => {
  const t = useUiText();
  const isWash = useThemeMode() === 'wash';
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [strikeFlash, setStrikeFlash] = useState<{
    key: string;
    correct: boolean;
    tick: number;
  } | null>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) {
        setPressedKey(k);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      setPressedKey((prev) => (prev === k ? null : prev));
    };
    const onBlur = () => setPressedKey(null);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (!target?.lastStrikeKey || !target.lastStrikeTick) return;
    setStrikeFlash({
      key: target.lastStrikeKey,
      correct: target.lastStrikeCorrect,
      tick: target.lastStrikeTick,
    });
    const id = window.setTimeout(() => {
      setStrikeFlash((prev) =>
        prev && prev.tick === target.lastStrikeTick ? null : prev
      );
    }, target.lastStrikeCorrect ? 300 : 380);
    return () => window.clearTimeout(id);
  }, [target?.lastStrikeKey, target?.lastStrikeCorrect, target?.lastStrikeTick]);

  const scaffoldLevel = target?.scaffoldLevel ?? 0;
  const nextKey = target?.nextKey || '';
  const tabHintActive = Boolean(target?.tabHintActive);
  const nextKeyDef = nextKey ? scheme.keyMap[nextKey] : null;
  const nextFingerId = nextKey ? KEY_FINGER_MAP[nextKey] : null;
  const nextZone = nextKeyDef
    ? scheme.zones.find((z) => z.id === nextKeyDef.zoneId)
    : null;

  const legendOpacityClass =
    scaffoldLevel === 0
      ? 'opacity-100'
      : scaffoldLevel === 1
        ? 'opacity-75'
        : scaffoldLevel === 2
          ? 'opacity-35'
          : 'opacity-15';

  const rowOffsets = ['pl-0', 'pl-4 sm:pl-6', 'pl-9 sm:pl-14'];

  return (
    <div
      className={`w-full border-t px-3 sm:px-6 py-3 select-none ${
        isWash
          ? 'bg-gradient-to-b from-[#ECE4D4]/92 to-[#E2D8C4]/95 border-[#1C1A17]/14 backdrop-blur-sm'
          : 'bg-[#0D1017] border-[#F2EEE6]/8'
      }`}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {/* Clean unboxed zone legend & live finger/role hint strip */}
        <div className="flex items-center justify-between gap-4 text-xs min-h-[20px]">
          <div
            className={`flex items-center gap-3 overflow-hidden ${
              isWash ? 'text-[#555046]' : 'text-[#9BA3B2]'
            }`}
          >
            {scheme.zones.map((z) => (
              <span key={z.id} className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span
                  className="inline-block w-2 h-0.5 rounded-sm"
                  style={{ backgroundColor: z.color }}
                />
                <span>{t(z.label)}</span>
              </span>
            ))}
          </div>

          <div
            className={`flex items-center gap-2 whitespace-nowrap shrink-0 ${
              isWash ? 'text-[#2D2A24]' : 'text-[#D8D3C8]'
            }`}
          >
            {target && nextKey && tabHintActive ? (
              <>
                {target.nextRole && (
                  <>
                    <span className={isWash ? 'text-[#555046]' : 'text-[#9BA3B2]'}>
                      {t(ROLE_LABELS[target.nextRole])}
                    </span>
                    <span aria-hidden="true" className={isWash ? 'text-[#9B9386]' : 'text-[#565E6E]'}>·</span>
                  </>
                )}
                <span className={`font-medium ${isWash ? 'text-[#1C1A17]' : 'text-[#F2EEE6]'}`}>
                  {nextFingerId ? t(FINGER_LABELS[nextFingerId]) : ''}
                </span>
                <span aria-hidden="true" className={isWash ? 'text-[#9B9386]' : 'text-[#565E6E]'}>·</span>
                <span
                  className="font-mono-tabular font-semibold"
                  style={{ color: nextZone?.color || (isWash ? '#9C6414' : '#D89B3C') }}
                >
                  {target.nextRole === 'da' || !target.nextRole
                    ? nextKey.toUpperCase()
                    : nextKey.toLowerCase()}
                  （{nextKeyDef?.primary}）
                </span>
              </>
            ) : strikeFlash ? (
              <span
                className={
                  strikeFlash.correct
                    ? isWash ? 'text-[#185B43]' : 'text-[#34D399]'
                    : isWash ? 'text-[#A53020]' : 'text-[#F06454]'
                }
              >
                {strikeFlash.correct
                  ? t(`擊鍵正確 · ${strikeFlash.key.toUpperCase()}`)
                  : t(`誤按 ${strikeFlash.key.toUpperCase()} · 請輸入正確鍵位`)}
              </span>
            ) : (
              <span className={isWash ? 'text-[#6A6357]' : 'text-[#9BA3B2]'}>
                {t('無預高亮 · 擊鍵即時反饋（按 Tab 提示）')}
              </span>
            )}
          </div>
        </div>

        {/* Sculpted 3-row mechanical keyboard */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div
              key={rIdx}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 ${rowOffsets[rIdx]}`}
            >
              {row.map((k) => {
                const def = scheme.keyMap[k];
                const zone = def ? scheme.zones.find((z) => z.id === def.zoneId) : null;
                const zoneColor = zone?.color || '#64748B';
                const isDisabled = Boolean(def?.isDisabled);
                const isVowel = Boolean(def?.isVowel);
                const isTabTarget = !isDisabled && tabHintActive && nextKey === k;
                const isPressed = pressedKey === k;
                const isHitCorrect = Boolean(
                  strikeFlash && strikeFlash.key === k && strikeFlash.correct
                );
                const isError = Boolean(
                  strikeFlash && strikeFlash.key === k && !strikeFlash.correct
                );
                const isTarget = isTabTarget || isHitCorrect;
                const isHomeKey = k === 'f' || k === 'j';

                const stat = mastery.keys[k];
                const masteryPct =
                  stat && stat.attempts > 0
                    ? Math.max(
                        12,
                        Math.min(
                          100,
                          Math.round(((900 - Math.min(900, stat.emaLatencyMs)) / 620) * 100)
                        )
                      )
                    : 0;

                return (
                  <button
                    key={k}
                    type="button"
                    disabled={isDisabled}
                    onMouseDown={(e) => {
                      if (isDisabled) return;
                      e.preventDefault();
                      setPressedKey(k);
                      onVirtualKey(k);
                    }}
                    onMouseUp={() => setPressedKey(null)}
                    onMouseLeave={() => setPressedKey((p) => (p === k ? null : p))}
                    aria-label={`${k.toUpperCase()} ${def?.primary || ''}`}
                    className={`keycap-surface relative flex flex-col justify-between items-center rounded-lg border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D89B3C] ${
                      isDisabled
                        ? 'opacity-45 cursor-not-allowed'
                        : 'cursor-pointer'
                    } ${isPressed && !isDisabled ? 'translate-y-[2px]' : 'translate-y-0'}`}
                    style={{
                      width: 'clamp(44px, 7.8vw, 76px)',
                      height: 'clamp(48px, 6.6vh, 62px)',
                      backgroundColor: isWash
                        ? isError
                          ? 'rgba(184, 59, 42, 0.14)'
                          : isHitCorrect
                            ? 'rgba(31, 110, 82, 0.14)'
                            : isTabTarget
                              ? 'rgba(156, 100, 20, 0.14)'
                              : isVowel
                                ? '#EBE1CF'
                                : isDisabled
                                  ? '#E2DACB'
                                  : '#F7F3EA'
                        : isError
                          ? 'rgba(240, 78, 62, 0.34)'
                          : isHitCorrect
                            ? 'rgba(52, 211, 153, 0.32)'
                            : isTabTarget
                              ? 'rgba(232, 179, 86, 0.24)'
                              : isVowel
                                ? 'rgba(216, 155, 60, 0.08)'
                                : isDisabled
                                  ? '#11151D'
                                  : '#171C26',
                      backgroundImage: isWash
                        ? isError
                          ? 'radial-gradient(circle at 50% 48%, rgba(184, 59, 42, 0.28) 0%, rgba(184, 59, 42, 0.10) 65%, transparent 100%)'
                          : isHitCorrect
                            ? 'radial-gradient(circle at 50% 48%, rgba(31, 110, 82, 0.26) 0%, rgba(31, 110, 82, 0.10) 65%, transparent 100%)'
                            : isTabTarget
                              ? 'radial-gradient(circle at 50% 48%, rgba(156, 100, 20, 0.24) 0%, rgba(156, 100, 20, 0.08) 70%, transparent 100%)'
                              : isPressed
                                ? 'radial-gradient(circle at 50% 48%, rgba(28, 26, 23, 0.16) 0%, rgba(28, 26, 23, 0.05) 75%, transparent 100%)'
                                : isDisabled
                                  ? 'none'
                                  : isVowel
                                    ? 'linear-gradient(180deg, #F0E6D4 0%, #E5D9C2 100%)'
                                    : 'linear-gradient(180deg, #FAF6EE 0%, #EFE8D8 100%)'
                        : 'none',
                      borderColor: isWash
                        ? isError
                          ? '#B83B2A'
                          : isHitCorrect
                            ? '#1F6E52'
                            : isTabTarget
                              ? '#9C6414'
                              : isVowel
                                ? 'rgba(156, 100, 20, 0.34)'
                                : 'rgba(28, 26, 23, 0.16)'
                        : isError
                          ? '#F04E3E'
                          : isHitCorrect
                            ? '#34D399'
                            : isTabTarget
                              ? '#E8B356'
                              : isVowel
                                ? 'rgba(216, 155, 60, 0.26)'
                                : 'rgba(242, 238, 230, 0.1)',
                      boxShadow: isWash
                        ? isPressed || isDisabled
                          ? '0 1px 0 #C7BEB0, inset 0 0 8px rgba(28, 26, 23, 0.08)'
                          : isHitCorrect
                            ? '0 3px 0 #C7BEB0, 0 0 20px rgba(31, 110, 82, 0.28), inset 0 0 10px rgba(31, 110, 82, 0.14)'
                            : isError
                              ? '0 3px 0 #C7BEB0, 0 0 20px rgba(184, 59, 42, 0.30), inset 0 0 10px rgba(184, 59, 42, 0.15)'
                              : '0 3px 0 #C7BEB0, inset 0 1px 0 rgba(255, 253, 248, 0.65)'
                        : isPressed || isDisabled
                          ? '0 1px 0 #080A0E'
                          : isHitCorrect
                            ? '0 3px 0 #080A0E, 0 0 18px rgba(52, 211, 153, 0.42)'
                            : isError
                              ? '0 3px 0 #080A0E, 0 0 18px rgba(240, 78, 62, 0.45)'
                              : '0 3px 0 #080A0E',
                    }}
                  >
                    {isWash && (isHitCorrect || isError) && strikeFlash && (
                      <span
                        key={`tactile_ripple_${strikeFlash.tick}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 rounded-xl border-2 ink-bloom-ring"
                        style={{
                          borderColor: isError ? 'rgba(184, 59, 42, 0.65)' : 'rgba(31, 110, 82, 0.65)',
                        }}
                      />
                    )}
                    {/* Top zone accent hairline */}
                    <span
                      className="block w-8 h-[2px] rounded-full mt-1"
                      style={{
                        backgroundColor: zoneColor,
                        opacity: isDisabled
                          ? 0.2
                          : isTarget
                            ? 1
                            : scaffoldLevel >= 2
                              ? 0.22
                              : 0.7,
                      }}
                    />

                    {/* Key letter top-left */}
                    <span
                      className={`absolute top-1 left-1.5 font-mono-tabular text-[10px] font-semibold leading-none ${
                        isWash
                          ? isTarget
                            ? 'text-[#141210]'
                            : isVowel
                              ? 'text-[#9C6414]'
                              : 'text-[#70695D]'
                          : isTarget
                            ? 'text-[#FFFFFF]'
                            : isVowel
                              ? 'text-[#D89B3C]'
                              : 'text-[#737C8C]'
                      }`}
                    >
                      {k.toUpperCase()}
                    </span>

                    {/* Primary Anchor Radical or Vowel label */}
                    <span
                      className={`font-display font-bold leading-none mt-0.5 ${
                        isVowel || isDisabled ? 'text-xs sm:text-sm' : 'text-base sm:text-lg'
                      } ${
                        isWash
                          ? isTarget
                            ? 'text-[#141210] opacity-100'
                            : isVowel
                              ? `text-[#87520A] ${legendOpacityClass}`
                              : isDisabled
                                ? 'text-[#8C8476]'
                                : `text-[#1C1A17] ${legendOpacityClass}`
                          : isTarget
                            ? 'text-[#FFFFFF] opacity-100'
                            : isVowel
                              ? `text-[#E8C57B] ${legendOpacityClass}`
                              : isDisabled
                                ? 'text-[#6A7383]'
                                : `text-[#E8E2D6] ${legendOpacityClass}`
                      }`}
                    >
                      {def?.primary === '𠂇' ? (
                        <svg
                          viewBox="0 0 24 24"
                          className="inline-block align-middle"
                          style={{ width: '1em', height: '1em' }}
                          aria-label="𠂇"
                        >
                          <path
                            fill="currentColor"
                            d="M2.5 7.6 L18.8 7.0 Q20.1 6.9 21.1 7.9 Q21.3 8.4 20.6 8.7 L3.2 9.0 Q2.4 8.8 2.5 7.6 Z"
                          />
                          <path
                            fill="currentColor"
                            d="M12.3 2.8 Q13.7 3.2 14.1 4.2 C13.0 8.9 11.1 14.0 8.3 17.8 C6.4 20.3 4.1 21.8 2.5 22.4 C2.2 22.1 2.4 21.7 2.8 21.3 C5.4 19.2 8.2 15.3 10.0 10.7 C11.1 7.8 11.7 5.1 11.8 3.3 Q11.9 2.7 12.3 2.8 Z"
                          />
                        </svg>
                      ) : (
                        def?.primary || k.toUpperCase()
                      )}
                    </span>

                    {/* Mini Memory Palace sibling preview + homing bar + latency mastery */}
                    <div className="w-full px-1.5 pb-1 flex flex-col items-center gap-0.5">
                      {def?.sub && !isVowel && !isDisabled && scaffoldLevel <= 1 && (
                        <span
                          className={`text-[9px] truncate max-w-full leading-none hidden sm:block ${
                            isWash ? 'text-[#6A6357]' : 'text-[#838C9D]'
                          }`}
                        >
                          {def.sub}
                        </span>
                      )}
                      {isHomeKey && (
                        <span
                          className={`block w-3 h-[1.5px] rounded-full ${
                            isWash ? 'bg-[#9C6414]/65' : 'bg-[#D89B3C]/65'
                          }`}
                        />
                      )}
                      <div
                        className={`w-full h-[2px] rounded-full overflow-hidden ${
                          isWash ? 'bg-[#1C1A17]/10' : 'bg-[#F2EEE6]/6'
                        }`}
                      >
                        {masteryPct > 0 && !isDisabled && (
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${masteryPct}%`,
                              backgroundColor:
                                masteryPct >= 70
                                  ? isWash ? '#1F6E52' : '#2EA87E'
                                  : masteryPct >= 40
                                    ? isWash ? '#9C6414' : '#D89B3C'
                                    : isWash ? '#B83B2A' : '#D9604C',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
