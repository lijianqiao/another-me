/**
 * Onboarding — Sprint 1 仅实现最小可用版本（单表单提交即落库），
 * Sprint 3 会升级为多步引导。
 */
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useProfileStore, useUiStore } from "../store";
import type {
  FinancialStatus,
  SocialTendency,
  UserProfileDraft,
} from "../types";

export default function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const save = useProfileStore((s) => s.save);
  const pushToast = useUiStore((s) => s.pushToast);

  const [occupation, setOccupation] = useState("");
  const [habits, setHabits] = useState("");
  const [social, setSocial] = useState<SocialTendency>("neutral");
  const [financial, setFinancial] = useState<FinancialStatus>("saving");
  const [tags, setTags] = useState("");
  const [relationship, setRelationship] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const draft: UserProfileDraft = {
        occupation: occupation.trim(),
        habits: split(habits),
        social_tendency: social,
        financial_status: financial,
        personality_tags: split(tags),
        relationship_status: relationship.trim(),
        language: i18n.language || "zh",
      };
      await save(draft);
      pushToast("success", t("common.save") + " ✓");
      navigate("/", { replace: true });
    } catch (err) {
      pushToast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="onboarding-page">
      <h2>{t("onboarding.title")}</h2>
      <form onSubmit={onSubmit} className="stack">
        <label>
          职业 / Occupation
          <input
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            required
          />
        </label>

        <label>
          日常习惯（逗号分隔）/ Habits
          <input
            value={habits}
            onChange={(e) => setHabits(e.target.value)}
            placeholder="游戏, 健身, 读书"
          />
        </label>

        <label>
          社交倾向 / Social
          <select
            value={social}
            onChange={(e) => setSocial(e.target.value as SocialTendency)}
          >
            <option value="introvert">introvert</option>
            <option value="neutral">neutral</option>
            <option value="extrovert">extrovert</option>
          </select>
        </label>

        <label>
          经济状况 / Financial
          <select
            value={financial}
            onChange={(e) => setFinancial(e.target.value as FinancialStatus)}
          >
            <option value="broke">broke</option>
            <option value="saving">saving</option>
            <option value="stable">stable</option>
            <option value="debt">debt</option>
          </select>
        </label>

        <label>
          性格标签（逗号分隔）/ Personality tags
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="拖延症, 行动派"
          />
        </label>

        <label>
          感情状态 / Relationship
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? t("common.loading") : t("onboarding.finish")}
        </button>
      </form>
    </section>
  );
}

function split(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
