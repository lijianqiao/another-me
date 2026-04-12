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
      <div className="flex items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("lifemap.empty")}</p>
      </div>
    );
  }

  return (
    <div className="relative pl-0">
      <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-border -z-10" />
      {nodes.map((node) => {
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
            className={`flex gap-4 pt-4 pb-6 relative group ${isAnchored ? "is-anchored" : ""}`}
          >
            <div className="flex flex-col items-center w-5 shrink-0 z-10 pt-2">
              <span
                className={`w-3.5 h-3.5 rounded-full border-[3px] border-background ${
                  isAnchored
                    ? "bg-primary ring-2 ring-primary"
                    : "bg-muted-foreground ring-2 ring-muted-foreground"
                }`}
              />
            </div>

            <div className="flex-1 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <time className="text-xs text-muted-foreground">{dateStr}</time>
                {isAnchored && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                    ? {t("lifemap.anchored")}
                  </span>
                )}
              </div>

              <button
                className={`block w-full text-left p-4 bg-card border rounded-xl cursor-pointer transition-colors hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isAnchored ? "border-primary bg-primary/5" : "border-border"
                }`}
                onClick={() => onSelect(node.decision_id)}
              >
                <h4 className="m-0 mb-1 text-sm font-semibold text-card-foreground">
                  {node.node_label}
                </h4>
                <p className="m-0 text-sm text-muted-foreground leading-relaxed">
                  {node.outcome_summary}
                </p>
                {node.personality_changes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {node.personality_changes.map((c, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </button>

              <button
                className="mt-2 px-3 py-1 text-xs border border-border rounded-md bg-background text-muted-foreground cursor-pointer transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
