//! Ollama 健康检查
//!
//! 检测本地 Ollama 是否运行、模型是否已下载。

use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;
use tracing::{debug, warn};

#[derive(Debug, Clone, serde::Serialize)]
pub struct OllamaStatus {
    pub running: bool,
    pub models: Vec<String>,
    pub target_model_ready: bool,
    pub target_model: String,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    #[serde(default)]
    models: Vec<OllamaModel>,
}

#[derive(Deserialize)]
struct OllamaModel {
    name: String,
}

/// 检查 Ollama 运行状态和模型列表
pub async fn check_ollama(
    base_url: &str,
    target_model: &str,
) -> OllamaStatus {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let url = format!("{base_url}/api/tags");
    debug!(url = %url, "检查 Ollama 状态");

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let tags: OllamaTagsResponse = resp
                .json()
                .await
                .unwrap_or(OllamaTagsResponse { models: vec![] });

            let models: Vec<String> =
                tags.models.iter().map(|m| m.name.clone()).collect();

            let target_ready = models
                .iter()
                .any(|m| m.starts_with(target_model) || m == target_model);

            OllamaStatus {
                running: true,
                models,
                target_model_ready: target_ready,
                target_model: target_model.to_string(),
            }
        }
        Ok(resp) => {
            warn!(status = %resp.status(), "Ollama 返回非成功状态");
            OllamaStatus {
                running: false,
                models: vec![],
                target_model_ready: false,
                target_model: target_model.to_string(),
            }
        }
        Err(e) => {
            debug!(error = %e, "Ollama 不可达");
            OllamaStatus {
                running: false,
                models: vec![],
                target_model_ready: false,
                target_model: target_model.to_string(),
            }
        }
    }
}
