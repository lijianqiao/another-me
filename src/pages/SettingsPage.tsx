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
    <section className="max-w-[1160px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className="text-2xl font-bold tracking-tight mb-6">{t("nav.settings")}</h2>

      <div className="space-y-4">
        {/* Ollama 状态卡片 */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("settings.ollama_title")}
            </h3>
            <div className="flex items-center gap-2">
              {ollamaStatus ? (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ollamaStatus.running
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "bg-destructive/15 text-destructive"
                    }`}
                >
                  {ollamaStatus.running
                    ? t("settings.ollama_running")
                    : t("settings.ollama_offline")}
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
                  {checking ? t("common.loading") : "—"}
                </span>
              )}
              <button
                className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-7 px-2.5"
                onClick={doCheckOllama}
                disabled={checking}
              >
                {t("settings.ollama_refresh")}
              </button>
            </div>
          </div>

          {ollamaStatus?.running && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("settings.target_model")}</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{settings.active_model_id}</code>
                  {ollamaStatus.target_model_ready ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400 font-semibold">
                      {t("settings.model_ready")}
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
                      {t("settings.model_missing")}
                    </span>
                  )}
                </div>
              </div>

              {ollamaStatus.models.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {ollamaStatus.models.map((m) => (
                    <span
                      key={m}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${m.startsWith(settings.active_model_id)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border"
                        }`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}

              {!ollamaStatus.target_model_ready && (
                <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/50 rounded-md">
                  {t("settings.model_pull_hint", { model: settings.active_model_id })}
                </p>
              )}
            </div>
          )}

          {ollamaStatus && !ollamaStatus.running && (
            <p className="text-xs text-muted-foreground">{t("settings.ollama_install_hint")}</p>
          )}
        </div>

        {/* 通用设置卡片 — 语言 + 模型 + 戏剧化 */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {/* 语言 */}
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-medium">{t("settings.language")}</span>
            <Select
              value={settings.language}
              onValueChange={(v) => void handleLanguageChange(v)}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 模型 ID */}
          <div className="flex items-center justify-between gap-4 p-4">
            <span className="text-sm font-medium shrink-0">{t("settings.model_id")}</span>
            <input
              className="flex h-8 w-full max-w-[220px] rounded-md border border-input bg-background px-2.5 py-1 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              type="text"
              value={settings.active_model_id}
              onChange={(e) => void update({ active_model_id: e.target.value })}
            />
          </div>

          {/* 戏剧化档位 */}
          <div className="flex items-center justify-between p-4">
            <span className="text-sm font-medium">{t("settings.drama_level")}</span>
            <Select
              value={String(settings.drama_level)}
              onValueChange={(v) => void update({ drama_level: Number(v) })}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
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

        {/* 功能开关卡片 */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 mr-4">
              <span className="text-sm font-medium">{t("settings.black_swan")}</span>
              <p className="text-xs text-muted-foreground">{t("settings.black_swan_desc")}</p>
            </div>
            <Switch
              checked={settings.black_swan_enabled}
              onCheckedChange={(checked) => void update({ black_swan_enabled: checked })}
            />
          </label>

          <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/5 transition-colors">
            <div className="space-y-0.5 mr-4">
              <span className="text-sm font-medium">{t("settings.safety_valve")}</span>
              <p className="text-xs text-muted-foreground">{t("settings.safety_valve_desc")}</p>
            </div>
            <Switch
              checked={settings.safety_valve_enabled}
              onCheckedChange={(checked) => void update({ safety_valve_enabled: checked })}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
