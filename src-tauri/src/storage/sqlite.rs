//! SQLite 初始化与连接容器
//!
//! 三个数据库文件位于 `<app_data_dir>/another-me/db/`，首次启动自动建表。
//! `Databases` 持有三个独立 `Connection`，每个用 `tokio::sync::Mutex` 保护，
//! 因为 rusqlite 是同步 API — 写操作天然串行化，读操作虽被阻塞但
//! Sprint 1 规模下可忽略。未来若需要并发读可切换到 `r2d2-sqlite` 连接池。

use std::path::PathBuf;

use rusqlite::Connection;
use tauri::Manager;
use tokio::sync::Mutex;
use tracing::info;

use crate::types::error::{AppError, AppResult};

/// 三个数据库的统一容器
pub struct Databases {
    pub profiles: Mutex<Connection>,
    pub decisions: Mutex<Connection>,
    pub settings: Mutex<Connection>,
}

impl Databases {
    /// 由 Tauri `setup` 钩子调用，解析 app_data_dir、建目录、打开连接并 migrate。
    pub fn init(app: &tauri::AppHandle) -> AppResult<Self> {
        let db_dir = resolve_db_dir(app)?;
        std::fs::create_dir_all(&db_dir)?;
        info!(path = %db_dir.display(), "Initializing SQLite databases");

        let profiles = open_and_migrate(&db_dir.join("profiles.db"), PROFILES_SCHEMA)?;
        let decisions = open_and_migrate(&db_dir.join("decisions.db"), DECISIONS_SCHEMA)?;
        let settings = open_and_migrate(&db_dir.join("settings.db"), SETTINGS_SCHEMA)?;

        // 首次启动写入默认设置
        seed_default_settings(&settings)?;

        Ok(Self {
            profiles: Mutex::new(profiles),
            decisions: Mutex::new(decisions),
            settings: Mutex::new(settings),
        })
    }
}

fn resolve_db_dir(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("app_data_dir: {e}")))?;
    Ok(base.join("db"))
}

fn open_and_migrate(path: &std::path::Path, schema: &str) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    // PRAGMA：启用外键约束、WAL 模式（更好的并发读取）
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )?;
    conn.execute_batch(schema)?;
    Ok(conn)
}

fn seed_default_settings(conn: &Connection) -> AppResult<()> {
    // 使用 INSERT OR IGNORE 避免覆盖用户已修改的值
    conn.execute_batch(
        r#"
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('language', '"zh"'),
            ('drama_level', '1'),
            ('black_swan_enabled', 'false'),
            ('safety_valve_enabled', 'true'),
            ('active_model_id', '"qwen3.5:4b"'),
            ('update_check_frequency', '"weekly"'),
            ('last_update_check', 'null'),
            ('audio_enabled', 'false'),
            ('daily_simulation_count', '0'),
            ('last_simulation_date', 'null');
        "#,
    )?;
    Ok(())
}

// ============================================================================
// Schemas — 与 ARCH 5.2 / 5.3 / 5.4 保持一致
// ============================================================================

const PROFILES_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS user_profiles (
    id                  TEXT PRIMARY KEY,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),

    occupation          TEXT NOT NULL,
    habits              TEXT NOT NULL,          -- JSON array
    social_tendency     TEXT NOT NULL,
    financial_status    TEXT NOT NULL,
    personality_tags    TEXT NOT NULL,          -- JSON array
    relationship_status TEXT NOT NULL,

    health_status       TEXT,
    family_background   TEXT,
    location            TEXT,
    core_fears          TEXT,                   -- JSON array
    dreams              TEXT,                   -- JSON array

    hidden_tags         TEXT DEFAULT '[]',

    language            TEXT NOT NULL DEFAULT 'zh',
    profile_version     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS profile_corrections (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),

    correction_type TEXT NOT NULL,
    field           TEXT NOT NULL,
    old_value       TEXT,
    new_value       TEXT NOT NULL,
    confidence      REAL NOT NULL,
    feedback_id     TEXT,

    FOREIGN KEY (profile_id) REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_corrections_profile ON profile_corrections(profile_id);
CREATE INDEX IF NOT EXISTS idx_corrections_feedback ON profile_corrections(feedback_id);
"#;

const DECISIONS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS decisions (
    id                  TEXT PRIMARY KEY,
    profile_id          TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),

    decision_text       TEXT NOT NULL,
    time_horizon        TEXT NOT NULL,
    context             TEXT,

    drama_level         INTEGER NOT NULL DEFAULT 1,
    black_swan_enabled  INTEGER NOT NULL DEFAULT 0,

    is_anchored         INTEGER NOT NULL DEFAULT 0,
    anchored_at         TEXT,

    emotion_snapshot    TEXT NOT NULL,
    result_json         TEXT NOT NULL,
    causal_chain_json   TEXT
);

CREATE TABLE IF NOT EXISTS timelines (
    id                      TEXT PRIMARY KEY,
    decision_id             TEXT NOT NULL,
    type                    TEXT NOT NULL,

    narrative               TEXT NOT NULL,
    emotion_json            TEXT NOT NULL,
    realism_score           REAL NOT NULL,

    key_events_json         TEXT NOT NULL,
    dimension_scores_json   TEXT NOT NULL,

    black_swan_event        TEXT,

    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

CREATE TABLE IF NOT EXISTS causal_chain_links (
    id                          TEXT PRIMARY KEY,
    decision_id                 TEXT NOT NULL,
    previous_decision_id        TEXT NOT NULL,

    influence_description       TEXT NOT NULL,
    personality_changes_json    TEXT NOT NULL,

    FOREIGN KEY (decision_id) REFERENCES decisions(id),
    FOREIGN KEY (previous_decision_id) REFERENCES decisions(id)
);

CREATE TABLE IF NOT EXISTS future_letters (
    id                  TEXT PRIMARY KEY,
    decision_id         TEXT NOT NULL UNIQUE,

    content             TEXT NOT NULL,
    tone_type           TEXT NOT NULL,
    emotion_json        TEXT NOT NULL,
    shine_points_json   TEXT NOT NULL,
    audio_file_path     TEXT,

    written_at_timeline TEXT NOT NULL,

    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

CREATE TABLE IF NOT EXISTS user_feedback (
    id              TEXT PRIMARY KEY,
    decision_id     TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),

    feedback_type   TEXT NOT NULL,
    reasons_json    TEXT,
    corrections_json TEXT,

    processed       INTEGER NOT NULL DEFAULT 0,
    applied         INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

CREATE TABLE IF NOT EXISTS life_map_nodes (
    id                          TEXT PRIMARY KEY,
    profile_id                  TEXT NOT NULL,
    decision_id                 TEXT NOT NULL,

    node_date                   TEXT NOT NULL,
    node_label                  TEXT NOT NULL,
    node_type                   TEXT NOT NULL,
    outcome_summary             TEXT NOT NULL,
    personality_changes_json    TEXT,

    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

CREATE INDEX IF NOT EXISTS idx_decisions_profile ON decisions(profile_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timelines_decision ON timelines(decision_id);
CREATE INDEX IF NOT EXISTS idx_feedback_decision ON user_feedback(decision_id);
CREATE INDEX IF NOT EXISTS idx_lifemap_profile ON life_map_nodes(profile_id);
"#;

const SETTINGS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;
