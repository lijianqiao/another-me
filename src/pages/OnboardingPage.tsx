/**
 * Onboarding — 4 步引导流程
 * 欢迎 → 基础信息 → 习惯 → 性格
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useProfileStore, useUiStore } from "../store";
import type {
  FinancialStatus,
  SocialTendency,
  UserProfileDraft,
} from "../types";

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const save = useProfileStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1: 基础信息
  const [occupation, setOccupation] = useState("");
  const [relationship, setRelationship] = useState("");
  const [financial, setFinancial] = useState<FinancialStatus>("saving");
  const [location, setLocation] = useState("");

  // Step 2: 习惯
  const [habits, setHabits] = useState("");
  const [social, setSocial] = useState<SocialTendency>("neutral");
  const [healthStatus, setHealthStatus] = useState("");

  // Step 3: 性格
  const [tags, setTags] = useState("");
  const [coreFears, setCoreFears] = useState("");
  const [dreams, setDreams] = useState("");

  const canNext = () => {
    if (step === 1) return occupation.trim() !== "" && relationship.trim() !== "";
    if (step === 2) return habits.trim() !== "";
    if (step === 3) return tags.trim() !== "";
    return true;
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async () => {
    setBusy(true);
    try {
      const draft: UserProfileDraft = {
        occupation: occupation.trim(),
        habits: split(habits),
        social_tendency: social,
        financial_status: financial,
        personality_tags: split(tags),
        relationship_status: relationship.trim(),
        health_status: healthStatus.trim() || undefined,
        location: location.trim() || undefined,
        core_fears: split(coreFears),
        dreams: split(dreams),
        language: i18n.language || "zh",
      };
      await save(draft);
      pushToast("success", t("onboarding.finish") + " ✓");
      navigate("/", { replace: true });
    } catch (err) {
      pushToast(
        "error",
        t("errors.generic", { detail: String((err as Error).message) }),
      );
    } finally {
      setBusy(false);
    }
  };

  const req = t("onboarding.required_mark");

  return (
    <section className="onboarding">
      <div className="onboarding__progress">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`onboarding__dot ${i <= step ? "onboarding__dot--active" : ""}`}
          />
        ))}
      </div>

      <div className="onboarding__card">
        {step === 0 && (
          <div className="onboarding__step">
            <h2 className="onboarding__title">👋 {t("onboarding.title")}</h2>
            <p className="onboarding__desc">
              {t("onboarding.welcome_desc_1")}<br />
              {t("onboarding.welcome_desc_2")}
            </p>
            <p className="onboarding__desc onboarding__desc--muted">
              {t("onboarding.welcome_note")}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding__step">
            <h2 className="onboarding__title">{t("onboarding.section_basic")}</h2>
            <div className="stack">
              <label>
                {t("onboarding.field_occupation")}{req}
                <input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder={t("onboarding.field_occupation_ph")}
                />
              </label>
              <label>
                {t("onboarding.field_relationship")}{req}
                <input
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder={t("onboarding.field_relationship_ph")}
                />
              </label>
              <label>
                {t("onboarding.field_financial")}
                <select
                  value={financial}
                  onChange={(e) => setFinancial(e.target.value as FinancialStatus)}
                >
                  <option value="broke">{t("onboarding.financial_broke")}</option>
                  <option value="saving">{t("onboarding.financial_saving")}</option>
                  <option value="stable">{t("onboarding.financial_stable")}</option>
                  <option value="debt">{t("onboarding.financial_debt")}</option>
                </select>
              </label>
              <label>
                {t("onboarding.field_location")}
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("onboarding.field_location_ph")}
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding__step">
            <h2 className="onboarding__title">{t("onboarding.section_habits")}</h2>
            <div className="stack">
              <label>
                {t("onboarding.field_habits")}{req}
                <input
                  value={habits}
                  onChange={(e) => setHabits(e.target.value)}
                  placeholder={t("onboarding.field_habits_ph")}
                />
              </label>
              <label>
                {t("onboarding.field_social")}
                <select
                  value={social}
                  onChange={(e) => setSocial(e.target.value as SocialTendency)}
                >
                  <option value="introvert">{t("onboarding.social_introvert")}</option>
                  <option value="neutral">{t("onboarding.social_neutral")}</option>
                  <option value="extrovert">{t("onboarding.social_extrovert")}</option>
                </select>
              </label>
              <label>
                {t("onboarding.field_health")}
                <input
                  value={healthStatus}
                  onChange={(e) => setHealthStatus(e.target.value)}
                  placeholder={t("onboarding.field_health_ph")}
                />
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding__step">
            <h2 className="onboarding__title">{t("onboarding.section_personality")}</h2>
            <div className="stack">
              <label>
                {t("onboarding.field_tags")}{req}
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t("onboarding.field_tags_ph")}
                />
              </label>
              <label>
                {t("onboarding.field_fears")}
                <input
                  value={coreFears}
                  onChange={(e) => setCoreFears(e.target.value)}
                  placeholder={t("onboarding.field_fears_ph")}
                />
              </label>
              <label>
                {t("onboarding.field_dreams")}
                <input
                  value={dreams}
                  onChange={(e) => setDreams(e.target.value)}
                  placeholder={t("onboarding.field_dreams_ph")}
                />
              </label>
            </div>
          </div>
        )}

        <div className="onboarding__actions">
          {step > 0 && (
            <button className="btn" onClick={prev}>
              {t("onboarding.previous")}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < TOTAL_STEPS - 1 ? (
            <button
              className="btn btn--primary"
              onClick={next}
              disabled={!canNext()}
            >
              {t("onboarding.next")}
            </button>
          ) : (
            <button
              className="btn btn--primary"
              onClick={onSubmit}
              disabled={!canNext() || busy}
            >
              {busy ? t("common.loading") : t("onboarding.finish")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function split(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
