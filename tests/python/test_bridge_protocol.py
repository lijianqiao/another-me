"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: test_bridge_protocol.py
@DateTime: 2026-04-10
@Docs: Python Worker IPC 协议测试 — 模拟 Rust 端的 stdin/stdout 通信
"""

import json
import subprocess
import sys
from pathlib import Path


WORKER_PATH = str(Path(__file__).parent.parent.parent / "python" / "main.py")


def start_worker():
    """启动 Worker 进程"""
    proc = subprocess.Popen(
        [sys.executable, WORKER_PATH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=str(Path(WORKER_PATH).parent),
    )
    return proc


def send_and_recv(proc, command: str, payload: dict) -> dict:
    """发送请求并读取一行响应"""
    request = json.dumps({"command": command, "payload": payload})
    proc.stdin.write(request + "\n")
    proc.stdin.flush()
    line = proc.stdout.readline()
    return json.loads(line.strip())


def test_ready_signal():
    """Worker 启动后应发送 ready 信号"""
    proc = start_worker()
    try:
        ready = proc.stdout.readline()
        data = json.loads(ready.strip())
        assert data.get("ready") is True, f"期望 ready=true，实际: {data}"
        print("  ready 信号正确")
    finally:
        proc.kill()


def test_ping():
    """ping 命令应返回 pong"""
    proc = start_worker()
    try:
        proc.stdout.readline()  # 跳过 ready
        resp = send_and_recv(proc, "ping", {})
        assert resp["success"] is True
        assert resp["result"]["pong"] is True
        print("  ping/pong 正常")
    finally:
        proc.kill()


def test_unknown_command():
    """未知命令应返回错误"""
    proc = start_worker()
    try:
        proc.stdout.readline()
        resp = send_and_recv(proc, "nonexistent", {})
        assert resp["success"] is False
        assert "未知命令" in resp.get("error", "")
        print(f"  未知命令: {resp['error']}")
    finally:
        proc.kill()


def test_cluster_narratives():
    """聚类命令端到端测试"""
    proc = start_worker()
    try:
        proc.stdout.readline()
        payload = {
            "narratives": [
                "他创业成功了",
                "他在公司稳步升迁",
                "她出国深造获得学位",
                "他也创业了但失败了",
                "她也选择了出国留学",
            ],
            "k": 3,
        }
        resp = send_and_recv(proc, "cluster_narratives", payload)
        assert resp["success"] is True, f"聚类失败: {resp}"
        indices = resp["result"]["cluster_indices"]
        assert len(indices) == 3
        assert len(set(indices)) == 3
        print(f"  聚类结果: {indices}")
    finally:
        proc.kill()


def test_check_realism():
    """现实主义校验端到端测试"""
    proc = start_worker()
    try:
        proc.stdout.readline()
        payload = {
            "narrative": "他辞职创业，起初困难，后来成功了。但也经历了健康危机。"
        }
        resp = send_and_recv(proc, "check_realism", payload)
        assert resp["success"] is True, f"校验失败: {resp}"
        assert "status" in resp["result"]
        print(f"  现实主义校验: {resp['result']['status']}")
    finally:
        proc.kill()


if __name__ == "__main__":
    tests = [
        test_ready_signal,
        test_ping,
        test_unknown_command,
        test_cluster_narratives,
        test_check_realism,
    ]

    passed = 0
    failed = 0
    for test in tests:
        name = test.__name__
        try:
            test()
            print(f"  PASS {name}")
            passed += 1
        except Exception as e:
            print(f"  FAIL {name}: {e}")
            failed += 1

    print(f"\n结果: {passed} 通过, {failed} 失败")
    sys.exit(1 if failed > 0 else 0)
