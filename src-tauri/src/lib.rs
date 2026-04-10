//! 「另一个我」Tauri 后端入口
//!
//! Sprint 2 范围：
//!  - 初始化 tracing 日志
//!  - 启动 3 个 SQLite 数据库
//!  - 初始化 AI Gateway（默认 Ollama）
//!  - 注册 AppState（含 db + ai_gateway）和命令

use std::sync::Arc;

use tauri::Manager;
use tokio::sync::RwLock;
use tracing::{error, info};

pub mod ai;
pub mod commands;
pub mod engines;
pub mod model_manager;
pub mod python;
pub mod storage;
pub mod types;
pub mod utils;

use crate::ai::gateway::{AIGateway, AIGatewayConfig};
use crate::ai::ollama::OllamaConfig;
use crate::commands::AppState;
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

            // 从设置中读取模型 ID，初始化 AI Gateway
            let model_id = {
                let conn = db.settings.blocking_lock();
                settings_store::get_all(&conn)
                    .map(|s| s.active_model_id)
                    .unwrap_or_else(|_| "qwen3.5:4b".to_string())
            };
            let gateway_config = AIGatewayConfig {
                ollama: OllamaConfig {
                    model: model_id.clone(),
                    ..OllamaConfig::default()
                },
                ..AIGatewayConfig::default()
            };
            let ai_gateway = Arc::new(RwLock::new(AIGateway::new(gateway_config)));
            info!(model = %model_id, "AI Gateway initialized with settings model");

            app.manage(AppState { db, ai_gateway });
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
