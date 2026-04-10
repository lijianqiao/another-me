/**
 * 反馈相关 API
 * Sprint 8：提交反馈 + 进化等级查询
 */
import { invoke } from "@tauri-apps/api/core";

export interface ProfileCorrectionSuggestion {
  field: string;
  old_value: string;
  new_value: string;
  confidence: number;
}

export interface FeedbackInput {
  decision_id: string;
  feedback_type: "not_me" | "accurate";
  reasons: string[];
}

export interface SubmitFeedbackResult {
  feedback_id: string;
  corrections: ProfileCorrectionSuggestion[];
}

export interface EvolutionInfo {
  evolution_level: number;
  feedback_count: number;
  total_simulations: number;
  max_drama_level: number;
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<SubmitFeedbackResult> {
  return invoke("submit_feedback", { input });
}

export async function applyCorrection(
  feedbackId: string,
  field: string,
  newValue: string,
): Promise<void> {
  return invoke("apply_correction", {
    feedbackId,
    field,
    newValue,
  });
}

export async function getEvolutionInfo(): Promise<EvolutionInfo> {
  return invoke("get_evolution_info");
}
