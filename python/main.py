"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: main.py
@DateTime: 2026-04-10
@Docs: Python Worker 入口 — stdin/stdout JSON 协议
"""

import json
import sys
import traceback

REQUIRED_PYTHON = (3, 14)


def configure_stdio() -> None:
    """强制 stdin/stdout/stderr 使用 UTF-8，避免 Windows 管道默认本地编码。"""
    for stream_name in ("stdin", "stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is not None and hasattr(stream, "reconfigure"):
            if stream_name != "stdin":
                stream.reconfigure(
                    encoding="utf-8",
                    errors="strict",
                    line_buffering=True,
                )
            else:
                stream.reconfigure(encoding="utf-8", errors="strict")


def read_request() -> dict:
    """从 stdin 读取一行 JSON 请求"""
    line = sys.stdin.readline()
    if not line:
        sys.exit(0)
    return json.loads(line.strip())


def write_response(response: dict) -> None:
    """向 stdout 写入一行 JSON 响应"""
    print(json.dumps(response, ensure_ascii=False), flush=True)


def validate_runtime() -> None:
    """启动前校验 Python 版本和核心依赖，失败时在 ready 前直接暴露。"""
    if sys.version_info < REQUIRED_PYTHON:
        major, minor = REQUIRED_PYTHON
        raise RuntimeError(
            f"Python Worker 需要 Python {major}.{minor}+，当前为 {sys.version_info.major}.{sys.version_info.minor}"
        )

    from another_me.nlp.clustering import cluster_narratives_tfidf  # noqa: F401
    from another_me.nlp.realism_factor import check_realism  # noqa: F401


def main():
    """
    主事件循环：持久化运行，每次读一行 JSON，分发到对应 handler，返回 JSON 结果。
    Rust 端通过 stdin/stdout 与此进程通信。
    """
    configure_stdio()

    try:
        validate_runtime()
    except Exception as exc:
        write_response(
            {
                "success": False,
                "error": f"Worker startup failed: {type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc(),
            }
        )
        return

    handlers = {
        "ping": ping_handler,
        "check_realism": check_realism_handler,
        "cluster_narratives": cluster_narratives_handler,
    }

    # 通知 Rust 端：Worker 已启动
    write_response({"ready": True})

    while True:
        try:
            request = read_request()
            cmd = request.get("command")
            payload = request.get("payload", {})

            if cmd not in handlers:
                write_response({"success": False, "error": f"未知命令: {cmd}"})
                continue

            result = handlers[cmd](payload)
            write_response({"success": True, "result": result})

        except json.JSONDecodeError as e:
            write_response({"success": False, "error": f"JSON 解析失败: {e}"})
        except Exception as e:
            write_response({"success": False, "error": f"{type(e).__name__}: {e}", "traceback": traceback.format_exc()})


def ping_handler(_payload: dict) -> dict:
    """心跳检测：确认 Python Worker 存活"""
    return {"pong": True}


def check_realism_handler(payload: dict) -> dict:
    """现实主义因子检查"""
    from another_me.nlp.realism_factor import check_realism

    narrative = payload["narrative"]
    return check_realism(narrative)


def cluster_narratives_handler(payload: dict) -> dict:
    """TF-IDF 文本聚类（Sprint 5 实现，此处预留接口）"""
    from another_me.nlp.clustering import cluster_narratives_tfidf

    narratives = payload["narratives"]
    k = payload.get("k", 3)
    indices = cluster_narratives_tfidf(narratives, k)
    return {"cluster_indices": indices}


if __name__ == "__main__":
    main()
