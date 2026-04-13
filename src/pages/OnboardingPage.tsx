
/**
 * Onboarding - 4 步引导流程
 *  欢迎 -> 基础信息 -> 习惯 -> 性格
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useProfileStore, useUiStore } from "../store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import type {
  FinancialStatus,
  SocialTendency,
  UserProfileDraft,
} from "../types";

/** 统一输入框样式，与 shadcn Input 一致 */
const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors";

// ── 顶层子组件：必须在渲染函数外定义，否则每次渲染都会重建 ──────────────────
interface InputSectionProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function InputSection({ label, required, children }: InputSectionProps) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[320px] max-w-full">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

/** 将逗号/中文逗号/空格分隔的输入拆为非空字符串数组 */
function split(input: string): string[] {
  return input
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

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

  return (
    <section className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen w-full bg-background py-10 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex gap-2.5 mb-8 w-full max-w-lg justify-center">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 max-w-[60px] rounded-full transition-colors duration-300 ${i <= step ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.3)]" : "bg-muted"
              }`}
          />
        ))}
      </div>

      <div className="bg-card w-full max-w-lg p-8 rounded-2xl shadow-lg border border-border flex flex-col items-center text-center transition-all duration-300">
        <div className="w-full flex-1 min-h-[50vh]">
          {step === 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col items-center pt-8">
              <h2 className="text-2xl font-bold mb-4 tracking-tight">👋 {t("onboarding.title")}</h2>
              <p className="text-muted-foreground text-[15px] leading-relaxed mb-6">
                {t("onboarding.welcome_desc_1")}<br />
                {t("onboarding.welcome_desc_2")}
              </p>
              <p className="text-xs text-muted-foreground/70 bg-secondary/50 p-3 rounded-lg border border-border">
                {t("onboarding.welcome_note")}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full text-left">
              <h2 className="text-xl font-semibold mb-6 text-center">{t("onboarding.section_basic")}</h2>
              <div className="flex flex-col gap-5 w-full">
                <InputSection label={t("onboarding.field_occupation")} required={true}>
                  <input
                    className={INPUT_CLASS}
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder={t("onboarding.field_occupation_ph")}
                  />
                </InputSection>
                <InputSection label={t("onboarding.field_relationship")} required={true}>
                  <input
                    className={INPUT_CLASS}
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    placeholder={t("onboarding.field_relationship_ph")}
                  />
                </InputSection>
                <InputSection label={t("onboarding.field_financial")}>
                  <Select
                    value={financial}
                    onValueChange={(v) => setFinancial(v as FinancialStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="broke">{t("onboarding.financial_broke")}</SelectItem>
                      <SelectItem value="saving">{t("onboarding.financial_saving")}</SelectItem>
                      <SelectItem value="stable">{t("onboarding.financial_stable")}</SelectItem>
                      <SelectItem value="debt">{t("onboarding.financial_debt")}</SelectItem>
                    </SelectContent>
                  </Select>
                </InputSection>
                <InputSection label={t("onboarding.field_location")}>
                  <input
                    className={INPUT_CLASS}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t("onboarding.field_location_ph")}
                  />
                </InputSection>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full text-left">
              <h2 className="text-xl font-semibold mb-6 text-center">{t("onboarding.section_habits")}</h2>
              <div className="flex flex-col gap-5 w-full">
                <InputSection label={t("onboarding.field_habits")} required={true}>
                  <input
                    className={INPUT_CLASS}
                    value={habits}
                    onChange={(e) => setHabits(e.target.value)}
                    placeholder={t("onboarding.field_habits_ph")}
                  />
                </InputSection>
                <InputSection label={t("onboarding.field_social")}>
                  <Select
                    value={social}
                    onValueChange={(v) => setSocial(v as SocialTendency)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="introvert">{t("onboarding.social_introvert")}</SelectItem>
                      <SelectItem value="neutral">{t("onboarding.social_neutral")}</SelectItem>
                      <SelectItem value="extrovert">{t("onboarding.social_extrovert")}</SelectItem>
                    </SelectContent>
                  </Select>
                </InputSection>
                <InputSection label={t("onboarding.field_health")}>
                  <input
                    className={INPUT_CLASS}
                    value={healthStatus}
                    onChange={(e) => setHealthStatus(e.target.value)}
                    placeholder={t("onboarding.field_health_ph")}
                  />
                </InputSection>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 w-full text-left">
              <h2 className="text-xl font-semibold mb-6 text-center">{t("onboarding.section_personality")}</h2>
              <div className="flex flex-col gap-5 w-full">
                <InputSection label={t("onboarding.field_tags")} required={true}>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder={t("onboarding.field_tags_ph")}
                  />
                </InputSection>
                <InputSection label={t("onboarding.field_fears")}>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    value={coreFears}
                    onChange={(e) => setCoreFears(e.target.value)}
                    placeholder={t("onboarding.field_fears_ph")}
                  />
                </InputSection>
                <InputSection label={t("onboarding.field_dreams")}>
                  <input
                    className={INPUT_CLASS}
                    value={dreams}
                    onChange={(e) => setDreams(e.target.value)}
                    placeholder={t("onboarding.field_dreams_ph")}
                  />
                </InputSection>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center w-full mt-8 pt-4 border-t border-border">
          {step > 0 ? (
            <button
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-accent hover:text-accent-foreground h-10 py-2 px-4 shadow-sm"
              onClick={prev}
            >
              {t("onboarding.previous")}
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <button
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-8 shadow-sm"
              onClick={next}
              disabled={!canNext()}
            >
              {t("onboarding.next")}
            </button>
          ) : (
            <button
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-8 shadow-sm"
              onClick={onSubmit}
              disabled={!canNext() || busy}
            >
              {busy ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t("common.loading")}
                </>
              ) : (
                t("onboarding.finish")
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}


