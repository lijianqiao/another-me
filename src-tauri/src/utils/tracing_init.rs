//! 日志初始化
//!
//! Sprint 11：
//! - 按天滚动的文件日志（`<data_local_dir>/another-me/logs/`）
//! - 自动清理 `LOG_RETENTION_DAYS` 之前的旧日志
//! - 非阻塞写入 + 控制台 fmt 层
//!
//! 环境变量：
//! - `RUST_LOG` 覆盖默认过滤器（例如 `RUST_LOG=debug` 或 `another_me_lib=trace`）

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use tracing_appender::rolling;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// 保留最近 N 天的日志，其余自动清理
const LOG_RETENTION_DAYS: u64 = 14;

pub fn init() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,another_me_lib=debug"));

    let log_dir = dirs_log_path();

    // 启动时清理旧日志（失败仅警告，不中断初始化）
    if let Err(e) = prune_old_logs(&log_dir, LOG_RETENTION_DAYS) {
        eprintln!("[tracing_init] 清理旧日志失败: {e}");
    }

    let file_appender = rolling::daily(&log_dir, "another-me.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    // 持有 guard 防止被 drop（Box::leak 让其存活到进程结束）
    Box::leak(Box::new(guard));

    // try_init: 重复初始化时返回 Err 而不是 panic（测试/REPL 场景友好）
    let _ = tracing_subscriber::registry()
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
        .try_init();

    tracing::info!(
        log_dir = %log_dir.display(),
        retention_days = LOG_RETENTION_DAYS,
        "日志系统初始化完成"
    );
}

fn dirs_log_path() -> PathBuf {
    let base = dirs::data_local_dir()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
    let log_dir = base.join("another-me").join("logs");
    let _ = std::fs::create_dir_all(&log_dir);
    log_dir
}

/// 清理超过 `retention_days` 的日志文件
fn prune_old_logs(dir: &Path, retention_days: u64) -> std::io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    let cutoff = SystemTime::now()
        .checked_sub(Duration::from_secs(retention_days * 24 * 60 * 60))
        .unwrap_or(SystemTime::UNIX_EPOCH);

    let mut removed = 0usize;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        // 仅清理 another-me.log* 前缀的文件，避免误删其它内容
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if !name.starts_with("another-me.log") {
            continue;
        }
        let modified = match entry.metadata().and_then(|m| m.modified()) {
            Ok(t) => t,
            Err(_) => continue,
        };
        if modified < cutoff {
            if std::fs::remove_file(&path).is_ok() {
                removed += 1;
            }
        }
    }
    if removed > 0 {
        eprintln!("[tracing_init] 清理了 {removed} 个过期日志文件");
    }
    Ok(())
}
