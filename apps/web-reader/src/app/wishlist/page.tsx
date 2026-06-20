'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { WishlistItem } from '@easybookshelf/shared-types';
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
import { formatPrice } from '@/lib/catalog';
import { fetchWishlist, removeFromWishlist } from '@/lib/wishlist';

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
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
        setItems(await fetchWishlist());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load wishlist');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  async function handleRemove(slug: string) {
    try {
      await removeFromWishlist(slug);
      setItems((prev) => prev.filter((item) => item.book.slug !== slug));
    } catch {
      // ignore
    }
  }

  return (
    <SiteLayout>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <PageHeader title="Wishlist" description="Books you want to read later." />

        {authLoading || loading ? (
          <PageLoading message="Loading wishlist…" />
        ) : !user ? (
          <EmptyState
            title="Sign in to save books"
            description="Add titles to your wishlist while browsing the catalog."
            action={
              <Link href="/login?next=/wishlist">
                <Button>Sign in</Button>
              </Link>
            }
          />
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title="Your wishlist is empty"
            action={
              <Link href="/books">
                <Button variant="secondary">Browse books</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.book.id} padding="sm" className="flex gap-4">
                <Link
                  href={`/books/${item.book.slug}`}
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
                  <Link href={`/books/${item.book.slug}`} className="font-serif font-semibold hover:underline">
                    {item.book.title}
                  </Link>
                  <p className="truncate text-sm text-stone-500">{item.book.authorName}</p>
                  {item.book.prices && (
                    <p className="mt-1 text-sm font-medium">
                      {formatPrice(item.book.prices.purchasePrice, item.book.prices.currency)}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/books/${item.book.slug}`}>
                      <Button className="px-3 py-1.5 text-xs">View</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => void handleRemove(item.book.slug)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
