'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { UserRole } from '@easybookshelf/shared-types';
import { Button, EmptyState, PageLoading } from '@easybookshelf/ui';
import { AdminShell } from '@/components/admin-shell';
import { useAuth } from '@/components/auth-provider';

interface AdminAuthGateProps {
  children: ReactNode;
  loginNext?: string;
  requireRoles?: UserRole[];
  deniedTitle?: string;
  deniedDescription?: string;
}

function AuthScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-6">
      <PageLoading message={message} />
    </div>
  );
}

export function AdminAuthGate({
  children,
  loginNext,
  requireRoles,
  deniedTitle = 'Access denied',
  deniedDescription = 'Your account does not have permission for this section.',
}: AdminAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const nextPath = loginNext ?? pathname;

  useEffect(() => {
    if (!loading && !user) {
      const params = new URLSearchParams();
      if (nextPath && nextPath !== '/login') {
        params.set('next', nextPath);
      }
      const query = params.toString();
      router.replace(query ? `/login?${query}` : '/login');
    }
  }, [loading, user, nextPath, router]);

  if (loading) {
    return <AuthScreen message="Checking sign-in…" />;
  }

  if (!user) {
    return <AuthScreen message="Redirecting to sign in…" />;
  }

  if (
    requireRoles &&
    !requireRoles.some((role) => user.roles.includes(role))
  ) {
    return (
      <AdminShell>
        <EmptyState
          title={deniedTitle}
          description={deniedDescription}
          action={
            <Link href="/">
              <Button variant="secondary">Back to dashboard</Button>
            </Link>
          }
        />
      </AdminShell>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
