//! 日志初始化
//!
//! Sprint 11：增加文件日志滚动（按天）
//! 日志文件保存在用户数据目录的 logs/ 文件夹下

use tracing_appender::rolling;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn init() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,another_me_lib=debug"));

    let log_dir = dirs_log_path();

    let file_appender = rolling::daily(&log_dir, "another-me.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // 持有 guard 防止被 drop（使用 Box::leak 让其存活到进程结束）
    Box::leak(Box::new(_guard));

    tracing_subscriber::registry()
        .with(filter)
        .with(
            fmt::layer()
                .with_target(false)
                .with_line_number(true),
        )
        .with(
            fmt::layer()
                .with_target(false)
                .with_line_number(true)
                .with_ansi(false)
                .with_writer(non_blocking),
        )
        .init();

    tracing::info!(log_dir = %log_dir.display(), "日志系统初始化完成");
}

fn dirs_log_path() -> std::path::PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let log_dir = base.join("another-me").join("logs");
    let _ = std::fs::create_dir_all(&log_dir);
    log_dir
}
