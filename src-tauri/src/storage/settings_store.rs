//! 设置存储 CRUD
//!
//! `settings` 是 key-value 表，value 以 JSON 存储。
//! 此模块提供「聚合读 → 反序列化为 AppSettings」和「补丁写」两类操作。

use rusqlite::{params, Connection};
use serde_json::{json, Value};

use crate::types::error::AppResult;
use crate::types::settings::{AppSettings, AppSettingsPatch};

/// 读取一个 key，返回反序列化后的 JSON 值
fn read_value(conn: &Connection, key: &str) -> AppResult<Option<Value>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    let Some(row) = rows.next()? else {
        return Ok(None);
    };
    let raw: String = row.get(0)?;
    Ok(Some(serde_json::from_str(&raw)?))
}

/// 写入一个 key。value 必须是已序列化的 JSON 字符串。
fn write_value(conn: &Connection, key: &str, value: &Value) -> AppResult<()> {
    let raw = serde_json::to_string(value)?;
    conn.execute(
        r#"
        INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        "#,
        params![key, raw],
    )?;
    Ok(())
}

/// 聚合读所有 setting，缺失的字段用默认值填充。
pub fn get_all(conn: &Connection) -> AppResult<AppSettings> {
    let mut settings = AppSettings::default();

    if let Some(v) = read_value(conn, "language")? {
        if let Some(s) = v.as_str() {
            settings.language = s.to_string();
        }
    }
    if let Some(v) = read_value(conn, "drama_level")? {
        if let Some(n) = v.as_u64() {
            settings.drama_level = n as u8;
        }
    }
    if let Some(v) = read_value(conn, "black_swan_enabled")? {
        if let Some(b) = v.as_bool() {
            settings.black_swan_enabled = b;
        }
    }
    if let Some(v) = read_value(conn, "safety_valve_enabled")? {
        if let Some(b) = v.as_bool() {
            settings.safety_valve_enabled = b;
        }
    }
    if let Some(v) = read_value(conn, "active_model_id")? {
        if let Some(s) = v.as_str() {
            settings.active_model_id = s.to_string();
        }
    }
    if let Some(v) = read_value(conn, "active_provider")? {
        if let Some(s) = v.as_str() {
            settings.active_provider = s.to_string();
        }
    }
    if let Some(v) = read_value(conn, "update_check_frequency")? {
        if let Some(s) = v.as_str() {
            settings.update_check_frequency = s.to_string();
        }
    }
    if let Some(v) = read_value(conn, "last_update_check")? {
        settings.last_update_check = v.as_str().map(|s| s.to_string());
    }
    if let Some(v) = read_value(conn, "audio_enabled")? {
        if let Some(b) = v.as_bool() {
            settings.audio_enabled = b;
        }
    }
    if let Some(v) = read_value(conn, "daily_simulation_count")? {
        if let Some(n) = v.as_u64() {
            settings.daily_simulation_count = n as u32;
        }
    }
    if let Some(v) = read_value(conn, "last_simulation_date")? {
        settings.last_simulation_date = v.as_str().map(|s| s.to_string());
    }

    Ok(settings)
}

/// 应用 patch — 只写入 `Some(_)` 字段。
pub fn apply_patch(conn: &Connection, patch: &AppSettingsPatch) -> AppResult<()> {
    if let Some(v) = &patch.language {
        write_value(conn, "language", &json!(v))?;
    }
    if let Some(v) = patch.drama_level {
        write_value(conn, "drama_level", &json!(v))?;
    }
    if let Some(v) = patch.black_swan_enabled {
        write_value(conn, "black_swan_enabled", &json!(v))?;
    }
    if let Some(v) = patch.safety_valve_enabled {
        write_value(conn, "safety_valve_enabled", &json!(v))?;
    }
    if let Some(v) = &patch.active_model_id {
        write_value(conn, "active_model_id", &json!(v))?;
    }
    if let Some(v) = &patch.active_provider {
        write_value(conn, "active_provider", &json!(v))?;
    }
    if let Some(v) = &patch.update_check_frequency {
        write_value(conn, "update_check_frequency", &json!(v))?;
    }
    if let Some(v) = patch.audio_enabled {
        write_value(conn, "audio_enabled", &json!(v))?;
    }
    Ok(())
}
