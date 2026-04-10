//! 扰动因子生成器
//!
//! 对应 ARCH 2.2 / PRD 3.1.2 的扰动因子库。
//! 每次推演使用不同的随机因子组合，为蒙特卡洛模拟提供多样性。

use rand::Rng;
use serde::{Deserialize, Serialize};

/// 扰动因子集合
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerturbationFactors {
    /// 幸运因子 ±15%
    pub luck_factor: f32,
    /// 健康波动 ±10%
    pub health_var: f32,
    /// 人际关系奇迹（偶发）
    pub relationship_miracle: bool,
    /// 市场条件 ±20%（时代红利）
    pub market_condition: f32,
    /// 个人崩溃（偶发）
    pub personal_breakdown: bool,
    /// 行为习惯偏移 ±30%
    pub habit_offset: f32,
    /// 黑天鹅是否触发
    pub black_swan_triggered: bool,
}

impl PerturbationFactors {
    /// 为第 `_run_index` 次推演生成随机扰动因子
    pub fn generate(
        _run_index: usize,
        black_swan_enabled: bool,
        black_swan_probability: f32,
    ) -> Self {
        let mut rng = rand::rng();

        Self {
            luck_factor: rng.random_range(-0.15_f32..=0.15),
            health_var: rng.random_range(-0.10_f32..=0.10),
            relationship_miracle: rng.random_range(0.0_f32..1.0) < 0.05,
            market_condition: rng.random_range(-0.20_f32..=0.20),
            personal_breakdown: rng.random_range(0.0_f32..1.0) < 0.03,
            habit_offset: rng.random_range(-0.30_f32..=0.30),
            black_swan_triggered: black_swan_enabled
                && rng.random_range(0.0_f32..1.0) < black_swan_probability,
        }
    }

    /// 生成 Prompt 中使用的扰动描述文本
    pub fn to_prompt_description(&self) -> String {
        let mut parts = Vec::new();
        parts.push(format!(
            "- 幸运因子：{:.2}（影响机缘巧合事件）",
            self.luck_factor
        ));
        parts.push(format!(
            "- 健康波动：{:.2}（影响精力和身体状态）",
            self.health_var
        ));
        parts.push(format!(
            "- 市场条件：{:.2}（影响经济环境和时代红利）",
            self.market_condition
        ));
        parts.push(format!(
            "- 行为习惯偏移：{:.0}%（偏离原有习惯的概率）",
            self.habit_offset.abs() * 100.0
        ));

        if self.relationship_miracle {
            parts.push(
                "- 人际关系奇迹：本次推演中可能出现意外的人际关系转折".to_string(),
            );
        }
        if self.personal_breakdown {
            parts.push("- 个人低谷：本次推演中可能出现一次个人低谷期".to_string());
        }
        if self.black_swan_triggered {
            parts.push(
                "- 黑天鹅事件：本次推演中将出现一次彻底改变人生的随机事件".to_string(),
            );
        }

        parts.join("\n")
    }
}
