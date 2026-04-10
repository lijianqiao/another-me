//! 推演相关 Tauri 命令
//!
//! Sprint 3：完整推演流程
//! 取画像 → 检查上限 → 构建 prompt → AI Gateway → 解析 →
//! 安全阀校验 → 生成来信 → 存储 → 返回

use tauri::State;
use tracing::{info, warn};
use uuid::Uuid;

use crate::ai::gateway::{build_profile_summary, UserContextBlock};
use crate::commands::letter::{self, LetterResult};
use crate::commands::AppState;
use crate::engines::butterfly::{ButterflyEngine, SimulationCandidate};
use crate::engines::safety_valve;
use crate::storage::{decision_store, profile_store};
use crate::types::decision::{SimulateInput, SimulationResult};
use crate::types::emotion::EmotionDimensions;
use crate::types::error::AppError;
use crate::types::timeline::{Timeline, TimelineType};

/// 完整推演结果（前端展示用）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FullSimulationResult {
    pub decision_id: String,
    pub timelines: Vec<Timeline>,
    pub letter: Option<LetterResult>,
    pub dark_content_warning: bool,
    pub emotional_recovery_needed: bool,
    pub shine_points: Vec<String>,
}

/// 执行完整推演流程
#[tauri::command]
pub async fn simulate_decision(
    input: SimulateInput,
    state: State<'_, AppState>,
) -> Result<FullSimulationResult, String> {
    // 1. 取画像
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?
            .ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    // 2. 检查每日上限
    {
        let conn = state.db.decisions.lock().await;
        let today_count = decision_store::get_today_count(&conn, &profile.id)
            .map_err(|e| e.to_string())?;
        if let Some(warning) = safety_valve::check_daily_limit(today_count) {
            return Err(format!("DAILY_LIMIT:{}", warning.message));
        }
    }

    // 3. 构建上下文
    let user_context = UserContextBlock {
        profile_summary: build_profile_summary(&profile),
        anchor_timeline: None,
        recent_decisions: vec![],
        causal_chain_summary: None,
    };

    // 4. 单次推演（Sprint 5 升级为 5 次并发）
    let engine = ButterflyEngine::new(state.ai_gateway.clone());
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

    // 5. 构建 Timeline
    let decision_id = decision_store::new_decision_id();
    let timeline = candidate_to_timeline(&candidate, &decision_id);

    // 6. 安全阀检查
    let dark_content_warning = safety_valve::check_dark_content(&timeline.narrative);
    let emotional_recovery_needed =
        safety_valve::needs_emotional_recovery_test(&timeline.emotion);
    let shine_points = safety_valve::generate_shine_points(&profile);

    if dark_content_warning {
        warn!(decision_id = %decision_id, "检测到黑暗内容");
    }

    // 7. 生成来信
    let letter_result = letter::generate_letter(
        &state.ai_gateway,
        &profile,
        &input.decision_text,
        &input.time_horizon,
        &timeline.narrative,
        &timeline.emotion,
    )
    .await
    .ok();

    // 8. 构建结果
    let timelines = vec![timeline];
    let avg_emotion = average_emotions(&timelines);

    let sim_result = SimulationResult {
        decision_id: decision_id.clone(),
        timelines: timelines.clone(),
        letter: letter_result
            .as_ref()
            .map(|l| l.content.clone()),
        decision_tree: None,
        life_chart: None,
    };

    // 9. 存储到数据库
    {
        let conn = state.db.decisions.lock().await;
        if let Err(e) = decision_store::save_decision(
            &conn,
            &profile.id,
            &input,
            &sim_result,
            &avg_emotion,
        ) {
            warn!(error = %e, "存储决策记录失败（不影响返回结果）");
        }
    }

    info!(decision_id = %decision_id, "推演完成");

    Ok(FullSimulationResult {
        decision_id,
        timelines,
        letter: letter_result,
        dark_content_warning,
        emotional_recovery_needed,
        shine_points,
    })
}

/// 保留 Sprint 2 的单次推演接口（前端调试用）
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

    let engine = ButterflyEngine::new(state.ai_gateway.clone());
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

    Ok(candidate)
}

fn candidate_to_timeline(candidate: &SimulationCandidate, decision_id: &str) -> Timeline {
    Timeline {
        id: Uuid::new_v4().to_string(),
        decision_id: decision_id.to_string(),
        timeline_type: TimelineType::Reality,
        narrative: candidate.narrative.clone(),
        emotion: candidate.emotion_dimensions.clone(),
        realism_score: 0.5,
        key_events: candidate.key_events.clone(),
        dimension_scores: candidate.dimension_scores.clone(),
        black_swan_event: candidate.black_swan_event.clone(),
    }
}

fn average_emotions(timelines: &[Timeline]) -> EmotionDimensions {
    if timelines.is_empty() {
        return EmotionDimensions::neutral();
    }
    let n = timelines.len() as f32;
    EmotionDimensions {
        energy: timelines.iter().map(|t| t.emotion.energy).sum::<f32>() / n,
        satisfaction: timelines.iter().map(|t| t.emotion.satisfaction).sum::<f32>() / n,
        regret: timelines.iter().map(|t| t.emotion.regret).sum::<f32>() / n,
        hope: timelines.iter().map(|t| t.emotion.hope).sum::<f32>() / n,
        loneliness: timelines.iter().map(|t| t.emotion.loneliness).sum::<f32>() / n,
    }
}
