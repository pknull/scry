import { AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface ValidationMessageProps {
  message?: string | null;
  className?: string;
}

export function ValidationMessage({ message, className }: ValidationMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div className={clsx('mt-1 flex items-start gap-1.5 text-sm text-error', className)} role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
