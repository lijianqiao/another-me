# Sprint 3 任务计划：用户界面 + 未来来信 + 安全阀

> **目标：** 用户能通过 UI 完成完整的推演体验
> **日期：** 2026-04-10
> **状态：** ✅ complete

---

## 后端 Rust ✅

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 3.5 | simulate_decision 完整实现 | `commands/simulate.rs` | ✅ |
| 3.6+3.7 | 未来来信生成 + Prompt 模板 | `commands/letter.rs` | ✅ |
| 3.10 | 安全阀 | `engines/safety_valve.rs` | ✅ |
| 3.12 | 决策记录存储 | `storage/decision_store.rs` | ✅ |

## 前端 React ✅

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 3.1 | Onboarding 4 步引导 | `pages/OnboardingPage.tsx` | ✅ |
| 3.2+3.3 | 决策录入 + DramaSlider | `components/simulate/*` | ✅ |
| 3.4 | SimulationLoading | `components/simulate/SimulationLoading.tsx` | ✅ |
| 3.8 | TimelineCard | `components/results/TimelineCard.tsx` | ✅ |
| 3.9 | FutureLetter | `components/results/FutureLetter.tsx` | ✅ |
| 3.11 | ShinePoints | `components/common/ShinePoints.tsx` | ✅ |
| 3.13 | simulationStore + 路由 | `store/simulationStore.ts` + `router.tsx` | ✅ |

## 验证 ✅

| 检查 | 结果 |
|---|---|
| `cargo check` | ✅ 0 errors |
| `pnpm exec tsc --noEmit` | ✅ 0 errors |
