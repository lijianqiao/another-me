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
      pushToast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
              在推演你的未来之前，我需要先了解一下你。<br />
              这些信息仅保存在本地，不会上传到任何服务器。
            </p>
            <p className="onboarding__desc onboarding__desc--muted">
              只需要 1 分钟，回答几个简单的问题。
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding__step">
            <h2 className="onboarding__title">📋 基础信息</h2>
            <div className="stack">
              <label>
                职业 *
                <input
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="例如：程序员、学生、自由职业者"
                />
              </label>
              <label>
                感情状态 *
                <input
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="例如：单身、恋爱中、已婚"
                />
              </label>
              <label>
                经济状况
                <select
                  value={financial}
                  onChange={(e) => setFinancial(e.target.value as FinancialStatus)}
                >
                  <option value="broke">月光族</option>
                  <option value="saving">略有积蓄</option>
                  <option value="stable">经济独立</option>
                  <option value="debt">背负贷款</option>
                </select>
              </label>
              <label>
                所在城市（可选）
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="例如：北京、上海"
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding__step">
            <h2 className="onboarding__title">🎯 日常习惯</h2>
            <div className="stack">
              <label>
                日常习惯 *（逗号分隔）
                <input
                  value={habits}
                  onChange={(e) => setHabits(e.target.value)}
                  placeholder="例如：打游戏、健身、刷短视频、读书"
                />
              </label>
              <label>
                社交倾向
                <select
                  value={social}
                  onChange={(e) => setSocial(e.target.value as SocialTendency)}
                >
                  <option value="introvert">内向 / 独处充电</option>
                  <option value="neutral">中间 / 看心情</option>
                  <option value="extrovert">外向 / 人群充电</option>
                </select>
              </label>
              <label>
                健康状况（可选）
                <input
                  value={healthStatus}
                  onChange={(e) => setHealthStatus(e.target.value)}
                  placeholder="例如：健康、亚健康、慢性病"
                />
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding__step">
            <h2 className="onboarding__title">💡 性格画像</h2>
            <div className="stack">
              <label>
                性格标签 *（逗号分隔）
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="例如：拖延症、完美主义、行动派"
                />
              </label>
              <label>
                核心恐惧（可选，逗号分隔）
                <input
                  value={coreFears}
                  onChange={(e) => setCoreFears(e.target.value)}
                  placeholder="例如：失败、孤独、贫穷"
                />
              </label>
              <label>
                梦想目标（可选，逗号分隔）
                <input
                  value={dreams}
                  onChange={(e) => setDreams(e.target.value)}
                  placeholder="例如：财务自由、环游世界"
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
