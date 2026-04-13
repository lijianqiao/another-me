/**
 * 推演加载动画
 * 监听 simulation_progress 事件显示实时进度
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface ProgressPayload {
  current: number;
  total: number;
  run_total: number;
  stage?: string;
  message: string;
}

const KNOWN_STAGES = new Set(["preparing", "running", "clustering", "letter", "saving"]);

export default function SimulationLoading() {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const fallbackTips = [
    t("simulate.loading_fallback_1"),
    t("simulate.loading_fallback_2"),
    t("simulate.loading_fallback_3"),
    t("simulate.loading_fallback_4"),
  ];

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const ul = await listen<ProgressPayload>(
          "simulation_progress",
          (event) => {
            setProgress(event.payload);
          },
        );
        unlisten = ul;
      } catch {
        // 非 Tauri 环境（开发模式等）
      }
    })();

    return () => {
      unlisten?.();
    };
  }, []);

  let message: string;
  if (progress?.stage && KNOWN_STAGES.has(progress.stage)) {
    message = t(`simulate.stage_${progress.stage}`, {
      current: progress.current,
      total: progress.total,
      run_total: progress.run_total,
    });
  } else if (progress?.message) {
    message = progress.message;
  } else {
    message = fallbackTips[Math.floor(Math.random() * fallbackTips.length)];
  }

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  // SVG arc offset: 264 = circumference of r=42 circle
  const dashOffset =
    pct !== null ? 264 - (264 * Math.min(pct, 100)) / 100 : 66;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
      <div className="w-20 h-20 mb-6 relative">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            className="stroke-muted"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            className="stroke-primary"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="264"
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.5s ease",
              ...(pct === null ? { animation: "spin 1.4s ease-in-out infinite", transformOrigin: "center" } : {}),
            }}
          />
        </svg>
        {pct !== null && (
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-semibold text-primary">
            {pct}%
          </span>
        )}
      </div>
      <p className="text-base text-foreground mb-2">{message}</p>
      <p className="text-sm text-muted-foreground">{t("simulate.loading_hint")}</p>
      {progress && progress.total > 0 && (
        <p className="text-xs text-muted-foreground/60 mt-2 font-mono">
          {progress.current}/{progress.total}
        </p>
      )}
    </div>
  );
}

