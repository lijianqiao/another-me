//! Python 进程桥接
//!
//! 通过 `tokio::process::Command` 启动持久化 Python Worker，
//! 使用 stdin/stdout JSON 协议通信。对应 ARCH 7.1。
//!
//! Sprint 2：使用本地 Python 运行。
//! Sprint 4：支持 Sidecar 模式（PyInstaller 打包的可执行文件）。
//! 优先级：Sidecar > 本地 Python。
//!
//! 并发安全性：stdin 和 stdout 由单个 `Mutex<BridgeIo>` 守护，
//! 保证任意 call() 的 "写请求 -> 读响应" 是原子操作，
//! 不会被其它并发调用穿插导致应答错配。

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter};

use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

use crate::python::protocol::{WorkerRequest, WorkerResponse};
use crate::types::error::AppError;

/// 单次 call() 的总超时（写 + 读）
const CALL_TIMEOUT: Duration = Duration::from_secs(120);
/// 等待 worker ready 信号的总超时
const READY_TIMEOUT: Duration = Duration::from_secs(30);

/// 持有 stdin/stdout 的原子 IO 对。
/// 通过单一 Mutex 保护，确保 write-then-read 不会被并发穿插。
struct BridgeIo {
    stdin: BufWriter<ChildStdin>,
    stdout: BufReader<ChildStdout>,
}

/// Python Worker 桥接
pub struct PythonBridge {
    _child: Child,
    io: Mutex<BridgeIo>,
}

impl PythonBridge {
    /// 启动 Python Worker 进程
    ///
    /// `python_dir`: python/ 目录的绝对路径
    /// 优先尝试 Sidecar 可执行文件，不存在则回退到 `python main.py`
    pub async fn spawn(python_dir: &PathBuf) -> Result<Self, AppError> {
        let sidecar_path = Self::find_sidecar(python_dir);

        let mut child = if let Some(sidecar) = sidecar_path {
            info!(path = %sidecar.display(), "使用 Sidecar 模式启动 Python Worker");
            Command::new(&sidecar)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| AppError::PythonBridge(format!("Sidecar 启动失败: {e}")))?
        } else {
            let main_py = python_dir.join("main.py");
            if !main_py.exists() {
                return Err(AppError::PythonBridge(format!(
                    "Python 入口不存在: {}",
                    main_py.display()
                )));
            }

            info!(path = %main_py.display(), "使用 Python 解释器启动 Worker");
            Command::new("python")
                .arg("-X")
                .arg("utf8")
                .arg("-u")
                .arg(&main_py)
                .current_dir(python_dir)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .env("PYTHONUNBUFFERED", "1")
                .env("PYTHONUTF8", "1")
                .env("PYTHONIOENCODING", "utf-8")
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| AppError::PythonBridge(format!("Python 进程启动失败: {e}")))?
        };

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::PythonBridge("获取 stdin 失败".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::PythonBridge("获取 stdout 失败".into()))?;
        if let Some(stderr) = child.stderr.take() {
            spawn_stderr_logger(stderr, "Python Worker");
        }

        let mut io = BridgeIo {
            stdin: BufWriter::new(stdin),
            stdout: BufReader::new(stdout),
        };

        // 等待 Worker 的 `ready` 信号
        wait_ready(&mut io).await?;

        info!("Python Worker 已就绪");
        Ok(Self {
            _child: child,
            io: Mutex::new(io),
        })
    }

    /// 发送请求并等待响应（写 + 读 原子执行，带总超时）
    pub async fn call(
        &self,
        command: &str,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value, AppError> {
        let request = WorkerRequest {
            command: command.to_string(),
            payload,
        };

        let request_json = serde_json::to_string(&request)
            .map_err(|e| AppError::PythonBridge(format!("序列化请求失败: {e}")))?;

        debug!(cmd = command, "发送请求到 Python Worker");

        // 整个 round-trip 持有同一把锁 — 防止并发调用穿插
        let mut io = self.io.lock().await;

        let response_line = timeout(CALL_TIMEOUT, async {
            io.stdin
                .write_all(format!("{request_json}\n").as_bytes())
                .await
                .map_err(|e| AppError::PythonBridge(format!("写入 stdin 失败: {e}")))?;
            io.stdin
                .flush()
                .await
                .map_err(|e| AppError::PythonBridge(format!("flush stdin 失败: {e}")))?;

            let mut line = String::new();
            let n = io
                .stdout
                .read_line(&mut line)
                .await
                .map_err(|e| AppError::PythonBridge(format!("读取 stdout 失败: {e}")))?;
            if n == 0 {
                return Err(AppError::PythonBridge(
                    "Python Worker stdout 已关闭，进程可能已退出".into(),
                ));
            }
            Ok::<_, AppError>(line)
        })
        .await
        .map_err(|_| {
            AppError::PythonBridge(format!(
                "Python Worker 调用超时（{}s）: {command}",
                CALL_TIMEOUT.as_secs()
            ))
        })??;

        let resp: WorkerResponse = serde_json::from_str(response_line.trim()).map_err(|e| {
            AppError::PythonBridge(format!(
                "解析响应失败: {e}, 原文: {}",
                truncate_chars(&response_line, 200)
            ))
        })?;

        if resp.success == Some(true) {
            Ok(resp.result.unwrap_or(serde_json::Value::Null))
        } else {
            let err_msg = resp.error.unwrap_or_else(|| "未知错误".into());
            warn!(error = %err_msg, "Python Worker 返回错误");
            Err(AppError::PythonBridge(err_msg))
        }
    }

    /// 心跳检测
    pub async fn is_alive(&self) -> bool {
        match self.call("ping", serde_json::json!({})).await {
            Ok(result) => result.get("pong").and_then(|v| v.as_bool()) == Some(true),
            Err(e) => {
                error!(error = %e, "Python Worker 心跳失败");
                false
            }
        }
    }

    /// 在 binaries/ 目录查找 Sidecar 可执行文件
    fn find_sidecar(python_dir: &PathBuf) -> Option<PathBuf> {
        let exe_suffix = if cfg!(windows) { ".exe" } else { "" };

        let mut candidate_dirs = Vec::new();

        if let Some(project_root) = python_dir.parent() {
            candidate_dirs.push(project_root.join("src-tauri").join("binaries"));
        }

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                candidate_dirs.push(exe_dir.to_path_buf());

                if let Some(contents_dir) = exe_dir.parent() {
                    candidate_dirs.push(contents_dir.join("Resources"));
                }
            }
        }

        for dir in candidate_dirs {
            if !dir.exists() {
                continue;
            }

            let entries = match std::fs::read_dir(&dir) {
                Ok(entries) => entries,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("another-me-worker") && name_str.ends_with(exe_suffix) {
                    let path = entry.path();
                    if path.is_file() {
                        debug!(path = %path.display(), "找到 Sidecar 可执行文件");
                        return Some(path);
                    }
                }
            }
        }

        None
    }
}

/// 等待 Worker 启动完成（读取 `{"ready": true}` 信号）
async fn wait_ready(io: &mut BridgeIo) -> Result<(), AppError> {
    timeout(READY_TIMEOUT, async {
        loop {
            let mut line = String::new();
            let n = io
                .stdout
                .read_line(&mut line)
                .await
                .map_err(|e| AppError::PythonBridge(format!("读取 ready 信号失败: {e}")))?;
            if n == 0 {
                return Err(AppError::PythonBridge(
                    "Python Worker stdout 已关闭，进程可能启动失败".into(),
                ));
            }

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            match serde_json::from_str::<WorkerResponse>(trimmed) {
                Ok(r) => {
                    if r.ready == Some(true) {
                        return Ok(());
                    }
                    if r.success == Some(false) {
                        let err = r.error.unwrap_or_else(|| "未知启动错误".to_string());
                        return Err(AppError::PythonBridge(format!(
                            "Python Worker 启动失败: {err}"
                        )));
                    }
                    warn!(?r, "跳过非 ready JSON 行");
                }
                Err(e) => {
                    warn!(
                        error = %e,
                        line = %trimmed.chars().take(120).collect::<String>(),
                        "解析 ready 行失败，跳过"
                    );
                }
            }
        }
    })
    .await
    .map_err(|_| {
        AppError::PythonBridge(format!(
            "等待 Python Worker ready 信号超时（{}s）",
            READY_TIMEOUT.as_secs()
        ))
    })?
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

fn spawn_stderr_logger(stderr: ChildStderr, source: &'static str) {
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr);
        loop {
            let mut line = String::new();
            match reader.read_line(&mut line).await {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        warn!(source = source, line = %trimmed, "子进程 stderr 输出");
                    }
                }
                Err(e) => {
                    warn!(source = source, error = %e, "读取子进程 stderr 失败");
                    break;
                }
            }
        }
    });
}

/// Python Worker 生命周期管理器（lazy start + 手动失效 + 自动重启）
///
/// 使用方式：
/// 1. `get_bridge()` 惰性拉起进程，之后复用同一个 Arc
/// 2. 调用方检测到 bridge 错误时，显式调用 `invalidate()` 丢弃当前 bridge
/// 3. 下一次 `get_bridge()` 会重新 spawn
pub struct PythonWorkerManager {
    python_dir: PathBuf,
    bridge: Arc<tokio::sync::RwLock<Option<Arc<PythonBridge>>>>,
    spawn_lock: Mutex<()>,
}

impl PythonWorkerManager {
    pub fn new(python_dir: PathBuf) -> Self {
        Self {
            python_dir,
            bridge: Arc::new(tokio::sync::RwLock::new(None)),
            spawn_lock: Mutex::new(()),
        }
    }

    /// 获取或启动 Worker
    pub async fn get_bridge(&self) -> Result<Arc<PythonBridge>, AppError> {
        // 快速路径：读锁检查
        {
            let guard = self.bridge.read().await;
            if let Some(ref bridge) = *guard {
                return Ok(Arc::clone(bridge));
            }
        }

        // 慢路径：spawn_lock 保证同一时刻只有一个任务在 spawn
        let _spawn_guard = self.spawn_lock.lock().await;

        // 二次检查（可能已被其它任务 spawn 完成）
        {
            let guard = self.bridge.read().await;
            if let Some(ref bridge) = *guard {
                return Ok(Arc::clone(bridge));
            }
        }

        info!("首次（或重启）启动 Python Worker...");
        let bridge = PythonBridge::spawn(&self.python_dir).await?;
        let arc = Arc::new(bridge);

        {
            let mut guard = self.bridge.write().await;
            *guard = Some(Arc::clone(&arc));
        }

        Ok(arc)
    }

    /// 丢弃当前 bridge，下次 get_bridge() 会重新 spawn
    pub async fn invalidate(&self) {
        let mut guard = self.bridge.write().await;
        if guard.is_some() {
            warn!("失效当前 Python Worker，下次调用将重启");
        }
        *guard = None;
    }
}
