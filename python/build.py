"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: build.py
@DateTime: 2026-04-10
@Docs: PyInstaller 打包脚本，将 Python Worker 打包为独立可执行文件供 Tauri Sidecar 调用
"""

import os
import platform
import subprocess
import sys
from pathlib import Path


def main():
    """执行 PyInstaller 打包"""
    root = Path(__file__).parent
    entry = root / "main.py"

    suffix = ".exe" if platform.system() == "Windows" else ""
    # 构建目标目录
    dist_dir = root.parent / "src-tauri" / "binaries"
    dist_dir.mkdir(parents=True, exist_ok=True)

    # 检测当前平台三元组（Tauri 要求 sidecar 以 <name>-<target> 命名）
    target_triple = _detect_target_triple()

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onefile",
        "--name",
        f"another-me-worker-{target_triple}",
        "--distpath",
        str(dist_dir),
        "--clean",
        "--noconfirm",
        str(entry),
    ]

    _print_status(f"执行打包: {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=str(root))
    _print_status(f"打包完成: {dist_dir / f'another-me-worker-{target_triple}'}{suffix}")


def _print_status(message: str) -> None:
    """Print status text without assuming the console supports UTF-8."""
    text = f"{message}\n"
    stream = sys.stdout
    encoding = getattr(stream, "encoding", None) or "utf-8"

    if hasattr(stream, "buffer"):
        stream.buffer.write(text.encode(encoding, errors="backslashreplace"))
        stream.buffer.flush()
        return

    stream.write(text.encode(encoding, errors="backslashreplace").decode(encoding))
    stream.flush()


def _detect_target_triple() -> str:
    """检测当前平台的 Rust target triple"""
    override = os.environ.get("ANOTHER_ME_TARGET_TRIPLE")
    if override:
        return override

    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "windows":
        if machine in ("amd64", "x86_64"):
            return "x86_64-pc-windows-msvc"
        elif machine in ("arm64", "aarch64"):
            return "aarch64-pc-windows-msvc"
    elif system == "darwin":
        if machine == "arm64":
            return "aarch64-apple-darwin"
        else:
            return "x86_64-apple-darwin"
    elif system == "linux":
        if machine in ("x86_64", "amd64"):
            return "x86_64-unknown-linux-gnu"
        elif machine in ("aarch64", "arm64"):
            return "aarch64-unknown-linux-gnu"

    # 降级使用 rustc 获取
    try:
        result = subprocess.run(["rustc", "-vV"], capture_output=True, text=True, check=True)
        for line in result.stdout.splitlines():
            if line.startswith("host:"):
                return line.split(":")[1].strip()
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass

    return f"{machine}-unknown-{system}"


if __name__ == "__main__":
    main()
