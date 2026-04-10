//! 决策树数据构建
//!
//! Sprint 6：将推演结果转换为 D3.js 可消费的树形结构

use serde::Serialize;

use crate::types::timeline::{Timeline, TimelineType};

/// D3 树节点
#[derive(Debug, Clone, Serialize)]
pub struct TreeNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emotion: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<TreeNode>,
}

const COLOR_INDIGO: &str = "#4f46e5";
const COLOR_VIOLET: &str = "#7c3aed";
const COLOR_AMBER: &str = "#f59e0b";
const COLOR_CORAL: &str = "#f97316";

fn timeline_color(tt: TimelineType) -> &'static str {
    match tt {
        TimelineType::Reality => COLOR_INDIGO,
        TimelineType::Parallel => COLOR_VIOLET,
        TimelineType::Extreme => COLOR_AMBER,
    }
}

fn event_color(emotion: &str) -> &'static str {
    match emotion {
        "positive" => "#10b981",
        "negative" => "#ef4444",
        _ => "#6b7280",
    }
}

/// 从决策文本和时间线列表构建 D3 树节点数据
pub fn build_tree(decision_text: &str, timelines: &[Timeline]) -> TreeNode {
    let label: String = if decision_text.chars().count() > 40 {
        format!("{}…", decision_text.chars().take(40).collect::<String>())
    } else {
        decision_text.to_string()
    };

    let children: Vec<TreeNode> = timelines
        .iter()
        .enumerate()
        .map(|(i, tl)| {
            let color = timeline_color(tl.timeline_type);

            let event_children: Vec<TreeNode> = tl
                .key_events
                .iter()
                .enumerate()
                .map(|(j, evt)| TreeNode {
                    id: format!("evt-{i}-{j}"),
                    label: format!("{}: {}", evt.year, evt.event),
                    node_type: "event".to_string(),
                    color: event_color(&evt.emotion).to_string(),
                    emotion: Some(evt.emotion.clone()),
                    detail: None,
                    children: vec![],
                })
                .collect();

            let tl_label = match tl.timeline_type {
                TimelineType::Reality => "稳健型",
                TimelineType::Parallel => "转折型",
                TimelineType::Extreme => "极端型",
            };

            TreeNode {
                id: format!("tl-{i}"),
                label: tl_label.to_string(),
                node_type: "timeline".to_string(),
                color: color.to_string(),
                emotion: None,
                detail: Some(
                    tl.narrative
                        .chars()
                        .take(100)
                        .collect::<String>(),
                ),
                children: event_children,
            }
        })
        .collect();

    TreeNode {
        id: "root".to_string(),
        label,
        node_type: "decision".to_string(),
        color: COLOR_CORAL.to_string(),
        emotion: None,
        detail: None,
        children,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::emotion::EmotionDimensions;
    use crate::types::timeline::{KeyEvent, Timeline, TimelineType};

    fn make_timeline(tt: TimelineType, events: Vec<KeyEvent>) -> Timeline {
        Timeline {
            id: "t1".to_string(),
            decision_id: "d1".to_string(),
            timeline_type: tt,
            narrative: "测试叙事".to_string(),
            emotion: EmotionDimensions::neutral(),
            realism_score: 0.5,
            key_events: events,
            dimension_scores: vec![],
            black_swan_event: None,
        }
    }

    #[test]
    fn test_build_tree_structure() {
        let timelines = vec![
            make_timeline(
                TimelineType::Reality,
                vec![KeyEvent {
                    year: "2026".to_string(),
                    event: "创业成功".to_string(),
                    emotion: "positive".to_string(),
                }],
            ),
            make_timeline(TimelineType::Parallel, vec![]),
        ];

        let tree = build_tree("要不要辞职去创业？", &timelines);
        assert_eq!(tree.id, "root");
        assert_eq!(tree.node_type, "decision");
        assert_eq!(tree.children.len(), 2);
        assert_eq!(tree.children[0].node_type, "timeline");
        assert_eq!(tree.children[0].children.len(), 1);
        assert_eq!(tree.children[0].children[0].node_type, "event");
    }

    #[test]
    fn test_label_truncation() {
        let long_text =
            "这是一个非常非常长的决策文本，我需要确保它超过四十个字符才会被截断，否则在树形图中会完整显示而不触发截断逻辑";
        assert!(long_text.chars().count() > 40);
        let tree = build_tree(long_text, &[]);
        assert!(tree.label.ends_with('…'));
        assert!(tree.label.chars().count() <= 42);
    }
}
