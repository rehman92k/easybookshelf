'use client';

import { useEffect, useState } from 'react';
import { SignInForm } from '@/components/sign-in-form';

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
  nextPath?: string;
}

export function SignInDialog({ open, onClose, nextPath = '/' }: SignInDialogProps) {
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsRegister(false);
      return;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close sign in"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-in-dialog-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="sign-in-dialog-title" className="font-serif text-2xl font-semibold">
              {isRegister ? 'Create account' : 'Sign in'}
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              {isRegister
                ? 'Register to browse, buy, and read books'
                : 'Browse, buy, and read books'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <SignInForm
          nextPath={nextPath}
          onSuccess={onClose}
          onRegisterModeChange={setIsRegister}
        />
      </div>
    </div>
  );
}
