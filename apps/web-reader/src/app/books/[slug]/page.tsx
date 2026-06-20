import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PurchaseActions } from '@/components/purchase-actions';
import { WishlistButton } from '@/components/wishlist-button';
import { AdBanner } from '@/components/ad-banner';
import { SiteHeader } from '@/components/site-header';
import { fetchBook } from '@/lib/catalog';
import { fetchReadingAccessBySlugServer } from '@/lib/reading-server';

interface BookDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { slug } = await params;

  let book;
  let readingAccess = null;
  try {
    [book, readingAccess] = await Promise.all([
      fetchBook(slug),
      fetchReadingAccessBySlugServer(slug),
    ]);
  } catch {
    notFound();
  }

  const previewPages = readingAccess?.previewPageCount ?? 0;
  const epubPreviewPercent = 10;
  const availableFormats = readingAccess?.formats ?? [];
  const hasEpub = availableFormats.includes('epub');
  const hasPdf = availableFormats.includes('pdf');

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/books"
          className="mb-6 inline-block text-sm text-amber-700 hover:underline dark:text-amber-400"
        >
          ← Back to browse
        </Link>

        <div className="grid gap-10 md:grid-cols-[240px_1fr]">
          <div className="relative mx-auto aspect-[2/3] w-full max-w-[240px] overflow-hidden rounded-xl border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-800">
            {book.coverImageUrl ? (
              <Image
                src={book.coverImageUrl}
                alt={book.title}
                fill
                className="object-cover"
                sizes="240px"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-stone-400">
                {book.title}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-amber-700 dark:text-amber-400">
              {book.categories.map((c) => c.name).join(' · ')}
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">{book.title}</h1>
            <div className="mt-3">
              <WishlistButton bookSlug={slug} />
            </div>
            {book.subtitle && (
              <p className="mt-1 text-lg text-stone-600 dark:text-stone-400">{book.subtitle}</p>
            )}
            <p className="mt-3 text-stone-600 dark:text-stone-400">
              by <span className="font-medium text-stone-900 dark:text-stone-100">{book.authorName}</span>
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Published by {book.publisherName}
            </p>

            {book.languages.length > 0 && (
              <p className="mt-2 text-sm text-stone-500">
                Languages: {book.languages.map((l) => l.nativeName).join(', ')}
              </p>
            )}

            {book.description && (
              <p className="mt-6 leading-relaxed text-stone-700 dark:text-stone-300">
                {book.description}
              </p>
            )}

            {book.prices && (
              <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900">
                <h2 className="font-serif text-lg font-semibold">Pricing</h2>
                <PurchaseActions
                  slug={slug}
                  prices={book.prices}
                  readingAccess={readingAccess}
                  previewPages={previewPages}
                  epubPreviewPercent={epubPreviewPercent}
                  hasEpub={hasEpub}
                  hasPdf={hasPdf}
                />
              </div>
            )}

            <div className="mt-8">
              <AdBanner placement="book_detail" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
