'use client';

import { useEffect, useState } from 'react';
import type { AdminBook } from '@easybookshelf/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
  inputClassName,
  labelClassName,
} from '@easybookshelf/ui';
import { AdminAuthGate } from '@/components/admin-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { approveAdminBook, fetchAdminBooks, rejectAdminBook } from '@/lib/admin';

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminBooksPage() {
  const { user, loading } = useAuth();
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejectingBook, setRejectingBook] = useState<AdminBook | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const canReview =
    user?.roles.includes('super_admin') || user?.roles.includes('admin_content');

  useEffect(() => {
    if (!loading && user && canReview) {
      void loadBooks();
    }
  }, [loading, user, canReview]);

  async function loadBooks() {
    setFetching(true);
    setError(null);
    try {
      const result = await fetchAdminBooks({ status: 'pending_review', pageSize: 50 });
      setBooks(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load books');
    } finally {
      setFetching(false);
    }
  }

  async function handleApprove(book: AdminBook) {
    setActingOn(book.id);
    setActionError(null);
    try {
      await approveAdminBook(book.id);
      setBooks((current) => current.filter((b) => b.id !== book.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve book');
    } finally {
      setActingOn(null);
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingBook) return;

    setActingOn(rejectingBook.id);
    setActionError(null);
    try {
      await rejectAdminBook(rejectingBook.id, rejectionReason.trim());
      setBooks((current) => current.filter((b) => b.id !== rejectingBook.id));
      setRejectingBook(null);
      setRejectionReason('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject book');
    } finally {
      setActingOn(null);
    }
  }

  return (
    <AdminAuthGate
      loginNext="/books"
      requireRoles={['super_admin', 'admin_content']}
      deniedTitle="No review permissions"
      deniedDescription="Requires super_admin or admin_content role."
    >
      <PageHeader
        title="Book approvals"
        description="Review publisher submissions. Approved books appear in the reader catalog."
      />

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {fetching ? (
        <PageLoading message="Loading pending books…" />
      ) : books.length === 0 ? (
        <EmptyState title="No books pending review" description="Check back when publishers submit new titles." />
      ) : (
        <div className="space-y-4">
          {books.map((book) => (
            <Card key={book.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-semibold">{book.title}</h2>
                  {book.subtitle && <p className="text-sm text-stone-500">{book.subtitle}</p>}
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                    by {book.authorName}
                  </p>
                </div>
                <Badge variant="warning">pending review</Badge>
              </div>

              {book.description && (
                <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">{book.description}</p>
              )}

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-stone-500">Publisher</dt>
                  <dd className="font-medium">{book.publisher.name}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Submitted by</dt>
                  <dd className="font-medium">
                    {book.publisherUser.email ?? book.publisherUser.displayName}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Format</dt>
                  <dd className="font-medium uppercase">{book.format}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Files</dt>
                  <dd className="font-medium">
                    {book.files.length > 0
                      ? book.files
                          .map((f) => `${f.format.toUpperCase()} (${formatBytes(f.fileSizeBytes)})`)
                          .join(', ')
                      : 'none'}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Category</dt>
                  <dd className="font-medium">
                    {book.categories.map((c) => c.name).join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Language</dt>
                  <dd className="font-medium">
                    {book.languages.map((l) => l.name).join(', ') || '—'}
                  </dd>
                </div>
                {book.prices && (
                  <>
                    <div>
                      <dt className="text-stone-500">Buy price</dt>
                      <dd className="font-medium">
                        {formatPrice(book.prices.purchasePrice, book.prices.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Rentals</dt>
                      <dd className="font-medium">
                        {(book.prices.rentals ?? [
                          { days: 15, price: book.prices.rental15Price },
                          { days: 30, price: book.prices.rental30Price },
                        ])
                          .map(
                            (rental) =>
                              `${formatPrice(rental.price, book.prices!.currency)} / ${rental.days}d`,
                          )
                          .join(', ')}
                      </dd>
                    </div>
                  </>
                )}
              </dl>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button disabled={actingOn === book.id} onClick={() => void handleApprove(book)}>
                  {actingOn === book.id ? 'Approving…' : 'Approve'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={actingOn === book.id}
                  onClick={() => {
                    setRejectingBook(book);
                    setRejectionReason('');
                    setActionError(null);
                  }}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {rejectingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="w-full max-w-md">
            <h2 className="font-serif text-lg font-semibold">Reject book</h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              Tell the publisher why &ldquo;{rejectingBook.title}&rdquo; was rejected.
            </p>
            <form onSubmit={handleReject} className="mt-4 space-y-4">
              <div>
                <label htmlFor="rejection-reason" className={labelClassName}>
                  Rejection reason
                </label>
                <textarea
                  id="rejection-reason"
                  required
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRejectingBook(null);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" disabled={actingOn === rejectingBook.id}>
                  {actingOn === rejectingBook.id ? 'Rejecting…' : 'Reject book'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AdminAuthGate>
  );
}
