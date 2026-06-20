import Link from 'next/link';
import { Button } from '@easybookshelf/ui';

interface PreviewEndBarProps {
  slug: string;
  message: string;
}

export function PreviewEndBar({ slug, message }: PreviewEndBarProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border-t border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:justify-between dark:border-amber-700 dark:bg-amber-950/50">
      <p className="text-center text-sm text-amber-900 dark:text-amber-100 sm:text-left">{message}</p>
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
        <Link href={`/books/${slug}/checkout?type=purchase`}>
          <Button className="px-3 py-1.5 text-xs">Buy now</Button>
        </Link>
        <Link href={`/books/${slug}/checkout?type=rental_15`}>
          <Button variant="secondary" className="px-3 py-1.5 text-xs">
            Rent
          </Button>
        </Link>
      </div>
    </div>
  );
}
