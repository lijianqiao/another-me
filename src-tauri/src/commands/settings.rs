//! 应用设置 + Ollama 检测 命令

use tauri::State;
use tracing::debug;

use crate::commands::AppState;
use crate::model_manager::ollama_health::{self, OllamaStatus};
use crate::storage::settings_store;
use crate::types::settings::{AppSettings, AppSettingsPatch};

#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let conn = state.db.settings.lock().await;
    let s = settings_store::get_all(&conn)?;
    Ok(s)
}

#[tauri::command]
pub async fn update_settings(
    patch: AppSettingsPatch,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    debug!(?patch, "update_settings invoked");
    let conn = state.db.settings.lock().await;
    settings_store::apply_patch(&conn, &patch)?;
    let s = settings_store::get_all(&conn)?;
    Ok(s)
}

/// 检查 Ollama 运行状态和模型可用性
#[tauri::command]
pub async fn check_ollama_status(
    state: State<'_, AppState>,
) -> Result<OllamaStatus, String> {
    let settings = {
        let conn = state.db.settings.lock().await;
        settings_store::get_all(&conn)?
    };

    let status = ollama_health::check_ollama(
        "http://127.0.0.1:11434",
        &settings.active_model_id,
    )
    .await;

    Ok(status)
}
