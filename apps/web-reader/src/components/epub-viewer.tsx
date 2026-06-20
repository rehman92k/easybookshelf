'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ePub, { EpubCFI, type Book, type NavItem, type Rendition } from 'epubjs';
import {
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconFullscreen,
  IconList,
  IconSettings,
} from '@/components/reader-icons';
import { ReaderToolbar, ToolbarButton } from '@/components/reader-toolbar';
import { PreviewEndBar } from '@/components/preview-end-bar';
import type { ReaderTheme } from '@/components/reader-types';
import { READER_THEMES } from '@/components/reader-types';
import type { PageViewMode } from '@/lib/pdf-page-view';
import '@/components/pdf-flipbook.css';
import '@/components/epub-viewer.css';

export const EPUB_PREVIEW_PERCENT = 10;

interface EpubViewerProps {
  data: ArrayBuffer;
  bookSlug?: string;
  previewPercentLimit?: number;
  initialLocation?: string;
  theme?: ReaderTheme;
  onThemeChange?: (theme: ReaderTheme) => void;
  onLocationChange?: (location: string, progressPercent: number) => void;
}

function ReaderSideNavButton({
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

function flattenToc(items: NavItem[], depth = 0): Array<{ label: string; href: string; depth: number }> {
  const result: Array<{ label: string; href: string; depth: number }> = [];
  for (const item of items) {
    if (item.href && item.label) {
      result.push({ label: item.label.trim(), href: item.href, depth });
    }
    if (item.subitems?.length) {
      result.push(...flattenToc(item.subitems, depth + 1));
    }
  }
  return result;
}

async function waitForElementSize(element: HTMLElement, min = 120, timeoutMs = 8_000) {
  const start = performance.now();
  while (element.clientWidth < min || element.clientHeight < min) {
    if (performance.now() - start > timeoutMs) break;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

function toEpubBuffer(data: ArrayBuffer): ArrayBuffer {
  if (data.byteLength === 0) return data;
  return data.slice(0);
}

function readSavedViewMode(): PageViewMode {
  if (typeof window === 'undefined') return 'single';
  const saved = localStorage.getItem('easybookshelf_epub_view_mode');
  return saved === 'spread' ? 'spread' : 'single';
}

function meaningfulTextLength(doc: Document): number {
  const body = doc.body;
  if (!body) return 0;
  const clone = body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('img, svg').forEach((node) => node.remove());
  return clone.textContent?.replace(/\s+/g, '').length ?? 0;
}

function isImagePage(doc: Document): boolean {
  if (doc.querySelector('meta[name="calibre:cover"]')) return true;
  if (doc.title?.toLowerCase() === 'cover') return true;
  const body = doc.body;
  if (!body) return false;
  if (body.querySelector('svg image')) return true;

  const images = body.querySelectorAll('img');
  if (images.length === 0) return false;

  return meaningfulTextLength(doc) < 80;
}

type ImageViewport = {
  width: number;
  height: number;
};

function fitImageToViewport(img: HTMLImageElement, viewport: ImageViewport) {
  const pad = 8;
  const maxW = Math.max(120, viewport.width - pad);
  const maxH = Math.max(120, viewport.height - pad);

  img.removeAttribute('width');
  img.removeAttribute('height');
  img.style.objectFit = 'contain';
  img.style.display = 'block';
  img.style.margin = '0 auto';
  img.style.maxWidth = `${maxW}px`;
  img.style.maxHeight = `${maxH}px`;

  const applySize = () => {
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return;
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
    img.style.width = `${Math.round(naturalW * scale)}px`;
    img.style.height = `${Math.round(naturalH * scale)}px`;
  };

  if (img.complete) {
    applySize();
  } else {
    img.addEventListener('load', applySize, { once: true });
  }
}

function fixSvgAspectRatio(doc: Document, viewport: ImageViewport) {
  const pad = 8;
  const maxW = Math.max(120, viewport.width - pad);
  const maxH = Math.max(120, viewport.height - pad);

  doc.querySelectorAll('svg').forEach((node) => {
    const svg = node as SVGSVGElement;
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = 'auto';
    svg.style.height = 'auto';
    svg.style.maxWidth = `${maxW}px`;
    svg.style.maxHeight = `${maxH}px`;
  });
}

function fixImagesInDocument(doc: Document, viewport: ImageViewport) {
  doc.querySelectorAll('img').forEach((node) => {
    fitImageToViewport(node as HTMLImageElement, viewport);
  });
}

function lockDocumentViewport(doc: Document, viewport: ImageViewport) {
  const height = `${viewport.height}px`;
  doc.documentElement.style.height = height;
  doc.documentElement.style.maxHeight = height;
  doc.documentElement.style.overflow = 'hidden';
  doc.body.style.height = height;
  doc.body.style.maxHeight = height;
  doc.body.style.overflow = 'hidden';
  doc.body.style.margin = '0';
  doc.body.style.padding = '0';
}

function applyImagePageStyles(doc: Document, viewport: ImageViewport) {
  const styleId = 'easybookshelf-epub-image-page';
  let style = doc.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = styleId;
    doc.head.appendChild(style);
  }

  const maxW = Math.max(120, viewport.width - 8);
  const maxH = Math.max(120, viewport.height - 8);

  style.textContent = `
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: ${viewport.height}px !important;
      max-height: ${viewport.height}px !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      column-count: 1 !important;
      -webkit-column-count: 1 !important;
      columns: auto !important;
      -webkit-columns: auto !important;
      column-width: auto !important;
      -webkit-column-width: auto !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    body > div,
    .calibre1,
    .calibre2,
    h6 {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
      max-height: ${viewport.height}px !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      flex: 1 1 auto !important;
    }
    img {
      object-fit: contain !important;
      max-width: ${maxW}px !important;
      max-height: ${maxH}px !important;
      width: auto !important;
      height: auto !important;
    }
    svg {
      width: auto !important;
      height: auto !important;
      max-width: ${maxW}px !important;
      max-height: ${maxH}px !important;
    }
  `;

  lockDocumentViewport(doc, viewport);
  fixSvgAspectRatio(doc, viewport);
  fixImagesInDocument(doc, viewport);
}

function applyReadingStyles(doc: Document) {
  const styleId = 'easybookshelf-epub-reading-fix';
  if (!doc.getElementById(styleId)) {
    const style = doc.createElement('style');
    style.id = styleId;
    style.textContent = `
      img {
        object-fit: contain !important;
        max-width: 100% !important;
        height: auto !important;
        width: auto !important;
      }
    `;
    doc.head.appendChild(style);
  }
}

function getViewViewport(view: {
  document?: Document;
  iframe?: HTMLIFrameElement;
  element?: HTMLElement;
  lockedWidth?: number;
  lockedHeight?: number;
}): ImageViewport {
  const iframe = view.iframe;
  const width =
    iframe?.clientWidth ||
    view.lockedWidth ||
    view.element?.clientWidth ||
    view.document?.documentElement.clientWidth ||
    800;
  const height =
    iframe?.clientHeight ||
    view.lockedHeight ||
    view.element?.clientHeight ||
    view.document?.documentElement.clientHeight ||
    600;
  return {
    width: Math.max(120, width),
    height: Math.max(120, height),
  };
}

function applyContentStyles(
  doc: Document,
  viewport: ImageViewport,
) {
  if (isImagePage(doc)) {
    applyImagePageStyles(doc, viewport);
  } else {
    applyReadingStyles(doc);
  }
}

function spreadOptions(viewMode: PageViewMode) {
  return viewMode === 'spread'
    ? { spread: 'always' as const, minSpreadWidth: 480 }
    : { spread: 'none' as const, minSpreadWidth: 800 };
}

function getHostSize(host: HTMLElement) {
  return {
    width: Math.max(320, host.clientWidth),
    height: Math.max(480, host.clientHeight),
  };
}

function toDisplayPercent(raw: number | undefined): number {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  if (raw > 1) return Math.min(100, Math.round(raw));
  return Math.min(100, Math.max(0, Math.round(raw * 100)));
}

function getBookFraction(book: Book, cfi: string): number | null {
  try {
    const fraction = book.locations.percentageFromCfi(cfi);
    if (typeof fraction !== 'number' || Number.isNaN(fraction)) return null;
    return fraction;
  } catch {
    return null;
  }
}

function getLocationFraction(
  location: { start: { percentage?: number; cfi: string } },
  book: Book,
): number | null {
  const raw = location.start?.percentage;
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return raw > 1 ? raw / 100 : raw;
  }
  return getBookFraction(book, location.start.cfi);
}

function compareCfi(a: string, b: string): number | null {
  try {
    return new EpubCFI().compare(a, b);
  } catch {
    return null;
  }
}

function isAtOrPastPreviewBoundary(cfi: string, boundary: string): boolean {
  const compared = compareCfi(cfi, boundary);
  return compared !== null && compared >= 0;
}

export function EpubViewer({
  data,
  bookSlug,
  previewPercentLimit,
  initialLocation,
  theme = 'light',
  onThemeChange,
  onLocationChange,
}: EpubViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const previewLimitsRef = useRef<{ percent?: number }>({});
  const previewBoundaryCfiRef = useRef<string | null>(null);
  const previewLockedRef = useRef(false);
  const isSnappingRef = useRef(false);
  const navigationIntentRef = useRef<'prev' | 'next' | null>(null);
  const openIdRef = useRef(0);
  const locationCfiRef = useRef<string | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atPreviewEnd, setAtPreviewEnd] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toc, setToc] = useState<Array<{ label: string; href: string; depth: number }>>([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [fontScale, setFontScale] = useState(100);
  const [viewMode, setViewMode] = useState<PageViewMode>(readSavedViewMode);
  const viewModeAtOpenRef = useRef<PageViewMode>(viewMode);

  const themeColors = READER_THEMES[theme];

  function handleViewModeChange(mode: PageViewMode) {
    setViewMode(mode);
    localStorage.setItem('easybookshelf_epub_view_mode', mode);
  }

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useLayoutEffect(() => {
    const openId = ++openIdRef.current;
    let cancelled = false;
    let readyMarked = false;
    const host = containerRef.current;
    if (!host) return;
    const mountHost: HTMLDivElement = host;

    mountHost.innerHTML = '';
    setReady(false);
    setError(null);
    setAtPreviewEnd(false);
    setProgressPercent(0);
    setChapterTitle('');
    previewLimitsRef.current = {};
    previewBoundaryCfiRef.current = null;
    previewLockedRef.current = false;
    isSnappingRef.current = false;
    navigationIntentRef.current = null;
    viewModeAtOpenRef.current = viewMode;

    const markReady = () => {
      if (readyMarked || cancelled || openId !== openIdRef.current) return;
      readyMarked = true;
      setReady(true);
    };

    const book = ePub(toEpubBuffer(data), { replacements: 'blobUrl' });
    bookRef.current = book;

    let rendition: Rendition | null = null;

    function handleRelocated(location: {
      start: { index: number; cfi: string; href?: string; percentage?: number };
      end?: { percentage?: number };
    }) {
      if (isSnappingRef.current) return;

      const limit = previewLimitsRef.current.percent;
      const boundary = previewBoundaryCfiRef.current;
      const fraction = getLocationFraction(location, book);
      const percent = toDisplayPercent(fraction ?? undefined);
      const intent = navigationIntentRef.current;
      navigationIntentRef.current = null;

      const cfiCompare = boundary ? compareCfi(location.start.cfi, boundary) : null;
      const afterBoundary = cfiCompare !== null && cfiCompare > 0;
      const atOrAfterBoundary = cfiCompare !== null && cfiCompare >= 0;

      if (limit && limit > 0 && boundary && afterBoundary && intent !== 'prev') {
        previewLockedRef.current = true;
        setAtPreviewEnd(true);
        setProgressPercent(limit);
        locationCfiRef.current = boundary;
        onLocationChangeRef.current?.(boundary, limit);

        if (location.start.cfi !== boundary) {
          isSnappingRef.current = true;
          void rendition
            ?.display(boundary)
            .catch(() => undefined)
            .finally(() => {
              isSnappingRef.current = false;
            });
        }
        return;
      }

      setProgressPercent(percent);
      locationCfiRef.current = location.start.cfi;
      onLocationChangeRef.current?.(location.start.cfi, percent);

      if (limit && limit > 0 && atOrAfterBoundary) {
        previewLockedRef.current = true;
        setAtPreviewEnd(true);
      }
    }

    const loadTimeout = window.setTimeout(() => {
      if (!cancelled && openId === openIdRef.current && !readyMarked) {
        setError('EPUB took too long to open. Refresh and try again.');
      }
    }, 45_000);

    async function open() {
      try {
        await waitForElementSize(mountHost);
        if (cancelled || openId !== openIdRef.current) return;

        const width = getHostSize(mountHost).width;
        const height = getHostSize(mountHost).height;
        const spread = spreadOptions(viewModeAtOpenRef.current);

        rendition = book.renderTo(mountHost, {
          width,
          height,
          flow: 'paginated',
          manager: 'default',
          spread: spread.spread,
          minSpreadWidth: spread.minSpreadWidth,
        });
        renditionRef.current = rendition;

        rendition.hooks.content.register((contents: { document: Document }) => {
          if (!isImagePage(contents.document)) {
            applyReadingStyles(contents.document);
          }
        });

        rendition.on('relocated', (location: {
          start: { index: number; cfi: string; href?: string; percentage?: number };
          end?: { percentage?: number };
        }) => {
          if (openId !== openIdRef.current || cancelled) return;
          handleRelocated(location);
        });

        rendition.on('rendered', (_section: unknown, view: {
          document?: Document;
          iframe?: HTMLIFrameElement;
          element?: HTMLElement;
          lockedWidth?: number;
          lockedHeight?: number;
        }) => {
          if (openId !== openIdRef.current || cancelled) return;
          const doc = view.document;
          if (doc) {
            applyContentStyles(doc, getViewViewport(view));
          }
          const title = doc?.title;
          if (title && title !== 'Cover') setChapterTitle(title);
          markReady();
        });

        await book.ready;
        if (cancelled || openId !== openIdRef.current) return;

        const navigation = await book.loaded.navigation;
        if (!cancelled && openId === openIdRef.current && navigation.toc?.length) {
          setToc(flattenToc(navigation.toc));
        }

        if (previewPercentLimit !== undefined && previewPercentLimit > 0) {
          previewLimitsRef.current.percent = previewPercentLimit;
        }

        const hasPreviewLimit =
          previewPercentLimit !== undefined && previewPercentLimit > 0;

        if (hasPreviewLimit) {
          await book.locations.generate(1024);
          if (cancelled || openId !== openIdRef.current) return;

          const boundary = book.locations.cfiFromPercentage(previewPercentLimit / 100);
          if (boundary) {
            previewBoundaryCfiRef.current = String(boundary);
          }
        }

        let displayTarget: string | number | undefined;
        if (initialLocation) {
          displayTarget = initialLocation;
          if (
            hasPreviewLimit &&
            previewBoundaryCfiRef.current &&
            isAtOrPastPreviewBoundary(initialLocation, previewBoundaryCfiRef.current)
          ) {
            displayTarget = previewBoundaryCfiRef.current;
            previewLockedRef.current = true;
            setAtPreviewEnd(true);
          }
        }

        try {
          if (typeof displayTarget === 'string') {
            await rendition.display(displayTarget);
          } else {
            await rendition.display(displayTarget ?? 0);
          }
        } catch {
          await rendition.display(0);
        }

        if (cancelled || openId !== openIdRef.current) return;
        window.clearTimeout(loadTimeout);
        markReady();
        rendition.resize(width, height);

        if (hasPreviewLimit) {
          rendition.reportLocation();
        } else {
          void book.locations
            .generate(1024)
            .then(() => {
              if (cancelled || openId !== openIdRef.current || !rendition) return;
              rendition.reportLocation();
            })
            .catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled && openId === openIdRef.current) {
          window.clearTimeout(loadTimeout);
          setError(err instanceof Error ? err.message : 'Could not open EPUB');
        }
      }
    }

    void open();

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimeout);
      openIdRef.current += 1;
      rendition?.destroy();
      book.destroy();
      bookRef.current = null;
      renditionRef.current = null;
      mountHost.innerHTML = '';
    };
  }, [data, previewPercentLimit, initialLocation]);

  useEffect(() => {
    const container = containerRef.current;
    const rendition = renditionRef.current;
    if (!container || !rendition || !ready) return;

    const spread = spreadOptions(viewMode);
    const { width, height } = getHostSize(container);
    const cfi = locationCfiRef.current;

    rendition.spread(spread.spread, spread.minSpreadWidth);
    rendition.resize(width, height);
    if (cfi) {
      void rendition.display(cfi);
    }
  }, [viewMode, ready]);

  useEffect(() => {
    const container = containerRef.current;
    const rendition = renditionRef.current;
    if (!container || !rendition || !ready) return;

    const observer = new ResizeObserver(() => {
      const { width, height } = getHostSize(container);
      rendition.resize(width, height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready, viewMode]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition || !ready) return;

    const colors = READER_THEMES[theme];
    rendition.themes.default({
      img: {
        'object-fit': 'contain',
        'max-width': '100%',
        height: 'auto',
        width: 'auto',
      },
    });
    rendition.themes.override('color', colors.text);
    rendition.themes.override('background', colors.bg);
    rendition.themes.override('background-color', colors.bg);
    rendition.themes.fontSize(`${fontScale}%`);
  }, [theme, fontScale, ready]);

  const goPrev = useCallback(async () => {
    const rendition = renditionRef.current;
    const book = bookRef.current;
    if (!rendition || !book) return;

    navigationIntentRef.current = 'prev';

    const boundary = previewBoundaryCfiRef.current;
    const currentCfi = locationCfiRef.current;
    const compared =
      boundary && currentCfi ? compareCfi(currentCfi, boundary) : null;

    if (
      previewLimitsRef.current.percent &&
      boundary &&
      (compared !== null ? compared >= 0 : previewLockedRef.current)
    ) {
      const indexCfi = currentCfi ?? boundary;
      const locationIndex = book.locations.locationFromCfi(indexCfi);
      if (typeof locationIndex === 'number' && locationIndex > 0) {
        const prevCfi = book.locations.cfiFromLocation(locationIndex - 1);
        if (prevCfi) {
          await rendition.display(String(prevCfi));
          return;
        }
      }
    }

    await rendition.prev();
  }, []);

  const goNext = useCallback(async () => {
    if (previewLockedRef.current || atPreviewEnd) return;
    navigationIntentRef.current = 'next';
    await renditionRef.current?.next();
  }, [atPreviewEnd]);

  const goToHref = useCallback(async (href: string) => {
    await renditionRef.current?.display(href);
    setShowToc(false);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void goPrev();
      }
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        void goNext();
      }
      if (e.key === 'f') {
        shellRef.current?.requestFullscreen?.().catch(() => undefined);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev]);

  return (
    <div ref={shellRef} className="relative flex h-full flex-col" style={{ background: themeColors.bg }}>
      <ReaderToolbar
        progressPercent={progressPercent}
        left={
          <>
            <ToolbarButton title="Contents" active={showToc} onClick={() => setShowToc((v) => !v)}>
              <IconList />
            </ToolbarButton>
            <span className="hidden max-w-[12rem] truncate text-sm text-stone-600 sm:inline dark:text-stone-300">
              {chapterTitle || (ready ? 'Reading' : 'Opening…')}
            </span>
          </>
        }
        center={
          <>
            <ToolbarButton title="Previous page" disabled={!ready} onClick={() => void goPrev()}>
              <IconChevronLeft />
            </ToolbarButton>
            <span className="min-w-[4rem] text-center text-sm text-stone-600 dark:text-stone-300">
              {progressPercent}%
            </span>
            <ToolbarButton
              title="Next page"
              disabled={!ready || atPreviewEnd}
              onClick={() => void goNext()}
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
              disabled={!ready}
              onClick={() => handleViewModeChange(viewMode === 'single' ? 'spread' : 'single')}
              className={`hidden rounded-lg px-2 py-1 text-xs sm:inline ${
                viewMode === 'spread'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                  : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
              } ${!ready ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {viewMode === 'single' ? '1 page' : '2 pages'}
            </button>
            <ToolbarButton
              title="Reading settings"
              active={showSettings}
              onClick={() => setShowSettings((v) => !v)}
            >
              <IconSettings />
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

      <div className="relative flex min-h-0 flex-1">
        {showToc && (
          <aside className="absolute inset-y-0 left-0 z-20 w-72 overflow-y-auto border-r border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900 sm:relative">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
              <p className="text-sm font-semibold">Contents</p>
              <button type="button" onClick={() => setShowToc(false)} className="text-stone-500">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2">
              {toc.length === 0 && (
                <p className="px-2 py-4 text-sm text-stone-500">No table of contents available.</p>
              )}
              {toc.map((item) => (
                <button
                  key={`${item.href}-${item.label}`}
                  type="button"
                  onClick={() => void goToHref(item.href)}
                  style={{ paddingLeft: `${item.depth * 12 + 12}px` }}
                  className="block w-full rounded-md py-2 pr-3 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </aside>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center gap-3 px-2 sm:gap-6 sm:px-4">
          <ReaderSideNavButton side="left" disabled={!ready} onClick={() => void goPrev()} />

          <div
            ref={containerRef}
            className={`epub-viewer-host min-h-0 min-w-0 flex-1 ${viewMode === 'spread' ? 'epub-viewer-host--spread' : 'epub-viewer-host--single'}`}
            style={{ background: themeColors.bg, minHeight: '480px' }}
          />

          <ReaderSideNavButton
            side="right"
            disabled={!ready || atPreviewEnd}
            onClick={() => void goNext()}
          />
        </div>
      </div>

      {showSettings && (
        <div className="absolute right-4 top-16 z-30 w-64 rounded-xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900">
          <p className="text-sm font-semibold">Reading settings</p>

          <div className="mt-4">
            <label className="text-xs font-medium text-stone-500">Page layout</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleViewModeChange('single')}
                className={`rounded-lg border px-2 py-2 text-xs ${
                  viewMode === 'single'
                    ? 'border-amber-600 bg-amber-50 text-amber-900'
                    : 'border-stone-200 hover:bg-stone-50 dark:border-stone-600'
                }`}
              >
                1 page
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('spread')}
                className={`rounded-lg border px-2 py-2 text-xs ${
                  viewMode === 'spread'
                    ? 'border-amber-600 bg-amber-50 text-amber-900'
                    : 'border-stone-200 hover:bg-stone-50 dark:border-stone-600'
                }`}
              >
                2 pages
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-stone-500">Theme</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.keys(READER_THEMES) as ReaderTheme[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onThemeChange?.(key)}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    theme === key
                      ? 'border-amber-600 bg-amber-50 text-amber-900'
                      : 'border-stone-200 hover:bg-stone-50 dark:border-stone-600'
                  }`}
                >
                  {READER_THEMES[key].label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="font-scale" className="text-xs font-medium text-stone-500">
              Font size — {fontScale}%
            </label>
            <input
              id="font-scale"
              type="range"
              min={80}
              max={160}
              step={5}
              value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              className="mt-2 w-full accent-amber-700"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          {error}
        </div>
      )}
      {!ready && !error && (
        <p className="pointer-events-none absolute inset-x-0 bottom-24 z-10 text-center text-sm text-stone-500">
          Loading EPUB…
        </p>
      )}

      {atPreviewEnd && bookSlug && (
        <PreviewEndBar
          slug={bookSlug}
          message={`End of ${previewPercentLimit ?? EPUB_PREVIEW_PERCENT}% preview — purchase or rent to continue reading.`}
        />
      )}
    </div>
  );
}
