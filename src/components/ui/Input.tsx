import { clsx } from 'clsx';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={clsx(
        'w-full px-3 py-2 rounded-md text-sm',
        'bg-bg-secondary text-text border',
        'placeholder:text-text-faint',
        'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error ? 'border-error' : 'border-border',
        className
      )}
      {...props}
    />
  );
}
