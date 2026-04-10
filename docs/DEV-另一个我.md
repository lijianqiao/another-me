# 「另一个我」— 开发计划

> **版本：** v1.0
> **日期：** 2026-04-09
> **基于：** PRD v1.4 + ARCH v1.4
> **开发模式：** 单人全栈（Rust + Python + React/TS）
> **Sprint 周期：** 2 周/Sprint

---

## 一、全局约定

**技术栈版本：** Tauri 2 / Rust 1.83+ / React 19.1 / TypeScript 5.8 / Vite 7 / Python 3.14 / pnpm / uv / Ollama + qwen3.5:4b

**代码仓库结构：**

```
another-me/
├── src-tauri/          # Rust 后端
├── src/                # React 前端
├── python/             # Python Worker
├── tests/              # 测试
├── docs/               # 文档（PRD / ARCH / 本计划）
└── .github/workflows/  # CI/CD
```

**分支策略：** `main`（稳定） ← `dev`（开发） ← `feat/*`（功能分支）

**每个 Sprint 产出物：** 可运行的应用 + 该 Sprint 的测试用例

---

## 二、Phase 1：MVP（Sprint 1-4，共 8 周）

> **目标：** 用户能完成一次完整的「输入决策 → 看到推演结果 + 未来来信」体验

---

### Sprint 1（Week 1-2）：项目骨架 + 数据层

> 目标：项目能编译运行，SQLite 读写通畅，前端能渲染页面

#### 任务清单

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 1.1 | Tauri 项目初始化 | `src-tauri/`, `package.json` | `cargo tauri dev` 成功启动空白窗口 |
| 1.2 | Rust types 模块 | `src/types/*.rs` | 所有 struct（UserProfile, DecisionRecord, Timeline, EmotionDimensions 等）定义完成，`cargo build` 通过 |
| 1.3 | SQLite 数据库初始化 | `src/storage/sqlite.rs` | 应用启动时自动创建 profiles.db / decisions.db / settings.db，Schema 与 ARCH 5.2-5.4 一致 |
| 1.4 | 画像存储 CRUD | `src/storage/profile_store.rs` + `src/commands/profile.rs` | `save_profile` / `get_profile` 命令可用，单元测试通过 |
| 1.5 | 设置存储 CRUD | `src/storage/settings_store.rs` + `src/commands/settings.rs` | `get_settings` / `update_settings` 命令可用 |
| 1.6 | React 项目搭建 | `src/main.tsx`, `App.tsx`, `src/i18n/` | React + TypeScript + Zustand + React Router + i18next 初始化完成 |
| 1.7 | 前端路由 + AppShell | `src/App.tsx`, `src/components/layout/` | 路由按 ARCH 4.3 配置，AppShell 含 Header + Sidebar 骨架 |
| 1.8 | TypeScript 类型定义 | `src/types/index.ts` | 所有 interface 对齐 Rust types |
| 1.9 | Zustand Store 骨架 | `src/store/*.ts` | profileStore / simulationStore / settingsStore / uiStore 初始化，action 签名定义完成（实现可为空） |
| 1.10 | Tauri invoke 封装 | `src/api/tauri.ts`, `src/api/profile.ts` | 前端能调用 `save_profile` / `get_profile`，数据往返验证 |

**Sprint 1 交付物：** 空壳应用能启动，前端路由可切换，画像数据可存取

---

### Sprint 2（Week 3-4）：AI 网关 + Python Worker + 单次推演

> 目标：输入一个决策，能从 Ollama 拿到一次推演 JSON

#### 前置条件

- 本地已安装 Ollama + qwen3.5:4b

#### 任务清单

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 2.1 | AI Gateway — Ollama Chat API | `src/ai/ollama.rs`, `gateway.rs` | 调用 `/api/chat`，system/user 分离，`format: "json"` 启用，180s 超时。单元测试：传入 prompt 返回合法 JSON |
| 2.2 | AI Gateway — split_prompt | `src/ai/gateway.rs` | `=== 用户决策 ===` 分隔符拆分正确，Fallback 行为正确 |
| 2.3 | UserContextBlock 构建 | `src/ai/gateway.rs` | `build_contextual_prompt` 对所有 Provider 统一注入上下文 |
| 2.4 | 扰动因子生成 | `src/engines/perturbation.rs` | `PerturbationFactors::generate()` 实现，含 luck_factor / health_var / habit_offset / black_swan |
| 2.5 | 戏剧化 → Temperature | `src/utils/drama_level.rs` | `drama_to_temperature(1..4)` 返回值在文档指定范围内 |
| 2.6 | Prompt 模板（蝴蝶效应） | `src/engines/butterfly.rs` 或独立模板文件 | `build_simulation_prompt()` 生成的 prompt 含画像/约束/扰动/输出格式，与 ARCH 8.1 一致 |
| 2.7 | ButterflyEngine — 单次推演 | `src/engines/butterfly.rs` | 暂不做 5 次并发，先实现单次调用 → 解析 JSON → 返回 `SimulationCandidate` |
| 2.8 | Python Worker 骨架 | `python/main.py`, `python/another_me/bridge/protocol.py` | stdin/stdout JSON 协议运行通畅，`ping` → `pong` |
| 2.9 | Realism Factor（Python） | `python/another_me/nlp/realism_factor.py` | `check_realism` 返回 BALANCED / TOO_POSITIVE / TOO_NEGATIVE |
| 2.10 | PythonBridge（Rust 端） | `src/python/subprocess_bridge.rs` | `PythonBridge::spawn()` + `call()` + `is_alive()` 可用，使用本地 Python 运行（PyInstaller 打包推迟到 Sprint 4） |
| 2.11 | 端到端冒烟测试 | 手动 | Rust 调用 Ollama → 拿到推演 JSON → Python 检查现实主义因子 → 全链路通 |

**Sprint 2 交付物：** 后端能完成一次推演全链路（Ollama 调用 → JSON 解析 → 现实主义校验）

---

### Sprint 3（Week 5-6）：用户界面 + 未来来信 + 安全阀

> 目标：用户能通过 UI 完成完整的推演体验

#### 任务清单

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 3.1 | Onboarding 引导流程 | `src/components/onboarding/*`, `OnboardingPage.tsx` | 4 步引导（欢迎 → 基础信息 → 习惯 → 性格），完成后跳转主页，画像存入 SQLite |
| 3.2 | 决策录入页 | `src/components/simulate/DecisionInput.tsx`, `SimulatePage.tsx` | 文本框 + 时间跨度选择 + 戏剧化滑块（档位 1-2，默认 1） + 提交按钮 |
| 3.3 | DramaSlider 组件 | `src/components/simulate/DramaSlider.tsx` | 4 档可选，显示对应说明文案 |
| 3.4 | SimulationLoading 组件 | `src/components/simulate/SimulationLoading.tsx` | 进度环 + 步骤文案，监听 `simulation_progress` 事件 |
| 3.5 | simulate_decision 命令 | `src/commands/simulate.rs` | 完整实现：取画像 → 构建 prompt → 调用 AI Gateway → 解析 → 现实主义校验 → 存储 → emit 事件 |
| 3.6 | 未来来信生成 | `src/commands/letter.rs` + Prompt 模板 | 基于推演结果 + 情绪维度生成信件，语气映射正确 |
| 3.7 | Prompt 模板（未来来信） | Prompt 模板文件 | 与 ARCH 8.2 一致 |
| 3.8 | 结果展示页 — 时间线卡片 | `src/components/results/TimelineCard.tsx`, `ResultsPage.tsx` | 展示 narrative + key_events 列表 + 情绪维度 |
| 3.9 | 结果展示页 — 未来来信 | `src/components/results/FutureLetter.tsx` | 信件全文展示 + 当下闪光点展示 |
| 3.10 | 安全阀 — 基础版 | `src/engines/safety_valve.rs` | `generate_shine_points()` + `check_dark_content()` + `needs_emotional_recovery_test()` 实现 |
| 3.11 | 安全阀 — 当下闪光点 | `src/components/common/ShinePoints.tsx` | 信件末尾强制展示闪光点 |
| 3.12 | 决策记录存储 | `src/storage/decision_store.rs` | `save_decision` / `get_decision` / `list_decisions` 可用 |
| 3.13 | simulationStore 完整实现 | `src/store/simulationStore.ts` | `startSimulation` 全流程：invoke → 监听进度 → 存结果 → 清理监听 |

**Sprint 3 交付物：** 用户首次打开 → Onboarding → 输入决策 → 等待 → 看到推演结果 + 来信

---

### Sprint 4（Week 7-8）：MVP 打磨 + 测试 + 打包

> 目标：MVP 可以交付给测试用户

#### 任务清单

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 4.1 | 黑天鹅因子开关 | `src/components/simulate/BlackSwanToggle.tsx`, `src/utils/black_swan.rs` | UI 开关可用，黑天鹅注入逻辑与 ARCH 2.2 一致 |
| 4.2 | 情绪回归测试 | `safety_valve.rs` + Python `generate_turning_point` | 五维中 3 维低于 20 时强制注入转机描述，前端弹出心理健康小贴士 |
| 4.3 | 黑暗内容预警 | `safety_valve.rs` + `src/store/uiStore.ts` | 含「重病/离婚/破产」等关键词时，前端先弹确认框再展示 |
| 4.4 | 推演上限提醒 | `safety_valve.rs` | 每日 3 次上限，超限弹出善意提醒 |
| 4.5 | 设置页面 | `src/components/settings/*`, `SettingsPage.tsx` | 语言切换 + 戏剧化默认档位 + 黑天鹅开关 |
| 4.6 | i18n 文案完善 | `src/i18n/zh.json`, `src/i18n/en.json` | 所有用户可见文案双语化 |
| 4.7 | 错误处理 + Toast | `src/components/common/Toast.tsx`, `uiStore.ts` | Ollama 不可用 / JSON 解析失败 / 超时，均有友好提示 |
| 4.8 | Python Worker PyInstaller 打包 | `python/` + `src-tauri/binaries/` | `another_me_worker` 可执行文件生成，Tauri Sidecar 配置完成 |
| 4.9 | PythonBridge 切换为 Sidecar | `src/python/subprocess_bridge.rs` | `PythonBridge::spawn()` 改为通过 `app_handle.shell().sidecar()` 启动 |
| 4.10 | 单元测试 | `tests/unit/` | safety_valve / drama_level / perturbation 测试覆盖 |
| 4.11 | 集成测试 | `tests/integration/` | 完整推演流程测试（mock Ollama 响应） |
| 4.12 | Tauri 构建配置 | `tauri.conf.json` | Windows NSIS / macOS DMG 构建通过 |
| 4.13 | 安装后初始化流程 | 前端 Onboarding | 选择推理 Provider（本地/云端/跳过），Ollama 检测逻辑 |

**Sprint 4 交付物：** MVP v0.3 可安装包，含完整的首次体验流程

---

### MVP 里程碑验收（Week 8 末）

| 验收项 | 标准 |
|--------|------|
| 首次体验 | 安装 → Onboarding → 输入决策 → 推演加载（有进度） → 结果展示 + 来信，全流程 < 3 分钟（含 LLM 推理） |
| 安全性 | 推演上限生效、黑暗内容有预警、闪光点强制注入 |
| 双语 | 中英文切换正常 |
| 打包 | Windows / macOS 可安装运行，Python Worker 随应用分发 |

---

## 三、Phase 2：增强（Sprint 5-8，共 8 周）

> **目标：** 5 次蒙特卡洛推演 → 3 条时间线 + 可视化 + 记忆连贯 + 反馈闭环

---

### Sprint 5（Week 9-10）：完整蝴蝶效应引擎

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 5.1 | ButterflyEngine — 5 次并发推演 | `src/engines/butterfly.rs` | `tokio::spawn` × 5 + `join_all`，进度通过 `AppHandle.emit()` 通知前端，MILESTONES = [1,3,5] |
| 5.2 | TF-IDF 聚类（Python） | `python/another_me/nlp/clustering.py` | `cluster_narratives_tfidf(narratives, k=3)` 实现 Farthest-First Traversal，返回 3 个代表索引 |
| 5.3 | 聚类集成 | `butterfly.rs` → `python_bridge.call("cluster_narratives")` | 5 次推演结果 → Python 聚类 → 3 条时间线返回前端 |
| 5.4 | 现实主义校验循环 | `butterfly.rs` + `safety_valve.rs` | TOO_POSITIVE/TOO_NEGATIVE 时，调用 LLM 重新生成（最多重试 1 次） |
| 5.5 | 多时间线渲染 | `ResultsPage.tsx` | 3 张 TimelineCard 排列展示，标注类型标签（稳健/转折/极端） |
| 5.6 | Python Worker 测试 | `tests/python/` | `test_realism_factor.py` + `test_clustering.py` + `test_bridge_protocol.py` |

---

### Sprint 6（Week 11-12）：决策树 + 人生走势图

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 6.1 | 决策树数据构建 | `src/commands/tree.rs` | 从推演结果构建 D3 树节点/边数据结构 |
| 6.2 | DecisionTree 组件（D3.js） | `src/components/results/DecisionTree.tsx` | 分叉图渲染，节点按类型着色（靛蓝/紫罗兰/琥珀/珊瑚），点击节点展开详情 |
| 6.3 | LifeChart 组件（Recharts） | `src/components/results/LifeChart.tsx` | 5 维折线图（职业/财务/健康/情感/满足），3 条时间线对比，悬停显示数值 |
| 6.4 | 历史记录页 | `src/pages/HistoryPage.tsx`, `src/components/history/HistoryList.tsx` | 决策列表 + 点击进入历史结果页 |
| 6.5 | list_decisions / get_decision | `src/commands/history.rs` | 分页查询 + 按 ID 获取完整结果 |
| 6.6 | 画像动态修正 UI | Onboarding 复用 | 每次推演前弹出「最近有什么变化吗？」确认框 |

---

### Sprint 7（Week 13-14）：因果链 + 锚定时间线

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 7.1 | CausalChainEngine | `src/engines/causal_chain.rs` | `build_context()` 实现：查历史 → 过滤锚定 → LLM 推断性格演变 |
| 7.2 | 锚定时间线 CRUD | `src/commands/simulate.rs` | `set_anchor_timeline` / `clear_anchor` / `get_anchor_timeline` 命令 |
| 7.3 | 因果链注入推演 Prompt | `butterfly.rs` | `causal_context` 参数传入 `build_simulation_prompt()`，LLM 推演自动融入历史背景 |
| 7.4 | 人生地图页 | `src/pages/LifeMapPage.tsx`, `src/components/history/LifeMap.tsx` | 纵向时间轴展示所有决策推演之间的因果关系 |
| 7.5 | get_life_map 命令 | `src/commands/history.rs` | 从 `life_map_nodes` 表查询并构建时间线数据 |
| 7.6 | 锚定线 UI 交互 | 结果页 + 人生地图页 | 用户可标记/切换锚定线，新推演自动继承锚定线上下文 |

---

### Sprint 8（Week 15-16）：反馈闭环 + Phase 2 收尾

| # | 任务 | 涉及文件 | 验收标准 |
|---|------|---------|---------|
| 8.1 | 反馈按钮 | `src/components/results/FeedbackButtons.tsx` | 「这很不我」/「这太准了」按钮，点击后弹出原因选择 |
| 8.2 | submit_feedback 命令 | `src/commands/simulate.rs` + `src/storage/feedback_store.rs` | 反馈存入 SQLite，关联 decision_id |
| 8.3 | SelfEvolutionEngine | `src/engines/self_evolution.rs` | 处理反馈 → 生成画像修正建议 → 用户确认后更新画像 |
| 8.4 | 画像修正 UI | 反馈流程中 | 展示修正建议（如「从冒险型→稳健型」），用户确认/手动调整 |
| 8.5 | 进化等级展示 | profileStore | 根据反馈次数显示 Level 1-4 |
| 8.6 | 戏剧化档位 3-4 解锁 | 设置 + simulateStore | 5 次以上推演后解锁高档位 |
| 8.7 | 集成测试补全 | `tests/integration/` | 因果链流程 + 反馈流程端到端测试 |
| 8.8 | 性能优化 | 全局 | 推演总耗时 profiling，识别瓶颈（LLM / Python / SQLite） |

---

### Phase 2 里程碑验收（Week 16 末）

| 验收项 | 标准 |
|--------|------|
| 蝴蝶效应 | 5 次推演 → 3 条差异化时间线，耗时 < 5 分钟（qwen3.5:4b，无 GPU） |
| 可视化 | 决策树可交互，人生走势图可切换维度 |
| 记忆连贯 | 第 2 次推演自动携带第 1 次的因果链上下文 |
| 反馈闭环 | 「这很不我」→ 画像修正 → 第 3 次推演结果有变化 |

---

## 四、Phase 3：生态（Sprint 9-12，共 8 周）

> **目标：** 导出分享 + 模型管理 + 音频信件 + 发布质量

---

### Sprint 9（Week 17-18）：导出 + 模型管理器

| # | 任务 | 验收标准 |
|---|------|---------|
| 9.1 | 导出 PNG（决策树截图） | html2canvas 或 SVG → PNG，保存到用户指定位置 |
| 9.2 | 导出 PDF（时间线 + 来信） | 使用 Rust PDF 库生成，含决策树 + 来信全文 |
| 9.3 | 导出 JSON（完整数据备份） | 序列化 SimulationResult → JSON 文件 |
| 9.4 | ModelManager UI | 本地模型列表 + 体积显示 + 下载/删除按钮 |
| 9.5 | list_models / switch_model / delete_model | 调用 `ollama list` / `ollama rm`，使用 `spawn_blocking` |
| 9.6 | download_model（后台异步） | `spawn_blocking` + `AppHandle.emit("model_download_complete")` |

---

### Sprint 10（Week 19-20）：云端 API 接入

| # | 任务 | 验收标准 |
|---|------|---------|
| 10.1 | API Key 安全存储 | Windows Credential Manager / macOS Keychain，永不落盘 |
| 10.2 | OpenAI API 实现 | `call_openai()` 支持 GPT-4o，兼容 chat completions 格式 |
| 10.3 | Anthropic API 实现 | `call_anthropic()` 支持 Claude Sonnet |
| 10.4 | Qwen/DashScope API 实现 | `call_qwen()` 支持 Qwen-Max |
| 10.5 | DeepSeek API 实现 | `call_deepseek()` 支持 DeepSeek-V3 |
| 10.6 | Gemini API 实现 | `call_gemini()` 支持 Gemini 2.0 Flash |
| 10.7 | API Key 配置 UI | 设置页 → 云端 API 区域，输入/删除 Key，隐私提示 |
| 10.8 | Provider 切换测试 | 切换 Ollama ↔ 各云端 API，推演结果正常 |

---

### Sprint 11（Week 21-22）：音频化信件

| # | 任务 | 验收标准 |
|---|------|---------|
| 11.1 | GPT-SoVITS 按需下载机制 | 用户点击「开启语音克隆」→ 下载引导 → 后台下载 → SHA256 校验 |
| 11.2 | 声音录制 UI | Web Audio API 录制 1 分钟样本，保存到本地 |
| 11.3 | 声音克隆引擎（Python） | GPT-SoVITS 推理，从 1 分钟样本生成克隆模型 |
| 11.4 | 音频生成 + 情感调节 | librosa 后处理：语速/音调/沙哑效果，按情绪类型调整 |
| 11.5 | generate_letter_audio 命令 | 生成音频 → 存储本地 → 返回 audio_path |
| 11.6 | 音频播放 UI | 来信页面增加播放按钮，支持调速 |
| 11.7 | 降级策略 | 未安装声音模型时：仅文字展示（默认） / AI 播音员音色 |

---

### Sprint 12（Week 23-24）：发布准备

| # | 任务 | 验收标准 |
|---|------|---------|
| 12.1 | E2E 测试 | Playwright 覆盖核心流程：Onboarding → 推演 → 结果 → 反馈 |
| 12.2 | 性能优化 | 推演总耗时二次 profiling + 优化（Python 冷启动、SQLite 查询） |
| 12.3 | CI/CD 流水线 | GitHub Actions：Python Worker 打包 → Tauri 构建 → 产物上传 |
| 12.4 | 推送提醒 | 系统通知：「一年前的今天，你做了这个决定」 |
| 12.5 | 日志系统完善 | tracing 按 ARCH 10.1 配置，每日滚动日志 |
| 12.6 | 最终 i18n 审查 | 所有文案（含 Prompt 模板）双语覆盖 |
| 12.7 | README + 用户指南 | 安装说明 + Ollama 配置指南 + 使用说明 |
| 12.8 | v1.0 Release | 构建 Windows / macOS 安装包，GitHub Releases 发布 |

---

## 五、关键依赖链

```
Sprint 1 ──→ Sprint 2 ──→ Sprint 3 ──→ Sprint 4 (MVP)
  │              │              │
  │ types/DB     │ AI Gateway   │ UI + 安全阀
  │ 前端骨架     │ Python Worker│ 端到端流程
  │              │ 单次推演     │
  │              ▼              │
  │         Sprint 5 ◄─────────┘
  │         5次推演 + 聚类
  │              │
  │              ├──→ Sprint 6（可视化） ──→ Sprint 7（因果链）──→ Sprint 8（反馈）
  │              │
  │              └──→ Sprint 9（导出 + 模型管理）──→ Sprint 10（云端API）
  │                                                       │
  │                                                       └──→ Sprint 11（音频）
  │                                                                  │
  └──────────────────────────────────────────────────────────────→ Sprint 12（发布）
```

**阻塞依赖：**

- Sprint 2 阻塞其他所有后续 Sprint（AI Gateway 是核心）
- Sprint 5（聚类）阻塞 Sprint 6（可视化需要多时间线数据）
- Sprint 10（云端 API）可与 Sprint 9 并行

---

## 六、风险预案

| 风险 | 概率 | 预案 |
|------|------|------|
| qwen3.5:4b 推演质量不够 | 中 | Sprint 2 验证，不达标则升级到 qwen3.5:8b 或提前接入云端 API |
| 5 次推演耗时超预期（>5min） | 中 | 减少到 3 次推演，或 MVP 阶段仅做单次推演 |
| PyInstaller 打包体积过大 | 低 | 切换到 `--onedir` 模式，或使用 Nuitka 替代 |
| GPT-SoVITS 本地运行困难 | 中 | Phase 3 降级为 AI 播音员音色（edge-tts 等轻量 TTS） |
| Tauri Sidecar 跨平台问题 | 中 | 提前在 Sprint 4 做 Windows + macOS 双平台验证 |
| LLM JSON 输出不稳定 | 高 | Ollama Chat API `format: "json"` 强制 + 解析失败自动重试 1 次 |

---

## 七、Sprint 日历

| Sprint | 周数 | 日期（预估） | 里程碑 |
|--------|------|-------------|--------|
| Sprint 1 | W1-2 | 04/14 - 04/25 | 项目骨架可运行 |
| Sprint 2 | W3-4 | 04/28 - 05/09 | AI 全链路通 |
| Sprint 3 | W5-6 | 05/12 - 05/23 | 用户可完成首次推演 |
| Sprint 4 | W7-8 | 05/26 - 06/06 | **MVP v0.3 发布** |
| Sprint 5 | W9-10 | 06/09 - 06/20 | 5 次推演 + 3 条时间线 |
| Sprint 6 | W11-12 | 06/23 - 07/04 | 决策树 + 走势图 |
| Sprint 7 | W13-14 | 07/07 - 07/18 | 因果链 + 人生地图 |
| Sprint 8 | W15-16 | 07/21 - 08/01 | **Phase 2 完成** |
| Sprint 9 | W17-18 | 08/04 - 08/15 | 导出 + 模型管理 |
| Sprint 10 | W19-20 | 08/18 - 08/29 | 云端 API 全接入 |
| Sprint 11 | W21-22 | 09/01 - 09/12 | 音频化信件 |
| Sprint 12 | W23-24 | 09/15 - 09/26 | **v1.0 正式发布** |

---

*开发计划文档结束*
