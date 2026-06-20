'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { useShowAds } from '@/hooks/use-show-ads';

export function AdFreeBanner() {
  const { user, loading: authLoading } = useAuth();
  const { showAds, loading: adsLoading } = useShowAds();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authLoading && !adsLoading) setReady(true);
  }, [authLoading, adsLoading]);

  if (!ready || !user || !showAds) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
        <p className="text-amber-900 dark:text-amber-100">
          Read without ads — ad-free from ₹30/month.
        </p>
        <Link
          href="/subscription"
          className="font-medium text-amber-800 underline hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
        >
          Go ad-free
        </Link>
      </div>
    </div>
  );
}
