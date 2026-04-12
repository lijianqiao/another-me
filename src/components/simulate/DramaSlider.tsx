/**
 * 戏剧化档位滑块
 * 4 档可选，每档显示说明文案（i18n）
 */
import { useTranslation } from "react-i18next";
import { Slider } from "../ui/slider";

interface Props {
  value: number;
  onChange: (v: number) => void;
  maxLevel?: number;
}

export default function DramaSlider({ value, onChange, maxLevel = 4 }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground tracking-wide">{t("simulate.drama_title")}</span>
        <span className="text-sm font-semibold text-primary px-3 py-1 bg-primary/10 rounded-full font-mono">
          {t(`simulate.drama_tick_${value}`, { defaultValue: "—" })}
        </span>
      </div>

      <div className="px-2 py-4">
        <Slider
          defaultValue={[value]}
          value={[value]}
          min={1}
          max={maxLevel}
          step={1}
          onValueChange={(vals) => onChange(vals[0])}
          className="cursor-pointer"
        />
      </div>

      <div className="flex justify-between px-1">
        {Array.from({ length: maxLevel }, (_, i) => i + 1).map((level) => (
          <span
            key={level}
            className={`text-xs transition-colors cursor-pointer ${level === value ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            onClick={() => onChange(level)}
            role="presentation"
          >
            {t(`simulate.drama_tick_${level}`)}
          </span>
        ))}
      </div>

      <p className="text-sm text-muted-foreground/80 mt-2 bg-muted/30 p-3 rounded-lg leading-relaxed mix-blend-multiply dark:mix-blend-screen">
        {t(`simulate.drama_desc_${value}`, { defaultValue: "" })}
      </p>
    </div>
  );
}
