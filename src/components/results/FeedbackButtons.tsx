import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
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
      pushToast("error", t("errors.generic", { detail: String(err) }));
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
      pushToast("error", t("errors.generic", { detail: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 mt-12 pt-8 border-t border-border animate-in fade-in">
        <span className="text-sm font-medium px-4 py-2 bg-green-500/10 text-green-600 rounded-full flex items-center gap-2">
          <Check className="w-4 h-4" /> {t("feedback.submitted")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 mt-12 pt-8 border-t border-border">
      {!showReasons && (
        <div className="flex items-center justify-center gap-4 w-full">
          <button
            className="w-full sm:w-auto px-6 py-2.5 rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium shadow-sm transition-colors"
            onClick={handleNotMe}
            disabled={loading}
          >
            {t("feedback.not_me")}
          </button>
          <button
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium shadow-sm transition-colors"
            onClick={handleAccurate}
            disabled={loading}
          >
            {t("feedback.accurate")}
          </button>
        </div>
      )}

      {showReasons && (
        <div className="w-full max-w-md bg-card border border-border shadow-lg rounded-xl p-5 space-y-4 animate-in fade-in zoom-in-95">
          <p className="text-base font-semibold text-foreground">
            {t("feedback.why_not_me")}
          </p>
          <div className="flex flex-col gap-3 my-4">
            {NOT_ME_REASONS.map((r) => (
              <label key={r.key} className="flex items-center gap-3 text-sm cursor-pointer group py-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary"
                  checked={selectedReasons.includes(r.key)}
                  onChange={() => toggleReason(r.key)}
                />
                <span className="text-foreground group-hover:text-foreground/80">{t(r.labelKey)}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
            <button
              className="inline-flex items-center justify-center text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md"
              onClick={() => {
                setShowReasons(false);
                setSelectedReasons([]);
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              className="inline-flex items-center justify-center text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 rounded-md disabled:pointer-events-none disabled:opacity-50"
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
