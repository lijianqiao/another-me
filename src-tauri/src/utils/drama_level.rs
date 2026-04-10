//! 戏剧化档位 → LLM Temperature 映射
//!
//! 对应 PRD 3.1.7 的四档映射表。

use rand::Rng;

/// 戏剧化档位 → LLM temperature
///
/// | 档位 | Temperature 范围 | 效果 |
/// |------|-----------------|------|
/// | 1    | 0.3 ~ 0.5       | 保守、可预测 |
/// | 2    | 0.5 ~ 0.7       | 适度随机 |
/// | 3    | 0.7 ~ 0.9       | 高随机性 |
/// | 4    | 0.9 ~ 1.2       | 最高随机性 |
pub fn drama_to_temperature(drama_level: u8) -> f32 {
    let mut rng = rand::rng();
    match drama_level {
        1 => 0.3 + rng.random_range(0.0_f32..0.2),
        2 => 0.5 + rng.random_range(0.0_f32..0.2),
        3 => 0.7 + rng.random_range(0.0_f32..0.2),
        4 => 0.9 + rng.random_range(0.0_f32..0.3),
        _ => 0.5,
    }
}

/// 戏剧化档位的 Prompt 约束文本
pub fn drama_constraint_text(drama_level: u8) -> &'static str {
    match drama_level {
        1 => "\
- 90% 的推演应该描述「普通但真实」的人生轨迹
- 10% 可以有小的波折，但不要有毁灭性的结局
- 避免极端化的描述（如：猝死/一夜暴富/彻底改变命运）
- 重点描述日常生活的小确幸和小遗憾
- 「普通」不等于「失败」，平稳的生活本身就有价值",
        2 => "\
- 60% 推演描述普通人生，30% 有合理波动，10% 有意外事件
- 意外事件应该是「意外的收获」或「有惊无险的波折」
- 不要有过度的悲剧或极度的幸运",
        3 => "\
- 30% 普通人生，40% 有明显波动，30% 有戏剧性转折
- 允许重大抉择带来大起大落
- 叙事要有张力，描写要具体生动
- 允许失败，但也允许东山再起",
        4 => "\
- 每条时间线必须有「命运性」的重大转折
- 可以包含：创业暴富/破产、婚姻幸福/破裂、重大疾病/意外康复
- 要让用户感受到「不同的选择真的带来了完全不同的人生」
- 叙事要有张力，描写要具体生动
- 允许极端命运，但两条极端线都要真实可信",
        _ => "- 按普通人生推演，避免极端结果",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_temperature_ranges() {
        for _ in 0..50 {
            let t1 = drama_to_temperature(1);
            assert!((0.3..=0.5).contains(&t1), "档位1温度 {t1} 不在 0.3..0.5");

            let t2 = drama_to_temperature(2);
            assert!((0.5..=0.7).contains(&t2), "档位2温度 {t2} 不在 0.5..0.7");

            let t3 = drama_to_temperature(3);
            assert!((0.7..=0.9).contains(&t3), "档位3温度 {t3} 不在 0.7..0.9");

            let t4 = drama_to_temperature(4);
            assert!((0.9..=1.2).contains(&t4), "档位4温度 {t4} 不在 0.9..1.2");
        }
    }

    #[test]
    fn test_temperature_default() {
        let t = drama_to_temperature(0);
        assert!((t - 0.5).abs() < f32::EPSILON);
        let t = drama_to_temperature(99);
        assert!((t - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn test_constraint_text_not_empty() {
        for level in 1..=4 {
            let text = drama_constraint_text(level);
            assert!(!text.is_empty(), "档位 {level} 约束文本不应为空");
        }
    }
}
