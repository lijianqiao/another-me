import { useTranslation } from "react-i18next";

export default function HistoryPage() {
  const { t } = useTranslation();
  return (
    <section>
      <h2>{t("nav.history")}</h2>
      <p>Sprint 6 将在此展示决策历史列表。</p>
    </section>
  );
}
