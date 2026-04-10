//! 统一错误类型
//!
//! 对应 ARCH 6.3 错误码规范。
//! 通过 `impl From<E> for String` 让 Tauri 命令能直接返回 `Result<T, String>`。

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Profile not found")]
    ProfileNotFound,

    #[error("Decision not found: {0}")]
    DecisionNotFound(String),

    #[error("AI gateway error: {0}")]
    AiGateway(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Python bridge error: {0}")]
    PythonBridge(String),

    #[error("Serialization error: {0}")]
    Serde(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("I/O error: {0}")]
    Io(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type AppResult<T> = Result<T, AppError>;

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Storage(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Serde(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

/// 让 Tauri 命令可以直接 `?` 到 String 返回类型
impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}
