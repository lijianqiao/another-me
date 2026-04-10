/**
 * 推演页 — 决策录入 + 加载状态切换 + 增强错误处理
 */
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import DecisionInput from "../components/simulate/DecisionInput";
import SimulationLoading from "../components/simulate/SimulationLoading";
import { useSimulationStore, useUiStore } from "../store";
import type { SimulateInput } from "../types";

export default function SimulatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const running = useSimulationStore((s) => s.running);
  const startSimulation = useSimulationStore((s) => s.startSimulation);

  const handleSubmit = async (input: SimulateInput) => {
    try {
      await startSimulation(input);
      navigate("/results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.startsWith("DAILY_LIMIT:")) {
        pushToast("warning", msg.slice("DAILY_LIMIT:".length));
      } else if (msg.includes("Connection refused") || msg.includes("error sending request")) {
        pushToast("error", t("errors.ollama_unavailable"));
      } else if (msg.includes("JSON") || msg.includes("expected value")) {
        pushToast("error", t("errors.json_parse"));
      } else if (msg.includes("timeout") || msg.includes("Timeout")) {
        pushToast("error", t("errors.timeout"));
      } else {
        pushToast("error", t("errors.generic", { detail: msg }));
      }
    }
  };

  if (running) {
    return (
      <section className="simulate-page">
        <SimulationLoading />
      </section>
    );
  }

  return (
    <section className="simulate-page">
      <h2>{t("simulate.title")}</h2>
      <p className="simulate-page__subtitle">{t("simulate.subtitle")}</p>
      <DecisionInput onSubmit={handleSubmit} disabled={running} />
    </section>
  );
}
