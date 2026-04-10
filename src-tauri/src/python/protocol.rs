//! Rust ↔ Python IPC 协议定义
//!
//! 定义 stdin/stdout JSON 协议的请求/响应结构体。
//! 对应 ARCH 7.1。

use serde::{Deserialize, Serialize};

/// 发送给 Python Worker 的请求
#[derive(Debug, Serialize)]
pub struct WorkerRequest {
    pub command: String,
    pub payload: serde_json::Value,
}

/// Python Worker 返回的响应
#[derive(Debug, Deserialize)]
pub struct WorkerResponse {
    pub success: Option<bool>,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    #[serde(default)]
    pub ready: Option<bool>,
}

/// 现实主义因子检查结果（对应 Python 的 check_realism 返回值）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealismCheckResult {
    pub status: String, // "BALANCED" | "TOO_POSITIVE" | "TOO_NEGATIVE"
    pub positivity_ratio: f32,
    pub suggestion: Option<String>,
}
