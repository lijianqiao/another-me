import { useEffect } from "react";

import { useUiStore } from "../../store";

const AUTO_DISMISS_MS = 4000;

export default function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const timer = setTimeout(() => dismiss(oldest.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toasts, dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <span>{t.message}</span>
          <button className="toast__close" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
