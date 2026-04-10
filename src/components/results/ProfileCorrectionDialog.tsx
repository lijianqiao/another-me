/**
 * 画像修正对话框
 * Sprint 8：根据反馈建议，让用户确认是否修正画像
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProfileCorrectionSuggestion } from "../../api/feedback";
import { applyCorrection } from "../../api/feedback";
import { useUiStore } from "../../store";

interface Props {
  open: boolean;
  feedbackId: string;
  corrections: ProfileCorrectionSuggestion[];
  onClose: () => void;
}

export default function ProfileCorrectionDialog({
  open,
  feedbackId,
  corrections,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  if (!open || corrections.length === 0) return null;

  const handleApply = async (c: ProfileCorrectionSuggestion) => {
    setLoading(true);
    try {
      await applyCorrection(feedbackId, c.field, c.new_value);
      setApplied((prev) => new Set(prev).add(c.field));
      pushToast("info", t("feedback.correction_applied"));
    } catch (err) {
      pushToast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-correction-overlay" onClick={onClose}>
      <div
        className="profile-correction-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t("feedback.correction_title")}</h3>
        <p className="profile-correction-dialog__desc">
          {t("feedback.correction_desc")}
        </p>

        <div className="profile-correction-dialog__list">
          {corrections.map((c) => (
            <div key={c.field} className="profile-correction-item">
              <div className="profile-correction-item__header">
                <span className="profile-correction-item__field">
                  {t(`feedback.field_${c.field}`, c.field)}
                </span>
                <span className="profile-correction-item__confidence">
                  {Math.round(c.confidence * 100)}%
                </span>
              </div>
              <div className="profile-correction-item__values">
                <span className="profile-correction-item__old">
                  {c.old_value || "-"}
                </span>
                <span className="profile-correction-item__arrow">&rarr;</span>
                <span className="profile-correction-item__new">
                  {c.new_value}
                </span>
              </div>
              {applied.has(c.field) ? (
                <span className="profile-correction-item__done">
                  {t("feedback.correction_applied")}
                </span>
              ) : (
                <button
                  className="btn btn--sm btn--primary"
                  onClick={() => handleApply(c)}
                  disabled={loading}
                >
                  {t("feedback.apply")}
                </button>
              )}
            </div>
          ))}
        </div>

        <button className="btn btn--sm" onClick={onClose}>
          {t("common.confirm")}
        </button>
      </div>
    </div>
  );
}
