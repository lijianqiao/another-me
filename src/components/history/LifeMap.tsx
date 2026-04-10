/**
 * 人生地图 — 纵向时间轴
 *
 * 展示所有决策推演的因果关系，锚定节点高亮
 */
import { useTranslation } from "react-i18next";

import type { LifeMapNode } from "../../api/history";

interface Props {
  nodes: LifeMapNode[];
  anchoredDecisionId: string | null;
  onSelect: (decisionId: string) => void;
  onToggleAnchor: (decisionId: string, isAnchored: boolean) => void;
}

export default function LifeMap({
  nodes,
  anchoredDecisionId,
  onSelect,
  onToggleAnchor,
}: Props) {
  const { t } = useTranslation();

  if (nodes.length === 0) {
    return (
      <div className="lifemap-empty">
        <p>{t("lifemap.empty")}</p>
      </div>
    );
  }

  return (
    <div className="lifemap">
      <div className="lifemap__line" />
      {nodes.map((node, idx) => {
        const isAnchored = node.decision_id === anchoredDecisionId;
        const date = new Date(node.node_date);
        const dateStr = date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        return (
          <div
            key={node.id}
            className={`lifemap__node ${isAnchored ? "lifemap__node--anchored" : ""}`}
          >
            <div className="lifemap__dot-col">
              <span
                className={`lifemap__dot ${isAnchored ? "lifemap__dot--anchored" : ""}`}
              />
              {idx < nodes.length - 1 && <span className="lifemap__connector" />}
            </div>

            <div className="lifemap__content">
              <div className="lifemap__meta">
                <time className="lifemap__date">{dateStr}</time>
                {isAnchored && (
                  <span className="lifemap__anchor-badge">
                    ⚓ {t("lifemap.anchored")}
                  </span>
                )}
              </div>

              <button
                className="lifemap__card"
                onClick={() => onSelect(node.decision_id)}
              >
                <h4 className="lifemap__label">{node.node_label}</h4>
                <p className="lifemap__outcome">{node.outcome_summary}</p>
                {node.personality_changes.length > 0 && (
                  <div className="lifemap__changes">
                    {node.personality_changes.map((c, i) => (
                      <span key={i} className="lifemap__change-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </button>

              <button
                className="lifemap__anchor-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAnchor(node.decision_id, isAnchored);
                }}
              >
                {isAnchored
                  ? t("lifemap.unanchor")
                  : t("lifemap.set_anchor")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
