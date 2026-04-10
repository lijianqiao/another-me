/**
 * 模型管理页面
 * Sprint 9：本地模型列表 + 切换 + 下载 + 删除
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
import { useUiStore } from "../store";

export default function ModelManagerPage() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);

  const [models, setModels] = useState<LocalModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModelId, setNewModelId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      pushToast("error", String(err));
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
      pushToast("error", String(err));
      setDeleteTarget(null);
    }
  };

  const handleDownload = async () => {
    if (!newModelId.trim()) return;
    setDownloading(true);
    try {
      await downloadModel(newModelId.trim());
      pushToast("info", t("models.download_started", { model: newModelId.trim() }));
    } catch (err) {
      pushToast("error", String(err));
      setDownloading(false);
    }
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

      {/* 下载新模型 */}
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

      {/* 模型列表 */}
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
    </section>
  );
}
