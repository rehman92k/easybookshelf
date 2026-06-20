import type {
  BookDetail,
  BookListItem,
  Category,
  Language,
  PaginatedResponse,
} from '@easybookshelf/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export interface ListBooksParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  language?: string;
  featured?: boolean;
}

export async function fetchBooks(
  params: ListBooksParams = {},
): Promise<PaginatedResponse<BookListItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.language) query.set('language', params.language);
  if (params.featured) query.set('featured', 'true');

  const res = await fetch(`${API_URL}/books?${query.toString()}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error('Failed to load books');
  }

  return res.json() as Promise<PaginatedResponse<BookListItem>>;
}

export async function searchBooks(
  params: Omit<ListBooksParams, 'featured'> & { q: string },
): Promise<PaginatedResponse<BookListItem>> {
  const query = new URLSearchParams();
  query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.category) query.set('category', params.category);
  if (params.language) query.set('language', params.language);

  const res = await fetch(`${API_URL}/search/books?${query.toString()}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error('Failed to search books');
  }

  return res.json() as Promise<PaginatedResponse<BookListItem>>;
}

export async function fetchBook(slug: string): Promise<BookDetail> {
  const res = await fetch(`${API_URL}/books/${slug}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error('Book not found');
  }

  return res.json() as Promise<BookDetail>;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/catalog/categories`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error('Failed to load categories');
  }

  const data = (await res.json()) as { data: Category[] };
  return data.data;
}

export async function fetchLanguages(): Promise<Language[]> {
  const res = await fetch(`${API_URL}/catalog/languages`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error('Failed to load languages');
  }

  const data = (await res.json()) as { data: Language[] };
  return data.data;
}

export function formatPrice(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
