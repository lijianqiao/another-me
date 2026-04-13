//! API Key 加密存储
//!
//! Sprint 10：AES-256-GCM 加密，存入 settings.db 的 api_keys 表
//!
//! 安全要点：
//! - 主密钥：首次启动时由 OsRng 生成 32 字节随机值，落盘到
//!   `<data_local_dir>/another-me/credential.key`（Unix 权限 0600）。
//!   之后的所有加解密都读取这份随机密钥，**不再**从路径字符串派生。
//! - 每次加密生成随机 12 字节 nonce（aes-gcm 内部走 OsRng），与密文一起存储。
//! - `provider` 名称绑定为 AEAD Associated Data，防止密文被跨 provider 移植。
//!
//! 迁移说明：旧版本（Sprint 10 早期）使用自定义路径混合函数派生密钥，
//! 升级到本版本后旧条目无法解密，用户需要在"模型管理"页重新录入 API Key。
//! 由于 API Key 只保留在本地且未走多设备同步，这一次性重置可接受。

use std::path::PathBuf;
use std::sync::OnceLock;

use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng, Payload},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rusqlite::{params, Connection};
use serde::Serialize;
use tracing::{info, warn};

use crate::types::error::{AppError, AppResult};

const NONCE_LEN: usize = 12;
const MASTER_KEY_LEN: usize = 32;

/// 进程内主密钥缓存（避免每次加解密都读文件）
static MASTER_KEY: OnceLock<[u8; MASTER_KEY_LEN]> = OnceLock::new();

fn master_key_path() -> PathBuf {
    // 便携模式：exe 旁的 data/ 目录
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            return exe_dir.join("data").join("credential.key");
        }
    }
    // 回退：仅当无法获取 exe 路径时
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    base.join("another-me").join("credential.key")
}

/// 加载（或首次生成）主密钥
fn load_or_create_master_key() -> AppResult<[u8; MASTER_KEY_LEN]> {
    if let Some(k) = MASTER_KEY.get() {
        return Ok(*k);
    }

    let path = master_key_path();

    // 1) 尝试读取现有密钥
    if let Ok(bytes) = std::fs::read(&path) {
        if bytes.len() == MASTER_KEY_LEN {
            let mut k = [0u8; MASTER_KEY_LEN];
            k.copy_from_slice(&bytes);
            let _ = MASTER_KEY.set(k);
            return Ok(k);
        }
        warn!(
            "主密钥文件长度异常（{}B，应为 {}B），将重新生成",
            bytes.len(),
            MASTER_KEY_LEN
        );
    }

    // 2) 生成新密钥
    let mut k = [0u8; MASTER_KEY_LEN];
    OsRng.fill_bytes(&mut k);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            AppError::Internal(format!("创建密钥目录失败: {e}"))
        })?;
    }
    std::fs::write(&path, k).map_err(|e| {
        AppError::Internal(format!("写入主密钥失败: {e}"))
    })?;

    // Unix: 0600 权限（仅属主可读写）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(
            &path,
            std::fs::Permissions::from_mode(0o600),
        );
    }

    info!(path = %path.display(), "已生成新的主密钥");
    let _ = MASTER_KEY.set(k);
    Ok(k)
}

fn cipher() -> AppResult<Aes256Gcm> {
    let key = load_or_create_master_key()?;
    Ok(Aes256Gcm::new(&key.into()))
}

fn encrypt(plaintext: &str, aad: &str) -> AppResult<String> {
    let c = cipher()?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = c
        .encrypt(
            nonce,
            Payload {
                msg: plaintext.as_bytes(),
                aad: aad.as_bytes(),
            },
        )
        .map_err(|e| AppError::Internal(format!("加密失败: {e}")))?;

    let mut combined = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    Ok(B64.encode(combined))
}

fn decrypt(encoded: &str, aad: &str) -> AppResult<String> {
    let c = cipher()?;
    let combined = B64
        .decode(encoded)
        .map_err(|e| AppError::Internal(format!("Base64 解码失败: {e}")))?;
    if combined.len() < NONCE_LEN {
        return Err(AppError::Internal("加密数据过短，无法提取 nonce".into()));
    }
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = c
        .decrypt(
            nonce,
            Payload {
                msg: ciphertext,
                aad: aad.as_bytes(),
            },
        )
        .map_err(|e| AppError::Internal(format!("解密失败: {e}")))?;
    String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(format!("UTF-8 转换失败: {e}")))
}

/// 保存或更新云端提供商：可单独更新 Key、单独更新 Base URL，或同时更新
pub fn save_cloud_provider(
    conn: &Connection,
    provider: &str,
    api_key: Option<&str>,
    base_url: Option<&str>,
) -> AppResult<()> {
    if api_key.is_none() && base_url.is_none() {
        return Err(AppError::Internal(
            "API Key 与 Base URL 至少填写一项".into(),
        ));
    }

    let enc_key: Option<String> = if let Some(k) = api_key {
        Some(encrypt(k, provider)?)
    } else {
        conn.query_row(
            "SELECT encrypted_key FROM api_keys WHERE provider = ?1",
            params![provider],
            |r| r.get(0),
        )
        .ok()
    };

    let enc_key = enc_key.ok_or_else(|| {
        AppError::Internal(
            "请先填写 API Key，或该提供商尚未保存过密钥".into(),
        )
    })?;

    let url_trim = base_url.map(str::trim).filter(|s| !s.is_empty());
    let merged_url: Option<String> = if url_trim.is_some() {
        url_trim.map(|s| s.to_string())
    } else {
        conn.query_row(
            "SELECT base_url FROM api_keys WHERE provider = ?1",
            params![provider],
            |r| r.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten()
    };

    conn.execute(
        "INSERT INTO api_keys (provider, encrypted_key, base_url, created_at)
         VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(provider) DO UPDATE SET
           encrypted_key = excluded.encrypted_key,
           base_url = excluded.base_url",
        params![provider, enc_key, merged_url],
    )?;
    info!(provider = %provider, "云端提供商配置已保存");
    Ok(())
}

/// 获取 API Key 明文
pub fn get_api_key(
    conn: &Connection,
    provider: &str,
) -> AppResult<Option<String>> {
    let result: Option<String> = conn
        .query_row(
            "SELECT encrypted_key FROM api_keys WHERE provider = ?1",
            params![provider],
            |row| row.get(0),
        )
        .ok();

    match result {
        Some(encrypted) => Ok(Some(decrypt(&encrypted, provider)?)),
        None => Ok(None),
    }
}

/// 删除 API Key
pub fn delete_api_key(conn: &Connection, provider: &str) -> AppResult<()> {
    conn.execute(
        "DELETE FROM api_keys WHERE provider = ?1",
        params![provider],
    )?;
    info!(provider = %provider, "API Key 已删除");
    Ok(())
}

/// 检查 API Key 是否存在（不返回明文）
pub fn has_api_key(conn: &Connection, provider: &str) -> bool {
    conn.query_row(
        "SELECT COUNT(*) FROM api_keys WHERE provider = ?1",
        params![provider],
        |row| row.get::<_, i32>(0),
    )
    .unwrap_or(0)
        > 0
}

/// 读取 Base URL（明文）
pub fn get_base_url(
    conn: &Connection,
    provider: &str,
) -> AppResult<Option<String>> {
    let v: Option<String> = conn
        .query_row(
            "SELECT base_url FROM api_keys WHERE provider = ?1",
            params![provider],
            |r| r.get::<_, Option<String>>(0),
        )
        .ok()
        .flatten();
    Ok(v.filter(|s| !s.trim().is_empty()))
}

#[derive(Debug, Serialize)]
pub struct CloudProviderStatus {
    pub provider: String,
    pub has_key: bool,
    pub base_url: Option<String>,
}

/// 列出各云端提供商的 Key 状态与 Base URL
pub fn list_cloud_provider_status(
    conn: &Connection,
) -> AppResult<Vec<CloudProviderStatus>> {
    let providers = ["openai", "anthropic", "qwen", "deepseek", "gemini"];
    let mut out = Vec::new();
    for p in providers {
        let has_key = has_api_key(conn, p);
        let base_url = get_base_url(conn, p)?.filter(|s| !s.trim().is_empty());
        out.push(CloudProviderStatus {
            provider: p.to_string(),
            has_key,
            base_url,
        });
    }
    Ok(out)
}
