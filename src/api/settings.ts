import type { AppSettings, AppSettingsPatch } from "../types";
import { invokeCommand } from "./tauri";

export interface OllamaStatus {
  running: boolean;
  models: string[];
  target_model_ready: boolean;
  target_model: string;
}

export async function getSettings(): Promise<AppSettings> {
  return invokeCommand<AppSettings>("get_settings");
}

export async function updateSettings(
  patch: AppSettingsPatch,
): Promise<AppSettings> {
  return invokeCommand<AppSettings>("update_settings", { patch });
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  return invokeCommand<OllamaStatus>("check_ollama_status");
}
