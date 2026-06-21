import Link from 'next/link';
import { Button, Card } from '@easybookshelf/ui';
import { AdBanner } from '@/components/ad-banner';
import { SiteLayout } from '@/components/site-layout';
import { BookCard } from '@/components/book-card';
import { fetchBooks } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const featured = await fetchBooks({ featured: true, pageSize: 4 }).catch(() => null);

  return (
    <SiteLayout>
      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-amber-700 dark:text-amber-400">
            Digital Reading Platform
          </p>
          <h1 className="mx-auto max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Your bookshelf, everywhere you read
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-stone-600 dark:text-stone-400">
            Discover books in every language. Purchase permanently or rent for 15 or 30 days.
            Sync your reading progress across devices.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/books">
              <Button className="px-6 py-3 text-base">Explore books</Button>
            </Link>
            <Link href="/library">
              <Button variant="secondary" className="px-6 py-3 text-base">
                Go to library
              </Button>
            </Link>
          </div>
        </section>

        {featured && featured.data.length > 0 && (
          <section className="border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
              <div className="mb-8 flex items-end justify-between">
                <h2 className="font-serif text-2xl font-semibold">Featured books</h2>
                <Link
                  href="/books"
                  className="text-sm text-amber-700 hover:underline dark:text-amber-400"
                >
                  View all
                </Link>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
                {featured.data.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-3 sm:px-6">
            {[
              {
                title: 'Buy or rent',
                description: 'Own books forever or rent for 15/30 days with clear expiry rules.',
              },
              {
                title: 'Read securely',
                description: 'Protected reading experience with progress sync and annotations.',
              },
              {
                title: 'All languages',
                description: 'Browse and read books published in any language.',
              },
            ].map((feature) => (
              <Card key={feature.title} padding="lg">
                <h2 className="font-serif text-xl font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-950">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <AdBanner placement="home" />
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
