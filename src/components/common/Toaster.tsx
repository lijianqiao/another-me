import { useEffect } from "react";
import { X } from "lucide-react";

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

  const getBgClass = (kind: string) => {
    switch (kind) {
      case "error":
        return "bg-destructive text-destructive-foreground";
      case "success":
        return "bg-green-600 text-white";
      case "warning":
        return "bg-yellow-600 text-white";
      default:
        return "bg-card text-card-foreground border border-border";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg p-3 flex items-start justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 ${getBgClass(t.kind)}`}
        >
          <span className="text-sm flex-1">
            {t.message}
            {t.action && (
              <button
                type="button"
                className="ml-3 font-semibold hover:opacity-80 transition-opacity underline"
                onClick={() => {
                  if (t.action && t.action.onClick) t.action.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </span>
          <button
            className="flex-shrink-0 hover:opacity-70 transition-opacity"
            onClick={() => dismiss(t.id)}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
