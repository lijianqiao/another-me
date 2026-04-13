//! Ollama 本地模型调用
//!
//! 使用 Chat API (`/api/chat`)，支持 system/user 消息分离 +
//! `format: "json"` 强制 JSON 输出。对应 ARCH 2.5 / v1.4 变更。

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};

use crate::types::error::AppError;

/// Ollama 连接配置
#[derive(Debug, Clone)]
pub struct OllamaConfig {
    pub base_url: String,
    pub model: String,
}

impl Default for OllamaConfig {
    fn default() -> Self {
        Self {
            base_url: "http://127.0.0.1:11434".to_string(),
            model: "qwen3.5:4b".to_string(),
        }
    }
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<&'a str>,
    options: ChatOptions,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatOptions {
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatResponse {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

/// 调用 Ollama Chat API (`/api/chat`)
pub async fn call_ollama(
    client: &Client,
    config: &OllamaConfig,
    system_prompt: &str,
    user_prompt: &str,
    temperature: f32,
    json_mode: bool,
) -> Result<String, AppError> {
    let url = format!("{}/api/chat", config.base_url);
    debug!(model = %config.model, temp = temperature, json_mode = json_mode, "调用 Ollama Chat API");

    let mut messages = Vec::new();
    if !system_prompt.is_empty() {
        messages.push(ChatMessage {
            role: "system",
            content: system_prompt,
        });
    }
    messages.push(ChatMessage {
        role: "user",
        content: user_prompt,
    });

    let request = ChatRequest {
        model: &config.model,
        messages,
        stream: false,
        format: if json_mode { Some("json") } else { None },
        options: ChatOptions { temperature },
    };

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::AiGateway(format!("网络请求失败: {e}")))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        warn!(status = %status, body = %body, "Ollama 返回非 200");
        return Err(AppError::AiGateway(format!(
            "Ollama 返回 {status}: {body}"
        )));
    }

    let parsed: ChatResponse = response
        .json()
        .await
        .map_err(|e| AppError::AiGateway(format!("响应解析失败: {e}")))?;

    debug!(len = parsed.message.content.len(), "Ollama 响应已收到");
    Ok(parsed.message.content)
}
