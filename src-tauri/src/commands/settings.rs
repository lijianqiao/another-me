//! 应用设置 + Ollama 检测 + 云端 API Key 管理 命令

use serde::Deserialize;
use tauri::State;
use tracing::{debug, info};

use crate::ai::gateway::{AIProvider, CloudProviderConfig};
use crate::commands::AppState;
use crate::model_manager::ollama_health::{self, OllamaStatus};
use crate::storage::{credential_store, settings_store};
use crate::types::settings::{AppSettings, AppSettingsPatch};

#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    let conn = state.db.settings.lock().await;
    let s = settings_store::get_all(&conn)?;
    Ok(s)
}

#[tauri::command]
pub async fn update_settings(
    patch: AppSettingsPatch,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    debug!(?patch, "update_settings invoked");
    let conn = state.db.settings.lock().await;
    settings_store::apply_patch(&conn, &patch)?;
    let s = settings_store::get_all(&conn)?;
    Ok(s)
}

/// 检查 Ollama 运行状态和模型可用性
#[tauri::command]
pub async fn check_ollama_status(
    state: State<'_, AppState>,
) -> Result<OllamaStatus, String> {
    let settings = {
        let conn = state.db.settings.lock().await;
        settings_store::get_all(&conn)?
    };

    let status = ollama_health::check_ollama(
        "http://127.0.0.1:11434",
        &settings.active_model_id,
    )
    .await;

    Ok(status)
}

// ============================================================================
// Sprint 10: API Key 管理 + Provider 切换
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SaveApiKeyInput {
    pub provider: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
}

fn parse_provider(s: &str) -> Result<AIProvider, String> {
    match s {
        "ollama" => Ok(AIProvider::Ollama),
        "openai" => Ok(AIProvider::OpenAI),
        "anthropic" => Ok(AIProvider::Anthropic),
        "qwen" => Ok(AIProvider::Qwen),
        "deepseek" => Ok(AIProvider::DeepSeek),
        "gemini" => Ok(AIProvider::Gemini),
        _ => Err(format!("未知 Provider: {s}")),
    }
}

fn provider_to_str(p: AIProvider) -> &'static str {
    match p {
        AIProvider::Ollama => "ollama",
        AIProvider::OpenAI => "openai",
        AIProvider::Anthropic => "anthropic",
        AIProvider::Qwen => "qwen",
        AIProvider::DeepSeek => "deepseek",
        AIProvider::Gemini => "gemini",
    }
}

#[tauri::command]
pub async fn save_api_key(
    input: SaveApiKeyInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.settings.lock().await;
    credential_store::save_cloud_provider(
        &conn,
        &input.provider,
        input.api_key.as_deref(),
        input.base_url.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_api_key(
    provider: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.settings.lock().await;
    credential_store::delete_api_key(&conn, &provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_api_key_status(
    state: State<'_, AppState>,
) -> Result<Vec<credential_store::CloudProviderStatus>, String> {
    let conn = state.db.settings.lock().await;
    credential_store::list_cloud_provider_status(&conn).map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct SwitchProviderInput {
    pub provider: String,
    pub model: String,
    pub base_url: Option<String>,
}

#[tauri::command]
pub async fn switch_provider(
    input: SwitchProviderInput,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let provider = parse_provider(&input.provider)?;

    if provider == AIProvider::Ollama {
        let mut gw = state.ai_gateway.write().await;
        gw.set_provider(AIProvider::Ollama);
        gw.set_ollama_model(input.model.clone());
        info!(model = %input.model, "切换到 Ollama");
        return Ok(());
    }

    let (api_key, base_url) = {
        let conn = state.db.settings.lock().await;
        let key = credential_store::get_api_key(&conn, &input.provider)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("未设置 {} API Key", input.provider))?;
        let from_input = input
            .base_url
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
        let merged = from_input.or_else(|| {
            credential_store::get_base_url(&conn, &input.provider)
                .ok()
                .flatten()
        });
        (key, merged)
    };

    if base_url.is_none() {
        return Err("请先在模型管理页填写该提供商的 API Base URL".into());
    }

    let mut gw = state.ai_gateway.write().await;
    gw.set_provider(provider);
    gw.set_cloud_config(CloudProviderConfig {
        api_key,
        model: input.model.clone(),
        base_url,
    });

    info!(
        provider = provider_to_str(provider),
        model = %input.model,
        "切换 AI Provider 完成"
    );
    Ok(())
}
