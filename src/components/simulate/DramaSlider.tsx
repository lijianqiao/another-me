/**
 * 戏剧化档位滑块
 * 4 档可选，每档显示说明文案（i18n）
 */
import { useTranslation } from "react-i18next";

interface Props {
  value: number;
  onChange: (v: number) => void;
  maxLevel?: number;
}

export default function DramaSlider({ value, onChange, maxLevel = 4 }: Props) {
  const { t } = useTranslation();

  return (
    <div className="drama-slider">
      <div className="drama-slider__header">
        <span className="drama-slider__label">{t("simulate.drama_title")}</span>
        <span className="drama-slider__value">
          {t(`simulate.drama_tick_${value}`, { defaultValue: "—" })}
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
            role="presentation"
          >
            {t(`simulate.drama_tick_${level}`)}
          </span>
        ))}
      </div>
      <p className="drama-slider__desc">
        {t(`simulate.drama_desc_${value}`, { defaultValue: "" })}
      </p>
    </div>
  );
}
