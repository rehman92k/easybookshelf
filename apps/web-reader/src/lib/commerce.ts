import type {
  BookPricingQuote,
  CheckoutSession,
  LibraryItem,
  OrderItemType,
  OrderListResponse,
  OrderSummary,
} from '@easybookshelf/shared-types';
import { getAccessToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function commerceFetch(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('Sign in to continue');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

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

export async function createOrder(input: {
  bookSlug: string;
  type: OrderItemType;
}): Promise<OrderSummary> {
  const res = await commerceFetch('/commerce/orders', {
    method: 'POST',
    body: JSON.stringify({ bookSlug: input.bookSlug, type: input.type }),
  });
  return res.json() as Promise<OrderSummary>;
}

export async function fetchOrder(orderId: string): Promise<OrderSummary> {
  const res = await commerceFetch(`/commerce/orders/${orderId}`);
  return res.json() as Promise<OrderSummary>;
}

export async function prepareCheckout(orderId: string): Promise<CheckoutSession> {
  const res = await commerceFetch(`/commerce/orders/${orderId}/checkout`);
  return res.json() as Promise<CheckoutSession>;
}

export async function mockPayOrder(orderId: string): Promise<OrderSummary> {
  const res = await commerceFetch(`/commerce/orders/${orderId}/mock-pay`, { method: 'POST' });
  return res.json() as Promise<OrderSummary>;
}

export async function verifyPayment(
  orderId: string,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<OrderSummary> {
  const res = await commerceFetch(`/commerce/orders/${orderId}/verify`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<OrderSummary>;
}

export async function fetchLibrary(): Promise<LibraryItem[]> {
  const res = await commerceFetch('/commerce/library');
  return res.json() as Promise<LibraryItem[]>;
}

export async function fetchOrders(page = 1, pageSize = 20) {
  const res = await commerceFetch(`/commerce/orders?page=${page}&pageSize=${pageSize}`);
  return res.json() as Promise<OrderListResponse>;
}

export async function fetchPricingQuote(
  bookSlug: string,
  type: OrderItemType,
): Promise<BookPricingQuote> {
  const res = await commerceFetch(
    `/commerce/books/by-slug/${encodeURIComponent(bookSlug)}/quote?type=${type}`,
  );
  return res.json() as Promise<BookPricingQuote>;
}

export function orderTypeLabel(type: OrderItemType): string {
  switch (type) {
    case 'purchase':
      return 'Buy';
    case 'rental_15':
      return '15-day rent';
    case 'rental_30':
      return '30-day rent';
  }
}
