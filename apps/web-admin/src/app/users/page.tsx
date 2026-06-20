'use client';

import { useEffect, useState } from 'react';
import type { User } from '@easybookshelf/shared-types';
import { Alert, Button, Card, EmptyState, PageHeader, PageLoading } from '@easybookshelf/ui';
import { AdminAuthGate } from '@/components/admin-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { getAccessToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (user) {
      void loadUsers();
    }
  }, [user]);

  async function loadUsers() {
    setFetching(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Failed to load users');
      }
      const data = (await res.json()) as { data: User[] };
      setUsers(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setFetching(false);
    }
  }

  async function suspendUser(id: string) {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ status: 'suspended' }),
    });
    if (res.ok) void loadUsers();
  }

  return (
    <AdminAuthGate loginNext="/users">
      <PageHeader
        title="User management"
        description="Requires super_admin or admin_content role. See docs/ADMIN_SETUP.md to promote your account."
      />

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {fetching ? (
        <PageLoading message="Loading users…" />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-100 dark:bg-stone-800/50">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Roles</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-stone-200 dark:border-stone-700">
                  <td className="px-4 py-3">{u.displayName}</td>
                  <td className="px-4 py-3">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">{u.roles.join(', ')}</td>
                  <td className="px-4 py-3 capitalize">{u.status}</td>
                  <td className="px-4 py-3">
                    {u.status === 'active' && user?.roles.includes('super_admin') && (
                      <Button variant="ghost" onClick={() => void suspendUser(u.id)}>
                        Suspend
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AdminAuthGate>
  );
}
