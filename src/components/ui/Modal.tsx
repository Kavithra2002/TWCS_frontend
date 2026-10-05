'use client';

import clsx from 'clsx';
import { X, type LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
}

export function ModalIcon({ icon: Icon, tone = 'tea' }: { icon: LucideIcon; tone?: 'tea' | 'danger' }) {
  return (
    <span
      className={clsx(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        tone === 'danger' ? 'bg-red-500/15 text-red-300' : 'bg-tea-600/15 text-tea-300',
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function Modal({ open, title, description, icon, onClose, children, footer, panelClassName }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          'relative z-10 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl',
          panelClassName,
        )}
      >
        <div className="h-1 shrink-0 bg-gradient-to-r from-tea-500 via-tea-300 to-transparent" />
        <header className="flex items-start justify-between gap-4 px-6 pb-1 pt-5">
          <div className="flex items-start gap-3">
            {icon}
            <div>
              <h3 id="modal-title" className="text-base font-semibold tracking-tight text-slate-100">
                {title}
              </h3>
              {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children && <div className="overflow-y-auto px-6 pb-2 pt-5">{children}</div>}
        {footer && <footer className="flex justify-end gap-2 px-6 pb-6 pt-3">{footer}</footer>}
      </div>
    </div>
  );
}
