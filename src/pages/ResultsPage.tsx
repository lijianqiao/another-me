/**
 * 推演结果页
 *
 * Sprint 6：决策树 + 走势图 + 标签切换
 * Sprint 7：锚定时间线按钮
 * Sprint 8：反馈按钮 + 画像修正
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import ConfirmDialog from "../components/common/ConfirmDialog";
import FutureLetter from "../components/results/FutureLetter";
import FeedbackButtons from "../components/results/FeedbackButtons";
import ProfileCorrectionDialog from "../components/results/ProfileCorrectionDialog";
import TimelineCard from "../components/results/TimelineCard";
import DecisionTree from "../components/results/DecisionTree";
import LifeChart from "../components/results/LifeChart";
import { getAnchorTimeline, setAnchorTimeline, clearAnchor } from "../api/history";
import type { ProfileCorrectionSuggestion } from "../api/feedback";
import { useSimulationStore, useUiStore } from "../store";

type Tab = "timelines" | "tree" | "chart";

export default function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const result = useSimulationStore((s) => s.fullResult);
  const reset = useSimulationStore((s) => s.reset);

  const [darkConfirmed, setDarkConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("timelines");
  const [isAnchored, setIsAnchored] = useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [correctionFeedbackId, setCorrectionFeedbackId] = useState("");
  const [corrections, setCorrections] = useState<ProfileCorrectionSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAnchorTimeline()
      .then((anchoredId) => {
        if (!cancelled && result) {
          setIsAnchored(anchoredId === result.decision_id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [result]);

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
    decision_id,
    timelines,
    letter,
    dark_content_warning,
    emotional_recovery_needed,
    decision_tree,
  } = result;

  const showDarkDialog = dark_content_warning && !darkConfirmed;
  const hasTree = !!decision_tree;
  const hasChart = timelines.some((tl) => tl.dimension_scores.length > 0);

  const handleToggleAnchor = async () => {
    try {
      if (isAnchored) {
        await clearAnchor(decision_id);
        setIsAnchored(false);
        pushToast("info", t("lifemap.anchor_cleared"));
      } else {
        await setAnchorTimeline(decision_id);
        setIsAnchored(true);
        pushToast("info", t("lifemap.anchor_set"));
      }
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
    }
  };

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
        <div className="results-page__actions">
          <button
            className={`btn btn--sm ${isAnchored ? "btn--anchor-active" : "btn--anchor"}`}
            onClick={handleToggleAnchor}
          >
            {isAnchored
              ? `⚓ ${t("results.anchored")}`
              : `⚓ ${t("results.set_anchor")}`}
          </button>
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

      {activeTab === "timelines" && (
        <div className="results-page__timelines">
          {timelines.map((tl, i) => (
            <TimelineCard key={tl.id} timeline={tl} index={i} />
          ))}
        </div>
      )}

      {activeTab === "tree" && hasTree && (
        <DecisionTree tree={decision_tree!} />
      )}

      {activeTab === "chart" && hasChart && (
        <LifeChart timelines={timelines} />
      )}

      {letter && <FutureLetter letter={letter} />}

      <FeedbackButtons
        decisionId={decision_id}
        onCorrections={(fid, corrs) => {
          setCorrectionFeedbackId(fid);
          setCorrections(corrs);
          setCorrectionDialogOpen(true);
        }}
      />

      <ProfileCorrectionDialog
        open={correctionDialogOpen}
        feedbackId={correctionFeedbackId}
        corrections={corrections}
        onClose={() => setCorrectionDialogOpen(false)}
      />
    </section>
  );
}
