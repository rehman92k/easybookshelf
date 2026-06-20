'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BookFileFormat, BookPrice, BookPricingQuote, ReadingAccess } from '@easybookshelf/shared-types';
import { Button } from '@easybookshelf/ui';
import { useAuth } from '@/components/auth-provider';
import { formatPrice } from '@/lib/catalog';
import { fetchPricingQuote } from '@/lib/commerce';
import { fetchReadingAccessBySlug } from '@/lib/reading';

interface PurchaseActionsProps {
  slug: string;
  prices: BookPrice;
  readingAccess: ReadingAccess | null;
  previewPages: number;
  epubPreviewPercent: number;
  hasEpub: boolean;
  hasPdf: boolean;
}

export function PurchaseActions({
  slug,
  prices,
  readingAccess,
  previewPages,
  epubPreviewPercent,
  hasEpub,
  hasPdf,
}: PurchaseActionsProps) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<ReadingAccess | null>(readingAccess);
  const [purchaseQuote, setPurchaseQuote] = useState<BookPricingQuote | null>(null);

  useEffect(() => {
    if (!user) {
      setAccess(readingAccess);
      setPurchaseQuote(null);
      return;
    }
    void fetchReadingAccessBySlug(slug)
      .then(setAccess)
      .catch(() => setAccess(readingAccess));
    void fetchPricingQuote(slug, 'purchase')
      .then(setPurchaseQuote)
      .catch(() => setPurchaseQuote(null));
  }, [user, slug, readingAccess]);

  const mode = access?.mode ?? 'none';
  const canPreview = mode === 'preview' || mode === 'full';
  const hasFullAccess = mode === 'full';
  const previewHref = (format: BookFileFormat) =>
    `/books/${slug}/read?mode=preview&format=${format}`;
  const readFullHref = (format: BookFileFormat) =>
    `/books/${slug}/read?mode=full&format=${format}`;

  function goToCheckout(type: 'purchase' | 'rental_15' | 'rental_30') {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/books/${slug}/checkout?type=${type}`)}`);
      return;
    }
    router.push(`/books/${slug}/checkout?type=${type}`);
  }

  const memberDiscountActive =
    purchaseQuote && purchaseQuote.memberDiscountAmount > 0 && purchaseQuote.adFree;

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
          <p className="text-sm text-stone-500">Buy</p>
          {memberDiscountActive ? (
            <>
              <p className="mt-1 text-sm text-stone-400 line-through">
                {formatPrice(prices.purchasePrice, prices.currency)}
              </p>
              <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">
                {formatPrice(purchaseQuote.chargedPrice, prices.currency)}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Member price — save {formatPrice(purchaseQuote.memberDiscountAmount, prices.currency)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-xl font-semibold">
                {formatPrice(prices.purchasePrice, prices.currency)}
              </p>
              <p className="mt-1 text-xs text-stone-400">Own forever</p>
            </>
          )}
        </div>
        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
          <p className="text-sm text-stone-500">15-day rent</p>
          <p className="mt-1 text-xl font-semibold">
            {formatPrice(prices.rental15Price, prices.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-700">
          <p className="text-sm text-stone-500">30-day rent</p>
          <p className="mt-1 text-xl font-semibold">
            {formatPrice(prices.rental30Price, prices.currency)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {hasFullAccess ? (
          <>
            {hasEpub && hasPdf ? (
              <>
                <Link href={readFullHref('epub')}>
                  <Button>Read full EPUB</Button>
                </Link>
                <Link href={readFullHref('pdf')}>
                  <Button variant="secondary">Read full PDF</Button>
                </Link>
              </>
            ) : (
              <Link href={readFullHref(hasEpub ? 'epub' : 'pdf')}>
                <Button>Read full book</Button>
              </Link>
            )}
            <Link href="/library">
              <Button variant="ghost">My library</Button>
            </Link>
          </>
        ) : (
          <>
            <Button disabled={loading} onClick={() => goToCheckout('purchase')}>
              Buy now
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => goToCheckout('rental_15')}
            >
              Rent 15 days
            </Button>
            <Button variant="ghost" disabled={loading} onClick={() => goToCheckout('rental_30')}>
              Rent 30 days
            </Button>
          </>
        )}

        {!hasFullAccess && canPreview && hasEpub && hasPdf ? (
          <>
            <Link href={previewHref('epub')}>
              <Button variant="ghost">Read EPUB preview</Button>
            </Link>
            <Link href={previewHref('pdf')}>
              <Button variant="ghost">Read PDF preview</Button>
            </Link>
          </>
        ) : !hasFullAccess && canPreview && hasEpub ? (
          <Link href={previewHref('epub')}>
            <Button variant="ghost">Read preview</Button>
          </Link>
        ) : !hasFullAccess && canPreview && hasPdf ? (
          <Link href={previewHref('pdf')}>
            <Button variant="ghost">Read preview</Button>
          </Link>
        ) : !hasFullAccess ? (
          <Button variant="ghost" disabled title="No file uploaded yet">
            Read preview
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-stone-400">
        {hasFullAccess
          ? 'You have full access to this book.'
          : canPreview
            ? hasEpub && hasPdf
              ? `Preview the first ${previewPages} pages (PDF) or ${epubPreviewPercent}% (EPUB) free.`
              : hasEpub
                ? `Preview the first ${epubPreviewPercent}% free (EPUB).`
                : `Preview the first ${previewPages} pages free.`
            : 'Purchase and rental checkout is available when files are uploaded.'}
        {!memberDiscountActive && user && (
          <>
            {' '}
            <Link href="/subscription" className="text-amber-700 hover:underline dark:text-amber-400">
              Go ad-free
            </Link>{' '}
            to save on purchases.
          </>
        )}
      </p>
    </>
  );
}
