//! 本地模型管理
//!
//! Sprint 9：通过 Ollama API/CLI 管理本地模型

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{info, warn};

/// 本地模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelInfo {
    pub name: String,
    pub size: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub is_active: bool,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    #[serde(default)]
    models: Vec<OllamaModelDetail>,
}

#[derive(Deserialize)]
struct OllamaModelDetail {
    name: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    modified_at: String,
}

/// 从 Ollama API 获取已安装模型列表
pub async fn list_models(base_url: &str, active_model: &str) -> Vec<LocalModelInfo> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let url = format!("{base_url}/api/tags");

    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let tags: OllamaTagsResponse = resp
                .json()
                .await
                .unwrap_or(OllamaTagsResponse { models: vec![] });

            tags.models
                .into_iter()
                .map(|m| {
                    let is_active = m.name == active_model
                        || m.name.starts_with(&format!("{active_model}:"));
                    LocalModelInfo {
                        name: m.name,
                        size: format_size(m.size),
                        size_bytes: m.size,
                        modified_at: m.modified_at,
                        is_active,
                    }
                })
                .collect()
        }
        _ => vec![],
    }
}

/// 删除模型（同步阻塞，应在 spawn_blocking 中调用）
pub fn delete_model_blocking(model_id: &str) -> Result<String, String> {
    let output = std::process::Command::new("ollama")
        .args(["rm", model_id])
        .output()
        .map_err(|e| format!("执行 ollama rm 失败: {e}"))?;

    if output.status.success() {
        info!(model = %model_id, "模型已删除");
        Ok(format!("模型 {model_id} 已删除"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        warn!(model = %model_id, error = %stderr, "删除模型失败");
        Err(format!("删除失败: {stderr}"))
    }
}

/// 下载模型（同步阻塞，应在 spawn_blocking 中调用）
pub fn pull_model_blocking(model_id: &str) -> Result<String, String> {
    info!(model = %model_id, "开始下载模型");
    let output = std::process::Command::new("ollama")
        .args(["pull", model_id])
        .output()
        .map_err(|e| format!("执行 ollama pull 失败: {e}"))?;

    if output.status.success() {
        info!(model = %model_id, "模型下载完成");
        Ok(format!("模型 {model_id} 下载完成"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        warn!(model = %model_id, error = %stderr, "下载模型失败");
        Err(format!("下载失败: {stderr}"))
    }
}

fn format_size(bytes: u64) -> String {
    if bytes == 0 {
        return "未知".to_string();
    }
    let gb = bytes as f64 / 1_073_741_824.0;
    if gb >= 1.0 {
        format!("{gb:.1} GB")
    } else {
        let mb = bytes as f64 / 1_048_576.0;
        format!("{mb:.0} MB")
    }
}
