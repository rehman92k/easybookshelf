'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@/components/reader-icons';
import {
  formatPageLabel,
  getNextPage,
  getPrevPage,
  getSpreadPages,
  type PageViewMode,
} from '@/lib/pdf-page-view';
import { getCachedPage } from '@/lib/pdf-page-cache';
import {
  releasePdfCanvas,
  renderPdfPageOffscreen,
  renderPdfPageToCanvas,
  type PdfPageBounds,
} from '@/lib/pdf-canvas-render';
import '@/components/pdf-flipbook.css';

type PDFDocumentProxy = Awaited<
  ReturnType<typeof import('pdfjs-dist')['getDocument']>['promise']
>;

interface PdfFlipbookProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  maxPage: number;
  pageBounds: PdfPageBounds;
  viewMode: PageViewMode;
  onPageChange: (page: number) => void;
}

export interface PdfFlipbookHandle {
  goPrev: () => void;
  goNext: () => void;
}

function FlipNavButton({
  side,
  disabled,
  onClick,
}: {
  side: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flipbook-nav"
      disabled={disabled}
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous page' : 'Next page'}
      title={side === 'left' ? 'Previous page' : 'Next page'}
    >
      {side === 'left' ? <IconChevronLeft className="h-7 w-7" /> : <IconChevronRight className="h-7 w-7" />}
    </button>
  );
}

function pagesToRender(pageNumber: number, maxPage: number, viewMode: PageViewMode): number[] {
  if (viewMode === 'single') return [pageNumber];
  if (pageNumber <= 1) return [1];
  const { left, right } = getSpreadPages(pageNumber, maxPage);
  return right ? [left, right] : [left];
}

export const PdfFlipbook = forwardRef<PdfFlipbookHandle, PdfFlipbookProps>(function PdfFlipbook(
  { pdfDoc, pageNumber, maxPage, pageBounds, viewMode, onPageChange },
  ref,
) {
  const singleCanvasRef = useRef<HTMLCanvasElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const renderIdRef = useRef(0);
  const [busy, setBusy] = useState(false);

  const canGoPrev = getPrevPage(pageNumber, viewMode) !== null;
  const canGoNext = getNextPage(pageNumber, maxPage, viewMode) !== null;

  const preloadNearbyPages = useCallback(() => {
    const targets = new Set<number>();
    const prev = getPrevPage(pageNumber, viewMode);
    if (prev !== null) {
      for (const page of pagesToRender(prev, maxPage, viewMode)) targets.add(page);
    }
    let cursor = pageNumber;
    for (let i = 0; i < 3; i++) {
      const next = getNextPage(cursor, maxPage, viewMode);
      if (next === null) break;
      for (const page of pagesToRender(next, maxPage, viewMode)) targets.add(page);
      cursor = next;
    }
    for (const page of targets) {
      void renderPdfPageOffscreen(pdfDoc, page, pageBounds);
    }
  }, [pdfDoc, pageNumber, maxPage, pageBounds, viewMode]);

  const renderView = useCallback(async () => {
    const renderId = ++renderIdRef.current;
    const pages = pagesToRender(pageNumber, maxPage, viewMode);
    const needsRender = pages.some((page) => !getCachedPage(page, pageBounds));
    if (needsRender) setBusy(true);

    try {
      if (viewMode === 'single') {
        const canvas = singleCanvasRef.current;
        if (!canvas) return;
        await renderPdfPageToCanvas(pdfDoc, pageNumber, pageBounds, canvas);
      } else {
        const { left, right } = getSpreadPages(pageNumber, maxPage);
        const leftCanvas = leftCanvasRef.current;
        const rightCanvas = rightCanvasRef.current;
        if (!leftCanvas) return;

        if (pageNumber <= 1) {
          await renderPdfPageToCanvas(pdfDoc, 1, pageBounds, leftCanvas);
        } else {
          const jobs = [renderPdfPageToCanvas(pdfDoc, left, pageBounds, leftCanvas)];
          if (right && rightCanvas) {
            jobs.push(renderPdfPageToCanvas(pdfDoc, right, pageBounds, rightCanvas));
          }
          await Promise.all(jobs);
          if (renderId !== renderIdRef.current) return;
          if (!right && rightCanvas) {
            const ctx = rightCanvas.getContext('2d');
            if (ctx) {
              rightCanvas.width = leftCanvas.width;
              rightCanvas.height = leftCanvas.height;
              rightCanvas.style.width = leftCanvas.style.width;
              rightCanvas.style.height = leftCanvas.style.height;
              ctx.clearRect(0, 0, rightCanvas.width, rightCanvas.height);
            }
          }
        }
      }

    } catch (error) {
      if (renderId === renderIdRef.current) {
        console.error('PDF render error:', error);
      }
    } finally {
      if (renderId === renderIdRef.current && needsRender) {
        setBusy(false);
      }
    }
  }, [pdfDoc, pageNumber, maxPage, pageBounds, viewMode]);

  useEffect(() => {
    preloadNearbyPages();
  }, [preloadNearbyPages]);

  useEffect(() => {
    void renderView();
    return () => {
      renderIdRef.current += 1;
      void releasePdfCanvas(singleCanvasRef.current, leftCanvasRef.current, rightCanvasRef.current);
    };
  }, [renderView]);

  const goPrev = useCallback(() => {
    const prev = getPrevPage(pageNumber, viewMode);
    if (prev !== null) onPageChange(prev);
  }, [pageNumber, viewMode, onPageChange]);

  const goNext = useCallback(() => {
    const next = getNextPage(pageNumber, maxPage, viewMode);
    if (next !== null) onPageChange(next);
  }, [pageNumber, maxPage, viewMode, onPageChange]);

  useImperativeHandle(ref, () => ({ goPrev, goNext }), [goPrev, goNext]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev]);

  const pageLabel = formatPageLabel(pageNumber, maxPage, viewMode);

  return (
    <div className="flex h-full w-full items-center justify-center gap-3 px-2 sm:gap-6 sm:px-6">
      <FlipNavButton side="left" disabled={!canGoPrev} onClick={goPrev} />

      <div className={`flipbook-scene${busy ? ' flipbook-scene--loading' : ''}`}>
        {viewMode === 'single' ? (
          <div className="flipbook-book flipbook-book--single">
            <canvas ref={singleCanvasRef} className="flipbook-page" />
          </div>
        ) : (
          <div className="flipbook-book flipbook-book--spread">
            {pageNumber <= 1 ? (
              <canvas ref={leftCanvasRef} className="flipbook-page flipbook-page--cover" />
            ) : (
              <>
                <canvas ref={leftCanvasRef} className="flipbook-page flipbook-page--left" />
                <div className="flipbook-spine" aria-hidden />
                <canvas ref={rightCanvasRef} className="flipbook-page flipbook-page--right" />
              </>
            )}
            {pageNumber <= 1 && <canvas ref={rightCanvasRef} className="hidden" aria-hidden />}
          </div>
        )}
      </div>

      <FlipNavButton side="right" disabled={!canGoNext} onClick={goNext} />

      <span className="sr-only" aria-live="polite">
        {viewMode === 'spread' ? `Pages ${pageLabel}` : `Page ${pageNumber}`} of {maxPage}
      </span>
    </div>
  );
});
