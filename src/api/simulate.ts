/**
 * 推演 API 封装
 */

import { invokeCommand } from "./tauri";
import type { SimulateInput, Timeline } from "../types";

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

export interface LetterResult {
  content: string;
  tone_type: string;
  shine_points: string[];
}

export interface FullSimulationResult {
  decision_id: string;
  timelines: Timeline[];
  letter: LetterResult | null;
  dark_content_warning: boolean;
  emotional_recovery_needed: boolean;
  shine_points: string[];
  decision_tree?: Record<string, unknown> | null;
}

export async function simulateOnce(
  input: SimulateInput,
): Promise<SimulationCandidate> {
  return invokeCommand<SimulationCandidate>("simulate_once", { input });
}

export async function simulateDecision(
  input: SimulateInput,
): Promise<FullSimulationResult> {
  return invokeCommand<FullSimulationResult>("simulate_decision", { input });
}
