'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@easybookshelf/ui';
import {
  IconChevronLeft,
  IconChevronRight,
  IconFullscreen,
  IconList,
  IconZoomIn,
  IconZoomOut,
} from '@/components/reader-icons';
import { ReaderToolbar, ToolbarButton } from '@/components/reader-toolbar';
import { PdfFlipbook, type PdfFlipbookHandle } from '@/components/pdf-flipbook';
import { PreviewEndBar } from '@/components/preview-end-bar';
import { NativePdfFallback } from '@/components/native-pdf-fallback';
import type { ReaderTheme } from '@/components/reader-types';
import { READER_THEMES } from '@/components/reader-types';
import { isEmbeddedIdeBrowser } from '@/lib/browser';
import { clearPageCache } from '@/lib/pdf-page-cache';
import {
  formatPageLabel,
  getNextPage,
  getPrevPage,
  type PageViewMode,
} from '@/lib/pdf-page-view';

const PDF_INIT_OPTIONS = {
  cMapUrl: '/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/standard_fonts/',
};

type FitMode = 'width' | 'page' | 'custom';
type PdfJsModule = typeof import('pdfjs-dist');
type PDFDocumentProxy = Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;

interface PdfViewerProps {
  data: ArrayBuffer;
  title?: string;
  bookSlug?: string;
  previewPageLimit?: number;
  initialPage?: number;
  theme?: ReaderTheme;
  onPageChange?: (page: number, totalPages: number) => void;
}

export function PdfViewer({
  data,
  title,
  bookSlug,
  previewPageLimit,
  initialPage = 1,
  theme = 'light',
  onPageChange,
}: PdfViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flipbookRef = useRef<PdfFlipbookHandle>(null);
  const onPageChangeRef = useRef(onPageChange);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(700);
  const resizeDebounceRef = useRef<number | undefined>(undefined);
  const [showPages, setShowPages] = useState(false);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [useNativeFallback, setUseNativeFallback] = useState(() => isEmbeddedIdeBrowser());
  const [viewMode, setViewMode] = useState<PageViewMode>('single');

  useEffect(() => {
    const saved = localStorage.getItem('easybookshelf_pdf_view_mode');
    if (saved === 'single' || saved === 'spread') setViewMode(saved);
  }, []);

  function handleViewModeChange(mode: PageViewMode) {
    setViewMode(mode);
    localStorage.setItem('easybookshelf_pdf_view_mode', mode);
  }

  const maxPage =
    previewPageLimit && previewPageLimit > 0
      ? Math.min(previewPageLimit, numPages || previewPageLimit)
      : numPages;

  const progressPercent = maxPage > 0 ? (pageNumber / maxPage) * 100 : 0;
  const themeColors = READER_THEMES[theme];

  const pageMaxHeight = Math.max(400, containerHeight - 24);

  const pageBounds = useMemo(() => {
    const round = (value: number) => Math.round(value / 32) * 32;
    if (viewMode === 'spread') {
      return {
        maxWidth: round(
          fitMode === 'width'
            ? Math.max(200, (containerWidth - 200) / 2)
            : fitMode === 'page'
              ? Math.max(200, containerWidth * 0.28)
              : Math.max(200, containerWidth * 0.28 * zoom),
        ),
        maxHeight: round(pageMaxHeight),
      };
    }
    return {
      maxWidth: round(
        fitMode === 'width'
          ? Math.max(280, containerWidth - 160)
          : fitMode === 'page'
            ? Math.max(280, containerWidth * 0.55)
            : Math.max(280, containerWidth * 0.55 * zoom),
      ),
      maxHeight: round(pageMaxHeight),
    };
  }, [viewMode, fitMode, containerWidth, containerHeight, pageMaxHeight, zoom]);

  const canGoPrev = getPrevPage(pageNumber, viewMode) !== null;
  const canGoNext = getNextPage(pageNumber, maxPage || 1, viewMode) !== null;
  const pageLabel = formatPageLabel(pageNumber, maxPage || 1, viewMode);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  }, [onPageChange]);

  useEffect(() => {
    setPageNumber(initialPage);
    setPageInput(String(initialPage));
  }, [initialPage, data]);

  useEffect(() => {
    if (numPages > 0) {
      onPageChangeRef.current?.(pageNumber, numPages);
    }
  }, [pageNumber, numPages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (resizeDebounceRef.current) window.clearTimeout(resizeDebounceRef.current);
      resizeDebounceRef.current = window.setTimeout(() => {
        setContainerWidth(rect.width);
        setContainerHeight(rect.height);
      }, 200);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeDebounceRef.current) window.clearTimeout(resizeDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PDFDocumentProxy | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function loadPdf() {
      setLoading(true);
      setLoadError(null);
      setLoadProgress(0);
      setPdfDoc(null);
      setNumPages(0);

      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setLoadError('PDF took too long to open. Refresh the page and try again.');
          setLoading(false);
        }
      }, 90_000);

      try {
        const pdfjs = await import('pdfjs-dist');
        if (cancelled) return;

        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const bytes = new Uint8Array(data);
        const task = pdfjs.getDocument({
          data: bytes,
          ...PDF_INIT_OPTIONS,
        });

        task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (!cancelled && total > 0) {
            setLoadProgress(Math.round((loaded / total) * 100));
          }
        };

        const doc = await task.promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }

        loadedDoc = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Could not load PDF';
        console.error('PDF load error:', error);
        setLoadError(message);
        setLoading(false);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearPageCache();
      if (loadedDoc) void loadedDoc.destroy();
    };
  }, [data]);

  const goToPage = useCallback(
    (page: number) => {
      const next = Math.min(Math.max(1, page), maxPage || 1);
      setPageNumber(next);
      setPageInput(String(next));
    },
    [maxPage],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Home') goToPage(1);
      if (e.key === 'End') goToPage(maxPage);
      if (e.key === '+' || e.key === '=') {
        setFitMode('custom');
        setZoom((z) => Math.min(2.5, z + 0.1));
      }
      if (e.key === '-') {
        setFitMode('custom');
        setZoom((z) => Math.max(0.5, z - 0.1));
      }
      if (e.key === 'f') {
        shellRef.current?.requestFullscreen?.().catch(() => undefined);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToPage, maxPage]);

  function submitPageInput() {
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isNaN(parsed)) goToPage(parsed);
    else setPageInput(String(pageNumber));
  }

  if (useNativeFallback) {
    return <NativePdfFallback data={data} title={title} />;
  }

  return (
    <div ref={shellRef} className="flex h-full flex-col" style={{ background: themeColors.bg }}>
      <ReaderToolbar
        progressPercent={progressPercent}
        left={
          <ToolbarButton
            title="Table of pages"
            active={showPages}
            onClick={() => setShowPages((v) => !v)}
          >
            <IconList />
          </ToolbarButton>
        }
        center={
          <>
            <ToolbarButton
              title="Previous page"
              disabled={!canGoPrev}
              onClick={() => flipbookRef.current?.goPrev()}
            >
              <IconChevronLeft />
            </ToolbarButton>
            <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              {viewMode === 'spread' ? (
                <span className="min-w-[4rem] text-center font-medium">{pageLabel}</span>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={maxPage || 1}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={submitPageInput}
                  onKeyDown={(e) => e.key === 'Enter' && submitPageInput()}
                  className="w-14 rounded-md border border-stone-300 bg-white px-2 py-1 text-center text-sm dark:border-stone-600 dark:bg-stone-800"
                />
              )}
              <span>/ {maxPage || '…'}</span>
            </div>
            <ToolbarButton
              title="Next page"
              disabled={!canGoNext}
              onClick={() => flipbookRef.current?.goNext()}
            >
              <IconChevronRight />
            </ToolbarButton>
          </>
        }
        right={
          <>
            <button
              type="button"
              title={viewMode === 'single' ? 'Switch to two-page spread' : 'Switch to single page'}
              onClick={() => handleViewModeChange(viewMode === 'single' ? 'spread' : 'single')}
              className={`hidden rounded-lg px-2 py-1 text-xs sm:inline ${
                viewMode === 'spread'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                  : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
              }`}
            >
              {viewMode === 'single' ? '1 page' : '2 pages'}
            </button>
            <ToolbarButton
              title="Zoom out"
              onClick={() => {
                setFitMode('custom');
                setZoom((z) => Math.max(0.5, z - 0.1));
              }}
            >
              <IconZoomOut />
            </ToolbarButton>
            <button
              type="button"
              title="Fit to width"
              onClick={() => setFitMode('width')}
              className="hidden rounded-lg px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 sm:inline dark:text-stone-300 dark:hover:bg-stone-800"
            >
              {fitMode === 'custom' ? `${Math.round(zoom * 100)}%` : fitMode === 'width' ? 'Fit width' : 'Fit page'}
            </button>
            <ToolbarButton
              title="Zoom in"
              onClick={() => {
                setFitMode('custom');
                setZoom((z) => Math.min(2.5, z + 0.1));
              }}
            >
              <IconZoomIn />
            </ToolbarButton>
            <ToolbarButton
              title="Fullscreen"
              onClick={() => shellRef.current?.requestFullscreen?.().catch(() => undefined)}
            >
              <IconFullscreen />
            </ToolbarButton>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        {showPages && (
          <aside className="w-48 shrink-0 overflow-y-auto border-r border-stone-200 bg-white p-2 dark:border-stone-700 dark:bg-stone-900">
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-stone-500">Pages</p>
            <div className="space-y-1">
              {Array.from({ length: maxPage || 0 }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => goToPage(page)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    page === pageNumber
                      ? 'bg-amber-100 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  Page {page}
                </button>
              ))}
            </div>
          </aside>
        )}

        <div ref={scrollRef} className="flex min-h-0 flex-1 overflow-hidden">
          {loadError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-red-600">Could not load PDF: {loadError}</p>
              <Button type="button" variant="secondary" onClick={() => setUseNativeFallback(true)}>
                Try simplified PDF view
              </Button>
            </div>
          ) : loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-stone-500">
              <p>Loading PDF…</p>
              {loadProgress > 0 && <p className="text-xs">{loadProgress}% parsed</p>}
            </div>
          ) : pdfDoc ? (
            <PdfFlipbook
              ref={flipbookRef}
              pdfDoc={pdfDoc}
              pageNumber={pageNumber}
              maxPage={maxPage || 1}
              pageBounds={pageBounds}
              viewMode={viewMode}
              onPageChange={goToPage}
            />
          ) : null}
        </div>
      </div>

      {previewPageLimit && numPages > previewPageLimit && pageNumber >= previewPageLimit && bookSlug && (
        <PreviewEndBar
          slug={bookSlug}
          message={`End of preview — purchase or rent to read all ${numPages} pages.`}
        />
      )}
    </div>
  );
}
