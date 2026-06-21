import type {
  BookFileFormat,
  BookFormat,
  Category,
  Language,
  PaginatedResponse,
  PublisherBook,
  PublisherEarnings,
  PublisherProfile,
  PublisherType,
  Settlement,
} from '@easybookshelf/shared-types';
import { getAccessToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
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

export async function fetchPublisherProfile(): Promise<PublisherProfile> {
  const res = await authFetch('/publisher/me');
  return res.json() as Promise<PublisherProfile>;
}

export async function updatePublisherProfile(input: {
  name?: string;
  description?: string;
  addressLine?: string;
  state?: string;
  country?: string;
  pincode?: string;
}): Promise<PublisherProfile> {
  const res = await authFetch('/publisher/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<PublisherProfile>;
}

export async function onboardPublisher(input: {
  name: string;
  type: PublisherType;
  slug?: string;
  description?: string;
}): Promise<PublisherProfile> {
  const res = await authFetch('/publisher/onboard', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<PublisherProfile>;
}

export async function fetchPublisherBooks(): Promise<PaginatedResponse<PublisherBook>> {
  const res = await authFetch('/publisher/books');
  return res.json() as Promise<PaginatedResponse<PublisherBook>>;
}

export async function createPublisherBook(input: {
  title: string;
  subtitle?: string;
  description?: string;
  authorName: string;
  isbn?: string;
  format: BookFormat;
  previewPageCount?: number;
  categoryIds: string[];
  languageIds: string[];
  prices: { purchase: number; rental15: number; rental30: number };
}): Promise<PublisherBook> {
  const res = await authFetch('/publisher/books', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<PublisherBook>;
}

export async function uploadBookFile(
  bookId: string,
  file: File,
  format: BookFileFormat,
): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  form.append('format', format);
  await authFetch(`/publisher/books/${bookId}/files`, {
    method: 'POST',
    body: form,
  });
}

export async function uploadBookCover(bookId: string, file: File): Promise<PublisherBook> {
  const form = new FormData();
  form.append('file', file);
  const res = await authFetch(`/publisher/books/${bookId}/cover`, {
    method: 'POST',
    body: form,
  });
  return res.json() as Promise<PublisherBook>;
}

export async function submitBookForReview(bookId: string): Promise<PublisherBook> {
  const res = await authFetch(`/publisher/books/${bookId}/submit`, { method: 'POST' });
  return res.json() as Promise<PublisherBook>;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/catalog/categories`);
  if (!res.ok) throw new Error('Failed to load categories');
  const data = (await res.json()) as { data: Category[] };
  return data.data;
}

export async function fetchLanguages(): Promise<Language[]> {
  const res = await fetch(`${API_URL}/catalog/languages`);
  if (!res.ok) throw new Error('Failed to load languages');
  const data = (await res.json()) as { data: Language[] };
  return data.data;
}

export async function fetchPublisherEarnings(): Promise<PublisherEarnings> {
  const res = await authFetch('/publisher/settlements/earnings');
  return res.json() as Promise<PublisherEarnings>;
}

export async function fetchPublisherSettlements(): Promise<Settlement[]> {
  const res = await authFetch('/publisher/settlements');
  return res.json() as Promise<Settlement[]>;
}
