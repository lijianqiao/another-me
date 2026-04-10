/**
 * 进化等级展示徽标
 * Sprint 8：根据反馈次数显示 Level 1-4
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getEvolutionInfo, type EvolutionInfo } from "../../api/feedback";

export default function EvolutionBadge() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<EvolutionInfo | null>(null);

  useEffect(() => {
    getEvolutionInfo()
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info) return null;

  const level = Math.min(Math.max(info.evolution_level, 1), 4);

  return (
    <div className="evolution-badge">
      <div className="evolution-badge__icon">Lv.{level}</div>
      <div className="evolution-badge__info">
        <span className="evolution-badge__level">
          {t(`evolution.level_${level}`)}
        </span>
        <span className="evolution-badge__count">
          {t("feedback.evolution_count", {
            feedback: info.feedback_count,
            simulations: info.total_simulations,
          })}
        </span>
      </div>
    </div>
  );
}
