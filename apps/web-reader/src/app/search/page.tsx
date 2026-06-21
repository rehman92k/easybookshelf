import Link from 'next/link';
import { AdBanner } from '@/components/ad-banner';
import { SiteHeader } from '@/components/site-header';
import { BookCard } from '@/components/book-card';
import { fetchCategories, fetchLanguages, searchBooks } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    category?: string;
    language?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const page = params.page ? Number(params.page) : 1;
  const category = params.category ?? '';
  const language = params.language ?? '';

  const [results, categories, languages] = await Promise.all([
    q
      ? searchBooks({
          q,
          page,
          pageSize: 12,
          category: category || undefined,
          language: language || undefined,
        })
      : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 12, totalPages: 0 }),
    fetchCategories(),
    fetchLanguages(),
  ]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-semibold">Search</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-400">
            {q ? (
              <>
                Results for <span className="font-medium text-stone-900 dark:text-stone-100">“{q}”</span>
              </>
            ) : (
              'Type a search query in the header.'
            )}
          </p>
        </div>

        <form className="mb-8 flex flex-wrap gap-3" action="/search" method="get">
          <input
            type="search"
            name="q"
            defaultValue={q}
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
          <AdBanner placement="search" />
        </div>

        {!q ? (
          <p className="text-stone-500">Try searching by title or author.</p>
        ) : results.data.length === 0 ? (
          <p className="text-stone-500">No results found.</p>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {results.data.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>

            {results.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-4">
                {page > 1 && (
                  <Link
                    href={{
                      pathname: '/search',
                      query: {
                        q,
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
                  Page {page} of {results.totalPages}
                </span>
                {page < results.totalPages && (
                  <Link
                    href={{
                      pathname: '/search',
                      query: {
                        q,
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
          </>
        )}
      </main>
    </div>
  );
}

