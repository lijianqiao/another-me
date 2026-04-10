/**
 * 时间线卡片
 * 展示 narrative + key_events + 情绪维度雷达
 */
import type { Timeline } from "../../types";

interface Props {
  timeline: Timeline;
  index: number;
}

const EMOTION_LABELS: Record<string, string> = {
  positive: "🟢",
  neutral: "🔵",
  negative: "🔴",
};

export default function TimelineCard({ timeline, index }: Props) {
  const { narrative, key_events, emotion, black_swan_event } = timeline;

  return (
    <div className="timeline-card">
      <div className="timeline-card__header">
        <span className="timeline-card__badge">
          时间线 {index + 1}
        </span>
        {black_swan_event && (
          <span className="timeline-card__badge timeline-card__badge--swan">
            🦢 黑天鹅
          </span>
        )}
      </div>

      <p className="timeline-card__narrative">{narrative}</p>

      {key_events.length > 0 && (
        <div className="timeline-card__events">
          <h4 className="timeline-card__events-title">关键事件</h4>
          <ul className="timeline-card__events-list">
            {key_events.map((evt, i) => (
              <li key={i} className="timeline-card__event">
                <span className="timeline-card__event-year">{evt.year}</span>
                <span className="timeline-card__event-icon">
                  {EMOTION_LABELS[evt.emotion] ?? "⚪"}
                </span>
                <span className="timeline-card__event-text">{evt.event}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="timeline-card__emotions">
        <h4 className="timeline-card__events-title">情绪维度</h4>
        <div className="emotion-bars">
          <EmotionBar label="活力" value={emotion.energy} color="#10b981" />
          <EmotionBar label="满足" value={emotion.satisfaction} color="#3b82f6" />
          <EmotionBar label="遗憾" value={emotion.regret} color="#f59e0b" inverted />
          <EmotionBar label="希望" value={emotion.hope} color="#8b5cf6" />
          <EmotionBar label="孤独" value={emotion.loneliness} color="#ef4444" inverted />
        </div>
      </div>

      {black_swan_event && (
        <div className="timeline-card__swan">
          <strong>🦢 黑天鹅事件：</strong>{black_swan_event}
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
