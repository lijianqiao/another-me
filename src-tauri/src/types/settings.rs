//! 应用设置类型
//!
//! 对应 ARCH 5.4 `settings` 表。
//! settings 表是 key-value 结构，此结构体是反序列化后的聚合视图。

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub language: String,
    pub drama_level: u8,
    pub black_swan_enabled: bool,
    pub safety_valve_enabled: bool,
    pub active_model_id: String,
    /// 当前激活的 AI 提供商: "ollama" | "openai" | "anthropic" | "qwen" | "deepseek" | "gemini"
    pub active_provider: String,
    pub update_check_frequency: String,
    #[serde(default)]
    pub last_update_check: Option<String>,
    pub audio_enabled: bool,
    pub daily_simulation_count: u32,
    #[serde(default)]
    pub last_simulation_date: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            language: "zh".to_string(),
            drama_level: 1,
            black_swan_enabled: false,
            safety_valve_enabled: true,
            active_model_id: "qwen3.5:4b".to_string(),
            active_provider: "ollama".to_string(),
            update_check_frequency: "weekly".to_string(),
            last_update_check: None,
            audio_enabled: false,
            daily_simulation_count: 0,
            last_simulation_date: None,
        }
    }
}

/// 部分更新（前端 update_settings 入参）
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppSettingsPatch {
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub drama_level: Option<u8>,
    #[serde(default)]
    pub black_swan_enabled: Option<bool>,
    #[serde(default)]
    pub safety_valve_enabled: Option<bool>,
    #[serde(default)]
    pub active_model_id: Option<String>,
    #[serde(default)]
    pub active_provider: Option<String>,
    #[serde(default)]
    pub update_check_frequency: Option<String>,
    #[serde(default)]
    pub audio_enabled: Option<bool>,
}
