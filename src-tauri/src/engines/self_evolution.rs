//! 自我进化引擎
//!
//! Sprint 8：根据用户反馈生成画像修正建议

use crate::storage::feedback_store::ProfileCorrectionSuggestion;
use crate::types::profile::UserProfile;

/// 反馈原因 → 需要调整的字段映射
const REASON_FIELD_MAP: &[(&str, &str)] = &[
    ("personality", "personality_tags"),
    ("financial", "financial_status"),
    ("social", "social_tendency"),
    ("relationship", "relationship_status"),
    ("occupation", "occupation"),
    ("health", "health_status"),
    ("habits", "habits"),
    ("too_optimistic", "personality_tags"),
    ("too_pessimistic", "personality_tags"),
];

/// 根据 "not_me" 反馈和原因，生成画像修正建议
pub fn generate_corrections(
    profile: &UserProfile,
    reasons: &[String],
) -> Vec<ProfileCorrectionSuggestion> {
    let mut suggestions = Vec::new();

    for reason in reasons {
        let reason_lower = reason.to_lowercase();

        for &(pattern, field) in REASON_FIELD_MAP {
            if reason_lower.contains(pattern) {
                if let Some(s) = suggest_for_field(profile, field, &reason_lower) {
                    suggestions.push(s);
                }
            }
        }
    }

    let mut seen = std::collections::HashSet::new();
    suggestions.retain(|s| seen.insert(s.field.clone()));
    suggestions
}

fn suggest_for_field(
    profile: &UserProfile,
    field: &str,
    reason: &str,
) -> Option<ProfileCorrectionSuggestion> {
    match field {
        "personality_tags" => {
            let old = profile.personality_tags.join("、");
            let new_val = if reason.contains("optimistic") || reason.contains("乐观") {
                adjust_tags(&profile.personality_tags, &["乐观"], &["务实"])
            } else if reason.contains("pessimistic") || reason.contains("悲观") {
                adjust_tags(&profile.personality_tags, &["悲观", "谨慎"], &["积极"])
            } else if reason.contains("冒险") {
                adjust_tags(&profile.personality_tags, &["冒险"], &["稳健"])
            } else if reason.contains("保守") {
                adjust_tags(&profile.personality_tags, &["保守"], &["开放"])
            } else {
                return None;
            };
            Some(ProfileCorrectionSuggestion {
                field: field.to_string(),
                old_value: old,
                new_value: new_val,
                confidence: 0.7,
            })
        }
        "financial_status" => {
            let old = profile.financial_status.as_str().to_string();
            let new_val = match old.as_str() {
                "broke" => "saving",
                "saving" => "stable",
                "stable" => "saving",
                "debt" => "saving",
                _ => return None,
            };
            Some(ProfileCorrectionSuggestion {
                field: field.to_string(),
                old_value: old,
                new_value: new_val.to_string(),
                confidence: 0.6,
            })
        }
        "social_tendency" => {
            let old = profile.social_tendency.as_str().to_string();
            let new_val = match old.as_str() {
                "introvert" => "neutral",
                "neutral" => "extrovert",
                "extrovert" => "neutral",
                _ => return None,
            };
            Some(ProfileCorrectionSuggestion {
                field: field.to_string(),
                old_value: old,
                new_value: new_val.to_string(),
                confidence: 0.6,
            })
        }
        "relationship_status" => Some(ProfileCorrectionSuggestion {
            field: field.to_string(),
            old_value: profile.relationship_status.clone(),
            new_value: "（请手动更新）".to_string(),
            confidence: 0.4,
        }),
        "occupation" => Some(ProfileCorrectionSuggestion {
            field: field.to_string(),
            old_value: profile.occupation.clone(),
            new_value: "（请手动更新）".to_string(),
            confidence: 0.4,
        }),
        _ => None,
    }
}

fn adjust_tags(current: &[String], remove: &[&str], add: &[&str]) -> String {
    let mut tags: Vec<String> = current
        .iter()
        .filter(|t| !remove.iter().any(|r| t.contains(r)))
        .cloned()
        .collect();
    for a in add {
        if !tags.iter().any(|t| t.contains(a)) {
            tags.push(a.to_string());
        }
    }
    tags.join("、")
}

/// 计算进化等级（Level 1-4）
pub fn calculate_evolution_level(feedback_count: u32) -> u32 {
    match feedback_count {
        0..=2 => 1,
        3..=5 => 2,
        6..=9 => 3,
        _ => 4,
    }
}

/// 计算允许的最大戏剧化档位
pub fn max_drama_level(_total_simulations: u32) -> u8 {
    4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evolution_levels() {
        assert_eq!(calculate_evolution_level(0), 1);
        assert_eq!(calculate_evolution_level(2), 1);
        assert_eq!(calculate_evolution_level(3), 2);
        assert_eq!(calculate_evolution_level(6), 3);
        assert_eq!(calculate_evolution_level(10), 4);
    }

    #[test]
    fn test_max_drama() {
        assert_eq!(max_drama_level(0), 4);
        assert_eq!(max_drama_level(4), 4);
        assert_eq!(max_drama_level(5), 4);
        assert_eq!(max_drama_level(10), 4);
    }

    #[test]
    fn test_generate_corrections_empty() {
        let profile = UserProfile {
            id: "p1".into(),
            created_at: "".into(),
            updated_at: "".into(),
            occupation: "工程师".into(),
            habits: vec![],
            social_tendency: crate::types::profile::SocialTendency::Neutral,
            financial_status: crate::types::profile::FinancialStatus::Stable,
            personality_tags: vec!["乐观".into(), "冒险".into()],
            relationship_status: "单身".into(),
            health_status: None,
            family_background: None,
            location: None,
            core_fears: vec![],
            dreams: vec![],
            hidden_tags: vec![],
            language: "zh".into(),
            profile_version: 1,
        };
        let corrections = generate_corrections(&profile, &[]);
        assert!(corrections.is_empty());
    }

    #[test]
    fn test_generate_corrections_personality() {
        let profile = UserProfile {
            id: "p1".into(),
            created_at: "".into(),
            updated_at: "".into(),
            occupation: "工程师".into(),
            habits: vec![],
            social_tendency: crate::types::profile::SocialTendency::Neutral,
            financial_status: crate::types::profile::FinancialStatus::Stable,
            personality_tags: vec!["冒险".into(), "乐观".into()],
            relationship_status: "单身".into(),
            health_status: None,
            family_background: None,
            location: None,
            core_fears: vec![],
            dreams: vec![],
            hidden_tags: vec![],
            language: "zh".into(),
            profile_version: 1,
        };
        let corrections = generate_corrections(&profile, &["personality_冒险".to_string()]);
        assert!(!corrections.is_empty());
        assert_eq!(corrections[0].field, "personality_tags");
    }
}
