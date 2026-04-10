//! Python 进程桥接
//!
//! 通过 `tokio::process::Command` 启动持久化 Python Worker，
//! 使用 stdin/stdout JSON 协议通信。对应 ARCH 7.1。
//!
//! Sprint 2：使用本地 Python 运行。
//! Sprint 4：支持 Sidecar 模式（PyInstaller 打包的可执行文件）。
//! 优先级：Sidecar > 本地 Python。

use std::path::PathBuf;
use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

use crate::python::protocol::{WorkerRequest, WorkerResponse};
use crate::types::error::AppError;

type ChildStdin = BufWriter<tokio::process::ChildStdin>;
type ChildStdout = BufReader<tokio::process::ChildStdout>;

/// Python Worker 桥接
pub struct PythonBridge {
    _child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    stdout: Arc<Mutex<ChildStdout>>,
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
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| {
                    AppError::PythonBridge(format!(
                        "Sidecar 启动失败: {e}"
                    ))
                })?
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
                .arg(&main_py)
                .current_dir(python_dir)
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .kill_on_drop(true)
                .spawn()
                .map_err(|e| {
                    AppError::PythonBridge(format!(
                        "Python 进程启动失败: {e}"
                    ))
                })?
        };

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| AppError::PythonBridge("获取 stdin 失败".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| AppError::PythonBridge("获取 stdout 失败".into()))?;

        let bridge = Self {
            _child: child,
            stdin: Arc::new(Mutex::new(BufWriter::new(stdin))),
            stdout: Arc::new(Mutex::new(BufReader::new(stdout))),
        };

        // 等待 Worker 的 `ready` 信号
        bridge.wait_ready().await?;

        info!("Python Worker 已就绪");
        Ok(bridge)
    }

    /// 等待 Worker 启动完成（读取 `{"ready": true}` 信号）
    async fn wait_ready(&self) -> Result<(), AppError> {
        let mut stdout = self.stdout.lock().await;
        let mut line = String::new();
        stdout.read_line(&mut line).await.map_err(|e| {
            AppError::PythonBridge(format!("读取 ready 信号失败: {e}"))
        })?;

        let resp: WorkerResponse =
            serde_json::from_str(line.trim()).map_err(|e| {
                AppError::PythonBridge(format!(
                    "解析 ready 信号失败: {e}, 原文: {line}"
                ))
            })?;

        if resp.ready != Some(true) {
            return Err(AppError::PythonBridge(format!(
                "Worker 未发出 ready 信号: {line}"
            )));
        }

        Ok(())
    }

    /// 发送请求并等待响应
    pub async fn call(
        &self,
        command: &str,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value, AppError> {
        let request = WorkerRequest {
            command: command.to_string(),
            payload,
        };

        let request_json = serde_json::to_string(&request).map_err(|e| {
            AppError::PythonBridge(format!("序列化请求失败: {e}"))
        })?;

        debug!(cmd = command, "发送请求到 Python Worker");

        // 写入请求
        {
            let mut stdin = self.stdin.lock().await;
            stdin
                .write_all(format!("{request_json}\n").as_bytes())
                .await
                .map_err(|e| {
                    AppError::PythonBridge(format!("写入 stdin 失败: {e}"))
                })?;
            stdin.flush().await.map_err(|e| {
                AppError::PythonBridge(format!("flush stdin 失败: {e}"))
            })?;
        }

        // 读取响应
        let response_line = {
            let mut stdout = self.stdout.lock().await;
            let mut line = String::new();
            stdout.read_line(&mut line).await.map_err(|e| {
                AppError::PythonBridge(format!("读取 stdout 失败: {e}"))
            })?;
            line
        };

        let resp: WorkerResponse =
            serde_json::from_str(response_line.trim()).map_err(|e| {
                AppError::PythonBridge(format!(
                    "解析响应失败: {e}, 原文: {}",
                    &response_line[..response_line.len().min(200)]
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
            Ok(result) => {
                result.get("pong").and_then(|v| v.as_bool()) == Some(true)
            }
            Err(e) => {
                error!(error = %e, "Python Worker 心跳失败");
                false
            }
        }
    }

    /// 在 binaries/ 目录查找 Sidecar 可执行文件
    fn find_sidecar(python_dir: &PathBuf) -> Option<PathBuf> {
        let binaries_dir = python_dir
            .parent()?      // 项目根目录
            .join("src-tauri")
            .join("binaries");

        if !binaries_dir.exists() {
            return None;
        }

        let exe_suffix = if cfg!(windows) { ".exe" } else { "" };

        let entries = std::fs::read_dir(&binaries_dir).ok()?;
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

        None
    }
}

/// Python Worker 生命周期管理器（lazy start + 自动重启）
pub struct PythonWorkerManager {
    python_dir: PathBuf,
    bridge: Arc<tokio::sync::RwLock<Option<Arc<PythonBridge>>>>,
}

impl PythonWorkerManager {
    pub fn new(python_dir: PathBuf) -> Self {
        Self {
            python_dir,
            bridge: Arc::new(tokio::sync::RwLock::new(None)),
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

        // 慢路径：需要启动
        let mut guard = self.bridge.write().await;
        if guard.is_none() {
            info!("首次启动 Python Worker...");
            let bridge =
                PythonBridge::spawn(&self.python_dir).await?;
            *guard = Some(Arc::new(bridge));
        }

        Ok(Arc::clone(guard.as_ref().unwrap()))
    }
}
