//! Google Gemini API 调用
//!
//! Sprint 10：支持 Gemini 2.0 Flash 等模型

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::types::error::AppError;

#[derive(Serialize)]
struct GenerateRequest<'a> {
    contents: Vec<Content<'a>>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
    #[serde(rename = "systemInstruction", skip_serializing_if = "Option::is_none")]
    system_instruction: Option<SystemInstruction<'a>>,
}

#[derive(Serialize)]
struct Content<'a> {
    role: &'a str,
    parts: Vec<Part<'a>>,
}

#[derive(Serialize)]
struct SystemInstruction<'a> {
    parts: Vec<Part<'a>>,
}

#[derive(Serialize)]
struct Part<'a> {
    text: &'a str,
}

#[derive(Serialize)]
struct GenerationConfig {
    temperature: f32,
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
}

#[derive(Deserialize)]
struct GenerateResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize)]
struct Candidate {
    content: CandidateContent,
}

#[derive(Deserialize)]
struct CandidateContent {
    parts: Vec<CandidatePart>,
}

#[derive(Deserialize)]
struct CandidatePart {
    text: Option<String>,
}

pub async fn call_gemini(
    client: &Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    user_prompt: &str,
    temperature: f32,
) -> Result<String, AppError> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    );
    debug!(model = %model, "调用 Gemini API");

    let request = GenerateRequest {
        system_instruction: if system_prompt.is_empty() {
            None
        } else {
            Some(SystemInstruction {
                parts: vec![Part { text: system_prompt }],
            })
        },
        contents: vec![Content {
            role: "user",
            parts: vec![Part { text: user_prompt }],
        }],
        generation_config: GenerationConfig {
            temperature,
            response_mime_type: "application/json".to_string(),
        },
    };

    let resp = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::AiGateway(format!("Gemini 网络请求失败: {e}")))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::AiGateway(format!("Gemini 返回 {status}: {body}")));
    }

    let parsed: GenerateResponse = resp
        .json()
        .await
        .map_err(|e| AppError::AiGateway(format!("Gemini 响应解析失败: {e}")))?;

    parsed
        .candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content.parts.into_iter().find_map(|p| p.text))
        .ok_or_else(|| AppError::AiGateway("Gemini 返回空响应".to_string()))
}
