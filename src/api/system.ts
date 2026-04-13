import { invokeCommand } from "./tauri";

export async function openPathInExplorer(path: string): Promise<void> {
  return invokeCommand("open_path_in_explorer", { path });
}

export interface SystemFontResult {
  name: string;
  base64: string;
}

export async function readSystemFont(): Promise<SystemFontResult> {
  return invokeCommand<SystemFontResult>("read_system_font");
}
