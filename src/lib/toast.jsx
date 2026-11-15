import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ToastContext = createContext(null);

/**
 * Small notes that rise from the bottom and go: "Done · Undo", "Abra
 * finished …". At most three at once, newest at the bottom, each with an
 * optional action. They never block a tap on the page.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((now) => now.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  /** @param {{ title: string, body?: string, icon?: any, tone?: string, action?: { label: string, onClick: () => void }, duration?: number }} toast */
  const toast = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((now) => [...now.slice(-2), { ...toast, id }]);
      timers.current.set(id, setTimeout(() => dismiss(id), toast.duration || (toast.action ? 5000 : 3600)));
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="cc-toasts" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.id}
                layout
                className="cc-toast"
                role="status"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.16 } }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                {Icon ? (
                  <span className={`cc-toast-icon tone-${t.tone || "green"}`} aria-hidden="true">
                    <Icon size={15} strokeWidth={2.4} />
                  </span>
                ) : null}
                <div className="cc-toast-text">
                  <p className="t-foot cc-label" style={{ fontWeight: 600 }}>
                    {t.title}
                  </p>
                  {t.body ? <p className="t-cap1 cc-tertiary cc-clip">{t.body}</p> : null}
                </div>
                {t.action ? (
                  <button
                    type="button"
                    className="cc-toast-action"
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
