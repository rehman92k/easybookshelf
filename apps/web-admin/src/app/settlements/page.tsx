'use client';

import { useEffect, useState } from 'react';
import type { Settlement } from '@easybookshelf/shared-types';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageLoading,
  inputClassName,
  labelClassName,
} from '@easybookshelf/ui';
import { AdminAuthGate } from '@/components/admin-auth-gate';
import { useAuth } from '@/components/auth-provider';
import {
  fetchAdminSettlements,
  generateAdminSettlements,
  markSettlementPaid,
} from '@/lib/admin';

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

function monthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

export default function AdminSettlementsPage() {
  const { user, loading: authLoading } = useAuth();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [period, setPeriod] = useState(monthBounds);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const canManage =
    user?.roles.includes('super_admin') ||
    user?.roles.includes('admin_finance') ||
    user?.roles.includes('admin_content');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSettlements(await fetchAdminSettlements());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settlements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user || !canManage) return;
    void load();
  }, [authLoading, user, canManage]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await generateAdminSettlements(period);
      setMessage(
        result.message ??
          `Created ${result.count} settlement${result.count === 1 ? '' : 's'}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkPaid(id: string) {
    setActingId(id);
    setError(null);
    try {
      await markSettlementPaid(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActingId(null);
    }
  }

  return (
    <AdminAuthGate
      loginNext="/settlements"
      requireRoles={['super_admin', 'admin_finance', 'admin_content']}
    >
      <PageHeader
        title="Publisher settlements"
        description="Generate payouts from paid orders, then mark as paid when transferred."
      />

      <Card className="max-w-2xl">
        <form onSubmit={handleGenerate}>
          <h2 className="font-serif text-lg font-semibold">Generate for period</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            <div>
              <label className={labelClassName}>From</label>
              <input
                type="date"
                value={period.periodStart}
                onChange={(e) => setPeriod((p) => ({ ...p, periodStart: e.target.value }))}
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>To</label>
              <input
                type="date"
                value={period.periodEnd}
                onChange={(e) => setPeriod((p) => ({ ...p, periodEnd: e.target.value }))}
                className={inputClassName}
              />
            </div>
          </div>
          <Button type="submit" className="mt-4" disabled={generating}>
            {generating ? 'Generating…' : 'Generate settlements'}
          </Button>
        </form>
      </Card>

      {message && (
        <Alert variant="success" className="mt-4">
          {message}
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <PageLoading message="Loading settlements…" />
      ) : settlements.length === 0 ? (
        <EmptyState className="mt-8" title="No settlements yet" />
      ) : (
        <Card padding="none" className="mt-8 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-200 text-left text-stone-500 dark:border-stone-700">
              <tr>
                <th className="px-4 py-3 font-medium">Publisher</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Gross</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Net payout</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-b border-stone-100 dark:border-stone-800">
                  <td className="px-4 py-3">{s.publisherName ?? s.publisherId}</td>
                  <td className="px-4 py-3">
                    {s.periodStart} → {s.periodEnd}
                  </td>
                  <td className="px-4 py-3">{formatInr(s.grossAmount)}</td>
                  <td className="px-4 py-3">{formatInr(s.platformCommission)}</td>
                  <td className="px-4 py-3 font-medium">{formatInr(s.netAmount)}</td>
                  <td className="px-4 py-3 capitalize">{s.status}</td>
                  <td className="px-4 py-3">
                    {s.status !== 'paid' && (
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        disabled={actingId === s.id}
                        onClick={() => void handleMarkPaid(s.id)}
                      >
                        {actingId === s.id ? '…' : 'Mark paid'}
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
