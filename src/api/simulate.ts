/**
 * 推演 API 封装
 *
 * Sprint 2：simulate_once（单次推演）
 * Sprint 5：simulate_decision（5 次并发 + 聚类）
 */

import { invokeCommand } from "./tauri";
import type { SimulateInput } from "../types";

export interface SimulationCandidate {
  narrative: string;
  key_events: Array<{
    year: string;
    event: string;
    emotion: "positive" | "neutral" | "negative";
  }>;
  emotion_dimensions: {
    energy: number;
    satisfaction: number;
    regret: number;
    hope: number;
    loneliness: number;
  };
  dimension_scores: Array<{
    year: number;
    career: number;
    financial: number;
    health: number;
    relationship: number;
    satisfaction: number;
  }>;
  black_swan_event?: string | null;
}

export async function simulateOnce(
  input: SimulateInput,
): Promise<SimulationCandidate> {
  return invokeCommand<SimulationCandidate>("simulate_once", { input });
}
