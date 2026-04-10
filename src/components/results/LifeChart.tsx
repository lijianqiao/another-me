/**
 * 人生走势图（Recharts 折线图）
 *
 * 按维度切换，每个维度显示 3 条时间线对比
 * 维度：职业/财务/健康/情感/满足
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
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
  reality: "#4f46e5",
  parallel: "#7c3aed",
  extreme: "#f59e0b",
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
    <div className="life-chart">
      <h3 className="life-chart__title">{t("results.life_chart_title")}</h3>

      <div className="life-chart__dims">
        {DIMENSIONS.map((dim) => (
          <button
            key={dim}
            className={`life-chart__dim-btn ${dim === activeDim ? "life-chart__dim-btn--active" : ""}`}
            onClick={() => setActiveDim(dim)}
          >
            {t(`results.dim_${dim}`)}
          </button>
        ))}
      </div>

      <div className="life-chart__chart">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
            <Legend
              iconType="line"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            {timelines.map((tl, idx) => (
              <Line
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
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
