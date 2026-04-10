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
    defaultModel: "gpt-4o",
    defaultBase: "https://api.openai.com",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    defaultBase: "https://api.anthropic.com",
  },
  {
    id: "qwen",
    label: "Qwen / DashScope",
    defaultModel: "qwen-plus",
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
    defaultModel: "gemini-2.0-flash",
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
    <section className="model-manager-page">
      <h2>{t("models.title")}</h2>
      <p className="model-manager-page__desc">{t("models.subtitle")}</p>

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

      <div className="model-manager__download">
        <h3>{t("models.download_title")}</h3>
        <div className="model-manager__download-row">
          <input
            className="settings-input"
            type="text"
            placeholder={t("models.download_placeholder")}
            value={newModelId}
            onChange={(e) => setNewModelId(e.target.value)}
            disabled={downloading}
          />
          <button
            className="btn btn--primary btn--sm"
            onClick={handleDownload}
            disabled={downloading || !newModelId.trim()}
          >
            {downloading ? t("models.downloading") : t("models.download_btn")}
          </button>
        </div>
      </div>

      <div className="model-manager__list">
        {loading && <p>{t("common.loading")}</p>}
        {!loading && models.length === 0 && (
          <p className="model-manager__empty">{t("models.empty")}</p>
        )}
        {models.map((m) => (
          <div
            key={m.name}
            className={`model-card ${m.is_active ? "model-card--active" : ""}`}
          >
            <div className="model-card__info">
              <span className="model-card__name">{m.name}</span>
              <span className="model-card__size">{m.size}</span>
              {m.is_active && (
                <span className="model-card__badge">{t("models.active")}</span>
              )}
            </div>
            <div className="model-card__actions">
              {!m.is_active && (
                <button
                  className="btn btn--sm"
                  onClick={() => handleSwitch(m.name)}
                >
                  {t("models.use")}
                </button>
              )}
              <button
                className="btn btn--sm btn--danger"
                onClick={() => setDeleteTarget(m.name)}
              >
                {t("models.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="settings-section model-manager__cloud">
        <h3 className="settings-section__title">{t("settings.cloud_title")}</h3>
        <p className="settings-section__desc">{t("models.cloud_desc")}</p>

        <div className="cloud-providers">
          {CLOUD_PROVIDERS.map((cp) => {
            const status = cloudStatuses.find((k) => k.provider === cp.id);
            const hasKey = status?.has_key ?? false;
            const isEditing = editingProvider === cp.id;
            const inp = cloudInputs[cp.id] ?? {
              model: cp.defaultModel,
              baseUrl: cp.defaultBase,
            };

            return (
              <div key={cp.id} className="cloud-provider-card">
                <div className="cloud-provider-card__header">
                  <span className="cloud-provider-card__name">{cp.label}</span>
                  <span
                    className={`cloud-provider-card__badge ${
                      hasKey ? "cloud-provider-card__badge--ok" : ""
                    }`}
                  >
                    {hasKey
                      ? t("settings.key_configured")
                      : t("settings.key_not_set")}
                  </span>
                </div>

                <label className="cloud-provider-card__field">
                  <span>{t("models.base_url")}</span>
                  <input
                    className="settings-input"
                    type="url"
                    placeholder={cp.defaultBase}
                    value={inp.baseUrl}
                    onChange={(e) => setInput(cp.id, "baseUrl", e.target.value)}
                  />
                </label>

                <label className="cloud-provider-card__field">
                  <span>{t("models.cloud_model_id")}</span>
                  <input
                    className="settings-input"
                    type="text"
                    placeholder={cp.defaultModel}
                    value={inp.model}
                    onChange={(e) => setInput(cp.id, "model", e.target.value)}
                  />
                </label>

                {isEditing ? (
                  <div className="cloud-provider-card__form">
                    <input
                      type="password"
                      className="settings-input"
                      placeholder={t("models.api_key_placeholder")}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                    />
                    <div className="cloud-provider-card__actions">
                      <button
                        className="btn btn--sm btn--primary"
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
                        className="btn btn--sm"
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
                  <div className="cloud-provider-card__actions">
                    <button
                      className="btn btn--sm"
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
                          className="btn btn--sm"
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
                          className="btn btn--sm btn--danger"
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
                          className="btn btn--sm btn--primary"
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
            className="btn btn--sm"
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
