'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReadingHistoryItem } from '@easybookshelf/shared-types';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
} from '@easybookshelf/ui';
import { SiteLayout } from '@/components/site-layout';
import { useAuth } from '@/components/auth-provider';
import { fetchReadingHistory } from '@/lib/reading';

export default function ReadingHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ReadingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const data = await fetchReadingHistory();
        setItems(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load reading history');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  return (
    <SiteLayout>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Reading history"
          description="Books you have opened recently, with your last position."
        />

        {authLoading || loading ? (
          <PageLoading message="Loading history…" />
        ) : !user ? (
          <EmptyState
            title="Sign in to see your history"
            action={
              <Link href="/login?next=/history">
                <Button>Sign in</Button>
              </Link>
            }
          />
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title="No reading history yet"
            action={
              <Link href="/books">
                <Button variant="secondary">Browse books</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={`${item.bookId}-${item.lastReadAt}`} padding="sm" className="flex gap-4">
                <Link
                  href={`/books/${item.book.slug}/read?format=${item.format}`}
                  className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800"
                >
                  {item.book.coverImageUrl ? (
                    <Image
                      src={item.book.coverImageUrl}
                      alt={item.book.title}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-1 text-center text-xs text-stone-400">
                      {item.book.title}
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-stone-400">
                    {item.format.toUpperCase()} · {item.progressPercent}%
                  </p>
                  <Link
                    href={`/books/${item.book.slug}`}
                    className="mt-1 block truncate font-serif font-semibold hover:underline"
                  >
                    {item.book.title}
                  </Link>
                  <p className="truncate text-sm text-stone-500">{item.book.authorName}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    {new Date(item.lastReadAt).toLocaleString()}
                  </p>
                  <Link
                    href={`/books/${item.book.slug}/read?format=${item.format}`}
                    className="mt-3 inline-block"
                  >
                    <Button className="px-3 py-1.5 text-xs">Continue</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
