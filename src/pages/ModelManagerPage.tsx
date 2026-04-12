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
    defaultModel: "deepseek-v3.2",
    defaultBase: "https://api.deepseek.com/v1",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
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
    } catch {
      /* ignore */
    }
  }, []);

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
    <section className="space-y-8 p-6 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold tracking-tight">{t("models.title")}</h2>
      <p className="text-muted-foreground mb-6">{t("models.subtitle")}</p>

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

      <div className="bg-card border border-border p-6 rounded-lg space-y-4 mb-8">
        <h3 className="text-lg font-semibold tracking-tight">{t("models.download_title")}</h3>
        <div className="flex gap-3">
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            type="text"
            placeholder={t("models.download_placeholder")}
            value={newModelId}
            onChange={(e) => setNewModelId(e.target.value)}
            disabled={downloading}
          />
          <button
            className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={handleDownload}
            disabled={downloading || !newModelId.trim()}
          >
            {downloading ? t("models.downloading") : t("models.download_btn")}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {loading && <p>{t("common.loading")}</p>}
        {!loading && models.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{t("models.empty")}</p>
        )}
        {models.map((m) => (
          <div
            key={m.name}
            className={`g-card border p-5 rounded-lg flex flex-col gap-4 sm:flex-row sm:items-center justify-between transition-colors ${m.is_active ? "model-card--active" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">{m.name}</span>
              <span className="text-sm text-muted-foreground">{m.size}</span>
              {m.is_active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase font-bold tracking-wider">{t("models.active")}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!m.is_active && (
                <button
                  className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent border border-input bg-background"
                  onClick={() => handleSwitch(m.name)}
                >
                  {t("models.use")}
                </button>
              )}
              <button
                className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors text-destructive hover:bg-destructive/10 border border-destructive/20"
                onClick={() => setDeleteTarget(m.name)}
              >
                {t("models.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 pt-8 border-t border-border mt-8">
        <h3 className="text-xl font-semibold tracking-tight">{t("settings.cloud_title")}</h3>
        <p className="text-muted-foreground text-sm">{t("models.cloud_desc")}</p>

        <div className="grid gap-4 mt-4">
          {CLOUD_PROVIDERS.map((cp) => {
            const status = cloudStatuses.find((k) => k.provider === cp.id);
            const hasKey = status?.has_key ?? false;
            const isEditing = editingProvider === cp.id;
            const inp = cloudInputs[cp.id] ?? {
              model: cp.defaultModel,
              baseUrl: cp.defaultBase,
            };

            return (
              <div key={cp.id} className="bg-card border border-border p-5 rounded-lg space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-lg">{cp.label}</span>
                  <span
                    className={`	ext-[10px] px-2 py-0.5 rounded-full font-semibold ${hasKey ? "cloud-provider-card__badge--ok" : ""
                      }`}
                  >
                    {hasKey
                      ? t("settings.key_configured")
                      : t("settings.key_not_set")}
                  </span>
                </div>

                <label className="space-y-1.5 flex flex-col text-sm font-medium">
                  <span>{t("models.base_url")}</span>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    type="url"
                    placeholder={cp.defaultBase}
                    value={inp.baseUrl}
                    onChange={(e) => setInput(cp.id, "baseUrl", e.target.value)}
                  />
                </label>

                <label className="space-y-1.5 flex flex-col text-sm font-medium">
                  <span>{t("models.cloud_model_id")}</span>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    type="text"
                    placeholder={cp.defaultModel}
                    value={inp.model}
                    onChange={(e) => setInput(cp.id, "model", e.target.value)}
                  />
                </label>

                {isEditing ? (
                  <div className="space-y-4 mt-4 pt-4 border-t border-border">
                    <input
                      type="password"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={t("models.api_key_placeholder")}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
                      <button
                        className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
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
                            pushToast(
                              "error",
                              t("errors.generic", { detail: String(err) }),
                            );
                          }
                        }}
                      >
                        {t("common.save")}
                      </button>
                      <button
                        className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent border border-input bg-background"
                        onClick={() => {
                          setEditingProvider(null);
                          setKeyInput("");
                        }}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
                    <button
                      className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent border border-input bg-background"
                      onClick={() => {
                        setEditingProvider(cp.id);
                        setKeyInput("");
                      }}
                    >
                      {hasKey
                        ? t("settings.key_update")
                        : t("settings.key_set")}
                    </button>
                    {hasKey && (
                      <>
                        <button
                          className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent border border-input bg-background"
                          onClick={async () => {
                            try {
                              await saveCloudProvider({
                                provider: cp.id,
                                base_url: inp.baseUrl.trim() || undefined,
                              });
                              pushToast("info", t("models.base_url_saved"));
                              void loadCloud();
                            } catch (err) {
                              pushToast(
                                "error",
                                t("errors.generic", { detail: String(err) }),
                              );
                            }
                          }}
                        >
                          {t("models.save_base_url")}
                        </button>
                        <button
                          className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors text-destructive hover:bg-destructive/10 border border-destructive/20"
                          onClick={async () => {
                            try {
                              await deleteApiKey(cp.id);
                              pushToast("info", t("settings.key_deleted"));
                              void loadCloud();
                            } catch (err) {
                              pushToast(
                                "error",
                                t("errors.generic", { detail: String(err) }),
                              );
                            }
                          }}
                        >
                          {t("models.delete")}
                        </button>
                        <button
                          className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
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
                              pushToast(
                                "info",
                                t("settings.provider_switched", {
                                  provider: cp.label,
                                }),
                              );
                            } catch (err) {
                              pushToast(
                                "error",
                                t("errors.generic", { detail: String(err) }),
                              );
                            }
                          }}
                        >
                          {activeProvider === cp.id
                            ? t("models.active")
                            : t("models.use")}
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
            className="h-9 px-4 py-2 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent border border-input bg-background"
            onClick={async () => {
              try {
                await switchProvider({
                  provider: "ollama",
                  model: activeModelId,
                });
                setActiveProvider("ollama");
                pushToast("info", t("settings.back_to_ollama"));
              } catch (err) {
                pushToast(
                  "error",
                  t("errors.generic", { detail: String(err) }),
                );
              }
            }}
          >
            {t("settings.back_to_ollama")}
          </button>
        )}
      </div>
    </section>
  );
}
