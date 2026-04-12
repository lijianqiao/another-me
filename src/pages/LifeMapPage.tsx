/**
 * 人生地图页
 *
 * Sprint 7：纵向时间轴展示所有决策 + 因果关系 + 锚定交互
 */
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import LifeMap from "../components/history/LifeMap";
import {
  getLifeMap,
  getDecision,
  getAnchorTimeline,
  setAnchorTimeline,
  clearAnchor,
  type LifeMapNode,
} from "../api/history";
import { useSimulationStore, useUiStore } from "../store";

export default function LifeMapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const setHistoricalResult = useSimulationStore(
    (s) => s.setHistoricalResult,
  );

  const [nodes, setNodes] = useState<LifeMapNode[]>([]);
  const [anchoredId, setAnchoredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mapNodes, anchored] = await Promise.all([
        getLifeMap(),
        getAnchorTimeline(),
      ]);
      setNodes(mapNodes);
      setAnchoredId(anchored);
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
    } finally {
      setLoading(false);
    }
  }, [pushToast, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelect = async (decisionId: string) => {
    try {
      const detail = await getDecision(decisionId);
      setHistoricalResult({
        decision_id: detail.result.decision_id,
        timelines: detail.result.timelines,
        letter: detail.result.letter
          ? {
            content: detail.result.letter,
            tone_type: "reflective",
            shine_points: [],
          }
          : null,
        dark_content_warning: false,
        emotional_recovery_needed: false,
        shine_points: [],
        decision_tree: detail.result.decision_tree ?? undefined,
      });
      navigate("/results");
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
    }
  };

  const handleToggleAnchor = async (
    decisionId: string,
    isAnchored: boolean,
  ) => {
    try {
      if (isAnchored) {
        await clearAnchor(decisionId);
        setAnchoredId(null);
        pushToast("info", t("lifemap.anchor_cleared"));
      } else {
        await setAnchorTimeline(decisionId);
        setAnchoredId(decisionId);
        pushToast("info", t("lifemap.anchor_set"));
      }
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
    }
  };

  return (
    <section className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t("lifemap.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("lifemap.subtitle")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <LifeMap
          nodes={nodes}
          anchoredDecisionId={anchoredId}
          onSelect={handleSelect}
          onToggleAnchor={handleToggleAnchor}
        />
      )}
    </section>
  );
}
