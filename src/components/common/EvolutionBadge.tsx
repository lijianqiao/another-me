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

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return "bg-blue-500";
      case 2:
        return "bg-purple-500";
      case 3:
        return "bg-pink-500";
      case 4:
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-card border border-border p-3">
      <div className={`flex items-center justify-center w-12 h-12 rounded-full ${getLevelColor(level)} text-white font-bold text-sm`}>
        Lv.{level}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-card-foreground">
          {t(`evolution.level_${level}`)}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("feedback.evolution_count", {
            feedback: info.feedback_count,
            simulations: info.total_simulations,
          })}
        </div>
      </div>
    </div>
  );
}
