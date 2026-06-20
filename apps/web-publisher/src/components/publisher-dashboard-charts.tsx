'use client';

import type { BookStatus, PublisherEarnings } from '@easybookshelf/shared-types';
import { Card } from '@easybookshelf/ui';

interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

interface HorizontalBarChartProps {
  title: string;
  description?: string;
  items: ChartSegment[];
  emptyMessage?: string;
}

function HorizontalBarChart({ title, description, items, emptyMessage }: HorizontalBarChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>
      )}

      {total === 0 ? (
        <p className="mt-6 text-sm text-stone-500">{emptyMessage ?? 'No data yet'}</p>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-stone-600 dark:text-stone-300">{item.label}</span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

interface DonutChartProps {
  title: string;
  description?: string;
  items: ChartSegment[];
  formatValue?: (value: number) => string;
  emptyMessage?: string;
}

function DonutChart({ title, description, items, formatValue, emptyMessage }: DonutChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments =
    total > 0
      ? items
          .filter((item) => item.value > 0)
          .map((item) => {
            const fraction = item.value / total;
            const dash = fraction * circumference;
            const segment = { ...item, dash, gap: circumference - dash, offset };
            offset += dash;
            return segment;
          })
      : [];

  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>
      )}

      {total === 0 ? (
        <p className="mt-6 text-sm text-stone-500">{emptyMessage ?? 'No data yet'}</p>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-40 shrink-0">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="16"
                className="text-stone-100 dark:text-stone-800"
              />
              {segments.map((segment) => (
                <circle
                  key={segment.label}
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="16"
                  strokeDasharray={`${segment.dash} ${segment.gap}`}
                  strokeDashoffset={-segment.offset}
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs uppercase tracking-wide text-stone-500">Total</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatValue ? formatValue(total) : total}
              </span>
            </div>
          </div>

          <div className="w-full flex-1 space-y-3">
            {items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-stone-600 dark:text-stone-300">{item.label}</span>
                </div>
                <span className="font-medium tabular-nums">
                  {formatValue ? formatValue(item.value) : item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const STATUS_LABELS: Record<BookStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  archived: 'Archived',
};

const STATUS_COLORS: Record<BookStatus, string> = {
  draft: '#78716c',
  pending_review: '#d97706',
  approved: '#059669',
  rejected: '#dc2626',
  archived: '#a8a29e',
};

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface PublisherDashboardChartsProps {
  statusCounts: Record<BookStatus, number>;
  earnings: PublisherEarnings | null;
  orderCount: number;
}

export function PublisherDashboardCharts({
  statusCounts,
  earnings,
  orderCount,
}: PublisherDashboardChartsProps) {
  const bookItems: ChartSegment[] = (Object.keys(STATUS_LABELS) as BookStatus[]).map((status) => ({
    label: STATUS_LABELS[status],
    value: statusCounts[status],
    color: STATUS_COLORS[status],
  }));

  const earningsItems: ChartSegment[] = earnings
    ? [
        {
          label: 'Unsettled',
          value: earnings.unsettledEarnings,
          color: '#d97706',
        },
        {
          label: 'Pending payout',
          value: earnings.pendingPayout,
          color: '#2563eb',
        },
        {
          label: 'Total paid',
          value: earnings.totalPaid,
          color: '#059669',
        },
      ]
    : [];

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <HorizontalBarChart
        title="Books by status"
        description="How your titles are distributed across the publishing pipeline."
        items={bookItems}
        emptyMessage="Upload a book to see status breakdown."
      />

      <DonutChart
        title="Earnings overview"
        description="Unsettled sales, pending payouts, and completed payments."
        items={earningsItems}
        formatValue={formatInr}
        emptyMessage="Sales and payouts will appear here after your books go live."
      />

      <Card className="lg:col-span-2">
        <h2 className="font-serif text-lg font-semibold">Sales snapshot</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Orders contributing to unsettled earnings.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-stone-50 p-4 dark:bg-stone-800/50">
            <p className="text-sm text-stone-500">Unsettled orders</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{orderCount}</p>
          </div>
          <div className="rounded-lg bg-stone-50 p-4 dark:bg-stone-800/50">
            <p className="text-sm text-stone-500">Unsettled sales</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatInr(earnings?.unsettledSales ?? 0)}
            </p>
          </div>
          <div className="rounded-lg bg-stone-50 p-4 dark:bg-stone-800/50">
            <p className="text-sm text-stone-500">Pending payout</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatInr(earnings?.pendingPayout ?? 0)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function emptyStatusCounts(): Record<BookStatus, number> {
  return {
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    archived: 0,
  };
}
