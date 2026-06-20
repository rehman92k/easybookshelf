'use client';

import Link from 'next/link';
import type { AdPlacement } from '@/lib/ads';
import { hasAdSenseSlot } from '@/lib/ads';
import { AdSenseUnit } from '@/components/adsense-unit';
import { useShowAds } from '@/hooks/use-show-ads';

interface AdBannerProps {
  placement?: AdPlacement;
  className?: string;
}

export function AdBanner({ placement = 'browse', className }: AdBannerProps) {
  const { showAds, loading } = useShowAds();

  if (loading || !showAds) return null;

  if (hasAdSenseSlot(placement)) {
    return (
      <aside className={className} aria-label="Advertisement">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest text-stone-400">
          Advertisement
        </p>
        <AdSenseUnit placement={placement} />
        <p className="mt-2 text-center">
          <Link
            href="/subscription"
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            Go ad-free
          </Link>
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={`rounded-xl border border-dashed border-stone-300 bg-stone-100/80 p-4 text-center dark:border-stone-700 dark:bg-stone-900/50 ${className ?? ''}`}
      aria-label="Advertisement placeholder"
    >
      <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Advertisement</p>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
        Support free reading on EasyBookshelf.
      </p>
      <p className="mt-1 text-xs text-stone-400">
        Configure Google AdSense in <code className="rounded bg-white/60 px-1">.env.local</code> to
        show live ads.
      </p>
      <Link
        href="/subscription"
        className="mt-2 inline-block text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
      >
        Remove ads with Ad-Free →
      </Link>
    </aside>
  );
}
