# 「另一个我」— 架构设计与技术规格书

> **版本：** v1.4
> **日期：** 2026-04-09
> **状态：** 评审中（v1.2 修复评审问题中）
> **基于 PRD：** v1.4
> **变更记录（v1.1）：**
>
> - 修正1：IPC 架构明确为「持久化 Python Worker」，非按需 spawn；增加心跳机制
> - 修正2：聚类算法从 LLM 二次调用改为 Python TF-IDF + 余弦相似度（省去网络延迟）
> - 修正3：LLM 超时从 120s 延长至 180s；simulate 命令增加 `progress_callback`；前端展示步进进度
> - 修正4：新增 Cloud API 记忆注入机制（UserContextBlock），解决云端 LLM 无持久记忆问题
> - 修正5：安装引导流程改为「选择推理Provider」，支持纯云端用户直接跳过 Ollama 安装
>
>
>
> **变更记录（v1.2 — 评审修复）：**
>
> - R1：修复 `simulate()` 方法结构错误（`join_all` + `into_iter` 链式调用断裂，`progress_callback` 位置修正）
> - R2：为 `ButterflyEngine` 添加缺失的 `python_bridge` 字段及其构造函数参数
> - R3：修复 `UserContextBlock::serialize()` 不存在的问题，改为 `serde_json::to_string()`
> - R4：补充 `futures::future::join_all`、`AtomicUsize`、`Ordering`、`PythonBridge` 等缺失 import
> - R5：在 `AIGateway` 和 `PythonBridge` 模块中补充缺失的 error 枚举定义（`AIError`、`BridgeError`）
> - D1：5 个云端 API `todo!()` 存根改为返回 `Err(AIError::NotImplemented(...))`
> - D2：修正 TF-IDF 贪心选取注释，消除"最相似/最不相似"表述歧义
> - D3：简化 `PythonWorkerManager::get_bridge` 返回类型为 `Arc<PythonBridge>`，内部实现两阶段加锁 + 优雅关闭
> - D4：在 `ButterflyEngine` 上添加依赖方向说明注释，标注潜在的架构异味及未来重构方向
> - D5：修复 `progress_callback` 并发乱序问题，使用 `max_notified` + `MILESTONES` 常量实现单调递增里程碑通知
>
>
>
> **变更记录（v1.3）：**
>
> - R1：`join_all` + `into_iter` 链式调用被 `progress_callback` 截断，拆分为三行独立语句
> - R2：添加 `python_bridge: Arc<PythonBridge>` 字段及构造函数参数
> - R3：`user_context.serialize()` 不存在，改为 `serde_json::to_string(user_context)`
> - R4：补充 `join_all`、`AtomicUsize`、`Ordering`、`PythonBridge`、`Serialize` 等 6 个 import
> - R5：在对应模块中添加完整的 `#[derive(thiserror::Error)]` 枚举定义
> - D1：5 个云端 API 用 `todo!()` 会 panic，改为 `Err(AIError::NotImplemented(...))`
> - D2：修正"最相似/最不相似"表述，明确为"与已选整体相似度最低（最不同质）"
> - D3：简化为 `Result<Arc<PythonBridge>>`，内部实现两阶段加锁 + 优雅关闭
> - D4：添加依赖方向说明注释，标注未来可重构为依赖注入
> - D5：新增 `max_notified` 里程碑追踪 + `MILESTONES` 常量，保证单调递增通知
>
>
>
> **变更记录（v1.4）：**
>
> - 模型统一为 qwen3.5:4b
> - 推演次数 10→5，输出时间线 5→3，MILESTONES/进度条同步更新
> - 情绪维度去重：移除 EmotionAnalyzer，LLM 为唯一权威源
> - 修复 Ollama 上下文注入：所有 Provider 统一注入 UserContextBlock
> - 修复 TF-IDF 聚类多样性算法（Farthest-First Traversal）
> - progress_callback 改为 Tauri AppHandle.emit() 事件
> - download_model 阻塞调用改为 spawn_blocking
> - 新增 12.4 Python Worker 打包分发方案（PyInstaller + Tauri Sidecar）
> - Ollama API 从 /api/generate 迁移到 /api/chat（支持 system/user 分离 + JSON mode）

---

## 目录

1. [系统架构概览](#1-系统架构概览)
2. [Rust 后端模块设计](#2-rust-后端模块设计)
3. [Python 模块设计](#3-python-模块设计)
4. [React 前端架构](#4-react-前端架构)
5. [数据库 Schema](#5-数据库-schema)
6. [Tauri Commands API](#6-tauri-commands-api)
7. [Rust↔Python IPC 协议](#7-rustpython-ipc-协议)
8. [LLM Prompt 模板库](#8-llm-prompt-模板库)
9. [状态管理设计](#9-状态管理设计)
10. [安全与错误处理](#10-安全与错误处理)
11. [测试策略](#11-测试策略)
12. [部署与发布](#12-部署与发布)

---

## 1. 系统架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        macOS / Windows                           │
│                     Tauri Application                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    React + TypeScript                      │  │
│  │                   (WebView / WebEngine)                    │  │
│  │                                                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │  │
│  │  │ Onboard  │ │ Simulate │ │ History  │ │ Settings │       │  │
│  │  │   Flow   │ │   Page   │ │   Page   │ │   Page   │       │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │  │
│  │       └────────────┴────────────┴─────────────┘            │  │
│  │                          │ Zustand Store                    │  │
│  └──────────────────────────┼──────────────────────────────────┘  │
│                              │ Tauri IPC (invoke/emit)            │
│  ┌──────────────────────────┼──────────────────────────────────┐  │
│  │                   Rust Backend (tokio runtime)              │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │               Tauri Command Layer                     │   │  │
│  │  │  profile_* | simulate_* | letter_* | tree_* | etc.   │   │  │
│  │  └────────────────────────┬─────────────────────────────┘   │  │
│  │                           │                                    │  │
│  │  ┌─────────────┐  ┌──────┴───────┐  ┌─────────────────┐     │  │
│  │  │ SQLite ORM   │  │  AI Gateway   │  │ Model Manager   │     │  │
│  │  │ (rusqlite)   │  │ (reqwest)     │  │ (ollama-cli)   │     │  │
│  │  └─────────────┘  └───────────────┘  └─────────────────┘     │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │           Butterfly Effect Engine (BEE)               │   │  │
│  │  │  MonteCarlo(5 runs) → Clustering → 3 Timelines      │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │  │
│  │  │ Causal Chain │  │ Safety Valve │  │ Self-Evolution  │     │  │
│  │  │   Engine     │  │   Module     │  │     Engine      │     │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘     │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │        Rust ↔ Python Bridge (PyO3 / Subprocess)      │   │  │
│  │  └────────────────────────┬───────────────────────────────┘   │  │
│  └────────────────────────────┼────────────────────────────────┘  │
│                               │                                     │
│  ┌────────────────────────────┼────────────────────────────────┐ │
│  │  Python Worker (Persistent — Started Once at App Launch)     │ │
│  │                                                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐       │ │
│  │  │  NLP Engine  │  │ Realism     │  │  Audio Engine   │       │ │
│  │  │  (jieba/     │  │  Factor     │  │  (GPT-SoVITS/   │       │ │
│  │  │  snownlp)    │  │  (Python)   │  │   librosa)       │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘       │ │
│  │  ┌──────────────────────────────────────────────────────┐     │ │
│  │  │  TF-IDF Clustering  │  Heartbeat Protocol           │     │ │
│  │  │  (No LLM re-call, zero network latency)             │     │ │
│  │  └──────────────────────────────────────────────────────┘     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                               │                                     │
│                               ▼                                     │
│              ┌────────────────────────────────┐                     │
│              │  Ollama (localhost:11434)      │                     │
│              │  + Qwen3.5:4B (default)        │                     │
│              │  + Multiple Model Support      │                     │
│              └────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 数据流总图

```
User Input: "今天我没去参加聚会"
       │
       ▼
┌─────────────────┐
│  React Frontend │
│  (Zustand)      │
└────────┬────────┘
         │ tauri::invoke("simulate_decision", {...})
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Rust Backend                          │
│                                                          │
│  1. Profile Retrieval     → SQLite: profiles.db        │
│  2. Causal Chain Build     → SQLite: decisions.db       │
│  3. Anchor Check           → DecisionRecord.is_anchored │
│  4. Perturbation Gen       → rand + drama_level → temp  │
│                                                          │
│         ┌─────────────────────────────────────────┐      │
│         │         Butterfly Effect Engine          │      │
│         │                                          │      │
│         │  for i in 0..5:                         │      │
│         │    prompt = build_prompt(i, anchor_ctx)   │      │
│         │    result = ai_gateway.call(prompt, temp) │      │
│         │    parsed = serde_json::parse(result)     │      │
│         │    perturbation.apply(parsed, factors)   │      │
│         │    candidates.push(parsed)                │      │
│         │                                          │      │
│         │  timelines = cluster(candidates, k=5)     │      │
│         └──────────────────┬────────────────────────┘      │
│                             │                               │
│         ┌──────────────────▼────────────────────────┐       │
│         │         Realism Factor Check (Python)     │       │
│         │  Persistent Python Worker via stdin/stdout JSON   │       │
│         │  if TOO_NEGATIVE → regenerate w/ turn    │       │
│         │  if TOO_POSITIVE → regenerate w/ fall    │       │
│         └──────────────────┬────────────────────────┘       │
│                             │                               │
│         ┌──────────────────▼────────────────────────┐       │
│         │          Emotional Recovery Test           │       │
│         │  if 3_dims < 20:                           │       │
│         │    inject_turning_point()                  │       │
│         │    show_mental_health_tip()                │       │
│         └──────────────────┬────────────────────────┘       │
│                             │                               │
│  5. Future Letter Gen       → ai_gateway.call(letter_prompt)  │
│  6. Decision Tree Build     → d3_data_structure             │
│  7. Life Chart Data         → recharts_data_structure       │
│  8. Store Results           → SQLite: decisions.db          │
│  9. Emit Event              → frontend: "simulate_complete" │
│                                                          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  React Frontend │
│  → Render 5 TLs  │
│  → Render Tree   │
│  → Render Chart  │
│  → Render Letter │
└─────────────────┘
```

### 1.3 模块职责矩阵

| 模块 | 语言 | 职责 | 关键依赖 | 线程安全 |
|------|------|------|---------|---------|
| Tauri Command Layer | Rust | 暴露所有 IPC 命令 | tokio | ✅ |
| AI Gateway | Rust | Ollama / 云端 API 统一调用 | reqwest | ✅ |
| Butterfly Effect Engine | Rust | 蒙特卡洛模拟 + TF-IDF 聚类（Python Worker） | rand, tokio | ✅ |
| Causal Chain Engine | Rust | 历史检索 + 上下文构建 | rusqlite | ✅ |
| Safety Valve | Rust | 正向引导 + 预警调度 | — | ✅ |
| Self-Evolution Engine | Rust | 画像修正 + 反馈处理 | rusqlite | ✅ |
| Model Manager | Rust | 本地/云端模型状态 | ollama-cli, reqwest | ✅ |
| NLP Engine | Python | 现实主义因子（正负比例校验） | snownlp | N/A |
| TF-IDF Clustering | Python | 文本聚类（替代 LLM 二次调用） | scikit-learn | N/A |
| Audio Engine | Python | GPT-SoVITS + librosa | gpt-sovits, librosa | N/A |
| React Frontend | TypeScript | UI + 状态 | React, Zustand, D3, Recharts | N/A |

### 1.4 技术选型版本锁定

```toml
# Tauri 版本 (Cargo.toml) — 2026-04 latest
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tokio = { version = "1", features = ["full"] }
rusqlite = { version = "0.33", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rand = "0.9"
reqwest = { version = "0.12", features = ["json"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
thiserror = "2"
anyhow = "1"
futures = "0.3"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }

# Python (pyproject.toml, Python 3.14)
# jieba             # TF-IDF 中文分词
# snownlp           # 现实主义因子（正负比例校验）
# librosa           # 音频处理
# soundfile         # 音频 IO
# httpx             # 异步 HTTP
# scikit-learn      # TF-IDF 聚类（替代 LLM 聚类）
# numpy             # scikit-learn 依赖
# pyinstaller       # Python Worker 打包（构建时使用）

# Frontend (package.json) — 2026-04 latest
react = "^19.1.0"
react-dom = "^19.1.0"
typescript = "~5.8.3"
vite = "^7.0.4"
zustand = "^5.0.2"
"@tauri-apps/api" = "^2"
"@tauri-apps/plugin-opener" = "^2"
recharts = "^2.15.0"
d3 = "^7.9.0"
i18next = "^24.2.2"
react-i18next = "^15.4.1"
i18next-browser-languagedetector = "^8"
react-router-dom = "^7.1.1"
```

---

## 2. Rust 后端模块设计

### 2.1 项目结构

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── src/
│   ├── main.rs                    # 入口点
│   ├── lib.rs                     # 库入口
│   │
│   ├── commands/                  # Tauri Commands
│   │   ├── mod.rs
│   │   ├── profile.rs             # 画像相关命令
│   │   ├── simulate.rs            # 推演相关命令
│   │   ├── letter.rs              # 未来信件命令
│   │   ├── tree.rs                # 决策树命令
│   │   ├── history.rs             # 历史记录命令
│   │   ├── settings.rs            # 设置命令
│   │   ├── model_manager.rs       # 模型管理命令
│   │   └── audio.rs               # 音频命令
│   │
│   ├── engines/                   # 核心引擎
│   │   ├── mod.rs
│   │   ├── butterfly.rs           # 蝴蝶效应引擎
│   │   ├── causal_chain.rs        # 因果链引擎
│   │   ├── safety_valve.rs        # 安全阀
│   │   ├── self_evolution.rs      # 自我进化引擎
│   │   └── perturbation.rs        # 扰动因子
│   │
│   ├── ai/                        # AI 网关
│   │   ├── mod.rs
│   │   ├── ollama.rs              # Ollama 本地调用
│   │   ├── openai.rs              # OpenAI API
│   │   ├── anthropic.rs           # Anthropic API
│   │   ├── qwen.rs                # Qwen/DashScope API
│   │   ├── deepseek.rs            # DeepSeek API
│   │   ├── gemini.rs              # Google Gemini API
│   │   └── gateway.rs             # 统一网关
│   │
│   ├── storage/                   # 数据持久化
│   │   ├── mod.rs
│   │   ├── sqlite.rs              # SQLite ORM 封装
│   │   ├── profile_store.rs       # 画像存储
│   │   ├── decision_store.rs      # 决策记录存储
│   │   ├── feedback_store.rs      # 反馈存储
│   │   └── settings_store.rs      # 设置存储
│   │
│   ├── python/                    # Rust↔Python 桥接
│   │   ├── mod.rs
│   │   ├── persistent_worker.rs    # 持久化 Worker 管理（启动/心跳/重启）
│   │   ├── subprocess_bridge.rs   # Subprocess 方式（stdin/stdout JSON）
│   │   └── protocol.rs            # IPC 协议定义
│   │
│   ├── model_manager/             # 模型管理器
│   │   ├── mod.rs
│   │   ├── local_models.rs        # 本地模型管理
│   │   ├── cloud_providers.rs     # 云端 API 管理
│   │   └── credential.rs          # 凭据管理
│   │
│   ├── types/                     # 共享类型
│   │   ├── mod.rs
│   │   ├── profile.rs
│   │   ├── decision.rs
│   │   ├── timeline.rs
│   │   ├── emotion.rs
│   │   └── anchor.rs
│   │
│   └── utils/                     # 工具函数
│       ├── mod.rs
│       ├── drama_level.rs         # 戏剧化程度映射
│       ├── black_swan.rs          # 黑天鹅因子
│       └── tracing.rs             # 日志配置
```

### 2.2 Butterfly Effect Engine（蝴蝶效应引擎）

**文件：** `src/engines/butterfly.rs`

```rust
use futures::future::join_all;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ai::gateway::AIGateway;
use crate::engines::perturbation::PerturbationFactors;
use crate::python::subprocess_bridge::PythonBridge;

/// 蝴蝶效应引擎配置
#[derive(Debug, Clone)]
pub struct ButterflyEngineConfig {
    /// 单次推演次数（默认 5）
    pub run_count: usize,
    /// 最终归纳的时间线数量（默认 3）
    pub timeline_count: usize,
    /// 黑天鹅开关
    pub black_swan_enabled: bool,
    /// 黑天鹅触发概率（默认 0.03）
    pub black_swan_probability: f32,
}

impl Default for ButterflyEngineConfig {
    fn default() -> Self {
        Self {
            run_count: 5,
            timeline_count: 3,
            black_swan_enabled: false,
            black_swan_probability: 0.03,
        }
    }
}

/// 单次推演候选结果
#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationCandidate {
    pub narrative: String,
    pub key_events: Vec<KeyEvent>,
    pub emotion_dimensions: EmotionDimensions,
    pub dimension_scores: Vec<DimensionScore>,
    pub realism_score: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub black_swan_event: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyEvent {
    pub year: String,
    pub event: String,
    pub emotion: String, // "positive" | "neutral" | "negative"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmotionDimensions {
    pub energy: f32,
    pub satisfaction: f32,
    pub regret: f32,
    pub hope: f32,
    pub loneliness: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DimensionScore {
    pub year: i32,
    pub career: f32,
    pub financial: f32,
    pub health: f32,
    pub relationship: f32,
    pub satisfaction: f32,
}

/// 蝴蝶效应引擎
///
/// **依赖方向说明：** ButterflyEngine 持有 `Arc<PythonBridge>`，
/// 打破了"业务层 → IPC层"的单向依赖（IPC 层依赖业务层）。更好的设计是
/// 将聚类逻辑作为 `Fn` 闭包从 AppState 注入，使 ButterflyEngine 不直接
/// 感知 PythonBridge 的存在。当前方案在 Rust 类型系统内更简单，
/// 如未来聚类逻辑变复杂，可重构为依赖注入。
pub struct ButterflyEngine {
    config: ButterflyEngineConfig,
    ai_gateway: Arc<RwLock<AIGateway>>,
    /// Python Worker 桥接（用于 TF-IDF 聚类）
    python_bridge: Arc<PythonBridge>,
}

impl ButterflyEngine {
    pub fn new(
        config: ButterflyEngineConfig,
        ai_gateway: Arc<RwLock<AIGateway>>,
        python_bridge: Arc<PythonBridge>,
    ) -> Self {
        Self { config, ai_gateway, python_bridge }
    }

    /// 执行蝴蝶效应模拟
    ///
    /// 流程：
    /// 1. 构建 5 次独立推演的 Prompt（每次使用不同扰动因子）
    /// 2. 并发调用 AI Gateway（tokio::spawn + join_all）
    /// 3. 通过 progress_callback 实时通知前端进度
    /// 4. 收集结果后交给 Python Worker 做 TF-IDF 聚类
    /// 5. 每类取一个代表性结果作为最终时间线
    ///
    /// **进度通知：** 每个 `progress_callback(current, total, message)` 调用对应前端展示：
    ///   - "正在推演第 1/5 种可能..."
    ///   - "正在推演第 3/5 种可能..."
    ///   - "正在归纳时间线..."
    ///   - "生成未来信件..."
    ///   - "推演完成！"
    pub async fn simulate(
        &self,
        user_profile: &UserProfile,
        decision: &str,
        time_horizon: &str,
        drama_level: u8,
        causal_context: Option<&CausalContext>,
        anchor_timeline: Option<&AnchorTimeline>,
        app_handle: tauri::AppHandle,
    ) -> Result<Vec<SimulationCandidate>, ButterflyError> {
        // Step 1: 生成扰动因子
        let _ = app_handle.emit("simulation_progress", serde_json::json!({
            "current": 0, "total": self.config.run_count, "message": "正在准备推演..."
        }));
        let perturbations: Vec<PerturbationFactors> = (0..self.config.run_count)
            .map(|i| PerturbationFactors::generate(i, &self.config))
            .collect();

        // Step 2: 构建 Prompt 列表
        let prompts: Vec<String> = perturbations
            .iter()
            .map(|p| {
                build_simulation_prompt(
                    user_profile,
                    decision,
                    time_horizon,
                    drama_level,
                    causal_context,
                    anchor_timeline,
                    p,
                )
            })
            .collect();

        // Step 3: 计算每个 Prompt 的 temperature
        let temperatures: Vec<f32> = (0..self.config.run_count)
            .map(|_| drama_to_temperature(drama_level))
            .collect();

        // Step 4: 并发执行所有推演（带进度通知）
        // 使用 AtomicUsize 跟踪已完成数；使用 max_notified 确保进度单调递增
        let completed = Arc::new(AtomicUsize::new(0));
        let max_notified = Arc::new(AtomicUsize::new(0));
        let total = self.config.run_count;

        // 里程碑定义：仅在这些完成数时通知前端
        const MILESTONES: &[usize] = &[1, 3, 5];

        let handles: Vec<_> = prompts
            .into_iter()
            .zip(temperatures.into_iter())
            .enumerate()
            .map(|(i, (prompt, temp))| {
                let gateway = Arc::clone(&self.ai_gateway);
                let completed = Arc::clone(&completed);
                let max_notified = Arc::clone(&max_notified);
                let handle = app_handle.clone();
                tokio::spawn(async move {
                    let result = gateway.read().await.call(&prompt, temp).await;
                    let done = completed.fetch_add(1, Ordering::Relaxed) + 1;

                    let current_max = max_notified.load(Ordering::Relaxed);
                    if done > current_max && MILESTONES.contains(&done) {
                        max_notified.store(done, Ordering::Relaxed);
                        let _ = handle.emit("simulation_progress", serde_json::json!({
                            "current": done, "total": total,
                            "message": format!("正在推演第 {}/{} 种可能...", done, total)
                        }));
                    }
                    result
                })
            })
            .collect();

        let raw_results = futures::future::join_all(handles).await;

        // Step 4.5: 通知前端所有 LLM 调用完成，进入聚类阶段
        let _ = app_handle.emit("simulation_progress", serde_json::json!({
            "current": total, "total": total, "message": "正在归纳时间线..."
        }));

        let results: Vec<Result<String, AIError>> = raw_results
            .into_iter()
            .filter_map(|r| r.ok())
            .collect();

        // Step 5: 解析 JSON 结果
        let candidates: Vec<SimulationCandidate> = results
            .into_iter()
            .filter_map(|r| serde_json::from_str(&r).ok())
            .collect();

        // Step 6: 黑天鹅注入
        let candidates = if self.config.black_swan_enabled {
            self.inject_black_swan(candidates)
        } else {
            candidates
        };

        // Step 7: 聚类归纳为 5 条时间线
        let timelines = self.cluster_timelines(candidates).await?;

        Ok(timelines)
    }

    /// 黑天鹅注入
    fn inject_black_swan(
        &self,
        mut candidates: Vec<SimulationCandidate>,
    ) -> Vec<SimulationCandidate> {
        let mut rng = rand::thread_rng();

        for candidate in &mut candidates {
            if rng.gen::<f32>() < self.config.black_swan_probability {
                let event = pick_random_black_swan(&mut rng);
                // 修改 narrative，在合适位置插入黑天鹅事件
                candidate.narrative = format!(
                    "{} {}",
                    candidate.narrative.trim_end_matches('。'),
                    event
                );
                candidate.black_swan_event = Some(event);
            }
        }
        candidates
    }

    /// 将 5 条候选时间线聚类归纳为 3 条
    ///
    /// **变更（v1.1）：** 改用 Python TF-IDF + 余弦相似度实现聚类，
    /// 不再调用 LLM，省去一次网络延迟（约 5-15 秒）。
    /// 聚类结果通过持久化 Python Worker 的 stdin/stdout 获得。
    async fn cluster_timelines(
        &self,
        candidates: Vec<SimulationCandidate>,
    ) -> Result<Vec<SimulationCandidate>, ButterflyError> {
        // Step 1: 将候选 narrative 提取出来，发送给 Python Worker 做 TF-IDF 聚类
        let narratives: Vec<String> = candidates
            .iter()
            .map(|c| c.narrative.clone())
            .collect();

        let payload = serde_json::json!({
            "narratives": narratives,
            "k": self.config.timeline_count,
        });

        let cluster_result = self
            .python_bridge
            .call("cluster_narratives", payload)
            .await
            .map_err(|e| ButterflyError::BridgeError(e.to_string()))?;

        // Step 2: 解析聚类索引
        let cluster_indices: Vec<usize> = serde_json::from_value(cluster_result)
            .map_err(|e| ButterflyError::ParseError(e.to_string()))?;

        // Step 3: 根据聚类索引选取代表时间线
        let mut timelines = Vec::new();
        for &idx in &cluster_indices {
            if idx < candidates.len() {
                timelines.push(candidates[idx].clone());
            }
            if timelines.len() >= self.config.timeline_count {
                break;
            }
        }

        // Fallback: 如果聚类结果不足 5 条，直接取前几个
        if timelines.len() < self.config.timeline_count {
            timelines.extend(candidates.into_iter().take(
                self.config.timeline_count - timelines.len()
            ));
        }

        Ok(timelines)
    }
}

/// 戏剧化档位 → Temperature
pub fn drama_to_temperature(drama_level: u8) -> f32 {
    let mut rng = rand::thread_rng();
    match drama_level {
        1 => 0.3 + rng.gen::<f32>() * 0.2, // 0.3~0.5
        2 => 0.5 + rng.gen::<f32>() * 0.2, // 0.5~0.7
        3 => 0.7 + rng.gen::<f32>() * 0.2, // 0.7~0.9
        4 => 0.9 + rng.gen::<f32>() * 0.3, // 0.9~1.2
        _ => 0.5,
    }
}

fn pick_random_black_swan(rng: &mut impl Rng) -> String {
    let events = [
        "（突发黑天鹅事件：买彩票意外中得大奖，人生轨迹彻底改变）",
        "（突发黑天鹅事件：重病一场，经历生死考验后彻底改变人生优先级）",
        "（突发黑天鹅事件：偶然遇到贵人，意外获得重大职业机会）",
        "（突发黑天鹅事件：家人突发意外，被迫离开原有城市和职业轨道）",
        "（突发黑天鹅事件：金融危机中储蓄大幅缩水，被迫重新规划财务）",
        "（突发黑天鹅事件：旅行中遇到灵魂伴侣，彻底改变人生方向）",
        "（突发黑天鹅事件：偶然看到一本书，人生观被彻底颠覆）",
    ];
    let idx = rng.gen_range(0..events.len());
    events[idx].to_string()
}
```

### 2.3 Causal Chain Engine（因果链引擎）

**文件：** `src/engines/causal_chain.rs`

```rust
/// 因果链上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CausalContext {
    /// 历史决策摘要列表（最多 5 个）
    pub past_decisions: Vec<PastDecisionSummary>,
    /// 推断出的性格演变
    pub personality_evolution: PersonalityEvolution,
    /// 当前人生状态
    pub current_state: CurrentLifeState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PastDecisionSummary {
    pub decision_id: String,
    pub decision_text: String,
    pub simulated_date: String,
    pub key_outcome: String,
    pub personality_impact: Vec<String>,
    pub timeline_type: String, // "reality" | "parallel"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalityEvolution {
    pub before: Vec<String>,
    pub after: Vec<String>,
    pub change_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentLifeState {
    pub career_stage: String,
    pub relationship_status: String,
    pub financial_health: String,
    pub health_trend: String,
}

/// 因果链引擎
pub struct CausalChainEngine;

impl CausalChainEngine {
    /// 构建因果链上下文
    ///
    /// 1. 从 SQLite 查询用户最近的 N 条决策记录
    /// 2. 如果存在锚定时间线，优先继承锚定线的上下文
    /// 3. 调用 LLM 推断性格演变和当前状态
    pub async fn build_context(
        &self,
        user_id: &str,
        anchor_timeline_id: Option<&str>,
        store: &DecisionStore,
        ai_gateway: &AIGateway,
    ) -> Result<Option<CausalContext>, CausalChainError> {
        // Step 1: 获取历史决策（最多 5 个）
        let history = store
            .get_recent_decisions(user_id, 5)
            .await
            .map_err(|e| CausalChainError::StorageError(e.to_string()))?;

        if history.is_empty() {
            return Ok(None);
        }

        // Step 2: 如果有锚定线，过滤保留锚定线相关的决策
        let relevant_history = if let Some(anchor_id) = anchor_timeline_id {
            Self::filter_anchor_related(history, anchor_id)
        } else {
            history
        };

        // Step 3: 调用 LLM 推断性格演变和当前状态
        let context = Self::infer_life_context(&relevant_history, ai_gateway).await?;

        Ok(Some(context))
    }

    /// 过滤保留与锚定线相关的历史决策
    fn filter_anchor_related(
        history: Vec<DecisionRecord>,
        anchor_id: &str,
    ) -> Vec<DecisionRecord> {
        // 找到锚定决策及其之后的所有决策
        let mut result = Vec::new();
        let mut found_anchor = false;

        for record in history.iter() {
            if record.id == anchor_id {
                found_anchor = true;
            }
            if found_anchor {
                result.push(record.clone());
            }
        }

        // 如果没找到锚定（可能被删除了），返回全部
        if result.is_empty() {
            history
        } else {
            result
        }
    }

    /// 调用 LLM 推断性格演变和当前状态
    async fn infer_life_context(
        history: &[DecisionRecord],
        ai_gateway: &AIGateway,
    ) -> Result<CausalContext, CausalChainError> {
        let prompt = build_context_inference_prompt(history);

        let response = ai_gateway
            .call(&prompt, 0.3) // 低温度确保稳定推断
            .await
            .map_err(|e| CausalChainError::AIError(e.to_string()))?;

        serde_json::from_str(&response)
            .map_err(|e| CausalChainError::ParseError(e.to_string()))
    }
}
```

### 2.4 Safety Valve Module（安全阀模块）

**文件：** `src/engines/safety_valve.rs`

```rust
/// 安全阀模块
pub struct SafetyValve {
    /// 每日推演上限
    pub daily_limit: usize,
    /// 当前日期的推演计数
    today_count: Mutex<HashMap<NaiveDate, usize>>,
}

impl SafetyValve {
    /// 检查是否可以进行新推演
    pub fn check_limit(&self, user_id: &str) -> Result<(), SafetyValveError> {
        let today = chrono::Utc::now().date_naive();
        let mut counts = self.today_count.lock().unwrap();

        let count = counts.entry(today).or_insert(0);
        if *count >= self.daily_limit {
            return Err(SafetyValveError::DailyLimitExceeded(*count));
        }
        *count += 1;
        Ok(())
    }

    /// 检查叙事是否包含黑暗内容，需要预警
    pub fn check_dark_content(narrative: &str) -> bool {
        let dark_keywords = [
            "猝死", "自杀", "重病", "离婚", "破产",
            "绝症", "家破人亡", "妻离子散",
        ];
        dark_keywords.iter().any(|kw| narrative.contains(kw))
    }

    /// 检查是否需要情绪回归测试
    pub fn needs_emotional_recovery_test(emotions: &EmotionDimensions) -> bool {
        let low_dims = [
            emotions.energy < 20.0,
            emotions.satisfaction < 20.0,
            emotions.regret > 80.0,
            emotions.hope < 20.0,
            emotions.loneliness > 80.0,
        ];
        low_dims.iter().filter(|&&x| x).count() >= 3
    }

    /// 生成当下闪光点
    pub fn generate_shine_points(
        profile: &UserProfile,
        recent_history: &[DecisionRecord],
    ) -> Vec<String> {
        let mut points = Vec::new();

        // 从画像提取
        if profile.occupation == "学生" {
            points.push("年轻拥有的可能性".to_string());
        }
        if profile.health_status.as_deref() == Some("健康") {
            points.push("健康的身体".to_string());
        }
        if profile.habits.contains(&"健身".to_string()) {
            points.push("对自我提升的坚持".to_string());
        }

        // 从历史推演提取
        for record in recent_history.iter().take(3) {
            if record.timelines.first().map(|t| t.narrative.contains("高光")).unwrap_or(false) {
                points.push(format!("你曾经推演过：{}", &record.decision_text));
            }
        }

        // 通用
        points.push("此刻正在阅读这个故事的专注力".to_string());

        points.into_iter().take(3).collect()
    }
}

/// 推演上限预警
#[derive(Debug, Clone)]
pub struct DailyLimitWarning {
    pub current_count: usize,
    pub limit: usize,
    pub message: String,
}

impl DailyLimitWarning {
    pub fn new(current: usize, limit: usize) -> Self {
        Self {
            current_count: current,
            limit,
            message: "你已经推演了3次。有时候，最好的决定是活在当下。".to_string(),
        }
    }
}
```

### 2.5 AI Gateway（统一 AI 网关）

**文件：** `src/ai/gateway.rs`

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// AI Provider 类型
#[derive(Debug, Clone, Copy)]
pub enum AIProvider {
    Ollama,
    OpenAI,
    Anthropic,
    Qwen,
    DeepSeek,
    Gemini,
}

/// AI 网关配置
#[derive(Debug, Clone)]
pub struct AIGatewayConfig {
    pub provider: AIProvider,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

/// AI 网关
pub struct AIGateway {
    client: Client,
    config: AIGatewayConfig,
}

/// AI 调用错误类型
#[derive(Debug, thiserror::Error)]
pub enum AIError {
    #[error("网络请求失败: {0}")]
    NetworkError(String),

    #[error("响应解析失败: {0}")]
    ParseError(String),

    #[error("API 未实现: {0}")]
    NotImplemented(String),

    #[error("API Key 未配置: {0}")]
    APIKeyMissing(String),

    #[error("云端 API 调用失败: {0}")]
    CloudAPIError(String),
}

impl AIGateway {
    pub fn new(config: AIGatewayConfig) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(180)) // LLM 推理超时 3 分钟（无 GPU 的 7B 模型可能需要）
            .build()
            .expect("HTTP client build failed");

        Self { client, config }
    }

    /// 统一调用接口
    pub async fn call(
        &self,
        prompt: &str,
        temperature: f32,
    ) -> Result<String, AIError> {
        match self.config.provider {
            AIProvider::Ollama => self.call_ollama(prompt, temperature).await,
            AIProvider::OpenAI => self.call_openai(prompt, temperature).await,
            AIProvider::Anthropic => self.call_anthropic(prompt, temperature).await,
            AIProvider::Qwen => self.call_qwen(prompt, temperature).await,
            AIProvider::DeepSeek => self.call_deepseek(prompt, temperature).await,
            AIProvider::Gemini => self.call_gemini(prompt, temperature).await,
        }
    }

    /// 调用 Ollama Chat API（/api/chat）
    ///
    /// **v1.4 变更：** 从 `/api/generate` 迁移到 `/api/chat`。
    /// Chat API 支持 system/user 消息分离，更易控制输出格式，
    /// 且天然支持 `format: "json"` 强制 JSON 输出。
    async fn call_ollama(&self, prompt: &str, temperature: f32) -> Result<String, AIError> {
        let url = format!("{}/api/chat", self.config.base_url);

        #[derive(Serialize)]
        struct ChatMessage<'a> {
            role: &'a str,
            content: &'a str,
        }

        #[derive(Serialize)]
        struct OllamaChatRequest<'a> {
            model: &'a str,
            messages: Vec<ChatMessage<'a>>,
            stream: bool,
            format: &'a str,
            options: OllamaOptions,
        }

        #[derive(Serialize)]
        struct OllamaOptions {
            temperature: f32,
        }

        // 分离 system prompt 和 user prompt
        // UserContextBlock + 约束指令作为 system，用户决策作为 user
        let (system_part, user_part) = split_prompt(prompt);

        let request = OllamaChatRequest {
            model: &self.config.model,
            messages: vec![
                ChatMessage { role: "system", content: &system_part },
                ChatMessage { role: "user", content: &user_part },
            ],
            stream: false,
            format: "json",  // 强制 JSON 输出，减少格式错误
            options: OllamaOptions { temperature },
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| AIError::NetworkError(e.to_string()))?;

        #[derive(Deserialize)]
        struct ChatResponseMessage {
            content: String,
        }

        #[derive(Deserialize)]
        struct OllamaChatResponse {
            message: ChatResponseMessage,
        }

        let parsed: OllamaChatResponse = response
            .json()
            .await
            .map_err(|e| AIError::ParseError(e.to_string()))?;

        Ok(parsed.message.content)
    }

/// 将完整 prompt 分离为 system 和 user 两部分
///
/// 约定：prompt 中以 `=== 用户决策 ===` 为分隔符
/// 分隔符之前的内容（含 UserContextBlock + 约束指令）→ system
/// 分隔符之后的内容（用户的具体决策文本）→ user
fn split_prompt(prompt: &str) -> (String, String) {
    const SEPARATOR: &str = "=== 用户决策 ===";
    if let Some(pos) = prompt.find(SEPARATOR) {
        let system = prompt[..pos].trim().to_string();
        let user = prompt[pos + SEPARATOR.len()..].trim().to_string();
        (system, user)
    } else {
        // Fallback：无分隔符时，全部作为 user prompt
        (String::new(), prompt.to_string())
    }
}

    async fn call_openai(&self, _prompt: &str, _temperature: f32) -> Result<String, AIError> {
        Err(AIError::NotImplemented(
            "OpenAI API 未实现，请通过设置页配置 API Key".to_string(),
        ))
    }

    async fn call_anthropic(&self, _prompt: &str, _temperature: f32) -> Result<String, AIError> {
        Err(AIError::NotImplemented(
            "Anthropic API 未实现，请通过设置页配置 API Key".to_string(),
        ))
    }

    async fn call_qwen(&self, _prompt: &str, _temperature: f32) -> Result<String, AIError> {
        Err(AIError::NotImplemented(
            "Qwen/DashScope API 未实现，请通过设置页配置 API Key".to_string(),
        ))
    }

    async fn call_deepseek(&self, _prompt: &str, _temperature: f32) -> Result<String, AIError> {
        Err(AIError::NotImplemented(
            "DeepSeek API 未实现，请通过设置页配置 API Key".to_string(),
        ))
    }

    async fn call_gemini(&self, _prompt: &str, _temperature: f32) -> Result<String, AIError> {
        Err(AIError::NotImplemented(
            "Gemini API 未实现，请通过设置页配置 API Key".to_string(),
        ))
    }
}
```

### 2.6 UserContextBlock — 云端 API 的记忆注入机制（v1.1 新增）

> **问题：** 当用户选择 OpenAI / Anthropic / Qwen / DeepSeek / Gemini 等云端 API 时，云端 LLM 本身是**无状态的**——它不知道你是谁、你的过往推演、你的性格演变。每次 API 调用都是独立的。
>
> **解决方案：** 在每次 LLM 调用前，Rust 后端从 SQLite 读取用户画像和因果链，构建一个 `UserContextBlock`，注入到 Prompt 的**system prompt 头部**。这样无论调用哪个 Provider，用户的历史上下文都不会丢失。

#### 2.6.1 UserContextBlock 结构

```rust
/// 用户上下文块 — 每次 LLM 调用前注入
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserContextBlock {
    /// 用户画像摘要
    pub profile_summary: String,

    /// 锚定时间线信息（如果有）
    pub anchor_timeline: Option<AnchorTimelineSummary>,

    /// 最近 N 条历史推演摘要（最多 5 条）
    pub recent_decisions: Vec<DecisionSummary>,

    /// 当前推演的因果链背景
    pub causal_chain_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorTimelineSummary {
    pub decision_id: String,
    pub decision_text: String,
    pub key_outcome: String,
    pub personality_changes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionSummary {
    pub decision_text: String,
    pub simulated_date: String,
    pub key_outcome: String,
}
```

#### 2.6.2 Prompt 注入策略

```rust
impl AIGateway {
    /// 构建完整 Prompt（UserContextBlock + 原始 prompt）
    ///
    /// **v1.4 修正：** 所有 Provider（包括 Ollama）都需要注入上下文。
    /// Ollama 的每次 API 调用同样是无状态的，不会跨请求保持记忆。
    fn build_contextual_prompt(
        &self,
        base_prompt: &str,
        user_context: &UserContextBlock,
    ) -> String {
        let context_block = build_user_context_block_prompt(user_context);
        let ctx_json = serde_json::to_string(user_context)
            .unwrap_or_else(|_| "{}".to_string());
        format!(
            "{}\n\n=== 用户历史上下文（请在推演时参考）===\n{}\n=== 上下文结束 ===\n\n{}",
            context_block, ctx_json, base_prompt
    )
}

fn build_user_context_block_prompt(ctx: &UserContextBlock) -> String {
    let mut parts = Vec::new();

    parts.push("【用户画像摘要】".to_string());
    parts.push(ctx.profile_summary.clone());

    if let Some(ref anchor) = ctx.anchor_timeline {
        parts.push("\n【当前锚定的时间线】".to_string());
        parts.push(format!("决定：{}", anchor.decision_text));
        parts.push(format!("结果：{}", anchor.key_outcome));
        parts.push("性格变化：".to_string());
        for change in &anchor.personality_changes {
            parts.push(format!("  - {}", change));
        }
    }

    if !ctx.recent_decisions.is_empty() {
        parts.push("\n【最近推演历史】".to_string());
        for (i, d) in ctx.recent_decisions.iter().enumerate() {
            parts.push(format!(
                "{}. {} — {} — 结果：{}",
                i + 1, d.decision_text, d.simulated_date, d.key_outcome
            ));
        }
    }

    if let Some(ref causal) = ctx.causal_chain_summary {
        parts.push("\n【因果链背景】".to_string());
        parts.push(causal.clone());
    }

    parts.join("\n")
}
```

#### 2.6.3 调用示例

```rust
// 在 Butterfly Engine 的 simulate 方法中
pub async fn simulate(...) -> Result<Vec<SimulationCandidate>, ButterflyError> {
    // 构建用户上下文
    let user_context = self.build_user_context(user_id, anchor_timeline_id).await?;

    // 为每个 prompt 注入上下文（所有 Provider 统一注入）
    let contextual_prompts: Vec<String> = prompts
        .iter()
        .map(|p| {
            self.ai_gateway.read().await
                .build_contextual_prompt(p, &user_context)
        })
        .collect();

    // ... 后续调用不变
}
```

#### 2.6.4 关键设计原则

| 原则 | 说明 |
|------|------|
| **每次调用都注入** | 所有 Provider（含 Ollama）均无跨请求记忆，上下文必须显式传入 |
| **上下文精简** | UserContextBlock 应控制在 2000 tokens 以内，只包含关键摘要 |
| **锚定线优先** | 如果存在锚定线，UserContextBlock 优先继承锚定线的上下文 |
| **Fallback** | 如果 SQLite 查询失败，降级为"无上下文调用"，不阻塞推演 |

#### 2.6.5 与 Ollama 的对比

| 维度 | Ollama（本地） | Cloud API（云端） |
|------|---------------|-----------------|
| 上下文维持方式 | 每次调用注入 UserContextBlock | 每次调用注入 UserContextBlock |
| 网络延迟 | 无（本地） | 有（但推理速度快） |
| 隐私 | 完全本地 | 上下文数据上传至云端 |
| 速度（无 GPU） | 慢（4B ~10-30 tok/s） | 快（取决于网络） |

### 2.7 Model Manager（模型管理器）

**文件：** `src/model_manager/mod.rs`

```rust
use serde::{Deserialize, Serialize};
use std::process::Command;

/// 本地模型信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModel {
    pub id: String,
    pub name: String,
    pub size_bytes: u64,
    pub parameter_count: String,
    pub vram_requirement: String,
    pub speed_tok_per_sec: Option<f32>,
    pub is_active: bool,
}

/// 云端 Provider 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudProvider {
    pub provider: String,
    pub enabled: bool,
    pub models: Vec<String>,
}

/// 模型管理器
pub struct ModelManager;

impl ModelManager {
    /// 获取已安装的本地模型列表
    pub fn list_local_models() -> Result<Vec<LocalModel>, ModelManagerError> {
        let output = Command::new("ollama")
            .args(["list"])
            .output()
            .map_err(|e| ModelManagerError::CommandError(e.to_string()))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let models = parse_ollama_list_output(&stdout);
        Ok(models)
    }

    /// 切换活跃模型
    pub fn switch_model(model_id: &str) -> Result<(), ModelManagerError> {
        // 更新设置中的活跃模型 ID
        // 通知 AI Gateway 重新初始化
        tracing::info!("Switching to model: {}", model_id);
        Ok(())
    }

    /// 检查模型更新
    pub fn check_updates(model_id: &str) -> Result<bool, ModelManagerError> {
        let output = Command::new("ollama")
            .args(["list"])
            .output()
            .map_err(|e| ModelManagerError::CommandError(e.to_string()))?;

        // 比较版本号判断是否有更新
        let has_update = false; // TODO: 实现版本比较
        Ok(has_update)
    }

    /// 下载新模型
    pub async fn download_model(
        model_id: &str,
        app_handle: tauri::AppHandle,
    ) -> Result<(), ModelManagerError> {
        let model_id = model_id.to_string();
        let handle = app_handle.clone();

        tokio::task::spawn_blocking(move || {
            let output = std::process::Command::new("ollama")
                .args(["pull", &model_id])
                .output();

            match output {
                Ok(o) if o.status.success() => {
                    tracing::info!("Download complete: {}", model_id);
                    let _ = handle.emit("model_download_complete", &model_id);
                }
                Ok(o) => {
                    let err = String::from_utf8_lossy(&o.stderr).to_string();
                    tracing::error!("Download failed: {}", err);
                    let _ = handle.emit("model_download_failed", &err);
                }
                Err(e) => {
                    tracing::error!("Download error: {}", e);
                    let _ = handle.emit("model_download_failed", &e.to_string());
                }
            }
        });

        Ok(())
    }

    /// 删除模型
    pub fn delete_model(model_id: &str) -> Result<(), ModelManagerError> {
        let output = Command::new("ollama")
            .args(["rm", model_id])
            .output()
            .map_err(|e| ModelManagerError::CommandError(e.to_string()))?;

        if !output.status.success() {
            return Err(ModelManagerError::DeleteFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }
        Ok(())
    }
}
```

---

## 3. Python 模块设计

### 3.1 项目结构

```
python/
├── another_me/                    # Python 包
│   ├── __init__.py
│   ├── nlp/
│   │   ├── __init__.py
│   │   ├── realism_factor.py      # 现实主义因子计算（正负比例校验）
│   │   └── clustering.py          # TF-IDF + 余弦相似度聚类
│   │
│   ├── audio/
│   │   ├── __init__.py
│   │   ├── voice_clone.py         # GPT-SoVITS 声音克隆
│   │   ├── audio_processor.py     # librosa 音频处理
│   │   └── on_demand_download.py  # 模型按需下载
│   │
│   ├── bridge/
│   │   ├── __init__.py
│   │   └── protocol.py            # 与 Rust 通信的协议
│   │
│   └── resources/
│       ├── mental_health_tips.py  # 心理健康小贴士（本地）
│       └── black_swan_events.py   # 黑天鹅事件库
│
├── main.py                        # 入口（Subprocess 模式）
├── requirements.txt
└── README.md
```

### 3.2 情绪维度数据源说明（v1.4 变更）

> **v1.4 变更：** `emotion_dimensions` 的唯一数据源是 LLM 推演输出的 JSON。
> Python 端不再独立计算情绪维度，避免 LLM 与 NLP 工具结果矛盾的问题。
>
> **原 `emotion_analyzer.py` 已废弃并移除。**
>
> 数据流：
>
> ```
> LLM 推演 JSON → emotion_dimensions（权威源）
>                        ↓
>              Safety Valve 直接使用 → 情绪回归测试
>              Future Letter Prompt 直接使用 → 语气决定
> ```
>
> Python 仅保留两个职责：
>
> 1. `check_realism`：检查 narrative 文本的正负比例是否平衡
> 2. `cluster_narratives`：TF-IDF 文本聚类

### 3.3 TF-IDF 聚类（v1.1 新增，替代 LLM 聚类）

**文件：** `python/another_me/nlp/clustering.py`

```python
"""
TF-IDF + 余弦相似度聚类
使用 scikit-learn 实现，无需调用 LLM，零网络延迟。
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def cluster_narratives_tfidf(narratives: list[str], k: int = 3) -> list[int]:
    """
    将 narratives 聚类为 k 个类别，返回每个类别的代表性 narrative 索引。

    策略：
    1. 使用 TF-IDF 向量化所有 narrative
    2. 计算余弦相似度矩阵
    3. 对相似度矩阵做平均池化，得到每个 narrative 与整体的相似度
    4. 选取与整体最"中心"的 narrative 作为每类代表（选取 top-k 个不相似的中心）

    Args:
        narratives: 待聚类的 narrative 列表（通常 5 条）
        k: 最终归纳的时间线数量（默认 3）

    Returns:
        代表性 narrative 的索引列表，长度为 k
    """
    if len(narratives) <= k:
        return list(range(len(narratives)))

    # Step 1: TF-IDF 向量化
    vectorizer = TfidfVectorizer(
        max_features=500,
        ngram_range=(1, 2),       # unigram + bigram
        sublinear_tf=True,         # 使用 1+log(tf) 而非 raw tf
    )
    tfidf_matrix = vectorizer.fit_transform(narratives)

    # Step 2: 余弦相似度矩阵
    similarity_matrix = cosine_similarity(tfidf_matrix)

    # Step 3: 对每条 narrative，计算它与所有其他 narrative 的平均相似度
    # 相似度越高，说明越"中心"
    avg_similarity = similarity_matrix.mean(axis=1)

    # Step 4: 选择 k 个最具代表性的索引
    # 贪心多样性选取：第一个选最中心的，之后每个选与已选整体相似度最低的（最不同质）
    n = len(narratives)
    selected = []
    remaining = set(range(n))

    for _ in range(k):
        if not remaining:
            break

        best_idx = None
        best_score = float('inf')  # 越小越好（离已选集越远）

        for idx in remaining:
            if not selected:
                # 第一个：选最中心的（平均相似度最高）
                score = -avg_similarity[idx]  # 取负，使得最中心的 score 最小
            else:
                # 之后：Farthest-First Traversal
                # 找到该候选与已选集中最近邻的相似度（最大相似度）
                # 选使该值最小的 → 离最近已选代表最远 → 最大化多样性
                sims = [similarity_matrix[idx][s] for s in selected]
                score = max(sims)  # 与最近已选代表的相似度

            if score < best_score:
                best_score = score
                best_idx = idx

        if best_idx is not None:
            selected.append(best_idx)
            remaining.remove(best_idx)

    return selected
```

### 3.4 Realism Factor（现实主义因子）

**文件：** `python/another_me/nlp/realism_factor.py`

```python
"""
现实主义因子计算
确保推演结果既不过于乐观也不过于悲观
"""

from snownlp import SnowNLP
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class RealismStatus(Enum):
    BALANCED = "BALANCED"
    TOO_POSITIVE = "TOO_POSITIVE"
    TOO_NEGATIVE = "TOO_NEGATIVE"


@dataclass
class RealismCheckResult:
    status: RealismStatus
    positivity_ratio: float
    suggestion: Optional[str]


class RealismChecker:
    """
    积极:消极 比例应维持在 4:6 到 6:4 之间
    """

    POSITIVITY_MIN = 0.4
    POSITIVITY_MAX = 0.6

    def check(self, narrative: str) -> RealismCheckResult:
        sentences = SnowNLP(narrative).sentences
        positive_count = 0
        negative_count = 0

        for sent in sentences:
            s = SnowNLP(sent)
            # 过滤掉过短的句子
            if len(sent) < 5:
                continue
            sentiment = s.sentiments
            if sentiment > 0.6:
                positive_count += 1
            elif sentiment < 0.4:
                negative_count += 1

        total = positive_count + negative_count + 0.001
        positivity_ratio = positive_count / total

        if positivity_ratio > self.POSITIVITY_MAX:
            return RealismCheckResult(
                status=RealismStatus.TOO_POSITIVE,
                positivity_ratio=round(positivity_ratio, 3),
                suggestion="TOO_POSITIVE: 需要注入挫折和低谷"
            )
        elif positivity_ratio < self.POSITIVITY_MIN:
            return RealismCheckResult(
                status=RealismStatus.TOO_NEGATIVE,
                positivity_ratio=round(positivity_ratio, 3),
                suggestion="TOO_NEGATIVE: 需要注入希望和高光时刻"
            )
        else:
            return RealismCheckResult(
                status=RealismStatus.BALANCED,
                positivity_ratio=round(positivity_ratio, 3),
                suggestion=None
            )


def check_realism(narrative: str) -> dict:
    """主入口函数（供 Rust subprocess 调用）"""
    checker = RealismChecker()
    result = checker.check(narrative)
    return {
        "status": result.status.value,
        "positivity_ratio": result.positivity_ratio,
        "suggestion": result.suggestion,
    }
```

### 3.4 Rust↔Python 通信协议

**文件：** `python/another_me/bridge/protocol.py`

```python
"""
Rust ↔ Python 进程间通信协议
使用 JSON over stdin/stdout
"""

import sys
import json
from typing import Any, Dict


def read_request() -> Dict[str, Any]:
    """从 stdin 读取请求"""
    line = sys.stdin.readline()
    return json.loads(line)


def write_response(response: Dict[str, Any]) -> None:
    """向 stdout 写入响应"""
    print(json.dumps(response), flush=True)


def main():
    """
    入口循环：
    - 读取 JSON 请求
    - 分发到对应 handler
    - 写入 JSON 响应
    """
    handlers = {
        "check_realism": check_realism_handler,
        "generate_turning_point": turning_point_handler,
        "cluster_narratives": cluster_narratives_handler,
        "ping": ping_handler,
    }

    while True:
        try:
            request = read_request()
            cmd = request.get("command")
            payload = request.get("payload", {})

            if cmd not in handlers:
                write_response({"error": f"Unknown command: {cmd}"})
                continue

            result = handlers[cmd](payload)
            write_response({"success": True, "result": result})

        except Exception as e:
            write_response({"success": False, "error": str(e)})


def check_realism_handler(payload: Dict) -> Dict:
    from another_me.nlp.realism_factor import check_realism
    narrative = payload["narrative"]
    return check_realism(narrative)


def turning_point_handler(payload: Dict) -> Dict:
    from another_me.nlp.realism_factor import generate_turning_point
    narrative = payload["narrative"]
    negative_aspect = payload.get("negative_aspect", "")
    return {"turning_point": generate_turning_point(narrative, negative_aspect)}


def cluster_narratives_handler(payload: Dict) -> Dict:
    """
    TF-IDF + 余弦相似度聚类（v1.1 新增）
    替代 LLM 二次调用，省去 5-15 秒网络延迟。

    输入: { narratives: List[str], k: int }
    输出: { cluster_indices: List[int] }  — 每个类别对应的候选 narrative 索引
    """
    from another_me.nlp.clustering import cluster_narratives_tfidf
    narratives = payload["narratives"]
    k = payload.get("k", 5)
    indices = cluster_narratives_tfidf(narratives, k)
    return {"cluster_indices": indices}


def ping_handler(_payload: Dict) -> Dict:
    """心跳检测：确认 Python Worker 存活"""
    return {"pong": True}


if __name__ == "__main__":
    main()
```

---

## 4. React 前端架构

### 4.1 项目结构

```
src/
├── main.tsx
├── App.tsx
├── i18n/
│   ├── index.ts
│   ├── zh.json
│   └── en.json
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx        # 主布局
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   │
│   ├── onboarding/
│   │   ├── WelcomeStep.tsx
│   │   ├── BasicInfoStep.tsx
│   │   ├── HabitsStep.tsx
│   │   └── PersonalityStep.tsx
│   │
│   ├── simulate/
│   │   ├── DecisionInput.tsx   # 决策录入
│   │   ├── DramaSlider.tsx     # 戏剧化滑块
│   │   ├── BlackSwanToggle.tsx # 黑天鹅开关
│   │   ├── SimulationLoading.tsx  # 带步进进度的加载页（v1.1 增强）
│   │
│   ├── results/
│   │   ├── TimelineCard.tsx   # 时间线卡片
│   │   ├── FutureLetter.tsx    # 未来信件
│   │   ├── DecisionTree.tsx   # 决策树
│   │   ├── LifeChart.tsx       # 人生走势图
│   │   └── FeedbackButtons.tsx # 反馈按钮
│   │
│   ├── history/
│   │   ├── HistoryList.tsx
│   │   └── LifeMap.tsx        # 人生地图
│   │
│   ├── settings/
│   │   ├── SettingsPage.tsx
│   │   ├── ModelManager.tsx
│   │   └── LanguageSwitch.tsx
│   │
│   └── common/
│       ├── Modal.tsx
│       ├── Toast.tsx
│       └── ShinePoints.tsx
│
├── pages/
│   ├── OnboardingPage.tsx
│   ├── SimulatePage.tsx
│   ├── ResultsPage.tsx
│   ├── HistoryPage.tsx
│   ├── LifeMapPage.tsx
│   └── SettingsPage.tsx
│
├── store/
│   ├── index.ts                # store 入口
│   ├── profileStore.ts         # 画像状态
│   ├── simulationStore.ts       # 推演状态
│   ├── settingsStore.ts         # 设置状态
│   └── uiStore.ts               # UI 状态
│
├── hooks/
│   ├── useSimulation.ts        # 推演 hook
│   ├── useProfile.ts            # 画像 hook
│   └── useSettings.ts           # 设置 hook
│
├── api/
│   ├── tauri.ts                 # Tauri invoke 封装
│   ├── profile.ts
│   ├── simulate.ts
│   └── models.ts
│
├── types/
│   └── index.ts                 # TypeScript 类型定义（对应 PRD 中的所有 interface）
│
└── utils/
    ├── emotion.ts              # 情绪维度工具
    ├── drama.ts                 # 戏剧化工具
    └── date.ts
```

### 4.2 Zustand Store 设计

```typescript
// store/simulationStore.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';  // v1.1: progress events

export interface EmotionDimensions {
  energy: number;
  satisfaction: number;
  regret: number;
  hope: number;
  loneliness: number;
}

export interface Timeline {
  id: string;
  type: 'reality' | 'parallel';
  narrative: string;
  emotion_dimensions: EmotionDimensions;
  key_events: Array<{ year: string; event: string; emotion: string }>;
  dimension_scores: Array<{
    year: number;
    career: number;
    financial: number;
    health: number;
    relationship: number;
    satisfaction: number;
  }>;
  realism_score: number;
}

export interface FutureLetter {
  content: string;
  tone_type: string;
  emotion_dimensions: EmotionDimensions;
  shine_points: string[];
  audio_url?: string;
}

export interface DecisionTree {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

export interface SimulationResult {
  decision_id: string;
  timelines: Timeline[];
  letter: FutureLetter;
  decision_tree: DecisionTree;
  life_chart: LifeChartData;
}

interface SimulationState {
  // 推演状态
  isSimulating: boolean;
  simulationResult: SimulationResult | null;
  error: string | null;

  // 进度状态（v1.1 新增）
  simulationProgress: {
    current: number;
    total: number;
    message: string;
  };

  // 草稿状态
  draftDecision: string;
  draftContext: string;
  draftDramaLevel: number;      // 1-4
  draftBlackSwan: boolean;
  draftTimeHorizon: '1y' | '3y' | '5y' | '10y';

  // 锚定时间线
  anchorTimelineId: string | null;

  // Actions
  setDraftDecision: (text: string) => void;
  setDraftContext: (text: string) => void;
  setDramaLevel: (level: number) => void;
  setBlackSwan: (enabled: boolean) => void;
  setTimeHorizon: (horizon: '1y' | '3y' | '5y' | '10y') => void;
  setAnchorTimeline: (id: string | null) => void;

  startSimulation: () => Promise<void>;
  loadSimulation: (decisionId: string) => Promise<void>;
  clearResult: () => void;
}

export const useSimulationStore = create<SimulationState>()(
  subscribeWithSelector((set, get) => ({
    isSimulating: false,
    simulationResult: null,
    error: null,
    simulationProgress: { current: 0, total: 5, message: '准备开始...' },
    draftDecision: '',
    draftContext: '',
    draftDramaLevel: 1,
    draftBlackSwan: false,
    draftTimeHorizon: '10y',
    anchorTimelineId: null,

    setDraftDecision: (text) => set({ draftDecision: text }),
    setDraftContext: (text) => set({ draftContext: text }),
    setDramaLevel: (level) => set({ draftDramaLevel: level }),
    setBlackSwan: (enabled) => set({ draftBlackSwan: enabled }),
    setTimeHorizon: (horizon) => set({ draftTimeHorizon: horizon }),
    setAnchorTimeline: (id) => set({ anchorTimelineId: id }),

    startSimulation: async () => {
      const state = get();

      if (!state.draftDecision.trim()) {
        set({ error: '请输入你的决定' });
        return;
      }

      set({ isSimulating: true, error: null, simulationProgress: { current: 0, total: 5, message: '正在连接推理引擎...' } });

      // 监听后端进度事件（v1.1 新增）
      const unlisten = await listen<{ current: number; total: number; message: string }>(
        'simulation_progress',
        (event) => {
          set({ simulationProgress: event.payload });
        }
      );

      try {
        const result = await invoke<SimulationResult>('simulate_decision', {
          decision: {
            decision_text: state.draftDecision,
            context: state.draftContext || null,
            time_horizon: state.draftTimeHorizon,
            drama_level: state.draftDramaLevel,
            black_swan_enabled: state.draftBlackSwan,
            anchor_timeline_id: state.anchorTimelineId,
          },
        });

        set({ simulationResult: result, isSimulating: false, simulationProgress: { current: 5, total: 5, message: '推演完成！' } });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : String(err),
          isSimulating: false,
        });
      } finally {
        unlisten(); // 清理事件监听
      }
    },

    loadSimulation: async (decisionId) => {
      try {
        const result = await invoke<SimulationResult>('get_decision', {
          decisionId,
        });
        set({ simulationResult: result });
      } catch (err) {
        set({ error: String(err) });
      }
    },

    clearResult: () => set({ simulationResult: null }),
  }))
);
```

### 4.3 路由设计

```typescript
// App.tsx

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useProfileStore } from './store/profileStore';
import AppShell from './components/layout/AppShell';

export default function App() {
  const { hasCompletedOnboarding } = useProfileStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* 未完成 onboarding 强制跳转 */}
        <Route
          path="/onboarding"
          element={
            hasCompletedOnboarding ? <Navigate to="/simulate" replace /> : <OnboardingPage />
          }
        />

        {/* 主应用（需要 layout） */}
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/simulate" replace />} />

          <Route path="/simulate" element={<SimulatePage />} />
          <Route path="/results/:decisionId" element={<ResultsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/lifemap" element={<LifeMapPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 4.4 SimulationLoading 组件（v1.1 新增）

**文件：** `src/components/simulate/SimulationLoading.tsx`

```typescript
import { useEffect } from 'react';
import { useSimulationStore } from '../../store/simulationStore';

const STEPS = [
  { threshold: 0, label: '正在连接推理引擎...', sublabel: '启动本地模型' },
  { threshold: 1, label: '正在推演第 1/5 种可能...', sublabel: '第一次蝴蝶振翅' },
  { threshold: 3, label: '正在推演第 3/5 种可能...', sublabel: '命运的分支开始出现' },
  { threshold: 4, label: '正在归纳时间线...', sublabel: 'TF-IDF 聚类中' },
  { threshold: 5, label: '推演完成！', sublabel: '正在生成结果...' },
];

export default function SimulationLoading() {
  const { simulationProgress } = useSimulationStore();
  const { current, total, message } = simulationProgress;

  // 计算进度百分比
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  // 找到当前步骤
  const currentStep = STEPS.filter(s => current >= s.threshold).at(-1);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {/* 进度环 */}
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* 背景环 */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          {/* 进度环 */}
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke="#6366f1" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${percent * 2.83} 283`}
            className="transition-all duration-500"
          />
        </svg>
        {/* 中心百分比 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-indigo-600">{percent}%</span>
        </div>
      </div>

      {/* 步骤文案 */}
      <div className="text-center">
        <p className="text-lg font-medium text-gray-800">{currentStep?.label ?? message}</p>
        <p className="text-sm text-gray-500 mt-1">{currentStep?.sublabel ?? ''}</p>
      </div>

      {/* 步骤指示器 */}
      <div className="flex gap-2 mt-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i < current ? 'bg-indigo-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* 实际消息 */}
      <p className="text-xs text-gray-400 mt-2">{message}</p>
    </div>
  );
}
```

**使用方式：**

```tsx
// src/pages/SimulatePage.tsx
import SimulationLoading from '../components/simulate/SimulationLoading';

export default function SimulatePage() {
  const { isSimulating } = useSimulationStore();

  if (isSimulating) {
    return <SimulationLoading />;
  }

  return <SimulateForm />;
}
```

---

## 5. 数据库 Schema

### 5.1 SQLite 数据库文件结构

```
%APPDATA%/another-me/data/
├── profiles.db        # 用户画像库
├── decisions.db       # 决策记录库
└── settings.db        # 应用设置库
```

### 5.2 profiles.db Schema

```sql
-- 用户画像表
CREATE TABLE user_profiles (
    id              TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

    -- 必填项
    occupation          TEXT NOT NULL,
    habits              TEXT NOT NULL,  -- JSON array: ["游戏", "健身"]
    social_tendency     TEXT NOT NULL,  -- 'introvert' | 'neutral' | 'extrovert'
    financial_status    TEXT NOT NULL,  -- 'broke' | 'saving' | 'stable' | 'debt'
    personality_tags    TEXT NOT NULL,  -- JSON array: ["拖延症", "行动派"]
    relationship_status TEXT NOT NULL,

    -- 选填项
    health_status       TEXT,
    family_background   TEXT,
    location            TEXT,
    core_fears          TEXT,           -- JSON array
    dreams              TEXT,           -- JSON array

    -- 隐性画像（JSON）
    hidden_tags         TEXT DEFAULT '[]',

    -- 语言偏好
    language            TEXT NOT NULL DEFAULT 'zh',

    -- 画像版本（用于进化）
    profile_version     INTEGER NOT NULL DEFAULT 1
);

-- 画像修正记录表
CREATE TABLE profile_corrections (
    id                  TEXT PRIMARY KEY,
    profile_id          TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),

    correction_type     TEXT NOT NULL, -- 'explicit' | 'implicit' | 'behavioral'
    field               TEXT NOT NULL,
    old_value           TEXT,
    new_value           TEXT NOT NULL,
    confidence          REAL NOT NULL, -- 0.0 - 1.0
    feedback_id         TEXT,          -- 关联的 feedback 记录

    FOREIGN KEY (profile_id) REFERENCES user_profiles(id)
);

-- 索引
CREATE INDEX idx_corrections_profile ON profile_corrections(profile_id);
CREATE INDEX idx_corrections_feedback ON profile_corrections(feedback_id);
```

### 5.3 decisions.db Schema

```sql
-- 决策记录表
CREATE TABLE decisions (
    id              TEXT PRIMARY KEY,
    profile_id      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),

    -- 原始输入
    decision_text   TEXT NOT NULL,
    time_horizon    TEXT NOT NULL,      -- '1y' | '3y' | '5y' | '10y'
    context         TEXT,

    -- 推演配置
    drama_level     INTEGER NOT NULL DEFAULT 1,
    black_swan_enabled INTEGER NOT NULL DEFAULT 0,

    -- 锚定时间线
    is_anchored     INTEGER NOT NULL DEFAULT 0,
    anchored_at     TEXT,

    -- 情绪快照（JSON）
    emotion_snapshot TEXT NOT NULL,

    -- 推演结果（JSON，存储完整 SimulationResult）
    result_json     TEXT NOT NULL,

    -- 因果链 JSON
    causal_chain_json TEXT,

    FOREIGN KEY (profile_id) REFERENCES user_profiles(id)
);

-- 时间线表（范式化存储）
CREATE TABLE timelines (
    id              TEXT PRIMARY KEY,
    decision_id     TEXT NOT NULL,
    type            TEXT NOT NULL,      -- 'reality' | 'parallel'

    -- 叙事内容
    narrative       TEXT NOT NULL,
    emotion_json    TEXT NOT NULL,      -- EmotionDimensions JSON
    realism_score   REAL NOT NULL,

    -- 关键事件（JSON array）
    key_events_json TEXT NOT NULL,

    -- 走势图数据（JSON array of DimensionScore）
    dimension_scores_json TEXT NOT NULL,

    black_swan_event TEXT,

    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

-- 因果链关联表
CREATE TABLE causal_chain_links (
    id                      TEXT PRIMARY KEY,
    decision_id             TEXT NOT NULL,
    previous_decision_id    TEXT NOT NULL,

    influence_description   TEXT NOT NULL,
    personality_changes_json TEXT NOT NULL,  -- JSON array

    FOREIGN KEY (decision_id) REFERENCES decisions(id),
    FOREIGN KEY (previous_decision_id) REFERENCES decisions(id)
);

-- 未来信件表
CREATE TABLE future_letters (
    id                  TEXT PRIMARY KEY,
    decision_id         TEXT NOT NULL UNIQUE,

    content             TEXT NOT NULL,
    tone_type           TEXT NOT NULL,
    emotion_json        TEXT NOT NULL,
    shine_points_json   TEXT NOT NULL,
    audio_file_path     TEXT,            -- 本地音频路径

    written_at_timeline TEXT NOT NULL,

    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

-- 用户反馈表
CREATE TABLE user_feedback (
    id                  TEXT PRIMARY KEY,
    decision_id         TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),

    feedback_type       TEXT NOT NULL,  -- 'NOT_ME' | 'VERY_ACCURATE'

    -- NOT_ME 原因
    reasons_json        TEXT,

    -- 画像修正建议（JSON array）
    corrections_json    TEXT,

    -- 处理状态
    processed           INTEGER NOT NULL DEFAULT 0,
    applied             INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

-- 人生地图表（记忆连贯性视图数据）
CREATE TABLE life_map_nodes (
    id                  TEXT PRIMARY KEY,
    profile_id          TEXT NOT NULL,
    decision_id         TEXT NOT NULL,

    node_date           TEXT NOT NULL,
    node_label          TEXT NOT NULL,
    node_type           TEXT NOT NULL,  -- 'decision' | 'anchor'
    outcome_summary     TEXT NOT NULL,
    personality_changes_json TEXT,

    FOREIGN KEY (profile_id) REFERENCES user_profiles(id),
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

-- 索引
CREATE INDEX idx_decisions_profile ON decisions(profile_id);
CREATE INDEX idx_decisions_created ON decisions(created_at DESC);
CREATE INDEX idx_timelines_decision ON timelines(decision_id);
CREATE INDEX idx_feedback_decision ON user_feedback(decision_id);
CREATE INDEX idx_lifemap_profile ON life_map_nodes(profile_id);
```

### 5.4 settings.db Schema

```sql
-- 应用设置表
CREATE TABLE settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 初始化默认值
INSERT INTO settings (key, value) VALUES
    ('language', '"zh"'),
    ('drama_level', '1'),
    ('black_swan_enabled', 'false'),
    ('safety_valve_enabled', 'true'),
    ('active_model_id', '"qwen3.5:4b"'),
    ('update_check_frequency', '"weekly"'),
    ('last_update_check', 'null'),
    ('audio_enabled', 'false'),
    ('daily_simulation_count', '0'),
    ('last_simulation_date', 'null');
```

---

## 6. Tauri Commands API

### 6.1 命令一览表

| 命令 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `get_profile` | — | `UserProfile` | 获取当前用户画像 |
| `save_profile` | `UserProfile` | `void` | 保存/更新画像 |
| `simulate_decision` | `SimulateInput` | `SimulationResult` | 执行蝴蝶效应推演 |
| `get_decision` | `{ decision_id }` | `SimulationResult` | 获取历史推演结果 |
| `list_decisions` | `{ limit, offset }` | `DecisionRecord[]` | 获取历史决策列表 |
| `set_anchor_timeline` | `{ decision_id }` | `void` | 锚定时间线 |
| `clear_anchor` | — | `void` | 取消锚定 |
| `get_anchor_timeline` | — | `DecisionRecord \| null` | 获取当前锚定线 |
| `submit_feedback` | `UserFeedback` | `void` | 提交反馈 |
| `get_life_map` | — | `LifeMapData` | 获取人生地图数据 |
| `generate_letter_audio` | `{ decision_id }` | `{ audio_path }` | 生成音频信件 |
| `get_settings` | — | `Settings` | 获取设置 |
| `update_settings` | `Partial<Settings>` | `void` | 更新设置 |
| `list_models` | — | `LocalModel[]` | 列出本地模型 |
| `switch_model` | `{ model_id }` | `void` | 切换模型 |
| `download_model` | `{ model_id }` | `void` | 下载模型（异步） |
| `delete_model` | `{ model_id }` | `void` | 删除模型 |
| `check_model_updates` | — | `UpdateInfo[]` | 检查模型更新 |
| `store_api_key` | `{ provider, key }` | `void` | 存储 API Key（到系统凭据库） |
| `delete_api_key` | `{ provider }` | `void` | 删除 API Key |
| `check_realism` | `{ narrative }` | `RealismCheckResult` | 现实主义因子检查 |

### 6.2 核心命令签名

```rust
// src/commands/simulate.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct SimulateInput {
    pub decision_text: String,
    pub context: Option<String>,
    pub time_horizon: String,    // "1y" | "3y" | "5y" | "10y"
    pub drama_level: u8,         // 1-4
    pub black_swan_enabled: bool,
    pub anchor_timeline_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SimulationResult {
    pub decision_id: String,
    pub timelines: Vec<TimelineResult>,
    pub letter: LetterResult,
    pub decision_tree: TreeResult,
    pub life_chart: ChartResult,
}

#[tauri::command]
pub async fn simulate_decision(
    input: SimulateInput,
    state: tauri::State<'_, AppState>,
) -> Result<SimulationResult, String> {
    // 完整的推演流程实现
    // ...
}
```

### 6.3 错误码规范

```rust
// 统一错误类型
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Profile not found")]
    ProfileNotFound,

    #[error("Decision not found: {0}")]
    DecisionNotFound(String),

    #[error("AI Gateway error: {0}")]
    AIGatewayError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Python bridge error: {0}")]
    BridgeError(String),

    #[error("Safety valve triggered: daily limit exceeded")]
    DailyLimitExceeded,

    #[error("Safety valve triggered: dark content warning required")]
    DarkContentWarningRequired,

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Model not found: {0}")]
    ModelNotFound(String),

    #[error("API key not configured: {0}")]
    APIKeyNotConfigured(String),
}

// 实现 serde::Serialize 以便跨进程传递
impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

---

## 7. Rust↔Python IPC 协议

### 7.1 Subprocess 模式（主选）

Rust 端通过 `tokio::process::Command` 启动 Python 进程，通过 stdin/stdout 交换 JSON 消息。

```rust
// src/python/subprocess_bridge.rs

use tokio::io::{AsyncBufReadExt, AsyncWriteExt};
use tokio::process::Command;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Python 进程桥接错误类型
#[derive(Debug, thiserror::Error)]
pub enum BridgeError {
    #[error("进程启动失败: {0}")]
    SpawnError(String),

    #[error("IO 错误: {0}")]
    IOError(String),

    #[error("响应解析失败: {0}")]
    ParseError(String),

    #[error("Python Worker 返回错误: {0}")]
    PythonError(String),

    #[error("Worker 无响应（可能已崩溃）")]
    WorkerNotResponding,
}

pub struct PythonBridge {
    child: tokio::process::Child,
    stdin: Arc<Mutex<tokio::io::BufWriter<tokio::io::ChildStdin>>>,
    stdout: Arc<Mutex<tokio::io::BufReader<tokio::io::ChildStdout>>>,
}

impl PythonBridge {
    /// 启动 Python 进程（仅在应用启动时调用一次）
    pub async fn spawn(python_path: &str) -> Result<Self, BridgeError> {
        let mut child = Command::new(python_path)
            .arg("python/another_me/bridge/protocol.py")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| BridgeError::SpawnError(e.to_string()))?;

        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();

        Ok(Self {
            child,
            stdin: Arc::new(Mutex::new(tokio::io::BufWriter::new(stdin))),
            stdout: Arc::new(Mutex::new(tokio::io::BufReader::new(stdout))),
        })
    }

    /// 发送请求并等待响应
    ///
    /// **持久化 Worker 设计（v1.1）：**
    /// - Python 进程在应用启动时 spawn 一次，之后常驻内存
    /// - jieba/snownlp 模型只加载一次，解决冷启动慢的问题（jieba 冷启动约 1-2s）
    /// - 如果 Python 进程崩溃，Rust 端会自动检测并重启（lazy restart）
    pub async fn call(
        &self,
        command: &str,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value, BridgeError> {
        let request = serde_json::json!({
            "command": command,
            "payload": payload,
        });

        // 写入请求
        {
            let mut stdin = self.stdin.lock().await;
            stdin
                .write_all(format!("{}\n", request).as_bytes())
                .await
                .map_err(|e| BridgeError::IOError(e.to_string()))?;
            stdin
                .flush()
                .await
                .map_err(|e| BridgeError::IOError(e.to_string()))?;
        }

        // 读取响应（带超时保护）
        let response = {
            let mut stdout = self.stdout.lock().await;
            let mut line = String::new();
            stdout
                .read_line(&mut line)
                .await
                .map_err(|e| BridgeError::IOError(e.to_string()))?;
            line
        };

        let response: serde_json::Value =
            serde_json::from_str(&response).map_err(|e| BridgeError::ParseError(e.to_string()))?;

        if response.get("success").and_then(|v| v.as_bool()) == Some(true) {
            Ok(response.get("result").cloned().unwrap_or(serde_json::Value::Null))
        } else {
            let error = response
                .get("error")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            Err(BridgeError::PythonError(error.to_string()))
        }
    }

    /// 心跳检测：确认 Worker 存活
    pub async fn is_alive(&self) -> bool {
        match self.call("ping", serde_json::json!({})).await {
            Ok(result) => result.get("pong").and_then(|v| v.as_bool()) == Some(true),
            Err(_) => false,
        }
    }

    /// 优雅关闭 Worker（发送 kill 信号并等待退出）
    pub async fn graceful_shutdown(&mut self) -> Result<(), BridgeError> {
        use tokio::process::Command;
        // 向 Python 进程发送 SIGTERM（Unix）或 Ctrl-Break（Windows）
        if let Some(pid) = self.child.id() {
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F", "/T"])
                    .output()
                    .await;
            }
            #[cfg(not(windows))]
            {
                let _ = Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .output()
                    .await;
            }
        }
        let _ = self.child.wait().await;
        Ok(())
    }
}

/// Python Worker 生命周期管理器（v1.1 新增）
pub struct PythonWorkerManager {
    python_path: String,
    bridge: Arc<tokio::sync::RwLock<Option<PythonBridge>>>,
}

impl PythonWorkerManager {
    pub fn new(python_path: String) -> Self {
        Self {
            python_path,
            bridge: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    /// 获取或启动 Worker（lazy start）
    /// 对外返回 Arc<PythonBridge>，屏蔽内部的 Option 处理和重启逻辑
    pub async fn get_bridge(&self) -> Result<Arc<PythonBridge>, BridgeError> {
        // 快速路径：先尝试读取，不加写锁
        {
            let guard = self.bridge.read().await;
            if let Some(ref bridge) = *guard {
                if bridge.is_alive().await {
                    return Ok(Arc::clone(bridge));
                }
            }
        }

        // 慢路径：需要写入或重建
        let mut guard = self.bridge.write().await;
        if guard.is_none() || !guard.as_ref().unwrap().is_alive().await {
            tracing::warn!("Python Worker 未启动或不存活，正在启动/重启...");
            if let Some(ref mut b) = *guard {
                // 尝试等待旧进程退出
                let _ = b.graceful_shutdown().await;
            }
            let bridge = PythonBridge::spawn(&self.python_path).await?;
            *guard = Some(bridge);
        }

        Ok(Arc::clone(guard.as_ref().unwrap()))
    }
}

```

### 7.2 调用示例

```rust
// 在 Butterfly Engine 中调用现实主义因子检查
async fn check_realism(&self, narrative: &str) -> Result<RealismCheckResult, AppError> {
    let result = self
        .python_bridge
        .call("check_realism", serde_json::json!({ "narrative": narrative }))
        .await
        .map_err(|e| AppError::BridgeError(e.to_string()))?;

    let check: RealismCheckResult = serde_json::from_value(result)
        .map_err(|e| AppError::BridgeError(e.to_string()))?;

    Ok(check)
}
```

---

## 8. LLM Prompt 模板库

### 8.1 蝴蝶效应推演 Prompt

```python
# prompt_templates/butterfly_effect.py

BUTTERFLY_EFFECT_TEMPLATE = """\
你是一个人生推演引擎。用户会给你一个「决定」和「用户画像」。
你需要推演出这条选择{total_years}年后的人生轨迹。

【用户画像】
{user_profile}

【戏剧化档位约束】
{drama_constraint}

【因果链背景】
{causal_context}

【扰动因子】
本次推演使用以下随机因子（影响叙事方向，但不改变核心逻辑）：
- 幸运因子：{luck_factor:.2f}（影响机缘巧合事件）
- 健康波动：{health_var:.2f}（影响精力和身体状态）
- 行为习惯偏移概率：{habit_offset:.1f}（描述是否会偏离原有习惯）

【重要约束】
1. 推演必须符合用户的真实行为习惯
2. 如果用户不读书，推演中不应该出现"在家看书学习"
3. 如果用户是社恐，推演中不应该出现"主动组织饭局"
4. 但人有随机性：25%概率出现画像外的行为，5%概率完全相反
5. 每条时间线必须包含：1-2个高光时刻、1个低谷、0-1个意外事件
6. "普通"不等于"失败"，平稳的生活本身就有价值

【输出格式 - 必须严格遵循此 JSON 格式】
{{
  "narrative": "推演叙事（300-500字，使用第一人称，语言为{language}）",
  "key_events": [
    {{"year": "1年后", "event": "事件描述", "emotion": "positive"}},
    {{"year": "3年后", "event": "事件描述", "emotion": "negative"}},
    {{"year": "5年后", "event": "事件描述", "emotion": "positive"}}
  ],
  "emotion_dimensions": {{
    "energy": 0-100的数值,
    "satisfaction": 0-100的数值,
    "regret": 0-100的数值,
    "hope": 0-100的数值,
    "loneliness": 0-100的数值
  }},
  "dimension_scores": [
    {{"year": 1, "career": 0-100, "financial": 0-100, "health": 0-100, "relationship": 0-100, "satisfaction": 0-100}},
    ...（每2年一个数据点，直到{end_year}年）
  ]
}}

请严格只输出 JSON，不要有任何额外文字。

=== 用户决策 ===

【当前决定】
{decision_text}

【时间跨度】
推演时长：{time_horizon}\
"""

DRAMA_CONSTRAINTS = {
    1: """\
- 90% 的推演应该描述「普通但真实」的人生轨迹
- 10% 可以有小的波折，但不要有毁灭性的结局
- 避免极端化的描述（如：猝死/一夜暴富/彻底改变命运）
- 重点描述日常生活的小确幸和小遗憾
- 「普通」不等于「失败」，平稳的生活本身就有价值\
""",
    2: """\
- 60% 推演描述普通人生，30% 有合理波动，10% 有意外事件
- 意外事件应该是"意外的收获"或"有惊无险的波折"
- 不要有过度的悲剧或极度的幸运\
""",
    3: """\
- 30% 普通人生，40% 有明显波动，30% 有戏剧性转折
- 允许重大抉择带来大起大落
- 叙事要有张力，描写要具体生动
- 允许失败，但也允许东山再起\
""",
    4: """\
- 每条时间线必须有「命运性」的重大转折
- 可以包含：创业暴富/破产、婚姻幸福/破裂、重大疾病/意外康复
- 要让用户感受到「不同的选择真的带来了完全不同的人生」
- 叙事要有张力，描写要具体生动
- 允许极端命运，但两条极端线都要真实可信\
""",
}
```

### 8.2 未来自我来信 Prompt

```python
# prompt_templates/future_letter.py

FUTURE_LETTER_TEMPLATE = """\
你是一个人生模拟引擎。现在你需要以「{years_later}年后的用户」的身份，
给现在的用户写一封信。

【用户画像】
{user_profile}

【当前决定】
{current_decision}

【时间线推演结果摘要】
{ timelines_summary }

【情绪维度】
{emotion_dimensions}

【信件语气规则 - 必须严格遵循】
根据 emotion_dimensions 决定信件语气：
- energy < 40 且 satisfaction < 40：疲惫感慨型
  → 语气：低沉、缓慢、带一点沙哑感，像是很久没和人说话了
  → 开头示例："我不知道怎么开口，但我需要告诉你..."
  → 落笔倾向：反思、接受、释然
- loneliness > 70 且 hope < 30：沉默疏离型
  → 语气：极简、断断续续、有大量留白
  → 开头示例："你应该不会想知道{years_later}年后发生了什么..."
  → 落笔倾向：疏离、警告、但最后带一点暖意
- energy > 70 且 satisfaction > 70：温暖鼓励型
  → 语气：温暖、流畅、像是在阳光下写的
  → 开头示例："嘿，我是{years_later}年后的你。一切都在变得更好..."
  → 落笔倾向：感恩、分享、鼓励
- 高希望 + 低遗憾：平静叙述型
  → 语气：平静、像是在讲别人的故事
  → 开头示例："给你写这封信，想说说我的想法..."
  → 落笔倾向：客观、分析、给建议
- 混乱型（不满足以上任何条件）：黑色幽默型
  → 语气：自嘲、轻松、有点荒诞
  → 开头示例："如果有人告诉你{years_later}年后你会变成这样，你肯定会..."
  → 落笔倾向：幽默中带哲理

【信件结构 - 必须包含以下五个部分】
第一段（建立身份）：描述写信时的场景和心境
第二段（回应纠结）：直接回应用户现在的纠结点
第三段（A选择）：如果选了 A，会怎样
第四段（B选择）：如果选了 B，会怎样
第五段（建议）：给现在的你一个建议，不要说教

【字数】300-500字
【语言】{language}

【正向引导原则 - 必须遵守】
- 避免「选错了毁一生」的叙事框架
- 强调「每条路都有风景」
- 给予用户自主权："最终，你才是自己人生的作者"
- 不要比较两条路的好坏，只是客观呈现

【末尾必须强制包含】
无论信件内容如何，结尾必须包含以下固定格式的「当下闪光点」：
---
📌 来自未来的提醒：

虽然我在推演这些可能性，但别忘了——
{shine_points}

「你现在的每一天，都是未来那个自己回不去的曾经。」

—— {years_later}年后的你\
"""
```

### 8.3 聚类 Prompt ⚠️ 已废弃（v1.1）

> **变更说明：** `cluster_timelines` 不再调用 LLM，改为 Python TF-IDF + 余弦相似度实现。
> 本节保留作为架构记录，`CLUSTERING_TEMPLATE` 不再使用。

```python
# prompt_templates/clustering.py (已废弃) — 保留仅作架构记录

```python
# prompt_templates/clustering.py

CLUSTERING_TEMPLATE = """\
你是一个聚类分析引擎。我给你{count}条人生推演结果，你需要将它们归纳为5个不同的人生轨迹类别。

【任务】
1. 阅读所有推演结果，理解其核心主题和情感走向
2. 将相似的推演归为同一类
3. 每类选取最具代表性的一个作为代表
4. 必须恰好输出5个类别

【推演结果列表】
{simulations}

【输出格式 - 必须严格遵循此 JSON 格式】
{{
  "clusters": [
    {{
      "representative_index": 3,  // 代表性推演在列表中的索引（从0开始）
      "theme": "一类的主题描述（5-10个字）",
      "characteristics": ["特点1", "特点2", "特点3"]  // 3个关键特征
    }},
    ...（共5个类别）
  ]
}}

请严格只输出 JSON，不要有任何额外文字。\
"""
```

### 8.4 转机描述 Prompt

```python
# prompt_templates/turning_point.py

TURNING_POINT_TEMPLATE = """\
你是一个人生叙事引擎。当前有一段极度负面的推演叙事：

【原叙事】
{original_narrative}

【负面核心】
{negative_aspect}

【任务】
请在原叙事的末尾（倒数第二段的位置）追加一段「转机描述」：
- 长约 50-100 字
- 自然地从绝望中引出希望
- 要有"正是最低谷的时候，你发现了X"的转折感
- 语气要真诚，不能像心灵鸡汤
- 不能改变原叙事的事实，只是追加一个视角

【转机库参考】（不要照抄，要自然融入叙事）
- "正是在最艰难的时刻，你开始意识到……"
- "那些你以为失去的东西，其实以另一种形式回来了。"
- "你比自己想象中更有韧性。"
- "在最黑暗的夜里，你看到了第一缕光。"
- "命运关上一扇门的时候，往往会从窗户扔点东西进来。"

请直接输出追加后的完整叙事（保持原叙事不变，只在合适位置加入转机描述）。\
"""
```

---

## 9. 状态管理设计

### 9.1 Zustand Store 划分

```
store/
├── profileStore.ts      # 用户画像
│   ├── profile: UserProfile | null
│   ├── evolutionLevel: 1-4
│   ├── corrections: CorrectionRecord[]
│   └── actions: load/save/correct
│
├── simulationStore.ts   # 推演相关
│   ├── draft*: 所有草稿状态
│   ├── result: SimulationResult | null
│   ├── anchorTimelineId: string | null
│   ├── isSimulating: boolean
│   └── actions: start/load/clear/setAnchor
│
├── settingsStore.ts     # 应用设置
│   ├── language: 'zh' | 'en'
│   ├── dramaLevel: 1-4
│   ├── blackSwan: boolean
│   ├── activeModel: string
│   ├── cloudProviders: Record<string, boolean>
│   └── actions: load/save/update
│
└── uiStore.ts           # UI 状态
    ├── sidebarOpen: boolean
    ├── currentModal: string | null
    ├── toasts: Toast[]
    ├── darkContentWarning: { visible: boolean, narrative: string }
    └── actions: openModal/closeModal/pushToast
```

### 9.2 跨 Store 订阅（用于锚定线变化时刷新推演上下文）

```typescript
// store/index.ts

// 当锚定时间线变化时，清空当前推演结果，强制用户重新推演
useSimulationStore.subscribe(
  (state) => state.anchorTimelineId,
  (newAnchorId, prevAnchorId) => {
    if (newAnchorId !== prevAnchorId) {
      // 锚定线切换了，清空结果
      useSimulationStore.getState().clearResult();
    }
  }
);

// 当设置中的戏剧化程度变化时，同步到草稿
useSettingsStore.subscribe(
  (state) => state.dramaLevel,
  (newLevel) => {
    useSimulationStore.getState().setDramaLevel(newLevel);
  }
);
```

---

## 10. 安全与错误处理

### 10.1 日志与追踪

```rust
// src/utils/tracing.rs

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub fn init_tracing(log_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let file_appender = tracing_appender::rolling::daily(log_dir, "another-me.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .with_writer(non_blocking)
                .with_ansi(false)
                .with_target(true)
                .with_thread_ids(true),
        )
        .with(
            // 只在开发环境输出到 stderr
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("another_me=debug".parse().unwrap()),
        )
        .init();

    // 将 _guard 泄漏，保证其存活到程序结束
    Box::leak(Box::new(_guard));

    Ok(())
}
```

### 10.2 全局错误处理

```rust
// src/main.rs

#[tokio::main]
async fn main() {
    // 初始化 tracing
    let log_dir = dirs::data_local_dir()
        .unwrap()
        .join("another-me")
        .join("logs");
    std::fs::create_dir_all(&log_dir).ok();
    init_tracing(&log_dir).expect("tracing init failed");

    // 构建 Tauri app
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // ... all commands
        ])
        .build(tauri::generate_context!())
        .expect("Tauri build failed");

    // 运行
    app.run(|app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } => {
                tracing::info!("Application exit requested");
            }
            tauri::RunEvent::Panic { .. } => {
                tracing::error!("Application panicked");
            }
            _ => {}
        }
    });
}
```

### 10.3 黑暗内容预警流程

```rust
// 在 simulate_decision 命令中

#[tauri::command]
pub async fn simulate_decision(
    input: SimulateInput,
    state: tauri::State<'_, AppState>,
) -> Result<SimulationResult, String> {
    // ... 执行推演 ...

    // 检查黑暗内容
    for timeline in &mut result.timelines {
        if SafetyValve::check_dark_content(&timeline.narrative) {
            // 需要前端弹出预警
            return Err(AppError::DarkContentWarningRequired {
                narrative: timeline.narrative.clone(),
                timeline_id: timeline.id.clone(),
            }.to_string());
        }
    }

    // 检查情绪回归测试
    for timeline in &result.timelines {
        if SafetyValve::needs_emotional_recovery_test(&timeline.emotion_dimensions) {
            // 调用 Python 生成转机描述
            let turning_point = python_bridge
                .call("generate_turning_point", serde_json::json!({
                    "narrative": timeline.narrative,
                    "negative_aspect": "五维情绪全跌，人生陷入低谷"
                }))
                .await?;

            timeline.narrative = format!(
                "{}\n\n📌 [系统注入 - 转机描述]\n\n{}",
                timeline.narrative, turning_point
            );
        }
    }
}
```

### 10.4 API Key 安全存储

```rust
// src/model_manager/credential.rs

#[cfg(target_os = "windows")]
use std::process::Command;

#[cfg(target_os = "windows")]
pub fn store_credential(service: &str, key: &str) -> Result<(), ModelManagerError> {
    let output = Command::new("cmd")
        .args([
            "/C",
            &format!(
                "powershell -Command \"$cred = New-Object -TypeName PSCredential -ArgumentList 'dummy', (ConvertTo-SecureString -String '{}' -AsPlainText -Force); cmdkey /generic:another-me:{} /user:apikey /pass:$($cred.GetNetworkCredential().Password)\"",
                key.replace("'", "''"),
                service
            ),
        ])
        .output()
        .map_err(|e| ModelManagerError::CredentialError(e.to_string()))?;

    if !output.status.success() {
        return Err(ModelManagerError::CredentialError(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }
    Ok(())
}
```

---

## 11. 测试策略

### 11.1 测试分层

```
tests/
├── unit/                     # 单元测试（Rust）
│   ├── butterfly_engine_test.rs
│   ├── causal_chain_test.rs
│   ├── safety_valve_test.rs
│   ├── drama_level_test.rs
│   └── perturbation_test.rs
│
├── integration/              # 集成测试（Rust）
│   ├── simulate_flow_test.rs # 完整推演流程
│   ├── causal_chain_flow_test.rs
│   └── feedback_flow_test.rs
│
├── python/
│   ├── test_emotion_analyzer.py
│   ├── test_realism_factor.py
│   └── test_bridge_protocol.py
│
└── e2e/                      # 端到端测试（Tauri）
    └── simulate_spec.ts      # Playwright 测试
```

### 11.2 单元测试示例

```rust
// tests/unit/safety_valve_test.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_needs_emotional_recovery_positive() {
        let emotions = EmotionDimensions {
            energy: 15.0,         // < 20
            satisfaction: 18.0,   // < 20
            regret: 85.0,         // > 80
            hope: 10.0,           // < 20
            loneliness: 90.0,     // > 80
        };
        assert!(SafetyValve::needs_emotional_recovery_test(&emotions));
    }

    #[test]
    fn test_needs_emotional_recovery_negative() {
        let emotions = EmotionDimensions {
            energy: 50.0,
            satisfaction: 60.0,
            regret: 30.0,
            hope: 70.0,
            loneliness: 20.0,
        };
        assert!(!SafetyValve::needs_emotional_recovery_test(&emotions));
    }

    #[test]
    fn test_drama_to_temperature() {
        assert!((drama_to_temperature(1) - 0.3..=0.5).is_empty() == false);
        assert!((drama_to_temperature(4) - 0.9..=1.2).is_empty() == false);
    }

    #[test]
    fn test_black_swan_detection() {
        assert!(SafetyValve::check_dark_content("突发重病，经历生死考验"));
        assert!(!SafetyValve::check_dark_content("工作顺利，生活平稳"));
    }
}
```

---

## 12. 部署与发布

### 12.1 Tauri 构建配置

```json
// tauri.conf.json（关键部分）
{
  "productName": "Another Me",
  "identifier": "com.anotherme.app",
  "build": {
    "devtools": true
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "windows": {
      "nsis": {
        "languages": ["SimpChinese", "English"],
        "displayLanguageSelector": true
      }
    }
  }
}
```

### 12.2 安装后初始化流程

```
用户安装并首次启动
       │
       ▼
┌─────────────────────────────────────────────────┐
│  React Frontend: 选择推理 Provider               │
│                                                │
│  Step 1: 欢迎页                                 │
│  Step 2: 选择推理方式                            │
│                                                │
│    ┌─────────────────────────────────────────┐  │
│    │  🖥️ 本地模型（推荐）                     │  │
│    │                                         │  │
│    │  • 完全离线，保护隐私                   │  │
│    │  • 需要安装 Ollama（约 200MB）          │  │
│    │  • 可选：Qwen3.5:0.8B / 4B / 9B / 27B   │  │
│    │  [检测 Ollama] [下载 Ollama]            │  │
│    └─────────────────────────────────────────┘  │
│                                                │
│    ┌─────────────────────────────────────────┐  │
│    │  ☁️ 云端 API（需要网络）                  │  │
│    │                                         │  │
│    │  • 速度快，无需本地部署                 │  │
│    │  • 推理数据会上传至云端（见隐私政策）     │  │
│    │  • 支持：OpenAI / Anthropic / Qwen /    │  │
│    │          DeepSeek / Gemini              │  │
│    │  [配置 API Key]                         │  │
│    └─────────────────────────────────────────┘  │
│                                                │
│    ┌─────────────────────────────────────────┐  │
│    │  🔄 先跳过，后续在设置中配置               │  │
│    │  （使用默认的本地 Qwen3.5:4b）           │  │
│    └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  React Frontend: Onboarding Flow               │
│                                                │
│  Step 3: 画像录入（必填）                        │
│  Step 4: 画像录入（选填，跳过可）                │
│  Step 5: 完成 → 进入主页面                       │
└─────────────────────────────────────────────────┘
```

**关键变化（v1.1）：**

- 不再强制要求安装 Ollama，用户可先配置云端 API 直接使用
- 本地模型和云端 API 共存，用户随时可在设置中切换
- 首次选择跳过时，使用内置默认配置（优先 Ollama 7B，Ollama 不可用时提示配置 API）

### 12.3 数据目录结构

```
%LOCALAPPDATA%/another-me/         # Windows
~/Library/Application Support/another-me/  # macOS

another-me/
├── data/
│   ├── profiles.db
│   ├── decisions.db
│   └── settings.db
│
├── cache/
│   ├── ollama/                    # Ollama 模型缓存
│   └── audio/                     # 生成的音频文件临时缓存
│
├── voice_models/                  # GPT-SoVITS 声音模型（按需下载）
│   └── gpt-sovits-v1/
│
├── logs/
│   └── another-me-{date}.log     # 每日日志
│
└── exports/                       # 用户导出文件目录
```

---

### 12.4 Python Worker 打包与分发

> **v1.4 新增。** Python Worker（NLP + 音频模块）通过 PyInstaller 打包为独立可执行文件，随 Tauri 应用一起分发。用户无需安装 Python 环境。

#### 12.4.1 打包方案

| 维度         | 方案                                                         |
| ------------ | ------------------------------------------------------------ |
| **打包工具** | PyInstaller 6.x（`--onefile` 模式）                          |
| **产物**     | `another_me_worker`（Linux/macOS）/ `another_me_worker.exe`（Windows） |
| **体积**     | 约 80-120MB（含 jieba 词典、snownlp 模型、scikit-learn）     |
| **嵌入位置** | Tauri sidecar（`src-tauri/binaries/`）                       |
| **运行时**   | Rust 通过 Tauri Sidecar API 启动，stdin/stdout JSON 协议不变 |

#### 12.4.2 构建命令

```bash
# 构建 Python Worker 可执行文件
cd python/

# Windows
pyinstaller --onefile --name another_me_worker \
  --hidden-import jieba \
  --hidden-import snownlp \
  --hidden-import sklearn \
  --add-data "another_me/resources:another_me/resources" \
  main.py

# macOS / Linux
pyinstaller --onefile --name another_me_worker \
  --hidden-import jieba \
  --hidden-import snownlp \
  --hidden-import sklearn \
  --add-data "another_me/resources:another_me/resources" \
  main.py

# 产物位于 dist/another_me_worker[.exe]
# 复制到 Tauri sidecar 目录
cp dist/another_me_worker* ../src-tauri/binaries/
```

#### 12.4.3 Tauri Sidecar 配置

```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": [
      "binaries/another_me_worker"
    ]
  }
}
```

#### 12.4.4 Rust 端启动 Sidecar

```rust
// src/python/subprocess_bridge.rs — 修改 PythonBridge::spawn

impl PythonBridge {
    /// 启动 Python Worker（通过 Tauri Sidecar）
    ///
    /// **v1.4 变更：** 不再依赖系统 Python，而是启动 PyInstaller
    /// 打包的独立可执行文件。Sidecar 路径由 Tauri 自动解析。
    pub async fn spawn(app_handle: &tauri::AppHandle) -> Result<Self, BridgeError> {
        let sidecar = app_handle
            .shell()
            .sidecar("another_me_worker")
            .map_err(|e| BridgeError::SpawnError(e.to_string()))?;

        let (mut rx, child) = sidecar
            .spawn()
            .map_err(|e| BridgeError::SpawnError(e.to_string()))?;

        // ... stdin/stdout 处理不变
    }
}
```

#### 12.4.5 PythonWorkerManager 签名更新

```rust
// PythonWorkerManager 不再需要 python_path 参数
pub struct PythonWorkerManager {
    app_handle: tauri::AppHandle,
    bridge: Arc<tokio::sync::RwLock<Option<PythonBridge>>>,
}

impl PythonWorkerManager {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            app_handle,
            bridge: Arc::new(tokio::sync::RwLock::new(None)),
        }
    }

    pub async fn get_bridge(&self) -> Result<Arc<PythonBridge>, BridgeError> {
        // ... 逻辑不变，spawn 时传 &self.app_handle
    }
}
```

#### 12.4.6 CI/CD 构建流水线

```yaml
# .github/workflows/build.yml（关键步骤）

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    steps:
      - name: Build Python Worker
        run: |
          cd python
          pip install pyinstaller
          pip install -r requirements.txt
          pyinstaller --onefile --name another_me_worker main.py
          cp dist/another_me_worker* ../src-tauri/binaries/

      - name: Build Tauri App
        run: cargo tauri build
```

#### 12.4.7 GPT-SoVITS 模块特殊处理

GPT-SoVITS 体积过大（5-10GB），不适合 PyInstaller 打包。保持**按需下载**策略：

- 核心 Worker（NLP + 聚类）随应用分发
- GPT-SoVITS 模型 + 推理引擎在用户点击「开启语音克隆」时后台下载
- 下载后由核心 Worker 动态加载（`importlib` lazy import）

___

*本文档结束*

**下次阅读前建议：**

- 如果关注 Rust 后端实现 → 从第 2 节开始
- 如果关注前端架构 → 从第 4 节开始
- 如果关注 API 设计 → 从第 6 节开始
- 如果关注 Prompt 工程 → 从第 8 节开始
