'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { BookFormat, Category, Language } from '@easybookshelf/shared-types';
import { Button, Alert, Card, PageHeader, PageLoading } from '@easybookshelf/ui';
import { PublisherAuthGate } from '@/components/publisher-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { fetchCurrentUser, refreshAccessTokenFromBearer } from '@/lib/auth';
import {
  createPublisherBook,
  fetchCategories,
  fetchCommerceConfig,
  fetchLanguages,
  fetchPublisherProfile,
  submitBookForReview,
  uploadBookFile,
  uploadBookCover,
} from '@/lib/publisher';

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
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
    if (loading) return;

    let cancelled = false;

    async function init() {
      try {
        const activeUser = user ?? (await fetchCurrentUser());
        if (cancelled) return;

        if (!activeUser) {
          setReady(false);
          return;
        }

        await refreshAccessTokenFromBearer();
        if (cancelled) return;

        let publisherProfile;
        try {
          publisherProfile = await fetchPublisherProfile();
        } catch {
          if (!cancelled) {
            setRedirecting('Complete publisher onboarding first. Redirecting…');
            router.replace('/onboard');
            window.setTimeout(() => {
              window.location.assign('/onboard');
            }, 1500);
          }
          return;
        }

        const [cats, langs, commerce] = await Promise.all([
          fetchCategories(),
          fetchLanguages(),
          fetchCommerceConfig(),
        ]);
        if (cancelled) return;

        setRentalPeriodDays(commerce.rentalPeriodDays);

        setCategories(cats);
        setLanguages(langs);
        if (cats[0]) setCategoryId(cats[0].id);
        if (langs[0]) setLanguageId(langs[0].id);
        setAuthorName(publisherProfile.name);
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : 'Failed to load upload page');
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  async function handleCreateAndUpload(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    let activeBookId = bookId;

    try {
      if (!categoryId || !languageId) {
        throw new Error('Select a category and language before uploading.');
      }

      if (!activeBookId) {
        const book = await createPublisherBook({
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
        activeBookId = book.id;
        setBookId(book.id);
      }

      if (coverFile) {
        await uploadBookCover(activeBookId, coverFile);
      }

      if (format === 'epub' && epubFile) {
        await uploadBookFile(activeBookId, epubFile, 'epub');
      }
      if (format === 'pdf' && pdfFile) {
        await uploadBookFile(activeBookId, pdfFile, 'pdf');
      }

      const submitted = await submitBookForReview(activeBookId);
      setSuccess(`"${submitted.title}" submitted for review.`);
      router.push('/books');
    } catch (err) {
      setError(
        err instanceof Error
          ? activeBookId
            ? `${err.message} Your draft was saved — fix the issue and submit again to continue.`
            : err.message
          : 'Upload failed',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (redirecting) {
    return (
      <PublisherAuthGate loginNext="/upload">
        <PageLoading message={redirecting} />
      </PublisherAuthGate>
    );
  }

  if (initError) {
    return (
      <PublisherAuthGate loginNext="/upload">
        <Alert variant="error">{initError}</Alert>
        <Link href="/" className="mt-4 inline-block text-sm text-amber-700 hover:underline">
          Back to dashboard
        </Link>
      </PublisherAuthGate>
    );
  }

  if (loading || !user || !ready) {
    return (
      <PublisherAuthGate loginNext="/upload">
        <PageLoading message="Preparing upload form…" />
      </PublisherAuthGate>
    );
  }

  return (
    <PublisherAuthGate loginNext="/upload">
      <PageHeader
        title="Upload a book"
        description="Add metadata, upload EPUB/PDF files, and submit for admin approval."
      />

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
      <form onSubmit={handleCreateAndUpload} className="space-y-5">
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
              disabled={categories.length === 0}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:disabled:bg-stone-800"
            >
              {categories.length === 0 ? (
                <option value="">No categories available</option>
              ) : (
                categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
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
              disabled={languages.length === 0}
              className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:disabled:bg-stone-800"
            >
              {languages.length === 0 ? (
                <option value="">No languages available</option>
              ) : (
                languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {(categories.length === 0 || languages.length === 0) && (
          <Alert variant="info">
            Categories and languages are not loaded yet. Ask an admin to run{' '}
            <code className="text-xs">pnpm db:seed:catalog</code> on the production database, then
            refresh this page.
          </Alert>
        )}

        <div>
          <label htmlFor="cover-file" className="text-sm font-medium">
            Cover image <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            id="cover-file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
          <p className="mt-1 text-xs text-stone-500">JPG, PNG, or WebP. Max 5 MB.</p>
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

        {(format === 'epub') && (
          <div>
            <label htmlFor="epub-file" className="text-sm font-medium">
              EPUB file
            </label>
            <input
              id="epub-file"
              required
              type="file"
              accept=".epub,application/epub+zip"
              onChange={(e) => setEpubFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </div>
        )}

        {(format === 'pdf') && (
          <div>
            <label htmlFor="pdf-file" className="text-sm font-medium">
              PDF file
            </label>
            <input
              id="pdf-file"
              required
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm"
            />
          </div>
        )}

        <Button type="submit" disabled={submitting || categories.length === 0 || languages.length === 0}>
          {submitting ? 'Uploading...' : 'Upload and submit for review'}
        </Button>
      </form>

      {bookId && (
        <p className="mt-4 text-xs text-stone-500">Draft book id: {bookId}</p>
      )}
      </Card>
    </PublisherAuthGate>
  );
}
