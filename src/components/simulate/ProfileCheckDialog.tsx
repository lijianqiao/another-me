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
    <div className="profile-check-overlay">
      <div className="profile-check">
        <h3 className="profile-check__title">
          {t("simulate.profile_check_title")}
        </h3>
        <p className="profile-check__desc">
          {t("simulate.profile_check_desc")}
        </p>

        <div className="profile-check__summary">
          <div className="profile-check__row">
            <span className="profile-check__label">
              {t("onboarding.step_basic")}
            </span>
            <span>{profile.occupation}</span>
          </div>
          <div className="profile-check__row">
            <span className="profile-check__label">
              {t("onboarding.step_personality")}
            </span>
            <span>{profile.personality_tags.join("、")}</span>
          </div>
          {profile.relationship_status && (
            <div className="profile-check__row">
              <span className="profile-check__label">
                {t("simulate.relationship")}
              </span>
              <span>{profile.relationship_status}</span>
            </div>
          )}
        </div>

        <div className="profile-check__actions">
          <button className="btn btn--primary" onClick={onContinue}>
            {t("simulate.profile_no_change")}
          </button>
          <button className="btn" onClick={onEdit}>
            {t("simulate.profile_update")}
          </button>
        </div>
      </div>
    </div>
  );
}
