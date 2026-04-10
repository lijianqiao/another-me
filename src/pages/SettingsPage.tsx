/**
 * 设置页面
 *
 * Sprint 4：完整实现
 *  - Ollama 连接状态检测
 *  - 模型选择
 *  - 语言切换
 *  - 戏剧化默认档位
 *  - 黑天鹅开关
 *  - 安全阀开关
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { checkOllamaStatus, type OllamaStatus } from "../api/settings";
import { useSettingsStore, useUiStore } from "../store";

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
    <section className="settings-page">
      <h2>{t("nav.settings")}</h2>

      {/* Ollama 状态 */}
      <div className="settings-section">
        <h3 className="settings-section__title">
          {t("settings.ollama_title")}
        </h3>

        <div className="ollama-status">
          <div className="ollama-status__row">
            <span className="ollama-status__label">
              {t("settings.ollama_status")}
            </span>
            {ollamaStatus ? (
              <span
                className={`ollama-status__badge ${
                  ollamaStatus.running
                    ? "ollama-status__badge--ok"
                    : "ollama-status__badge--err"
                }`}
              >
                {ollamaStatus.running
                  ? t("settings.ollama_running")
                  : t("settings.ollama_offline")}
              </span>
            ) : (
              <span className="ollama-status__badge">
                {checking ? t("common.loading") : "—"}
              </span>
            )}
            <button
              className="btn btn--sm"
              onClick={doCheckOllama}
              disabled={checking}
            >
              {t("settings.ollama_refresh")}
            </button>
          </div>

          {ollamaStatus?.running && (
            <>
              <div className="ollama-status__row">
                <span className="ollama-status__label">
                  {t("settings.target_model")}
                </span>
                <span>{settings.active_model_id}</span>
                {ollamaStatus.target_model_ready ? (
                  <span className="ollama-status__badge ollama-status__badge--ok">
                    {t("settings.model_ready")}
                  </span>
                ) : (
                  <span className="ollama-status__badge ollama-status__badge--err">
                    {t("settings.model_missing")}
                  </span>
                )}
              </div>

              {ollamaStatus.models.length > 0 && (
                <div className="ollama-status__models">
                  <span className="ollama-status__label">
                    {t("settings.available_models")}
                  </span>
                  <div className="ollama-status__model-list">
                    {ollamaStatus.models.map((m) => (
                      <span
                        key={m}
                        className={`ollama-model-tag ${
                          m.startsWith(settings.active_model_id)
                            ? "ollama-model-tag--active"
                            : ""
                        }`}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!ollamaStatus.target_model_ready && (
                <p className="ollama-status__hint">
                  {t("settings.model_pull_hint", {
                    model: settings.active_model_id,
                  })}
                </p>
              )}
            </>
          )}

          {ollamaStatus && !ollamaStatus.running && (
            <p className="ollama-status__hint">
              {t("settings.ollama_install_hint")}
            </p>
          )}
        </div>
      </div>

      {/* 语言 */}
      <div className="settings-section">
        <h3 className="settings-section__title">{t("settings.language")}</h3>
        <div className="settings-row">
          <select
            className="settings-select"
            value={settings.language}
            onChange={(e) => void handleLanguageChange(e.target.value)}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {/* 模型 ID */}
      <div className="settings-section">
        <h3 className="settings-section__title">
          {t("settings.model_id")}
        </h3>
        <div className="settings-row">
          <input
            className="settings-input"
            type="text"
            value={settings.active_model_id}
            onChange={(e) => void update({ active_model_id: e.target.value })}
          />
        </div>
      </div>

      {/* 戏剧化默认档位 */}
      <div className="settings-section">
        <h3 className="settings-section__title">
          {t("settings.drama_level")}
        </h3>
        <div className="settings-row">
          <select
            className="settings-select"
            value={settings.drama_level}
            onChange={(e) =>
              void update({ drama_level: Number(e.target.value) })
            }
          >
            <option value={1}>1 — {t("settings.drama_1")}</option>
            <option value={2}>2 — {t("settings.drama_2")}</option>
            <option value={3}>3 — {t("settings.drama_3")}</option>
            <option value={4}>4 — {t("settings.drama_4")}</option>
          </select>
        </div>
      </div>

      {/* 开关类设置 */}
      <div className="settings-section">
        <h3 className="settings-section__title">
          {t("settings.toggles")}
        </h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.black_swan_enabled}
            onChange={(e) =>
              void update({ black_swan_enabled: e.target.checked })
            }
          />
          <span className="settings-toggle__text">
            {t("settings.black_swan")}
          </span>
          <span className="settings-toggle__desc">
            {t("settings.black_swan_desc")}
          </span>
        </label>

        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.safety_valve_enabled}
            onChange={(e) =>
              void update({ safety_valve_enabled: e.target.checked })
            }
          />
          <span className="settings-toggle__text">
            {t("settings.safety_valve")}
          </span>
          <span className="settings-toggle__desc">
            {t("settings.safety_valve_desc")}
          </span>
        </label>
      </div>
    </section>
  );
}
