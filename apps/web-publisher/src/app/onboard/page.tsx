'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, PageLoading } from '@easybookshelf/ui';
import { PublisherAuthGate } from '@/components/publisher-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { refreshAccessTokenFromBearer } from '@/lib/auth';
import { fetchPublisherProfile, onboardPublisher } from '@/lib/publisher';

export default function OnboardPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState<'author' | 'publisher'>('author');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const activeUser = user;

    let cancelled = false;

    async function checkProfile() {
      try {
        const profile = await fetchPublisherProfile();
        if (!cancelled) {
          setName(profile.name);
          router.replace('/upload');
        }
      } catch {
        if (!cancelled) {
          setName(activeUser.displayName);
          setChecking(false);
        }
      }
    }

    void checkProfile();

    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onboardPublisher({ name, type });
      await refreshAccessTokenFromBearer();
      await refreshUser();
      router.push('/upload');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onboarding failed';
      if (message.includes('PUBLISHER_EXISTS') || message.toLowerCase().includes('already exists')) {
        router.push('/upload');
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublisherAuthGate loginNext="/onboard">
      {loading || checking ? (
        <PageLoading message="Loading…" />
      ) : (
        <div className="mx-auto max-w-lg">
          <h1 className="font-serif text-3xl font-semibold">Publisher onboarding</h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Create your publisher or author profile before uploading books.
          </p>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="publisher-brand-name" className="text-sm font-medium">
                Publishing brand name
              </label>
              <input
                id="publisher-brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Sharma Publishing or your author pen name"
                className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              />
              <p className="mt-1 text-xs text-stone-500">
                Shown on your books. Can match your account name or be a separate imprint.
              </p>
            </div>
            <div>
              <label htmlFor="account-type" className="text-sm font-medium">
                Account type
              </label>
              <select
                id="account-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'author' | 'publisher')}
                className="mt-1 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
              >
                <option value="author">Self-published author</option>
                <option value="publisher">Publisher</option>
              </select>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating profile…' : 'Create profile'}
            </Button>
          </form>
        </div>
      )}
    </PublisherAuthGate>
  );
}
