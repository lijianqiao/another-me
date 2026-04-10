/**
 * 决策录入表单
 * 文本框 + 时间跨度 + 戏剧化滑块 + 黑天鹅开关 + 提交
 */
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import DramaSlider from "./DramaSlider";
import { useSettingsStore } from "../../store";
import { getEvolutionInfo } from "../../api/feedback";
import type { SimulateInput, TimeHorizon } from "../../types";

interface Props {
  onSubmit: (input: SimulateInput) => void;
  disabled?: boolean;
}

export default function DecisionInput({ onSubmit, disabled }: Props) {
  const { t } = useTranslation();
  const settingsDrama = useSettingsStore((s) => s.settings.drama_level);
  const settingsBlackSwan = useSettingsStore(
    (s) => s.settings.black_swan_enabled,
  );

  const [text, setText] = useState("");
  const [context, setContext] = useState("");
  const [horizon, setHorizon] = useState<TimeHorizon>("3y");
  const [drama, setDrama] = useState(settingsDrama || 1);
  const [blackSwan, setBlackSwan] = useState(settingsBlackSwan);
  const [maxDrama, setMaxDrama] = useState(2);

  useEffect(() => {
    setDrama(settingsDrama || 1);
  }, [settingsDrama]);

  useEffect(() => {
    setBlackSwan(settingsBlackSwan);
  }, [settingsBlackSwan]);

  useEffect(() => {
    getEvolutionInfo()
      .then((info) => setMaxDrama(info.max_drama_level))
      .catch(() => setMaxDrama(2));
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit({
      decision_text: text.trim(),
      context: context.trim() || undefined,
      time_horizon: horizon,
      drama_level: drama as 1 | 2 | 3 | 4,
      black_swan_enabled: blackSwan,
    });
  };

  return (
    <form className="decision-input" onSubmit={handleSubmit}>
      <div className="decision-input__main">
        <label className="decision-input__label">
          {t("simulate.decision_label")}
        </label>
        <textarea
          className="decision-input__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("simulate.decision_placeholder")}
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="decision-input__context">
        <label className="decision-input__label">
          {t("simulate.context_label")}
        </label>
        <textarea
          className="decision-input__textarea decision-input__textarea--sm"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={t("simulate.context_placeholder")}
          rows={2}
          disabled={disabled}
        />
      </div>

      <div className="decision-input__row">
        <div className="decision-input__horizon">
          <label className="decision-input__label">
            {t("simulate.horizon_label")}
          </label>
          <div className="horizon-chips">
            {(["1y", "3y", "5y", "10y"] as TimeHorizon[]).map((h) => (
              <button
                key={h}
                type="button"
                className={`horizon-chip ${h === horizon ? "horizon-chip--active" : ""}`}
                onClick={() => setHorizon(h)}
                disabled={disabled}
              >
                {h.replace("y", ` ${t("simulate.year")}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DramaSlider value={drama} onChange={setDrama} maxLevel={maxDrama} />

      <label className="decision-input__toggle">
        <input
          type="checkbox"
          checked={blackSwan}
          onChange={(e) => setBlackSwan(e.target.checked)}
          disabled={disabled}
        />
        <span>{t("simulate.black_swan")}</span>
        <span className="decision-input__toggle-hint">
          {t("simulate.black_swan_hint")}
        </span>
      </label>

      <button
        type="submit"
        className="btn btn--primary decision-input__submit"
        disabled={disabled || !text.trim()}
      >
        {disabled ? t("common.loading") : t("simulate.start")}
      </button>
    </form>
  );
}
