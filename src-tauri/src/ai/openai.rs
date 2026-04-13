//! OpenAI API 调用
//!
//! Sprint 10：支持 GPT-4o 等模型

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::types::error::AppError;

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<Message<'a>>,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
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

pub async fn call_openai(
    client: &Client,
    api_key: &str,
    model: &str,
    base_url: &str,
    system_prompt: &str,
    user_prompt: &str,
    temperature: f32,
    json_mode: bool,
) -> Result<String, AppError> {
    let base = base_url.trim().trim_end_matches('/');
    let url = format!("{}/v1/chat/completions", base);
    debug!(model = %model, json_mode = json_mode, "调用 OpenAI API");

    let request = ChatRequest {
        model,
        messages: vec![
            Message { role: "system", content: system_prompt },
            Message { role: "user", content: user_prompt },
        ],
        temperature,
        response_format: if json_mode {
            Some(ResponseFormat { r#type: "json_object".to_string() })
        } else {
            None
        },
    };

    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::AiGateway(format!("OpenAI 网络请求失败: {e}")))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::AiGateway(format!("OpenAI 返回 {status}: {body}")));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::AiGateway(format!("OpenAI 响应解析失败: {e}")))?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| AppError::AiGateway("OpenAI 返回空响应".to_string()))
}
