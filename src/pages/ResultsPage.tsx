/**
 * 推演结果页
 *
 * Sprint 6：新增决策树 + 人生走势图 + 标签切换
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import ConfirmDialog from "../components/common/ConfirmDialog";
import FutureLetter from "../components/results/FutureLetter";
import TimelineCard from "../components/results/TimelineCard";
import DecisionTree from "../components/results/DecisionTree";
import LifeChart from "../components/results/LifeChart";
import { useSimulationStore } from "../store";

type Tab = "timelines" | "tree" | "chart";

export default function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const result = useSimulationStore((s) => s.fullResult);
  const reset = useSimulationStore((s) => s.reset);

  const [darkConfirmed, setDarkConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("timelines");

  if (!result) {
    return (
      <section className="results-page">
        <p>{t("results.no_result")}</p>
        <button
          className="btn btn--primary"
          onClick={() => navigate("/simulate")}
        >
          {t("results.go_simulate")}
        </button>
      </section>
    );
  }

  const {
    timelines,
    letter,
    dark_content_warning,
    emotional_recovery_needed,
    decision_tree,
  } = result;

  const showDarkDialog = dark_content_warning && !darkConfirmed;
  const hasTree = !!decision_tree;
  const hasChart = timelines.some((tl) => tl.dimension_scores.length > 0);

  return (
    <section className="results-page">
      <ConfirmDialog
        open={showDarkDialog}
        kind="warning"
        title={t("results.dark_dialog_title")}
        message={t("results.dark_dialog_message")}
        confirmText={t("results.dark_dialog_confirm")}
        cancelText={t("results.dark_dialog_cancel")}
        onConfirm={() => setDarkConfirmed(true)}
        onCancel={() => {
          reset();
          navigate("/simulate");
        }}
      />

      <div className="results-page__header">
        <h2>{t("results.title")}</h2>
        <button
          className="btn"
          onClick={() => {
            reset();
            navigate("/simulate");
          }}
        >
          {t("results.again")}
        </button>
      </div>

      {dark_content_warning && darkConfirmed && (
        <div className="results-page__warning">
          ⚠️ {t("results.dark_warning")}
        </div>
      )}

      {emotional_recovery_needed && (
        <div className="results-page__recovery">
          💙 {t("results.recovery_tip")}
        </div>
      )}

      {/* Tab 切换 */}
      {(hasTree || hasChart) && (
        <div className="results-page__tabs">
          <button
            className={`results-page__tab ${activeTab === "timelines" ? "results-page__tab--active" : ""}`}
            onClick={() => setActiveTab("timelines")}
          >
            {t("results.tab_timelines")}
          </button>
          {hasTree && (
            <button
              className={`results-page__tab ${activeTab === "tree" ? "results-page__tab--active" : ""}`}
              onClick={() => setActiveTab("tree")}
            >
              {t("results.tab_tree")}
            </button>
          )}
          {hasChart && (
            <button
              className={`results-page__tab ${activeTab === "chart" ? "results-page__tab--active" : ""}`}
              onClick={() => setActiveTab("chart")}
            >
              {t("results.tab_chart")}
            </button>
          )}
        </div>
      )}

      {/* 时间线卡片 */}
      {activeTab === "timelines" && (
        <div className="results-page__timelines">
          {timelines.map((tl, i) => (
            <TimelineCard key={tl.id} timeline={tl} index={i} />
          ))}
        </div>
      )}

      {/* 决策树 */}
      {activeTab === "tree" && hasTree && (
        <DecisionTree tree={decision_tree!} />
      )}

      {/* 人生走势图 */}
      {activeTab === "chart" && hasChart && (
        <LifeChart timelines={timelines} />
      )}

      {letter && <FutureLetter letter={letter} />}
    </section>
  );
}
