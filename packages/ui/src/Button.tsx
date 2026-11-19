import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn.js';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3 text-sm',
        variant === 'primary' &&
          'bg-indigo-500 hover:bg-indigo-400 text-white focus:ring-indigo-500/40',
        variant === 'ghost' && 'bg-transparent hover:bg-white/5 text-neutral-200',
        variant === 'outline' &&
          'bg-transparent border border-neutral-700 hover:border-neutral-500 text-neutral-200',
        className,
      )}
    />
  );
}
