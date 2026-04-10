import type { AppSettings, AppSettingsPatch } from "../types";
import { invokeCommand } from "./tauri";

export async function getSettings(): Promise<AppSettings> {
  return invokeCommand<AppSettings>("get_settings");
}

export async function updateSettings(
  patch: AppSettingsPatch,
): Promise<AppSettings> {
  return invokeCommand<AppSettings>("update_settings", { patch });
}
