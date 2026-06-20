'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { LibraryItem } from '@easybookshelf/shared-types';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
} from '@easybookshelf/ui';
import { AdBanner } from '@/components/ad-banner';
import { SiteLayout } from '@/components/site-layout';
import { useAuth } from '@/components/auth-provider';
import { fetchLibrary } from '@/lib/commerce';

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
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
        const data = await fetchLibrary();
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load library');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  return (
    <SiteLayout>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <PageHeader
          title="My library"
          description="Books you own or are currently renting."
        />

        {authLoading || loading ? (
          <PageLoading message="Loading your library…" />
        ) : !user ? (
          <EmptyState
            title="Sign in to view your library"
            action={
              <Link href="/login?next=/library">
                <Button>Sign in</Button>
              </Link>
            }
          />
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title="No books yet"
            description="Purchase or rent a book to add it to your library."
            action={
              <Link href="/books">
                <Button variant="secondary">Browse books</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.entitlement.id} padding="sm" className="flex gap-4">
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
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
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    {item.entitlement.type === 'purchase' ? 'Owned' : 'Rental'}
                  </p>
                  <h2 className="truncate font-serif font-semibold">{item.book.title}</h2>
                  <p className="truncate text-sm text-stone-500">{item.book.authorName}</p>
                  {item.entitlement.expiresAt && (
                    <p className="mt-1 text-xs text-stone-400">
                      Expires {new Date(item.entitlement.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                  {item.progressPercent !== null && item.progressPercent > 0 && (
                    <p className="mt-1 text-xs text-stone-400">{item.progressPercent}% read</p>
                  )}
                  <Link
                    href={`/books/${item.book.slug}/read?mode=full`}
                    className="mt-3 inline-block"
                  >
                    <Button className="px-3 py-1.5 text-xs">
                      {item.progressPercent ? 'Continue' : 'Read'}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10">
          <AdBanner placement="library" />
        </div>
      </main>
    </SiteLayout>
  );
}
