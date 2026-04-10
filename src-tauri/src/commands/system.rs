//! 系统级操作：在资源管理器中打开路径

use tracing::debug;

/// 在系统文件管理器中打开指定目录或文件（下载目录、导出位置等）
#[tauri::command]
pub fn open_path_in_explorer(path: String) -> Result<(), String> {
    debug!(path = %path, "打开系统文件管理器");
    open::that(&path).map_err(|e| e.to_string())
}
