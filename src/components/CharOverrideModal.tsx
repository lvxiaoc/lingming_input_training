import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  CloudUpload,
  Copy,
  Download,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { HuangtingCharInfo } from '../data/huangtingjing';
import {
  generateOverridesTsPatch,
  HuangtingCharOverride,
  HuangtingOverrideMap,
  sanitizeOverrideMap,
} from '../data/huangtingOverrides';
import { ThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';
import { ColorSplitGlyph, getRootColor, RadicalSymbol } from './ColorSplitGlyph';
import { auth, signInWithGoogle, submitCorrectionReport } from '../firebase';

interface CharOverrideModalProps {
  char: string;
  /** Default info (base + built-in repo overrides, without user override) */
  defaultInfo: HuangtingCharInfo;
  /** Currently effective info (including any existing user override) */
  effectiveInfo: HuangtingCharInfo;
  hasUserOverride: boolean;
  allUserOverrides: HuangtingOverrideMap;
  themeMode: ThemeMode;
  onSave: (char: string, override: HuangtingCharOverride) => void;
  onResetChar: (char: string) => void;
  onImportOverrides: (merged: HuangtingOverrideMap) => void;
  onClose: () => void;
}

interface RootRow {
  root: string;
  code: string;
}

export const CharOverrideModal: React.FC<CharOverrideModalProps> = ({
  char,
  defaultInfo,
  effectiveInfo,
  hasUserOverride,
  allUserOverrides,
  themeMode,
  onSave,
  onResetChar,
  onImportOverrides,
  onClose,
}) => {
  const t = useUiText();
  const isWash = themeMode === 'wash';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [code, setCode] = useState(effectiveInfo.code);
  const [shortCode, setShortCode] = useState(effectiveInfo.shortCode ?? '');
  const [rootRows, setRootRows] = useState<RootRow[]>(() => {
    const count = Math.max(effectiveInfo.roots.length, effectiveInfo.rootCodes.length, 1);
    return Array.from({ length: count }, (_, i) => ({
      root: effectiveInfo.roots[i] ?? '',
      code: effectiveInfo.rootCodes[i] ?? '',
    }));
  });
  const [strokeRootIndices, setStrokeRootIndices] = useState<number[]>(() => {
    const len = effectiveInfo.strokes?.length ?? 0;
    if (len === 0) return [];
    if (effectiveInfo.strokeRootIndices && effectiveInfo.strokeRootIndices.length === len) {
      return [...effectiveInfo.strokeRootIndices];
    }
    return Array.from({ length: len }, () => 0);
  });

  // Active brush index: 0..rootRows.length-1, or -1 for omitted/neutral stroke
  const [activeBrush, setActiveBrush] = useState<number>(0);
  const [hoveredStrokeIdx, setHoveredStrokeIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cloudSubmitting, setCloudSubmitting] = useState(false);

  const hasStrokes = Boolean(effectiveInfo.strokes && effectiveInfo.strokes.length > 0);
  const totalUserCount = Object.keys(allUserOverrides).length;

  const flashFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 2200);
  };

  const handlePaintStroke = (strokeIdx: number) => {
    synth.playClick();
    setStrokeRootIndices((prev) => {
      const next = [...prev];
      next[strokeIdx] = activeBrush;
      return next;
    });
  };

  const handleCycleStroke = (strokeIdx: number) => {
    synth.playClick();
    setStrokeRootIndices((prev) => {
      const next = [...prev];
      const cur = next[strokeIdx] ?? 0;
      next[strokeIdx] = cur < 0 ? 0 : cur + 1 >= rootRows.length ? -1 : cur + 1;
      return next;
    });
  };

  const handleRedistributeStrokes = () => {
    const strokeCount = effectiveInfo.strokes?.length ?? 0;
    if (strokeCount === 0) return;
    synth.playClick();
    const rCount = Math.max(1, rootRows.length);
    const next = Array.from({ length: strokeCount }, (_, i) =>
      Math.min(rCount - 1, Math.floor((i * rCount) / strokeCount))
    );
    setStrokeRootIndices(next);
  };

  const handleAddRoot = () => {
    if (rootRows.length >= 5) return;
    synth.playClick();
    setRootRows((prev) => [...prev, { root: '', code: '' }]);
    setActiveBrush(rootRows.length);
  };

  const handleRemoveRoot = (idx: number) => {
    if (rootRows.length <= 1) return;
    synth.playClick();
    setRootRows((prev) => prev.filter((_, i) => i !== idx));
    setStrokeRootIndices((prev) =>
      prev.map((r) => (r === idx ? -1 : r > idx ? r - 1 : r))
    );
    setActiveBrush((b) => (b === idx ? 0 : b > idx ? b - 1 : b));
  };

  const handleResetToDefault = () => {
    synth.playClick();
    setCode(defaultInfo.code);
    setShortCode(defaultInfo.shortCode ?? '');
    const count = Math.max(defaultInfo.roots.length, defaultInfo.rootCodes.length, 1);
    setRootRows(
      Array.from({ length: count }, (_, i) => ({
        root: defaultInfo.roots[i] ?? '',
        code: defaultInfo.rootCodes[i] ?? '',
      }))
    );
    setStrokeRootIndices(
      defaultInfo.strokeRootIndices ? [...defaultInfo.strokeRootIndices] : []
    );
    if (hasUserOverride) {
      onResetChar(char);
      flashFeedback(t('已還原預設拆字'));
    }
  };

  const buildCurrentOverride = (): HuangtingCharOverride | null => {
    const cleanCode = code.trim().toLowerCase();
    if (!/^[a-z]{1,6}$/.test(cleanCode)) {
      setErrorMsg(t('全碼須為 1–6 位英文字母'));
      return null;
    }
    const cleanShort = shortCode.trim().toLowerCase();
    if (cleanShort && !/^[a-z]{1,4}$/.test(cleanShort)) {
      setErrorMsg(t('簡碼須為 1–4 位英文字母或留空'));
      return null;
    }
    const cleanRoots = rootRows.map((r) => r.root.trim()).filter(Boolean);
    if (cleanRoots.length === 0) {
      setErrorMsg(t('請至少保留 1 個拆解字根'));
      return null;
    }
    const cleanRootCodes = rootRows
      .filter((r) => r.root.trim().length > 0)
      .map((r) => r.code.trim().toLowerCase());

    setErrorMsg(null);
    const out: HuangtingCharOverride = {
      code: cleanCode,
      shortCode: cleanShort,
      roots: cleanRoots,
      rootCodes: cleanRootCodes,
      updatedAt: Date.now(),
    };
    if (hasStrokes && strokeRootIndices.length === effectiveInfo.strokes!.length) {
      // Clamp any stroke index exceeding new root count to -1
      out.strokeRootIndices = strokeRootIndices.map((idx) =>
        idx >= cleanRoots.length ? -1 : idx
      );
    }
    return out;
  };

  const handleSave = () => {
    const override = buildCurrentOverride();
    if (!override) return;
    synth.playKeyHit(2, true);
    onSave(char, override);
    onClose();
  };

  const handleReportToCloud = async () => {
    const override = buildCurrentOverride();
    if (!override) return;
    setErrorMsg(null);
    setCloudSubmitting(true);
    try {
      if (!auth.currentUser) {
        await signInWithGoogle();
      }
      const codeChanged = override.code !== defaultInfo.code;
      const rootsChanged =
        (override.roots || []).join(' ') !== defaultInfo.roots.join(' ');
      const issueType = codeChanged
        ? 'code_error'
        : rootsChanged
          ? 'radical_split'
          : 'stroke_color';
      const indicesStr = override.strokeRootIndices
        ? override.strokeRootIndices.join(',')
        : '';
      await submitCorrectionReport({
        char,
        issueType,
        currentCode: defaultInfo.code,
        suggestedCode: override.code || defaultInfo.code,
        currentRoots: defaultInfo.roots.join(' '),
        suggestedRoots: (override.roots || defaultInfo.roots).join(' '),
        suggestedStrokeIndices: indicesStr,
        description: `來自黃庭抄經閣逐筆校訂：碼 ${defaultInfo.code} → ${override.code || defaultInfo.code}；根 ${(override.roots || defaultInfo.roots).join(' ')}`,
        source: 'huangting',
      });
      synth.playKeyHit(2, true);
      onSave(char, override);
      flashFeedback(t('已儲存並上報至雲端糾錯庫'));
    } catch {
      setErrorMsg(t('雲端上報未完成，請確認已登入 Google 帳號'));
    } finally {
      setCloudSubmitting(false);
    }
  };

  // Export all overrides (including unsaved edit for current char if valid)
  const effectiveMapForExport = useMemo<HuangtingOverrideMap>(() => {
    return allUserOverrides;
  }, [allUserOverrides]);

  const handleExportJson = () => {
    synth.playClick();
    const json = JSON.stringify(effectiveMapForExport, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'huangting-overrides.json';
    a.click();
    URL.revokeObjectURL(url);
    flashFeedback(t('已匯出校訂 JSON'));
  };

  const handleCopyTsPatch = async () => {
    synth.playClick();
    const patch = generateOverridesTsPatch(effectiveMapForExport);
    try {
      await navigator.clipboard.writeText(patch);
      flashFeedback(t('已複製程式碼補丁'));
    } catch {
      flashFeedback(t('請先匯出 JSON 備份'));
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          setErrorMsg(t('JSON 格式無效'));
          return;
        }
        const sanitized = sanitizeOverrideMap(parsed as Record<string, unknown>);
        const count = Object.keys(sanitized).length;
        if (count === 0) {
          setErrorMsg(t('檔案中無有效校訂項目'));
          return;
        }
        const merged: HuangtingOverrideMap = { ...allUserOverrides, ...sanitized };
        onImportOverrides(merged);
        setErrorMsg(null);
        flashFeedback(`${t('已匯入')} ${count} ${t('字校訂')}`);
      } catch {
        setErrorMsg(t('讀取 JSON 失敗'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${t('拆字與筆畫校訂')} ${char}`}
        className={`w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl flex flex-col ${
          isWash
            ? 'bg-[#F6F4EE] border-[#141413]/18 text-[#141413]'
            : 'bg-[#121824] border-[#F2EEE6]/14 text-[#F2EEE6]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--dojo-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-display text-2xl font-bold text-[var(--dojo-ochre)] leading-none">
              {char}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--dojo-text-bright)]">
                {t('拆字與筆畫校訂')}
              </h2>
              <p className="text-[11px] text-[var(--dojo-text-muted)]">
                {t('點選左側筆畫可直接重塗所屬字根顏色；儲存後永久生效於本機，亦可匯出備份或補丁')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onClose();
            }}
            aria-label={t('關閉')}
            className="p-1.5 rounded-lg border border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: 2-column visual painter + code/roots form */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6">
          {/* Left: Interactive Stroke Painter */}
          <div className="flex flex-col items-center gap-3">
            <ColorSplitGlyph
              char={char}
              strokes={effectiveInfo.strokes}
              strokeRootIndices={strokeRootIndices}
              themeMode={themeMode}
              colorMix={1}
              sizeClass="w-52 h-52 sm:w-60 sm:h-60"
              onStrokeClick={hasStrokes ? handlePaintStroke : undefined}
              onStrokeContextMenu={hasStrokes ? handleCycleStroke : undefined}
              hoveredStrokeIdx={hoveredStrokeIdx}
              onStrokeHover={hasStrokes ? setHoveredStrokeIdx : undefined}
            />

            {hasStrokes ? (
              <>
                {/* Brush Selector */}
                <div className="w-full">
                  <div className="flex items-center justify-between text-[11px] text-[var(--dojo-text-muted)] mb-1.5">
                    <span>{t('1. 選畫筆左鍵重塗（右鍵循環切色）')}</span>
                    <button
                      type="button"
                      onClick={handleRedistributeStrokes}
                      className="text-[var(--dojo-ochre)] hover:underline cursor-pointer"
                    >
                      {t('均分筆畫')}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rootRows.map((row, rIdx) => {
                      const col = getRootColor(rIdx, themeMode, 1);
                      const selected = activeBrush === rIdx;
                      return (
                        <button
                          key={rIdx}
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setActiveBrush(rIdx);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            selected ? 'ring-2 ring-offset-1 ring-[var(--dojo-ochre)] font-bold' : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{
                            borderColor: col,
                            backgroundColor: selected
                              ? isWash
                                ? '#FFFFFF'
                                : 'rgba(255,255,255,0.08)'
                              : 'transparent',
                            color: col,
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: col }}
                          />
                          <RadicalSymbol glyph={row.root || `#${rIdx + 1}`} className="font-display text-sm leading-none" />
                          <span className="font-mono-tabular text-[10px] uppercase opacity-80">
                            {row.code || `R${rIdx + 1}`}
                          </span>
                        </button>
                      );
                    })}

                    {/* Omitted / Neutral Ink Brush (-1) */}
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setActiveBrush(-1);
                      }}
                      title={t('標記為不取碼之中間省略筆畫（柔和灰墨色）')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
                        activeBrush === -1
                          ? 'ring-2 ring-offset-1 ring-[var(--dojo-ochre)] font-bold border-[var(--dojo-text-sub)]'
                          : 'border-[var(--dojo-border-strong)] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: getRootColor(-1, themeMode, 1) }}
                      />
                      <span>{t('略墨')}</span>
                    </button>
                  </div>
                </div>

                {/* Clickable Numbered Stroke Chips (great for overlapping strokes!) */}
                <div className="w-full">
                  <div className="text-[11px] text-[var(--dojo-text-muted)] mb-1.5">
                    {t('2. 或依筆順點選單筆編號')}（{t('共')} {effectiveInfo.strokes!.length} {t('筆')}）
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {strokeRootIndices.map((rIdx, sIdx) => {
                      const col = getRootColor(rIdx, themeMode, 1);
                      const isHov = hoveredStrokeIdx === sIdx;
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handlePaintStroke(sIdx)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            handleCycleStroke(sIdx);
                          }}
                          onMouseEnter={() => setHoveredStrokeIdx(sIdx)}
                          onMouseLeave={() => setHoveredStrokeIdx(null)}
                          className={`w-6 h-6 rounded-md text-[11px] font-mono-tabular font-bold border transition-transform cursor-pointer ${
                            isHov ? 'scale-110 ring-1 ring-[var(--dojo-text-bright)]' : ''
                          }`}
                          style={{
                            borderColor: col,
                            color: col,
                            backgroundColor: isWash
                              ? 'rgba(255,255,255,0.85)'
                              : 'rgba(255,255,255,0.04)',
                          }}
                          title={`${t('第')} ${sIdx + 1} ${t('筆')}`}
                        >
                          {sIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--dojo-text-muted)] text-center">
                {t('此生僻字暫無矢量筆畫資料，可直接校訂下方編碼與字根拆解')}
              </p>
            )}
          </div>

          {/* Right: Code & Radical Decomposition Fields */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--dojo-text-sub)]">
                  {t('靈明全碼')}
                </span>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 6))}
                  placeholder="dymq"
                  className="px-3 py-2 rounded-lg border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface-inset)] font-mono-tabular text-sm font-bold uppercase tracking-wider text-[var(--dojo-text-bright)] focus:outline-none focus:border-[var(--dojo-ochre)]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--dojo-text-sub)]">
                  {t('直出簡碼（選填）')}
                </span>
                <input
                  type="text"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 4))}
                  placeholder={t('留空則無簡碼')}
                  className="px-3 py-2 rounded-lg border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface-inset)] font-mono-tabular text-sm font-bold uppercase tracking-wider text-[var(--dojo-ochre)] focus:outline-none focus:border-[var(--dojo-ochre)]"
                />
              </label>
            </div>

            {/* Radical Decomposition Rows */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--dojo-text-sub)]">
                  {t('拆解字根與各根鍵碼')}
                </span>
                {rootRows.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddRoot}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dojo-ochre)] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('新增字根')}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {rootRows.map((row, idx) => {
                  const col = getRootColor(idx, themeMode, 1);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]/70"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveBrush(idx)}
                        title={t('設為當前畫筆')}
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 cursor-pointer border"
                        style={{
                          borderColor: col,
                          color: col,
                          backgroundColor: activeBrush === idx ? col : 'transparent',
                        }}
                      >
                        <span
                          className="text-[11px] font-mono-tabular font-bold"
                          style={{
                            color: activeBrush === idx ? (isWash ? '#FFFFFF' : '#0B0F17') : col,
                          }}
                        >
                          {idx + 1}
                        </span>
                      </button>

                      {/* Live PUA / Radical Preview */}
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center shrink-0 font-display text-lg font-bold"
                        style={{ color: col }}
                      >
                        <RadicalSymbol glyph={row.root || '·'} />
                      </div>

                      <input
                        type="text"
                        value={row.root}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRootRows((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, root: v } : item))
                          );
                        }}
                        placeholder={t('字根')}
                        className="w-20 px-2 py-1 rounded border border-[var(--dojo-border)] bg-[var(--dojo-surface)] text-sm font-display text-[var(--dojo-text-bright)] focus:outline-none focus:border-[var(--dojo-ochre)]"
                      />

                      <input
                        type="text"
                        value={row.code}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 4);
                          setRootRows((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, code: v } : item))
                          );
                        }}
                        placeholder={t('根碼')}
                        className="flex-1 min-w-0 px-2 py-1 rounded border border-[var(--dojo-border)] bg-[var(--dojo-surface)] font-mono-tabular text-xs uppercase text-[var(--dojo-text-bright)] focus:outline-none focus:border-[var(--dojo-ochre)]"
                      />

                      <button
                        type="button"
                        disabled={rootRows.length <= 1}
                        onClick={() => handleRemoveRoot(idx)}
                        aria-label={t('刪除此字根')}
                        className="p-1 text-[var(--dojo-text-muted)] hover:text-[var(--dojo-crimson-text)] disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Persistence Guidance Box */}
            <div className="rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)]/60 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--dojo-text-sub)] space-y-1">
              <div className="font-semibold text-[var(--dojo-text-bright)]">
                {t('如何持久化保存你的校訂？')}
              </div>
              <p>
                {t(
                  '① 點「儲存校訂」即時寫入本機瀏覽器；② 點「上報雲端」可同步寫入 Firebase 糾錯報告，供日後統一修正碼表；③ 亦可匯出 JSON 備份或複製補丁。'
                )}
              </p>
            </div>

            {errorMsg && (
              <div className="text-xs font-medium text-[var(--dojo-crimson-text)]">
                {errorMsg}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Export/Import/Patch + Save/Cancel */}
        <div className="px-5 py-3.5 border-t border-[var(--dojo-border)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
              {t('已校訂')} {totalUserCount} {t('字')}
            </span>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={totalUserCount === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('匯出 JSON')}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t('匯入 JSON')}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={handleCopyTsPatch}
              disabled={totalUserCount === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{t('複製補丁')}</span>
            </button>
            {feedback && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dojo-pine-text)]">
                <Check className="w-3.5 h-3.5" />
                <span>{feedback}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--dojo-border)] text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('還原此字')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--dojo-border)] text-xs text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
            >
              {t('取消')}
            </button>
            <button
              type="button"
              disabled={cloudSubmitting}
              onClick={handleReportToCloud}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--dojo-ochre)]/45 bg-[var(--dojo-ochre)]/12 hover:bg-[var(--dojo-ochre)]/22 text-[var(--dojo-ochre)] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{t(cloudSubmitting ? '上報中…' : '上報雲端')}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--dojo-pine)] hover:opacity-90 text-white text-xs font-semibold transition-opacity cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('儲存校訂')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
