'use client';

import { useEffect, useState } from 'react';
import type { PlatformCommerceSettings } from '@easybookshelf/shared-types';
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
import { fetchCommerceSettings, updateCommerceSettings } from '@/lib/admin';

function percentLabel(rate: number) {
  return `${Math.round(rate * 1000) / 10}%`;
}

function rateInput(value: number) {
  return String(Math.round(value * 1000) / 10);
}

function parseRateInput(value: string) {
  return Math.round(Number(value) * 10) / 1000;
}

export default function AdminCommissionPage() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<PlatformCommerceSettings | null>(null);
  const [draft, setDraft] = useState({
    purchaseCommissionPercent: '15',
    rentalCommissionPercent: '10',
    subscriberDiscountPercent: '10',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        const data = await fetchCommerceSettings();
        setSettings(data);
        setDraft({
          purchaseCommissionPercent: rateInput(data.purchaseCommissionRate),
          rentalCommissionPercent: rateInput(data.rentalCommissionRate),
          subscriberDiscountPercent: rateInput(data.subscriberPurchaseDiscountRate),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user, canManage]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCommerceSettings({
        purchaseCommissionRate: parseRateInput(draft.purchaseCommissionPercent),
        rentalCommissionRate: parseRateInput(draft.rentalCommissionPercent),
        subscriberPurchaseDiscountRate: parseRateInput(draft.subscriberDiscountPercent),
      });
      setSettings(updated);
      setMessage('Commerce settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminAuthGate
      loginNext="/commission"
      requireRoles={['super_admin', 'admin_finance', 'admin_content']}
      deniedDescription="Requires super_admin, admin_finance, or admin_content role."
    >
      <PageHeader
        title="Commission & member pricing"
        description="Platform commission on purchases and rentals. Ad-free subscribers get a purchase discount; publisher share is calculated on the list price."
      />

      {loading ? (
        <PageLoading message="Loading settings…" />
      ) : (
        <form onSubmit={handleSave} className="mx-auto max-w-2xl space-y-6">
          {error && <Alert variant="error">{error}</Alert>}
          {message && <Alert variant="success">{message}</Alert>}

          <Card>
            <h2 className="font-serif text-lg font-semibold">Platform commission</h2>
            <p className="mt-1 text-sm text-stone-500">
              Applied to list price. Per-publisher overrides still take precedence when set.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClassName}>Purchase commission (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={draft.purchaseCommissionPercent}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, purchaseCommissionPercent: e.target.value }))
                  }
                  className={inputClassName}
                />
                <p className="mt-1 text-xs text-stone-400">Default 15% — publisher receives the rest</p>
              </div>
              <div>
                <label className={labelClassName}>Rental commission (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={draft.rentalCommissionPercent}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, rentalCommissionPercent: e.target.value }))
                  }
                  className={inputClassName}
                />
                <p className="mt-1 text-xs text-stone-400">Default 10% on 15/30-day rentals</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-serif text-lg font-semibold">Ad-free member discount</h2>
            <p className="mt-1 text-sm text-stone-500">
              Percent off list price on purchases only (not rentals). Publisher share stays based on
              list price.
            </p>
            <div className="mt-4">
              <label className={labelClassName}>Subscriber purchase discount (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={draft.subscriberDiscountPercent}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, subscriberDiscountPercent: e.target.value }))
                }
                className={`${inputClassName} sm:max-w-xs`}
              />
            </div>
          </Card>

          {settings && (
            <p className="text-sm text-stone-500">
              Current: purchase {percentLabel(settings.purchaseCommissionRate)}, rental{' '}
              {percentLabel(settings.rentalCommissionRate)}, member discount{' '}
              {percentLabel(settings.subscriberPurchaseDiscountRate)} on buys.
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </form>
      )}
    </AdminAuthGate>
  );
}
