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

export interface CheckoutSelection {
  type: OrderItemType;
  rentalDays?: number;
}

export function parseCheckoutSelection(
  typeParam: string | null,
  daysParam: string | null,
): CheckoutSelection {
  if (typeParam === 'rental') {
    const rentalDays = Number(daysParam);
    if (!Number.isInteger(rentalDays) || rentalDays < 1) {
      return { type: 'purchase' };
    }
    return { type: 'rental', rentalDays };
  }
  if (typeParam === 'rental_15') return { type: 'rental_15' };
  if (typeParam === 'rental_30') return { type: 'rental_30' };
  return { type: 'purchase' };
}

export function checkoutQuery(selection: CheckoutSelection): string {
  if (selection.type === 'rental' && selection.rentalDays) {
    return `type=rental&days=${selection.rentalDays}`;
  }
  return `type=${selection.type}`;
}

export async function createOrder(input: {
  bookSlug: string;
  type: OrderItemType;
  rentalDays?: number;
}): Promise<OrderSummary> {
  const res = await commerceFetch('/commerce/orders', {
    method: 'POST',
    body: JSON.stringify({
      bookSlug: input.bookSlug,
      type: input.type,
      ...(input.rentalDays != null ? { rentalDays: input.rentalDays } : {}),
    }),
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
  selection: CheckoutSelection,
): Promise<BookPricingQuote> {
  const query =
    selection.type === 'rental' && selection.rentalDays
      ? `type=rental&days=${selection.rentalDays}`
      : `type=${selection.type}`;
  const res = await commerceFetch(
    `/commerce/books/by-slug/${encodeURIComponent(bookSlug)}/quote?${query}`,
  );
  return res.json() as Promise<BookPricingQuote>;
}

export function orderTypeLabel(type: OrderItemType, rentalDays?: number | null): string {
  switch (type) {
    case 'purchase':
      return 'Buy';
    case 'rental':
      return rentalDays ? `${rentalDays}-day rent` : 'Rent';
    case 'rental_15':
      return '15-day rent';
    case 'rental_30':
      return '30-day rent';
  }
}
