//! 用户反馈存储
//!
//! Sprint 8：反馈写入 user_feedback 表，查询反馈计数

use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::types::error::AppResult;

/// 用户反馈记录
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserFeedback {
    pub id: String,
    pub decision_id: String,
    pub created_at: String,
    pub feedback_type: String,
    pub reasons: Vec<String>,
    pub corrections: Vec<ProfileCorrectionSuggestion>,
    pub processed: bool,
    pub applied: bool,
}

/// 画像修正建议
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProfileCorrectionSuggestion {
    pub field: String,
    pub old_value: String,
    pub new_value: String,
    pub confidence: f32,
}

/// 反馈输入（前端提交）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FeedbackInput {
    pub decision_id: String,
    /// "not_me" | "accurate"
    pub feedback_type: String,
    pub reasons: Vec<String>,
}

/// 保存反馈
pub fn save_feedback(conn: &Connection, input: &FeedbackInput) -> AppResult<String> {
    let id = Uuid::new_v4().to_string();
    let reasons_json = serde_json::to_string(&input.reasons)?;

    conn.execute(
        r#"
        INSERT INTO user_feedback (
            id, decision_id, created_at,
            feedback_type, reasons_json, corrections_json,
            processed, applied
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        params![
            id,
            input.decision_id,
            Utc::now().to_rfc3339(),
            input.feedback_type,
            reasons_json,
            "[]",
            false,
            false,
        ],
    )?;

    Ok(id)
}

/// 将修正建议写入反馈记录
pub fn save_corrections(
    conn: &Connection,
    feedback_id: &str,
    corrections: &[ProfileCorrectionSuggestion],
) -> AppResult<()> {
    let json = serde_json::to_string(corrections)?;
    conn.execute(
        "UPDATE user_feedback SET corrections_json = ?1, processed = 1 WHERE id = ?2",
        params![json, feedback_id],
    )?;
    Ok(())
}

/// 标记反馈已应用
pub fn mark_applied(conn: &Connection, feedback_id: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE user_feedback SET applied = 1 WHERE id = ?1",
        params![feedback_id],
    )?;
    Ok(())
}

/// 获取用户的反馈总数（用于进化等级计算）
pub fn get_feedback_count(conn: &Connection, decision_ids: &[String]) -> AppResult<u32> {
    if decision_ids.is_empty() {
        return Ok(0);
    }
    let placeholders: String = decision_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT COUNT(*) FROM user_feedback WHERE decision_id IN ({placeholders})"
    );
    let mut stmt = conn.prepare(&sql)?;

    let params_vec: Vec<&dyn rusqlite::ToSql> = decision_ids
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let count: u32 = stmt.query_row(params_vec.as_slice(), |row| row.get(0))?;
    Ok(count)
}

/// 获取用户的总推演次数（用于档位解锁）
pub fn get_total_decision_count(conn: &Connection, profile_id: &str) -> AppResult<u32> {
    let count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM decisions WHERE profile_id = ?1",
        params![profile_id],
        |row| row.get(0),
    )?;
    Ok(count)
}
