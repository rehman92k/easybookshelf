import Link from 'next/link';
import { Logo } from '@easybookshelf/ui';

export function PublisherLandingFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <Link href="/">
          <Logo className="text-lg" />
        </Link>
        <p className="text-xs text-stone-400">© {new Date().getFullYear()} EasyBookshelf</p>
      </div>
    </footer>
  );
}
