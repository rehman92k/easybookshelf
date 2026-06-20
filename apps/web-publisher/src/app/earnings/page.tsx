'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublisherEarnings, Settlement } from '@easybookshelf/shared-types';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
  StatCard,
} from '@easybookshelf/ui';
import { PublisherAuthGate } from '@/components/publisher-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { fetchPublisherEarnings, fetchPublisherSettlements } from '@/lib/publisher';

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

export default function PublisherEarningsPage() {
  const { user, loading: authLoading } = useAuth();
  const [earnings, setEarnings] = useState<PublisherEarnings | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const [e, s] = await Promise.all([
          fetchPublisherEarnings(),
          fetchPublisherSettlements(),
        ]);
        setEarnings(e);
        setSettlements(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load earnings');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  return (
    <PublisherAuthGate loginNext="/earnings">
      <PageHeader
        title="Earnings"
        description="Sales from your books and platform settlement payouts."
      />

      {authLoading || loading ? (
        <PageLoading message="Loading earnings…" />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : earnings ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Unsettled sales" value={formatInr(earnings.unsettledSales)} />
            <StatCard label="Your unsettled share" value={formatInr(earnings.unsettledEarnings)} />
            <StatCard label="Pending payout" value={formatInr(earnings.pendingPayout)} />
            <StatCard label="Total paid out" value={formatInr(earnings.totalPaid)} />
          </div>

          <p className="mt-4 text-sm text-stone-500">
            {earnings.unsettledOrderCount} paid order
            {earnings.unsettledOrderCount === 1 ? '' : 's'} not yet in a settlement.
          </p>

          <h2 className="mt-10 font-serif text-xl font-semibold">Settlement history</h2>
          {settlements.length === 0 ? (
            <EmptyState className="mt-4" title="No settlements yet" />
          ) : (
            <Card padding="none" className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-stone-200 text-left text-stone-500 dark:border-stone-700">
                  <tr>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Gross sales</th>
                    <th className="px-4 py-3 font-medium">Platform fee</th>
                    <th className="px-4 py-3 font-medium">Your payout</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id} className="border-b border-stone-100 dark:border-stone-800">
                      <td className="px-4 py-3">
                        {s.periodStart} → {s.periodEnd}
                      </td>
                      <td className="px-4 py-3">{formatInr(s.grossAmount)}</td>
                      <td className="px-4 py-3">{formatInr(s.platformCommission)}</td>
                      <td className="px-4 py-3 font-medium">{formatInr(s.netAmount)}</td>
                      <td className="px-4 py-3 capitalize">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : null}
    </PublisherAuthGate>
  );
}
