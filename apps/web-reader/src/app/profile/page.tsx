'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@easybookshelf/ui';
import { SiteHeader } from '@/components/site-header';
import { useAuth } from '@/components/auth-provider';
import { fetchSessions, updateProfile } from '@/lib/auth';

export default function ProfilePage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<
    Array<{ id: string; userAgent: string | null; createdAt: string; current: boolean }>
  >([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setAvatarUrl(user.avatarUrl ?? '');
      fetchSessions()
        .then((data) => setSessions(data.sessions))
        .catch(() => undefined);
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateProfile({
        displayName,
        avatarUrl: avatarUrl || null,
      });
      await refreshUser();
      setMessage('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push('/');
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-16 text-center text-stone-500">Loading...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-12">
        <h1 className="font-serif text-3xl font-semibold">Your profile</h1>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{user.email}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/library">
            <Button variant="secondary" className="px-3 py-1.5 text-xs">
              My library
            </Button>
          </Link>
          <Link href="/wishlist">
            <Button variant="ghost" className="px-3 py-1.5 text-xs">
              Wishlist
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="ghost" className="px-3 py-1.5 text-xs">
              Reading history
            </Button>
          </Link>
          <Link href="/orders">
            <Button variant="ghost" className="px-3 py-1.5 text-xs">
              Order history
            </Button>
          </Link>
          <Link href="/subscription">
            <Button variant="ghost" className="px-3 py-1.5 text-xs">
              Ad-free plan
            </Button>
          </Link>
        </div>

        {message && (
          <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <div className="text-sm text-stone-500">
            <p>Roles: {user.roles.join(', ')}</p>
            <p>Status: {user.status}</p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>

        {sessions.length > 0 && (
          <section className="mt-10">
            <h2 className="font-serif text-lg font-semibold">Active sessions</h2>
            <ul className="mt-3 space-y-2 text-sm text-stone-600 dark:text-stone-400">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                  {s.current ? '(This device) ' : ''}
                  {s.userAgent?.slice(0, 60) ?? 'Unknown device'}
                  <span className="block text-xs text-stone-400">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Button variant="secondary" className="mt-8" onClick={handleLogout}>
          Sign out
        </Button>
      </main>
    </div>
  );
}
