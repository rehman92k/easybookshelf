'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { Button, Logo } from '@easybookshelf/ui';
import { useAuth } from '@/components/auth-provider';
import { getFirebaseAuth } from '@/lib/firebase';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', exact: true },
  { href: '/books', label: 'Book approvals' },
  { href: '/users', label: 'Users' },
  { href: '/commission', label: 'Commission' },
  { href: '/subscriptions', label: 'Subscriptions' },
  { href: '/settlements', label: 'Settlements' },
];

interface AdminShellProps {
  children: ReactNode;
}

function SidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex-1 space-y-0.5 p-3">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
            isActive(item.href, item.exact)
              ? 'bg-amber-700/30 font-medium text-amber-100'
              : 'text-stone-300 hover:bg-stone-800 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await logout();
    try {
      await signOut(getFirebaseAuth());
    } catch {
      // Firebase may already be signed out
    }
    setMobileOpen(false);
    router.replace('/login');
  }

  const userFooter = (
    <div className="border-t border-stone-800 p-4">
      {loading ? (
        <p className="text-xs text-stone-500">Loading…</p>
      ) : (
        <>
          <p className="truncate text-sm font-medium text-white">{user?.displayName}</p>
          <p className="truncate text-xs text-stone-500">{user?.email}</p>
          <Button
            variant="secondary"
            className="mt-3 w-full border-stone-700 bg-stone-800 text-stone-100 hover:bg-stone-700"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
        </>
      )}
    </div>
  );

  const sidebarContent = (
    <>
      <div className="border-b border-stone-800 px-5 py-5">
        <Link href="/" onClick={() => setMobileOpen(false)}>
          <Logo className="text-amber-200" />
        </Link>
        <p className="mt-1 text-xs text-stone-400">Admin portal</p>
      </div>
      <SidebarNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
      {userFooter}
    </>
  );

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-stone-800 bg-stone-900 text-white transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      <div className="flex min-h-screen md:pl-56">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900 md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              onClick={() => setMobileOpen(true)}
            >
              Menu
            </button>
            <Link href="/">
              <Logo className="text-base" />
            </Link>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
