'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Logo, inputClassName } from '@easybookshelf/ui';
import { AdFreeBanner } from '@/components/ad-free-banner';
import { SignInDialog } from '@/components/sign-in-dialog';
import { useAuth } from '@/components/auth-provider';
import { getPublisherUrl } from '@/lib/urls';

const NAV_LINKS = [
  { href: '/books', label: 'Browse', guest: true },
  { href: '/library', label: 'Library', guest: false },
  { href: '/wishlist', label: 'Wishlist', guest: false },
  { href: '/history', label: 'History', guest: false },
  { href: '/orders', label: 'Orders', guest: false },
  { href: '/subscription', label: 'Ad-free', guest: false },
];

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push('/');
    router.refresh();
    setMenuOpen(false);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function openSignIn() {
    setMenuOpen(false);
    setSignInOpen(true);
  }

  const visibleLinks = NAV_LINKS.filter((link) => link.guest || user);
  const publisherUrl = getPublisherUrl();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="shrink-0" onClick={() => setMenuOpen(false)}>
            <Logo />
          </Link>

          <form onSubmit={onSearchSubmit} className="hidden flex-1 sm:flex sm:max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search books…"
              className={`${inputClassName} py-1.5`}
            />
          </form>

          <nav className="hidden items-center gap-1 md:flex">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={publisherUrl}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              For publishers
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {loading ? (
              <span className="text-sm text-stone-400">…</span>
            ) : user ? (
              <>
                <Link
                  href="/profile"
                  className="hidden text-sm text-stone-700 hover:text-stone-900 dark:text-stone-300 sm:inline"
                >
                  {user.displayName}
                </Link>
                <Button variant="ghost" className="hidden px-3 py-1.5 text-xs sm:inline-flex" onClick={handleLogout}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="hidden px-3 py-1.5 text-xs sm:inline-flex"
                  onClick={openSignIn}
                >
                  Sign in
                </Button>
                <Button className="hidden px-3 py-1.5 text-xs sm:inline-flex" onClick={openSignIn}>
                  Get started
                </Button>
              </>
            )}

            <button
              type="button"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-stone-200 px-4 py-4 dark:border-stone-800 md:hidden">
            <form onSubmit={onSearchSubmit} className="mb-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search books…"
                className={inputClassName}
              />
            </form>
            <nav className="flex flex-col gap-1">
              {visibleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <a
                href={publisherUrl}
                className="rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                onClick={() => setMenuOpen(false)}
              >
                For publishers
              </a>
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="rounded-lg px-3 py-2 text-sm text-stone-700 dark:text-stone-300"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                    onClick={handleLogout}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" className="w-full flex-1" onClick={openSignIn}>
                    Sign in
                  </Button>
                  <Button className="w-full flex-1" onClick={openSignIn}>
                    Get started
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>
      <AdFreeBanner />
      <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}
