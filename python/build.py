"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: build.py
@DateTime: 2026-04-10
@Docs: Nuitka 打包脚本，将 Python Worker 打包为独立可执行文件供 Tauri Sidecar 调用
"""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    """执行 Nuitka 打包"""
    root = Path(__file__).parent
    entry = root / "main.py"

    suffix = ".exe" if platform.system() == "Windows" else ""
    # 构建目标目录
    dist_dir = root.parent / "src-tauri" / "binaries"
    dist_dir.mkdir(parents=True, exist_ok=True)

    # 检测当前平台三元组（Tauri 要求 sidecar 以 <name>-<target> 命名）
    target_triple = _detect_target_triple()
    output_name = f"another-me-worker-{target_triple}"

    cmd = [
        sys.executable,
        "-m",
        "nuitka",
        "--onefile",
        "--standalone",
        # 包含项目自身包
        "--include-package=another_me",
        # CI 无交互，自动同意下载
        "--assume-yes-for-downloads",
        # 排除不需要的模块以减小体积
        "--noinclude-pytest-mode=nofollow",
        "--noinclude-setuptools-mode=nofollow",
        # 输出目录
        f"--output-dir={root / 'nuitka_build'}",
        # 输出文件名
        f"--output-filename={output_name}{suffix}",
        # 删除上次构建缓存
        "--remove-output",
    ]

    if platform.system() == "Windows":
        # CI (windows-latest) 有 MSVC；本地开发如无 MSVC 则回退 Zig
        if _has_msvc():
            cmd.append("--msvc=latest")
        else:
            cmd.append("--zig")
        cmd.append("--windows-console-mode=disable")

    cmd.append(str(entry))

    _print_status(f"Nuitka build: {' '.join(cmd)}")
    subprocess.run(cmd, check=True, cwd=str(root))

    # 将产物复制到 Tauri binaries 目录
    built = root / "nuitka_build" / f"{output_name}{suffix}"
    dest = dist_dir / f"{output_name}{suffix}"
    shutil.copy2(str(built), str(dest))
    _print_status(f"Output: {dest} ({dest.stat().st_size / 1024 / 1024:.1f} MB)")


def _has_msvc() -> bool:
    """检测系统是否安装了 MSVC (cl.exe)"""
    try:
        result = subprocess.run(["where", "cl"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    # 检查常见 VS 路径
    vs_paths = [
        Path(os.environ.get("ProgramFiles", "")) / "Microsoft Visual Studio",
        Path(os.environ.get("ProgramFiles(x86)", "")) / "Microsoft Visual Studio",
    ]
    for vs in vs_paths:
        if vs.exists():
            return True
    return False


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
