import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-amber-700 text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500',
  secondary:
    'bg-stone-200 text-stone-900 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-100 dark:hover:bg-stone-600',
  ghost:
    'bg-transparent text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-serif text-xl font-semibold tracking-tight text-amber-900 dark:text-amber-200 ${className}`}
    >
      EasyBookshelf
    </span>
  );
}

export { PasswordInput } from './password-input';
export type { PasswordInputProps } from './password-input';
export { Alert } from './alert';
export { Badge } from './badge';
export { Card } from './card';
export { EmptyState } from './empty-state';
export { PageHeader } from './page-header';
export { PageLoading } from './page-loading';
export type { OtpVerificationProps, OtpChannel } from './otp-verification';
export { OtpVerification, PhoneOtpVerification } from './otp-verification';
export { StatCard } from './stat-card';
export { inputClassName, labelClassName } from './styles';
