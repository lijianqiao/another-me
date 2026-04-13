#!/usr/bin/env node
/**
 * 统一版本号同步脚本
 *
 * 用法：
 *   node scripts/bump-version.mjs 1.0.1
 *
 * 会同时更新以下文件中的版本号：
 *   - package.json
 *   - src-tauri/Cargo.toml
 *   - src-tauri/tauri.conf.json
 *   - python/pyproject.toml
 *   - python/uv.lock
 *   - python/another_me_worker.egg-info/PKG-INFO
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── 参数校验 ────────────────────────────────────────────────
const newVersion = process.argv[2];

if (!newVersion) {
    console.error("用法: node scripts/bump-version.mjs <version>");
    console.error("示例: node scripts/bump-version.mjs 1.0.1");
    process.exit(1);
}

if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
    console.error(`无效的版本号: ${newVersion}`);
    console.error("版本号必须符合 semver 格式，例如 1.0.1 或 1.2.0-beta.1");
    process.exit(1);
}

// ── 工具函数 ────────────────────────────────────────────────
function rel(p) {
    return resolve(ROOT, p);
}

function read(p) {
    return readFileSync(rel(p), "utf8");
}

function write(p, content) {
    writeFileSync(rel(p), content, "utf8");
}

function replaceOnce(content, pattern, replacement, fileLabel) {
    const match = content.match(pattern);
    if (!match) {
        console.warn(`  ⚠ 未找到版本字段: ${fileLabel}`);
        return content;
    }
    return content.replace(pattern, replacement);
}

// ── 逐文件更新 ──────────────────────────────────────────────
const results = [];

// 1. package.json
{
    const file = "package.json";
    const obj = JSON.parse(read(file));
    const old = obj.version;
    obj.version = newVersion;
    write(file, JSON.stringify(obj, null, 2) + "\n");
    results.push({ file, old, new: newVersion });
}

// 2. src-tauri/tauri.conf.json
{
    const file = "src-tauri/tauri.conf.json";
    const obj = JSON.parse(read(file));
    const old = obj.version;
    obj.version = newVersion;
    write(file, JSON.stringify(obj, null, 2) + "\n");
    results.push({ file, old, new: newVersion });
}

// 3. src-tauri/Cargo.toml
{
    const file = "src-tauri/Cargo.toml";
    let content = read(file);
    const old = content.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? "?";
    content = replaceOnce(
        content,
        /^(version\s*=\s*)"[^"]+"$/m,
        `$1"${newVersion}"`,
        file
    );
    write(file, content);
    results.push({ file, old, new: newVersion });
}

// 4. python/pyproject.toml
{
    const file = "python/pyproject.toml";
    let content = read(file);
    const old = content.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? "?";
    content = replaceOnce(
        content,
        /^(version\s*=\s*)"[^"]+"$/m,
        `$1"${newVersion}"`,
        file
    );
    write(file, content);
    results.push({ file, old, new: newVersion });
}

// 5. python/uv.lock (package version, not requires-python)
{
    const file = "python/uv.lock";
    if (existsSync(rel(file))) {
        let content = read(file);
        const old =
            content.match(
                /\[\[package\]\]\nname = "another-me-worker"\nversion = "([^"]+)"/
            )?.[1] ?? "?";
        content = content.replace(
            /(\[\[package\]\]\nname = "another-me-worker"\nversion = )"[^"]+"/,
            `$1"${newVersion}"`
        );
        write(file, content);
        results.push({ file, old, new: newVersion });
    }
}

// 6. python/another_me_worker.egg-info/PKG-INFO
{
    const file = "python/another_me_worker.egg-info/PKG-INFO";
    if (existsSync(rel(file))) {
        let content = read(file);
        const old = content.match(/^Version:\s*(.+)$/m)?.[1]?.trim() ?? "?";
        content = replaceOnce(
            content,
            /^(Version:\s*).+$/m,
            `$1${newVersion}`,
            file
        );
        write(file, content);
        results.push({ file, old, new: newVersion });
    }
}

// ── 结果汇总 ────────────────────────────────────────────────
console.log(`\n版本同步完成: ${newVersion}\n`);
console.log("文件".padEnd(48) + "旧版本".padEnd(12) + "新版本");
console.log("-".repeat(68));
for (const r of results) {
    console.log(r.file.padEnd(48) + r.old.padEnd(12) + r.new);
}
console.log(
    `\n下一步: git add -A && git commit -m "chore: bump version to ${newVersion}"`,
);
