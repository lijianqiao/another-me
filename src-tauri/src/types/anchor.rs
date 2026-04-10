//! 锚定时间线类型
//!
//! 对应 PRD 3.4 记忆连贯性机制和 ARCH 2.x `AnchorTimelineSummary`。

use serde::{Deserialize, Serialize};

/// 锚定时间线摘要（注入到后续推演的因果链中）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorTimeline {
    pub decision_id: String,
    pub anchored_at: String,

    /// 锚定线的核心结论（一句话）
    pub key_outcome: String,

    /// 对性格的影响（例如：["保守→冒险", "谨慎→果断"]）
    pub personality_impact: Vec<String>,

    /// 时间线类型（reality / parallel）
    pub timeline_type: String,
}
