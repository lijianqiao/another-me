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

  if (status === "loading" || status === "idle") {
    return <p>{t("common.loading")}</p>;
  }

  return (
    <section className="home-page">
      <h2>{t("home.welcome")}</h2>
      <p className="home-page__tagline text-muted-foreground mb-6">{t("app.tagline")}</p>
      <EvolutionBadge />
      <div className="home-page__actions flex items-center gap-3 mt-6">
        <Button asChild>
          <Link to="/simulate">{t("home.start_simulation")}</Link>
        </Button>
      </div>
    </section>
  );
}
