import type {
  SubscriptionCheckoutSession,
  SubscriptionPlan,
  SubscriptionStatusResponse,
  UserSubscription,
} from '@easybookshelf/shared-types';
import { getAccessToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function subscriptionFetch(path: string, init: RequestInit = {}, auth = true) {
  const headers = new Headers(init.headers);
  if (auth) {
    const token = getAccessToken();
    if (!token) throw new Error('Sign in to manage your subscription');
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? body.error?.message ?? 'Request failed');
  }

  return res;
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const res = await subscriptionFetch('/subscriptions/plans', {}, false);
  return res.json() as Promise<SubscriptionPlan[]>;
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
  const res = await subscriptionFetch('/subscriptions/me');
  return res.json() as Promise<SubscriptionStatusResponse>;
}

export async function subscribeToPlan(planId: string): Promise<SubscriptionCheckoutSession> {
  const res = await subscriptionFetch('/subscriptions/subscribe', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
  return res.json() as Promise<SubscriptionCheckoutSession>;
}

export async function mockActivateSubscription(planId: string): Promise<UserSubscription> {
  const res = await subscriptionFetch('/subscriptions/mock-activate', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  });
  return res.json() as Promise<UserSubscription>;
}

export async function verifySubscriptionPayment(input: {
  planId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<UserSubscription> {
  const res = await subscriptionFetch('/subscriptions/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<UserSubscription>;
}

export async function cancelSubscription(): Promise<UserSubscription> {
  const res = await subscriptionFetch('/subscriptions/cancel', { method: 'POST' });
  return res.json() as Promise<UserSubscription>;
}

export function planIntervalLabel(interval: SubscriptionPlan['interval']): string {
  return interval === 'monthly' ? 'month' : 'year';
}
