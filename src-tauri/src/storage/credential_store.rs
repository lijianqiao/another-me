//! API Key 加密存储
//!
//! Sprint 10：AES-256-GCM 加密，存入 settings.db 的 api_keys 表
//!
//! 安全要点：
//! - 每次加密生成随机 12 字节 nonce，与密文一起存储
//! - 密钥从机器本地路径派生，不硬编码在源码中

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rusqlite::{params, Connection};
use tracing::info;

use crate::types::error::{AppError, AppResult};

const NONCE_LEN: usize = 12;

fn derive_key() -> [u8; 32] {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("another-me-default"));
    let seed = format!("another-me::credential-store::{}", base.display());
    let seed_bytes = seed.as_bytes();
    let salt = b"another-me-aes256-key-derivation";
    let mut key = *salt;
    for (i, &b) in seed_bytes.iter().enumerate() {
        key[i % 32] = key[i % 32].wrapping_add(b).wrapping_mul(31).wrapping_add(i as u8);
    }
    key
}

fn cipher() -> Aes256Gcm {
    Aes256Gcm::new(&derive_key().into())
}

fn encrypt(plaintext: &str) -> AppResult<String> {
    let c = cipher();
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = c
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| AppError::Internal(format!("加密失败: {e}")))?;
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(B64.encode(combined))
}

fn decrypt(encoded: &str) -> AppResult<String> {
    let c = cipher();
    let combined = B64
        .decode(encoded)
        .map_err(|e| AppError::Internal(format!("Base64 解码失败: {e}")))?;
    if combined.len() < NONCE_LEN {
        return Err(AppError::Internal("加密数据过短，无法提取 nonce".into()));
    }
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = c
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(format!("解密失败: {e}")))?;
    String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(format!("UTF-8 转换失败: {e}")))
}

/// 存储 API Key
pub fn store_api_key(conn: &Connection, provider: &str, api_key: &str) -> AppResult<()> {
    let encrypted = encrypt(api_key)?;
    conn.execute(
        "INSERT OR REPLACE INTO api_keys (provider, encrypted_key, created_at) VALUES (?1, ?2, datetime('now'))",
        params![provider, encrypted],
    )?;
    info!(provider = %provider, "API Key 已存储");
    Ok(())
}

/// 获取 API Key 明文
pub fn get_api_key(conn: &Connection, provider: &str) -> AppResult<Option<String>> {
    let result: Option<String> = conn
        .query_row(
            "SELECT encrypted_key FROM api_keys WHERE provider = ?1",
            params![provider],
            |row| row.get(0),
        )
        .ok();

    match result {
        Some(encrypted) => Ok(Some(decrypt(&encrypted)?)),
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
