import { useTranslation } from "react-i18next";

export default function SimulatePage() {
  const { t } = useTranslation();
  return (
    <section>
      <h2>{t("nav.simulate")}</h2>
      <p>Sprint 2-3 将在此接入决策输入、戏剧化滑块和推演加载。</p>
    </section>
  );
}
