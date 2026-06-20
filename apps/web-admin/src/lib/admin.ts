import type { AdminBook, BookStatus, PaginatedResponse, PlatformCommerceSettings, Settlement, SubscriptionPlan } from '@easybookshelf/shared-types';
import { getAccessToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
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

export async function fetchAdminBooks(params?: {
  page?: number;
  pageSize?: number;
  status?: BookStatus;
  search?: string;
}): Promise<PaginatedResponse<AdminBook>> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);

  const qs = query.toString();
  const res = await authFetch(`/admin/books${qs ? `?${qs}` : ''}`);
  return res.json() as Promise<PaginatedResponse<AdminBook>>;
}

export async function fetchAdminBook(id: string): Promise<AdminBook> {
  const res = await authFetch(`/admin/books/${id}`);
  return res.json() as Promise<AdminBook>;
}

export async function approveAdminBook(id: string): Promise<AdminBook> {
  const res = await authFetch(`/admin/books/${id}/approve`, { method: 'POST' });
  return res.json() as Promise<AdminBook>;
}

export async function rejectAdminBook(id: string, rejectionReason: string): Promise<AdminBook> {
  const res = await authFetch(`/admin/books/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason }),
  });
  return res.json() as Promise<AdminBook>;
}

export interface AdminSubscriptionPlan extends SubscriptionPlan {
  razorpayPlanId: string | null;
  createdAt: string;
}

export async function fetchAdminSubscriptionPlans(): Promise<AdminSubscriptionPlan[]> {
  const res = await authFetch('/admin/subscription-plans');
  return res.json() as Promise<AdminSubscriptionPlan[]>;
}

export async function updateAdminSubscriptionPlan(
  id: string,
  input: { name?: string; price?: number; active?: boolean },
): Promise<AdminSubscriptionPlan> {
  const res = await authFetch(`/admin/subscription-plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<AdminSubscriptionPlan>;
}

export async function fetchCommerceSettings(): Promise<PlatformCommerceSettings> {
  const res = await authFetch('/admin/commerce-settings');
  return res.json() as Promise<PlatformCommerceSettings>;
}

export async function updateCommerceSettings(
  input: Partial<PlatformCommerceSettings>,
): Promise<PlatformCommerceSettings> {
  const res = await authFetch('/admin/commerce-settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<PlatformCommerceSettings>;
}

export async function fetchAdminSettlements(): Promise<Settlement[]> {
  const res = await authFetch('/admin/settlements');
  return res.json() as Promise<Settlement[]>;
}

export async function generateAdminSettlements(input: {
  periodStart: string;
  periodEnd: string;
  publisherId?: string;
}): Promise<{ created: Settlement[]; count: number; message?: string }> {
  const res = await authFetch('/admin/settlements/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<{ created: Settlement[]; count: number; message?: string }>;
}

export async function markSettlementPaid(id: string): Promise<Settlement> {
  const res = await authFetch(`/admin/settlements/${id}/mark-paid`, { method: 'POST' });
  return res.json() as Promise<Settlement>;
}
