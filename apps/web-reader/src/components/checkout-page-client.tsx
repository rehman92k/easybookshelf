'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CheckoutSession } from '@easybookshelf/shared-types';
import { Button } from '@easybookshelf/ui';
import { SiteHeader } from '@/components/site-header';
import { useAuth } from '@/components/auth-provider';
import {
  checkoutQuery,
  createOrder,
  fetchOrder,
  mockPayOrder,
  orderTypeLabel,
  parseCheckoutSelection,
  prepareCheckout,
  verifyPayment,
} from '@/lib/commerce';
import { formatPrice } from '@/lib/catalog';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface CheckoutPageProps {
  slug: string;
}

export function CheckoutPageClient({ slug }: CheckoutPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const typeParam = searchParams.get('type');
  const daysParam = searchParams.get('days');
  const checkoutSelection = useMemo(
    () => parseCheckoutSelection(typeParam, daysParam),
    [typeParam, daysParam],
  );
  const existingOrderId = searchParams.get('orderId');

  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const checkoutQueryString = checkoutQuery(checkoutSelection);

  const loadCheckout = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const order = existingOrderId
        ? await fetchOrder(existingOrderId)
        : await createOrder({
            bookSlug: slug,
            type: checkoutSelection.type,
            rentalDays: checkoutSelection.rentalDays,
          });
      const checkout = await prepareCheckout(order.id);
      setSession(checkout);
      if (checkout.order.status === 'paid') {
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }, [slug, checkoutSelection, existingOrderId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(
        `/login?next=${encodeURIComponent(`/books/${slug}/checkout?${checkoutQueryString}`)}`,
      );
      return;
    }
    void loadCheckout();
  }, [authLoading, user, router, slug, checkoutQueryString, loadCheckout]);

  async function handleMockPay() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await mockPayOrder(session.order.id);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load Razorpay'));
      document.body.appendChild(script);
    });
  }

  async function handleRazorpayPay() {
    if (!session?.razorpayKeyId || !session.order.payment?.razorpayOrderId) return;

    setBusy(true);
    setError(null);
    try {
      await loadRazorpayScript();
      const item = session.order.items[0];
      const options = {
        key: session.razorpayKeyId,
        amount: Math.round(session.order.totalAmount * 100),
        currency: session.order.currency,
        name: 'EasyBookshelf',
        description: `${orderTypeLabel(item.type, checkoutSelection.rentalDays)} — ${item.bookTitle}`,
        order_id: session.order.payment.razorpayOrderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await verifyPayment(session.order.id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
        theme: { color: '#b45309' },
      };

      const razorpay = new window.Razorpay!(options);
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment');
      setBusy(false);
    }
  }

  const item = session?.order.items[0];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <SiteHeader />

      <main className="mx-auto max-w-lg px-6 py-10">
        <Link
          href={`/books/${slug}`}
          className="mb-6 inline-block text-sm text-amber-700 hover:underline dark:text-amber-400"
        >
          ← Back to book
        </Link>

        <h1 className="font-serif text-3xl font-semibold">Checkout</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          {orderTypeLabel(checkoutSelection.type, checkoutSelection.rentalDays)} · {slug}
        </p>

        {authLoading || (busy && !session && !error) ? (
          <p className="mt-10 text-stone-500">Preparing checkout…</p>
        ) : null}

        {error && (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void loadCheckout()}>
                Try again
              </Button>
            </div>
          </div>
        )}

        {done && item ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/30">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">Payment successful</p>
            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
              You now have access to <strong>{item.bookTitle}</strong>.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/books/${slug}/read?mode=full`}>
                <Button>Start reading</Button>
              </Link>
              <Link href="/library">
                <Button variant="secondary">My library</Button>
              </Link>
            </div>
          </div>
        ) : null}

        {session && item && !done ? (
          <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900">
            <p className="text-sm text-stone-500">Order {session.order.orderNumber}</p>
            <h2 className="mt-2 font-serif text-xl font-semibold">{item.bookTitle}</h2>
            <p className="mt-1 text-stone-600 dark:text-stone-400">
              {orderTypeLabel(item.type, checkoutSelection.rentalDays)}
            </p>
            {item.memberDiscountAmount > 0 ? (
              <div className="mt-4">
                <p className="text-sm text-stone-400 line-through">
                  {formatPrice(item.listUnitPrice, session.order.currency)}
                </p>
                <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400">
                  {formatPrice(session.order.totalAmount, session.order.currency)}
                </p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                  Member discount applied (−
                  {formatPrice(item.memberDiscountAmount, session.order.currency)})
                </p>
              </div>
            ) : (
              <p className="mt-4 text-2xl font-semibold">
                {formatPrice(session.order.totalAmount, session.order.currency)}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {session.mockCheckout ? (
                <Button disabled={busy} onClick={() => void handleMockPay()}>
                  Complete test payment
                </Button>
              ) : (
                <Button disabled={busy} onClick={() => void handleRazorpayPay()}>
                  Pay with Razorpay
                </Button>
              )}
            </div>

            {session.mockCheckout && (
              <p className="mt-3 text-xs text-stone-400">
                Razorpay is not configured — use test payment for local development.
              </p>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
