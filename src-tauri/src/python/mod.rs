//! Rust ↔ Python 桥接层
//!
//! - `protocol`: IPC 协议定义（stdin/stdout JSON）
//! - `subprocess_bridge`: 持久化 Worker 进程 + 生命周期管理

pub mod protocol;
pub mod subprocess_bridge;
