//! 画像存储 CRUD
//!
//! MVP 阶段：假设只有一个活跃画像，`id` 固定用 `UUID` 或 "default"。
//! 由于 `user_profiles.id` 是 TEXT PRIMARY KEY，upsert 通过
//! `INSERT ... ON CONFLICT(id) DO UPDATE` 实现。

use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::types::error::{AppError, AppResult};
use crate::types::profile::{
    FinancialStatus, SocialTendency, UserProfile, UserProfileDraft,
};

/// 从 draft 构造一个新 profile（新建场景，分配 UUID）
pub fn new_from_draft(draft: UserProfileDraft) -> UserProfile {
    let now = Utc::now().to_rfc3339();
    UserProfile {
        id: Uuid::new_v4().to_string(),
        created_at: now.clone(),
        updated_at: now,
        occupation: draft.occupation,
        habits: draft.habits,
        social_tendency: draft.social_tendency,
        financial_status: draft.financial_status,
        personality_tags: draft.personality_tags,
        relationship_status: draft.relationship_status,
        health_status: draft.health_status,
        family_background: draft.family_background,
        location: draft.location,
        core_fears: draft.core_fears,
        dreams: draft.dreams,
        hidden_tags: vec![],
        language: draft.language,
        profile_version: 1,
    }
}

/// Upsert 画像
pub fn upsert(conn: &Connection, profile: &UserProfile) -> AppResult<()> {
    let habits_json = serde_json::to_string(&profile.habits)?;
    let tags_json = serde_json::to_string(&profile.personality_tags)?;
    let fears_json = serde_json::to_string(&profile.core_fears)?;
    let dreams_json = serde_json::to_string(&profile.dreams)?;
    let hidden_json = serde_json::to_string(&profile.hidden_tags)?;
    let updated_at = Utc::now().to_rfc3339();

    conn.execute(
        r#"
        INSERT INTO user_profiles (
            id, created_at, updated_at,
            occupation, habits, social_tendency, financial_status,
            personality_tags, relationship_status,
            health_status, family_background, location,
            core_fears, dreams, hidden_tags,
            language, profile_version
        ) VALUES (
            ?1, ?2, ?3,
            ?4, ?5, ?6, ?7,
            ?8, ?9,
            ?10, ?11, ?12,
            ?13, ?14, ?15,
            ?16, ?17
        )
        ON CONFLICT(id) DO UPDATE SET
            updated_at          = excluded.updated_at,
            occupation          = excluded.occupation,
            habits              = excluded.habits,
            social_tendency     = excluded.social_tendency,
            financial_status    = excluded.financial_status,
            personality_tags    = excluded.personality_tags,
            relationship_status = excluded.relationship_status,
            health_status       = excluded.health_status,
            family_background   = excluded.family_background,
            location            = excluded.location,
            core_fears          = excluded.core_fears,
            dreams              = excluded.dreams,
            hidden_tags         = excluded.hidden_tags,
            language            = excluded.language,
            profile_version     = excluded.profile_version
        "#,
        params![
            profile.id,
            profile.created_at,
            updated_at,
            profile.occupation,
            habits_json,
            profile.social_tendency.as_str(),
            profile.financial_status.as_str(),
            tags_json,
            profile.relationship_status,
            profile.health_status,
            profile.family_background,
            profile.location,
            fears_json,
            dreams_json,
            hidden_json,
            profile.language,
            profile.profile_version,
        ],
    )?;
    Ok(())
}

/// 获取当前（最近更新的）画像。MVP 只支持单画像。
pub fn get_current(conn: &Connection) -> AppResult<Option<UserProfile>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT
            id, created_at, updated_at,
            occupation, habits, social_tendency, financial_status,
            personality_tags, relationship_status,
            health_status, family_background, location,
            core_fears, dreams, hidden_tags,
            language, profile_version
        FROM user_profiles
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )?;

    let mut rows = stmt.query([])?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };

    let habits_str: String = row.get(4)?;
    let tags_str: String = row.get(7)?;
    let fears_str: Option<String> = row.get(12)?;
    let dreams_str: Option<String> = row.get(13)?;
    let hidden_str: Option<String> = row.get(14)?;

    let profile = UserProfile {
        id: row.get(0)?,
        created_at: row.get(1)?,
        updated_at: row.get(2)?,
        occupation: row.get(3)?,
        habits: parse_json_array(&habits_str)?,
        social_tendency: {
            let s: String = row.get(5)?;
            SocialTendency::from_str_lossy(&s)
        },
        financial_status: {
            let s: String = row.get(6)?;
            FinancialStatus::from_str_lossy(&s)
        },
        personality_tags: parse_json_array(&tags_str)?,
        relationship_status: row.get(8)?,
        health_status: row.get(9)?,
        family_background: row.get(10)?,
        location: row.get(11)?,
        core_fears: fears_str
            .as_deref()
            .map(parse_json_array)
            .transpose()?
            .unwrap_or_default(),
        dreams: dreams_str
            .as_deref()
            .map(parse_json_array)
            .transpose()?
            .unwrap_or_default(),
        hidden_tags: hidden_str
            .as_deref()
            .map(parse_json_array)
            .transpose()?
            .unwrap_or_default(),
        language: row.get(15)?,
        profile_version: row.get(16)?,
    };

    Ok(Some(profile))
}

fn parse_json_array(s: &str) -> AppResult<Vec<String>> {
    serde_json::from_str(s).map_err(AppError::from)
}
