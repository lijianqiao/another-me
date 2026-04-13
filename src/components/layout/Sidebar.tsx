import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Home, Sparkles, Clock, Compass, Cpu, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useUiStore } from "../../store";
import { cn } from "../../utils/shadcn";

const NAV_ITEMS = [
  { to: "/", key: "home", icon: Home, end: true },
  { to: "/simulate", key: "simulate", icon: Sparkles },
  { to: "/history", key: "history", icon: Clock },
  { to: "/lifemap", key: "lifemap", icon: Compass },
  { to: "/models", key: "models", icon: Cpu },
  { to: "/settings", key: "settings", icon: Settings },
] as const;

export default function Sidebar() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.sidebarOpen);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <>
      {/* Mobile Backdrop */}
      {!open ? null : (
        <div
          className="fixed inset-0 z-20 bg-background/50 backdrop-blur-sm md:hidden"
          onClick={toggle}
        />
      )}

      <aside
        className={cn(
          "absolute md:static top-0 left-0 z-30 flex flex-col h-full shrink-0 border-r border-border/40 bg-background/95 backdrop-blur-sm transition-all duration-300",
          open ? "w-52" : "w-16 hidden md:flex",
          // Slide out effect on mobile when closed
          !open && "max-md:-translate-x-full"
        )}
      >
        <div className="flex-1 py-4 px-3 flex flex-col gap-2 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.to}
                end={"end" in item ? item.end : undefined}
                title={!open ? t(`nav.${item.key}`) : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-all group",
                    isActive
                      ? "bg-primary/10 text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.15)] pointer-events-none"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    open ? "justify-start gap-4" : "justify-center"
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {open && <span className="truncate">{t(`nav.${item.key}`)}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Expand / Collapse Toggle inside Sidebar */}
        <div className="p-3 border-t border-border/40 flex justify-center mt-auto">
          <button
            onClick={toggle}
            className={cn(
              "p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground flex items-center transition-all w-full",
              open ? "justify-start gap-4" : "justify-center"
            )}
            title={open ? t("nav.collapse", "Collapse") : t("nav.expand", "Expand")}
          >
            {open ? (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" />
                <span className="text-sm truncate">{t("nav.collapse")}</span>
              </>
            ) : (
              <PanelLeftOpen className="h-5 w-5 shrink-0" />
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
