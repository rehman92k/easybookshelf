'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { fetchSubscriptionStatus } from '@/lib/subscriptions';

export function useShowAds() {
  const { user, loading: authLoading } = useAuth();
  const [showAds, setShowAds] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setShowAds(true);
      return;
    }

    void fetchSubscriptionStatus()
      .then((status) => setShowAds(!status.adFree))
      .catch(() => setShowAds(true));
  }, [authLoading, user]);

  return {
    showAds: showAds === true,
    loading: authLoading || showAds === null,
  };
}
