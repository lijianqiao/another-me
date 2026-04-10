//! 模型管理 Tauri 命令
//!
//! Sprint 9：列表 / 切换 / 下载 / 删除

use tauri::{Emitter, State};
use tracing::info;

use crate::commands::AppState;
use crate::model_manager::local_models::{self, LocalModelInfo};
use crate::storage::settings_store;

/// 列出本地已安装模型
#[tauri::command]
pub async fn list_models(
    state: State<'_, AppState>,
) -> Result<Vec<LocalModelInfo>, String> {
    let active_model = {
        let conn = state.db.settings.lock().await;
        settings_store::get_all(&conn)
            .map(|s| s.active_model_id)
            .unwrap_or_else(|_| "qwen3.5:4b".to_string())
    };
    let models = local_models::list_models("http://127.0.0.1:11434", &active_model).await;
    Ok(models)
}

/// 切换活跃模型
#[tauri::command]
pub async fn switch_model(
    model_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    {
        let conn = state.db.settings.lock().await;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('active_model_id', ?1)",
            rusqlite::params![format!("\"{}\"", model_id)],
        )
        .map_err(|e| e.to_string())?;
    }
    {
        let mut gw = state.ai_gateway.write().await;
        gw.set_ollama_model(model_id.clone());
    }
    info!(model = %model_id, "已切换活跃模型");
    Ok(())
}

/// 删除模型
#[tauri::command]
pub async fn delete_model(model_id: String) -> Result<String, String> {
    let mid = model_id.clone();
    tokio::task::spawn_blocking(move || local_models::delete_model_blocking(&mid))
        .await
        .map_err(|e| e.to_string())?
}

/// 下载模型（后台异步）
#[tauri::command]
pub async fn download_model(
    model_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mid = model_id.clone();
    let handle = app_handle.clone();

    tokio::task::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            local_models::pull_model_blocking(&mid)
        })
        .await;

        match result {
            Ok(Ok(msg)) => {
                let _ = handle.emit("model_download_complete", &msg);
            }
            Ok(Err(err)) => {
                let _ = handle.emit("model_download_failed", &err);
            }
            Err(e) => {
                let _ = handle.emit("model_download_failed", &e.to_string());
            }
        }
    });

    info!(model = %model_id, "模型下载任务已提交");
    Ok(())
}
