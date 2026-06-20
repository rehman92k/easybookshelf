'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Logo } from '@easybookshelf/ui';
import { useAuth } from '@/components/auth-provider';
import {
  IconBooks,
  IconClose,
  IconDashboard,
  IconEarnings,
  IconMenu,
  IconSignOut,
  IconUpload,
  IconUser,
  type PublisherNavIcon,
} from '@/components/publisher-nav-icons';

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  exact?: boolean;
  icon: PublisherNavIcon;
}> = [
  { href: '/', label: 'Dashboard', exact: true, icon: IconDashboard },
  { href: '/books', label: 'My books', icon: IconBooks },
  { href: '/upload', label: 'Upload', icon: IconUpload },
  { href: '/earnings', label: 'Earnings', icon: IconEarnings },
  { href: '/profile', label: 'Profile', icon: IconUser },
];

interface PublisherShellProps {
  children: ReactNode;
}

export function PublisherShell({ children }: PublisherShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="h-screen overflow-hidden bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <div className="flex h-full w-full">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-full w-56 shrink-0 flex-col border-r border-stone-200 bg-white transition-transform dark:border-stone-800 dark:bg-stone-900 lg:relative lg:z-auto lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="shrink-0 border-b border-stone-200 px-5 py-5 dark:border-stone-800">
            <Link href="/" onClick={closeSidebar}>
              <Logo />
            </Link>
            <p className="mt-1 text-xs text-stone-500">Publisher portal</p>
          </div>

          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-amber-50 font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                      : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active ? 'text-amber-700 dark:text-amber-300' : 'text-stone-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 space-y-2 border-t border-stone-200 p-4 dark:border-stone-800">
            <Link
              href="/profile"
              onClick={closeSidebar}
              className="flex items-center gap-3 rounded-lg bg-stone-50 px-3 py-2.5 transition-colors hover:bg-stone-100 dark:bg-stone-800/50 dark:hover:bg-stone-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <IconUser className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.displayName}</p>
                <p className="truncate text-xs text-stone-500">{user?.email}</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            >
              <IconSignOut className="h-5 w-5 shrink-0 text-stone-400" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 lg:hidden">
            <header className="flex items-center justify-center px-4 py-3">
              <Link href="/" onClick={closeSidebar}>
                <Logo className="text-base" />
              </Link>
            </header>
            <div className="border-t border-stone-200 px-4 py-2 dark:border-stone-800">
              <button
                type="button"
                aria-expanded={sidebarOpen}
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                onClick={() => setSidebarOpen((open) => !open)}
              >
                {sidebarOpen ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
                Menu
              </button>
            </div>
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
