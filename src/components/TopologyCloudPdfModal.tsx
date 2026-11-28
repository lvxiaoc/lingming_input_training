import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
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
  exportPosterPng,
  exportTopologyCloudPdf,
  getAllTwentyKeysSummary,
  renderPage1KeyboardPoster,
  renderPage2FamilyMatrix,
} from '../utils/topologyCloudPdf';
import { useTopologyAtlasPrint } from '../hooks/useTopologyAtlasPrint';
import { PrintableTopologySheets } from './PrintableTopologySheets';

interface TopologyCloudPdfModalProps {
  open: boolean;
  activeKey: string;
  onClose: () => void;
  onSelectKeyAndClose: (key: string) => void;
  onRequestPrint?: (opts: {
    showGhostGlyph: boolean;
    showWatermark: boolean;
    showFingerVector: boolean;
  }) => Promise<void> | void;
  isPrintingExternal?: boolean;
}

const PREVIEW_SCALE = 0.52; // 1824 x 1290 crisp live preview canvas

export const TopologyCloudPdfModal: React.FC<TopologyCloudPdfModalProps> = ({
  open,
  activeKey,
  onClose,
  onSelectKeyAndClose,
  onRequestPrint,
  isPrintingExternal = false,
}) => {
  const [activePage, setActivePage] = useState<1 | 2>(1);
  const [showGhostGlyph, setShowGhostGlyph] = useState<boolean>(true);
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [showFingerVector, setShowFingerVector] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const {
    printUrls: fallbackPrintUrls,
    isPreparingPrint: isPreparingFallbackPrint,
    triggerPrint: triggerFallbackPrint,
  } = useTopologyAtlasPrint({
    showGhostGlyph,
    showWatermark,
    showFingerVector,
  });

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keySummary = useMemo(() => getAllTwentyKeysSummary(), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const opts = {
      scale: PREVIEW_SCALE,
      showGhostGlyph,
      showWatermark,
      showFingerVector,
    };
    if (activePage === 1) {
      renderPage1KeyboardPoster(canvas, opts);
    } else {
      renderPage2FamilyMatrix(canvas, opts);
    }
  }, [open, activePage, showGhostGlyph, showWatermark, showFingerVector]);

  const handleDownloadPdf = useCallback(
    async (pages: 'both' | 'page1' | 'page2') => {
      if (isExporting) return;
      setIsExporting(true);
      setExportNotice(null);
      try {
        await new Promise((r) => window.setTimeout(r, 20));
        await exportTopologyCloudPdf({
          pages,
          showGhostGlyph,
          showWatermark,
          showFingerVector,
        });
        setExportNotice(
          pages === 'both'
            ? '已导出双页 A4 横向 PDF'
            : `已导出第 ${pages === 'page1' ? '1' : '2'} 页 PDF`
        );
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting, showGhostGlyph, showWatermark, showFingerVector]
  );

  const handleDownloadPng = useCallback(() => {
    exportPosterPng(activePage, {
      showGhostGlyph,
      showWatermark,
      showFingerVector,
    });
    setExportNotice(`已导出第 ${activePage} 页 300DPI 高清图`);
  }, [activePage, showGhostGlyph, showWatermark, showFingerVector]);

  const isPreparingPrint = onRequestPrint ? isPrintingExternal : isPreparingFallbackPrint;

  const handlePrint = useCallback(() => {
    const opts = {
      showGhostGlyph,
      showWatermark,
      showFingerVector,
    };
    if (onRequestPrint) {
      void onRequestPrint(opts);
      return;
    }
    void triggerFallbackPrint(opts);
  }, [onRequestPrint, showFingerVector, showGhostGlyph, showWatermark, triggerFallbackPrint]);

  if (!open) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="二十笔势拓扑共性键盘新云图导出"
        className="no-print fixed inset-0 z-50 flex flex-col bg-[#141311]/82 backdrop-blur-sm p-3 sm:p-5 overflow-hidden"
      >
        {/* Top Archival Toolbar */}
        <div className="shrink-0 w-full max-w-[1440px] mx-auto rounded-t-2xl border border-[#2B2925] bg-[#FAF8F2] text-[#1A1917] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg border border-[#B02E24]/45 bg-[#B02E24]/8 flex items-center justify-center font-display font-bold text-sm text-[#B02E24] shrink-0">
              云
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-[#1A1917] truncate">
                灵明二十笔势 · 拓扑共性键盘新云图 (A4 横向打印版)
              </h2>
              <p className="text-xs text-[#58534B] truncate">
                第 1 页总览 20 键共性焦形与 249 简体字根；第 2 页并行检视每键 6 枚差异字根是否归于一形
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Page Switcher */}
            <div className="inline-flex items-center rounded-lg border border-[#1A1917]/15 bg-[#EFECE2] p-0.5">
              <button
                type="button"
                onClick={() => setActivePage(1)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activePage === 1
                    ? 'bg-[#FAF8F2] text-[#B02E24] shadow-xs'
                    : 'text-[#58534B] hover:text-[#1A1917]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>第 1 页 · 键盘新云图</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePage(2)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activePage === 2
                    ? 'bg-[#FAF8F2] text-[#B02E24] shadow-xs'
                    : 'text-[#58534B] hover:text-[#1A1917]'
                }`}
              >
                <Grid2x2 className="w-3.5 h-3.5" />
                <span>第 2 页 · 群根归一谱</span>
              </button>
            </div>

            {/* Pure Shape vs Full Ghost Toggle */}
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
                <span>全形残影 + 焦形</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGhostGlyph(false)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  !showGhostGlyph
                    ? 'bg-[#B02E24] text-[#FAF8F2] shadow-xs'
                    : 'text-[#58534B] hover:text-[#1A1917]'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>仅看纯朱砂焦形</span>
              </button>
            </div>

            {/* Optional Watermark & Finger Vector Toggles */}
            <button
              type="button"
              onClick={() => setShowWatermark((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showWatermark
                  ? 'border-[#1A1917]/35 bg-[#E6E1D4] text-[#1A1917]'
                  : 'border-[#1A1917]/15 bg-[#FAF8F2] text-[#58534B] hover:text-[#1A1917]'
              }`}
            >
              字根淡水印
            </button>

            {activePage === 1 && (
              <button
                type="button"
                onClick={() => setShowFingerVector((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  showFingerVector
                    ? 'border-[#1C725E]/40 bg-[#1C725E]/10 text-[#1C725E]'
                    : 'border-[#1A1917]/15 bg-[#FAF8F2] text-[#58534B] hover:text-[#1A1917]'
                }`}
              >
                指法去向
              </button>
            )}

            {/* Export Actions */}
            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleDownloadPdf('both')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#B02E24] hover:bg-[#95251D] disabled:opacity-60 text-xs font-semibold text-[#FAF8F2] transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? '生成 300DPI PDF 中...' : '下载 A4 双页 PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1A1917]/20 bg-[#FAF8F2] hover:bg-[#EFECE2] text-xs font-semibold text-[#1A1917] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileImage className="w-3.5 h-3.5 text-[#58534B]" />
              <span>导出 PNG</span>
            </button>

            <button
              type="button"
              disabled={isPreparingPrint}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1A1917]/20 bg-[#FAF8F2] hover:bg-[#EFECE2] disabled:opacity-60 text-xs font-semibold text-[#1A1917] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-[#58534B]" />
              <span>{isPreparingPrint ? '准备打印页...' : '打印'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="关闭新云图预览"
              className="p-1.5 rounded-lg border border-[#1A1917]/20 bg-[#FAF8F2] hover:bg-[#EFECE2] text-[#1A1917] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center A4 Landscape Sheet Viewport */}
        <div
          className="flex-1 w-full max-w-[1440px] mx-auto bg-[#23211E] border-x border-[#2B2925] overflow-auto flex items-center justify-center p-3 sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="relative w-full max-w-[1320px] shadow-2xl rounded-sm overflow-hidden bg-[#FAF8F2] border border-[#1A1917]/25">
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
              点选任一键跳回剧场细看：
            </span>
            {keySummary.map((item) => {
              const isActive = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectKeyAndClose(item.key)}
                  title={`${item.key.toUpperCase()} · ${item.techniqueName} · ${item.shapeLabel}（例「${item.exemplar}」共 ${item.count} 根）`}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-mono-tabular transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-[#B02E24] bg-[#B02E24]/12 text-[#B02E24] font-bold'
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
