import { useTranslation } from "react-i18next";

export default function LifeMapPage() {
  const { t } = useTranslation();
  return (
    <section>
      <h2>{t("nav.lifemap")}</h2>
      <p>Sprint 7 将在此渲染纵向时间轴 + 因果链。</p>
    </section>
  );
}
