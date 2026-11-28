import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Contrast,
  Download,
  Eye,
  EyeOff,
  FileImage,
  Grid2x2,
  Keyboard,
  Printer,
  X,
} from 'lucide-react';
import {
  A4_EXPORT_H,
  A4_EXPORT_W,
  exportAlphabeticalCatalogPdf,
  exportAlphabeticalCatalogPng,
  exportPosterPng,
  exportTopologyCloudPdf,
  getAllTwentyKeysSummary,
  getAlphabeticalCatalogPagePlan,
  renderAlphabeticalCatalogPage,
  renderPage1KeyboardPoster,
  renderPage2FamilyMatrix,
} from '../utils/topologyCloudPdf';
import { useTopologyAtlasPrint } from '../hooks/useTopologyAtlasPrint';
import { PrintableTopologySheets } from './PrintableTopologySheets';

export type TopologyPrintViewTab = 'alpha_all' | 'page1' | 'page2';

interface TopologyCloudPdfModalProps {
  open: boolean;
  activeKey: string;
  initialTab?: TopologyPrintViewTab;
  initialGrayscale?: boolean;
  onClose: () => void;
  onSelectKeyAndClose: (key: string) => void;
  onRequestPrint?: (opts: {
    showGhostGlyph: boolean;
    showWatermark: boolean;
    showFingerVector: boolean;
    grayscaleCore: boolean;
    pages: 'both' | 'page1' | 'page2' | 'alpha_all';
  }) => Promise<void> | void;
  isPrintingExternal?: boolean;
}

const PREVIEW_SCALE = 0.52; // 1824 x 1290 crisp live preview canvas

export const TopologyCloudPdfModal: React.FC<TopologyCloudPdfModalProps> = ({
  open,
  activeKey,
  initialTab = 'page1',
  initialGrayscale = false,
  onClose,
  onSelectKeyAndClose,
  onRequestPrint,
  isPrintingExternal = false,
}) => {
  const [activeTab, setActiveTab] = useState<TopologyPrintViewTab>(initialTab);
  const [alphaPageIdx, setAlphaPageIdx] = useState<number>(0);
  const [grayscaleCore, setGrayscaleCore] = useState<boolean>(initialGrayscale);
  const [showGhostGlyph, setShowGhostGlyph] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [showFingerVector, setShowFingerVector] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const alphaPages = useMemo(() => getAlphabeticalCatalogPagePlan(), []);
  const keySummary = useMemo(() => getAllTwentyKeysSummary(), []);

  // Sync initial tab & grayscale mode whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setGrayscaleCore(initialGrayscale);
    setExportNotice(null);
    if (initialTab === 'alpha_all' && activeKey) {
      const hitIdx = alphaPages.findIndex((p) => p.keys.includes(activeKey.toLowerCase()));
      setAlphaPageIdx(hitIdx >= 0 ? hitIdx : 0);
    }
  }, [open, initialTab, initialGrayscale, activeKey, alphaPages]);

  const {
    printUrls: fallbackPrintUrls,
    isPreparingPrint: isPreparingFallbackPrint,
    triggerPrint: triggerFallbackPrint,
  } = useTopologyAtlasPrint({
    showGhostGlyph,
    showWatermark,
    showFingerVector,
    grayscaleCore,
  });

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (activeTab === 'alpha_all' && e.key === 'ArrowLeft') {
        e.preventDefault();
        setAlphaPageIdx((p) => Math.max(0, p - 1));
      } else if (activeTab === 'alpha_all' && e.key === 'ArrowRight') {
        e.preventDefault();
        setAlphaPageIdx((p) => Math.min(alphaPages.length - 1, p + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, activeTab, alphaPages.length]);

  useEffect(() => {
    if (!open) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const opts = {
      scale: PREVIEW_SCALE,
      showGhostGlyph,
      showWatermark,
      showFingerVector,
      grayscaleCore,
    };
    if (activeTab === 'alpha_all') {
      renderAlphabeticalCatalogPage(canvas, alphaPageIdx, opts);
    } else if (activeTab === 'page1') {
      renderPage1KeyboardPoster(canvas, opts);
    } else {
      renderPage2FamilyMatrix(canvas, opts);
    }
  }, [open, activeTab, alphaPageIdx, showGhostGlyph, showWatermark, showFingerVector, grayscaleCore]);

  const handleDownloadPdf = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportNotice(null);
    try {
      await new Promise((r) => window.setTimeout(r, 20));
      if (activeTab === 'alpha_all') {
        await exportAlphabeticalCatalogPdf({
          showGhostGlyph,
          showWatermark,
          showFingerVector,
          grayscaleCore,
        });
        setExportNotice(`已导出 A–Z 全部 249 字根大字谱（${alphaPages.length} 页 A4 PDF）`);
      } else {
        await exportTopologyCloudPdf({
          pages: 'both',
          showGhostGlyph,
          showWatermark,
          showFingerVector,
          grayscaleCore,
        });
        setExportNotice('已导出双页 A4 横向新云图 PDF');
      }
    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    activeTab,
    showGhostGlyph,
    showWatermark,
    showFingerVector,
    grayscaleCore,
    alphaPages.length,
  ]);

  const handleDownloadPng = useCallback(() => {
    if (activeTab === 'alpha_all') {
      exportAlphabeticalCatalogPng(alphaPageIdx, {
        showGhostGlyph,
        showWatermark,
        showFingerVector,
        grayscaleCore,
      });
      const p = alphaPages[alphaPageIdx];
      const keysTag = p ? p.keys.map((k) => k.toUpperCase()).join('·') : '';
      setExportNotice(`已导出第 ${alphaPageIdx + 1} 页（${keysTag}）300DPI 高清图`);
      return;
    }
    const pageNum = activeTab === 'page1' ? 1 : 2;
    exportPosterPng(pageNum, {
      showGhostGlyph,
      showWatermark,
      showFingerVector,
      grayscaleCore,
    });
    setExportNotice(`已导出第 ${pageNum} 页 300DPI 高清图`);
  }, [
    activeTab,
    alphaPageIdx,
    alphaPages,
    showGhostGlyph,
    showWatermark,
    showFingerVector,
    grayscaleCore,
  ]);

  const isPreparingPrint = onRequestPrint ? isPrintingExternal : isPreparingFallbackPrint;

  const handlePrint = useCallback(() => {
    const opts = {
      showGhostGlyph,
      showWatermark,
      showFingerVector,
      grayscaleCore,
      pages: activeTab === 'alpha_all' ? ('alpha_all' as const) : ('both' as const),
    };
    if (onRequestPrint) {
      void onRequestPrint(opts);
      return;
    }
    void triggerFallbackPrint(opts);
  }, [
    onRequestPrint,
    showFingerVector,
    showGhostGlyph,
    showWatermark,
    grayscaleCore,
    activeTab,
    triggerFallbackPrint,
  ]);

  if (!open) return null;

  const currentAlphaPage = alphaPages[alphaPageIdx];

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="灵明二十笔势纸质打印与 PDF 导出"
        className="no-print fixed inset-0 z-50 flex flex-col bg-[#141311]/84 backdrop-blur-sm p-3 sm:p-5 overflow-hidden"
      >
        {/* Top Archival Toolbar */}
        <div className="shrink-0 w-full max-w-[1440px] mx-auto rounded-t-2xl border border-[#2B2925] bg-[#FAF8F2] text-[#1A1917] px-4 py-3 flex flex-col gap-2.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg border flex items-center justify-center font-display font-bold text-sm shrink-0 ${
                  grayscaleCore
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : 'border-[#B02E24]/45 bg-[#B02E24]/8 text-[#B02E24]'
                }`}
              >
                {activeTab === 'alpha_all' ? '谱' : '云'}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-bold text-[#1A1917] truncate">
                  {activeTab === 'alpha_all'
                    ? `全部 249 字根核心大字谱 · A–Z 字母序（共 ${alphaPages.length} 页 A4 横向）`
                    : '灵明二十笔势 · 拓扑共性键盘新云图（A4 横向打印版）'}
                </h2>
                <p className="text-xs text-[#58534B] truncate">
                  {activeTab === 'alpha_all'
                    ? '按 B→Y 字母排序不拆键 · 每根约 2.7cm 大字田字格 · 浓黑核心配浅灰余笔，适合黑白打印纸上细看'
                    : '第 1 页总览 20 键共性焦形与 249 简体字根；第 2 页并行检视每键 6 枚差异字根是否归于一形'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Primary Sheet Mode Switcher */}
              <div className="inline-flex items-center rounded-lg border border-[#1A1917]/15 bg-[#EFECE2] p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('alpha_all');
                    setGrayscaleCore(true);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'alpha_all'
                      ? 'bg-[#141414] text-white shadow-xs'
                      : 'text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>A–Z 全字根大字谱 ({alphaPages.length}页)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('page1')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'page1'
                      ? 'bg-[#FAF8F2] text-[#B02E24] shadow-xs'
                      : 'text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>键盘新云图</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('page2')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'page2'
                      ? 'bg-[#FAF8F2] text-[#B02E24] shadow-xs'
                      : 'text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  <Grid2x2 className="w-3.5 h-3.5" />
                  <span>群根归一谱</span>
                </button>
              </div>

              {/* Grayscale Core vs Vermilion Color Switch */}
              <div className="inline-flex items-center rounded-lg border border-[#1A1917]/15 bg-[#EFECE2] p-0.5">
                <button
                  type="button"
                  onClick={() => setGrayscaleCore(true)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    grayscaleCore
                      ? 'bg-[#141414] text-white shadow-xs'
                      : 'text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  <Contrast className="w-3.5 h-3.5" />
                  <span>灰度突出核心</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGrayscaleCore(false)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    !grayscaleCore
                      ? 'bg-[#B02E24] text-white shadow-xs'
                      : 'text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  <span>朱砂宣纸</span>
                </button>
              </div>

              {/* Ghost Glyph vs Pure Core Toggle */}
              <div className="inline-flex items-center rounded-lg border border-[#1A1917]/15 bg-[#EFECE2] p-0.5">
                <button
                  type="button"
                  onClick={() => setShowGhostGlyph(true)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    showGhostGlyph
                      ? 'bg-[#FAF8F2] text-[#1A1917] shadow-xs'
                      : 'text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>全形 + 核心</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGhostGlyph(false)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    !showGhostGlyph
                      ? 'bg-[#1A1917] text-[#FAF8F2] shadow-xs'
                      : 'text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>仅看核心</span>
                </button>
              </div>

              {/* Export & Print Actions */}
              <button
                type="button"
                disabled={isPreparingPrint}
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#141414] hover:bg-[#2C2C2C] disabled:opacity-60 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {isPreparingPrint
                    ? '生成打印页中...'
                    : activeTab === 'alpha_all'
                      ? `直接打印全部 ${alphaPages.length} 页`
                      : '打印双页'}
                </span>
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B02E24] hover:bg-[#95251D] disabled:opacity-60 text-xs font-semibold text-[#FAF8F2] transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isExporting
                    ? '生成 PDF 中...'
                    : activeTab === 'alpha_all'
                      ? `下载 ${alphaPages.length} 页 PDF`
                      : '下载双页 PDF'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPng}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1A1917]/20 bg-[#FAF8F2] hover:bg-[#EFECE2] text-xs font-semibold text-[#1A1917] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileImage className="w-3.5 h-3.5 text-[#58534B]" />
                <span>本页 PNG</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="关闭打印预览"
                className="p-1.5 rounded-lg border border-[#1A1917]/20 bg-[#FAF8F2] hover:bg-[#EFECE2] text-[#1A1917] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Secondary Page Strip for A–Z Multi-Page Catalog */}
          {activeTab === 'alpha_all' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1A1917]/10">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
                <button
                  type="button"
                  disabled={alphaPageIdx <= 0}
                  onClick={() => setAlphaPageIdx((p) => Math.max(0, p - 1))}
                  aria-label="上一页"
                  className="p-1 rounded-md border border-[#1A1917]/15 bg-white hover:bg-[#EFECE2] disabled:opacity-35 text-[#1A1917] cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {alphaPages.map((p) => {
                  const active = p.pageIndex === alphaPageIdx;
                  const keysText = p.keys.map((k) => k.toUpperCase()).join('·');
                  return (
                    <button
                      key={p.pageIndex}
                      type="button"
                      onClick={() => setAlphaPageIdx(p.pageIndex)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono-tabular transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'border-[#141414] bg-[#141414] text-white font-bold'
                          : 'border-[#1A1917]/15 bg-white hover:bg-[#EFECE2] text-[#1A1917]'
                      }`}
                    >
                      <span>P{p.pageIndex + 1}</span>
                      <span className={active ? 'text-white/90' : 'text-[#58534B]'}>
                        {keysText}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={alphaPageIdx >= alphaPages.length - 1}
                  onClick={() => setAlphaPageIdx((p) => Math.min(alphaPages.length - 1, p + 1))}
                  aria-label="下一页"
                  className="p-1 rounded-md border border-[#1A1917]/15 bg-white hover:bg-[#EFECE2] disabled:opacity-35 text-[#1A1917] cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#58534B] shrink-0">
                <button
                  type="button"
                  onClick={() => setShowWatermark((v) => !v)}
                  className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    showWatermark
                      ? 'border-[#141414]/40 bg-[#E6E1D4] text-[#141414]'
                      : 'border-[#1A1917]/15 bg-white text-[#58534B] hover:text-[#1A1917]'
                  }`}
                >
                  淡字水印
                </button>
                {currentAlphaPage && (
                  <span className="font-mono-tabular text-[11px] whitespace-nowrap">
                    本页 {currentAlphaPage.radicalCount} 根 · 方向键 ←/→ 翻页
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center A4 Landscape Sheet Viewport */}
        <div
          className="flex-1 w-full max-w-[1440px] mx-auto bg-[#23211E] border-x border-[#2B2925] overflow-auto flex items-center justify-center p-3 sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="relative w-full max-w-[1320px] shadow-2xl rounded-sm overflow-hidden bg-white border border-[#1A1917]/25">
            <canvas
              ref={previewCanvasRef}
              width={Math.round(A4_EXPORT_W * PREVIEW_SCALE)}
              height={Math.round(A4_EXPORT_H * PREVIEW_SCALE)}
              style={{
                width: '100%',
                height: 'auto',
                aspectRatio: `${A4_EXPORT_W} / ${A4_EXPORT_H}`,
              }}
              className="block"
            />
          </div>
        </div>

        {/* Bottom 20-Key Quick Jump Bar + Export Status */}
        <div className="shrink-0 w-full max-w-[1440px] mx-auto rounded-b-2xl border border-[#2B2925] bg-[#FAF8F2] text-[#1A1917] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
            <span className="text-[11px] font-semibold text-[#58534B] whitespace-nowrap mr-1">
              {activeTab === 'alpha_all' ? '按字母定位页面：' : '点选任一键跳回细看：'}
            </span>
            {(activeTab === 'alpha_all'
              ? [...keySummary].sort((a, b) => a.key.localeCompare(b.key))
              : keySummary
            ).map((item) => {
              const isOnCurrentAlphaPage =
                activeTab === 'alpha_all' && currentAlphaPage?.keys.includes(item.key);
              const isActive = activeTab === 'alpha_all' ? isOnCurrentAlphaPage : item.key === activeKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (activeTab === 'alpha_all') {
                      const idx = alphaPages.findIndex((p) => p.keys.includes(item.key));
                      if (idx >= 0) setAlphaPageIdx(idx);
                    } else {
                      onSelectKeyAndClose(item.key);
                    }
                  }}
                  title={`${item.key.toUpperCase()} · ${item.techniqueName} · ${item.shapeLabel}（共 ${item.count} 根）`}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-mono-tabular transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? grayscaleCore
                        ? 'border-[#141414] bg-[#141414] text-white font-bold'
                        : 'border-[#B02E24] bg-[#B02E24]/12 text-[#B02E24] font-bold'
                      : 'border-[#1A1917]/15 bg-[#EFECE2]/70 hover:bg-[#E6E1D4] text-[#1A1917]'
                  }`}
                >
                  <span className="font-bold">{item.key.toUpperCase()}</span>
                  <span className="opacity-75">{item.shapeSymbol}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            {activeTab === 'page1' && (
              <button
                type="button"
                onClick={() => setShowFingerVector((v) => !v)}
                className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  showFingerVector
                    ? 'border-[#1C725E]/40 bg-[#1C725E]/10 text-[#1C725E]'
                    : 'border-[#1A1917]/15 bg-white text-[#58534B]'
                }`}
              >
                指法去向
              </button>
            )}
            {exportNotice && (
              <span className="inline-flex items-center gap-1 text-[#1C725E] font-semibold whitespace-nowrap">
                <Check className="w-3.5 h-3.5" />
                <span>{exportNotice}</span>
              </span>
            )}
            <span className="font-mono-tabular text-[11px] text-[#58534B] whitespace-nowrap">
              A4 横向 297×210mm · 300 DPI
            </span>
          </div>
        </div>
      </div>

      {/* Print-only clean A4 Landscape pages (fallback when parent does not manage print sheets) */}
      {!onRequestPrint && <PrintableTopologySheets urls={fallbackPrintUrls} />}
    </>
  );
};
