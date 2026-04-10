//! 共享类型模块
//!
//! 对应 ARCH 5.x 的 Schema 和 6.x 的命令签名。
//! 所有结构体默认派生 `Serialize + Deserialize`，以便通过 Tauri IPC
//! 与前端互通，并可直接用 `serde_json` 存入 SQLite 的 TEXT 字段。

pub mod anchor;
pub mod decision;
pub mod emotion;
pub mod error;
pub mod profile;
pub mod settings;
pub mod timeline;

pub use anchor::AnchorTimeline;
pub use decision::{DecisionRecord, SimulateInput, SimulationResult};
pub use emotion::EmotionDimensions;
pub use error::{AppError, AppResult};
pub use profile::{
    FinancialStatus, SocialTendency, UserProfile, UserProfileDraft,
};
pub use settings::AppSettings;
pub use timeline::{DimensionScore, KeyEvent, Timeline, TimelineType};
