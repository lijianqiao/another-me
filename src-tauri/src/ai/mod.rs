//! AI 网关层
//!
//! - `gateway`: 统一 Provider 路由 + UserContextBlock
//! - `ollama`: 本地 Ollama Chat API (`/api/chat`)
//! - `openai`: OpenAI GPT-4o
//! - `anthropic`: Claude Sonnet
//! - `openai_compat`: Qwen/DashScope + DeepSeek (OpenAI 兼容格式)
//! - `gemini`: Google Gemini

pub mod anthropic;
pub mod gateway;
pub mod gemini;
pub mod ollama;
pub mod openai;
pub mod openai_compat;
