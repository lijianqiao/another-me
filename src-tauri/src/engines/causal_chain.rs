//! 因果链引擎
//!
//! Sprint 7：从历史决策中构建因果链上下文，注入到推演 Prompt。
//!
//! 流程：查历史 → 加载锚定决策 → 提取结局摘要 → 格式化上下文

use rusqlite::Connection;
use tracing::info;

use crate::ai::gateway::{AnchorTimelineSummary, DecisionSummary as GwDecisionSummary};
use crate::storage::anchor_store;
use crate::types::decision::SimulationResult;
use crate::types::error::AppResult;
use crate::types::timeline::Timeline;

/// 因果链上下文（注入到 UserContextBlock 中）
pub struct CausalContext {
    pub anchor_timeline: Option<AnchorTimelineSummary>,
    pub recent_decisions: Vec<GwDecisionSummary>,
    pub causal_chain_summary: Option<String>,
}

const MAX_RECENT: usize = 5;

/// 从历史数据构建因果链上下文
pub fn build_context(conn: &Connection, profile_id: &str) -> AppResult<CausalContext> {
    // 1. 加载最近推演历史
    let recent_stored = anchor_store::get_recent_decisions(conn, profile_id, MAX_RECENT)?;
    let recent_decisions: Vec<GwDecisionSummary> = recent_stored
        .iter()
        .filter_map(|stored| {
            let result: SimulationResult = serde_json::from_str(&stored.result_json).ok()?;
            let key_outcome = extract_key_outcome(&result.timelines);
            Some(GwDecisionSummary {
                decision_text: stored.decision_text.clone(),
                simulated_date: stored.created_at.clone(),
                key_outcome,
            })
        })
        .collect();

    // 2. 加载锚定决策
    let anchor_timeline = match anchor_store::get_anchored_decision(conn, profile_id)? {
        Some(anchored) => {
            let result: SimulationResult = serde_json::from_str(&anchored.result_json)
                .ok()
                .unwrap_or_else(|| SimulationResult {
                    decision_id: anchored.id.clone(),
                    timelines: vec![],
                    letter: None,
                    decision_tree: None,
                    life_chart: None,
                    dark_content_warning: false,
                    emotional_recovery_needed: false,
                    shine_points: vec![],
                    letter_tone_type: None,
                    letter_shine_points: vec![],
                });
            let key_outcome = extract_key_outcome(&result.timelines);
            let personality_changes = extract_personality_changes(&result.timelines);

            info!(decision_id = %anchored.id, "加载锚定决策上下文");

            Some(AnchorTimelineSummary {
                decision_id: anchored.id,
                decision_text: anchored.decision_text,
                key_outcome,
                personality_changes,
            })
        }
        None => None,
    };

    // 3. 构建因果链摘要
    let causal_chain_summary = if recent_decisions.is_empty() {
        None
    } else {
        let mut lines = Vec::new();
        lines.push(format!(
            "用户此前做过 {} 次人生推演，决策轨迹如下：",
            recent_decisions.len()
        ));
        for (i, d) in recent_decisions.iter().enumerate() {
            lines.push(format!(
                "{}. 「{}」→ {}",
                i + 1,
                d.decision_text,
                d.key_outcome
            ));
        }
        if anchor_timeline.is_some() {
            lines.push(
                "用户已锚定其中一条时间线作为人生主线，新推演应承接该锚定线的世界观。".to_string(),
            );
        }
        Some(lines.join("\n"))
    };

    info!(
        recent = recent_decisions.len(),
        anchored = anchor_timeline.is_some(),
        "因果链上下文构建完成"
    );

    Ok(CausalContext {
        anchor_timeline,
        recent_decisions,
        causal_chain_summary,
    })
}

/// 从时间线列表提取最核心的结局描述
fn extract_key_outcome(timelines: &[Timeline]) -> String {
    timelines
        .first()
        .map(|tl| {
            if let Some(last_event) = tl.key_events.last() {
                format!("{}: {}", last_event.year, last_event.event)
            } else {
                let chars: String = tl.narrative.chars().take(80).collect();
                if tl.narrative.chars().count() > 80 {
                    format!("{chars}…")
                } else {
                    chars
                }
            }
        })
        .unwrap_or_else(|| "（无结局数据）".to_string())
}

/// 从时间线情绪推断性格变化（公开接口，供 simulate 写入 life_map 使用）
pub fn extract_personality_changes_pub(timelines: &[Timeline]) -> Vec<String> {
    extract_personality_changes(timelines)
}

/// 从时间线情绪变化推断性格变化
fn extract_personality_changes(timelines: &[Timeline]) -> Vec<String> {
    let mut changes = Vec::new();

    if let Some(tl) = timelines.first() {
        let e = &tl.emotion;
        if e.energy > 70.0 && e.hope > 70.0 {
            changes.push("变得更加积极主动".to_string());
        }
        if e.regret > 60.0 {
            changes.push("对风险变得更加谨慎".to_string());
        }
        if e.loneliness > 60.0 {
            changes.push("更加珍视人际关系".to_string());
        }
        if e.satisfaction > 70.0 {
            changes.push("对当前路线更加自信".to_string());
        }
    }

    changes
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::emotion::EmotionDimensions;
    use crate::types::timeline::{KeyEvent, Timeline, TimelineType};

    #[test]
    fn test_extract_key_outcome_from_events() {
        let tl = Timeline {
            id: "t1".into(),
            decision_id: "d1".into(),
            timeline_type: TimelineType::Reality,
            narrative: "长叙事".into(),
            emotion: EmotionDimensions::neutral(),
            realism_score: 0.5,
            key_events: vec![
                KeyEvent {
                    year: "2026".into(),
                    event: "开始创业".into(),
                    emotion: "positive".into(),
                },
                KeyEvent {
                    year: "2028".into(),
                    event: "公司上市".into(),
                    emotion: "positive".into(),
                },
            ],
            dimension_scores: vec![],
            black_swan_event: None,
        };
        let outcome = extract_key_outcome(&[tl]);
        assert_eq!(outcome, "2028: 公司上市");
    }

    #[test]
    fn test_extract_key_outcome_no_events() {
        let tl = Timeline {
            id: "t1".into(),
            decision_id: "d1".into(),
            timeline_type: TimelineType::Reality,
            narrative: "这是一段较长的叙事文本，用于测试截断逻辑".into(),
            emotion: EmotionDimensions::neutral(),
            realism_score: 0.5,
            key_events: vec![],
            dimension_scores: vec![],
            black_swan_event: None,
        };
        let outcome = extract_key_outcome(&[tl]);
        assert!(outcome.contains("叙事"));
    }

    #[test]
    fn test_personality_changes_positive() {
        let tl = Timeline {
            id: "t1".into(),
            decision_id: "d1".into(),
            timeline_type: TimelineType::Reality,
            narrative: "".into(),
            emotion: EmotionDimensions {
                energy: 80.0,
                satisfaction: 75.0,
                regret: 20.0,
                hope: 80.0,
                loneliness: 20.0,
            },
            realism_score: 0.5,
            key_events: vec![],
            dimension_scores: vec![],
            black_swan_event: None,
        };
        let changes = extract_personality_changes(&[tl]);
        assert!(changes.contains(&"变得更加积极主动".to_string()));
        assert!(changes.contains(&"对当前路线更加自信".to_string()));
    }
}
