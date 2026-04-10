//! Anthropic API 调用
//!
//! Sprint 10：支持 Claude Sonnet 等模型

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::types::error::AppError;

#[derive(Serialize)]
struct MessagesRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<Msg<'a>>,
    temperature: f32,
}

#[derive(Serialize)]
struct Msg<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct MessagesResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize)]
struct ContentBlock {
    text: Option<String>,
}

pub async fn call_anthropic(
    client: &Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    temperature: f32,
) -> Result<String, AppError> {
    let url = "https://api.anthropic.com/v1/messages";
    debug!(model = %model, "调用 Anthropic API");

    let request = MessagesRequest {
        model,
        max_tokens: 4096,
        system: system_prompt,
        messages: vec![Msg { role: "user", content: user_prompt }],
        temperature,
    };

    let resp = client
        .post(url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::AiGateway(format!("Anthropic 网络请求失败: {e}")))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::AiGateway(format!("Anthropic 返回 {status}: {body}")));
    }

    let parsed: MessagesResponse = resp
        .json()
        .await
        .map_err(|e| AppError::AiGateway(format!("Anthropic 响应解析失败: {e}")))?;

    parsed
        .content
        .into_iter()
        .find_map(|b| b.text)
        .ok_or_else(|| AppError::AiGateway("Anthropic 返回空响应".to_string()))
}
