"use client";

import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "./button";
import { cn } from "@/lib/utils";
import type { Toast, ToastType } from "@/types";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

type ToastAction =
  | { type: "add"; toast: Toast }
  | { type: "remove"; id: string };

type ToastState = {
  toasts: Toast[];
};

type ToastContextType = {
  toast: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  toasts: Toast[];
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<ToastState>({ toasts: [] });
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addTimer = useCallback((id: string, duration: number) => {
    clearTimer(id);
    const timer = setTimeout(() => {
      setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      timersRef.current.delete(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, [clearTimer]);

  const handleAction = useCallback((action: ToastAction) => {
    if (action.type === "add") {
      setState((s) => ({ toasts: [action.toast, ...s.toasts].slice(0, TOAST_LIMIT) }));
      addTimer(action.toast.id, action.toast.duration ?? TOAST_REMOVE_DELAY);
      return;
    }

    clearTimer(action.id);
    setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== action.id) }));
  }, [addTimer, clearTimer]);

  useEffect(() => {
    return () => {
      // Reading the latest ref contents on unmount is intentional: we must
      // clear every timer created while the provider was mounted. Refs are
      // not reactive dependencies, so this effect intentionally has none.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timers = timersRef.current;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const toast = useCallback(
    (content: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      handleAction({ type: "add", toast: { ...content, id } });
      return id;
    },
    [handleAction],
  );

  const dismiss = useCallback((id: string) => {
    handleAction({ type: "remove", id });
  }, [handleAction]);

  const value = useMemo<ToastContextType>(
    () => ({ toast, dismiss, toasts: state.toasts }),
    [toast, dismiss, state.toasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const toastTypeStyles: Record<ToastType, { border: string; icon: string }> = {
  success: {
    border: "border-green-500/30",
    icon: "text-green-500",
  },
  error: {
    border: "border-rose-500/30",
    icon: "text-rose-500",
  },
  info: {
    border: "border-accent-blue/30",
    icon: "text-accent-blue",
  },
};

type ToastItemProps = {
  toast: Toast;
  onDismiss: (id: string) => void;
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const reduceMotion = useReducedMotion();
  const { border, icon } = toastTypeStyles[toast.type];

  return (
    <motion.div
      initial={reduceMotion ? {} : { opacity: 0, y: 20 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      exit={reduceMotion ? {} : { opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-ink-surface-elevated p-4 text-sm",
        border,
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("size-5 flex-shrink-0", icon)}>
        {toast.type === "success" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : toast.type === "error" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="text-text-secondary text-sm leading-relaxed">
            {toast.description}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Dismiss ${toast.title}`}
        className="ml-auto"
      >
        <svg className="size-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </Button>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full max-w-sm">
            <ToastItem toast={toast} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export type { Toast, ToastType };
