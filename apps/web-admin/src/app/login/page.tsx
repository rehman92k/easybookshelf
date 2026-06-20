'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Button, Logo, PasswordInput, OtpVerification } from '@easybookshelf/ui';
import type { OtpChannel } from '@easybookshelf/ui';
import {
  getFirebaseAuth,
  getFirebaseAuthErrorMessage,
  isFirebaseConfigured,
  sendPasswordReset,
} from '@/lib/firebase';
import {
  loginWithFirebaseIdToken,
  sendOtp,
  verifyOtp,
  VerificationRequiredError,
  clearAuth,
} from '@/lib/auth';
import { useAuth } from '@/components/auth-provider';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone';

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-400">
          Loading…
        </div>
      }
    >
      <AdminLoginPageContent />
    </Suspense>
  );
}

function AdminLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState<{
    phoneMasked?: string;
    emailMasked?: string;
    channel?: OtpChannel;
  } | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      const next = searchParams.get('next') || '/';
      router.replace(next.startsWith('/') ? next : '/');
    }
  }, [authLoading, user, router, searchParams]);

  function showVerificationStep(err: VerificationRequiredError) {
    setOtpStep({
      phoneMasked: err.phoneMasked,
      emailMasked: err.emailMasked,
    });
    setOtpError(null);
    setOtpSuccess(null);
  }

  async function finishAuthenticatedSession() {
    await refreshUser();
    const next = searchParams.get('next') || '/';
    router.push(next.startsWith('/') ? next : '/');
  }

  async function routeAfterAuth() {
    const auth = getFirebaseAuth();
    const idToken = await auth.currentUser?.getIdToken(true);
    if (!idToken) throw new Error('Could not get token');

    try {
      await loginWithFirebaseIdToken(idToken);
    } catch (err) {
      if (err instanceof VerificationRequiredError) {
        showVerificationStep(err);
        return;
      }
      throw err;
    }

    await finishAuthenticatedSession();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      await routeAfterAuth();
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err, 'Sign in failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMobile(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidIndianMobile(mobile)) {
      setOtpError('Enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Session expired. Sign in again.');

      try {
        await loginWithFirebaseIdToken(idToken, {
          phone: normalizeIndianMobile(mobile),
        });
      } catch (err) {
        if (err instanceof VerificationRequiredError) {
          showVerificationStep(err);
          setOtpSuccess('Mobile number saved. You can now receive SMS codes.');
          return;
        }
        throw err;
      }

      await finishAuthenticatedSession();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not save mobile number');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    setLoading(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Session expired. Sign in again.');
      await verifyOtp(idToken, code);
      setOtpStep(null);
      await finishAuthenticatedSession();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(channel: OtpChannel) {
    setLoading(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Session expired. Sign in again.');
      await sendOtp(idToken, channel);
      setOtpStep((prev) => ({
        phoneMasked: prev?.phoneMasked,
        emailMasked: prev?.emailMasked,
        channel,
      }));
      setOtpSuccess(
        channel === 'phone'
          ? 'Verification code sent to your mobile.'
          : 'Verification code sent to your email.',
      );
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!otpStep?.channel) return;
    await handleSendOtp(otpStep.channel);
  }

  async function handleOtpBack() {
    await signOut(getFirebaseAuth());
    clearAuth();
    setOtpStep(null);
    setOtpError(null);
    setOtpSuccess(null);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordReset(email);
      setSuccess('Password reset email sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err, 'Could not send reset email'));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 px-6 text-white">
        <p className="text-sm text-stone-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-6 text-white">
      <Logo className="mb-8 text-amber-200" />
      <h1 className="font-serif text-2xl font-semibold">
        {otpStep
          ? 'Verify your account'
          : isForgotPassword
            ? 'Reset password'
            : 'Admin sign in'}
      </h1>
      <p className="mt-2 text-center text-sm text-stone-400">
        {otpStep
          ? 'Complete verification to access the admin portal'
          : isForgotPassword
            ? 'We will email you a link to set a new password'
            : 'Super admin account — OTP required after password'}
      </p>
      {!isFirebaseConfigured() && (
        <p className="mt-4 text-sm text-amber-300">Add Firebase keys to .env.local</p>
      )}
      {error && !otpStep && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {success && !otpStep && <p className="mt-4 text-sm text-green-400">{success}</p>}

      {otpStep ? (
        <div className="dark mt-8 w-full max-w-sm text-white">
          {!otpStep.phoneMasked && (
            <form onSubmit={handleAddMobile} className="mb-6 space-y-3 border-b border-stone-700 pb-6">
              <p className="text-sm text-stone-400">
                Add your mobile number to receive verification codes by SMS.
              </p>
              <div>
                <label htmlFor="admin-mobile" className="text-sm font-medium">
                  Mobile number
                </label>
                <input
                  id="admin-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2 text-sm"
                />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                Save mobile
              </Button>
            </form>
          )}
          <OtpVerification
            phoneMasked={otpStep.phoneMasked}
            emailMasked={otpStep.emailMasked}
            loading={loading}
            error={otpError}
            success={otpSuccess}
            onSend={handleSendOtp}
            onVerify={handleVerifyOtp}
            onResend={handleResendOtp}
            onBack={handleOtpBack}
          />
        </div>
      ) : isForgotPassword ? (
        <form onSubmit={handleForgotPassword} className="mt-8 w-full max-w-sm space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2 text-sm"
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading || !isFirebaseConfigured()}>
            Send reset email
          </Button>
          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false);
              setError(null);
              setSuccess(null);
            }}
            className="w-full text-center text-sm text-amber-300 hover:underline"
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 w-full max-w-sm space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs text-amber-300 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-2 text-sm"
            />
          </div>
          <Button className="w-full" type="submit" disabled={loading || !isFirebaseConfigured()}>
            Sign in
          </Button>
        </form>
      )}
    </div>
  );
}
