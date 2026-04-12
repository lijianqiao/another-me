import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Menu, Globe, Leaf } from "lucide-react";

import { useSettingsStore, useUiStore } from "../../store";
import { Button } from "../ui/button";
import { ThemeToggle } from "../common/ThemeToggle";

export default function Header() {
  const { i18n } = useTranslation();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const onToggleLang = async () => {
    const next = settings.language === "zh" ? "en" : "zh";
    await updateSettings({ language: next });
    await i18n.changeLanguage(next);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4 relative">
        <Button variant="ghost" size="icon" className="mr-2 h-9 w-9 md:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-bold sm:inline-block tracking-widest text-primary drop-shadow-sm">
            ANOTHER ME
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none"></div>
          <nav className="flex items-center space-x-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={onToggleLang} className="h-9 px-3 gap-2 text-muted-foreground hover:text-foreground">
              <Globe className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider">{settings.language === "zh" ? "EN" : "中"}</span>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
