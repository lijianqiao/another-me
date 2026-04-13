/**
 * 画像动态修正弹窗
 *
 * 每次推演前弹出，提示用户确认画像是否有变化
 */
import { useTranslation } from "react-i18next";

import { useProfileStore } from "../../store";

interface Props {
  open: boolean;
  onContinue: () => void;
  onEdit: () => void;
}

export default function ProfileCheckDialog({
  open,
  onContinue,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const profile = useProfileStore((s) => s.profile);

  if (!open || !profile) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
      onClick={onContinue}
    >
      <div
        className="w-full max-w-md bg-popover border border-border rounded-xl p-6 shadow-xl animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t("simulate.profile_check_title")}
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          {t("simulate.profile_check_desc")}
        </p>

        <div className="space-y-2 mb-6 bg-muted/40 rounded-lg p-4 border border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">
              {t("onboarding.step_basic")}
            </span>
            <span className="text-foreground">{profile.occupation}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">
              {t("onboarding.step_personality")}
            </span>
            <span className="text-foreground truncate max-w-[60%] text-right">
              {profile.personality_tags.join("、")}
            </span>
          </div>
          {profile.relationship_status && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">
                {t("simulate.relationship")}
              </span>
              <span className="text-foreground">
                {profile.relationship_status}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            onClick={onEdit}
          >
            {t("simulate.profile_update")}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 shadow-sm"
            onClick={onContinue}
          >
            {t("simulate.profile_no_change")}
          </button>
        </div>
      </div>
    </div>
  );
}

