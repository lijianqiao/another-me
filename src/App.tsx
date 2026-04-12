/**
 * 应用根组件
 *
 * 职责：
 *  1. 启动时并发 load profile + settings
 *  2. settings 就绪后同步 i18next 语言
 *  3. 把 router 挂到 RouterProvider
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "next-themes";
import { RouterProvider } from "react-router-dom";

import { router } from "./router";
import { useProfileStore, useSettingsStore } from "./store";

import "./App.css";

export default function App() {
  const { i18n } = useTranslation();
  const loadProfile = useProfileStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const language = useSettingsStore((s) => s.settings.language);
  const settingsLoaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    // Wait for the splash screen to be fully visible before mounting everything
    void loadProfile();
    void loadSettings();
  }, [loadProfile, loadSettings]);

  useEffect(() => {
    if (settingsLoaded && language && i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [settingsLoaded, language, i18n]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
