//! 历史记录 Tauri 命令
//!
//! Sprint 6：决策列表 + 历史结果查看

use tauri::State;
use tracing::info;

use crate::commands::AppState;
use crate::storage::{decision_store, profile_store};
use crate::types::decision::SimulationResult;
use crate::types::error::AppError;

/// 历史决策详情（供前端展示用，含解析后的推演结果）
#[derive(Debug, Clone, serde::Serialize)]
pub struct HistoricalDecision {
    pub id: String,
    pub created_at: String,
    pub decision_text: String,
    pub time_horizon: String,
    pub context: Option<String>,
    pub drama_level: u8,
    pub black_swan_enabled: bool,
    pub is_anchored: bool,
    pub result: SimulationResult,
}

/// 获取当前用户的所有决策摘要（按时间倒序）
#[tauri::command]
pub async fn list_decisions(
    state: State<'_, AppState>,
) -> Result<Vec<decision_store::DecisionSummary>, String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let conn = state.db.decisions.lock().await;
    let list = decision_store::list_decisions(&conn, &profile.id)
        .map_err(|e| e.to_string())?;

    info!(count = list.len(), "查询决策历史列表");
    Ok(list)
}

/// 获取单个决策的完整推演结果
#[tauri::command]
pub async fn get_decision(
    decision_id: String,
    state: State<'_, AppState>,
) -> Result<HistoricalDecision, String> {
    let conn = state.db.decisions.lock().await;
    let stored = decision_store::get_decision(&conn, &decision_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("决策记录不存在: {decision_id}"))?;

    let result: SimulationResult =
        serde_json::from_str(&stored.result_json)
            .map_err(|e| format!("解析结果 JSON 失败: {e}"))?;

    info!(decision_id = %decision_id, "加载历史决策详情");

    Ok(HistoricalDecision {
        id: stored.id,
        created_at: stored.created_at,
        decision_text: stored.decision_text,
        time_horizon: stored.time_horizon,
        context: stored.context,
        drama_level: stored.drama_level,
        black_swan_enabled: stored.black_swan_enabled,
        is_anchored: stored.is_anchored,
        result,
    })
}
