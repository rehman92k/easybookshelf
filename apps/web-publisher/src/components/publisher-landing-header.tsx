'use client';

import Link from 'next/link';
import { Logo } from '@easybookshelf/ui';
import { getReaderUrl } from '@/lib/urls';

export function PublisherLandingHeader() {
  const readerUrl = getReaderUrl();

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <a
          href={readerUrl}
          className="text-sm text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
        >
          Go to reader site
        </a>
      </div>
    </header>
  );
}
