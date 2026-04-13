//! 决策记录类型
//!
//! 对应 ARCH 5.3 `decisions` 表和 6.2 命令签名。

use serde::{Deserialize, Serialize};

use crate::types::emotion::EmotionDimensions;
use crate::types::timeline::Timeline;

/// 时间跨度
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TimeHorizon {
    #[serde(rename = "1y")]
    OneYear,
    #[serde(rename = "3y")]
    ThreeYears,
    #[serde(rename = "5y")]
    FiveYears,
    #[serde(rename = "10y")]
    TenYears,
}

impl TimeHorizon {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::OneYear => "1y",
            Self::ThreeYears => "3y",
            Self::FiveYears => "5y",
            Self::TenYears => "10y",
        }
    }
}

/// 推演输入（前端 invoke 时的入参）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateInput {
    pub decision_text: String,
    #[serde(default)]
    pub context: Option<String>,
    pub time_horizon: String, // "1y" | "3y" | "5y" | "10y"
    pub drama_level: u8,      // 1-4
    #[serde(default)]
    pub black_swan_enabled: bool,
    #[serde(default)]
    pub anchor_timeline_id: Option<String>,
}

/// 决策记录（持久化实体，对应 decisions 表）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionRecord {
    pub id: String,
    pub profile_id: String,
    pub created_at: String,

    pub decision_text: String,
    pub time_horizon: String,
    #[serde(default)]
    pub context: Option<String>,

    pub drama_level: u8,
    pub black_swan_enabled: bool,

    pub is_anchored: bool,
    #[serde(default)]
    pub anchored_at: Option<String>,

    pub emotion_snapshot: EmotionDimensions,
}

/// 推演完整结果（前端展示 / 存入 decisions.result_json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub decision_id: String,
    pub timelines: Vec<Timeline>,
    /// 未来来信内容（Sprint 3 填充）
    #[serde(default)]
    pub letter: Option<String>,
    /// 决策树 JSON（Sprint 6 填充）
    #[serde(default)]
    pub decision_tree: Option<serde_json::Value>,
    /// 人生走势图 JSON（Sprint 6 填充）
    #[serde(default)]
    pub life_chart: Option<serde_json::Value>,
    /// 黑暗内容预警（旧数据默认 false）
    #[serde(default)]
    pub dark_content_warning: bool,
    /// 情绪恢复建议（旧数据默认 false）
    #[serde(default)]
    pub emotional_recovery_needed: bool,
    /// 闪光点（旧数据默认空）
    #[serde(default)]
    pub shine_points: Vec<String>,
    /// 来信语气类型（旧数据默认 None）
    #[serde(default)]
    pub letter_tone_type: Option<String>,
    /// 来信闪光点（旧数据默认空）
    #[serde(default)]
    pub letter_shine_points: Vec<String>,
}
