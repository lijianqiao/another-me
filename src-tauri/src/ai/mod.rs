//! AI 网关层
//!
//! - `gateway`: 统一 Provider 路由 + UserContextBlock
//! - `ollama`: 本地 Ollama Chat API (`/api/chat`)
//! - Sprint 10: openai / anthropic / qwen / deepseek / gemini

pub mod gateway;
pub mod ollama;
