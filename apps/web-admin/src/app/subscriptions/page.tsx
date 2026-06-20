'use client';

import { useEffect, useState } from 'react';
import type { SubscriptionPlan } from '@easybookshelf/shared-types';
import {
  Alert,
  Button,
  Card,
  PageHeader,
  PageLoading,
  inputClassName,
  labelClassName,
} from '@easybookshelf/ui';
import { AdminAuthGate } from '@/components/admin-auth-gate';
import { useAuth } from '@/components/auth-provider';
import { fetchAdminSubscriptionPlans, updateAdminSubscriptionPlan } from '@/lib/admin';

export default function AdminSubscriptionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; price: string; active: boolean }>>({});

  const canManage =
    user?.roles.includes('super_admin') ||
    user?.roles.includes('admin_finance') ||
    user?.roles.includes('admin_content');

  useEffect(() => {
    if (authLoading || !user || !canManage) return;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminSubscriptionPlans();
        setPlans(data);
        setDrafts(
          Object.fromEntries(
            data.map((plan) => [
              plan.id,
              { name: plan.name, price: String(plan.price), active: plan.active },
            ]),
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load plans');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, canManage]);

  async function handleSave(planId: string) {
    const draft = drafts[planId];
    if (!draft) return;

    setSavingId(planId);
    setError(null);
    try {
      const updated = await updateAdminSubscriptionPlan(planId, {
        name: draft.name,
        price: Number(draft.price),
        active: draft.active,
      });
      setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AdminAuthGate
      loginNext="/subscriptions"
      requireRoles={['super_admin', 'admin_finance', 'admin_content']}
      deniedDescription="Requires super_admin, admin_finance, or admin_content role. See docs/ADMIN_SETUP.md."
    >
      <PageHeader
        title="Subscription plans"
        description="Ad-free pricing — default ₹30/month and ₹300/year."
      />

      {loading ? (
        <PageLoading message="Loading plans…" />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          {plans.map((plan) => {
            const draft = drafts[plan.id];
            if (!draft) return null;
            return (
              <Card
                key={plan.id}
                className="space-y-4"
                padding="md"
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSave(plan.id);
                  }}
                >
                  <p className="text-xs uppercase tracking-widest text-stone-400">
                    {plan.interval} plan
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClassName}>Name</label>
                      <input
                        value={draft.name}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [plan.id]: { ...draft, name: e.target.value },
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className={labelClassName}>Price ({plan.currency})</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.price}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [plan.id]: { ...draft, price: e.target.value },
                          }))
                        }
                        className={inputClassName}
                      />
                    </div>
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [plan.id]: { ...draft, active: e.target.checked },
                        }))
                      }
                    />
                    Active (visible to readers)
                  </label>
                  <Button type="submit" className="mt-4" disabled={savingId === plan.id}>
                    {savingId === plan.id ? 'Saving…' : 'Save changes'}
                  </Button>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </AdminAuthGate>
  );
}
