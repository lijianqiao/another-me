import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import { useProfileStore } from "../store";

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
      <p className="home-page__tagline">{t("app.tagline")}</p>
      <div className="home-page__actions">
        <Link to="/simulate" className="btn btn--primary">
          {t("home.start_simulation")}
        </Link>
      </div>
    </section>
  );
}
