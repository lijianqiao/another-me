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

// Sprint 10: Cloud API Key Management

export interface CloudProviderStatus {
  provider: string;
  has_key: boolean;
  base_url: string | null;
}

export interface SwitchProviderInput {
  provider: string;
  model: string;
  base_url?: string;
}

export interface SaveCloudProviderInput {
  provider: string;
  api_key?: string;
  base_url?: string;
}

export async function saveCloudProvider(
  input: SaveCloudProviderInput,
): Promise<void> {
  return invokeCommand("save_api_key", { input });
}

export async function deleteApiKey(provider: string): Promise<void> {
  return invokeCommand("delete_api_key", { provider });
}

export async function listApiKeyStatus(): Promise<CloudProviderStatus[]> {
  return invokeCommand<CloudProviderStatus[]>("list_api_key_status");
}

export async function switchProvider(
  input: SwitchProviderInput,
): Promise<void> {
  return invokeCommand("switch_provider", { input });
}
