//! 核心引擎层
//!
//! - `butterfly`: 蝴蝶效应引擎（单次推演 Sprint 2 / 并发 Sprint 5）
//! - `perturbation`: 扰动因子生成
//! - `safety_valve` (Sprint 3): 安全阀
//! - `causal_chain` (Sprint 7): 因果链引擎
//! - `self_evolution` (Sprint 8): 自我进化引擎

pub mod butterfly;
pub mod causal_chain;
pub mod perturbation;
pub mod safety_valve;
pub mod self_evolution;
