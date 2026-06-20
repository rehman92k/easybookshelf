'use client';

import type { ReactNode } from 'react';

interface ReaderToolbarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  progressPercent?: number;
}

export function ReaderToolbar({ left, center, right, progressPercent }: ReaderToolbarProps) {
  return (
    <div className="border-b border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">{left}</div>
        <div className="flex items-center justify-center gap-2">{center}</div>
        <div className="flex flex-1 items-center justify-end gap-1">{right}</div>
      </div>
      {progressPercent !== undefined && (
        <div className="h-1 bg-stone-100 dark:bg-stone-800">
          <div
            className="h-full bg-amber-600 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToolbarButton({
  onClick,
  disabled,
  active,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${
        active
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
          : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
      }`}
    >
      {children}
    </button>
  );
}
