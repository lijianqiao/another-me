/**
 * 时间线卡片
 * 展示 narrative + key_events + 情绪维度 + 类型标签
 */
import { useTranslation } from "react-i18next";

import type { Timeline, TimelineType } from "../../types";
import { splitNarrativeParagraphs } from "../../utils/narrativeFormat";

interface Props {
  timeline: Timeline;
  index: number;
}

const EMOTION_ICONS: Record<string, string> = {
  positive: "🟢",
  neutral: "🔵",
  negative: "🔴",
};

const TYPE_CONFIG: Record<TimelineType, { label_key: string; cls: string }> = {
  reality: { label_key: "results.type_reality", cls: "timeline-card__type--reality" },
  parallel: { label_key: "results.type_parallel", cls: "timeline-card__type--parallel" },
  extreme: { label_key: "results.type_extreme", cls: "timeline-card__type--extreme" },
};

export default function TimelineCard({ timeline, index }: Props) {
  const { t } = useTranslation();
  const { narrative, key_events, emotion, black_swan_event, timeline_type } =
    timeline;
  const typeInfo = TYPE_CONFIG[timeline_type] ?? TYPE_CONFIG.reality;
  const paragraphs = splitNarrativeParagraphs(narrative);

  return (
    <div className="timeline-card">
      <div className="timeline-card__header">
        <span className="timeline-card__badge">
          {t("results.timeline")} {index + 1}
        </span>
        <span className={`timeline-card__type ${typeInfo.cls}`}>
          {t(typeInfo.label_key)}
        </span>
        {black_swan_event && (
          <span className="timeline-card__badge timeline-card__badge--swan">
            🦢 {t("results.black_swan_label")}
          </span>
        )}
      </div>

      <div className="timeline-card__narrative">
        {paragraphs.map((p, i) => (
          <p key={i} className="timeline-card__narrative-p">
            {p}
          </p>
        ))}
      </div>

      {key_events.length > 0 && (
        <div className="timeline-card__events">
          <h4 className="timeline-card__events-title">{t("results.key_events")}</h4>
          <ul className="timeline-card__events-list">
            {key_events.map((evt, i) => (
              <li key={i} className="timeline-card__event">
                <span className="timeline-card__event-year">{evt.year}</span>
                <span className="timeline-card__event-icon">
                  {EMOTION_ICONS[evt.emotion] ?? "⚪"}
                </span>
                <span className="timeline-card__event-text">{evt.event}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="timeline-card__emotions">
        <h4 className="timeline-card__events-title">{t("results.emotion_section")}</h4>
        <div className="emotion-bars">
          <EmotionBar
            label={t("results.emotion_energy")}
            value={emotion.energy}
            color="#10b981"
          />
          <EmotionBar
            label={t("results.emotion_satisfaction_dim")}
            value={emotion.satisfaction}
            color="#3b82f6"
          />
          <EmotionBar
            label={t("results.emotion_regret")}
            value={emotion.regret}
            color="#f59e0b"
            inverted
          />
          <EmotionBar
            label={t("results.emotion_hope")}
            value={emotion.hope}
            color="#8b5cf6"
          />
          <EmotionBar
            label={t("results.emotion_loneliness")}
            value={emotion.loneliness}
            color="#ef4444"
            inverted
          />
        </div>
      </div>

      {black_swan_event && (
        <div className="timeline-card__swan">
          <strong>{t("results.black_swan_event_prefix")}</strong>
          {black_swan_event}
        </div>
      )}
    </div>
  );
}

function EmotionBar({
  label,
  value,
  color,
  inverted,
}: {
  label: string;
  value: number;
  color: string;
  inverted?: boolean;
}) {
  return (
    <div className="emotion-bar">
      <span className="emotion-bar__label">{label}</span>
      <div className="emotion-bar__track">
        <div
          className="emotion-bar__fill"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: color,
            opacity: inverted ? 0.6 : 1,
          }}
        />
      </div>
      <span className="emotion-bar__value">{Math.round(value)}</span>
    </div>
  );
}
