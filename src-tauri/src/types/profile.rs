//! 用户画像类型
//!
//! 对应 ARCH 5.2 `user_profiles` 表及 PRD 2.1 画像维度。

use serde::{Deserialize, Serialize};

/// 社交倾向（三档，收敛自 PRD 的五档以便枚举校验）
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SocialTendency {
    Introvert,
    Neutral,
    Extrovert,
}

impl SocialTendency {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Introvert => "introvert",
            Self::Neutral => "neutral",
            Self::Extrovert => "extrovert",
        }
    }

    pub fn from_str_lossy(s: &str) -> Self {
        match s {
            "introvert" => Self::Introvert,
            "extrovert" => Self::Extrovert,
            _ => Self::Neutral,
        }
    }
}

/// 经济状况
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FinancialStatus {
    Broke,   // 月光
    Saving,  // 略有积蓄
    Stable,  // 有存款 / 经济独立
    Debt,    // 背负贷款
}

impl FinancialStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Broke => "broke",
            Self::Saving => "saving",
            Self::Stable => "stable",
            Self::Debt => "debt",
        }
    }

    pub fn from_str_lossy(s: &str) -> Self {
        match s {
            "broke" => Self::Broke,
            "saving" => Self::Saving,
            "debt" => Self::Debt,
            _ => Self::Stable,
        }
    }
}

/// 用户画像（完整结构 — 从 DB 读回时使用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,

    // 必填项
    pub occupation: String,
    pub habits: Vec<String>,
    pub social_tendency: SocialTendency,
    pub financial_status: FinancialStatus,
    pub personality_tags: Vec<String>,
    pub relationship_status: String,

    // 选填项
    #[serde(default)]
    pub health_status: Option<String>,
    #[serde(default)]
    pub family_background: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub core_fears: Vec<String>,
    #[serde(default)]
    pub dreams: Vec<String>,

    // 隐性画像（LLM 推断，用户不可见）
    #[serde(default)]
    pub hidden_tags: Vec<String>,

    // 语言偏好
    pub language: String,

    // 画像版本（进化机制使用）
    pub profile_version: i32,
}

/// 画像草稿（前端 Onboarding 提交时使用 — 无 id/时间戳/version）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfileDraft {
    pub occupation: String,
    pub habits: Vec<String>,
    pub social_tendency: SocialTendency,
    pub financial_status: FinancialStatus,
    pub personality_tags: Vec<String>,
    pub relationship_status: String,

    #[serde(default)]
    pub health_status: Option<String>,
    #[serde(default)]
    pub family_background: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub core_fears: Vec<String>,
    #[serde(default)]
    pub dreams: Vec<String>,

    #[serde(default = "default_language")]
    pub language: String,
}

fn default_language() -> String {
    "zh".to_string()
}
