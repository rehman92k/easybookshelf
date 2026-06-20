'use client';

import type { AuthLoginResponse } from '@easybookshelf/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'easybookshelf_access_token';

let accessToken: string | null =
  typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
let currentUser: AuthLoginResponse['user'] | null = null;

export type OtpChannel = 'phone' | 'email';

export class VerificationRequiredError extends Error {
  readonly code = 'VERIFICATION_REQUIRED';

  constructor(
    readonly phoneMasked?: string,
    readonly emailMasked?: string,
  ) {
    super('Verify your account to continue');
    this.name = 'VerificationRequiredError';
  }
}

/** @deprecated Use VerificationRequiredError */
export class PhoneVerificationRequiredError extends VerificationRequiredError {
  constructor(phoneMasked: string) {
    super(phoneMasked, undefined);
    this.name = 'PhoneVerificationRequiredError';
  }
}

function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function getAccessToken() {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = sessionStorage.getItem(TOKEN_KEY);
  }
  return accessToken;
}

export function getCurrentUser() {
  return currentUser;
}

export function clearAuth() {
  setAccessToken(null);
  currentUser = null;
}

type ApiErrorBody = {
  message?: string;
  code?: string;
  phoneMasked?: string;
  emailMasked?: string;
  error?: ApiErrorBody;
};

async function parseApiError(response: Response): Promise<{
  message: string;
  code?: string;
  phoneMasked?: string;
  emailMasked?: string;
}> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & {
    message?: string | ApiErrorBody;
  };
  const payload =
    typeof body.message === 'object' && body.message !== null ? body.message : body;
  return {
    message:
      payload.message ??
      (typeof body.message === 'string' ? body.message : undefined) ??
      'Request failed',
    code: payload.code ?? body.code,
    phoneMasked: payload.phoneMasked ?? body.phoneMasked,
    emailMasked: payload.emailMasked ?? body.emailMasked,
  };
}

function throwIfVerificationRequired(err: Awaited<ReturnType<typeof parseApiError>>): never {
  if (
    err.code === 'VERIFICATION_REQUIRED' ||
    err.code === 'PHONE_VERIFICATION_REQUIRED'
  ) {
    throw new VerificationRequiredError(err.phoneMasked, err.emailMasked);
  }
  throw new Error(err.message);
}

export async function loginWithFirebaseIdToken(
  idToken: string,
  options?: { phone?: string; displayName?: string },
): Promise<AuthLoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      idToken,
      ...(options?.phone ? { phone: options.phone } : {}),
      ...(options?.displayName ? { displayName: options.displayName } : {}),
    }),
  });

  if (!response.ok) {
    throwIfVerificationRequired(await parseApiError(response));
  }

  const data = (await response.json()) as AuthLoginResponse;
  setAccessToken(data.tokens.accessToken);
  currentUser = data.user;
  return data;
}

export async function sendOtp(
  idToken: string,
  channel: OtpChannel,
): Promise<{ channel: OtpChannel; destinationMasked: string }> {
  const response = await fetch(`${API_URL}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken, channel }),
  });

  if (!response.ok) {
    throwIfVerificationRequired(await parseApiError(response));
  }

  return response.json() as Promise<{ channel: OtpChannel; destinationMasked: string }>;
}

/** @deprecated Use sendOtp */
export async function sendPhoneOtp(idToken: string): Promise<{ phoneMasked: string }> {
  const result = await sendOtp(idToken, 'phone');
  return { phoneMasked: result.destinationMasked };
}

export async function verifyOtp(idToken: string, code: string): Promise<AuthLoginResponse> {
  const response = await fetch(`${API_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken, code }),
  });

  if (!response.ok) {
    const err = await parseApiError(response);
    throw new Error(err.message);
  }

  const data = (await response.json()) as AuthLoginResponse;
  setAccessToken(data.tokens.accessToken);
  currentUser = data.user;
  return data;
}

/** @deprecated Use verifyOtp */
export const verifyPhoneOtp = verifyOtp;

export async function refreshAccessToken(): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    clearAuth();
    return false;
  }

  const data = (await response.json()) as { tokens: AuthLoginResponse['tokens'] };
  setAccessToken(data.tokens.accessToken);
  return true;
}

export async function logoutFromApi() {
  if (accessToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: 'include',
    }).catch(() => undefined);
  }

  clearAuth();
}

export async function fetchCurrentUser(): Promise<AuthLoginResponse['user'] | null> {
  if (!accessToken) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
  }

  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });

  if (!response.ok) {
    clearAuth();
    return null;
  }

  currentUser = (await response.json()) as AuthLoginResponse['user'];
  return currentUser;
}

export async function updateProfile(data: {
  displayName?: string;
  phone?: string;
  avatarUrl?: string | null;
}): Promise<AuthLoginResponse['user']> {
  if (!accessToken) throw new Error('Not signed in');

  const response = await fetch(`${API_URL}/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await parseApiError(response);
    throw new Error(err.message);
  }

  currentUser = (await response.json()) as AuthLoginResponse['user'];
  return currentUser;
}

export async function fetchSessions() {
  if (!accessToken) throw new Error('Not signed in');

  const response = await fetch(`${API_URL}/auth/sessions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });

  if (!response.ok) throw new Error(await parseApiError(response).then((e) => e.message));

  return response.json() as Promise<{
    sessions: Array<{
      id: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
      current: boolean;
    }>;
  }>;
}
