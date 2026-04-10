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

  return (
    <div className="confirm-dialog__overlay" onClick={onCancel}>
      <div
        className={`confirm-dialog confirm-dialog--${kind}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-dialog__title">{title}</h3>
        <p className="confirm-dialog__message">{message}</p>
        <div className="confirm-dialog__actions">
          <button className="btn" onClick={onCancel}>
            {cancelText ?? t("common.cancel")}
          </button>
          <button className="btn btn--primary" onClick={onConfirm}>
            {confirmText ?? t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
