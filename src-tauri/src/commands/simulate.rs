//! 推演相关 Tauri 命令
//!
//! Sprint 5：完整蝴蝶效应引擎
//! 取画像 → 检查上限 → 同步模型 → 5 次并发推演 → TF-IDF 聚类 →
//! 安全阀校验 → 生成来信 → 存储 → 返回

use std::time::Instant;
use tauri::State;
use tracing::{info, warn};
use uuid::Uuid;

use crate::ai::gateway::{build_profile_summary, UserContextBlock};
use crate::commands::letter::{self, LetterResult};
use crate::commands::AppState;
use crate::engines::butterfly::{ButterflyEngine, ButterflyEngineConfig, SimulationCandidate};
use crate::engines::{causal_chain, safety_valve};
use crate::storage::{decision_store, life_map_store, profile_store, settings_store};
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
    pub decision_tree: Option<serde_json::Value>,
}

/// 执行完整推演流程（Sprint 5：5 次并发 → 聚类 → 3 条时间线）
#[tauri::command]
pub async fn simulate_decision(
    input: SimulateInput,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<FullSimulationResult, String> {
    let t_start = Instant::now();

    // 0. 从设置同步 Provider + 模型 ID 到 AI Gateway
    {
        let conn = state.db.settings.lock().await;
        let settings = settings_store::get_all(&conn).map_err(|e| e.to_string())?;

        let provider = match settings.active_provider.as_str() {
            "openai" => crate::ai::gateway::AIProvider::OpenAI,
            "anthropic" => crate::ai::gateway::AIProvider::Anthropic,
            "qwen" => crate::ai::gateway::AIProvider::Qwen,
            "deepseek" => crate::ai::gateway::AIProvider::DeepSeek,
            "gemini" => crate::ai::gateway::AIProvider::Gemini,
            _ => crate::ai::gateway::AIProvider::Ollama,
        };

        let mut gw = state.ai_gateway.write().await;
        gw.set_provider(provider);

        if provider == crate::ai::gateway::AIProvider::Ollama {
            gw.set_ollama_model(settings.active_model_id.clone());
        } else {
            // 云端 Provider: 从 credential_store 恢复配置
            let api_key =
                crate::storage::credential_store::get_api_key(&conn, &settings.active_provider)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| format!("未设置 {} API Key", settings.active_provider))?;
            let base_url =
                crate::storage::credential_store::get_base_url(&conn, &settings.active_provider)
                    .map_err(|e| e.to_string())?;
            gw.set_cloud_config(crate::ai::gateway::CloudProviderConfig {
                api_key,
                model: settings.active_model_id.clone(),
                base_url,
            });
        }
        info!(provider = %settings.active_provider, model = %settings.active_model_id, "同步 Provider 设置到 AI Gateway");
    }

    // 1. 取画像
    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?.ok_or_else(|| AppError::ProfileNotFound.to_string())?
    };

    // 2. 检查每日上限
    {
        let conn = state.db.decisions.lock().await;
        let today_count =
            decision_store::get_today_count(&conn, &profile.id).map_err(|e| e.to_string())?;
        if let Some(warning) = safety_valve::check_daily_limit(today_count) {
            return Err(format!("DAILY_LIMIT:{}", warning.message));
        }
    }

    // 3. 构建因果链上下文（Sprint 7）
    let user_context = {
        let conn = state.db.decisions.lock().await;
        match causal_chain::build_context(&conn, &profile.id) {
            Ok(ctx) => {
                info!(
                    recent = ctx.recent_decisions.len(),
                    anchored = ctx.anchor_timeline.is_some(),
                    "因果链上下文已注入"
                );
                UserContextBlock {
                    profile_summary: build_profile_summary(&profile),
                    anchor_timeline: ctx.anchor_timeline,
                    recent_decisions: ctx.recent_decisions,
                    causal_chain_summary: ctx.causal_chain_summary,
                }
            }
            Err(e) => {
                warn!(error = %e, "因果链构建失败，使用空上下文");
                UserContextBlock {
                    profile_summary: build_profile_summary(&profile),
                    anchor_timeline: None,
                    recent_decisions: vec![],
                    causal_chain_summary: None,
                }
            }
        }
    };

    // 4. 构建引擎（含配置）
    let engine_config = ButterflyEngineConfig {
        run_count: 5,
        timeline_count: 3,
        black_swan_enabled: input.black_swan_enabled,
        black_swan_probability: 0.03,
    };

    // 直接交出 PythonWorkerManager；由引擎在需要时 lazy 拉起 bridge，
    // 并在通信失败时主动 invalidate 触发下一次调用重启 worker。
    let engine = ButterflyEngine::new(state.ai_gateway.clone())
        .with_config(engine_config)
        .with_python_worker(state.python_worker.clone());

    // progress_total = LLM runs + clustering + letter + saving
    let run_count = 5usize;
    let progress_total = run_count + 3;

    // 5. 执行批量推演（5 次并发 → 聚类 → 3 条候选）
    let t_llm_start = Instant::now();
    let candidates = engine
        .simulate_batch(
            &profile,
            &input.decision_text,
            &input.time_horizon,
            input.drama_level,
            input.context.as_deref(),
            &user_context,
            &app_handle,
            progress_total,
        )
        .await
        .map_err(|e| format!("[simulate_decision] {e}"))?;

    let llm_elapsed = t_llm_start.elapsed();
    info!(llm_ms = llm_elapsed.as_millis(), "LLM 批量推演耗时");

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

    let dark_content_warning = safety_valve::check_dark_content(&combined_narrative);
    let avg_emotion = average_emotions(&timelines);
    let emotional_recovery_needed = safety_valve::needs_emotional_recovery_test(&avg_emotion);
    let shine_points = safety_valve::generate_shine_points(&profile);

    if dark_content_warning {
        warn!(decision_id = %decision_id, "检测到黑暗内容");
    }

    let timelines_summary: String = timelines
        .iter()
        .enumerate()
        .map(|(i, t)| format!("时间线{}：{}", i + 1, truncate_chars(&t.narrative, 200)))
        .collect::<Vec<_>>()
        .join("\n\n");

    // 8. 生成来信（基于所有时间线的摘要）
    crate::engines::butterfly::emit_progress(
        &app_handle,
        run_count + 2,
        progress_total,
        "letter",
        "正在生成来信...",
    );

    let letter_result = match letter::generate_letter(
        &state.ai_gateway,
        &profile,
        &input.decision_text,
        &input.time_horizon,
        &timelines_summary,
        &avg_emotion,
    )
    .await
    {
        Ok(lr) => Some(lr),
        Err(e) => {
            warn!(error = %e, "来信生成失败，跳过来信");
            None
        }
    };

    // 9. 构建决策树 + 人生走势图数据
    let tree_data = crate::commands::tree::build_tree(&input.decision_text, &timelines);
    let decision_tree = serde_json::to_value(&tree_data).ok();
    let decision_tree_for_db = decision_tree.clone();

    let sim_result = SimulationResult {
        decision_id: decision_id.clone(),
        timelines: timelines.clone(),
        letter: letter_result.as_ref().map(|l| l.content.clone()),
        decision_tree: decision_tree_for_db,
        life_chart: None,
        dark_content_warning,
        emotional_recovery_needed,
        shine_points: shine_points.clone(),
        letter_tone_type: letter_result.as_ref().map(|l| l.tone_type.clone()),
        letter_shine_points: letter_result
            .as_ref()
            .map(|l| l.shine_points.clone())
            .unwrap_or_default(),
    };

    // 10. 存储到数据库
    crate::engines::butterfly::emit_progress(
        &app_handle,
        progress_total,
        progress_total,
        "saving",
        "正在保存结果...",
    );

    {
        let conn = state.db.decisions.lock().await;
        if let Err(e) =
            decision_store::save_decision(&conn, &profile.id, &input, &sim_result, &avg_emotion)
        {
            warn!(error = %e, "存储决策记录失败（不影响返回结果）");
        }

        // 11. 写入人生地图节点（Sprint 7）
        let outcome_summary: String = timelines
            .iter()
            .map(|t| {
                t.key_events
                    .last()
                    .map(|e| format!("{}: {}", e.year, e.event))
                    .unwrap_or_else(|| t.narrative.chars().take(60).collect::<String>())
            })
            .collect::<Vec<_>>()
            .join(" / ");

        let node = life_map_store::LifeMapNode {
            id: life_map_store::new_node_id(),
            profile_id: profile.id.clone(),
            decision_id: decision_id.clone(),
            node_date: chrono::Utc::now().to_rfc3339(),
            node_label: input.decision_text.chars().take(50).collect(),
            node_type: "decision".to_string(),
            outcome_summary,
            personality_changes: causal_chain::extract_personality_changes_pub(&timelines),
        };
        if let Err(e) = life_map_store::save_node(&conn, &node) {
            warn!(error = %e, "写入人生地图节点失败（不影响返回结果）");
        }
    }

    let total_elapsed = t_start.elapsed();
    info!(
        decision_id = %decision_id,
        timelines = timelines.len(),
        total_ms = total_elapsed.as_millis(),
        llm_ms = llm_elapsed.as_millis(),
        "推演完成"
    );

    Ok(FullSimulationResult {
        decision_id,
        timelines,
        letter: letter_result,
        dark_content_warning,
        emotional_recovery_needed,
        shine_points,
        decision_tree,
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
        let settings = settings_store::get_all(&conn).map_err(|e| e.to_string())?;
        let provider = match settings.active_provider.as_str() {
            "openai" => crate::ai::gateway::AIProvider::OpenAI,
            "anthropic" => crate::ai::gateway::AIProvider::Anthropic,
            "qwen" => crate::ai::gateway::AIProvider::Qwen,
            "deepseek" => crate::ai::gateway::AIProvider::DeepSeek,
            "gemini" => crate::ai::gateway::AIProvider::Gemini,
            _ => crate::ai::gateway::AIProvider::Ollama,
        };
        let mut gw = state.ai_gateway.write().await;
        gw.set_provider(provider);
        if provider == crate::ai::gateway::AIProvider::Ollama {
            gw.set_ollama_model(settings.active_model_id);
        } else {
            let api_key =
                crate::storage::credential_store::get_api_key(&conn, &settings.active_provider)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| format!("未设置 {} API Key", settings.active_provider))?;
            let base_url =
                crate::storage::credential_store::get_base_url(&conn, &settings.active_provider)
                    .map_err(|e| e.to_string())?;
            gw.set_cloud_config(crate::ai::gateway::CloudProviderConfig {
                api_key,
                model: settings.active_model_id,
                base_url,
            });
        }
    }

    let profile = {
        let conn = state.db.profiles.lock().await;
        profile_store::get_current(&conn)?.ok_or_else(|| AppError::ProfileNotFound.to_string())?
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
        narrative: crate::utils::text_format::ensure_narrative_breaks(&candidate.narrative),
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
        loneliness: timelines.iter().map(|t| t.emotion.loneliness).sum::<f32>() / n,
    }
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}
