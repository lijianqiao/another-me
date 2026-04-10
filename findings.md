# 调查与发现 (Findings)

## UI 现状分析
1. 当前样式过度依赖 `src/App.css` 的全局标签选择器和简单类名，容易产生样式冲突，且难以维护复杂的暗黑模式/主题切换。
2. 背景色 `#fafafa` 和边框色 `#eaeaea` 等浅色系让产品气质偏向后台管理系统，而非 ToC 的人生推演引擎。
3. 没有响应式设计和统一的间距、色彩设计系统 (Design System)。

## 设计选型决策
- 框架：**Tailwind CSS** (用于原子化样式) + **shadcn/ui** (用于高质量且可控的基础组件，如 Button、Dialog、Select、Slider)。
- 图标：可选用 **Lucide React** (shadcn 默认搭配) 替换现有简陋图标。
- 动画：复杂的 DOM 动画可以使用 **Framer Motion**（如果需要），简单的打字机或悬浮效果直接使用 Tailwind/CSS Animation。

## 重点重构模块思路
- `AppShell.tsx`: 需要添加 `<main className="container max-w-5xl mx-auto flex-1 ...">` 这样的约束容器。
- `DecisionTree.tsx`: D3 代码需要抽离样式属性，利用 Tailwind 或 CSS 变量给 SVG 元素上色，使用 `filter: drop-shadow(...)` 替代 SVG 内置滤镜提高性能和适配性。
- `FutureLetter.tsx`: 文字打字机效果可以通过 React state + `setTimeout` 逐字输出，或者简单的纯 CSS `steps()` 关键帧动画实现。