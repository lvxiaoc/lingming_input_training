import React, { useEffect, useState } from 'react';
import { ShapeCodeScheme } from '../data/schemes';
import { useUiText } from '../data/uiScript';
import { ActiveTargetSnapshot } from '../engine/GameCanvas';
import { SchemeMasteryStore } from '../engine/mastery';
import { useThemeMode } from '../data/theme';

interface BlurredKeyboardBackdropProps {
  scheme: ShapeCodeScheme;
  target: ActiveTargetSnapshot | null;
  mastery: SchemeMasteryStore;
}

// Alice-style ergonomic split keyboard halves — opens a clean central sanctuary for the target glyph & Stroke Cloud!
const ALICE_LEFT_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't'],
  ['a', 's', 'd', 'f', 'g'],
  ['z', 'x', 'c', 'v', 'b'],
];

const ALICE_RIGHT_ROWS: string[][] = [
  ['y', 'u', 'i', 'o', 'p'],
  ['h', 'j', 'k', 'l'],
  ['n', 'm'],
];

interface StrikeFlash {
  key: string;
  correct: boolean;
  tick: number;
}

/**
 * Layer 0 — Alice 分離式人體工學遠景鍵盤（Cool Indigo-Slate Depth Plane）
 * - Splits into angled left & right wings, leaving a generous open central valley for the target glyph & Stroke Cloud.
 * - NEVER pre-highlights the upcoming answer key!
 * - Purely reactive background stimulus: highlights ONLY the key you actually press,
 *   flashing Emerald-Jade (#34D399) on correct hit and Cinnabar-Crimson (#F04E3E) on wrong hit.
 * - Pressing Tab (emergency peek) briefly shows a gentle amber outline on the expected key.
 */
export const BlurredKeyboardBackdrop: React.FC<BlurredKeyboardBackdropProps> = ({
  scheme,
  target,
  mastery,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [strikeFlash, setStrikeFlash] = useState<StrikeFlash | null>(null);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (/^[a-z]$/.test(k)) setPressedKey(k);
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
    const duration = target.lastStrikeCorrect ? 360 : 460;
    const id = window.setTimeout(() => {
      setStrikeFlash((prev) =>
        prev && prev.tick === target.lastStrikeTick ? null : prev
      );
    }, duration);
    return () => window.clearTimeout(id);
  }, [target?.lastStrikeKey, target?.lastStrikeCorrect, target?.lastStrikeTick]);

  const scaffoldLevel = target?.scaffoldLevel ?? 0;
  const tabHintKey = target?.tabHintActive ? target.nextKey : '';

  // Calm recessed depth blur for idle keys (no spoilers ahead of time!)
  const baseBlurPx =
    scaffoldLevel === 0 ? 1.5 : scaffoldLevel === 1 ? 2.4 : scaffoldLevel === 2 ? 3.5 : 4.6;
  const baseLayerOpacity =
    scaffoldLevel === 0 ? 0.52 : scaffoldLevel === 1 ? 0.38 : scaffoldLevel === 2 ? 0.24 : 0.14;

  const isLeftStrike =
    strikeFlash && ALICE_LEFT_ROWS.some((row) => row.includes(strikeFlash.key));
  const isRightStrike =
    strikeFlash && ALICE_RIGHT_ROWS.some((row) => row.includes(strikeFlash.key));

  const renderKeycap = (k: string) => {
    const def = scheme.keyMap[k];
    const isDisabled = Boolean(def?.isDisabled);
    const isVowel = Boolean(def?.isVowel);
    const isPressed = pressedKey === k;
    const isHitCorrect = Boolean(strikeFlash && strikeFlash.key === k && strikeFlash.correct);
    const isHitWrong = Boolean(strikeFlash && strikeFlash.key === k && !strikeFlash.correct);
    const isTabHint = !isDisabled && tabHintKey === k;
    const isHome = k === 'f' || k === 'j';

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

    // ONLY reactively sharpen the struck key (or explicit Tab emergency peek)
    const isLit = isHitCorrect || isHitWrong || isTabHint || isPressed;
    const keyFilter = isLit ? 'blur(0px)' : `blur(${baseBlurPx}px)`;
    const keyOpacity = isDisabled
      ? isWash
        ? 0.22
        : 0.14
      : isHitCorrect || isHitWrong
        ? 1
        : isTabHint
          ? 0.94
          : isPressed
            ? 0.85
            : isWash
              ? Math.min(0.68, baseLayerOpacity + 0.12)
              : baseLayerOpacity;

    const bgImageStyle = isWash
      ? isHitWrong
        ? 'radial-gradient(circle at 50% 48%, rgba(20, 20, 18, 0.34) 0%, rgba(20, 20, 18, 0.14) 58%, rgba(20, 20, 18, 0.04) 100%)'
        : isHitCorrect
          ? 'radial-gradient(circle at 50% 48%, rgba(20, 20, 18, 0.28) 0%, rgba(20, 20, 18, 0.11) 60%, rgba(20, 20, 18, 0.03) 100%)'
          : isTabHint
            ? 'radial-gradient(circle at 50% 48%, rgba(40, 40, 38, 0.22) 0%, rgba(40, 40, 38, 0.08) 65%, transparent 100%)'
            : isPressed
              ? 'radial-gradient(circle at 50% 48%, rgba(20, 20, 18, 0.22) 0%, rgba(20, 20, 18, 0.09) 70%, transparent 100%)'
              : isVowel
                ? 'linear-gradient(180deg, rgba(238, 236, 229, 0.90) 0%, rgba(224, 221, 212, 0.84) 100%)'
                : 'linear-gradient(180deg, rgba(250, 249, 245, 0.88) 0%, rgba(236, 234, 227, 0.80) 100%)'
      : 'none';

    const bgStyle = isWash
      ? isHitWrong
        ? 'rgba(20, 20, 18, 0.14)'
        : isHitCorrect
          ? 'rgba(20, 20, 18, 0.11)'
          : isTabHint
            ? 'rgba(38, 38, 36, 0.10)'
            : isPressed
              ? 'rgba(20, 20, 18, 0.10)'
              : isVowel
                ? 'rgba(20, 20, 18, 0.065)'
                : 'rgba(20, 20, 18, 0.03)'
      : isHitWrong
        ? 'rgba(240, 78, 62, 0.36)'
        : isHitCorrect
          ? 'rgba(52, 211, 153, 0.34)'
          : isTabHint
            ? 'rgba(232, 179, 86, 0.24)'
            : isPressed
              ? 'rgba(118, 152, 206, 0.26)'
              : isVowel
                ? 'rgba(184, 136, 58, 0.11)'
                : 'rgba(38, 52, 78, 0.36)';

    const borderStyle = isWash
      ? isHitWrong
        ? '#141413'
        : isHitCorrect
          ? '#181817'
          : isTabHint
            ? '#383834'
            : isVowel
              ? 'rgba(20, 20, 18, 0.26)'
              : 'rgba(20, 20, 18, 0.15)'
      : isHitWrong
        ? '#F04E3E'
        : isHitCorrect
          ? '#34D399'
          : isTabHint
            ? '#E8B356'
            : isVowel
              ? 'rgba(216, 155, 60, 0.26)'
              : 'rgba(118, 148, 196, 0.22)';

    const glowShadow = isWash
      ? isHitWrong
        ? '0 0 28px rgba(20, 20, 18, 0.30), 0 0 54px rgba(20, 20, 18, 0.14), inset 0 0 16px rgba(20, 20, 18, 0.18)'
        : isHitCorrect
          ? '0 0 28px rgba(20, 20, 18, 0.26), 0 0 52px rgba(20, 20, 18, 0.11), inset 0 0 14px rgba(20, 20, 18, 0.14)'
          : isTabHint
            ? '0 0 22px rgba(20, 20, 18, 0.22), inset 0 0 10px rgba(20, 20, 18, 0.10)'
            : isPressed
              ? '0 0 18px rgba(20, 20, 18, 0.18), inset 0 0 10px rgba(20, 20, 18, 0.10)'
              : '0 2px 6px rgba(20, 20, 18, 0.04)'
      : isHitWrong
        ? '0 0 34px rgba(240, 78, 62, 0.55), inset 0 0 12px rgba(240, 78, 62, 0.24)'
        : isHitCorrect
          ? '0 0 34px rgba(52, 211, 153, 0.52), inset 0 0 12px rgba(52, 211, 153, 0.22)'
          : isTabHint
            ? '0 0 22px rgba(232, 179, 86, 0.32)'
            : 'none';

    const scaleTransform = isWash
      ? isHitWrong
        ? 'scale(0.985) translateX(1.5px)'
        : isHitCorrect
          ? 'scale(1.015)'
          : isPressed
            ? 'scale(0.98)'
            : 'scale(1)'
      : isHitWrong
        ? 'scale(0.95) translateX(2px)'
        : isHitCorrect
          ? 'scale(1.10)'
          : isPressed
            ? 'scale(0.95)'
            : 'scale(1)';

    return (
      <div
        key={k}
        data-alice-key={k}
        className="relative flex flex-col justify-between items-center rounded-xl border px-1.5 py-1.5"
        style={{
          width: 'clamp(46px, 5.2vw, 72px)',
          height: 'clamp(52px, 9.2vh, 78px)',
          filter: keyFilter,
          opacity: keyOpacity,
          backgroundColor: bgStyle,
          backgroundImage: bgImageStyle,
          borderColor: borderStyle,
          borderStyle: isWash && isHitWrong ? 'dashed' : 'solid',
          borderWidth: isWash && (isHitWrong || isHitCorrect) ? '1.5px' : '1px',
          transform: scaleTransform,
          boxShadow: glowShadow,
          transition: isWash
            ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease, filter 240ms ease, border-color 220ms ease, box-shadow 260ms ease'
            : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease, filter 140ms ease, border-color 120ms ease, box-shadow 140ms ease',
        }}
      >
        {isWash && (isHitCorrect || isHitWrong) && strikeFlash && (
          <>
            <span
              key={`aura_${strikeFlash.tick}`}
              aria-hidden="true"
              className="pointer-events-none absolute -inset-4 rounded-full blur-[6px] ink-aura-fade"
              style={{
                background: isHitWrong
                  ? 'radial-gradient(circle, rgba(20, 20, 18, 0.28) 0%, rgba(44, 44, 40, 0.12) 48%, transparent 76%)'
                  : 'radial-gradient(circle, rgba(20, 20, 18, 0.22) 0%, rgba(56, 56, 52, 0.09) 50%, transparent 78%)',
              }}
            />
            <span
              key={`ripple_${strikeFlash.tick}`}
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1.5 rounded-2xl border ink-bloom-ring"
              style={{
                borderColor: isHitWrong ? 'rgba(20, 20, 18, 0.52)' : 'rgba(20, 20, 18, 0.38)',
                borderStyle: isHitWrong ? 'dashed' : 'solid',
                background: isHitWrong
                  ? 'radial-gradient(circle, rgba(20, 20, 18, 0.20) 0%, transparent 72%)'
                  : 'radial-gradient(circle, rgba(20, 20, 18, 0.14) 0%, transparent 72%)',
              }}
            />
          </>
        )}
        <span
          className={`self-start font-mono-tabular text-[11px] font-bold leading-none ${
            isWash
              ? isHitCorrect || isHitWrong
                ? 'text-[#0E0E0D]'
                : isTabHint
                  ? 'text-[#1C1C1A]'
                  : isVowel
                    ? 'text-[#484844]'
                    : 'text-[#5A5A54]'
              : isHitCorrect
                ? 'text-[#A7F3D0]'
                : isHitWrong
                  ? 'text-[#FCA5A5]'
                  : isTabHint
                    ? 'text-[#FCE2A6]'
                    : isVowel
                      ? 'text-[#D89B3C]'
                      : 'text-[#89A5D1]'
          }`}
        >
          {k.toUpperCase()}
        </span>

        <span
          className={`font-display font-bold leading-none ${
            isVowel || isDisabled ? 'text-xs sm:text-sm' : 'text-lg sm:text-xl'
          } ${
            isWash
              ? isHitCorrect || isHitWrong || isTabHint
                ? 'text-[#0D0D0C]'
                : isVowel
                  ? 'text-[#3F3F3B]'
                  : 'text-[#222220]'
              : isHitCorrect || isHitWrong || isTabHint
                ? 'text-white'
                : isVowel
                  ? 'text-[#E3BC73]'
                  : 'text-[#A8C0E4]'
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

        <div className="w-full flex flex-col items-center gap-0.5">
          {isHome && (
            <span
              className={`block w-3.5 h-[2px] rounded-full ${
                isWash ? 'bg-[#4E4E4A]/65' : 'bg-[#D89B3C]/65'
              }`}
            />
          )}
          <div
            className={`w-full h-[2px] rounded-full overflow-hidden ${
              isWash ? 'bg-[#141413]/10' : 'bg-white/8'
            }`}
          >
            {masteryPct > 0 && !isDisabled && (
              <div
                className="h-full"
                style={{
                  width: `${masteryPct}%`,
                  backgroundColor:
                    masteryPct >= 70
                      ? isWash ? '#181817' : '#38A885'
                      : masteryPct >= 40
                        ? isWash ? '#60605B' : '#D89B3C'
                        : isWash ? '#9E9D96' : '#D9604C',
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const leftRowStagger = ['pr-0', 'pr-2 sm:pr-4', 'pr-4 sm:pr-7'];
  const rightRowStagger = ['pl-0', 'pl-2 sm:pl-4', 'pl-5 sm:pl-9'];

  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center overflow-hidden select-none px-3 sm:px-6"
      aria-hidden="true"
    >
      {/* Subtle reactive peripheral wing aura on hit */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: strikeFlash ? 1 : 0,
          background: strikeFlash
            ? isWash
              ? strikeFlash.correct
                ? isLeftStrike
                  ? 'radial-gradient(ellipse 40% 56% at 22% 50%, rgba(20, 20, 18, 0.14), rgba(20, 20, 18, 0.04) 44%, transparent 72%)'
                  : isRightStrike
                    ? 'radial-gradient(ellipse 40% 56% at 78% 50%, rgba(20, 20, 18, 0.14), rgba(20, 20, 18, 0.04) 44%, transparent 72%)'
                    : 'none'
                : isLeftStrike
                  ? 'radial-gradient(ellipse 40% 56% at 22% 50%, rgba(20, 20, 18, 0.19), rgba(20, 20, 18, 0.06) 44%, transparent 72%)'
                  : isRightStrike
                    ? 'radial-gradient(ellipse 40% 56% at 78% 50%, rgba(20, 20, 18, 0.19), rgba(20, 20, 18, 0.06) 44%, transparent 72%)'
                    : 'none'
              : strikeFlash.correct
                ? isLeftStrike
                  ? 'radial-gradient(circle at 22% 50%, rgba(52, 211, 153, 0.14), transparent 46%)'
                  : isRightStrike
                    ? 'radial-gradient(circle at 78% 50%, rgba(52, 211, 153, 0.14), transparent 46%)'
                    : 'none'
                : isLeftStrike
                  ? 'radial-gradient(circle at 22% 50%, rgba(240, 78, 62, 0.18), transparent 46%)'
                  : isRightStrike
                    ? 'radial-gradient(circle at 78% 50%, rgba(240, 78, 62, 0.18), transparent 46%)'
                    : 'none'
            : 'none',
        }}
      />

      {/* Alice Split Keyboard Geometry: Angled Left Wing + Open Central Sanctuary + Angled Right Wing */}
      <div className="relative w-full max-w-[1280px] flex items-center justify-center">
        {/* LEFT WING (Q-T / A-G / Z-B) angled ergonomically inward */}
        <div
          className="flex flex-col items-end gap-2 sm:gap-2.5 shrink-0"
          style={{
            transform: 'perspective(1100px) rotateX(6deg) rotateZ(7deg)',
            transformOrigin: 'right center',
          }}
        >
          {ALICE_LEFT_ROWS.map((row, rIdx) => (
            <div
              key={rIdx}
              className={`flex items-center justify-end gap-1.5 sm:gap-2 ${leftRowStagger[rIdx]}`}
            >
              {row.map(renderKeycap)}
            </div>
          ))}
        </div>

        {/* CENTRAL OPEN SANCTUARY — completely clear of keycaps so target glyph & Stroke Cloud have zero overlap! */}
        <div
          className="shrink-0"
          style={{ width: 'clamp(210px, 26vw, 370px)' }}
        />

        {/* RIGHT WING (Y-P / H-L / N-M) symmetrically angled inward */}
        <div
          className="flex flex-col items-start gap-2 sm:gap-2.5 shrink-0"
          style={{
            transform: 'perspective(1100px) rotateX(6deg) rotateZ(-7deg)',
            transformOrigin: 'left center',
          }}
        >
          {ALICE_RIGHT_ROWS.map((row, rIdx) => (
            <div
              key={rIdx}
              className={`flex items-center justify-start gap-1.5 sm:gap-2 ${rightRowStagger[rIdx]}`}
            >
              {row.map(renderKeycap)}
            </div>
          ))}
        </div>
      </div>

      {/* Subtle bottom status line showing reactive hit legend (pure monochrome ink in wash mode) */}
      <div className="absolute bottom-3.5 inset-x-0 flex items-center justify-center px-6">
        <div
          className={`flex items-center gap-2.5 text-xs ${
            isWash ? 'text-[#54544F]' : 'text-[#8995A8]'
          }`}
        >
          {strikeFlash ? (
            <span
              className={`font-medium ${
                strikeFlash.correct
                  ? isWash ? 'text-[#141413]' : 'text-[#5EEAD4]'
                  : isWash ? 'text-[#141413] underline decoration-dashed underline-offset-4' : 'text-[#F87171]'
              }`}
            >
              {strikeFlash.correct
                ? t(`擊鍵正確 · ${strikeFlash.key.toUpperCase()}`)
                : t(`擊鍵錯誤 · 誤按 ${strikeFlash.key.toUpperCase()}（請輸入正確鍵位）`)}
            </span>
          ) : (
            <>
              <span>{t('Alice 分離鍵盤')}</span>
              <span aria-hidden="true" className={isWash ? 'text-[#8C8B84]' : 'text-[#495366]'}>·</span>
              <span
                className={`inline-flex items-center gap-1 ${
                  isWash ? 'text-[#1C1C1A]' : 'text-[#7CD6B4]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isWash ? 'bg-[#181817]' : 'bg-[#34D399]'
                  }`}
                />
                {t(isWash ? '正確濃墨' : '正確翠綠')}
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  isWash ? 'text-[#4C4C48]' : 'text-[#F0887C]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isWash ? 'border border-dashed border-[#181817] bg-transparent' : 'bg-[#F04E3E]'
                  }`}
                />
                {t(isWash ? '誤擊碎墨' : '錯誤硃砂')}
              </span>
              <span
                aria-hidden="true"
                className={`hidden sm:inline ${isWash ? 'text-[#8C8B84]' : 'text-[#495366]'}`}
              >
                ·
              </span>
              <span className={`hidden sm:inline ${isWash ? 'text-[#686862]' : 'text-[#7D889B]'}`}>
                {t('按 Tab 緊急拉焦提示')}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
