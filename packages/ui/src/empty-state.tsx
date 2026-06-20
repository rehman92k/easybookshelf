import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-6 py-12 text-center dark:border-stone-600 dark:bg-stone-900/30 ${className}`}
    >
      <h2 className="font-serif text-xl font-semibold text-stone-800 dark:text-stone-100">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-600 dark:text-stone-400">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
