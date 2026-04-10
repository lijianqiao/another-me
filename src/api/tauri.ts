/**
 * Tauri invoke 基础封装
 *
 * 统一入口：
 *   - 所有后端命令必须通过本文件的 `invokeCommand` 调用，禁止直接 import
 *     `@tauri-apps/api/core`，以便后续加统一错误处理 / 日志 / 重试。
 *   - Rust 侧命令签名约定：`Result<T, String>`，因此 invoke 的 reject
 *     payload 一定是 string。
 */

import { invoke } from "@tauri-apps/api/core";

export class CommandError extends Error {
  constructor(
    public readonly command: string,
    message: string,
  ) {
    super(`[${command}] ${message}`);
    this.name = "CommandError";
  }
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    const msg = typeof err === "string" ? err : JSON.stringify(err);
    throw new CommandError(command, msg);
  }
}
