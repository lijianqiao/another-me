import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
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
      pushToast("error", t("errors.generic", { detail: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-popover p-6 shadow-xl border border-border rounded-xl animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold leading-none tracking-tight text-foreground mb-2">{t("feedback.correction_title")}</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {t("feedback.correction_desc")}
        </p>

        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 mb-6">
          {corrections.map((c) => (
            <div key={c.field} className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card shadow-sm transition-colors hover:border-border/80">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground tracking-wide capitalize">
                  {t(`feedback.field_${c.field}`, c.field)}
                </span>
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                  {Math.round(c.confidence * 100)}% 准确率
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md font-mono mt-1">
                <span className="truncate max-w-[40%] text-muted-foreground/80 line-through">
                  {c.old_value || "无"}
                </span>
                <span className="text-muted-foreground/40 shrink-0">&rarr;</span>  
                <span className="text-foreground font-medium truncate flex-1">
                  {c.new_value}
                </span>
              </div>
              <div className="mt-2 flex justify-end">
                {applied.has(c.field) ? (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-md">
                    <Check className="w-3.5 h-3.5" />
                    {t("feedback.correction_applied")}
                  </span>
                ) : (
                  <button
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
                    onClick={() => handleApply(c)}
                    disabled={loading}
                  >
                    {t("feedback.apply")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-6 py-2" onClick={onClose}>
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
