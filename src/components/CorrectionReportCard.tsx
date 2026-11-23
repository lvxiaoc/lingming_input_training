import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Download,
  FileWarning,
  LogIn,
  LogOut,
  Send,
  Trash2,
} from 'lucide-react';
import { HUANGTING_CHAR_MAP } from '../data/huangtingjing';
import { BUILTIN_SCHEMES } from '../data/schemes';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { synth } from '../audio/synth';
import {
  CorrectionIssueType,
  CorrectionReportRecord,
  CorrectionReportStatus,
  deleteCorrectionReport,
  isFirebaseAdminUser,
  signInWithGoogle,
  signOutFirebase,
  submitCorrectionReport,
  subscribeAuthState,
  subscribeCorrectionReports,
  updateCorrectionReportStatus,
} from '../firebase';
import { RadicalSymbol } from './ColorSplitGlyph';

const ISSUE_TYPE_OPTIONS: Array<{ id: CorrectionIssueType; label: string }> = [
  { id: 'stroke_color', label: '筆畫上色錯誤' },
  { id: 'radical_split', label: '字根拆解錯誤' },
  { id: 'code_error', label: '全碼編碼錯誤' },
  { id: 'short_code', label: '簡碼缺失/錯誤' },
  { id: 'other', label: '其他碼表問題' },
];

const STATUS_LABELS: Record<CorrectionReportStatus, string> = {
  open: '待審',
  reviewed: '已閱',
  resolved: '已修',
};

interface LookedUpChar {
  code: string;
  shortCode?: string;
  roots: string[];
  sourceLabel: string;
}

function lookupCharInTables(ch: string): LookedUpChar | null {
  const clean = ch.trim();
  if (!clean) return null;

  const ht = HUANGTING_CHAR_MAP[clean];
  if (ht) {
    return {
      code: ht.code,
      shortCode: ht.shortCode,
      roots: ht.roots,
      sourceLabel: '黃庭碼表',
    };
  }

  const lingming = BUILTIN_SCHEMES[0];
  const entry = lingming.entries.find((e) => e.char === clean);
  if (entry) {
    return {
      code: entry.code,
      roots: entry.parts,
      sourceLabel: '道場字庫',
    };
  }

  return null;
}

export const CorrectionReportCard: React.FC = () => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const [reports, setReports] = useState<CorrectionReportRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showAllList, setShowAllList] = useState(false);

  // Form state
  const [targetChar, setTargetChar] = useState('');
  const [issueType, setIssueType] = useState<CorrectionIssueType>('radical_split');
  const [suggestedCode, setSuggestedCode] = useState('');
  const [suggestedRoots, setSuggestedRoots] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin = useMemo(() => isFirebaseAdminUser(user), [user]);

  useEffect(() => {
    const unsub = subscribeAuthState((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setReports((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const unsub = subscribeCorrectionReports(
      user,
      (items) => {
        setReports(items);
        setErrorMsg(null);
      },
      () => {
        setErrorMsg('讀取雲端報告失敗，請重新登入後再試');
      }
    );
    return () => unsub();
  }, [user]);

  const firstChar = useMemo(() => {
    const trimmed = targetChar.trim();
    if (!trimmed) return '';
    return Array.from(trimmed)[0] ?? '';
  }, [targetChar]);

  const lookedUp = useMemo(() => lookupCharInTables(firstChar), [firstChar]);

  const flashFeedback = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const handleSignIn = async () => {
    synth.playClick();
    setAuthBusy(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorMsg(t('登入未完成，請允許彈窗後重試'));
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    synth.playClick();
    try {
      await signOutFirebase();
    } catch {
      // Ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstChar) {
      setErrorMsg(t('請輸入欲糾錯的單字'));
      return;
    }
    if (!description.trim()) {
      setErrorMsg(t('請簡述拆字或編碼錯誤處'));
      return;
    }

    let activeUser = user;
    if (!activeUser) {
      setAuthBusy(true);
      try {
        activeUser = await signInWithGoogle();
      } catch {
        setErrorMsg(t('請先登入 Google 帳號以提交至雲端'));
        setAuthBusy(false);
        return;
      }
      setAuthBusy(false);
    }

    setSubmitting(true);
    try {
      await submitCorrectionReport({
        char: firstChar,
        issueType,
        currentCode: lookedUp?.code ?? '',
        suggestedCode: suggestedCode.trim().toLowerCase(),
        currentRoots: lookedUp ? lookedUp.roots.join(' ') : '',
        suggestedRoots: suggestedRoots.trim(),
        suggestedStrokeIndices: '',
        description: description.trim(),
        source: 'home',
      });
      synth.playKeyHit(2, true);
      setTargetChar('');
      setSuggestedCode('');
      setSuggestedRoots('');
      setDescription('');
      flashFeedback(t('已同步提交至雲端，感謝校訂'));
    } catch {
      setErrorMsg(t('提交失敗，請檢查內容長度或連線狀態'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCycleStatus = async (report: CorrectionReportRecord) => {
    if (!isAdmin) return;
    synth.playClick();
    const next: CorrectionReportStatus =
      report.status === 'open'
        ? 'reviewed'
        : report.status === 'reviewed'
          ? 'resolved'
          : 'open';
    try {
      await updateCorrectionReportStatus(report.id, next);
    } catch {
      setErrorMsg(t('更新狀態失敗'));
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    synth.playClick();
    try {
      await deleteCorrectionReport(reportId);
      flashFeedback(t('已撤回此筆報告'));
    } catch {
      setErrorMsg(t('撤回失敗'));
    }
  };

  const handleExportReportsJson = () => {
    synth.playClick();
    const json = JSON.stringify(reports, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lingming-correction-reports-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashFeedback(t('已匯出報告 JSON'));
  };

  const visibleReports = showAllList ? reports : reports.slice(0, 2);

  return (
    <section
      aria-label={t('數據糾錯報告')}
      className={`w-full lg:w-[318px] xl:w-[332px] shrink-0 rounded-xl border px-4 py-3 backdrop-blur-sm wash-enter-soft ${
        isWash
          ? 'bg-[#F9F8F5]/90 border-[#141413]/15 text-[#141413] shadow-xs'
          : 'bg-[#121824]/88 border-[#F2EEE6]/12 text-[#F2EEE6] shadow-lg'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            synth.playClick();
            setExpanded((v) => !v);
          }}
          className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer group"
        >
          <FileWarning
            className={`w-3.5 h-3.5 shrink-0 ${
              isWash ? 'text-[#A86716]' : 'text-[#D89B3C]'
            }`}
          />
          <h2 className="text-sm font-semibold tracking-wide whitespace-nowrap group-hover:opacity-85">
            {t('數據糾錯報告')}
          </h2>
          {reports.length > 0 && (
            <span
              className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded ${
                isWash
                  ? 'bg-[#141413]/8 text-[#4A4A44]'
                  : 'bg-[#F2EEE6]/10 text-[#C2C9D6]'
              }`}
            >
              {reports.length}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {authReady && !user && (
            <button
              type="button"
              disabled={authBusy}
              onClick={handleSignIn}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 ${
                isWash
                  ? 'bg-[#FFFFFF] hover:bg-[#181817] hover:text-[#F8F7F3] border-[#141413]/16 text-[#181817]'
                  : 'bg-[#192233] hover:bg-[#232F46] border-[#F2EEE6]/14 text-[#E6E1D8]'
              }`}
            >
              <LogIn className="w-3 h-3" />
              <span>{t(authBusy ? '登入中…' : '登入雲端')}</span>
            </button>
          )}

          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              title={`${user.displayName || t('已登入')} · ${t('點擊登出')}`}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-colors whitespace-nowrap cursor-pointer ${
                isWash
                  ? 'border-[#141413]/12 text-[#54544E] hover:text-[#141413]'
                  : 'border-[#F2EEE6]/12 text-[#9BA5B6] hover:text-[#F2EEE6]'
              }`}
            >
              <Cloud className="w-3 h-3 text-[var(--dojo-pine)]" />
              <span className="max-w-[64px] truncate">{user.displayName || t('已同步')}</span>
              <LogOut className="w-2.5 h-2.5 opacity-70" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setExpanded((v) => !v);
            }}
            aria-label={t(expanded ? '收合糾錯表單' : '展開糾錯表單')}
            className={`p-1 rounded-md border transition-colors cursor-pointer ${
              isWash
                ? 'border-[#141413]/12 text-[#54544E] hover:text-[#141413]'
                : 'border-[#F2EEE6]/12 text-[#9BA5B6] hover:text-[#F2EEE6]'
            }`}
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Compact Prompt Bar when collapsed */}
      {!expanded && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p
            className={`text-[11px] leading-snug ${
              isWash ? 'text-[#5C5C56]' : 'text-[#97A2B5]'
            }`}
          >
            {t('發現碼表拆字或筆畫上色有誤？上報至雲端供後續同步修正。')}
          </p>
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setExpanded(true);
            }}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              isWash
                ? 'bg-[#181817] hover:bg-[#2C2C29] text-[#F8F7F3]'
                : 'bg-[#D89B3C]/20 hover:bg-[#D89B3C]/30 border border-[#D89B3C]/35 text-[#F0C878]'
            }`}
          >
            {t('提交糾錯')}
          </button>
        </div>
      )}

      {/* Expanded Submission Form & Live Cloud Report List */}
      {expanded && (
        <div className="mt-2.5 space-y-2.5">
          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Row 1: Character + Issue Type */}
            <div className="grid grid-cols-[64px_1fr] gap-2">
              <input
                type="text"
                value={targetChar}
                onChange={(e) => setTargetChar(e.target.value.slice(0, 4))}
                placeholder={t('錯字')}
                aria-label={t('錯字')}
                className={`px-2 py-1.5 rounded-lg border text-center font-display text-base font-bold focus:outline-none focus:border-[var(--dojo-ochre)] ${
                  isWash
                    ? 'bg-[#FFFFFF] border-[#141413]/16 text-[#141413]'
                    : 'bg-[#0D131E] border-[#F2EEE6]/14 text-[#F6F2EA]'
                }`}
              />
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as CorrectionIssueType)}
                aria-label={t('錯誤類型')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-[var(--dojo-ochre)] ${
                  isWash
                    ? 'bg-[#FFFFFF] border-[#141413]/16 text-[#141413]'
                    : 'bg-[#0D131E] border-[#F2EEE6]/14 text-[#E6E1D8]'
                }`}
              >
                {ISSUE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {t(opt.label)}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Lookup Preview of Current Table Entry */}
            {firstChar && (
              <div
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] flex items-center justify-between gap-2 ${
                  isWash
                    ? 'bg-[#FFFFFF]/80 border-[#141413]/10 text-[#464640]'
                    : 'bg-[#0E141F]/80 border-[#F2EEE6]/10 text-[#B8C0CE]'
                }`}
              >
                {lookedUp ? (
                  <>
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="text-[10px] opacity-70 shrink-0">
                        {t('現錄')}
                      </span>
                      <span className="font-mono-tabular font-bold uppercase text-[var(--dojo-ochre)]">
                        {lookedUp.code}
                      </span>
                      {lookedUp.shortCode && (
                        <span className="font-mono-tabular text-[10px] opacity-75">
                          ({lookedUp.shortCode.toUpperCase()})
                        </span>
                      )}
                      <span className="opacity-35">·</span>
                      <span className="inline-flex items-center gap-1 truncate font-display">
                        {lookedUp.roots.map((r, i) => (
                          <RadicalSymbol key={i} glyph={r} />
                        ))}
                      </span>
                    </div>
                    <span className="text-[10px] opacity-60 shrink-0">
                      {t(lookedUp.sourceLabel)}
                    </span>
                  </>
                ) : (
                  <span className="opacity-70">
                    {t('當前道場表未收錄此字，仍可提交補充建議')}
                  </span>
                )}
              </div>
            )}

            {/* Row 2: Suggested Code & Suggested Roots */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={suggestedCode}
                onChange={(e) =>
                  setSuggestedCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 12))
                }
                placeholder={t('建議鍵碼（選填）')}
                aria-label={t('建議鍵碼')}
                className={`px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs uppercase focus:outline-none focus:border-[var(--dojo-ochre)] ${
                  isWash
                    ? 'bg-[#FFFFFF] border-[#141413]/16 text-[#141413] placeholder:normal-case'
                    : 'bg-[#0D131E] border-[#F2EEE6]/14 text-[#F2EEE6] placeholder:normal-case'
                }`}
              />
              <input
                type="text"
                value={suggestedRoots}
                onChange={(e) => setSuggestedRoots(e.target.value.slice(0, 48))}
                placeholder={t('建議拆根（選填）')}
                aria-label={t('建議拆根')}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-display focus:outline-none focus:border-[var(--dojo-ochre)] ${
                  isWash
                    ? 'bg-[#FFFFFF] border-[#141413]/16 text-[#141413]'
                    : 'bg-[#0D131E] border-[#F2EEE6]/14 text-[#F2EEE6]'
                }`}
              />
            </div>

            {/* Row 3: Concise Description */}
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 480))}
              placeholder={t('簡述錯誤處（例如：某筆應歸第 3 根、或實際全碼應為…）')}
              aria-label={t('錯誤說明')}
              className={`w-full px-2.5 py-1.5 rounded-lg border text-xs resize-none leading-relaxed focus:outline-none focus:border-[var(--dojo-ochre)] ${
                isWash
                  ? 'bg-[#FFFFFF] border-[#141413]/16 text-[#141413]'
                  : 'bg-[#0D131E] border-[#F2EEE6]/14 text-[#F2EEE6]'
              }`}
            />

            {errorMsg && (
              <div className="text-[11px] font-medium text-[var(--dojo-crimson-text)]">
                {t(errorMsg)}
              </div>
            )}
            {feedback && (
              <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dojo-pine-text)]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span
                className={`text-[10px] leading-tight ${
                  isWash ? 'text-[#6A6A63]' : 'text-[#8C96A8]'
                }`}
              >
                {user
                  ? isAdmin
                    ? t('管理員模式 · 可審核並匯出全庫報告')
                    : t('報告將寫入雲端，重部署亦不遺失')
                  : t('提交時將引導 Google 帳號驗證')}
              </span>
              <button
                type="submit"
                disabled={submitting || authBusy}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${
                  isWash
                    ? 'bg-[#181817] hover:bg-[#2C2C29] text-[#F8F7F3]'
                    : 'bg-[var(--dojo-pine)] hover:opacity-90 text-white'
                }`}
              >
                <Send className="w-3 h-3" />
                <span>{t(submitting ? '提交中…' : '提交報告')}</span>
              </button>
            </div>
          </form>

          {/* Submitted Reports List (Live Firestore Subscription) */}
          {user && reports.length > 0 && (
            <div className="pt-2 border-t border-[var(--dojo-border)] space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-[var(--dojo-text-sub)]">
                  {isAdmin
                    ? `${t('全體糾錯紀錄')} (${reports.length})`
                    : `${t('我的雲端報告')} (${reports.length})`}
                </span>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleExportReportsJson}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--dojo-ochre)] hover:underline cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>{t('匯出 JSON')}</span>
                    </button>
                  )}
                  {reports.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setShowAllList((v) => !v);
                      }}
                      className="text-[11px] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)] cursor-pointer"
                    >
                      {t(showAllList ? '收合' : `展開全部 (${reports.length})`)}
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                {visibleReports.map((rep) => {
                  const statusTone =
                    rep.status === 'resolved'
                      ? 'text-[var(--dojo-pine-text)] bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/30'
                      : rep.status === 'reviewed'
                        ? 'text-[var(--dojo-ochre)] bg-[var(--dojo-ochre)]/12 border-[var(--dojo-ochre)]/30'
                        : isWash
                          ? 'text-[#666660] bg-[#141413]/5 border-[#141413]/12'
                          : 'text-[#AEB6C4] bg-[#F2EEE6]/6 border-[#F2EEE6]/12';

                  return (
                    <div
                      key={rep.id}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                        isWash
                          ? 'bg-[#FFFFFF]/75 border-[#141413]/10'
                          : 'bg-[#0E141F]/75 border-[#F2EEE6]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-display font-bold text-sm text-[var(--dojo-text-bright)] shrink-0">
                            {rep.char}
                          </span>
                          {(rep.currentCode || rep.suggestedCode) && (
                            <span className="font-mono-tabular text-[10px] uppercase text-[var(--dojo-text-muted)] truncate">
                              {rep.currentCode || '?'} →{' '}
                              <span className="text-[var(--dojo-ochre)] font-semibold">
                                {rep.suggestedCode || rep.currentCode}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleCycleStatus(rep)}
                              title={t('點擊切換審核狀態')}
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-medium cursor-pointer ${statusTone}`}
                            >
                              {rep.status === 'resolved' && (
                                <Check className="w-2.5 h-2.5 inline mr-0.5" />
                              )}
                              {t(STATUS_LABELS[rep.status])}
                            </button>
                          ) : (
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${statusTone}`}
                            >
                              {t(STATUS_LABELS[rep.status])}
                            </span>
                          )}
                          {(isAdmin || rep.status === 'open') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReport(rep.id)}
                              aria-label={t('撤回報告')}
                              title={t('撤回報告')}
                              className="p-0.5 text-[var(--dojo-text-muted)] hover:text-[var(--dojo-crimson-text)] cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--dojo-text-sub)] line-clamp-2 leading-snug">
                        {rep.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
