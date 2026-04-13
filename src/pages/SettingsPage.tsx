/**
 * 设置页面
 *
 * Sprint 4：完整实现
 *  - Ollama 连通状态检测
 *  - 模型选择
 *  - 语言切换
 *  - 戏剧化默认档位
 *  - 黑天鹅开关
 *  - 安全 阀开关
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { checkOllamaStatus, type OllamaStatus } from "../api/settings";
import { useSettingsStore, useUiStore } from "../store";
import { Switch } from "../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const pushToast = useUiStore((s) => s.pushToast);

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const doCheckOllama = useCallback(async () => {
    setChecking(true);
    try {
      const status = await checkOllamaStatus();
      setOllamaStatus(status);
    } catch {
      setOllamaStatus(null);
      pushToast("error", t("settings.ollama_check_fail"));
    } finally {
      setChecking(false);
    }
  }, [pushToast, t]);

  useEffect(() => {
    void doCheckOllama();
  }, [doCheckOllama]);

  const handleLanguageChange = async (lang: string) => {
    await update({ language: lang });
    void i18n.changeLanguage(lang);
  };

  return (
    <section className="space-y-8 p-6 max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.settings")}</h2>

      {/* Ollama 状态 */}
      <div className="space-y-4 pb-6 border-b border-border last:border-0">
        <h3 className="text-lg font-semibold tracking-tight">
          {t("settings.ollama_title")}
        </h3>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-medium text-foreground tracking-wide min-w-max">
              {t("settings.ollama_status")}
            </span>
            <div className="flex items-center gap-3">
              {ollamaStatus ? (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    ollamaStatus.running
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {ollamaStatus.running
                    ? t("settings.ollama_running")
                    : t("settings.ollama_offline")}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                  {checking ? t("common.loading") : "—"}
                </span>
              )}
              <button
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                onClick={doCheckOllama}
                disabled={checking}
              >
                {t("settings.ollama_refresh")}
              </button>
            </div>
          </div>

          {ollamaStatus?.running && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-medium text-foreground tracking-wide min-w-max">
                  {t("settings.target_model")}
                </span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-muted-foreground">{settings.active_model_id}</span>
                  {ollamaStatus.target_model_ready ? (
                    <span className="inline-flex items-center px-2 py-1 rounded border border-green-200 bg-green-50 text-[10px] font-semibold text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400">
                      {t("settings.model_ready")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded border border-destructive/20 bg-destructive/10 text-[10px] font-semibold text-destructive">
                      {t("settings.model_missing")}
                    </span>
                  )}
                </div>
              </div>

              {ollamaStatus.models.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="font-medium text-foreground tracking-wide block">
                    {t("settings.available_models")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ollamaStatus.models.map((m) => (
                      <span
                        key={m}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                          m.startsWith(settings.active_model_id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                        }`}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!ollamaStatus.target_model_ready && (
                <p className="text-sm text-muted-foreground mt-3 px-4 py-3 bg-muted/50 rounded-lg">
                  {t("settings.model_pull_hint", {
                    model: settings.active_model_id,
                  })}
                </p>
              )}
            </>
          )}

          {ollamaStatus && !ollamaStatus.running && (
            <p className="text-sm text-muted-foreground mt-2">
              {t("settings.ollama_install_hint")}
            </p>
          )}
        </div>
      </div>

      {/* 语言 */}
      <div className="space-y-4 pb-6 border-b border-border last:border-0">
        <h3 className="text-lg font-semibold tracking-tight">{t("settings.language")}</h3>
        <div className="flex items-center gap-4 w-full">
          <Select
            value={settings.language}
            onValueChange={(v) => void handleLanguageChange(v)}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh">中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 模型 ID */}
      <div className="space-y-4 pb-6 border-b border-border last:border-0">
        <h3 className="text-lg font-semibold tracking-tight">
          {t("settings.model_id")}
        </h3>
        <div className="flex items-center gap-4 w-full">
          <input
            className="flex h-10 w-full md:w-[300px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            type="text"
            value={settings.active_model_id}
            onChange={(e) => void update({ active_model_id: e.target.value })}
          />
        </div>
      </div>

      {/* 戏剧化默认档位 */}
      <div className="space-y-4 pb-6 border-b border-border last:border-0">
        <h3 className="text-lg font-semibold tracking-tight">
          {t("settings.drama_level")}
        </h3>
        <div className="flex items-center gap-4 w-full">
          <Select
            value={String(settings.drama_level)}
            onValueChange={(v) => void update({ drama_level: Number(v) })}
          >
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — {t("settings.drama_1")}</SelectItem>
              <SelectItem value="2">2 — {t("settings.drama_2")}</SelectItem>
              <SelectItem value="3">3 — {t("settings.drama_3")}</SelectItem>
              <SelectItem value="4">4 — {t("settings.drama_4")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 开关类设置 */}
      <div className="space-y-4 pb-6 border-b border-border last:border-0">
        <h3 className="text-lg font-semibold tracking-tight">
          {t("settings.toggles")}
        </h3>
        
        <label className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card hover:bg-accent/10 transition-colors cursor-pointer">
          <div className="space-y-0.5 max-w-[80%]">
            <span className="text-base font-medium">
              {t("settings.black_swan")}
            </span>
            <p className="text-sm text-muted-foreground">
              {t("settings.black_swan_desc")}
            </p>
          </div>
          <Switch
              checked={settings.black_swan_enabled}
              onCheckedChange={(checked) =>
                void update({ black_swan_enabled: checked })
              }
            />
        </label>

        <label className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card hover:bg-accent/10 transition-colors cursor-pointer mt-4">
          <div className="space-y-0.5 max-w-[80%]">
            <span className="text-base font-medium">
              {t("settings.safety_valve")}
            </span>
            <p className="text-sm text-muted-foreground">
              {t("settings.safety_valve_desc")}
            </p>
          </div>
          <Switch
              checked={settings.safety_valve_enabled}
              onCheckedChange={(checked) =>
                void update({ safety_valve_enabled: checked })
              }
            />
        </label>
      </div>
    </section>
  );
}
