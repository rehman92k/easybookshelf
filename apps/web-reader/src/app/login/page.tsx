'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@easybookshelf/ui';
import { SignInForm } from '@/components/sign-in-form';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-stone-500">Loading…</div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="border-b border-stone-200 bg-white/80 px-6 py-4 dark:border-stone-800 dark:bg-stone-950/80">
        <Link href="/">
          <Logo />
        </Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col px-6 py-12">
        <h1 className="font-serif text-3xl font-semibold">
          {isRegister ? 'Create account' : 'Sign in'}
        </h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          {isRegister
            ? 'Register to browse, buy, and read books on EasyBookshelf.'
            : 'Google or email via Firebase'}
        </p>

        <div className="mt-8">
          <SignInForm
            nextPath={nextPath}
            onRegisterModeChange={setIsRegister}
          />
        </div>
      </main>
    </div>
  );
}
