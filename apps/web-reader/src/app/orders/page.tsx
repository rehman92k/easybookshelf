'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OrderSummary } from '@easybookshelf/shared-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
} from '@easybookshelf/ui';
import { SiteLayout } from '@/components/site-layout';
import { useAuth } from '@/components/auth-provider';
import { fetchOrders, orderTypeLabel } from '@/lib/commerce';
import { formatPrice } from '@/lib/catalog';

function statusBadgeVariant(status: OrderSummary['status']) {
  switch (status) {
    case 'paid':
      return 'success' as const;
    case 'pending':
      return 'warning' as const;
    case 'failed':
      return 'danger' as const;
    default:
      return 'muted' as const;
  }
}

function statusLabel(status: OrderSummary['status']) {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
  }
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
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
        const data = await fetchOrders();
        setOrders(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  return (
    <SiteLayout>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Order history"
          description="Purchases and rentals on your account."
        />

        {authLoading || loading ? (
          <PageLoading message="Loading orders…" />
        ) : !user ? (
          <EmptyState
            title="Sign in to view orders"
            action={
              <Link href="/login?next=/orders">
                <Button>Sign in</Button>
              </Link>
            }
          />
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            action={
              <Link href="/books">
                <Button variant="secondary">Browse books</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => {
              const item = order.items[0];
              return (
                <Card key={order.id} padding="sm" className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-stone-400">
                        {order.orderNumber}
                      </p>
                      <h2 className="mt-1 font-serif text-lg font-semibold">
                        {item?.bookTitle ?? 'Book order'}
                      </h2>
                      {item && (
                        <p className="mt-1 text-sm text-stone-500">
                          {orderTypeLabel(item.type)} ·{' '}
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPrice(order.totalAmount, order.currency)}
                      </p>
                      <Badge variant={statusBadgeVariant(order.status)} className="mt-2">
                        {statusLabel(order.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {order.status === 'paid' && item && (
                      <Link href={`/books/${item.bookSlug}/read?mode=full`}>
                        <Button className="px-3 py-1.5 text-xs">Read book</Button>
                      </Link>
                    )}
                    {order.status === 'pending' && item && (
                      <Link
                        href={`/books/${item.bookSlug}/checkout?type=${item.type}&orderId=${order.id}`}
                      >
                        <Button variant="secondary" className="px-3 py-1.5 text-xs">
                          Complete payment
                        </Button>
                      </Link>
                    )}
                    {item && (
                      <Link href={`/books/${item.bookSlug}`}>
                        <Button variant="ghost" className="px-3 py-1.5 text-xs">
                          Book details
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </main>
    </SiteLayout>
  );
}
