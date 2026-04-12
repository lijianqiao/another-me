
/**
 * 当下闪光点组件
 * 在来信末尾强制展示，提醒用户珍惜当下
 */
import { useTranslation } from "react-i18next";

interface Props {
  points: string[];
}

export default function ShinePoints({ points }: Props) {
  const { t } = useTranslation();
  if (points.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg bg-card border border-border p-4">
      <h4 className="text-sm font-semibold text-card-foreground">
        {t("letter.shine_title")}
      </h4>
      <ul className="space-y-2">
        {points.map((point, i) => (
          <li key={i} className="text-sm text-card-foreground flex items-start gap-2">
            <span className="text-primary mt-1">✨</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

