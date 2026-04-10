/**
 * 主布局：Header + Sidebar + 内容区 + Toast 挂载点
 */
import { Outlet } from "react-router-dom";

import Header from "./Header";
import Sidebar from "./Sidebar";
import Toaster from "../common/Toaster";

export default function AppShell() {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-shell__body">
        <Sidebar />
        <main className="app-shell__main">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
}
