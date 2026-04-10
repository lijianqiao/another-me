//! 推演相关 Tauri 命令
//!
//! Sprint 2：单次推演 → 返回 SimulationCandidate JSON

use tauri::State;
use tracing::info;

use crate::ai::gateway::{build_profile_summary, UserContextBlock};
use crate::commands::AppState;
use crate::engines::butterfly::{ButterflyEngine, SimulationCandidate};
use crate::storage::profile_store;
use crate::types::decision::SimulateInput;
use crate::types::error::AppError;

/// 执行单次推演（Sprint 2 范围）
#[tauri::command]
pub async fn simulate_once(
    input: SimulateInput,
    state: State<'_, AppState>,
) -> Result<SimulationCandidate, String> {
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    let user_context = UserContextBlock {
        profile_summary: build_profile_summary(&profile),
        anchor_timeline: None,
        recent_decisions: vec![],
        causal_chain_summary: None,
    };

    let gateway = state.ai_gateway.read().await;
    let engine = ButterflyEngine::new(state.ai_gateway.clone());
    drop(gateway);

    let candidate = engine
        .simulate_once(
            &profile,
            &input.decision_text,
            &input.time_horizon,
            input.drama_level,
            input.context.as_deref(),
            &user_context,
        )
        .await
        .map_err(|e| e.to_string())?;

    info!("推演命令完成");
    Ok(candidate)
}
