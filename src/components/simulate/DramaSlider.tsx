/**
 * 戏剧化档位滑块
 * 4 档可选，每档显示说明文案
 */

const DRAMA_LABELS: Record<number, { label: string; desc: string }> = {
  1: { label: "平稳", desc: "90% 真实平淡的日常，偶有小波折" },
  2: { label: "适度", desc: "合理波动 + 偶发意外事件" },
  3: { label: "戏剧", desc: "明显转折 + 大起大落" },
  4: { label: "极端", desc: "命运性转折，完全不同的人生" },
};

interface Props {
  value: number;
  onChange: (v: number) => void;
  maxLevel?: number;
}

export default function DramaSlider({ value, onChange, maxLevel = 2 }: Props) {
  return (
    <div className="drama-slider">
      <div className="drama-slider__header">
        <span className="drama-slider__label">戏剧化程度</span>
        <span className="drama-slider__value">
          {DRAMA_LABELS[value]?.label ?? "未知"}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={maxLevel}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="drama-slider__range"
      />
      <div className="drama-slider__ticks">
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map((level) => (
          <span
            key={level}
            className={`drama-slider__tick ${level === value ? "drama-slider__tick--active" : ""}`}
            onClick={() => onChange(level)}
          >
            {DRAMA_LABELS[level]?.label}
          </span>
        ))}
      </div>
      <p className="drama-slider__desc">{DRAMA_LABELS[value]?.desc}</p>
    </div>
  );
}
