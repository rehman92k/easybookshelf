'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SubscriptionCheckoutSession, SubscriptionPlan, UserSubscription } from '@easybookshelf/shared-types';
import { Button, Alert, Card, EmptyState, PageHeader, PageLoading } from '@easybookshelf/ui';
import { SiteLayout } from '@/components/site-layout';
import { useAuth } from '@/components/auth-provider';
import { formatPrice } from '@/lib/catalog';
import {
  cancelSubscription,
  fetchSubscriptionPlans,
  fetchSubscriptionStatus,
  mockActivateSubscription,
  planIntervalLabel,
  subscribeToPlan,
  verifySubscriptionPayment,
} from '@/lib/subscriptions';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [adFree, setAdFree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [planList, status] = await Promise.all([
        fetchSubscriptionPlans(),
        user ? fetchSubscriptionStatus() : Promise.resolve({ adFree: false, subscription: null }),
      ]);
      setPlans(planList);
      setSubscription(status.subscription);
      setAdFree(status.adFree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load subscription info');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

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

  async function handleSubscribe(plan: SubscriptionPlan) {
    if (!user) {
      router.push('/login?next=/subscription');
      return;
    }

    setBusyPlanId(plan.id);
    setError(null);
    try {
      const session: SubscriptionCheckoutSession = await subscribeToPlan(plan.id);

      if (session.mockCheckout) {
        if (session.subscription) {
          setSubscription(session.subscription);
          setAdFree(true);
          return;
        }
        const activated = await mockActivateSubscription(plan.id);
        setSubscription(activated);
        setAdFree(true);
        return;
      }

      if (!session.razorpayKeyId || !session.razorpayOrderId) {
        throw new Error('Checkout could not be prepared');
      }

      await loadRazorpayScript();
      const options = {
        key: session.razorpayKeyId,
        amount: Math.round(plan.price * 100),
        currency: plan.currency,
        name: 'EasyBookshelf',
        description: `${plan.name} — Ad-free reading`,
        order_id: session.razorpayOrderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const activated = await verifySubscriptionPayment({
              planId: plan.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setSubscription(activated);
            setAdFree(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed');
          } finally {
            setBusyPlanId(null);
          }
        },
        modal: { ondismiss: () => setBusyPlanId(null) },
        theme: { color: '#b45309' },
      };

      const razorpay = new window.Razorpay!(options);
      razorpay.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
      setBusyPlanId(null);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const updated = await cancelSubscription();
      setSubscription(updated);
      setAdFree(updated.adFree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel subscription');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <SiteLayout>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Ad-free reading"
          description="Subscribe to remove ads across EasyBookshelf. Book purchases are separate."
        />

        {loading ? (
          <PageLoading message="Loading plans…" />
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : null}

        {subscription && adFree ? (
          <Alert variant="success" className="mt-2">
            <p className="font-semibold">You&apos;re ad-free</p>
            <p className="mt-2 text-sm">
              <strong>{subscription.plan.name}</strong> — valid until{' '}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
            {subscription.status === 'cancelled' ? (
              <p className="mt-2 text-sm">
                Cancelled — ad-free access continues until the period ends.
              </p>
            ) : (
              <Button
                variant="ghost"
                className="mt-4"
                disabled={cancelling}
                onClick={() => void handleCancel()}
              >
                {cancelling ? 'Cancelling…' : 'Cancel subscription'}
              </Button>
            )}
          </Alert>
        ) : null}

        {!loading && !adFree ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <h2 className="font-serif text-xl font-semibold">{plan.name}</h2>
                <p className="mt-3 text-3xl font-semibold">
                  {formatPrice(plan.price, plan.currency)}
                  <span className="text-base font-normal text-stone-500">
                    /{planIntervalLabel(plan.interval)}
                  </span>
                </p>
                <ul className="mt-4 space-y-1 text-sm text-stone-600 dark:text-stone-400">
                  <li>No ads while browsing and reading</li>
                  <li>Member discount on book purchases</li>
                  <li>Cancel anytime — access until period ends</li>
                </ul>
                <Button
                  className="mt-6 w-full"
                  disabled={busyPlanId !== null}
                  onClick={() => void handleSubscribe(plan)}
                >
                  {busyPlanId === plan.id ? 'Processing…' : 'Subscribe'}
                </Button>
              </Card>
            ))}
          </div>
        ) : null}

        {!user && !authLoading && !loading ? (
          <EmptyState
            className="mt-8"
            title="Sign in to subscribe"
            action={
              <Link href="/login?next=/subscription">
                <Button>Sign in</Button>
              </Link>
            }
          />
        ) : null}
      </main>
    </SiteLayout>
  );
}
