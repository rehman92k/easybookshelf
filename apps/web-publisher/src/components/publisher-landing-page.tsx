'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageLoading } from '@easybookshelf/ui';
import { PublisherAuthForm } from '@/components/publisher-auth-form';
import { PublisherLandingLayout } from '@/components/publisher-landing-layout';
import { useAuth } from '@/components/auth-provider';
import { getReaderUrl } from '@/lib/urls';

export function PublisherLandingPage() {
  return (
    <Suspense fallback={<PageLoading message="Loading…" />}>
      <PublisherLandingContent />
    </Suspense>
  );
}

function PublisherLandingContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [isRegister, setIsRegister] = useState(false);
  const { loading } = useAuth();

  if (loading) {
    return (
      <PublisherLandingLayout>
        <PageLoading message="Loading…" />
      </PublisherLandingLayout>
    );
  }

  return (
    <PublisherLandingLayout>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h1 className="font-serif text-2xl font-semibold">
          {isRegister ? 'Create account' : 'Sign in'}
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          {isRegister
            ? 'Register to upload and sell books on EasyBookshelf'
            : 'Upload and manage your books on EasyBookshelf'}
        </p>

        <div className="mt-6">
          <PublisherAuthForm
            nextPath={nextPath}
            onRegisterModeChange={setIsRegister}
          />
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-stone-500">
        Same account works on the{' '}
        <Link href={getReaderUrl()} className="underline">
          reader site
        </Link>
        .
      </p>
    </PublisherLandingLayout>
  );
}
