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

export interface Toast {
  id: number;
  title: string;
  body: string;
  gamePk?: number;
}

type Ctx = {
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<Ctx | null>(null);
const AUTO_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef<Set<ReturnType<typeof window.setTimeout>>>(new Set());

  useEffect(() => () => { timers.current.forEach((h) => window.clearTimeout(h)); }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq.current;
      setToasts((cur) => [...cur, { ...t, id }].slice(-4));
      const handle = window.setTimeout(() => {
        dismiss(id);
        timers.current.delete(handle);
      }, AUTO_DISMISS_MS);
      timers.current.add(handle);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, pushToast, dismiss }), [toasts, pushToast, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}
