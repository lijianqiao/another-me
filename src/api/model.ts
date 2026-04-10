/**
 * 模型管理 API
 * Sprint 9
 */
import { invokeCommand } from "./tauri";

export interface LocalModelInfo {
  name: string;
  size: string;
  size_bytes: number;
  modified_at: string;
  is_active: boolean;
}

export async function listModels(): Promise<LocalModelInfo[]> {
  return invokeCommand<LocalModelInfo[]>("list_models");
}

export async function switchModel(modelId: string): Promise<void> {
  return invokeCommand<void>("switch_model", { modelId });
}

export async function deleteModel(modelId: string): Promise<string> {
  return invokeCommand<string>("delete_model", { modelId });
}

export async function downloadModel(modelId: string): Promise<void> {
  return invokeCommand<void>("download_model", { modelId });
}
