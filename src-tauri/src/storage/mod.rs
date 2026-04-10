//! 数据持久化层
//!
//! 对应 ARCH 5.x Schema。
//!
//! 三个 SQLite 数据库：
//! - `profiles.db`   — 用户画像 + 画像修正
//! - `decisions.db`  — 决策记录、时间线、因果链、来信、反馈、人生地图
//! - `settings.db`   — 应用设置（key-value）

pub mod anchor_store;
pub mod credential_store;
pub mod decision_store;
pub mod feedback_store;
pub mod life_map_store;
pub mod profile_store;
pub mod settings_store;
pub mod sqlite;

pub use sqlite::Databases;
