'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BookStatus, PublisherEarnings, PublisherBook } from '@easybookshelf/shared-types';
import { Badge, Button, Card, PageHeader, PageLoading, StatCard } from '@easybookshelf/ui';
import { PublisherShell } from '@/components/publisher-shell';
import {
  emptyStatusCounts,
  PublisherDashboardCharts,
} from '@/components/publisher-dashboard-charts';
import { useAuth } from '@/components/auth-provider';
import { PublisherLandingPage } from '@/components/publisher-landing-page';
import { fetchPublisherBooks, fetchPublisherEarnings } from '@/lib/publisher';

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

function countBooksByStatus(books: PublisherBook[]): Record<BookStatus, number> {
  const counts = emptyStatusCounts();
  for (const book of books) {
    counts[book.status] += 1;
  }
  return counts;
}

export default function PublisherHomePage() {
  const { user, loading } = useAuth();
  const [books, setBooks] = useState<PublisherBook[]>([]);
  const [earnings, setEarnings] = useState<PublisherEarnings | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      try {
        const [booksResult, earningsResult] = await Promise.all([
          fetchPublisherBooks(),
          fetchPublisherEarnings().catch(() => null),
        ]);
        setBooks(booksResult.data);
        setEarnings(earningsResult);
      } catch {
        // ignore
      } finally {
        setFetching(false);
      }
    })();
  }, [user]);

  if (loading || !user) {
    return <PublisherLandingPage />;
  }

  const statusCounts = countBooksByStatus(books);
  const pending = statusCounts.pending_review;
  const approved = statusCounts.approved;
  const totalEarnings = earnings
    ? earnings.unsettledEarnings + earnings.pendingPayout + earnings.totalPaid
    : 0;

  return (
    <PublisherShell>
      <PageHeader
        title="Publisher dashboard"
        description="Overview of your books, reviews, and earnings."
        actions={
          <Link href="/upload">
            <Button>Upload books</Button>
          </Link>
        }
      />

      {fetching ? (
        <PageLoading message="Loading dashboard…" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Books uploaded" value={String(books.length)} />
            <StatCard label="Pending review" value={String(pending)} />
            <StatCard label="Approved" value={String(approved)} />
            <StatCard label="Total earnings" value={formatInr(totalEarnings)} href="/earnings" />
          </div>

          <PublisherDashboardCharts
            statusCounts={statusCounts}
            earnings={earnings}
            orderCount={earnings?.unsettledOrderCount ?? 0}
          />

          <Card className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-lg font-semibold">Recent books</h2>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  Your latest uploads and their review status.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/books">
                  <Button variant="secondary">View all books</Button>
                </Link>
                <Link href="/upload">
                  <Button>Upload book</Button>
                </Link>
              </div>
            </div>

            {books.length === 0 ? (
              <p className="mt-6 text-sm text-stone-500">
                No books yet. Upload your first EPUB or PDF to get started.
              </p>
            ) : (
              <div className="mt-6 divide-y divide-stone-200 dark:divide-stone-700">
                {books.slice(0, 5).map((book) => (
                  <div
                    key={book.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{book.title}</p>
                      <p className="text-sm text-stone-500">{book.authorName}</p>
                    </div>
                    <Badge variant="muted">{book.status.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </PublisherShell>
  );
}
