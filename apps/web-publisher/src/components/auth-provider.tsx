'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User } from '@easybookshelf/shared-types';
import { fetchCurrentUser, logoutFromApi, getCurrentUser } from '@/lib/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const profile = await fetchCurrentUser();
    const next = profile ?? getCurrentUser();
    setUser((prev) => {
      if (!next) return null;
      if (!prev) return next;
      if (
        prev.id === next.id &&
        prev.displayName === next.displayName &&
        JSON.stringify(prev.roles) === JSON.stringify(next.roles)
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((profile) => {
        const next = profile ?? getCurrentUser();
        setUser((prev) => {
          if (!next) return null;
          if (!prev) return next;
          if (
            prev.id === next.id &&
            prev.displayName === next.displayName &&
            JSON.stringify(prev.roles) === JSON.stringify(next.roles)
          ) {
            return prev;
          }
          return next;
        });
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await logoutFromApi();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
