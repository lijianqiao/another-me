import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import EvolutionBadge from "../components/common/EvolutionBadge";
import { useProfileStore } from "../store";
import { Button } from "../components/ui/button";

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useProfileStore((s) => s.profile);
  const status = useProfileStore((s) => s.status);

  useEffect(() => {
    if (status === "ready" && profile === null) {
      navigate("/onboarding", { replace: true });
    }
  }, [status, profile, navigate]);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t("home.welcome")}</h2>
      <p className="text-muted-foreground">{t("app.tagline")}</p>
      <EvolutionBadge />
      <div className="flex items-center gap-3 pt-2">
        <Button asChild>
          <Link to="/simulate">{t("home.start_simulation")}</Link>
        </Button>
      </div>
    </section>
  );
}
