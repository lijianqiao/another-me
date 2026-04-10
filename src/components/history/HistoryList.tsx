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
      <div className="history-empty">
        <p>{t("history.empty")}</p>
      </div>
    );
  }

  return (
    <ul className="history-list">
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
          <li key={item.id} className="history-list__item">
            <button
              className="history-list__card"
              onClick={() => onSelect(item.id)}
            >
              <div className="history-list__meta">
                <time className="history-list__date">{dateStr}</time>
                <span className="history-list__horizon">
                  {HORIZON_MAP[item.time_horizon] ?? item.time_horizon}{" "}
                  {t("simulate.year")}
                </span>
                {item.drama_level > 2 && (
                  <span className="history-list__badge history-list__badge--drama">
                    {t(`settings.drama_${item.drama_level}`)}
                  </span>
                )}
                {item.black_swan_enabled && (
                  <span className="history-list__badge history-list__badge--swan">
                    🦢
                  </span>
                )}
                {item.is_anchored && (
                  <span className="history-list__badge history-list__badge--anchor">
                    ⚓
                  </span>
                )}
              </div>
              <p className="history-list__text">{item.decision_text}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
