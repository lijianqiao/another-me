/**
 * 决策历史列表
 *
 * 展示决策摘要卡片，点击进入历史结果详情
 */
import { useTranslation } from "react-i18next";

import type { DecisionSummary } from "../../api/history";

interface Props {
  items: DecisionSummary[];
  onSelect: (id: string) => void;
}

const HORIZON_MAP: Record<string, string> = {
  "1y": "1",
  "3y": "3",
  "5y": "5",
  "10y": "10",
};

export default function HistoryList({ items, onSelect }: Props) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const date = new Date(item.created_at);
        const dateStr = date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <li key={item.id}>
            <button
              className="w-full flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onSelect(item.id)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <time className="text-xs font-medium text-muted-foreground">
                  {dateStr}
                </time>
                <span className="text-xs text-muted-foreground">
                  {HORIZON_MAP[item.time_horizon] ?? item.time_horizon}{" "}
                  {t("simulate.year")}
                </span>
                {item.drama_level > 2 && (
                  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                    {t(`settings.drama_${item.drama_level}`)}
                  </span>
                )}
                {item.black_swan_enabled && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium dark:bg-purple-900">
                    ??
                  </span>
                )}
                {item.is_anchored && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium dark:bg-blue-900">
                    ?
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-sm font-medium">{item.decision_text}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
