/**
 * 推演页 — 决策录入 + 画像确认 + 加载状态 + 错误处理
 *
 * Sprint 6：增加 ProfileCheckDialog
 */
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import DecisionInput from "../components/simulate/DecisionInput";
import SimulationLoading from "../components/simulate/SimulationLoading";
import ProfileCheckDialog from "../components/simulate/ProfileCheckDialog";
import { useSimulationStore, useUiStore } from "../store";
import type { SimulateInput } from "../types";

export default function SimulatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const running = useSimulationStore((s) => s.running);
  const fullResult = useSimulationStore((s) => s.fullResult);
  const startSimulation = useSimulationStore((s) => s.startSimulation);

  /* Navigate reactively when a new result arrives */
  useEffect(() => {
    if (fullResult && !running) {
      navigate("/results");
    }
  }, [fullResult, running, navigate]);

  const [showProfileCheck, setShowProfileCheck] = useState(false);
  const [pendingInput, setPendingInput] = useState<SimulateInput | null>(null);

  const doSubmit = useCallback(
    async (input: SimulateInput) => {
      try {
        await startSimulation(input);
        /* Navigation is handled by the useEffect watching fullResult */
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.startsWith("DAILY_LIMIT:")) {
          pushToast("warning", msg.slice("DAILY_LIMIT:".length));
        } else if (
          msg.includes("Connection refused") ||
          msg.includes("error sending request")
        ) {
          pushToast("error", t("errors.ollama_unavailable"));
        } else if (msg.includes("JSON") || msg.includes("expected value")) {
          pushToast("error", t("errors.json_parse"));
        } else if (msg.includes("timeout") || msg.includes("Timeout")) {
          pushToast("error", t("errors.timeout"));
        } else {
          pushToast("error", t("errors.generic", { detail: msg }));
        }
      }
    },
    [startSimulation, navigate, pushToast, t],
  );

  const handleSubmit = (input: SimulateInput) => {
    setPendingInput(input);
    setShowProfileCheck(true);
  };

  const handleProfileContinue = () => {
    setShowProfileCheck(false);
    if (pendingInput) {
      doSubmit(pendingInput);
    }
  };

  const handleProfileEdit = () => {
    setShowProfileCheck(false);
    navigate("/onboarding");
  };

  if (running) {
    return (
      <section className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-in fade-in duration-700">
        <SimulationLoading />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-2 mb-2">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("simulate.title")}</h2>
        <p className="text-muted-foreground">{t("simulate.subtitle")}</p>
      </div>

      <ProfileCheckDialog
        open={showProfileCheck}
        onContinue={handleProfileContinue}
        onEdit={handleProfileEdit}
      />

      <DecisionInput onSubmit={handleSubmit} disabled={running} />
    </section>
  );
}
