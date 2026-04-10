//! 导出 Tauri 命令
//!
//! Sprint 9：JSON 导出（单条 + 全量备份）

use tauri::State;
use tracing::info;

use crate::commands::AppState;

/// 导出单次推演结果为 JSON 字符串（前端负责保存到文件）
#[tauri::command]
pub async fn export_decision_json(
    decision_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let conn = state.db.decisions.lock().await;
    let result_json: String = conn
        .query_row(
            "SELECT result_json FROM decisions WHERE id = ?1",
            rusqlite::params![decision_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("决策记录不存在: {e}"))?;

    let parsed: serde_json::Value =
        serde_json::from_str(&result_json).unwrap_or_default();
    let json =
        serde_json::to_string_pretty(&parsed).map_err(|e| e.to_string())?;
    info!(decision_id = %decision_id, bytes = json.len(), "导出 JSON 完成");
    Ok(json)
}

/// 导出所有推演记录为 JSON（完整备份）
#[tauri::command]
pub async fn export_all_json(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let conn = state.db.decisions.lock().await;

    let mut stmt = conn
        .prepare(
            "SELECT id, profile_id, created_at, decision_text, time_horizon, \
             context, drama_level, black_swan_enabled, emotion_snapshot, result_json \
             FROM decisions ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            let emotion_raw: Option<String> = row.get(8)?;
            let result_raw: Option<String> = row.get(9)?;
            let emotion_snapshot = emotion_raw
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
            let result = result_raw
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "profile_id": row.get::<_, String>(1)?,
                "created_at": row.get::<_, String>(2)?,
                "decision_text": row.get::<_, String>(3)?,
                "time_horizon": row.get::<_, String>(4)?,
                "context": row.get::<_, Option<String>>(5)?,
                "drama_level": row.get::<_, i32>(6)?,
                "black_swan_enabled": row.get::<_, bool>(7)?,
                "emotion_snapshot": emotion_snapshot,
                "result": result,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let count = rows.len();
    let export = serde_json::json!({
        "app": "another-me",
        "version": "1.0",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "total_records": count,
        "decisions": rows,
    });

    let json =
        serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    info!(records = count, bytes = json.len(), "导出全部记录 JSON 完成");
    Ok(json)
}
