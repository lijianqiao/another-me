/**
 * 推演页 — 决策录入 + 加载状态切换
 */
import { useNavigate } from "react-router-dom";

import DecisionInput from "../components/simulate/DecisionInput";
import SimulationLoading from "../components/simulate/SimulationLoading";
import { useSimulationStore, useUiStore } from "../store";
import type { SimulateInput } from "../types";

export default function SimulatePage() {
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
      } else {
        pushToast("error", msg);
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
      <h2>新推演</h2>
      <p className="simulate-page__subtitle">
        输入一个你正在纠结的人生决定，让推演引擎带你看看可能的未来。
      </p>
      <DecisionInput onSubmit={handleSubmit} disabled={running} />
    </section>
  );
}
