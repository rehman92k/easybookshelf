import Link from 'next/link';
import { Logo } from '@easybookshelf/ui';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <Link href="/">
          <Logo className="text-lg" />
        </Link>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-stone-500">
          <Link href="/books" className="hover:text-stone-900 dark:hover:text-stone-200">
            Browse
          </Link>
          <Link href="/library" className="hover:text-stone-900 dark:hover:text-stone-200">
            Library
          </Link>
          <Link href="/subscription" className="hover:text-stone-900 dark:hover:text-stone-200">
            Ad-free
          </Link>
        </nav>
        <p className="text-xs text-stone-400">
          © {new Date().getFullYear()} EasyBookshelf
        </p>
      </div>
    </footer>
  );
}
