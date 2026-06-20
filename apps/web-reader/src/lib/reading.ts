import type { BookFileFormat, ReadingAccess, ReadingHistoryResponse, ReadingProgressRecord } from '@easybookshelf/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function getToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('easybookshelf_access_token');
}

async function authFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
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

export async function fetchReadingAccessBySlug(slug: string): Promise<ReadingAccess> {
  const res = await authFetch(`/reading/books/by-slug/${slug}/access`);
  return res.json() as Promise<ReadingAccess>;
}

export async function fetchBookFileBuffer(
  bookId: string,
  format: BookFileFormat,
  mode: 'preview' | 'full',
): Promise<ArrayBuffer> {
  const res = await authFetch(`/reading/books/${bookId}/files/${format}?mode=${mode}`);
  return res.arrayBuffer();
}

export function getBookFileUrl(bookId: string, format: BookFileFormat, mode: 'preview' | 'full') {
  return `${API_URL}/reading/books/${bookId}/files/${format}?mode=${mode}`;
}

export async function fetchReadingProgress(bookId: string): Promise<ReadingProgressRecord | null> {
  const res = await authFetch(`/reading/books/${bookId}/progress`);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text) as ReadingProgressRecord;
}

export async function saveReadingProgress(
  bookId: string,
  input: {
    format: BookFileFormat;
    position: Record<string, unknown>;
    progressPercent: number;
  },
): Promise<ReadingProgressRecord> {
  const res = await authFetch(`/reading/books/${bookId}/progress`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return res.json() as Promise<ReadingProgressRecord>;
}

export async function fetchReadingHistory(page = 1, pageSize = 20) {
  const res = await authFetch(`/reading/history?page=${page}&pageSize=${pageSize}`);
  return res.json() as Promise<ReadingHistoryResponse>;
}
