/**
 * 决策历史列表
 *
 * 展示决策摘要卡片，点击进入历史结果详情，右键或按钮删除
 */
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

import type { DecisionSummary } from "../../api/history";

interface Props {
  items: DecisionSummary[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const HORIZON_MAP: Record<string, string> = {
  "1y": "1",
  "3y": "3",
  "5y": "5",
  "10y": "10",
};

/** 右键菜单 */
function ContextMenu({
  x,
  y,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in zoom-in-95 duration-150"
      style={{ left: x, top: y }}
    >
      <button
        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        {t("history.delete")}
      </button>
    </div>
  );
}

export default function HistoryList({ items, onSelect, onDelete }: Props) {
  const { t } = useTranslation();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
      </div>
    );
  }

  return (
    <>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onDelete={() => onDelete(ctxMenu.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}
      <ul className="space-y-3">
        {items.map((item) => {
          const date = new Date(item.created_at);
          const dateStr = date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <li key={item.id}>
              <div
                className="group w-full flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:bg-accent hover:shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onSelect(item.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, id: item.id });
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <time className="text-xs font-medium text-muted-foreground">
                    {dateStr}
                  </time>
                  <span className="text-xs text-muted-foreground">
                    {HORIZON_MAP[item.time_horizon] ?? item.time_horizon}{" "}
                    {t("simulate.year")}
                  </span>
                  {item.drama_level > 2 && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                      {t(`settings.drama_${item.drama_level}`)}
                    </span>
                  )}
                  {item.black_swan_enabled && (
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      🦢
                    </span>
                  )}
                  {item.is_anchored && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      📌
                    </span>
                  )}
                  {/* 删除按钮 — 始终显示 */}
                  <button
                    className="ml-auto inline-flex items-center justify-center rounded-md text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors h-7 w-7"
                    title={t("history.delete")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
                <p className="line-clamp-2 text-sm font-medium">{item.decision_text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
