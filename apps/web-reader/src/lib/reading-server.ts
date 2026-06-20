const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

import type { ReadingAccess } from '@easybookshelf/shared-types';

export async function fetchReadingAccessBySlugServer(slug: string): Promise<ReadingAccess | null> {
  try {
    const res = await fetch(`${API_URL}/reading/books/by-slug/${slug}/access`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<ReadingAccess>;
  } catch {
    return null;
  }
}
