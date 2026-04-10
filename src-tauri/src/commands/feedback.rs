//! 用户反馈 Tauri 命令
//!
//! Sprint 8：提交反馈 → 自我进化引擎分析 → 画像修正建议

use tauri::State;
use tracing::{info, warn};

use crate::commands::AppState;
use crate::engines::self_evolution;
use crate::storage::{feedback_store, profile_store};

/// 提交反馈（返回修正建议列表）
#[tauri::command]
pub async fn submit_feedback(
    input: feedback_store::FeedbackInput,
    state: State<'_, AppState>,
) -> Result<SubmitFeedbackResult, String> {
    // 1. 保存反馈
    let feedback_id = {
        let conn = state.db.decisions.lock().await;
        feedback_store::save_feedback(&conn, &input).map_err(|e| e.to_string())?
    };
    info!(id = %feedback_id, feedback_type = %input.feedback_type, "反馈已保存");

    // 2. 若为 "not_me"，生成画像修正建议
    let corrections = if input.feedback_type == "not_me" && !input.reasons.is_empty() {
        let profile = {
            let conn = state.db.profiles.lock().await;
            profile_store::get_current(&conn)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "画像不存在".to_string())?
        };
        let corrections = self_evolution::generate_corrections(&profile, &input.reasons);

        if !corrections.is_empty() {
            let conn = state.db.decisions.lock().await;
            if let Err(e) = feedback_store::save_corrections(&conn, &feedback_id, &corrections) {
                warn!(error = %e, "保存修正建议失败");
            }
        }
        corrections
    } else {
        vec![]
    };

    Ok(SubmitFeedbackResult {
        feedback_id,
        corrections,
    })
}

/// 应用画像修正
#[tauri::command]
pub async fn apply_correction(
    feedback_id: String,
    field: String,
    new_value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    {
        let conn = state.db.decisions.lock().await;
        feedback_store::mark_applied(&conn, &feedback_id).map_err(|e| e.to_string())?;
    }
    info!(feedback_id = %feedback_id, field = %field, new_value = %new_value, "标记反馈已应用");
    Ok(())
}

/// 获取进化等级和最大戏剧化档位
#[tauri::command]
pub async fn get_evolution_info(
    state: State<'_, AppState>,
) -> Result<EvolutionInfo, String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "画像不存在".to_string())?
    };

    let conn = state.db.decisions.lock().await;

    let total_simulations =
        feedback_store::get_total_decision_count(&conn, &profile.id)
            .map_err(|e| e.to_string())?;

    let decision_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM decisions WHERE profile_id = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![profile.id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let feedback_count =
        feedback_store::get_feedback_count(&conn, &decision_ids)
            .map_err(|e| e.to_string())?;

    let evolution_level = self_evolution::calculate_evolution_level(feedback_count);
    let max_drama = self_evolution::max_drama_level(total_simulations);

    Ok(EvolutionInfo {
        evolution_level,
        feedback_count,
        total_simulations,
        max_drama_level: max_drama,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SubmitFeedbackResult {
    pub feedback_id: String,
    pub corrections: Vec<feedback_store::ProfileCorrectionSuggestion>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EvolutionInfo {
    pub evolution_level: u32,
    pub feedback_count: u32,
    pub total_simulations: u32,
    pub max_drama_level: u8,
}
