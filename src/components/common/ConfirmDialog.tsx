/**
 * 通用确认弹窗组件
 * 用于黑暗内容预警等需要用户确认的场景
 */
import { useTranslation } from "react-i18next";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  kind?: "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText,
  cancelText,
  kind = "info",
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  if (!open) return null;

  const bgClass = kind === "warning"
    ? "bg-card border-destructive/40 ring-1 ring-destructive/20"
    : "bg-card border-border";
  const titleClass = kind === "warning" ? "text-destructive" : "text-card-foreground";

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in"
      onClick={onCancel}
    >
      <div
        className={`rounded-lg border ${bgClass} p-6 shadow-xl max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`text-lg font-semibold ${titleClass} mb-2`}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {message}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            className="px-4 py-2 rounded-md text-sm font-medium hover:bg-muted border border-border text-foreground transition-colors"
            onClick={onCancel}
          >
            {cancelText ?? t("common.cancel")}
          </button>
          <button
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={onConfirm}
          >
            {confirmText ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
