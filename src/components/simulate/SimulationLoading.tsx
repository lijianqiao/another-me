/**
 * 推演加载动画
 * 进度环 + 步骤文案
 */

interface Props {
  message?: string;
}

const TIPS = [
  "正在构建你的平行时空...",
  "推演引擎正在工作中...",
  "正在计算蝴蝶效应...",
  "每个选择都通向不同的未来...",
];

export default function SimulationLoading({ message }: Props) {
  const tip = message || TIPS[Math.floor(Math.random() * TIPS.length)];

  return (
    <div className="sim-loading">
      <div className="sim-loading__ring">
        <svg viewBox="0 0 100 100" className="sim-loading__svg">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="264"
            strokeDashoffset="66"
            className="sim-loading__arc"
          />
        </svg>
      </div>
      <p className="sim-loading__text">{tip}</p>
      <p className="sim-loading__hint">
        推演通常需要 30-120 秒，取决于本地模型性能
      </p>
    </div>
  );
}
