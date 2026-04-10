import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { Home, Sparkles, Clock, Compass, Cpu, Settings } from "lucide-react";

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

  return (
    <aside
      className={cn(
        "fixed xl:sticky top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky xl:block",
        open && "block w-64 -ml-0 border-r border-border/40 bg-background/80 backdrop-blur-sm"
      )}
    >
      <div className="h-full py-6 pr-6 lg:py-8 lg:pl-8 lg:pr-6">
        <div className="w-full space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.to}
                end={"end" in item ? item.end : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary pointer-events-none drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {t(`nav.${item.key}`)}
              </NavLink>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
