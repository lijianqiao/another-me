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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { getAnchorTimeline, setAnchorTimeline, clearAnchor } from "../api/history";
import type { ProfileCorrectionSuggestion } from "../api/feedback";
import { downloadDir } from "@tauri-apps/api/path";

import { exportDecisionJson } from "../api/export";
import { openPathInExplorer } from "../api/system";
import { downloadAsFile, exportElementAsPng } from "../utils/export";
import { useSimulationStore, useUiStore } from "../store";

type Tab = "timelines" | "tree" | "chart" | "letter";

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
      .catch((err) => {
        if (!cancelled) {
          pushToast("warning", t("errors.generic", { detail: String(err) }));
        }
      });
    return () => { cancelled = true; };
  }, [result, pushToast, t]);

  if (!result) {
    return (
      <section className="flex flex-col items-center justify-center h-full gap-4 mt-20 fade-in animate-in">
        <p className="text-muted-foreground">{t("results.no_result")}</p>
        <button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 transition-colors"
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
    <section className="w-full max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-b border-border pb-4">
        <h2 className="text-3xl font-bold tracking-tight text-foreground font-serif">{t("results.title")}</h2>
        <div className="flex flex-wrap items-center justify-start gap-3 w-full md:w-auto">
          <button
            className={`inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border bg-background shadow-sm h-8 px-3 ${isAnchored ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" : "border-input hover:bg-accent hover:text-accent-foreground"}`}
            onClick={handleToggleAnchor}
          >
            {isAnchored
              ? `📌 ${t("results.anchored")}`
              : `📌 ${t("results.set_anchor")}`}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
              >
                {t("results.export")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem
                onSelect={async () => {
                  try {
                    const json = await exportDecisionJson(decision_id);
                    downloadAsFile(json, `another-me-${decision_id.slice(0, 8)}.json`);
                    const dir = await downloadDir();
                    pushToast("info", t("results.export_done_downloads"), {
                      label: t("results.open_downloads_folder"),
                      onClick: () => { void openPathInExplorer(dir); },
                    });
                  } catch (err) {
                    pushToast("error", t("errors.generic", { detail: String(err) }));
                  }
                }}
              >
                JSON
              </DropdownMenuItem>
              {hasTree && (
                <DropdownMenuItem
                  onSelect={async () => {
                    try {
                      await exportElementAsPng(
                        ".results-export-snapshot .decision-tree",
                        `decision-tree-${decision_id.slice(0, 8)}.png`,
                      );
                      const dir = await downloadDir();
                      pushToast("info", t("results.export_done_downloads"), {
                        label: t("results.open_downloads_folder"),
                        onClick: () => { void openPathInExplorer(dir); },
                      });
                    } catch (err) {
                      pushToast("error", t("errors.generic", { detail: String(err) }));
                    }
                  }}
                >
                  PNG
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 transition-colors"
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
        <div className="p-4 rounded-lg border text-sm font-medium flex items-center gap-2 border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-500">
          ⚠️ {t("results.dark_warning")}
        </div>
      )}

      {emotional_recovery_needed && (
        <div className="p-4 rounded-lg border text-sm font-medium flex items-center gap-2 border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400">
          💖 {t("results.recovery_tip")}
        </div>
      )}

      {(hasTree || hasChart) && (
        <div className="flex flex-wrap items-center gap-2 p-1 bg-muted/50 rounded-lg w-fit">
          <button
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none text-muted-foreground hover:bg-background/50 hover:text-foreground ${activeTab === "timelines" ? "bg-background text-foreground shadow-sm hover:bg-background" : ""}`}
            onClick={() => setActiveTab("timelines")}
          >
            {t("results.tab_timelines")}
          </button>
          {hasTree && (
            <button
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none text-muted-foreground hover:bg-background/50 hover:text-foreground ${activeTab === "tree" ? "bg-background text-foreground shadow-sm hover:bg-background" : ""}`}
              onClick={() => setActiveTab("tree")}
            >
              {t("results.tab_tree")}
            </button>
          )}
          {hasChart && (
            <button
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none text-muted-foreground hover:bg-background/50 hover:text-foreground ${activeTab === "chart" ? "bg-background text-foreground shadow-sm hover:bg-background" : ""}`}
              onClick={() => setActiveTab("chart")}
            >
              {t("results.tab_chart")}
            </button>
          )}
          {letter && (
            <button
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none text-muted-foreground hover:bg-background/50 hover:text-foreground ${activeTab === "letter" ? "bg-background text-foreground shadow-sm hover:bg-background" : ""}`}
              onClick={() => setActiveTab("letter")}
            >
              {t("results.tab_letter")}
            </button>
          )}
        </div>
      )}

      {activeTab === "timelines" && (
        <div className="space-y-4">
          {timelines.map((tl, i) => (
            <TimelineCard key={tl.id} timeline={tl} index={i} />
          ))}
        </div>
      )}

      {activeTab === "tree" && hasTree && (
        <DecisionTree tree={decision_tree!} />
      )}

      {hasTree && (
        <div className="results-export-snapshot opacity-0 absolute pointer-events-none" aria-hidden>
          <DecisionTree tree={decision_tree!} />
        </div>
      )}

      {activeTab === "chart" && hasChart && (
        <LifeChart timelines={timelines} />
      )}

      {activeTab === "letter" && letter && <FutureLetter letter={letter} />}

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
