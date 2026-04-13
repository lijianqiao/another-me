//! 历史记录 + 锚定 + 人生地图 Tauri 命令
//!
//! Sprint 6：决策列表 + 历史结果查看
//! Sprint 7：锚定时间线 CRUD + 人生地图

use tauri::State;
use tracing::info;

use crate::commands::AppState;
use crate::storage::{anchor_store, decision_store, life_map_store, profile_store};
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

// ============================================================================
// 决策历史
// ============================================================================

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
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let conn = state.db.decisions.lock().await;
    let stored = decision_store::get_decision(&conn, &decision_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| AppError::DecisionNotFound(decision_id.clone()).to_string())?;
    if stored.profile_id != profile.id {
        return Err(AppError::DecisionNotFound(decision_id).to_string());
    }

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

/// 删除一条决策记录（含所有关联数据，事务保护）
#[tauri::command]
pub async fn delete_decision(
    decision_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let conn = state.db.decisions.lock().await;
    let stored = decision_store::get_decision(&conn, &decision_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| AppError::DecisionNotFound(decision_id.clone()).to_string())?;
    if stored.profile_id != profile.id {
        return Err(AppError::DecisionNotFound(decision_id).to_string());
    }
    decision_store::delete_decision(&conn, &decision_id)
        .map_err(|e| e.to_string())?;

    info!(decision_id = %decision_id, "删除决策记录");
    Ok(())
}

// ============================================================================
// 锚定时间线
// ============================================================================

/// 锚定一条决策时间线（同时清除同 profile 下的旧锚定）
#[tauri::command]
pub async fn set_anchor_timeline(
    decision_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let conn = state.db.decisions.lock().await;
    anchor_store::set_anchor(&conn, &profile.id, &decision_id)
        .map_err(|e| e.to_string())?;

    info!(decision_id = %decision_id, "锚定决策时间线");
    Ok(())
}

/// 清除锚定
#[tauri::command]
pub async fn clear_anchor(
    decision_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let conn = state.db.decisions.lock().await;
    anchor_store::clear_anchor(&conn, &profile.id, &decision_id)
        .map_err(|e| e.to_string())?;

    info!(decision_id = %decision_id, "取消锚定");
    Ok(())
}

/// 获取当前锚定的决策 ID（如果有）
#[tauri::command]
pub async fn get_anchor_timeline(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let conn = state.db.decisions.lock().await;
    let anchored = anchor_store::get_anchored_decision(&conn, &profile.id)
        .map_err(|e| e.to_string())?;

    Ok(anchored.map(|d| d.id))
}

// ============================================================================
// 人生地图
// ============================================================================

/// 获取用户的人生地图节点列表
#[tauri::command]
pub async fn get_life_map(
    state: State<'_, AppState>,
) -> Result<Vec<life_map_store::LifeMapNode>, String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let conn = state.db.decisions.lock().await;
    let nodes = life_map_store::get_life_map(&conn, &profile.id)
        .map_err(|e| e.to_string())?;

    info!(count = nodes.len(), "查询人生地图节点");
    Ok(nodes)
}
