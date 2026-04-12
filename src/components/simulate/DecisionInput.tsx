/**
 * 决策录入表单
 * 文本框 + 时间跨度 + 戏剧化滑块 + 黑天鹅开关 + 提交
 */
import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Send, Clock, Info } from "lucide-react";

import DramaSlider from "./DramaSlider";
import { useSettingsStore } from "../../store";
import { getEvolutionInfo } from "../../api/feedback";
import type { SimulateInput, TimeHorizon } from "../../types";

import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Card } from "../ui/card";

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
    <Card className="p-6 md:p-8 backdrop-blur-xl bg-card/60 shadow-lg border-border/50">
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* Core Decision */}
        <div className="flex flex-col gap-3">
          <Label className="text-base font-semibold tracking-wide text-foreground">
            {t("simulate.decision_label")}
          </Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("simulate.decision_placeholder")}
            rows={3}
            disabled={disabled}
            className="resize-none text-base bg-background/50 focus-visible:ring-primary/40 focus-visible:bg-background transition-all shadow-inner"
          />
        </div>

        {/* Context (Optional) */}
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Info className="h-4 w-4" />
            {t("simulate.context_label")}
          </Label>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={t("simulate.context_placeholder")}
            rows={2}
            disabled={disabled}
            className="resize-none text-sm bg-background/30"
          />
        </div>

        {/* Time Horizon & Drama */}
        <div className="grid gap-8 md:grid-cols-2 mt-2">
          {/* Horizon Selection */}
          <div className="flex flex-col gap-4">
            <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              {t("simulate.horizon_label")}
            </Label>
            <div className="flex flex-wrap gap-3">
              {(["1y", "3y", "5y", "10y"] as TimeHorizon[]).map((h) => (
                <Button
                  key={h}
                  type="button"
                  variant={h === horizon ? "default" : "outline"}
                  className={`flex-1 min-w-[70px] transition-all font-mono shadow-sm ${h === horizon ? "bg-primary text-primary-foreground" : ""}`}
                  onClick={() => setHorizon(h)}
                  disabled={disabled}
                >
                  {h.replace("y", ` ${t("simulate.year")}`)}
                </Button>
              ))}
            </div>

            {/* Black Swan Switch */}
            <div className="mt-4 flex items-start space-x-3 rounded-lg border border-border/40 p-4 bg-muted/20">
              <Switch
                id="blackswan-toggle"
                checked={blackSwan}
                onCheckedChange={setBlackSwan}
                disabled={disabled}
                className="data-[state=checked]:bg-amber-500"
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="blackswan-toggle" className="font-semibold text-foreground cursor-pointer">
                  {t("simulate.black_swan")}
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("simulate.black_swan_hint")}
                </p>
              </div>
            </div>
          </div>

          {/* Drama Slider */}
          <div className="flex flex-col flex-1 pl-0 md:pl-4 md:border-l md:border-border/30">
            <DramaSlider value={drama} onChange={setDrama} maxLevel={maxDrama} />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-6 border-t border-border/30 flex justify-end">
          <Button
            type="submit"
            size="lg"
            className="w-full md:w-auto px-10 text-base tracking-widest shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] font-semibold"
            disabled={disabled || !text.trim()}
          >
            {disabled ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                {t("common.loading")}...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {t("simulate.start")}
              </span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
