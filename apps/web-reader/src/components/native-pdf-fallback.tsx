'use client';

import { useEffect, useState } from 'react';
import { Button } from '@easybookshelf/ui';

interface NativePdfFallbackProps {
  data: ArrayBuffer;
  title?: string;
}

export function NativePdfFallback({ data, title }: NativePdfFallbackProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data]);

  if (!objectUrl) {
    return <p className="p-8 text-stone-500">Loading PDF…</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">IDE built-in browser</p>
        <p className="mt-1 text-amber-900/90">
          Cursor&apos;s preview pane can&apos;t run the full PDF reader. Use Chrome or Safari for
          page controls, zoom, and preview limits.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => window.open(pageUrl, '_blank', 'noopener,noreferrer')}>
            Open in external browser
          </Button>
          <a
            href={objectUrl}
            download={title ? `${title}.pdf` : 'preview.pdf'}
            className="inline-flex items-center justify-center rounded-lg bg-stone-200 px-4 py-2 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-300"
          >
            Download PDF
          </a>
        </div>
      </div>
      <object
        data={objectUrl}
        type="application/pdf"
        title={title ?? 'Book preview'}
        className="min-h-0 flex-1 w-full bg-stone-100"
      >
        <p className="p-8 text-stone-600">
          PDF preview is not supported here.{' '}
          <a href={pageUrl} target="_blank" rel="noreferrer" className="text-amber-700 underline">
            Open in Chrome
          </a>
        </p>
      </object>
    </div>
  );
}
