//! OpenAI 兼容格式调用（Qwen/DashScope, DeepSeek）
//!
//! Sprint 10：复用 OpenAI chat completions 格式

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::types::error::AppError;

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<Message<'a>>,
    temperature: f32,
    response_format: ResponseFormat,
}

#[derive(Serialize)]
struct Message<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ResponseFormat {
    r#type: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

pub async fn call_openai_compat(
    client: &Client,
    api_key: &str,
    model: &str,
    base_url: &str,
    system_prompt: &str,
    user_prompt: &str,
    temperature: f32,
    provider_label: &str,
) -> Result<String, AppError> {
    let url = format!("{base_url}/chat/completions");
    debug!(model = %model, provider = %provider_label, "调用 OpenAI 兼容 API");

    let request = ChatRequest {
        model,
        messages: vec![
            Message { role: "system", content: system_prompt },
            Message { role: "user", content: user_prompt },
        ],
        temperature,
        response_format: ResponseFormat { r#type: "json_object".to_string() },
    };

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::AiGateway(format!("{provider_label} 网络请求失败: {e}")))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::AiGateway(format!("{provider_label} 返回 {status}: {body}")));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::AiGateway(format!("{provider_label} 响应解析失败: {e}")))?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| AppError::AiGateway(format!("{provider_label} 返回空响应")))
}
