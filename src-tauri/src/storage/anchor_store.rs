//! 锚定时间线存储
//!
//! Sprint 7：每个用户只能有一条锚定决策，新锚定自动替换旧的。

use chrono::Utc;
use rusqlite::{params, Connection};

use crate::storage::decision_store::StoredDecision;
use crate::types::error::AppResult;

/// 设置锚定（先清除同 profile 下的旧锚定）
pub fn set_anchor(conn: &Connection, profile_id: &str, decision_id: &str) -> AppResult<()> {
    clear_all_anchors(conn, profile_id)?;
    conn.execute(
        "UPDATE decisions SET is_anchored = 1, anchored_at = ?1 WHERE id = ?2 AND profile_id = ?3",
        params![Utc::now().to_rfc3339(), decision_id, profile_id],
    )?;
    Ok(())
}

/// 清除指定决策的锚定（仅限当前用户的决策）
pub fn clear_anchor(conn: &Connection, profile_id: &str, decision_id: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE decisions SET is_anchored = 0, anchored_at = NULL WHERE id = ?1 AND profile_id = ?2",
        params![decision_id, profile_id],
    )?;
    Ok(())
}

/// 清除该用户的所有锚定
pub fn clear_all_anchors(conn: &Connection, profile_id: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE decisions SET is_anchored = 0, anchored_at = NULL WHERE profile_id = ?1 AND is_anchored = 1",
        params![profile_id],
    )?;
    Ok(())
}

/// 获取当前锚定的决策记录（如果有）
pub fn get_anchored_decision(
    conn: &Connection,
    profile_id: &str,
) -> AppResult<Option<StoredDecision>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, profile_id, created_at,
               decision_text, time_horizon, context,
               drama_level, black_swan_enabled,
               is_anchored, anchored_at,
               emotion_snapshot, result_json
        FROM decisions
        WHERE profile_id = ?1 AND is_anchored = 1
        ORDER BY anchored_at DESC
        LIMIT 1
        "#,
    )?;

    let mut rows = stmt.query(params![profile_id])?;
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

/// 获取最近 N 条决策（用于因果链构建）
pub fn get_recent_decisions(
    conn: &Connection,
    profile_id: &str,
    limit: usize,
) -> AppResult<Vec<StoredDecision>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, profile_id, created_at,
               decision_text, time_horizon, context,
               drama_level, black_swan_enabled,
               is_anchored, anchored_at,
               emotion_snapshot, result_json
        FROM decisions
        WHERE profile_id = ?1
        ORDER BY created_at DESC
        LIMIT ?2
        "#,
    )?;

    let rows = stmt.query_map(params![profile_id, limit as i64], |row| {
        Ok(StoredDecision {
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
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }

    Ok(results)
}
