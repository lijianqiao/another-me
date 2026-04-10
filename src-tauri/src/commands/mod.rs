//! Tauri Command Layer
//!
//! 所有 `#[tauri::command]` 均定义在子模块中，并通过
//! `lib.rs` 的 `invoke_handler![...]` 注册。

pub mod export;
pub mod feedback;
pub mod history;
pub mod model;
pub mod letter;
pub mod profile;
pub mod settings;
pub mod simulate;
pub mod tree;

/// 应用共享状态（由 `lib.rs` 构造后 `app.manage()` 注入）
pub struct AppState {
    pub db: std::sync::Arc<crate::storage::Databases>,
    pub ai_gateway: std::sync::Arc<
        tokio::sync::RwLock<crate::ai::gateway::AIGateway>,
    >,
    pub python_worker: std::sync::Arc<
        crate::python::subprocess_bridge::PythonWorkerManager,
    >,
}
