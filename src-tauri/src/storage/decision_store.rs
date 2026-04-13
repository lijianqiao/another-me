//! 决策记录存储 CRUD
//!
//! 对应 ARCH 5.3 `decisions` + `timelines` 表。

use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::types::decision::{SimulateInput, SimulationResult};
use crate::types::emotion::EmotionDimensions;
use crate::types::error::AppResult;
use crate::types::timeline::Timeline;

/// 保存决策记录 + 时间线到 decisions.db
pub fn save_decision(
    conn: &Connection,
    profile_id: &str,
    input: &SimulateInput,
    result: &SimulationResult,
    emotion_snapshot: &EmotionDimensions,
) -> AppResult<()> {
    let result_json = serde_json::to_string(result)?;
    let emotion_json = serde_json::to_string(emotion_snapshot)?;

    conn.execute(
        r#"
        INSERT INTO decisions (
            id, profile_id, created_at,
            decision_text, time_horizon, context,
            drama_level, black_swan_enabled,
            is_anchored, anchored_at,
            emotion_snapshot, result_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        "#,
        params![
            result.decision_id,
            profile_id,
            Utc::now().to_rfc3339(),
            input.decision_text,
            input.time_horizon,
            input.context,
            input.drama_level,
            input.black_swan_enabled,
            false,
            Option::<String>::None,
            emotion_json,
            result_json,
        ],
    )?;

    for timeline in &result.timelines {
        save_timeline(conn, timeline)?;
    }

    Ok(())
}

fn save_timeline(conn: &Connection, timeline: &Timeline) -> AppResult<()> {
    let emotion_json = serde_json::to_string(&timeline.emotion)?;
    let events_json = serde_json::to_string(&timeline.key_events)?;
    let scores_json = serde_json::to_string(&timeline.dimension_scores)?;

    conn.execute(
        r#"
        INSERT INTO timelines (
            id, decision_id, type,
            narrative, emotion_json, realism_score,
            key_events_json, dimension_scores_json,
            black_swan_event
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        "#,
        params![
            timeline.id,
            timeline.decision_id,
            timeline.timeline_type.as_str(),
            timeline.narrative,
            emotion_json,
            timeline.realism_score,
            events_json,
            scores_json,
            timeline.black_swan_event,
        ],
    )?;

    Ok(())
}

/// 获取单个决策记录（含 result_json）
pub fn get_decision(
    conn: &Connection,
    decision_id: &str,
) -> AppResult<Option<StoredDecision>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, profile_id, created_at,
               decision_text, time_horizon, context,
               drama_level, black_swan_enabled,
               is_anchored, anchored_at,
               emotion_snapshot, result_json
        FROM decisions WHERE id = ?1
        "#,
    )?;

    let mut rows = stmt.query(params![decision_id])?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };

    Ok(Some(StoredDecision {
        id: row.get(0)?,
        profile_id: row.get(1)?,
        created_at: row.get(2)?,
        decision_text: row.get(3)?,
        time_horizon: row.get(4)?,
        context: row.get(5)?,
        drama_level: row.get(6)?,
        black_swan_enabled: row.get(7)?,
        is_anchored: row.get(8)?,
        anchored_at: row.get(9)?,
        emotion_snapshot_json: row.get(10)?,
        result_json: row.get(11)?,
    }))
}

/// 列出所有决策记录（按创建时间倒序，不含 result_json 以减少传输量）
pub fn list_decisions(conn: &Connection, profile_id: &str) -> AppResult<Vec<DecisionSummary>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, created_at, decision_text, time_horizon,
               drama_level, black_swan_enabled, is_anchored
        FROM decisions
        WHERE profile_id = ?1
        ORDER BY created_at DESC
        "#,
    )?;

    let rows = stmt.query_map(params![profile_id], |row| {
        Ok(DecisionSummary {
            id: row.get(0)?,
            created_at: row.get(1)?,
            decision_text: row.get(2)?,
            time_horizon: row.get(3)?,
            drama_level: row.get(4)?,
            black_swan_enabled: row.get(5)?,
            is_anchored: row.get(6)?,
        })
    })?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

/// 获取今日推演次数
pub fn get_today_count(conn: &Connection, profile_id: &str) -> AppResult<u32> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM decisions WHERE profile_id = ?1 AND created_at LIKE ?2",
        params![profile_id, format!("{today}%")],
        |row| row.get(0),
    )?;
    Ok(count)
}

/// 删除一条决策记录及所有关联数据（事务保护）
///
/// 级联删除顺序：timelines → causal_chain_links → future_letters
/// → user_feedback → life_map_nodes → decisions
pub fn delete_decision(conn: &Connection, decision_id: &str) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute("DELETE FROM timelines WHERE decision_id = ?1", params![decision_id])?;
    tx.execute("DELETE FROM causal_chain_links WHERE decision_id = ?1 OR previous_decision_id = ?1", params![decision_id])?;
    tx.execute("DELETE FROM future_letters WHERE decision_id = ?1", params![decision_id])?;
    tx.execute("DELETE FROM user_feedback WHERE decision_id = ?1", params![decision_id])?;
    tx.execute("DELETE FROM life_map_nodes WHERE decision_id = ?1", params![decision_id])?;
    tx.execute("DELETE FROM decisions WHERE id = ?1", params![decision_id])?;
    tx.commit()?;
    Ok(())
}

/// 为新推演生成 decision_id
pub fn new_decision_id() -> String {
    Uuid::new_v4().to_string()
}

/// 存储的完整决策记录
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StoredDecision {
    pub id: String,
    pub profile_id: String,
    pub created_at: String,
    pub decision_text: String,
    pub time_horizon: String,
    pub context: Option<String>,
    pub drama_level: u8,
    pub black_swan_enabled: bool,
    pub is_anchored: bool,
    pub anchored_at: Option<String>,
    pub emotion_snapshot_json: String,
    pub result_json: String,
}

/// 决策摘要（列表展示用）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DecisionSummary {
    pub id: String,
    pub created_at: String,
    pub decision_text: String,
    pub time_horizon: String,
    pub drama_level: u8,
    pub black_swan_enabled: bool,
    pub is_anchored: bool,
}
