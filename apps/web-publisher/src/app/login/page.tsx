'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageLoading } from '@easybookshelf/ui';

export default function PublisherLoginPage() {
  return (
    <Suspense fallback={<PageLoading message="Redirecting…" />}>
      <PublisherLoginRedirect />
    </Suspense>
  );
}

function PublisherLoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get('next');
    router.replace(next ? `/?next=${encodeURIComponent(next)}` : '/');
  }, [router, searchParams]);

  return <PageLoading message="Redirecting to sign in…" />;
}
