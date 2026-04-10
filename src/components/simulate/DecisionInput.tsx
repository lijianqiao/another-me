/**
 * 决策录入表单
 * 文本框 + 时间跨度 + 戏剧化滑块 + 提交
 */
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import DramaSlider from "./DramaSlider";
import type { SimulateInput, TimeHorizon } from "../../types";

interface Props {
  onSubmit: (input: SimulateInput) => void;
  disabled?: boolean;
}

export default function DecisionInput({ onSubmit, disabled }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [horizon, setHorizon] = useState<TimeHorizon>("3y");
  const [drama, setDrama] = useState(1);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit({
      decision_text: text.trim(),
      context: context.trim() || undefined,
      time_horizon: horizon,
      drama_level: drama as 1 | 2 | 3 | 4,
      black_swan_enabled: false,
    });
  };

  return (
    <form className="decision-input" onSubmit={handleSubmit}>
      <div className="decision-input__main">
        <label className="decision-input__label">
          你正在纠结什么决定？
        </label>
        <textarea
          className="decision-input__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：要不要辞职去创业？"
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="decision-input__context">
        <label className="decision-input__label">
          补充背景（可选）
        </label>
        <textarea
          className="decision-input__textarea decision-input__textarea--sm"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="有什么额外背景信息？例如：有 3 年工作经验，积蓄 20 万"
          rows={2}
          disabled={disabled}
        />
      </div>

      <div className="decision-input__row">
        <div className="decision-input__horizon">
          <label className="decision-input__label">推演时长</label>
          <div className="horizon-chips">
            {(["1y", "3y", "5y", "10y"] as TimeHorizon[]).map((h) => (
              <button
                key={h}
                type="button"
                className={`horizon-chip ${h === horizon ? "horizon-chip--active" : ""}`}
                onClick={() => setHorizon(h)}
                disabled={disabled}
              >
                {h.replace("y", " 年")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DramaSlider value={drama} onChange={setDrama} maxLevel={2} />

      <button
        type="submit"
        className="btn btn--primary decision-input__submit"
        disabled={disabled || !text.trim()}
      >
        {disabled ? t("common.loading") : "开始推演"}
      </button>
    </form>
  );
}
