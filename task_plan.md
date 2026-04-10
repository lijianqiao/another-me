# Sprint 2 任务计划：AI 网关 + Python Worker + 单次推演

> **目标：** 输入一个决策，能从 Ollama 拿到一次推演 JSON，并通过 Python 校验现实主义因子
> **日期：** 2026-04-10
> **状态：** ✅ complete

---

## 阶段 A：独立模块 ✅

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 2.4 | 扰动因子生成 | `src-tauri/src/engines/perturbation.rs` | ✅ |
| 2.5 | 戏剧化→Temperature | `src-tauri/src/utils/drama_level.rs` | ✅ |
| 2.8 | Python Worker 骨架 | `python/` 整体重构 | ✅ |
| 2.9 | Realism Factor | `python/another_me/nlp/realism_factor.py` | ✅ |

## 阶段 B：AI 网关 ✅

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 2.1 | Ollama Chat API | `src-tauri/src/ai/ollama.rs` | ✅ |
| 2.2 | split_prompt | `src-tauri/src/ai/gateway.rs` | ✅ |
| 2.3 | UserContextBlock | `src-tauri/src/ai/gateway.rs` | ✅ |

## 阶段 C：组装 ✅

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 2.6 | Prompt 模板 | `src-tauri/src/engines/butterfly.rs` | ✅ |
| 2.7 | ButterflyEngine 单次推演 | `src-tauri/src/engines/butterfly.rs` | ✅ |
| 2.10 | PythonBridge（Rust 端） | `src-tauri/src/python/subprocess_bridge.rs` | ✅ |

## 阶段 D：集成验证 ✅

| # | 任务 | 状态 |
|---|------|------|
| 2.11 | cargo check (0 errors) + tsc --noEmit (0 errors) + Python Worker ping/check_realism | ✅ |
