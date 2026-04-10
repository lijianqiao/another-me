//! 应用设置相关 Tauri 命令

use tauri::State;
use tracing::debug;

use crate::commands::AppState;
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
