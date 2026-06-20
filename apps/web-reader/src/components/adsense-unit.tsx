'use client';

import { useEffect, useRef } from 'react';
import type { AdPlacement } from '@/lib/ads';
import { getAdSenseClientId, getAdSenseSlot, hasAdSenseSlot } from '@/lib/ads';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

interface AdSenseUnitProps {
  placement: AdPlacement;
  className?: string;
}

export function AdSenseUnit({ placement, className }: AdSenseUnitProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!hasAdSenseSlot(placement) || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense may not be loaded yet in dev
    }
  }, [placement]);

  if (!hasAdSenseSlot(placement)) return null;

  const slot = getAdSenseSlot(placement);

  return (
    <ins
      className={`adsbygoogle block overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-900 ${className ?? ''}`}
      style={{ display: 'block', minHeight: 90 }}
      data-ad-client={getAdSenseClientId()}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
