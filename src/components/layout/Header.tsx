import { useTranslation } from "react-i18next";

import { useSettingsStore, useUiStore } from "../../store";

export default function Header() {
  const { t, i18n } = useTranslation();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const onToggleLang = async () => {
    const next = settings.language === "zh" ? "en" : "zh";
    await updateSettings({ language: next });
    await i18n.changeLanguage(next);
  };

  return (
    <header className="app-header">
      <button className="icon-btn" onClick={toggleSidebar} aria-label="toggle sidebar">
        ☰
      </button>
      <h1 className="app-header__title">{t("app.title")}</h1>
      <div className="app-header__spacer" />
      <button className="link-btn" onClick={onToggleLang}>
        {settings.language === "zh" ? "EN" : "中"}
      </button>
    </header>
  );
}
