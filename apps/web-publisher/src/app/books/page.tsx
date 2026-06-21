'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublisherBook } from '@easybookshelf/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
} from '@easybookshelf/ui';
import { PublisherAuthGate } from '@/components/publisher-auth-gate';
import { useAuth } from '@/components/auth-provider';
import {
  canDeletePublisherBook,
  canEditPublisherBook,
  deletePublisherBook,
  fetchPublisherBooks,
  publisherBookLockMessage,
} from '@/lib/publisher';

export default function PublisherBooksPage() {
  const { user, loading } = useAuth();
  const [books, setBooks] = useState<PublisherBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteBook(book: PublisherBook) {
    if (!canDeletePublisherBook(book)) return;
    if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) return;

    setDeletingId(book.id);
    setError(null);
    try {
      await deletePublisherBook(book.id);
      setBooks((current) => current.filter((b) => b.id !== book.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete book');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    fetchPublisherBooks()
      .then((result) => {
        if (!cancelled) setBooks(result.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load books');
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  return (
    <PublisherAuthGate loginNext="/books">
      {loading || fetching ? (
        <PageLoading message="Loading your books…" />
      ) : (
        <>
          <PageHeader
            title="Your books"
            description="Track draft, review, and approved titles."
            actions={
              <Link href="/upload">
                <Button>Upload book</Button>
              </Link>
            }
          />

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
              <p className="mt-2">
                <Link href="/onboard" className="underline">
                  Complete publisher onboarding
                </Link>
              </p>
            </Alert>
          )}

          {!error && books.length === 0 ? (
            <EmptyState
              title="No books uploaded yet"
              description="Upload your first EPUB or PDF to get started."
              action={
                <Link href="/upload">
                  <Button>Upload book</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {books.map((book) => (
                <Card key={book.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-serif text-lg font-semibold">{book.title}</h2>
                      <p className="text-sm text-stone-500">{book.authorName}</p>
                    </div>
                    <Badge variant="muted">{book.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
                    Files: {book.files.length > 0 ? book.files.map((f) => f.format).join(', ') : 'none'}
                  </p>
                  {canEditPublisherBook(book) ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link href={`/books/${book.id}/edit`}>
                        <Button variant="secondary">Edit</Button>
                      </Link>
                      {canDeletePublisherBook(book) && (
                        <Button
                          variant="ghost"
                          disabled={deletingId === book.id}
                          onClick={() => handleDeleteBook(book)}
                        >
                          {deletingId === book.id ? 'Deleting…' : 'Delete'}
                        </Button>
                      )}
                      {book.status === 'approved' && (
                        <p className="text-xs text-stone-500">
                          Live in store. Edits will send the book back for admin review.
                        </p>
                      )}
                    </div>
                  ) : (
                    publisherBookLockMessage(book.status) && (
                      <p className="mt-3 text-xs text-stone-500">
                        {publisherBookLockMessage(book.status)}
                      </p>
                    )
                  )}
                  {book.rejectionReason && (
                    <Alert variant="error" className="mt-3">
                      Rejected: {book.rejectionReason}
                    </Alert>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </PublisherAuthGate>
  );
}
