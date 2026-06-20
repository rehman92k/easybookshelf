import type { ReactNode } from 'react';
import { PublisherLandingFooter } from '@/components/publisher-landing-footer';
import { PublisherLandingHeader } from '@/components/publisher-landing-header';

interface PublisherLandingLayoutProps {
  children: ReactNode;
}

export function PublisherLandingLayout({ children }: PublisherLandingLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <PublisherLandingHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        {children}
      </main>
      <PublisherLandingFooter />
    </div>
  );
}
