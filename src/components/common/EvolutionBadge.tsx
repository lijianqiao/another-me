/**
 * 进化等级展示徽标
 * Sprint 8：根据反馈次数显示 Level 1-4
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getEvolutionInfo, type EvolutionInfo } from "../../api/feedback";

const LEVEL_NAMES: Record<number, { zh: string; en: string; icon: string }> = {
  1: { zh: "初识", en: "Novice", icon: "1" },
  2: { zh: "渐知", en: "Familiar", icon: "2" },
  3: { zh: "深知", en: "Insightful", icon: "3" },
  4: { zh: "知己", en: "Confidant", icon: "4" },
};

export default function EvolutionBadge() {
  const { t, i18n } = useTranslation();
  const [info, setInfo] = useState<EvolutionInfo | null>(null);

  useEffect(() => {
    getEvolutionInfo()
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info) return null;

  const levelMeta = LEVEL_NAMES[info.evolution_level] ?? LEVEL_NAMES[1];
  const lang = i18n.language.startsWith("zh") ? "zh" : "en";

  return (
    <div className="evolution-badge">
      <div className="evolution-badge__icon">Lv.{levelMeta.icon}</div>
      <div className="evolution-badge__info">
        <span className="evolution-badge__level">
          {levelMeta[lang]}
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
