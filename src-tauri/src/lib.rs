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
use crate::commands::AppState;
use crate::storage::Databases;

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

            // 初始化 AI Gateway（默认 Ollama）
            let ai_gateway = Arc::new(RwLock::new(AIGateway::new(
                AIGatewayConfig::default(),
            )));
            info!("AI Gateway initialized");

            app.manage(AppState { db, ai_gateway });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::profile::save_profile,
            commands::profile::get_profile,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::simulate::simulate_once,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
