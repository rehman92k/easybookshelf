'use client';

import { useState } from 'react';
import { inputClassName, labelClassName } from './styles';

export type OtpChannel = 'phone' | 'email';

export interface OtpVerificationProps {
  phoneMasked?: string;
  emailMasked?: string;
  loading?: boolean;
  error?: string | null;
  success?: string | null;
  onSend: (channel: OtpChannel) => Promise<void>;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack?: () => void;
}

export function OtpVerification({
  phoneMasked,
  emailMasked,
  loading = false,
  error,
  success,
  onSend,
  onVerify,
  onResend,
  onBack,
}: OtpVerificationProps) {
  const [channel, setChannel] = useState<OtpChannel | null>(
    phoneMasked && !emailMasked ? 'phone' : emailMasked && !phoneMasked ? 'email' : null,
  );
  const [codeSent, setCodeSent] = useState(false);
  const [activeDestination, setActiveDestination] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const canChoosePhone = Boolean(phoneMasked);
  const canChooseEmail = Boolean(emailMasked);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!channel) return;
    await onSend(channel);
    setCodeSent(true);
    setActiveDestination(channel === 'phone' ? phoneMasked ?? null : emailMasked ?? null);
    setCode('');
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    await onVerify(code.trim());
  }

  async function handleChangeMethod() {
    setCodeSent(false);
    setCode('');
    setActiveDestination(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg font-semibold">Verify your account</h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          {codeSent
            ? `Enter the 6-digit code sent to ${activeDestination ?? 'your selected contact'}.`
            : 'Choose where you want to receive your verification code.'}
        </p>
      </div>

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

      {!codeSent ? (
        <form onSubmit={handleSend} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className={labelClassName}>Send code to</legend>
            {canChoosePhone && (
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600">
                <input
                  type="radio"
                  name="otp-channel"
                  value="phone"
                  checked={channel === 'phone'}
                  onChange={() => setChannel('phone')}
                />
                <span>
                  Mobile <span className="text-stone-500">({phoneMasked})</span>
                </span>
              </label>
            )}
            {canChooseEmail && (
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600">
                <input
                  type="radio"
                  name="otp-channel"
                  value="email"
                  checked={channel === 'email'}
                  onChange={() => setChannel('email')}
                />
                <span>
                  Email <span className="text-stone-500">({emailMasked})</span>
                </span>
              </label>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={loading || !channel}
            className="inline-flex w-full items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            {loading ? 'Sending…' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="otp-code" className={labelClassName}>
              Verification code
            </label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              minLength={6}
              maxLength={6}
              placeholder="6-digit code"
              className={inputClassName}
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="inline-flex w-full items-center justify-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            {loading ? 'Verifying…' : 'Verify and continue'}
          </button>
        </form>
      )}

      {codeSent && (
        <>
          <button
            type="button"
            onClick={() => void onResend()}
            disabled={loading}
            className="w-full text-center text-sm text-amber-800 hover:underline disabled:opacity-60 dark:text-amber-400"
          >
            Resend code
          </button>
          {(canChoosePhone && canChooseEmail) && (
            <button
              type="button"
              onClick={handleChangeMethod}
              disabled={loading}
              className="w-full text-center text-sm text-stone-500 hover:underline dark:text-stone-400"
            >
              Use a different method
            </button>
          )}
        </>
      )}

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="w-full text-center text-sm text-stone-500 hover:underline dark:text-stone-400"
        >
          Back to sign in
        </button>
      )}
    </div>
  );
}

/** @deprecated Use OtpVerification */
export const PhoneOtpVerification = OtpVerification;
