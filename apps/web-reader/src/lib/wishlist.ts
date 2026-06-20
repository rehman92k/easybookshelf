import type { WishlistItem } from '@easybookshelf/shared-types';
import { getAccessToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function wishlistFetch(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('Sign in to manage your wishlist');

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
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

export async function fetchWishlist(): Promise<WishlistItem[]> {
  const res = await wishlistFetch('/wishlist');
  return res.json() as Promise<WishlistItem[]>;
}

export async function checkWishlist(bookSlug: string): Promise<boolean> {
  const res = await wishlistFetch(`/wishlist/check/${encodeURIComponent(bookSlug)}`);
  const data = (await res.json()) as { saved: boolean };
  return data.saved;
}

export async function addToWishlist(bookSlug: string) {
  const res = await wishlistFetch('/wishlist', {
    method: 'POST',
    body: JSON.stringify({ bookSlug }),
  });
  return res.json() as Promise<{ saved: boolean }>;
}

export async function removeFromWishlist(bookSlug: string) {
  const res = await wishlistFetch(`/wishlist/${encodeURIComponent(bookSlug)}`, {
    method: 'DELETE',
  });
  return res.json() as Promise<{ saved: boolean }>;
}
