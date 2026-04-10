import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";

import { useUiStore } from "../../store";

const NAV_ITEMS = [
  { to: "/", key: "home", end: true },
  { to: "/simulate", key: "simulate" },
  { to: "/history", key: "history" },
  { to: "/lifemap", key: "lifemap" },
  { to: "/settings", key: "settings" },
] as const;

export default function Sidebar() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.sidebarOpen);

  return (
    <aside className={`app-sidebar ${open ? "" : "app-sidebar--closed"}`}>
      <nav>
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                end={"end" in item ? item.end : undefined}
                className={({ isActive }) =>
                  isActive ? "nav-link nav-link--active" : "nav-link"
                }
              >
                {t(`nav.${item.key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
