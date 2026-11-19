import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const first = cardRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([data-close])',
      );
      first?.focus();
    }, 20);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-100"
      onMouseDown={onClose}
    >
      <div
        ref={cardRef}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          'w-full rounded-xl border border-kibo-border bg-kibo-surface shadow-2xl overflow-hidden flex flex-col',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-md',
          size === 'lg' && 'max-w-2xl',
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-kibo-border">
          <div className="flex-1">
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {description && (
              <p className="text-xs text-kibo-muted mt-1">{description}</p>
            )}
          </div>
          <button
            data-close
            onClick={onClose}
            className="text-kibo-muted hover:text-kibo-text rounded-md w-7 h-7 flex items-center justify-center hover:bg-kibo-border/50"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[70vh]">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-kibo-border bg-kibo-bg/40 flex items-center gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
