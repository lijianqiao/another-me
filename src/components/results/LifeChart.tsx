/**
 * 人生走势图（Recharts 折线图）
 *
 * 按维度切换，每个维度显示 3 条时间线对比
 * 维度：职业/财务/健康/情感/满足
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import type { Timeline, TimelineType } from "../../types";

interface Props {
  timelines: Timeline[];
}

type Dimension = "career" | "financial" | "health" | "relationship" | "satisfaction";

const DIMENSIONS: Dimension[] = [
  "career",
  "financial",
  "health",
  "relationship",
  "satisfaction",
];

const TIMELINE_COLORS: Record<TimelineType, string> = {
  reality: "hsl(var(--chart-1))",
  parallel: "hsl(var(--chart-2))",
  extreme: "hsl(var(--chart-3))",
};

const TIMELINE_DASH: Record<TimelineType, string> = {
  reality: "",
  parallel: "8 4",
  extreme: "4 2",
};

export default function LifeChart({ timelines }: Props) {
  const { t } = useTranslation();
  const [activeDim, setActiveDim] = useState<Dimension>("satisfaction");

  const chartData = useMemo(() => {
    const yearMap = new Map<number, Record<string, number>>();

    timelines.forEach((tl, idx) => {
      const prefix = `tl${idx}`;
      for (const score of tl.dimension_scores) {
        if (!yearMap.has(score.year)) {
          yearMap.set(score.year, { year: score.year });
        }
        const row = yearMap.get(score.year)!;
        row[`${prefix}_career`] = score.career;
        row[`${prefix}_financial`] = score.financial;
        row[`${prefix}_health`] = score.health;
        row[`${prefix}_relationship`] = score.relationship;
        row[`${prefix}_satisfaction`] = score.satisfaction;
      }
    });

    return Array.from(yearMap.values()).sort(
      (a, b) => (a.year as number) - (b.year as number),
    );
  }, [timelines]);

  if (chartData.length === 0) return null;

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur-md">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h3 className="text-lg font-medium text-foreground">{t("results.life_chart_title")}</h3>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {DIMENSIONS.map((dim) => (
            <button
              key={dim}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${dim === activeDim
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              onClick={() => setActiveDim(dim)}
            >
              {t(`results.dim_${dim}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 0, bottom: 8, left: -24 }}>
            <defs>
              {timelines.map((tl) => (
                <linearGradient key={`grad-${tl.id}`} id={`color-${tl.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TIMELINE_COLORS[tl.timeline_type] ?? "#6b7280"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={TIMELINE_COLORS[tl.timeline_type] ?? "#6b7280"} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              opacity={0.6}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickMargin={12}
              opacity={0.6}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                borderColor: "hsl(var(--border))",
                borderRadius: "12px",
                fontSize: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                backdropFilter: "blur(8px)"
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 16, opacity: 0.8 }}
            />
            {timelines.map((tl, idx) => (
              <Area
                key={tl.id}
                type="monotone"
                dataKey={`tl${idx}_${activeDim}`}
                name={t(
                  `results.type_${tl.timeline_type}` as
                  | "results.type_reality"
                  | "results.type_parallel"
                  | "results.type_extreme",
                )}
                stroke={TIMELINE_COLORS[tl.timeline_type] ?? "#6b7280"}
                strokeDasharray={TIMELINE_DASH[tl.timeline_type] ?? ""}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#color-${tl.id})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
