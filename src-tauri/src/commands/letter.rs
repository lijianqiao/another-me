//! 未来来信生成命令
//!
//! 对应 ARCH 8.2 Prompt 模板。
//! 基于推演结果 + 情绪维度生成个性化信件。

use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::ai::gateway::AIGateway;
use crate::engines::safety_valve;
use crate::types::emotion::EmotionDimensions;
use crate::types::error::AppError;
use crate::types::profile::UserProfile;

/// 来信生成的最大等待时间（秒）
const LETTER_TIMEOUT_SECS: u64 = 90;

/// 来信结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LetterResult {
    pub content: String,
    pub tone_type: String,
    pub shine_points: Vec<String>,
}

/// 生成未来来信
pub async fn generate_letter(
    gateway: &Arc<RwLock<AIGateway>>,
    profile: &UserProfile,
    decision_text: &str,
    time_horizon: &str,
    timelines_summary: &str,
    emotion: &EmotionDimensions,
) -> Result<LetterResult, AppError> {
    let tone = determine_tone(emotion);
    let shine_points = safety_valve::generate_shine_points(profile);
    let shine_text = shine_points
        .iter()
        .map(|s| format!("- {s}"))
        .collect::<Vec<_>>()
        .join("\n");

    let years_later = parse_years(time_horizon);
    let language = if profile.language == "en" {
        "English"
    } else {
        "中文"
    };

    let profile_summary = crate::ai::gateway::build_profile_summary(profile);

    let system_prompt = build_letter_system_prompt(
        &profile_summary,
        decision_text,
        timelines_summary,
        emotion,
        &tone,
        years_later,
        language,
        &shine_text,
    );

    let user_prompt = format!(
        "请以{years_later}年后的我的身份写一封信给现在的我。\n\
         信件语气：{tone}\n\
         字数：300-500字\n\
         语言：{language}\n\
         请直接输出纯文本信件内容，不要输出 JSON。"
    );

    info!(tone = %tone, years = years_later, "开始生成未来来信");

    let raw =
        match tokio::time::timeout(std::time::Duration::from_secs(LETTER_TIMEOUT_SECS), async {
            let gw = gateway.read().await;
            gw.call(&system_prompt, &user_prompt, 0.7, false).await
        })
        .await
        {
            Ok(Ok(r)) => r,
            Ok(Err(e)) => {
                warn!(error = %e, "来信 LLM 调用失败");
                return Err(e);
            }
            Err(_) => {
                warn!(timeout_secs = LETTER_TIMEOUT_SECS, "来信生成超时");
                return Err(AppError::AiGateway(format!(
                    "来信生成超时（{LETTER_TIMEOUT_SECS}s）"
                )));
            }
        };
    info!(len = raw.len(), "来信生成完成");

    // 清理可能的 JSON 包装
    let content = clean_letter_content(&raw);

    // 强制追加闪光点
    let full_content = format!(
        "{content}\n\n---\n📌 来自未来的提醒：\n\n\
         虽然我在推演这些可能性，但别忘了——\n\
         {shine_text}\n\n\
         「你现在的每一天，都是未来那个自己回不去的曾经。」\n\n\
         —— {years_later}年后的你"
    );

    Ok(LetterResult {
        content: full_content,
        tone_type: tone,
        shine_points,
    })
}

/// 根据情绪维度决定信件语气
fn determine_tone(e: &EmotionDimensions) -> String {
    if e.energy < 40.0 && e.satisfaction < 40.0 {
        "疲惫感慨型".to_string()
    } else if e.loneliness > 70.0 && e.hope < 30.0 {
        "沉默疏离型".to_string()
    } else if e.energy > 70.0 && e.satisfaction > 70.0 {
        "温暖鼓励型".to_string()
    } else if e.hope > 60.0 && e.regret < 30.0 {
        "平静叙述型".to_string()
    } else {
        "黑色幽默型".to_string()
    }
}

fn build_letter_system_prompt(
    profile_summary: &str,
    decision_text: &str,
    timelines_summary: &str,
    emotion: &EmotionDimensions,
    tone: &str,
    years_later: i32,
    language: &str,
    shine_text: &str,
) -> String {
    format!(
        r#"你是一个人生模拟引擎。现在你需要以「{years_later}年后的用户」的身份，给现在的用户写一封信。

【用户画像】
{profile_summary}

【当前决定】
{decision_text}

【时间线推演结果摘要】
{timelines_summary}

【情绪维度】
- 活力值：{energy:.0}
- 满足感：{satisfaction:.0}
- 遗憾度：{regret:.0}
- 希望值：{hope:.0}
- 孤独感：{loneliness:.0}

【信件语气规则】
本次信件的语气类型是「{tone}」。

【信件结构 - 必须包含以下五个部分】
第一段（建立身份）：描述写信时的场景和心境
第二段（回应纠结）：直接回应用户现在的纠结点
第三段（A选择）：如果选了 A，会怎样
第四段（B选择）：如果选了 B，会怎样
第五段（建议）：给现在的你一个建议，不要说教

【字数】300-500字
【语言】{language}

【正向引导原则】
- 避免「选错了毁一生」的叙事框架
- 强调「每条路都有风景」
- 给予用户自主权："最终，你才是自己人生的作者"

【末尾闪光点】
{shine_text}"#,
        energy = emotion.energy,
        satisfaction = emotion.satisfaction,
        regret = emotion.regret,
        hope = emotion.hope,
        loneliness = emotion.loneliness,
    )
}

/// 清理 LLM 可能返回的 JSON 包装
fn clean_letter_content(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with('{') {
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if let Some(content) = val.get("content").and_then(|v| v.as_str()) {
                return content.to_string();
            }
            if let Some(letter) = val.get("letter").and_then(|v| v.as_str()) {
                return letter.to_string();
            }
        }
    }
    trimmed.to_string()
}

fn parse_years(time_horizon: &str) -> i32 {
    match time_horizon {
        "1y" => 1,
        "3y" => 3,
        "5y" => 5,
        "10y" => 10,
        _ => 10,
    }
}
