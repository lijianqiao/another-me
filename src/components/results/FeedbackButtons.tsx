/**
 * 反馈按钮组
 * Sprint 8：「这很不我」/「这太准了」 + 原因选择弹出
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  submitFeedback,
  type ProfileCorrectionSuggestion,
} from "../../api/feedback";
import { useUiStore } from "../../store";

const NOT_ME_REASONS = [
  { key: "personality", labelKey: "feedback.reason_personality" },
  { key: "financial", labelKey: "feedback.reason_financial" },
  { key: "social", labelKey: "feedback.reason_social" },
  { key: "relationship", labelKey: "feedback.reason_relationship" },
  { key: "too_optimistic", labelKey: "feedback.reason_optimistic" },
  { key: "too_pessimistic", labelKey: "feedback.reason_pessimistic" },
  { key: "occupation", labelKey: "feedback.reason_occupation" },
];

interface Props {
  decisionId: string;
  onCorrections?: (
    feedbackId: string,
    corrections: ProfileCorrectionSuggestion[],
  ) => void;
}

export default function FeedbackButtons({
  decisionId,
  onCorrections,
}: Props) {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);

  const [submitted, setSubmitted] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAccurate = async () => {
    setLoading(true);
    try {
      await submitFeedback({
        decision_id: decisionId,
        feedback_type: "accurate",
        reasons: [],
      });
      setSubmitted(true);
      pushToast("info", t("feedback.thanks_accurate"));
    } catch (err) {
      pushToast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleNotMe = () => {
    setShowReasons(true);
  };

  const toggleReason = (key: string) => {
    setSelectedReasons((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    );
  };

  const handleSubmitNotMe = async () => {
    if (selectedReasons.length === 0) return;
    setLoading(true);
    try {
      const result = await submitFeedback({
        decision_id: decisionId,
        feedback_type: "not_me",
        reasons: selectedReasons,
      });
      setSubmitted(true);
      setShowReasons(false);
      pushToast("info", t("feedback.thanks_not_me"));

      if (result.corrections.length > 0 && onCorrections) {
        onCorrections(result.feedback_id, result.corrections);
      }
    } catch (err) {
      pushToast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="feedback-buttons feedback-buttons--done">
        <span className="feedback-buttons__thanks">
          {t("feedback.submitted")}
        </span>
      </div>
    );
  }

  return (
    <div className="feedback-buttons">
      {!showReasons && (
        <div className="feedback-buttons__row">
          <button
            className="btn btn--feedback btn--not-me"
            onClick={handleNotMe}
            disabled={loading}
          >
            {t("feedback.not_me")}
          </button>
          <button
            className="btn btn--feedback btn--accurate"
            onClick={handleAccurate}
            disabled={loading}
          >
            {t("feedback.accurate")}
          </button>
        </div>
      )}

      {showReasons && (
        <div className="feedback-reasons">
          <p className="feedback-reasons__title">
            {t("feedback.why_not_me")}
          </p>
          <div className="feedback-reasons__list">
            {NOT_ME_REASONS.map((r) => (
              <label key={r.key} className="feedback-reasons__item">
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(r.key)}
                  onChange={() => toggleReason(r.key)}
                />
                <span>{t(r.labelKey)}</span>
              </label>
            ))}
          </div>
          <div className="feedback-reasons__actions">
            <button
              className="btn btn--sm"
              onClick={() => {
                setShowReasons(false);
                setSelectedReasons([]);
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              className="btn btn--sm btn--primary"
              onClick={handleSubmitNotMe}
              disabled={selectedReasons.length === 0 || loading}
            >
              {loading ? t("common.loading") : t("feedback.submit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
