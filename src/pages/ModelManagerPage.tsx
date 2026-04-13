/**
 * 模型管理页面：本地 Ollama 模型 + 云端 API
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";

import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  listModels,
  switchModel,
  deleteModel,
  downloadModel,
  type LocalModelInfo,
} from "../api/model";
import {
  listApiKeyStatus,
  saveCloudProvider,
  deleteApiKey,
  switchProvider,
  type CloudProviderStatus,
} from "../api/settings";
import { useSettingsStore, useUiStore } from "../store";

const CLOUD_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5.4-mini",
    defaultBase: "https://api.openai.com",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-6",
    defaultBase: "https://api.anthropic.com",
  },
  {
    id: "qwen",
    label: "Qwen / DashScope",
    defaultModel: "qwen3.6-plus",
    defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    defaultBase: "https://api.deepseek.com/v1",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-3.1-flash",
    defaultBase: "https://generativelanguage.googleapis.com",
  },
] as const;

export default function ModelManagerPage() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const activeModelId = useSettingsStore((s) => s.settings.active_model_id);

  const [models, setModels] = useState<LocalModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModelId, setNewModelId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [cloudStatuses, setCloudStatuses] = useState<CloudProviderStatus[]>(
    [],
  );
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [cloudInputs, setCloudInputs] = useState<
    Record<string, { model: string; baseUrl: string }>
  >({});
  const [activeProvider, setActiveProvider] = useState("ollama");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listModels();
      setModels(list);
    } catch {
      pushToast("error", t("models.load_failed"));
    } finally {
      setLoading(false);
    }
  }, [pushToast, t]);

  const loadCloud = useCallback(async () => {
    try {
      const statuses = await listApiKeyStatus();
      setCloudStatuses(statuses);
      setCloudInputs((prev) => {
        const next = { ...prev };
        for (const s of statuses) {
          const def = CLOUD_PROVIDERS.find((c) => c.id === s.provider);
          next[s.provider] = {
            model: next[s.provider]?.model ?? def?.defaultModel ?? "",
            baseUrl: s.base_url ?? def?.defaultBase ?? "",
          };
        }
        return next;
      });
      // 根据 active_model_id 推断当前激活的 provider
      // 如果当前模型 ID 与某个云端 provider 的默认模型前缀匹配，则认为该 provider 已激活
      const matched = CLOUD_PROVIDERS.find((cp) =>
        activeModelId.startsWith(cp.defaultModel.split("-")[0])
      );
      if (matched && statuses.find((s) => s.provider === matched.id)?.has_key) {
        setActiveProvider(matched.id);
      } else {
        setActiveProvider("ollama");
      }
    } catch {
      /* ignore */
    }
  }, [activeModelId]);

  useEffect(() => {
    void refresh();
    void loadCloud();
  }, [refresh, loadCloud]);

  useEffect(() => {
    const unlistenOk = listen<string>("model_download_complete", (e) => {
      pushToast("info", e.payload);
      setDownloading(false);
      void refresh();
    });
    const unlistenErr = listen<string>("model_download_failed", (e) => {
      pushToast("error", e.payload);
      setDownloading(false);
    });
    return () => {
      void unlistenOk.then((f) => f());
      void unlistenErr.then((f) => f());
    };
  }, [pushToast, refresh]);

  const handleSwitch = async (name: string) => {
    try {
      await switchModel(name);
      pushToast("info", t("models.switched", { model: name }));
      void refresh();
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const msg = await deleteModel(deleteTarget);
      pushToast("info", msg);
      setDeleteTarget(null);
      void refresh();
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
      setDeleteTarget(null);
    }
  };

  const handleDownload = async () => {
    if (!newModelId.trim()) return;
    setDownloading(true);
    try {
      await downloadModel(newModelId.trim());
      pushToast(
        "info",
        t("models.download_started", { model: newModelId.trim() }),
      );
    } catch (err) {
      pushToast("error", t("errors.generic", { detail: String(err) }));
      setDownloading(false);
    }
  };

  const setInput = (
    id: string,
    field: "model" | "baseUrl",
    value: string,
  ) => {
    setCloudInputs((prev) => ({
      ...prev,
      [id]: {
        model: field === "model" ? value : (prev[id]?.model ?? ""),
        baseUrl: field === "baseUrl" ? value : (prev[id]?.baseUrl ?? ""),
      },
    }));
  };

  return (
    <section className="max-w-[1320px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h2 className="text-2xl font-bold tracking-tight">{t("models.title")}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-6">{t("models.subtitle")}</p>

      <ConfirmDialog
        open={!!deleteTarget}
        kind="warning"
        title={t("models.delete_confirm_title")}
        message={t("models.delete_confirm_msg", { model: deleteTarget ?? "" })}
        confirmText={t("common.confirm")}
        cancelText={t("common.cancel")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="space-y-4">
        {/* 下载新模型 */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("models.download_title")}</h3>
          <div className="flex gap-2">
            <input
              className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              type="text"
              placeholder={t("models.download_placeholder")}
              value={newModelId}
              onChange={(e) => setNewModelId(e.target.value)}
              disabled={downloading}
            />
            <button
              className="h-8 px-4 inline-flex items-center justify-center whitespace-nowrap shrink-0 rounded-md text-xs font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={handleDownload}
              disabled={downloading || !newModelId.trim()}
            >
              {downloading ? t("models.downloading") : t("models.download_btn")}
            </button>
          </div>
        </div>

        {/* 本地模型列表 */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {loading && (
            <p className="p-4 text-sm text-muted-foreground">{t("common.loading")}</p>
          )}
          {!loading && models.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">{t("models.empty")}</p>
          )}
          {models.map((m) => (
            <div
              key={m.name}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${m.is_active ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{m.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{m.size}</span>
                {m.is_active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase font-bold tracking-wider shrink-0">{t("models.active")}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!m.is_active && (
                  <button
                    className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-accent border border-input bg-background"
                    onClick={() => handleSwitch(m.name)}
                  >
                    {t("models.use")}
                  </button>
                )}
                <button
                  className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors text-destructive hover:bg-destructive/10 border border-destructive/20"
                  onClick={() => setDeleteTarget(m.name)}
                >
                  {t("models.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 云端 API */}
        <div className="pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("settings.cloud_title")}</h3>
          <p className="text-xs text-muted-foreground mb-3">{t("models.cloud_desc")}</p>

          <div className="space-y-3">
            {CLOUD_PROVIDERS.map((cp) => {
              const status = cloudStatuses.find((k) => k.provider === cp.id);
              const hasKey = status?.has_key ?? false;
              const isEditing = editingProvider === cp.id;
              const inp = cloudInputs[cp.id] ?? {
                model: cp.defaultModel,
                baseUrl: cp.defaultBase,
              };

              return (
                <div key={cp.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{cp.label}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${hasKey
                        ? "bg-green-500/15 text-green-600 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {hasKey ? t("settings.key_configured") : t("settings.key_not_set")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">{t("models.base_url")}</span>
                      <input
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        type="url"
                        placeholder={cp.defaultBase}
                        value={inp.baseUrl}
                        onChange={(e) => setInput(cp.id, "baseUrl", e.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">{t("models.cloud_model_id")}</span>
                      <input
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        type="text"
                        placeholder={cp.defaultModel}
                        value={inp.model}
                        onChange={(e) => setInput(cp.id, "model", e.target.value)}
                      />
                    </label>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <input
                        type="password"
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={t("models.api_key_placeholder")}
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          disabled={!keyInput.trim()}
                          onClick={async () => {
                            if (!inp.baseUrl.trim()) {
                              pushToast("warning", t("models.base_url_required"));
                              return;
                            }
                            try {
                              await saveCloudProvider({
                                provider: cp.id,
                                api_key: keyInput.trim(),
                                base_url: inp.baseUrl.trim() || undefined,
                              });
                              pushToast("info", t("settings.key_saved"));
                              setEditingProvider(null);
                              setKeyInput("");
                              void loadCloud();
                            } catch (err) {
                              pushToast("error", t("errors.generic", { detail: String(err) }));
                            }
                          }}
                        >
                          {t("common.save")}
                        </button>
                        <button
                          className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-accent border border-input bg-background"
                          onClick={() => { setEditingProvider(null); setKeyInput(""); }}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border">
                      <button
                        className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-accent border border-input bg-background"
                        onClick={() => { setEditingProvider(cp.id); setKeyInput(""); }}
                      >
                        {hasKey ? t("settings.key_update") : t("settings.key_set")}
                      </button>
                      {hasKey && (
                        <>
                          <button
                            className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-accent border border-input bg-background"
                            onClick={async () => {
                              try {
                                await saveCloudProvider({ provider: cp.id, base_url: inp.baseUrl.trim() || undefined });
                                pushToast("info", t("models.base_url_saved"));
                                void loadCloud();
                              } catch (err) {
                                pushToast("error", t("errors.generic", { detail: String(err) }));
                              }
                            }}
                          >
                            {t("models.save_base_url")}
                          </button>
                          <button
                            className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors text-destructive hover:bg-destructive/10 border border-destructive/20"
                            onClick={async () => {
                              try {
                                await deleteApiKey(cp.id);
                                pushToast("info", t("settings.key_deleted"));
                                void loadCloud();
                              } catch (err) {
                                pushToast("error", t("errors.generic", { detail: String(err) }));
                              }
                            }}
                          >
                            {t("models.delete")}
                          </button>
                          <button
                            className="h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={async () => {
                              if (!inp.baseUrl.trim()) {
                                pushToast("warning", t("models.base_url_required"));
                                return;
                              }
                              try {
                                await switchProvider({
                                  provider: cp.id,
                                  model: inp.model.trim() || cp.defaultModel,
                                  base_url: inp.baseUrl.trim(),
                                });
                                setActiveProvider(cp.id);
                                pushToast("info", t("settings.provider_switched", { provider: cp.label }));
                              } catch (err) {
                                pushToast("error", t("errors.generic", { detail: String(err) }));
                              }
                            }}
                          >
                            {activeProvider === cp.id ? t("models.active") : t("models.use")}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {activeProvider !== "ollama" && (
            <button
              className="mt-3 h-7 px-3 inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors hover:bg-accent border border-input bg-background"
              onClick={async () => {
                try {
                  await switchProvider({ provider: "ollama", model: activeModelId });
                  setActiveProvider("ollama");
                  pushToast("info", t("settings.back_to_ollama"));
                } catch (err) {
                  pushToast("error", t("errors.generic", { detail: String(err) }));
                }
              }}
            >
              {t("settings.back_to_ollama")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
