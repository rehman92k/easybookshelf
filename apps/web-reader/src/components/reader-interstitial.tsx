'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@easybookshelf/ui';
import { AdSenseUnit } from '@/components/adsense-unit';
import { useShowAds } from '@/hooks/use-show-ads';
import {
  getReaderAdDismissSeconds,
  getReaderAdInitialDelayMs,
  getReaderAdIntervalMs,
  hasAdSenseSlot,
} from '@/lib/ads';

interface ReaderInterstitialProps {
  /** Reader is open and content is loaded */
  active: boolean;
}

export function ReaderInterstitial({ active }: ReaderInterstitialProps) {
  const { showAds, loading } = useShowAds();
  const [visible, setVisible] = useState(false);
  const [dismissCountdown, setDismissCountdown] = useState(getReaderAdDismissSeconds());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const openInterstitial = useCallback(() => {
    setDismissCountdown(getReaderAdDismissSeconds());
    setVisible(true);
  }, []);

  const closeInterstitial = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!active || loading || !showAds) {
      setVisible(false);
      return;
    }

    initialTimerRef.current = setTimeout(() => {
      openInterstitial();

      repeatTimerRef.current = setInterval(() => {
        openInterstitial();
      }, getReaderAdIntervalMs());
    }, getReaderAdInitialDelayMs());

    return () => {
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    };
  }, [active, loading, showAds, openInterstitial]);

  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setDismissCountdown(getReaderAdDismissSeconds());
    intervalRef.current = setInterval(() => {
      setDismissCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (loading || !showAds || !visible) return null;

  const canDismiss = dismissCountdown === 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-interstitial-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-700 dark:bg-stone-900">
        <p className="text-xs font-medium uppercase tracking-widest text-amber-700 dark:text-amber-400">
          Advertisement
        </p>
        <h2 id="reader-interstitial-title" className="mt-2 font-serif text-2xl font-semibold">
          Read without interruptions
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Subscribe to Ad-free for ₹30/month — no popup ads while reading, plus member discounts on
          book purchases.
        </p>

        {hasAdSenseSlot('reader_interstitial') && (
          <div className="mt-4">
            <AdSenseUnit placement="reader_interstitial" />
          </div>
        )}

        <ul className="mt-4 space-y-1 text-sm text-stone-600 dark:text-stone-400">
          <li>✓ No ads in the reader</li>
          <li>✓ No banners while browsing</li>
          <li>✓ Member price on book purchases</li>
        </ul>

        <div className="mt-6 flex flex-col gap-3">
          <Link href="/subscription" className="w-full">
            <Button className="w-full">Go ad-free — Subscribe now</Button>
          </Link>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!canDismiss}
            onClick={closeInterstitial}
          >
            {canDismiss
              ? 'Continue reading'
              : `Continue reading (${dismissCountdown}s)`}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-stone-400">
          This message appears periodically for free readers.
        </p>
      </div>
    </div>
  );
}
