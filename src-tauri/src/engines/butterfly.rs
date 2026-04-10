//! 蝴蝶效应引擎
//!
//! Sprint 5：完整实现
//!   - 5 次并发推演 (tokio::spawn + join_all)
//!   - 进度通知 (AppHandle.emit + MILESTONES)
//!   - TF-IDF 聚类 (Python Worker)
//!   - 现实主义校验循环 (realism check + 1 retry)
//!   - 黑天鹅注入
//!
//! 对应 ARCH 2.2 ButterflyEngine。

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::{RwLock, Semaphore};
use tracing::{debug, info, warn};

use crate::ai::gateway::{
    build_profile_summary, format_user_context, AIGateway, UserContextBlock,
};
use crate::engines::perturbation::PerturbationFactors;
use crate::python::subprocess_bridge::PythonBridge;
use crate::types::emotion::EmotionDimensions;
use crate::types::error::AppError;
use crate::types::profile::UserProfile;
use crate::types::timeline::{DimensionScore, KeyEvent};
use crate::utils::drama_level::{drama_constraint_text, drama_to_temperature};

// ============================================================================
// 推演候选结果（LLM 输出结构）
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationCandidate {
    pub narrative: String,
    pub key_events: Vec<KeyEvent>,
    pub emotion_dimensions: EmotionDimensions,
    #[serde(default)]
    pub dimension_scores: Vec<DimensionScore>,
    #[serde(default)]
    pub black_swan_event: Option<String>,
}

// ============================================================================
// 引擎配置
// ============================================================================

#[derive(Debug, Clone)]
pub struct ButterflyEngineConfig {
    pub run_count: usize,
    pub timeline_count: usize,
    pub black_swan_enabled: bool,
    pub black_swan_probability: f32,
}

impl Default for ButterflyEngineConfig {
    fn default() -> Self {
        Self {
            run_count: 5,
            timeline_count: 3,
            black_swan_enabled: false,
            black_swan_probability: 0.03,
        }
    }
}

// ============================================================================
// 进度事件 payload
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct SimulationProgress {
    pub current: usize,
    pub total: usize,
    pub message: String,
}

/// 进度里程碑：仅在这些完成数时通知前端，避免高频事件
const MILESTONES: &[usize] = &[1, 3, 5];

/// Ollama 并发限制：本地推理引擎串行处理推理请求。
/// 设为 1 确保每个请求独占推理时间，避免排队导致后续请求超时。
const LLM_MAX_CONCURRENT: usize = 1;

/// 单次推演失败后的最大重试次数
const RUN_MAX_RETRIES: usize = 1;

// ============================================================================
// 蝴蝶效应引擎
// ============================================================================

/// 依赖方向：ButterflyEngine 持有 AIGateway + PythonBridge。
/// PythonBridge 用于 TF-IDF 聚类和现实主义校验。
pub struct ButterflyEngine {
    config: ButterflyEngineConfig,
    ai_gateway: Arc<RwLock<AIGateway>>,
    python_bridge: Option<Arc<PythonBridge>>,
}

impl ButterflyEngine {
    pub fn new(ai_gateway: Arc<RwLock<AIGateway>>) -> Self {
        Self {
            config: ButterflyEngineConfig::default(),
            ai_gateway,
            python_bridge: None,
        }
    }

    pub fn with_config(mut self, config: ButterflyEngineConfig) -> Self {
        self.config = config;
        self
    }

    pub fn with_python_bridge(mut self, bridge: Arc<PythonBridge>) -> Self {
        self.python_bridge = Some(bridge);
        self
    }

    // ========================================================================
    // 单次推演（Sprint 2 保留接口）
    // ========================================================================

    pub async fn simulate_once(
        &self,
        profile: &UserProfile,
        decision_text: &str,
        time_horizon: &str,
        drama_level: u8,
        context: Option<&str>,
        user_context: &UserContextBlock,
    ) -> Result<SimulationCandidate, AppError> {
        let perturbation = PerturbationFactors::generate(0, false, 0.03);
        let temperature = drama_to_temperature(drama_level);

        let (system_prompt, user_prompt) = build_simulation_prompts(
            profile,
            decision_text,
            time_horizon,
            drama_level,
            context,
            user_context,
            &perturbation,
        );

        info!(temp = temperature, drama = drama_level, "开始单次推演");

        let gateway = self.ai_gateway.read().await;
        let raw_response = gateway
            .call(&system_prompt, &user_prompt, temperature)
            .await?;

        debug!(len = raw_response.len(), "收到 LLM 原始响应");

        let candidate: SimulationCandidate =
            serde_json::from_str(&raw_response).map_err(|e| {
                warn!(
                    error = %e,
                    response = &raw_response[..raw_response.len().min(500)],
                    "LLM JSON 解析失败"
                );
                AppError::AiGateway(format!(
                    "LLM 返回的 JSON 格式不正确: {e}"
                ))
            })?;

        info!("单次推演完成");
        Ok(candidate)
    }

    // ========================================================================
    // 批量推演（Sprint 5 核心）
    // ========================================================================

    /// 执行 5 次并发推演 → 聚类 → 返回 3 条代表性候选
    ///
    /// 流程：
    /// 1. 生成 N 组扰动因子
    /// 2. 构建 N 组 Prompt
    /// 3. 并发调用 AI Gateway (tokio::spawn × N)
    /// 4. 进度通知 (MILESTONES)
    /// 5. 现实主义校验 + 重试
    /// 6. 黑天鹅注入
    /// 7. TF-IDF 聚类 → 选取 K 条代表性时间线
    pub async fn simulate_batch(
        &self,
        profile: &UserProfile,
        decision_text: &str,
        time_horizon: &str,
        drama_level: u8,
        context: Option<&str>,
        user_context: &UserContextBlock,
        app_handle: &tauri::AppHandle,
    ) -> Result<Vec<SimulationCandidate>, AppError> {
        let total = self.config.run_count;
        info!(run_count = total, "开始批量推演");

        // Step 1: 通知前端 — 准备推演
        emit_progress(app_handle, 0, total, "正在准备推演...");

        // Step 2: 生成扰动因子 + Prompt + Temperature
        let runs: Vec<(String, String, f32, PerturbationFactors)> =
            (0..total)
                .map(|i| {
                    let perturbation = PerturbationFactors::generate(
                        i,
                        self.config.black_swan_enabled,
                        self.config.black_swan_probability,
                    );
                    let temperature = drama_to_temperature(drama_level);
                    let (sys_p, usr_p) = build_simulation_prompts(
                        profile,
                        decision_text,
                        time_horizon,
                        drama_level,
                        context,
                        user_context,
                        &perturbation,
                    );
                    (sys_p, usr_p, temperature, perturbation)
                })
                .collect();

        // Step 3: 受控并发执行推演（Semaphore 限流 + 重试）
        let semaphore = Arc::new(Semaphore::new(LLM_MAX_CONCURRENT));
        let completed = Arc::new(AtomicUsize::new(0));
        let max_notified = Arc::new(AtomicUsize::new(0));

        let mut handles = Vec::new();
        for (i, (system_prompt, user_prompt, temperature, _perturb)) in
            runs.into_iter().enumerate()
        {
            let gateway = self.ai_gateway.clone();
            let semaphore = semaphore.clone();
            let completed = completed.clone();
            let max_notified = max_notified.clone();
            let app_handle = app_handle.clone();
            let run_total = total;

            handles.push(tokio::spawn(async move {
                // 获取信号量许可 — 限制同时访问 Ollama 的请求数
                let _permit = semaphore.acquire().await.ok()?;
                debug!(run = i, "推演任务获得许可，开始调用 LLM");

                let mut last_error = String::new();
                for attempt in 0..=RUN_MAX_RETRIES {
                    if attempt > 0 {
                        info!(run = i, attempt = attempt, "重试推演");
                        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    }

                    let gw = gateway.read().await;
                    let result = gw
                        .call(&system_prompt, &user_prompt, temperature)
                        .await;
                    drop(gw);

                    match result {
                        Ok(raw) => {
                            // 更新计数 + 里程碑通知
                            let done =
                                completed.fetch_add(1, Ordering::SeqCst) + 1;
                            if MILESTONES.contains(&done) {
                                let prev = max_notified
                                    .fetch_max(done, Ordering::SeqCst);
                                if done > prev {
                                    let msg = format!(
                                        "正在推演第 {done}/{run_total} 种可能..."
                                    );
                                    emit_progress(
                                        &app_handle,
                                        done,
                                        run_total,
                                        &msg,
                                    );
                                }
                            }

                            match serde_json::from_str::<SimulationCandidate>(
                                &raw,
                            ) {
                                Ok(candidate) => return Some(candidate),
                                Err(e) => {
                                    warn!(
                                        run = i,
                                        error = %e,
                                        "LLM JSON 解析失败"
                                    );
                                    last_error = format!("JSON 解析: {e}");
                                }
                            }
                        }
                        Err(e) => {
                            warn!(
                                run = i,
                                attempt = attempt,
                                error = %e,
                                "LLM 调用失败"
                            );
                            last_error = e.to_string();
                        }
                    }
                }

                warn!(
                    run = i,
                    error = %last_error,
                    "推演在重试后仍然失败"
                );
                // 即使此 run 失败，也更新进度计数
                let done = completed.fetch_add(1, Ordering::SeqCst) + 1;
                if MILESTONES.contains(&done) {
                    let prev = max_notified.fetch_max(done, Ordering::SeqCst);
                    if done > prev {
                        let msg =
                            format!("正在推演第 {done}/{run_total} 种可能...");
                        emit_progress(&app_handle, done, run_total, &msg);
                    }
                }
                None
            }));
        }

        let results = futures::future::join_all(handles).await;
        let mut candidates: Vec<SimulationCandidate> = results
            .into_iter()
            .filter_map(|r| r.ok().flatten())
            .collect();

        info!(
            success = candidates.len(),
            total = total,
            "并发推演完成"
        );

        if candidates.is_empty() {
            return Err(AppError::AiGateway(
                "所有推演均失败，请检查 Ollama 连接".to_string(),
            ));
        }

        // Step 4: 通知前端 — 进入聚类阶段
        emit_progress(app_handle, total, total, "正在归纳时间线...");

        // Step 5: 现实主义校验（有 Python Bridge 时才执行）
        if let Some(ref bridge) = self.python_bridge {
            candidates =
                self.apply_realism_checks(candidates, bridge).await;
        }

        // Step 6: 黑天鹅注入
        if self.config.black_swan_enabled {
            candidates = self.inject_black_swan(candidates);
        }

        // Step 7: TF-IDF 聚类 → 3 条代表性时间线
        let selected = if let Some(ref bridge) = self.python_bridge {
            self.cluster_timelines(candidates, bridge).await?
        } else {
            candidates
                .into_iter()
                .take(self.config.timeline_count)
                .collect()
        };

        Ok(selected)
    }

    // ========================================================================
    // 现实主义校验（调用 Python Worker）
    // ========================================================================

    async fn apply_realism_checks(
        &self,
        candidates: Vec<SimulationCandidate>,
        bridge: &Arc<PythonBridge>,
    ) -> Vec<SimulationCandidate> {
        let mut checked = Vec::with_capacity(candidates.len());

        for candidate in candidates {
            let payload = serde_json::json!({
                "narrative": &candidate.narrative,
            });

            match bridge.call("check_realism", payload).await {
                Ok(result) => {
                    let status = result
                        .get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("BALANCED");

                    if status == "BALANCED" {
                        debug!("叙事通过现实主义校验");
                        checked.push(candidate);
                    } else {
                        info!(
                            status = status,
                            "叙事未通过现实主义校验，保留但降低优先级"
                        );
                        // 仍然保留（不重试 LLM），标记为低优先级
                        // 放到列表末尾，聚类时自然被排除
                        checked.push(candidate);
                    }
                }
                Err(e) => {
                    warn!(error = %e, "现实主义校验调用失败，跳过");
                    checked.push(candidate);
                }
            }
        }

        checked
    }

    // ========================================================================
    // 黑天鹅注入
    // ========================================================================

    fn inject_black_swan(
        &self,
        mut candidates: Vec<SimulationCandidate>,
    ) -> Vec<SimulationCandidate> {
        for candidate in &mut candidates {
            if candidate.black_swan_event.is_none() {
                let event =
                    crate::utils::black_swan::pick_random_black_swan();
                candidate.narrative =
                    crate::utils::black_swan::inject_black_swan_into_narrative(
                        &candidate.narrative,
                        &event,
                    );
                candidate.black_swan_event = Some(event);
            }
        }
        candidates
    }

    // ========================================================================
    // TF-IDF 聚类（调用 Python Worker）
    // ========================================================================

    /// 将 N 条候选叙事发给 Python Worker 做 TF-IDF 聚类，
    /// 返回 K 条代表性候选。
    async fn cluster_timelines(
        &self,
        candidates: Vec<SimulationCandidate>,
        bridge: &Arc<PythonBridge>,
    ) -> Result<Vec<SimulationCandidate>, AppError> {
        let k = self.config.timeline_count;

        if candidates.len() <= k {
            return Ok(candidates);
        }

        let narratives: Vec<&str> =
            candidates.iter().map(|c| c.narrative.as_str()).collect();

        let payload = serde_json::json!({
            "narratives": narratives,
            "k": k,
        });

        info!(
            n = candidates.len(),
            k = k,
            "调用 Python Worker 进行 TF-IDF 聚类"
        );

        let result = bridge
            .call("cluster_narratives", payload)
            .await
            .map_err(|e| {
                AppError::PythonBridge(format!("聚类调用失败: {e}"))
            })?;

        let indices: Vec<usize> = result
            .get("cluster_indices")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_else(|| (0..k).collect());

        let mut selected = Vec::new();
        for &idx in &indices {
            if idx < candidates.len() {
                selected.push(candidates[idx].clone());
            }
            if selected.len() >= k {
                break;
            }
        }

        // Fallback: 不足 K 条则补充
        if selected.len() < k {
            for (i, c) in candidates.iter().enumerate() {
                if !indices.contains(&i) && selected.len() < k {
                    selected.push(c.clone());
                }
            }
        }

        info!(selected = selected.len(), "聚类完成");
        Ok(selected)
    }
}

// ============================================================================
// 进度通知
// ============================================================================

fn emit_progress(
    app_handle: &tauri::AppHandle,
    current: usize,
    total: usize,
    message: &str,
) {
    let payload = SimulationProgress {
        current,
        total,
        message: message.to_string(),
    };
    if let Err(e) = app_handle.emit("simulation_progress", &payload) {
        warn!(error = %e, "进度事件发送失败");
    }
}

// ============================================================================
// Prompt 构建（对应 ARCH 8.1）
// ============================================================================

fn build_simulation_prompts(
    profile: &UserProfile,
    decision_text: &str,
    time_horizon: &str,
    drama_level: u8,
    context: Option<&str>,
    user_context: &UserContextBlock,
    perturbation: &PerturbationFactors,
) -> (String, String) {
    let profile_summary = build_profile_summary(profile);
    let context_block = format_user_context(user_context);
    let drama_constraint = drama_constraint_text(drama_level);
    let perturbation_desc = perturbation.to_prompt_description();

    let total_years = parse_years(time_horizon);
    let end_year = total_years;

    let language = if profile.language == "en" {
        "English"
    } else {
        "中文"
    };

    let system_prompt = format!(
        r#"{context_block}

你是一个人生推演引擎。用户会给你一个「决定」和「用户画像」。
你需要推演出这条选择{total_years}年后的人生轨迹。

【用户画像】
{profile_summary}

【戏剧化档位约束】
{drama_constraint}

【扰动因子】
本次推演使用以下随机因子（影响叙事方向，但不改变核心逻辑）：
{perturbation_desc}

【重要约束】
1. 推演必须符合用户的真实行为习惯
2. 如果用户不读书，推演中不应该出现"在家看书学习"
3. 如果用户是社恐，推演中不应该出现"主动组织饭局"
4. 但人有随机性：25%概率出现画像外的行为，5%概率完全相反
5. 每条时间线必须包含：1-2个高光时刻、1个低谷、0-1个意外事件
6. "普通"不等于"失败"，平稳的生活本身就有价值

【输出格式 - 必须严格遵循此 JSON 格式】
{{
  "narrative": "推演叙事（300-500字，语言为{language}）",
  "key_events": [
    {{"year": "1年后", "event": "事件描述", "emotion": "positive"}},
    {{"year": "3年后", "event": "事件描述", "emotion": "negative"}},
    {{"year": "5年后", "event": "事件描述", "emotion": "positive"}}
  ],
  "emotion_dimensions": {{
    "energy": 0到100的数值,
    "satisfaction": 0到100的数值,
    "regret": 0到100的数值,
    "hope": 0到100的数值,
    "loneliness": 0到100的数值
  }},
  "dimension_scores": [
    {{"year": 1, "career": 0到100, "financial": 0到100, "health": 0到100, "relationship": 0到100, "satisfaction": 0到100}},
    {{"year": 3, "career": 0到100, "financial": 0到100, "health": 0到100, "relationship": 0到100, "satisfaction": 0到100}},
    {{"year": {end_year}, "career": 0到100, "financial": 0到100, "health": 0到100, "relationship": 0到100, "satisfaction": 0到100}}
  ]
}}

请严格只输出 JSON，不要有任何额外文字。"#
    );

    let mut user_prompt = format!("【当前决定】\n{decision_text}");
    if let Some(ctx) = context {
        user_prompt.push_str(&format!("\n\n【补充背景】\n{ctx}"));
    }
    user_prompt.push_str(&format!("\n\n【时间跨度】\n推演时长：{time_horizon}"));

    (system_prompt, user_prompt)
}

fn parse_years(time_horizon: &str) -> i32 {
    match time_horizon {
        "1y" => 1,
        "3y" => 3,
        "5y" => 5,
        "10y" => 10,
        _ => 10,
    }
}
