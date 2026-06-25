'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BookFileFormat, BookPrice, BookPricingQuote, ReadingAccess } from '@easybookshelf/shared-types';
import { Button } from '@easybookshelf/ui';
import { useAuth } from '@/components/auth-provider';
import { formatPrice } from '@/lib/catalog';
import { checkoutQuery, fetchPricingQuote, type CheckoutSelection } from '@/lib/commerce';
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

  const rentals = prices.rentals?.length
    ? prices.rentals
    : [
        { days: 15, price: prices.rental15Price },
        { days: 30, price: prices.rental30Price },
      ];

  useEffect(() => {
    if (!user) {
      setAccess(readingAccess);
      setPurchaseQuote(null);
      return;
    }
    void fetchReadingAccessBySlug(slug)
      .then(setAccess)
      .catch(() => setAccess(readingAccess));
    void fetchPricingQuote(slug, { type: 'purchase' })
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

  function goToCheckout(selection: CheckoutSelection) {
    const query = checkoutQuery(selection);
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/books/${slug}/checkout?${query}`)}`);
      return;
    }
    router.push(`/books/${slug}/checkout?${query}`);
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
        {rentals.map((rental) => (
          <div
            key={rental.days}
            className="rounded-lg border border-stone-200 p-4 dark:border-stone-700"
          >
            <p className="text-sm text-stone-500">{rental.days}-day rent</p>
            <p className="mt-1 text-xl font-semibold">
              {formatPrice(rental.price, prices.currency)}
            </p>
          </div>
        ))}
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
            <Button disabled={loading} onClick={() => goToCheckout({ type: 'purchase' })}>
              Buy now
            </Button>
            {rentals.map((rental, index) => (
              <Button
                key={rental.days}
                variant={index === 0 ? 'secondary' : 'ghost'}
                disabled={loading}
                onClick={() => goToCheckout({ type: 'rental', rentalDays: rental.days })}
              >
                Rent {rental.days} days
              </Button>
            ))}
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
