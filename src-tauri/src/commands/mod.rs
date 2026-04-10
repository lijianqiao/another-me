//! Tauri Command Layer
//!
//! 所有 `#[tauri::command]` 均定义在子模块中，并通过
//! `lib.rs` 的 `invoke_handler![...]` 注册。

pub mod letter;
pub mod profile;
pub mod settings;
pub mod simulate;

// Sprint 4+ 的占位
// pub mod tree;
// pub mod history;
// pub mod model_manager;
// pub mod audio;

/// 应用共享状态（由 `lib.rs` 构造后 `app.manage()` 注入）
pub struct AppState {
    pub db: std::sync::Arc<crate::storage::Databases>,
    pub ai_gateway: std::sync::Arc<
        tokio::sync::RwLock<crate::ai::gateway::AIGateway>,
    >,
}
