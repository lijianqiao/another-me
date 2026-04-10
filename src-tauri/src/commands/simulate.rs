//! 推演相关 Tauri 命令
//!
//! Sprint 5：完整蝴蝶效应引擎
//! 取画像 → 检查上限 → 同步模型 → 5 次并发推演 → TF-IDF 聚类 →
//! 安全阀校验 → 生成来信 → 存储 → 返回

use tauri::State;
use tracing::{info, warn};
use uuid::Uuid;

use crate::ai::gateway::{build_profile_summary, UserContextBlock};
use crate::commands::letter::{self, LetterResult};
use crate::commands::AppState;
use crate::engines::butterfly::{
    ButterflyEngine, ButterflyEngineConfig, SimulationCandidate,
};
use crate::engines::safety_valve;
use crate::storage::{decision_store, profile_store, settings_store};
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

/// 执行完整推演流程（Sprint 5：5 次并发 → 聚类 → 3 条时间线）
#[tauri::command]
pub async fn simulate_decision(
    input: SimulateInput,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<FullSimulationResult, String> {
    // 0. 从设置同步模型 ID 到 AI Gateway
    {
        let conn = state.db.settings.lock().await;
        let settings =
            settings_store::get_all(&conn).map_err(|e| e.to_string())?;
        info!(model = %settings.active_model_id, "同步模型设置到 AI Gateway");
        let mut gw = state.ai_gateway.write().await;
        gw.set_ollama_model(settings.active_model_id);
    }

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

    // 4. 构建引擎（含配置）
    let engine_config = ButterflyEngineConfig {
        run_count: 5,
        timeline_count: 3,
        black_swan_enabled: input.black_swan_enabled,
        black_swan_probability: 0.03,
    };

    let mut engine = ButterflyEngine::new(state.ai_gateway.clone())
        .with_config(engine_config);

    // 尝试获取 Python Worker Bridge 用于聚类 + 现实主义校验
    match state.python_worker.get_bridge().await {
        Ok(bridge) => {
            engine = engine.with_python_bridge(bridge);
            info!("Python Worker 已连接，启用聚类和现实主义校验");
        }
        Err(e) => {
            warn!(error = %e, "Python Worker 不可用，跳过聚类（直接取前 3 条）");
        }
    }

    // 5. 执行批量推演（5 次并发 → 聚类 → 3 条候选）
    let candidates = engine
        .simulate_batch(
            &profile,
            &input.decision_text,
            &input.time_horizon,
            input.drama_level,
            input.context.as_deref(),
            &user_context,
            &app_handle,
        )
        .await
        .map_err(|e| format!("[simulate_decision] {e}"))?;

    // 6. 将候选转为 Timeline
    let decision_id = decision_store::new_decision_id();
    let timeline_labels = assign_timeline_labels(candidates.len());

    let timelines: Vec<Timeline> = candidates
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let tl_type = timeline_labels
                .get(i)
                .copied()
                .unwrap_or(TimelineType::Reality);
            candidate_to_timeline(c, &decision_id, tl_type)
        })
        .collect();

    // 7. 安全阀检查（合并所有时间线的叙事）
    let combined_narrative: String = timelines
        .iter()
        .map(|t| t.narrative.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    let dark_content_warning =
        safety_valve::check_dark_content(&combined_narrative);
    let avg_emotion = average_emotions(&timelines);
    let emotional_recovery_needed =
        safety_valve::needs_emotional_recovery_test(&avg_emotion);
    let shine_points = safety_valve::generate_shine_points(&profile);

    if dark_content_warning {
        warn!(decision_id = %decision_id, "检测到黑暗内容");
    }

    // 8. 生成来信（基于所有时间线的摘要）
    let timelines_summary: String = timelines
        .iter()
        .enumerate()
        .map(|(i, t)| format!("时间线{}：{}", i + 1, &t.narrative[..t.narrative.len().min(200)]))
        .collect::<Vec<_>>()
        .join("\n\n");

    let letter_result = letter::generate_letter(
        &state.ai_gateway,
        &profile,
        &input.decision_text,
        &input.time_horizon,
        &timelines_summary,
        &avg_emotion,
    )
    .await
    .ok();

    // 9. 构建完整结果
    let sim_result = SimulationResult {
        decision_id: decision_id.clone(),
        timelines: timelines.clone(),
        letter: letter_result.as_ref().map(|l| l.content.clone()),
        decision_tree: None,
        life_chart: None,
    };

    // 10. 存储到数据库
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

    info!(
        decision_id = %decision_id,
        timelines = timelines.len(),
        "推演完成"
    );

    Ok(FullSimulationResult {
        decision_id,
        timelines,
        letter: letter_result,
        dark_content_warning,
        emotional_recovery_needed,
        shine_points,
    })
}

/// 保留单次推演接口（调试用）
#[tauri::command]
pub async fn simulate_once(
    input: SimulateInput,
    state: State<'_, AppState>,
) -> Result<SimulationCandidate, String> {
    {
        let conn = state.db.settings.lock().await;
        let settings =
            settings_store::get_all(&conn).map_err(|e| e.to_string())?;
        let mut gw = state.ai_gateway.write().await;
        gw.set_ollama_model(settings.active_model_id);
    }

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

// ============================================================================
// 辅助函数
// ============================================================================

/// 为 N 条时间线分配类型标签：稳健 / 转折 / 极端
fn assign_timeline_labels(count: usize) -> Vec<TimelineType> {
    match count {
        0 => vec![],
        1 => vec![TimelineType::Reality],
        2 => vec![TimelineType::Reality, TimelineType::Parallel],
        _ => {
            let mut labels = vec![TimelineType::Reality];
            labels.push(TimelineType::Parallel);
            for _ in 2..count {
                labels.push(TimelineType::Extreme);
            }
            labels
        }
    }
}

fn candidate_to_timeline(
    candidate: &SimulationCandidate,
    decision_id: &str,
    timeline_type: TimelineType,
) -> Timeline {
    Timeline {
        id: Uuid::new_v4().to_string(),
        decision_id: decision_id.to_string(),
        timeline_type,
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
        satisfaction: timelines
            .iter()
            .map(|t| t.emotion.satisfaction)
            .sum::<f32>()
            / n,
        regret: timelines.iter().map(|t| t.emotion.regret).sum::<f32>() / n,
        hope: timelines.iter().map(|t| t.emotion.hope).sum::<f32>() / n,
        loneliness: timelines
            .iter()
            .map(|t| t.emotion.loneliness)
            .sum::<f32>()
            / n,
    }
}
