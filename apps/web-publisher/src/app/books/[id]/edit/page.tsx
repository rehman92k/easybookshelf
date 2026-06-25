'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { BookFormat, Category, Language, PublisherBook } from '@easybookshelf/shared-types';
import { Button, Alert, Card, PageHeader, PageLoading } from '@easybookshelf/ui';
import { PublisherAuthGate } from '@/components/publisher-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { fetchCurrentUser, refreshAccessTokenFromBearer } from '@/lib/auth';
import {
  canEditPublisherBook,
  fetchCategories,
  fetchCommerceConfig,
  fetchLanguages,
  fetchPublisherBook,
  submitBookForReview,
  updatePublisherBook,
  uploadBookCover,
  uploadBookFile,
} from '@/lib/publisher';

export default function EditBookPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookId = params.id;
  const { user, loading } = useAuth();

  const [book, setBook] = useState<PublisherBook | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isbn, setIsbn] = useState('');
  const [format, setFormat] = useState<BookFormat>('epub');
  const [categoryId, setCategoryId] = useState('');
  const [languageId, setLanguageId] = useState('');
  const [purchase, setPurchase] = useState('299');
  const [rentalPeriodDays, setRentalPeriodDays] = useState<[number, number]>([15, 30]);
  const [rentalPrices, setRentalPrices] = useState<[string, string]>(['49', '79']);
  const [epubFile, setEpubFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  useEffect(() => {
    if (loading || !bookId) return;

    let cancelled = false;

    async function init() {
      try {
        const activeUser = user ?? (await fetchCurrentUser());
        if (cancelled) return;
        if (!activeUser) return;

        await refreshAccessTokenFromBearer();
        if (cancelled) return;

        const [loadedBook, cats, langs, commerce] = await Promise.all([
          fetchPublisherBook(bookId),
          fetchCategories(),
          fetchLanguages(),
          fetchCommerceConfig(),
        ]);
        if (cancelled) return;

        setRentalPeriodDays(commerce.rentalPeriodDays);

        if (!canEditPublisherBook(loadedBook)) {
          setInitError(
            'This book is awaiting admin review and cannot be edited until it is approved or rejected.',
          );
          return;
        }

        setBook(loadedBook);
        setCategories(cats);
        setLanguages(langs);
        setTitle(loadedBook.title);
        setSubtitle(loadedBook.subtitle ?? '');
        setDescription(loadedBook.description ?? '');
        setAuthorName(loadedBook.authorName);
        setIsbn(loadedBook.isbn ?? '');
        setFormat(loadedBook.format === 'both' ? 'epub' : loadedBook.format);
        setCategoryId(loadedBook.categories[0]?.id ?? cats[0]?.id ?? '');
        setLanguageId(loadedBook.languages[0]?.id ?? langs[0]?.id ?? '');
        if (loadedBook.prices) {
          setPurchase(String(loadedBook.prices.purchasePrice));
          const rentals = loadedBook.prices.rentals ?? [
            { days: commerce.rentalPeriodDays[0], price: loadedBook.prices.rental15Price },
            { days: commerce.rentalPeriodDays[1], price: loadedBook.prices.rental30Price },
          ];
          setRentalPrices([
            String(rentals[0]?.price ?? '49'),
            String(rentals[1]?.price ?? '79'),
          ]);
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : 'Failed to load book');
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [loading, user, bookId]);

  async function saveChanges(submitAfterSave = false) {
    if (!book) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!categoryId || !languageId) {
        throw new Error('Select a category and language.');
      }

      await updatePublisherBook(book.id, {
        title,
        subtitle: subtitle || undefined,
        description: description || undefined,
        authorName,
        isbn: isbn || undefined,
        format,
        categoryIds: [categoryId],
        languageIds: [languageId],
        prices: {
          purchase: Number(purchase),
          rentals: [
            { days: rentalPeriodDays[0], price: Number(rentalPrices[0]) },
            { days: rentalPeriodDays[1], price: Number(rentalPrices[1]) },
          ],
        },
      });

      if (coverFile) {
        await uploadBookCover(book.id, coverFile);
      }

      if (format === 'epub' && epubFile) {
        await uploadBookFile(book.id, epubFile, 'epub');
      }
      if (format === 'pdf' && pdfFile) {
        await uploadBookFile(book.id, pdfFile, 'pdf');
      }

      if (submitAfterSave) {
        const submitted = await submitBookForReview(book.id);
        setSuccess(`"${submitted.title}" submitted for review.`);
        router.push('/books');
        return;
      }

      const refreshed = await fetchPublisherBook(book.id);
      setBook(refreshed);
      setSuccess('Changes saved.');
      setCoverFile(null);
      setEpubFile(null);
      setPdfFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  }

  if (initError) {
    return (
      <PublisherAuthGate loginNext={`/books/${bookId}/edit`}>
        <Alert variant="error">{initError}</Alert>
        <Link href="/books" className="mt-4 inline-block text-sm text-amber-700 hover:underline">
          Back to your books
        </Link>
      </PublisherAuthGate>
    );
  }

  if (loading || !user || !ready || !book) {
    return (
      <PublisherAuthGate loginNext={`/books/${bookId}/edit`}>
        <PageLoading message="Loading book…" />
      </PublisherAuthGate>
    );
  }

  const hasEpub = book.files.some((f) => f.format === 'epub');
  const hasPdf = book.files.some((f) => f.format === 'pdf');
  const canSubmit =
    (format === 'epub' && (hasEpub || epubFile)) ||
    (format === 'pdf' && (hasPdf || pdfFile));

  return (
    <PublisherAuthGate loginNext={`/books/${bookId}/edit`}>
      <PageHeader
        title="Edit book"
        description="Update details, replace files, or submit for admin review."
        actions={
          <Link href="/books">
            <Button variant="secondary">Back to books</Button>
          </Link>
        }
      />

      {book.rejectionReason && (
        <Alert variant="error" className="mb-4">
          Rejected: {book.rejectionReason}
        </Alert>
      )}

      {book.status === 'approved' && (
        <Alert variant="info" className="mb-4">
          This book is live in the store. Saving changes will remove it from the store until an admin
          approves the update.
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-4">
          {success}
        </Alert>
      )}

      <Card className="max-w-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveChanges(false);
          }}
          className="space-y-5"
        >
          <div>
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <div>
            <label htmlFor="subtitle" className="text-sm font-medium">
              Subtitle <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input
              id="subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <div>
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <div>
            <label htmlFor="publisher-name" className="text-sm font-medium">
              Publisher name
            </label>
            <input
              id="publisher-name"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <div>
            <label htmlFor="isbn" className="text-sm font-medium">
              ISBN <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input
              id="isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>

          <div>
            <label htmlFor="format" className="text-sm font-medium">
              File format
            </label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as BookFormat)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            >
              <option value="epub">EPUB</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="text-sm font-medium">
                Category
              </label>
              <select
                id="category"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="language" className="text-sm font-medium">
                Language
              </label>
              <select
                id="language"
                required
                value={languageId}
                onChange={(e) => setLanguageId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cover-file" className="text-sm font-medium">
              Cover image
            </label>
            {book.coverImageUrl && !coverFile && (
              <p className="mt-1 text-xs text-stone-500">Current cover is set. Upload a new file to replace it.</p>
            )}
            <input
              id="cover-file"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="purchase-price" className="text-sm font-medium">
                Buy price (₹)
              </label>
              <input
                id="purchase-price"
                required
                type="number"
                min={9}
                value={purchase}
                onChange={(e) => setPurchase(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
            <div>
              <label htmlFor="rental-0" className="text-sm font-medium">
                {rentalPeriodDays[0]}-day rent (₹)
              </label>
              <input
                id="rental-0"
                required
                type="number"
                min={9}
                value={rentalPrices[0]}
                onChange={(e) =>
                  setRentalPrices((prev) => [e.target.value, prev[1]] as [string, string])
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
            <div>
              <label htmlFor="rental-1" className="text-sm font-medium">
                {rentalPeriodDays[1]}-day rent (₹)
              </label>
              <input
                id="rental-1"
                required
                type="number"
                min={9}
                value={rentalPrices[1]}
                onChange={(e) =>
                  setRentalPrices((prev) => [prev[0], e.target.value] as [string, string])
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
            </div>
          </div>

          {format === 'epub' && (
            <div>
              <label htmlFor="epub-file" className="text-sm font-medium">
                EPUB file
              </label>
              {hasEpub && !epubFile && (
                <p className="mt-1 text-xs text-stone-500">EPUB already uploaded. Choose a file to replace it.</p>
              )}
              <input
                id="epub-file"
                type="file"
                accept=".epub,application/epub+zip"
                onChange={(e) => setEpubFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm"
              />
            </div>
          )}

          {format === 'pdf' && (
            <div>
              <label htmlFor="pdf-file" className="text-sm font-medium">
                PDF file
              </label>
              {hasPdf && !pdfFile && (
                <p className="mt-1 text-xs text-stone-500">PDF already uploaded. Choose a file to replace it.</p>
              )}
              <input
                id="pdf-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting || !canSubmit}
              onClick={() => void saveChanges(true)}
            >
              {submitting ? 'Submitting…' : 'Save and submit for review'}
            </Button>
          </div>
        </form>
      </Card>
    </PublisherAuthGate>
  );
}
