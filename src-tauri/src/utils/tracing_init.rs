//! 日志初始化
//!
//! 对应 ARCH 10.1。默认读取环境变量 `RUST_LOG`，未设置时用
//! `info,another_me_lib=debug`。

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn init() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,another_me_lib=debug"));

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(false).with_line_number(true))
        .init();
}
