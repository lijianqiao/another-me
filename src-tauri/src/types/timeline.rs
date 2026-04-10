//! 时间线类型
//!
//! 对应 ARCH 5.3 `timelines` 表和 butterfly.rs 的 `SimulationCandidate`。

use serde::{Deserialize, Serialize};

use crate::types::emotion::EmotionDimensions;

/// 时间线类型（用于 3 条归纳结果的分类）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TimelineType {
    /// 现实线（稳健型）
    Reality,
    /// 平行线（转折型 / 极端型）
    Parallel,
}

impl TimelineType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Reality => "reality",
            Self::Parallel => "parallel",
        }
    }
}

/// 关键事件（时间线上的节点）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyEvent {
    pub year: String,
    pub event: String,
    /// "positive" | "neutral" | "negative"
    pub emotion: String,
}

/// 人生维度分数（对应 PRD 3.3.3 走势图）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DimensionScore {
    pub year: i32,
    pub career: f32,
    pub financial: f32,
    pub health: f32,
    pub relationship: f32,
    pub satisfaction: f32,
}

/// 时间线（完整结构 — 一条推演路径）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timeline {
    pub id: String,
    pub decision_id: String,
    pub timeline_type: TimelineType,

    pub narrative: String,
    pub emotion: EmotionDimensions,
    pub realism_score: f32,

    pub key_events: Vec<KeyEvent>,
    pub dimension_scores: Vec<DimensionScore>,

    #[serde(default)]
    pub black_swan_event: Option<String>,
}
