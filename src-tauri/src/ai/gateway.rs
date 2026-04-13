//! 统一 AI 网关
//!
//! 对所有 Provider（Ollama / OpenAI / Anthropic / Qwen / DeepSeek / Gemini）
//! 提供统一调用接口。Sprint 2 仅实现 Ollama，其余返回 NotImplemented。
//! 包含 UserContextBlock 构建和 split_prompt 工具函数。
//!
//! 对应 ARCH 2.5 / 2.6。

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::info;

use crate::ai::ollama::{self, OllamaConfig};
use crate::ai::{anthropic, gemini, openai, openai_compat};
use crate::types::error::AppError;
use crate::types::profile::UserProfile;

// ============================================================================
// Provider 枚举与配置
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AIProvider {
    Ollama,
    OpenAI,
    Anthropic,
    Qwen,
    DeepSeek,
    Gemini,
}

pub fn parse_provider_str(value: &str) -> Result<AIProvider, AppError> {
    match value {
        "ollama" => Ok(AIProvider::Ollama),
        "openai" => Ok(AIProvider::OpenAI),
        "anthropic" => Ok(AIProvider::Anthropic),
        "qwen" => Ok(AIProvider::Qwen),
        "deepseek" => Ok(AIProvider::DeepSeek),
        "gemini" => Ok(AIProvider::Gemini),
        _ => Err(AppError::InvalidInput(format!("未知 Provider: {value}"))),
    }
}

pub fn provider_to_str(provider: AIProvider) -> &'static str {
    match provider {
        AIProvider::Ollama => "ollama",
        AIProvider::OpenAI => "openai",
        AIProvider::Anthropic => "anthropic",
        AIProvider::Qwen => "qwen",
        AIProvider::DeepSeek => "deepseek",
        AIProvider::Gemini => "gemini",
    }
}

#[derive(Debug, Clone)]
pub struct CloudProviderConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AIGatewayConfig {
    pub provider: AIProvider,
    pub ollama: OllamaConfig,
    pub cloud: Option<CloudProviderConfig>,
}

impl Default for AIGatewayConfig {
    fn default() -> Self {
        Self {
            provider: AIProvider::Ollama,
            ollama: OllamaConfig::default(),
            cloud: None,
        }
    }
}

// ============================================================================
// UserContextBlock（云端/本地 LLM 的记忆注入）
// ============================================================================

/// 用户上下文块 — 每次 LLM 调用前注入到 system prompt 头部
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserContextBlock {
    pub profile_summary: String,
    pub anchor_timeline: Option<AnchorTimelineSummary>,
    pub recent_decisions: Vec<DecisionSummary>,
    pub causal_chain_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorTimelineSummary {
    pub decision_id: String,
    pub decision_text: String,
    pub key_outcome: String,
    pub personality_changes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionSummary {
    pub decision_text: String,
    pub simulated_date: String,
    pub key_outcome: String,
}

// ============================================================================
// AI 网关
// ============================================================================

pub struct AIGateway {
    client: Client,
    config: AIGatewayConfig,
}

fn require_cloud_base(c: &CloudProviderConfig) -> Result<&str, AppError> {
    c.base_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::AiGateway("未配置 API Base URL，请在模型管理页填写".into()))
}

impl AIGateway {
    pub fn new(config: AIGatewayConfig) -> Self {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(600))
            .build()
            .expect("构建 HTTP client 失败");

        info!(provider = ?config.provider, "AI Gateway 初始化");
        Self { client, config }
    }

    /// 统一调用接口
    pub async fn call(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        temperature: f32,
        json_mode: bool,
    ) -> Result<String, AppError> {
        match self.config.provider {
            AIProvider::Ollama => {
                ollama::call_ollama(
                    &self.client,
                    &self.config.ollama,
                    system_prompt,
                    user_prompt,
                    temperature,
                    json_mode,
                )
                .await
            }
            AIProvider::OpenAI => {
                let c = self.cloud_cfg()?;
                let base = require_cloud_base(c)?;
                openai::call_openai(
                    &self.client,
                    &c.api_key,
                    &c.model,
                    base,
                    system_prompt,
                    user_prompt,
                    temperature,
                    json_mode,
                )
                .await
            }
            AIProvider::Anthropic => {
                let c = self.cloud_cfg()?;
                let base = require_cloud_base(c)?;
                anthropic::call_anthropic(
                    &self.client,
                    &c.api_key,
                    &c.model,
                    base,
                    system_prompt,
                    user_prompt,
                    temperature,
                )
                .await
            }
            AIProvider::Qwen => {
                let c = self.cloud_cfg()?;
                let base = require_cloud_base(c)?;
                openai_compat::call_openai_compat(
                    &self.client,
                    &c.api_key,
                    &c.model,
                    base,
                    system_prompt,
                    user_prompt,
                    temperature,
                    "Qwen/DashScope",
                    json_mode,
                )
                .await
            }
            AIProvider::DeepSeek => {
                let c = self.cloud_cfg()?;
                let base = require_cloud_base(c)?;
                openai_compat::call_openai_compat(
                    &self.client,
                    &c.api_key,
                    &c.model,
                    base,
                    system_prompt,
                    user_prompt,
                    temperature,
                    "DeepSeek",
                    json_mode,
                )
                .await
            }
            AIProvider::Gemini => {
                let c = self.cloud_cfg()?;
                let base = require_cloud_base(c)?;
                gemini::call_gemini(
                    &self.client,
                    &c.api_key,
                    &c.model,
                    base,
                    system_prompt,
                    user_prompt,
                    temperature,
                    json_mode,
                )
                .await
            }
        }
    }

    fn cloud_cfg(&self) -> Result<&CloudProviderConfig, AppError> {
        self.config.cloud.as_ref().ok_or_else(|| {
            AppError::AiGateway(format!(
                "{:?} 需要配置 API Key 和模型",
                self.config.provider
            ))
        })
    }

    pub fn provider(&self) -> AIProvider {
        self.config.provider
    }

    pub fn set_ollama_model(&mut self, model: String) {
        self.config.ollama.model = model;
    }

    pub fn set_provider(&mut self, provider: AIProvider) {
        self.config.provider = provider;
    }

    pub fn set_cloud_config(&mut self, cloud: CloudProviderConfig) {
        self.config.cloud = Some(cloud);
    }
}

// ============================================================================
// UserContextBlock 格式化
// ============================================================================

/// 将 UserContextBlock 格式化为 Prompt 文本段落
pub fn format_user_context(ctx: &UserContextBlock) -> String {
    let mut parts = Vec::new();

    parts.push("【用户画像摘要】".to_string());
    parts.push(ctx.profile_summary.clone());

    if let Some(ref anchor) = ctx.anchor_timeline {
        parts.push("\n【当前锚定的时间线】".to_string());
        parts.push(format!("决定：{}", anchor.decision_text));
        parts.push(format!("结果：{}", anchor.key_outcome));
        if !anchor.personality_changes.is_empty() {
            parts.push("性格变化：".to_string());
            for change in &anchor.personality_changes {
                parts.push(format!("  - {change}"));
            }
        }
    }

    if !ctx.recent_decisions.is_empty() {
        parts.push("\n【最近推演历史】".to_string());
        for (i, d) in ctx.recent_decisions.iter().enumerate() {
            parts.push(format!(
                "{}. {} — {} — 结果：{}",
                i + 1,
                d.decision_text,
                d.simulated_date,
                d.key_outcome
            ));
        }
    }

    if let Some(ref causal) = ctx.causal_chain_summary {
        parts.push("\n【因果链背景】".to_string());
        parts.push(causal.clone());
    }

    parts.join("\n")
}

/// 从 UserProfile 构建画像摘要文本
pub fn build_profile_summary(profile: &UserProfile) -> String {
    let mut lines = Vec::new();
    lines.push(format!("职业：{}", profile.occupation));
    lines.push(format!("日常习惯：{}", profile.habits.join("、")));
    lines.push(format!("社交倾向：{}", profile.social_tendency.as_str()));
    lines.push(format!("经济状况：{}", profile.financial_status.as_str()));
    lines.push(format!("性格标签：{}", profile.personality_tags.join("、")));
    lines.push(format!("感情状态：{}", profile.relationship_status));

    if let Some(ref health) = profile.health_status {
        lines.push(format!("健康状况：{health}"));
    }
    if let Some(ref loc) = profile.location {
        lines.push(format!("所在地：{loc}"));
    }
    if !profile.core_fears.is_empty() {
        lines.push(format!("核心恐惧：{}", profile.core_fears.join("、")));
    }
    if !profile.dreams.is_empty() {
        lines.push(format!("梦想目标：{}", profile.dreams.join("、")));
    }

    lines.join("\n")
}

// ============================================================================
// Prompt 拆分
// ============================================================================

/// 将完整 prompt 按 `=== 用户决策 ===` 分隔符拆分为 (system, user)
///
/// 分隔符之前的内容为 system prompt（含 UserContextBlock + 约束指令），
/// 分隔符之后为 user prompt（具体决策文本）。
/// 如果没有找到分隔符，全部作为 user prompt 返回。
pub fn split_prompt(prompt: &str) -> (String, String) {
    const SEPARATOR: &str = "=== 用户决策 ===";
    if let Some(pos) = prompt.find(SEPARATOR) {
        let system = prompt[..pos].trim().to_string();
        let user = prompt[pos + SEPARATOR.len()..].trim().to_string();
        (system, user)
    } else {
        (String::new(), prompt.to_string())
    }
}
