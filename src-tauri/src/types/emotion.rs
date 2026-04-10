//! 情绪维度系统
//!
//! 对应 PRD 3.2.1 和 ARCH 2.2 的 `EmotionDimensions` 定义。
//! 每个维度取值范围 0.0 - 100.0。
//! LLM 是唯一权威源，Python Worker 不再独立计算（ARCH v1.4 变更）。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionDimensions {
    /// 活力值（高 = 精力充沛，低 = 疲惫）
    pub energy: f32,
    /// 满足感（对人生选择的无悔程度）
    pub satisfaction: f32,
    /// 遗憾度（对未选择的路的好奇）
    pub regret: f32,
    /// 希望值（对未来的期待）
    pub hope: f32,
    /// 孤独感（人际关系质量的反向）
    pub loneliness: f32,
}

impl EmotionDimensions {
    pub fn neutral() -> Self {
        Self {
            energy: 50.0,
            satisfaction: 50.0,
            regret: 50.0,
            hope: 50.0,
            loneliness: 50.0,
        }
    }

    /// 统计低于阈值的维度数量 — 用于情绪回归测试
    /// (PRD 安全阀 / ARCH safety_valve)
    pub fn count_below(&self, threshold: f32) -> usize {
        [
            self.energy,
            self.satisfaction,
            self.hope,
            100.0 - self.regret,      // 高遗憾 = 情绪低落
            100.0 - self.loneliness,  // 高孤独 = 情绪低落
        ]
        .iter()
        .filter(|v| **v < threshold)
        .count()
    }
}
