import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}

export function StatCard({ label, value, hint, href }: StatCardProps) {
  const content = (
    <>
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          href ? 'text-amber-700 hover:underline dark:text-amber-400' : 'text-stone-900 dark:text-stone-50'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="block rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-amber-300 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-amber-800"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-900">
      {content}
    </div>
  );
}
