'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { BookFileFormat, ReadingAccess } from '@easybookshelf/shared-types';
import { Button } from '@easybookshelf/ui';

const EPUB_PREVIEW_PERCENT = 10;

const EpubViewer = dynamic(
  () => import('@/components/epub-viewer').then((mod) => mod.EpubViewer),
  {
    ssr: false,
    loading: () => <p className="p-8 text-stone-500">Loading EPUB viewer…</p>,
  },
);

const PdfViewer = dynamic(
  () => import('@/components/pdf-viewer').then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => <p className="p-8 text-stone-500">Loading PDF viewer…</p>,
  },
);
import type { ReaderTheme } from '@/components/reader-types';
import { READER_THEMES } from '@/components/reader-types';
import { ReaderInterstitial } from '@/components/reader-interstitial';
import { getAccessToken } from '@/lib/auth';
import {
  fetchBookFileBuffer,
  fetchReadingAccessBySlug,
  fetchReadingProgress,
  saveReadingProgress,
} from '@/lib/reading';

interface BookReaderProps {
  slug: string;
}

function pickFormat(access: ReadingAccess, requested?: string | null): BookFileFormat | null {
  if (requested === 'epub' && access.formats.includes('epub')) return 'epub';
  if (requested === 'pdf' && access.formats.includes('pdf')) return 'pdf';
  if (access.formats.includes('epub')) return 'epub';
  if (access.formats.includes('pdf')) return 'pdf';
  return null;
}

export function BookReader({ slug }: BookReaderProps) {
  const searchParams = useSearchParams();
  const requestedFormat = searchParams.get('format');
  const requestedMode = searchParams.get('mode') === 'full' ? 'full' : 'preview';

  const [access, setAccess] = useState<ReadingAccess | null>(null);
  const [format, setFormat] = useState<BookFileFormat | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [epubData, setEpubData] = useState<ArrayBuffer | null>(null);
  const [initialPage, setInitialPage] = useState(1);
  const [initialLocation, setInitialLocation] = useState<string | undefined>();
  const [readingMode, setReadingMode] = useState<'preview' | 'full'>('preview');
  const [theme, setTheme] = useState<ReaderTheme>('light');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('easybookshelf_reader_theme');
    if (saved === 'light' || saved === 'sepia' || saved === 'dark') {
      setTheme(saved);
    }
  }, []);

  function handleThemeChange(next: ReaderTheme) {
    setTheme(next);
    localStorage.setItem('easybookshelf_reader_theme', next);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      setPdfData(null);
      setEpubData(null);

      try {
        const accessInfo = await fetchReadingAccessBySlug(slug);
        if (cancelled) return;

        if (accessInfo.mode === 'none') {
          setError('This book is not available for reading yet.');
          setAccess(accessInfo);
          return;
        }

        const selectedFormat = pickFormat(accessInfo, requestedFormat);
        if (!selectedFormat) {
          setError('No readable file is available for this book.');
          setAccess(accessInfo);
          return;
        }

        const mode =
          requestedMode === 'full' && accessInfo.mode === 'full' ? 'full' : 'preview';
        setReadingMode(mode);

        const buffer = await fetchBookFileBuffer(accessInfo.bookId, selectedFormat, mode);
        if (cancelled) return;

        if (getAccessToken()) {
          try {
            const progress = await fetchReadingProgress(accessInfo.bookId);
            if (progress?.format === selectedFormat) {
              if (selectedFormat === 'pdf' && typeof progress.position.page === 'number') {
                setInitialPage(progress.position.page);
              }
              if (selectedFormat === 'epub' && typeof progress.position.cfi === 'string') {
                const savedPercent = progress.progressPercent ?? 0;
                if (mode === 'full' || savedPercent < EPUB_PREVIEW_PERCENT) {
                  setInitialLocation(progress.position.cfi);
                }
              }
            }
          } catch {
            // Progress is optional when not signed in or first read.
          }
        }

        if (selectedFormat === 'pdf') {
          setPdfData(buffer.slice(0));
        } else {
          setEpubData(buffer.slice(0));
        }

        setAccess(accessInfo);
        setFormat(selectedFormat);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load book');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [slug, requestedFormat, requestedMode]);

  const saveProgress = useCallback(
    async (position: Record<string, unknown>, progressPercent: number) => {
      if (!access || !format || !getAccessToken()) return;
      try {
        await saveReadingProgress(access.bookId, { format, position, progressPercent });
      } catch {
        // Ignore progress save errors in the UI.
      }
    },
    [access, format],
  );

  const handlePdfPageChange = useCallback(
    (page: number, totalPages: number) => {
      const progressPercent = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0;
      void saveProgress({ page, totalPages }, progressPercent);
    },
    [saveProgress],
  );

  const handleEpubLocationChange = useCallback(
    (cfi: string, progressPercent: number) => {
      void saveProgress({ cfi }, progressPercent);
    },
    [saveProgress],
  );

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-stone-50 text-stone-500 dark:bg-stone-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
        <p>Opening book…</p>
      </div>
    );
  }

  if (error || !access || !format) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-600">{error ?? 'Unable to open this book.'}</p>
        <Link href={`/books/${slug}`}>
          <Button variant="secondary">Back to book</Button>
        </Link>
      </div>
    );
  }

  const previewPageLimit = readingMode === 'preview' ? access.previewPageCount : undefined;
  const epubPreviewPercentLimit =
    readingMode === 'preview' ? EPUB_PREVIEW_PERCENT : undefined;

  const themeColors = READER_THEMES[theme];
  const alternateFormat =
    access.formats.length > 1
      ? access.formats.find((f) => f !== format) ?? null
      : null;

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: themeColors.bg, color: themeColors.text }}
    >
      <header
        className="flex shrink-0 items-center justify-between border-b px-4 py-3"
        style={{
          borderColor: theme === 'dark' ? '#44403c' : '#e7e5e4',
          background: themeColors.chrome,
        }}
      >
        <div className="min-w-0">
          <Link
            href={`/books/${slug}`}
            className="text-sm text-amber-700 hover:underline dark:text-amber-400"
          >
            ← Back to book
          </Link>
          <h1 className="truncate font-serif text-lg font-semibold">{access.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-1 sm:flex">
            {(Object.keys(READER_THEMES) as ReaderTheme[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleThemeChange(key)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  theme === key
                    ? 'bg-amber-700 text-white'
                    : 'bg-stone-200/80 text-stone-700 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200'
                }`}
              >
                {READER_THEMES[key].label}
              </button>
            ))}
          </div>
          <div className="text-right text-xs opacity-70">
          <p className="uppercase tracking-wide">
            {readingMode} · {format}
          </p>
          {alternateFormat && (
            <Link
              href={`/books/${slug}/read?mode=${readingMode}&format=${alternateFormat}`}
              className="text-amber-700 hover:underline dark:text-amber-400"
            >
              Switch to {alternateFormat.toUpperCase()}
            </Link>
          )}
          {readingMode === 'preview' && (
            <p>
              {format === 'pdf'
                ? `${access.previewPageCount} pages`
                : `${EPUB_PREVIEW_PERCENT}% preview`}
            </p>
          )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {format === 'pdf' && pdfData && (
          <PdfViewer
            data={pdfData}
            title={access.title}
            bookSlug={slug}
            previewPageLimit={previewPageLimit}
            initialPage={initialPage}
            theme={theme}
            onPageChange={handlePdfPageChange}
          />
        )}
        {format === 'epub' && epubData && (
          <EpubViewer
            data={epubData}
            bookSlug={slug}
            previewPercentLimit={epubPreviewPercentLimit}
            initialLocation={initialLocation}
            theme={theme}
            onThemeChange={handleThemeChange}
            onLocationChange={handleEpubLocationChange}
          />
        )}
      </div>

      <footer
        className="shrink-0 border-t px-4 py-2 text-center text-xs opacity-60"
        style={{ borderColor: theme === 'dark' ? '#44403c' : '#e7e5e4' }}
      >
        Arrow keys or side arrows to turn pages · +/− to zoom · F for fullscreen
      </footer>

      <ReaderInterstitial active />
    </div>
  );
}
