/**
 * 导出相关 API
 * Sprint 9
 */
import { invoke } from "@tauri-apps/api/core";

export async function exportDecisionJson(
  decisionId: string,
): Promise<string> {
  return invoke("export_decision_json", { decisionId });
}

export async function exportAllJson(): Promise<string> {
  return invoke("export_all_json");
}
