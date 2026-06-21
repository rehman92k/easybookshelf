import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';
import { AdBanner } from '@/components/ad-banner';
import { BookCard } from '@/components/book-card';
import { fetchBooks, fetchCategories, fetchLanguages } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

interface BooksPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    category?: string;
    language?: string;
  }>;
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  const page = params.page ? Number(params.page) : 1;
  const search = params.search ?? '';
  const category = params.category ?? '';
  const language = params.language ?? '';

  const [booksResult, categories, languages] = await Promise.all([
    fetchBooks({
      page,
      pageSize: 12,
      search: search || undefined,
      category: category || undefined,
      language: language || undefined,
    }),
    fetchCategories(),
    fetchLanguages(),
  ]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold">Browse books</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-400">
            Discover books in every language. Buy or rent for 15 or 30 days.
          </p>
        </div>

        <form className="mb-8 flex flex-wrap gap-3" action="/books" method="get">
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Search by title or author..."
            className="min-w-[200px] flex-1 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
          />
          <select
            name="category"
            defaultValue={category}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="language"
            defaultValue={language}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
          >
            <option value="">All languages</option>
            {languages.map((l) => (
              <option key={l.id} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-amber-700 px-5 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            Search
          </button>
        </form>

        <div className="mb-8">
          <AdBanner />
        </div>

        {booksResult.data.length === 0 ? (
          <p className="text-stone-500">No books found. Try adjusting your filters.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {booksResult.data.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}

        {booksResult.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            {page > 1 && (
              <Link
                href={{
                  pathname: '/books',
                  query: {
                    ...(search && { search }),
                    ...(category && { category }),
                    ...(language && { language }),
                    page: page - 1,
                  },
                }}
                className="text-sm text-amber-700 hover:underline dark:text-amber-400"
              >
                Previous
              </Link>
            )}
            <span className="text-sm text-stone-500">
              Page {page} of {booksResult.totalPages}
            </span>
            {page < booksResult.totalPages && (
              <Link
                href={{
                  pathname: '/books',
                  query: {
                    ...(search && { search }),
                    ...(category && { category }),
                    ...(language && { language }),
                    page: page + 1,
                  },
                }}
                className="text-sm text-amber-700 hover:underline dark:text-amber-400"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
