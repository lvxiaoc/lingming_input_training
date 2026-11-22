import React, { useState } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import {
  BUILTIN_SCHEMES,
  CustomSchemeDraft,
  DEFAULT_CUSTOM_DRAFT,
  KEYBOARD_ROWS,
  parseCustomScheme,
  ShapeCodeScheme,
} from '../data/schemes';
import { useUiText } from '../data/uiScript';

interface SchemeEditorModalProps {
  open: boolean;
  activeScheme: ShapeCodeScheme;
  customDraft: CustomSchemeDraft;
  onClose: () => void;
  onSelectBuiltin: (schemeId: string) => void;
  onApplyCustom: (draft: CustomSchemeDraft, parsed: ShapeCodeScheme) => void;
}

export const SchemeEditorModal: React.FC<SchemeEditorModalProps> = ({
  open,
  activeScheme,
  customDraft,
  onClose,
  onSelectBuiltin,
  onApplyCustom,
}) => {
  const t = useUiText();
  const [tab, setTab] = useState<'presets' | 'custom' | 'chart'>(
    activeScheme.id === 'custom' ? 'custom' : 'presets'
  );
  const [draft, setDraft] = useState<CustomSchemeDraft>(customDraft);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSaveCustom = () => {
    const result = parseCustomScheme(draft);
    if (result.error || !result.scheme) {
      setErrorMsg(t(result.error || '格式解析失敗，請檢查碼表格式。'));
      return;
    }
    setErrorMsg(null);
    onApplyCustom(draft, result.scheme);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('形碼方案與自定義碼表設定')}
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#151A24] border border-[#F2EEE6]/12 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#F2EEE6]/8">
          <div>
            <h2 className="font-display text-xl font-bold text-[#F5F1E8]">
              {t('形碼方案與字根碼表')}
            </h2>
            <p className="text-xs text-[#949DAD] mt-0.5">
              {t('切換內建形碼方案，或直接貼上你設計的專屬形碼鍵位與字詞編碼表')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('關閉')}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[#949DAD] hover:text-[#F5F1E8] hover:bg-[#F2EEE6]/8 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean segmented tabs */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 bg-[#0E1218] rounded-lg border border-[#F2EEE6]/8">
            <button
              type="button"
              onClick={() => setTab('presets')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'presets'
                  ? 'bg-[#212836] text-[#F5F1E8]'
                  : 'text-[#8F98A8] hover:text-[#F5F1E8]'
              }`}
            >
              {t('內建形碼方案')}
            </button>
            <button
              type="button"
              onClick={() => setTab('custom')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'custom'
                  ? 'bg-[#212836] text-[#F5F1E8]'
                  : 'text-[#8F98A8] hover:text-[#F5F1E8]'
              }`}
            >
              {t('匯入我的自定義形碼')}
            </button>
            <button
              type="button"
              onClick={() => setTab('chart')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'chart'
                  ? 'bg-[#212836] text-[#F5F1E8]'
                  : 'text-[#8F98A8] hover:text-[#F5F1E8]'
              }`}
            >
              {t('目前鍵位字根總覽')}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'presets' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BUILTIN_SCHEMES.map((sc) => {
                const selected = activeScheme.id === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      onSelectBuiltin(sc.id);
                      onClose();
                    }}
                    className={`text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#1D2432] border-[#D89B3C]'
                        : 'bg-[#12161E] border-[#F2EEE6]/10 hover:border-[#F2EEE6]/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-bold text-[#F5F1E8]">
                        {t(sc.name)}
                      </span>
                      {selected && <Check className="w-4 h-4 text-[#D89B3C] shrink-0" />}
                    </div>
                    <p className="text-xs text-[#9BA3B2] leading-relaxed mt-2">
                      {t(sc.description)}
                    </p>
                    <div className="mt-3 pt-3 border-t border-[#F2EEE6]/8 flex items-center gap-2 text-xs text-[#7D8696] font-mono-tabular">
                      <span>{sc.entries.length} {t('個訓練條目')}</span>
                      <span aria-hidden="true">·</span>
                      <span>{sc.zones.length} {t('個分區')}</span>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setTab('custom')}
                className="sm:col-span-2 text-left p-5 rounded-xl border border-dashed border-[#D89B3C]/45 bg-[#12161E] hover:bg-[#191F2B] transition-colors cursor-pointer"
              >
                <div className="font-display text-base font-bold text-[#E8C480]">
                  {t('有自己設計的形碼輸入法？點擊匯入專屬字根與碼表')}
                </div>
                <p className="text-xs text-[#9BA3B2] mt-1.5 leading-relaxed">
                  {t('支援貼上自定義的 A–Z 字根鍵位對應與「漢字 編碼 拆解」詞庫，套用後會自動套用漸隱鷹架、連擊落字與弱鍵記憶曲線演算法。')}
                </p>
              </button>
            </div>
          )}

          {tab === 'custom' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-[#C8C3B8] mb-1.5">
                  {t('方案名稱')}
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0E1218] border border-[#F2EEE6]/12 rounded-lg text-[#F5F1E8] focus:outline-none focus:border-[#D89B3C]"
                  placeholder={t('例如：我的四碼形碼方案')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#C8C3B8] mb-1">
                    {t('鍵位字根對應（每行格式：鍵位:主字根:分區名）')}
                  </label>
                  <textarea
                    rows={10}
                    value={draft.keyMapText}
                    onChange={(e) => setDraft({ ...draft, keyMapText: e.target.value })}
                    className="w-full p-3 text-xs font-mono-tabular bg-[#0E1218] border border-[#F2EEE6]/12 rounded-lg text-[#E5E0D5] leading-relaxed focus:outline-none focus:border-[#D89B3C]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#C8C3B8] mb-1">
                    {t('訓練碼表（每行格式：漢字 編碼 拆解部件）')}
                  </label>
                  <textarea
                    rows={10}
                    value={draft.entriesText}
                    onChange={(e) => setDraft({ ...draft, entriesText: e.target.value })}
                    className="w-full p-3 text-xs font-mono-tabular bg-[#0E1218] border border-[#F2EEE6]/12 rounded-lg text-[#E5E0D5] leading-relaxed focus:outline-none focus:border-[#D89B3C]"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-[#E86F5E] font-medium">{errorMsg}</p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(DEFAULT_CUSTOM_DRAFT);
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#9BA3B2] hover:text-[#F5F1E8] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('恢復範例模板')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="px-5 py-2.5 text-sm font-semibold bg-[#D94A38] hover:bg-[#E25644] text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  {t('套用此形碼方案並開始練習')}
                </button>
              </div>
            </div>
          )}

          {tab === 'chart' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#9BA3B2]">
                {activeScheme.zones.map((z) => (
                  <span key={z.id} className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: z.color }}
                    />
                    <span>{t(z.label)}</span>
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                {KEYBOARD_ROWS.flat().map((k) => {
                  const def = activeScheme.keyMap[k];
                  const zone = def
                    ? activeScheme.zones.find((z) => z.id === def.zoneId)
                    : null;
                  return (
                    <div
                      key={k}
                      className="p-2.5 rounded-lg bg-[#10141C] border border-[#F2EEE6]/8 flex items-center gap-2.5"
                    >
                      <span
                        className="font-mono-tabular text-xs font-bold w-6 h-6 rounded flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: zone?.bgTint || 'rgba(255,255,255,0.06)',
                          color: zone?.color || '#D89B3C',
                        }}
                      >
                        {k.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold text-[#F5F1E8] leading-tight">
                          {def?.primary || '-'}
                        </div>
                        {def?.sub && (
                          <div className="text-[11px] text-[#8A93A3] truncate">
                            {def.sub}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
