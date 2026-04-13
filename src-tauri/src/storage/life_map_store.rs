//! 人生地图节点存储
//!
//! Sprint 7：每次推演完成后写入一个 life_map_node，
//! 前端通过 get_life_map 读取全部节点渲染纵向时间轴。

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::types::error::AppResult;

/// 人生地图节点
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LifeMapNode {
    pub id: String,
    pub profile_id: String,
    pub decision_id: String,
    pub node_date: String,
    pub node_label: String,
    /// "decision" | "anchored"
    pub node_type: String,
    pub outcome_summary: String,
    pub personality_changes: Vec<String>,
}

/// 写入一个人生地图节点
pub fn save_node(conn: &Connection, node: &LifeMapNode) -> AppResult<()> {
    let changes_json = serde_json::to_string(&node.personality_changes)?;

    conn.execute(
        r#"
        INSERT OR REPLACE INTO life_map_nodes (
            id, profile_id, decision_id,
            node_date, node_label, node_type,
            outcome_summary, personality_changes_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        params![
            node.id,
            node.profile_id,
            node.decision_id,
            node.node_date,
            node.node_label,
            node.node_type,
            node.outcome_summary,
            changes_json,
        ],
    )?;

    Ok(())
}

/// 获取用户的所有人生地图节点（按日期正序）
pub fn get_life_map(
    conn: &Connection,
    profile_id: &str,
) -> AppResult<Vec<LifeMapNode>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, profile_id, decision_id,
               node_date, node_label, node_type,
               outcome_summary, personality_changes_json
        FROM life_map_nodes
        WHERE profile_id = ?1
        ORDER BY node_date ASC
        "#,
    )?;

    let rows = stmt.query_map(params![profile_id], |row| {
        let changes_str: String = row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "[]".to_string());
        let personality_changes: Vec<String> =
            serde_json::from_str(&changes_str).unwrap_or_default();

        Ok(LifeMapNode {
            id: row.get(0)?,
            profile_id: row.get(1)?,
            decision_id: row.get(2)?,
            node_date: row.get(3)?,
            node_label: row.get(4)?,
            node_type: row.get(5)?,
            outcome_summary: row.get(6)?,
            personality_changes,
        })
    })?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

/// 删除指定决策关联的人生地图节点
pub fn delete_by_decision(conn: &Connection, decision_id: &str) -> AppResult<()> {
    conn.execute(
        "DELETE FROM life_map_nodes WHERE decision_id = ?1",
        params![decision_id],
    )?;
    Ok(())
}

/// 生成新的 life map node ID
pub fn new_node_id() -> String {
    Uuid::new_v4().to_string()
}
