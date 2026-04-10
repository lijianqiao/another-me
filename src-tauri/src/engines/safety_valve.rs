//! 安全阀模块
//!
//! 对应 ARCH 2.4 / PRD 3.5。
//! 保护用户心理健康：推演上限、黑暗内容预警、情绪回归测试、当下闪光点。

use crate::types::emotion::EmotionDimensions;
use crate::types::profile::UserProfile;

/// 黑暗内容关键词
const DARK_KEYWORDS: &[&str] = &[
    "猝死", "自杀", "重病", "离婚", "破产", "绝症", "家破人亡", "妻离子散",
    "自残", "跳楼", "癌症晚期", "无家可归",
];

/// 每日推演上限
pub const DAILY_SIMULATION_LIMIT: u32 = 3;

/// 检查叙事是否包含黑暗内容
pub fn check_dark_content(narrative: &str) -> bool {
    DARK_KEYWORDS.iter().any(|kw| narrative.contains(kw))
}

/// 检查是否需要情绪回归测试（五维中 3 维低于阈值）
pub fn needs_emotional_recovery_test(emotions: &EmotionDimensions) -> bool {
    emotions.count_below(20.0) >= 3
}

/// 检查每日推演次数是否超限
pub fn check_daily_limit(count: u32) -> Option<DailyLimitWarning> {
    if count >= DAILY_SIMULATION_LIMIT {
        Some(DailyLimitWarning {
            current_count: count,
            limit: DAILY_SIMULATION_LIMIT,
            message: "你已经推演了3次。有时候，最好的决定是活在当下。".to_string(),
        })
    } else {
        None
    }
}

/// 生成当下闪光点（基于画像和历史）
pub fn generate_shine_points(profile: &UserProfile) -> Vec<String> {
    let mut points = Vec::new();

    if profile.occupation.contains("学生") {
        points.push("年轻拥有的可能性".to_string());
    }
    if profile
        .health_status
        .as_deref()
        .is_some_and(|h| h.contains("健康"))
    {
        points.push("健康的身体".to_string());
    }
    if profile.habits.iter().any(|h| h.contains("健身") || h.contains("运动")) {
        points.push("对自我提升的坚持".to_string());
    }
    if profile
        .habits
        .iter()
        .any(|h| h.contains("读书") || h.contains("学习"))
    {
        points.push("持续学习的习惯".to_string());
    }
    if !profile.dreams.is_empty() {
        points.push(format!(
            "心中还有梦想：{}",
            profile.dreams.first().unwrap()
        ));
    }
    if profile
        .relationship_status
        .contains("恋爱")
        || profile.relationship_status.contains("已婚")
    {
        points.push("身边有人相伴".to_string());
    }

    points.push("此刻正在阅读这个故事的专注力".to_string());
    points.push("有勇气去推演未来的好奇心".to_string());

    points.into_iter().take(3).collect()
}

/// 每日推演上限警告
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DailyLimitWarning {
    pub current_count: u32,
    pub limit: u32,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::emotion::EmotionDimensions;
    use crate::types::profile::{FinancialStatus, SocialTendency, UserProfile};

    #[test]
    fn test_dark_content_positive() {
        assert!(check_dark_content("他最终重病住院"));
        assert!(check_dark_content("遭遇破产，生活陷入困境"));
        assert!(check_dark_content("不幸离婚，家庭破裂"));
        assert!(check_dark_content("猝死在办公室"));
    }

    #[test]
    fn test_dark_content_negative() {
        assert!(!check_dark_content("工作顺利，生活美好"));
        assert!(!check_dark_content("升职加薪，和家人一起旅行"));
        assert!(!check_dark_content(""));
    }

    #[test]
    fn test_emotional_recovery_three_low() {
        let emotions = EmotionDimensions {
            energy: 10.0,
            satisfaction: 15.0,
            regret: 90.0,   // 高遗憾 → 100 - 90 = 10 < 20
            hope: 50.0,
            loneliness: 50.0,
        };
        assert!(needs_emotional_recovery_test(&emotions));
    }

    #[test]
    fn test_emotional_recovery_not_needed() {
        let emotions = EmotionDimensions::neutral();
        assert!(!needs_emotional_recovery_test(&emotions));
    }

    #[test]
    fn test_daily_limit_under() {
        assert!(check_daily_limit(0).is_none());
        assert!(check_daily_limit(2).is_none());
    }

    #[test]
    fn test_daily_limit_at_limit() {
        let warning = check_daily_limit(3).expect("应该返回警告");
        assert_eq!(warning.current_count, 3);
        assert_eq!(warning.limit, 3);
    }

    #[test]
    fn test_daily_limit_over() {
        assert!(check_daily_limit(5).is_some());
    }

    #[test]
    fn test_shine_points_student() {
        let profile = make_test_profile("学生", vec!["健身".into(), "读书".into()]);
        let points = generate_shine_points(&profile);
        assert!(!points.is_empty());
        assert!(points.len() <= 3);
    }

    #[test]
    fn test_shine_points_always_has_some() {
        let profile = make_test_profile("其他", vec![]);
        let points = generate_shine_points(&profile);
        assert!(points.len() >= 2, "至少有默认的两条闪光点");
    }

    fn make_test_profile(occupation: &str, habits: Vec<String>) -> UserProfile {
        UserProfile {
            id: "test-001".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            updated_at: "2025-01-01T00:00:00Z".into(),
            occupation: occupation.into(),
            habits,
            social_tendency: SocialTendency::Neutral,
            financial_status: FinancialStatus::Stable,
            personality_tags: vec!["乐观".into()],
            relationship_status: "单身".into(),
            health_status: Some("健康".into()),
            family_background: None,
            location: None,
            core_fears: vec![],
            dreams: vec!["环游世界".into()],
            hidden_tags: vec![],
            language: "zh".into(),
            profile_version: 1,
        }
    }
}
