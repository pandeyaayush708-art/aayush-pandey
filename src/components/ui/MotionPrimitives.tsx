import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastMessage } from '../../context/FarmContext';

export const PageTransition: React.FC<{ children: React.ReactNode; pageKey: string }> = ({
  children,
  pageKey,
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={pageKey}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const AnimatedNumber: React.FC<{ value: number; decimals?: number; suffix?: string }> = ({
  value,
  decimals = 0,
  suffix = '',
}) => {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = display;
    const diff = value - start;
    if (Math.abs(diff) < 0.001) {
      setDisplay(value);
      return;
    }
    const duration = 360;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + diff * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);

  return (
    <span className="tabular-nums">
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export const StatusBadge: React.FC<{
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'forest';
  children: React.ReactNode;
  liveTelemetry?: boolean;
}> = ({ tone, children, liveTelemetry }) => {
  const styles = {
    success: 'bg-[#EBF5EE] text-[#1B4332] border-[#C5DEC9]',
    warning: 'bg-[#FEF6E7] text-[#92400E] border-[#F3D9A4]',
    danger: 'bg-[#FDECEC] text-[#991B1B] border-[#F5C2C2]',
    neutral: 'bg-[#F3F0E8] text-[#3F4742] border-[#E4E1D8]',
    forest: 'bg-[#1B4332] text-[#FAF8F4] border-[#1B4332]',
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${styles}`}
    >
      {liveTelemetry && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}> = ({ open, onClose, title, subtitle, children, maxWidthClass = 'max-w-xl' }) => {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1F2421]/40"
          />
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-lg border border-[#E4E1D8] bg-white shadow-xl`}
          >
            <div className="flex items-start justify-between border-b border-[#E4E1D8] px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#1F2421]">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-[#5C6660]">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-[#5C6660] hover:bg-[#F3F0E8] hover:text-[#1F2421]"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}> = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }) => {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <p className="text-sm text-[#3F4742] leading-relaxed">{message}</p>
      <div className="mt-5 flex justify-end gap-2.5">
        <button
          onClick={onClose}
          className="rounded-md border border-[#E4E1D8] bg-white px-4 py-2 text-sm font-medium text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-md px-4 py-2 text-sm font-medium text-white active:scale-[0.98] transition whitespace-nowrap ${
            danger ? 'bg-[#B91C1C] hover:bg-[#991B1B]' : 'bg-[#1B4332] hover:bg-[#2D6A4F]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="rounded-lg border border-dashed border-[#D5D0C3] bg-[#FAF8F4] px-6 py-10 text-center">
    <p className="font-display text-sm font-semibold text-[#1F2421]">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-xs text-[#5C6660]">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = 'h-24 w-full' }) => (
  <div className={`animate-pulse rounded-md bg-[#EAE6DC] ${className}`} />
);

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon =
            t.type === 'success'
              ? CheckCircle2
              : t.type === 'warning'
              ? AlertTriangle
              : t.type === 'error'
              ? AlertCircle
              : Info;
          const border =
            t.type === 'success'
              ? 'border-[#C5DEC9] bg-[#F7FBF8]'
              : t.type === 'warning'
              ? 'border-[#F3D9A4] bg-[#FFFDF7]'
              : t.type === 'error'
              ? 'border-[#F5C2C2] bg-[#FFF8F8]'
              : 'border-[#E4E1D8] bg-white';
          const iconTone =
            t.type === 'success'
              ? 'text-[#1B4332]'
              : t.type === 'warning'
              ? 'text-[#B45309]'
              : t.type === 'error'
              ? 'text-[#B91C1C]'
              : 'text-[#5C6660]';
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.18 }}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border ${border} p-3 shadow-md`}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconTone}`} />
              <p className="flex-1 text-xs font-medium text-[#1F2421]">{t.title}</p>
              <button
                onClick={() => onDismiss(t.id)}
                className="text-[#7A827E] hover:text-[#1F2421]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
