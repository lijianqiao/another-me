/**
 * 推演结果页
 * 展示时间线卡片 + 未来来信 + 黑暗内容确认弹窗
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import ConfirmDialog from "../components/common/ConfirmDialog";
import FutureLetter from "../components/results/FutureLetter";
import TimelineCard from "../components/results/TimelineCard";
import { useSimulationStore } from "../store";

export default function ResultsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const result = useSimulationStore((s) => s.fullResult);
  const reset = useSimulationStore((s) => s.reset);

  const [darkConfirmed, setDarkConfirmed] = useState(false);

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

  const { timelines, letter, dark_content_warning, emotional_recovery_needed } =
    result;

  const showDarkDialog = dark_content_warning && !darkConfirmed;

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

      <div className="results-page__timelines">
        {timelines.map((tl, i) => (
          <TimelineCard key={tl.id} timeline={tl} index={i} />
        ))}
      </div>

      {letter && <FutureLetter letter={letter} />}
    </section>
  );
}
