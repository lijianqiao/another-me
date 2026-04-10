# 另一个我 — Another Me

> 本地化人生决策推演引擎：每个人生选择的背后，都有一条被放弃的时间线。

## 功能亮点

- **蝴蝶效应推演** — 输入你正在纠结的人生决定，AI 生成多条可能的时间线
- **因果链记忆** — 历史决策与锚定时间线会影响后续推演
- **决策树可视化** — D3.js 交互式分叉图，直观展示决策分支
- **人生走势图** — 职业、财务、健康、情感、满足感五维走势
- **自我进化** — 每次反馈都让引擎更懂你，画像持续修正
- **云端 + 本地** — 默认 Ollama 本地推理，可选 OpenAI / Anthropic / Qwen / DeepSeek / Gemini
- **完全本地化** — 数据存储在本机 SQLite，API Key 加密存储
- **双语支持** — 中文 / English 自由切换

## 技术栈

| 层         | 技术                                         |
|-----------|----------------------------------------------|
| 框架       | Tauri 2.x (Rust + WebView)                   |
| 前端       | React 19 + TypeScript + Zustand + Vite       |
| 可视化     | D3.js (决策树) + Recharts (走势图)             |
| AI 推理    | Ollama (本地) / OpenAI / Anthropic / Qwen / DeepSeek / Gemini |
| NLP 引擎   | Python 3.13 + jieba + snownlp + scikit-learn |
| 数据库     | SQLite (profiles / decisions / settings)      |
| 国际化     | i18next                                       |

## 快速开始

### 前置条件

- **Node.js** >= 20
- **pnpm** >= 10
- **Rust** >= 1.78 (via rustup)
- **Python** >= 3.12 + **uv** (包管理器)
- **Ollama** (本地推理引擎) — [下载](https://ollama.com)

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/lijianqiao/another-me.git
cd another-me

# 2. 安装前端依赖
pnpm install

# 3. 安装 Python NLP 依赖
cd python && uv pip install -e . && cd ..

# 4. 启动 Ollama 并下载推荐模型
ollama serve
ollama pull qwen3.5:4b

# 5. 启动开发模式
pnpm tauri dev
```

### 打包

```bash
# 打包 Python Worker
cd python && python build.py && cd ..

# 打包 Tauri 应用
pnpm tauri build
```

## 项目结构

```text
another-me/
├── src/                    # React 前端
│   ├── api/                # Tauri IPC 调用封装
│   ├── components/         # UI 组件
│   ├── pages/              # 页面
│   ├── store/              # Zustand 状态管理
│   ├── i18n/               # 国际化资源
│   └── utils/              # 前端工具函数
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── ai/             # AI 网关 (Ollama + 5 云端 Provider)
│       ├── commands/       # Tauri 命令层
│       ├── engines/        # 核心引擎 (蝴蝶效应/因果链/安全阀/自我进化)
│       ├── model_manager/  # 模型管理 (Ollama)
│       ├── python/         # Python Worker 桥接
│       ├── storage/        # SQLite 数据层
│       ├── types/          # 类型定义
│       └── utils/          # 工具函数
├── python/                 # Python NLP Worker
│   └── another_me/
│       └── nlp/            # TF-IDF 聚类 + 情感分析
├── docs/                   # 设计文档 (PRD / ARCH / DEV)
└── .github/workflows/      # CI/CD
```

## 许可证

MIT
