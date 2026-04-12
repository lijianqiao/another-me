/**
 * 主布局：Header + Sidebar + 内容区 + Toast 挂载点
 */
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useProfileStore, useSettingsStore } from "../../store";

import Header from "./Header";
import Sidebar from "./Sidebar";
import Toaster from "../common/Toaster";
import { SplashScreen } from "../common/SplashScreen";

export default function AppShell() {
  const profileStatus = useProfileStore((s) => s.status);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const [minSplashTime, setMinSplashTime] = useState(true);

  useEffect(() => {
    // 保证至少展示3.5秒启动页给玩家看淡入淡出的诗句
    const timer = setTimeout(() => {
      setMinSplashTime(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  if (profileStatus === "loading" || profileStatus === "idle" || !settingsLoaded || minSplashTime) {
    return <SplashScreen />;
  }

  return (
    <div className="relative flex h-screen flex-col bg-background overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto w-full">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-6 md:px-8 lg:py-10 transition-all duration-300">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
