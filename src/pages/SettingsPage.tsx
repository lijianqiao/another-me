import { useTranslation } from "react-i18next";

import { useSettingsStore } from "../store";

export default function SettingsPage() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  return (
    <section>
      <h2>{t("nav.settings")}</h2>

      <div className="stack">
        <label>
          戏剧化档位 / Drama level
          <select
            value={settings.drama_level}
            onChange={(e) => update({ drama_level: Number(e.target.value) })}
          >
            <option value={1}>1 — 普通人的故事</option>
            <option value={2}>2 — 适度的戏剧</option>
            <option value={3}>3 — 命运的岔路</option>
            <option value={4}>4 — 平行宇宙狂热</option>
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.black_swan_enabled}
            onChange={(e) =>
              update({ black_swan_enabled: e.target.checked })
            }
          />
          启用黑天鹅因子
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.safety_valve_enabled}
            onChange={(e) =>
              update({ safety_valve_enabled: e.target.checked })
            }
          />
          启用安全阀
        </label>
      </div>
    </section>
  );
}
