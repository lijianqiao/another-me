/**
 * 历史记录页
 *
 * 决策列表 + 点击查看历史推演结果 + 删除
 */
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import ConfirmDialog from "../components/common/ConfirmDialog";
import HistoryList from "../components/history/HistoryList";
import {
  listDecisions,
  getDecision,
  deleteDecision,
  type DecisionSummary,
} from "../api/history";
import { useSimulationStore, useUiStore } from "../store";

export default function HistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const setHistoricalResult = useSimulationStore(
    (s) => s.setHistoricalResult,
  );

  const [items, setItems] = useState<DecisionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listDecisions();
      setItems(list);
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
    } finally {
      setLoading(false);
    }
  }, [pushToast, t]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSelect = async (id: string) => {
    try {
      const detail = await getDecision(id);
      setHistoricalResult({
        decision_id: detail.result.decision_id,
        timelines: detail.result.timelines,
        letter: detail.result.letter
          ? { content: detail.result.letter, tone_type: "reflective", shine_points: [] }
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDecision(deleteTarget);
      pushToast("info", t("history.deleted"));
      setDeleteTarget(null);
      void loadList();
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
      setDeleteTarget(null);
    }
  };

  return (
    <section className="flex flex-col gap-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <ConfirmDialog
        open={!!deleteTarget}
        kind="warning"
        title={t("history.delete_confirm_title")}
        message={t("history.delete_confirm_msg")}
        confirmText={t("common.confirm")}
        cancelText={t("common.cancel")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight">{t("history.title")}</h2>
        {!loading && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {t("history.count", { n: items.length })}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <HistoryList items={items} onSelect={handleSelect} onDelete={(id) => setDeleteTarget(id)} />
      )}
    </section>
  );
}
