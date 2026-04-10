import { invokeCommand } from "./tauri";

export async function openPathInExplorer(path: string): Promise<void> {
  return invokeCommand("open_path_in_explorer", { path });
}
