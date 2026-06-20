'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { PageLoading } from '@easybookshelf/ui';
import { PublisherShell } from '@/components/publisher-shell';
import { useAuth } from '@/components/auth-provider';

interface PublisherAuthGateProps {
  children: ReactNode;
  loginNext?: string;
}

export function PublisherAuthGate({ children, loginNext }: PublisherAuthGateProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || user) return;
    const next = loginNext ?? pathname;
    router.replace(`/?next=${encodeURIComponent(next)}`);
  }, [loading, user, loginNext, pathname, router]);

  if (loading) {
    return <PageLoading message="Loading…" />;
  }

  if (!user) {
    return <PageLoading message="Redirecting to sign in…" />;
  }

  return <PublisherShell>{children}</PublisherShell>;
}
