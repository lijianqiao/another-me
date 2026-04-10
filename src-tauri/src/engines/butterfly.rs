//! 蝴蝶效应引擎
//!
//! Sprint 2 范围：单次推演（调用 AI Gateway → 解析 JSON → 返回 SimulationCandidate）。
//! Sprint 5 扩展：5 次并发推演 + TF-IDF 聚类。
//!
//! 对应 ARCH 2.2 ButterflyEngine。

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::ai::gateway::{
    build_profile_summary, format_user_context, AIGateway, UserContextBlock,
};
use crate::engines::perturbation::PerturbationFactors;
use crate::types::emotion::EmotionDimensions;
use crate::types::error::AppError;
use crate::types::profile::UserProfile;
use crate::types::timeline::{DimensionScore, KeyEvent};
use crate::utils::drama_level::{drama_constraint_text, drama_to_temperature};

// ============================================================================
// 推演候选结果（LLM 输出结构）
// ============================================================================

/// 单次推演候选结果
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
// 蝴蝶效应引擎
// ============================================================================

pub struct ButterflyEngine {
    ai_gateway: Arc<RwLock<AIGateway>>,
}

impl ButterflyEngine {
    pub fn new(ai_gateway: Arc<RwLock<AIGateway>>) -> Self {
        Self { ai_gateway }
    }

    /// Sprint 2：执行**单次**推演
    ///
    /// 流程：构建 Prompt → 调用 AI Gateway → 解析 JSON → 返回候选结果
    pub async fn simulate_once(
        &self,
        profile: &UserProfile,
        decision_text: &str,
        time_horizon: &str,
        drama_level: u8,
        context: Option<&str>,
        user_context: &UserContextBlock,
    ) -> Result<SimulationCandidate, AppError> {
        let perturbation = PerturbationFactors::generate(
            0,
            false,
            0.03,
        );
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

        info!(
            temp = temperature,
            drama = drama_level,
            "开始单次推演"
        );

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
}

// ============================================================================
// Prompt 构建（对应 ARCH 8.1）
// ============================================================================

/// 构建推演的 system prompt 和 user prompt
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
