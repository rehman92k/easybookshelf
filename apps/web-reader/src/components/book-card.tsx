import Image from 'next/image';
import Link from 'next/link';
import type { BookListItem } from '@easybookshelf/shared-types';
import { formatPrice } from '@/lib/catalog';

interface BookCardProps {
  book: BookListItem;
}

export function BookCard({ book }: BookCardProps) {
  return (
    <Link
      href={`/books/${book.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white transition hover:border-amber-300 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:hover:border-amber-600"
    >
      <div className="relative aspect-[2/3] bg-stone-100 dark:bg-stone-800">
        {book.coverImageUrl ? (
          <Image
            src={book.coverImageUrl}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-stone-400">
            {book.title}
          </div>
        )}
        {book.featured && (
          <span className="absolute left-2 top-2 rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-serif font-semibold leading-snug group-hover:text-amber-800 dark:group-hover:text-amber-400">
          {book.title}
        </h3>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{book.authorName}</p>
        {book.prices && (
          <p className="mt-auto pt-3 text-sm font-medium text-stone-800 dark:text-stone-200">
            {formatPrice(book.prices.purchasePrice, book.prices.currency)}
          </p>
        )}
      </div>
    </Link>
  );
}
