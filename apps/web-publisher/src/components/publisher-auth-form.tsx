'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  updateProfile as updateFirebaseProfile,
  signOut,
} from 'firebase/auth';
import { Button, PasswordInput, OtpVerification, inputClassName, labelClassName } from '@easybookshelf/ui';
import type { OtpChannel } from '@easybookshelf/ui';
import { isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone';
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
import { fetchPublisherProfile } from '@/lib/publisher';

function getAuthErrorMessage(err: unknown, isRegister: boolean): string {
  return getFirebaseAuthErrorMessage(
    err,
    isRegister ? 'Registration failed' : 'Sign-in failed',
  );
}

interface PublisherAuthFormProps {
  nextPath?: string;
  onSuccess?: () => void;
  allowRegister?: boolean;
  onRegisterModeChange?: (isRegister: boolean) => void;
}

export function PublisherAuthForm({
  nextPath = '/',
  onSuccess,
  allowRegister = true,
  onRegisterModeChange,
}: PublisherAuthFormProps) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [isRegister, setIsRegister] = useState(false);
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
  const [otpMobile, setOtpMobile] = useState('');

  const firebaseReady = isFirebaseConfigured();
  const safeNext = nextPath.startsWith('/') ? nextPath : '/';

  function resetRegistrationFields() {
    setFirstName('');
    setLastName('');
    setMobile('');
    setConfirmPassword('');
  }

  function setRegisterMode(next: boolean) {
    setIsRegister(next);
    onRegisterModeChange?.(next);
    if (!next) resetRegistrationFields();
    setError(null);
    setSuccess(null);
  }

  async function finishAuthenticatedSession() {
    await refreshUser();
    onSuccess?.();

    try {
      await fetchPublisherProfile();
      router.push(safeNext);
    } catch {
      router.push('/onboard');
    }
    router.refresh();
  }

  async function routeAfterAuth(profile?: { displayName: string; phone: string }) {
    const auth = getFirebaseAuth();
    const idToken = await auth.currentUser?.getIdToken(true);
    if (!idToken) throw new Error('Could not get Firebase token');

    try {
      await loginWithFirebaseIdToken(idToken, {
        phone: profile?.phone,
        displayName: profile?.displayName,
      });
    } catch (err) {
      if (err instanceof VerificationRequiredError) {
        showVerificationStep(err);
        return;
      }
      throw err;
    }

    await finishAuthenticatedSession();
  }

  function showVerificationStep(err: VerificationRequiredError) {
    setOtpStep({
      phoneMasked: err.phoneMasked,
      emailMasked: err.emailMasked,
    });
    setOtpError(null);
    setOtpSuccess(null);
  }

  async function handleAddMobile(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidIndianMobile(otpMobile)) {
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
          phone: normalizeIndianMobile(otpMobile),
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
    setOtpMobile('');
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await routeAfterAuth();
    } catch (err) {
      setError(getAuthErrorMessage(err, false));
    } finally {
      setLoading(false);
    }
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

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const auth = getFirebaseAuth();

      if (isRegister) {
        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();
        if (!trimmedFirst || !trimmedLast) {
          setError('First name and last name are required');
          return;
        }
        if (!isValidIndianMobile(mobile)) {
          setError('Enter a valid 10-digit Indian mobile number');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        const displayName = `${trimmedFirst} ${trimmedLast}`;
        const phone = normalizeIndianMobile(mobile);

        await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (auth.currentUser) {
          await updateFirebaseProfile(auth.currentUser, { displayName });
        }
        await routeAfterAuth({ displayName, phone });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        await routeAfterAuth();
      }
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : '';

      if (code === 'auth/email-already-in-use') {
        setRegisterMode(false);
      }

      setError(getAuthErrorMessage(err, isRegister));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {otpStep ? (
        <div className="space-y-4">
          {!otpStep.phoneMasked && (
            <form onSubmit={handleAddMobile} className="space-y-3 border-b border-stone-200 pb-6 dark:border-stone-700">
              <p className="text-sm text-stone-600 dark:text-stone-400">
                Add your mobile number to receive verification codes by SMS.
              </p>
              <div>
                <label htmlFor="publisher-otp-mobile" className={labelClassName}>
                  Mobile number
                </label>
                <input
                  id="publisher-otp-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={otpMobile}
                  onChange={(e) => setOtpMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  className={inputClassName}
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
      ) : (
        <>
      {!firebaseReady && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          Add Firebase keys to <code className="rounded bg-white/60 px-1">.env.local</code>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          {success}
        </div>
      )}

      {!isForgotPassword && !isRegister && (
        <>
          <Button
            className="w-full"
            onClick={handleGoogle}
            disabled={!firebaseReady || loading}
            type="button"
          >
            Continue with Google
          </Button>

          <div className="relative text-center text-xs uppercase text-stone-400">
            <span className="bg-white px-2 dark:bg-stone-900">or</span>
          </div>
        </>
      )}

      {isForgotPassword ? (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label htmlFor="publisher-email" className={labelClassName}>
              Email
            </label>
            <input
              id="publisher-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClassName}
            />
          </div>
          <Button className="w-full" type="submit" disabled={!firebaseReady || loading}>
            Send reset email
          </Button>
          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false);
              setError(null);
              setSuccess(null);
            }}
            className="w-full text-center text-sm text-amber-800 hover:underline dark:text-amber-400"
          >
            Back to sign in
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleEmail} className="space-y-4">
            {isRegister && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="publisher-first-name" className={labelClassName}>
                    First name
                  </label>
                  <input
                    id="publisher-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label htmlFor="publisher-last-name" className={labelClassName}>
                    Last name
                  </label>
                  <input
                    id="publisher-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                    className={inputClassName}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="publisher-email-main" className={labelClassName}>
                Email
              </label>
              <input
                id="publisher-email-main"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClassName}
              />
            </div>

            {isRegister && (
              <div>
                <label htmlFor="publisher-mobile" className={labelClassName}>
                  Mobile
                </label>
                <input
                  id="publisher-mobile"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  className={inputClassName}
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="publisher-password" className={labelClassName}>
                  Password
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-xs text-amber-800 hover:underline dark:text-amber-400"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput
                id="publisher-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                className={inputClassName}
              />
            </div>

            {isRegister && (
              <div>
                <label htmlFor="publisher-confirm-password" className={labelClassName}>
                  Confirm password
                </label>
                <PasswordInput
                  id="publisher-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputClassName}
                />
              </div>
            )}

            <Button className="w-full" type="submit" disabled={!firebaseReady || loading}>
              {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in with email'}
            </Button>
          </form>

          {allowRegister && (
            <button
              type="button"
              onClick={() => setRegisterMode(!isRegister)}
              className="w-full text-center text-sm text-amber-800 hover:underline dark:text-amber-400"
            >
              {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </button>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}
