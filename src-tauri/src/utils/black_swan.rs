//! 黑天鹅事件库
//!
//! 对应 ARCH 2.2 `pick_random_black_swan`。
//! 随机选取一个彻底改变人生轨迹的极端事件，注入到推演叙事中。

use rand::Rng;

/// 黑天鹅事件池
const BLACK_SWAN_EVENTS: &[&str] = &[
    "突发黑天鹅事件：买彩票意外中得大奖，人生轨迹彻底改变",
    "突发黑天鹅事件：重病一场，经历生死考验后彻底改变人生优先级",
    "突发黑天鹅事件：偶然遇到贵人，意外获得重大职业机会",
    "突发黑天鹅事件：家人突发意外，被迫离开原有城市和职业轨道",
    "突发黑天鹅事件：金融危机中储蓄大幅缩水，被迫重新规划财务",
    "突发黑天鹅事件：旅行中遇到灵魂伴侣，彻底改变人生方向",
    "突发黑天鹅事件：偶然看到一本书，人生观被彻底颠覆",
    "突发黑天鹅事件：所在行业突遭政策变革，职业前景一夜间改变",
    "突发黑天鹅事件：意外获得海外学习机会，踏上完全不同的人生道路",
    "突发黑天鹅事件：创业项目被大公司收购，财务状况突变",
];

/// 随机选取一个黑天鹅事件
pub fn pick_random_black_swan() -> String {
    let mut rng = rand::rng();
    let idx = rng.random_range(0..BLACK_SWAN_EVENTS.len());
    BLACK_SWAN_EVENTS[idx].to_string()
}

/// 将黑天鹅事件注入叙事中
pub fn inject_black_swan_into_narrative(
    narrative: &str,
    event: &str,
) -> String {
    format!(
        "{}（{}）",
        narrative.trim_end_matches('。'),
        event
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pick_random_not_empty() {
        for _ in 0..50 {
            let event = pick_random_black_swan();
            assert!(!event.is_empty());
            assert!(event.contains("黑天鹅事件"));
        }
    }

    #[test]
    fn test_inject_narrative() {
        let narrative = "他过上了平静的生活。";
        let event = "突发黑天鹅事件：中了彩票";
        let result = inject_black_swan_into_narrative(narrative, event);
        assert!(result.contains("平静的生活"));
        assert!(result.contains("中了彩票"));
        assert!(!result.ends_with("。（"), "不应有多余的句号");
    }
}
