/**
 * 推演加载动画
 * 监听 simulation_progress 事件显示实时进度
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface ProgressPayload {
  current: number;
  total: number;
  stage?: string;
  message: string;
}

const KNOWN_STAGES = new Set(["preparing", "running", "clustering"]);

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
    <div className="sim-loading">
      <div className="sim-loading__ring">
        <svg viewBox="0 0 100 100" className="sim-loading__svg">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#4f46e5"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="264"
            strokeDashoffset={dashOffset}
            className={pct === null ? "sim-loading__arc" : ""}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        {pct !== null && (
          <span className="sim-loading__pct">{pct}%</span>
        )}
      </div>
      <p className="sim-loading__text">{message}</p>
      <p className="sim-loading__hint">{t("simulate.loading_hint")}</p>
      {progress && progress.total > 0 && (
        <p className="sim-loading__step">
          {progress.current}/{progress.total}
        </p>
      )}
    </div>
  );
}
