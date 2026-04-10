//! 画像相关 Tauri 命令
//!
//! - `save_profile`: Onboarding 完成后首次写入，或后续编辑
//! - `get_profile`:  启动时检查是否已有画像；无则跳 Onboarding

use tauri::State;
use tracing::{debug, info};

use crate::commands::AppState;
use crate::storage::profile_store;
use crate::types::profile::{UserProfile, UserProfileDraft};

/// 保存画像
///
/// 前端传 `UserProfileDraft`（首次）或 `UserProfile`（已有 id）。
/// 为简化 IPC 契约，这里统一接收一个 JSON 对象：若含 `id` 则 upsert，
/// 否则作为 draft 新建。
#[derive(Debug, serde::Deserialize)]
#[serde(untagged)]
pub enum SaveProfileInput {
    Existing(UserProfile),
    Draft(UserProfileDraft),
}

#[tauri::command]
pub async fn save_profile(
    input: SaveProfileInput,
    state: State<'_, AppState>,
) -> Result<UserProfile, String> {
    let profile = match input {
        SaveProfileInput::Existing(p) => p,
        SaveProfileInput::Draft(d) => profile_store::new_from_draft(d),
    };
    debug!(id = %profile.id, "save_profile invoked");

    let conn = state.db.profiles.lock().await;
    profile_store::upsert(&conn, &profile)?;
    info!(id = %profile.id, "profile saved");
    Ok(profile)
}

/// 获取当前画像；若不存在返回 `None`（前端据此跳 Onboarding）
#[tauri::command]
pub async fn get_profile(
    state: State<'_, AppState>,
) -> Result<Option<UserProfile>, String> {
    let conn = state.db.profiles.lock().await;
    let profile = profile_store::get_current(&conn)?;
    Ok(profile)
}
