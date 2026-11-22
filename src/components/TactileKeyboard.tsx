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
    <div className="w-full bg-[#0D1017] border-t border-[#F2EEE6]/8 px-3 sm:px-6 py-3 select-none">
      <div className="max-w-4xl mx-auto flex flex-col gap-2">
        {/* Clean unboxed zone legend & live finger/role hint strip */}
        <div className="flex items-center justify-between gap-4 text-xs min-h-[20px]">
          <div className="flex items-center gap-3 text-[#9BA3B2] overflow-hidden">
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

          <div className="flex items-center gap-2 text-[#D8D3C8] whitespace-nowrap shrink-0">
            {target && nextKey && tabHintActive ? (
              <>
                {target.nextRole && (
                  <>
                    <span className="text-[#9BA3B2]">{t(ROLE_LABELS[target.nextRole])}</span>
                    <span aria-hidden="true" className="text-[#565E6E]">·</span>
                  </>
                )}
                <span className="font-medium text-[#F2EEE6]">
                  {nextFingerId ? t(FINGER_LABELS[nextFingerId]) : ''}
                </span>
                <span aria-hidden="true" className="text-[#565E6E]">·</span>
                <span
                  className="font-mono-tabular font-semibold"
                  style={{ color: nextZone?.color || '#D89B3C' }}
                >
                  {target.nextRole === 'da' || !target.nextRole
                    ? nextKey.toUpperCase()
                    : nextKey.toLowerCase()}
                  （{nextKeyDef?.primary}）
                </span>
              </>
            ) : strikeFlash ? (
              <span className={strikeFlash.correct ? 'text-[#34D399]' : 'text-[#F06454]'}>
                {strikeFlash.correct
                  ? t(`擊鍵正確 · ${strikeFlash.key.toUpperCase()}`)
                  : t(`誤按 ${strikeFlash.key.toUpperCase()} · 請輸入正確鍵位`)}
              </span>
            ) : (
              <span className="text-[#9BA3B2]">{t('無預高亮 · 擊鍵即時反饋（按 Tab 提示）')}</span>
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
                      backgroundColor: isError
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
                      borderColor: isError
                        ? '#F04E3E'
                        : isHitCorrect
                          ? '#34D399'
                          : isTabTarget
                            ? '#E8B356'
                            : isVowel
                              ? 'rgba(216, 155, 60, 0.26)'
                              : 'rgba(242, 238, 230, 0.1)',
                      boxShadow:
                        isPressed || isDisabled
                          ? '0 1px 0 #080A0E'
                          : isHitCorrect
                            ? '0 3px 0 #080A0E, 0 0 18px rgba(52, 211, 153, 0.42)'
                            : isError
                              ? '0 3px 0 #080A0E, 0 0 18px rgba(240, 78, 62, 0.45)'
                              : '0 3px 0 #080A0E',
                    }}
                  >
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
                        isTarget
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
                        isTarget
                          ? 'text-[#FFFFFF] opacity-100'
                          : isVowel
                            ? `text-[#E8C57B] ${legendOpacityClass}`
                            : isDisabled
                              ? 'text-[#6A7383]'
                              : `text-[#E8E2D6] ${legendOpacityClass}`
                      }`}
                    >
                      {def?.primary || k.toUpperCase()}
                    </span>

                    {/* Mini Memory Palace sibling preview + homing bar + latency mastery */}
                    <div className="w-full px-1.5 pb-1 flex flex-col items-center gap-0.5">
                      {def?.sub && !isVowel && !isDisabled && scaffoldLevel <= 1 && (
                        <span className="text-[9px] text-[#838C9D] truncate max-w-full leading-none hidden sm:block">
                          {def.sub}
                        </span>
                      )}
                      {isHomeKey && (
                        <span className="block w-3 h-[1.5px] bg-[#D89B3C]/65 rounded-full" />
                      )}
                      <div className="w-full h-[2px] bg-[#F2EEE6]/6 rounded-full overflow-hidden">
                        {masteryPct > 0 && !isDisabled && (
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${masteryPct}%`,
                              backgroundColor:
                                masteryPct >= 70
                                  ? '#2EA87E'
                                  : masteryPct >= 40
                                    ? '#D89B3C'
                                    : '#D9604C',
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
