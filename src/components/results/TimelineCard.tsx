import { useTranslation } from "react-i18next";
import type { Timeline, TimelineType } from "../../types";
import { splitNarrativeParagraphs } from "../../utils/narrativeFormat";

interface Props {
  timeline: Timeline;
  index: number;
}

const EMOTION_ICONS: Record<string, string> = {
  positive: "🟢",
  neutral: "⚪",
  negative: "🔴",
};

const TYPE_CONFIG: Record<TimelineType, { label_key: string; cls: string }> = {
  reality: { label_key: "results.type_reality", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  parallel: { label_key: "results.type_parallel", cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" },
  extreme: { label_key: "results.type_extreme", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" },
};

export default function TimelineCard({ timeline, index }: Props) {
  const { t } = useTranslation();
  const { narrative, key_events, emotion, black_swan_event, timeline_type } = timeline;
  const typeInfo = TYPE_CONFIG[timeline_type] ?? TYPE_CONFIG.reality;
  const paragraphs = splitNarrativeParagraphs(narrative);

  return (
    <div className="bg-card border border-border shadow-sm rounded-xl p-5 mb-6 flex flex-col gap-5 text-card-foreground transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold bg-muted py-1 px-3 rounded-full text-foreground shadow-sm">
            {t("results.timeline")} {index + 1}
          </span>
          <span className={`text-xs font-medium py-1 px-3 rounded-full ${typeInfo.cls}`}>
            {t(typeInfo.label_key)}
          </span>
        </div>
        {black_swan_event && (
          <span className="text-xs font-semibold py-1 px-3 rounded-full text-zinc-800 bg-zinc-100 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-1">
            🦢 {t("results.black_swan_label")}
          </span>
        )}
      </div>

      <div className="text-sm md:text-base leading-relaxed text-foreground/80 space-y-3 whitespace-pre-wrap font-serif">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-justify indent-8 tracking-wide">
            {p}
          </p>
        ))}
      </div>

      {key_events && key_events.length > 0 && (
        <div className="mt-2 bg-muted/30 p-4 rounded-lg border border-border/40">
          <h4 className="text-sm font-semibold mb-3 text-foreground tracking-wide">{t("results.key_events")}</h4>
          <ul className="flex flex-col gap-3">
            {key_events.map((evt, i) => (
              <li key={i} className="text-sm flex items-start gap-4 p-2 bg-background rounded border border-border/30 shadow-sm">
                <span className="font-mono font-medium text-muted-foreground w-12 pt-[2px] tabular-nums shrink-0">{evt.year}</span>
                <span className="text-sm flex items-center justify-center shrink-0 pt-[2px]">
                  {EMOTION_ICONS[evt.emotion] ?? "🔹"}
                </span>
                <span className="text-foreground leading-snug flex-1">{evt.event}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {emotion && (
        <div className="mt-2">
          <h4 className="text-sm font-semibold mb-4 text-foreground tracking-wide px-2">{t("results.emotion_section")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-2">
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
      )}

      {black_swan_event && (
        <div className="mt-4 p-4 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100 border border-amber-200 dark:border-amber-800/50 shadow-sm text-sm leading-relaxed flex gap-3">
          <span className="text-lg shrink-0">🦢</span>
          <div>
            <strong className="block mb-1 font-semibold">{t("results.black_swan_event_prefix")}</strong>
            <span className="opacity-90">{black_swan_event}</span>
          </div>
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
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground flex justify-between">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value)}</span>
      </span>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
            background: color,
            opacity: inverted ? 0.7 : 1,
          }}
        />
      </div>
    </div>
  );
}
