//! 「另一个我」Tauri 后端入口
//!
//! Sprint 5 范围：
//!  - 初始化 tracing 日志
//!  - 启动 3 个 SQLite 数据库
//!  - 初始化 AI Gateway（从设置读取模型 ID）
//!  - 初始化 Python Worker Manager（lazy start）
//!  - 注册 AppState 和命令

use std::sync::Arc;

use tauri::Manager;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

pub mod ai;
pub mod commands;
pub mod engines;
pub mod model_manager;
pub mod python;
pub mod storage;
pub mod types;
pub mod utils;

use crate::ai::gateway::{parse_provider_str, AIGateway, AIGatewayConfig};
use crate::ai::ollama::OllamaConfig;
use crate::commands::AppState;
use crate::python::subprocess_bridge::PythonWorkerManager;
use crate::storage::{settings_store, Databases};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    utils::tracing_init::init();
    info!("Starting another-me backend");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            // 初始化数据库
            let db = match Databases::init(handle) {
                Ok(db) => {
                    info!("Databases initialized");
                    Arc::new(db)
                }
                Err(e) => {
                    error!(error = %e, "Failed to initialize databases");
                    return Err(Box::<dyn std::error::Error>::from(
                        e.to_string(),
                    ));
                }
            };

            // 从设置中读取模型 ID 和 Provider，初始化 AI Gateway
            let (model_id, provider_str) = {
                let conn = db.settings.blocking_lock();
                let settings = settings_store::get_all(&conn)
                    .unwrap_or_default();
                (settings.active_model_id, settings.active_provider)
            };

            let provider = match parse_provider_str(&provider_str) {
                Ok(provider) => provider,
                Err(e) => {
                    warn!(provider = %provider_str, error = %e, "设置中的 Provider 无效，回退到 Ollama");
                    ai::gateway::AIProvider::Ollama
                }
            };

            let mut gateway_config = AIGatewayConfig {
                provider,
                ollama: OllamaConfig {
                    model: model_id.clone(),
                    ..OllamaConfig::default()
                },
                ..AIGatewayConfig::default()
            };

            // 如果是云端 Provider，从 credential_store 恢复 API Key + Base URL
            if provider != ai::gateway::AIProvider::Ollama {
                let conn = db.settings.blocking_lock();
                let api_key = match crate::storage::credential_store::get_api_key(&conn, &provider_str) {
                    Ok(key) => key,
                    Err(e) => {
                        warn!(provider = %provider_str, error = %e, "恢复云端 Provider API Key 失败，回退到 Ollama");
                        None
                    }
                };
                let base_url = match crate::storage::credential_store::get_base_url(&conn, &provider_str) {
                    Ok(url) => url,
                    Err(e) => {
                        warn!(provider = %provider_str, error = %e, "恢复云端 Provider Base URL 失败，使用空 Base URL");
                        None
                    }
                };

                if let Some(key) = api_key {
                    gateway_config.cloud = Some(ai::gateway::CloudProviderConfig {
                        api_key: key,
                        model: model_id.clone(),
                        base_url,
                    });
                    info!(provider = %provider_str, model = %model_id, "恢复云端 Provider 配置");
                } else {
                    warn!(provider = %provider_str, "云端 Provider 无有效 API Key，回退到 Ollama");
                    gateway_config.provider = ai::gateway::AIProvider::Ollama;
                }
            }

            let ai_gateway =
                Arc::new(RwLock::new(AIGateway::new(gateway_config)));
            info!(provider = %provider_str, model = %model_id, "AI Gateway initialized");

            // Python Worker Manager（lazy start — 首次推演时启动）
            // 搜索多个候选路径：开发模式和打包后路径不同
            let python_dir = {
                let candidates = [
                    // 开发模式：项目根目录下 python/
                    std::env::current_dir()
                        .unwrap_or_default()
                        .join("python"),
                    // 开发模式：从 Cargo.toml 所在目录向上一层
                    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .parent()
                        .map(|p| p.join("python"))
                        .unwrap_or_default(),
                    // 打包后：resource 目录旁
                    handle
                        .path()
                        .resource_dir()
                        .unwrap_or_default()
                        .join("python"),
                ];
                let found = candidates
                    .iter()
                    .find(|p| p.join("main.py").exists());
                match found {
                    Some(p) => {
                        info!(path = %p.display(), "找到 Python Worker 目录");
                        p.clone()
                    }
                    None => {
                        warn!(
                            candidates = ?candidates.iter().map(|c| c.display().to_string()).collect::<Vec<_>>(),
                            "未找到 Python Worker 目录，NLP 功能将不可用"
                        );
                        candidates[0].clone()
                    }
                }
            };
            let python_worker =
                Arc::new(PythonWorkerManager::new(python_dir));
            info!("Python Worker Manager initialized (lazy)");

            app.manage(AppState {
                db,
                ai_gateway,
                python_worker,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::profile::save_profile,
            commands::profile::get_profile,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::check_ollama_status,
            commands::simulate::simulate_once,
            commands::simulate::simulate_decision,
            commands::history::list_decisions,
            commands::history::get_decision,
            commands::history::delete_decision,
            commands::history::set_anchor_timeline,
            commands::history::clear_anchor,
            commands::history::get_anchor_timeline,
            commands::history::get_life_map,
            commands::feedback::submit_feedback,
            commands::feedback::apply_correction,
            commands::feedback::get_evolution_info,
            commands::model::list_models,
            commands::model::switch_model,
            commands::model::delete_model,
            commands::model::download_model,
            commands::export::export_decision_json,
            commands::export::export_all_json,
            commands::settings::save_api_key,
            commands::settings::delete_api_key,
            commands::settings::list_api_key_status,
            commands::settings::switch_provider,
            commands::system::open_path_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
