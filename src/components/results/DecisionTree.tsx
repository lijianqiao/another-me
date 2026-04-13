/**
 * 决策树可视化（D3.js 树形布局）
 *
 * 节点按类型着色：决策（珊瑚）、时间线（靛蓝/紫/琥珀）、事件（绿/灰/红）
 * 点击节点展开详情面板
 *
 * 注意：SVG 中颜色为硬编码深色系，容器使用 .dark 强制暗色主题以确保可读性。
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";

import type { TreeNode } from "../../api/history";

interface Props {
  tree: TreeNode;
}

interface HierarchyNode extends d3.HierarchyPointNode<TreeNode> { }

const MARGIN = { top: 30, right: 160, bottom: 30, left: 140 };
const NODE_RADIUS = 10;
const ROW_HEIGHT = 48;

export default function DecisionTree({ tree }: Props) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<TreeNode | null>(null);

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;

    const root = d3.hierarchy(tree);
    const leafCount = root.leaves().length;
    const height = Math.max(360, leafCount * ROW_HEIGHT + MARGIN.top + MARGIN.bottom);
    const width = Math.max(containerWidth, 700);

    const treeLayout = d3
      .tree<TreeNode>()
      .size([
        height - MARGIN.top - MARGIN.bottom,
        width - MARGIN.left - MARGIN.right,
      ])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.3));

    const rootNode = treeLayout(root);

    svg.attr("width", width).attr("height", height);

    /* -------- defs: drop shadow + gradient -------- */
    const defs = svg.append("defs");

    // Inner shadow for nodes
    const filter = defs
      .append("filter")
      .attr("id", "dtree-shadow")
      .attr("x", "-40%")
      .attr("y", "-40%")
      .attr("width", "180%")
      .attr("height", "180%");
    filter
      .append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 2)
      .attr("stdDeviation", 3)
      .attr("flood-color", "rgba(0,0,0,0.5)");

    // Outer glow for active nodes
    const glowFilter = defs
      .append("filter")
      .attr("id", "dtree-glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    glowFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", 4)
      .attr("result", "coloredBlur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    /* -------- links: smooth curves -------- */
    const linkGen = d3
      .linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
      .x((d) => d.y)
      .y((d) => d.x);

    g.selectAll(".dtree-link")
      .data(rootNode.links())
      .enter()
      .append("path")
      .attr("class", "dtree-link")
      .attr("fill", "none")
      .attr("stroke", (d) => {
        if (d.target.data.node_type === "decision") return "#0ff";
        if (d.target.data.node_type === "timeline") return "#a855f7";
        return "#475569"; // slate-600，比原来的 334155 更亮
      })
      .attr("stroke-width", (d) => (d.target.data.node_type === "decision" ? 3 : 1.5))
      .attr("stroke-dasharray", (d) => (d.target.data.node_type === "timeline" ? "4,4" : "none"))
      .attr("opacity", (d) => (d.target.data.node_type === "timeline" ? 0.5 : 0.8))
      .attr("d", linkGen as any);

    /* -------- nodes -------- */
    const nodeGroup = g
      .selectAll<SVGGElement, HierarchyNode>(".dtree-node")
      .data(rootNode.descendants())
      .enter()
      .append("g")
      .attr("class", "dtree-node")
      .attr("transform", (d: HierarchyNode) => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .attr("opacity", (d: HierarchyNode) => (d.data.node_type === "timeline" ? 0.6 : 1))
      .on("click", (_evt: MouseEvent, d: HierarchyNode) => {
        setSelected(d.data);
      });

    /* outer glow ring for decision node */
    nodeGroup
      .filter((d: HierarchyNode) => d.data.node_type === "decision")
      .append("circle")
      .attr("r", NODE_RADIUS + 8)
      .attr("fill", "none")
      .attr("stroke", "#0ff")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4 4")
      .attr("opacity", 0.6)
      .attr("filter", "url(#dtree-glow)");

    nodeGroup
      .append("circle")
      .attr("r", (d: HierarchyNode) =>
        d.data.node_type === "decision" ? NODE_RADIUS + 4 : NODE_RADIUS,
      )
      .attr("fill", (d: HierarchyNode) => {
        if (d.data.node_type === "decision") return "#002b36";
        return d.data.node_type === "timeline" ? "#2e1065" : "#0f172a";
      })
      .attr("stroke", (d: HierarchyNode) => {
        if (d.data.node_type === "decision") return "#0ff";
        if (d.data.node_type === "timeline") return "#a855f7";
        return "#64748b";
      })
      .attr("stroke-width", 2)
      .attr("filter", (d: HierarchyNode) => d.data.node_type === "decision" ? "url(#dtree-glow)" : "url(#dtree-shadow)");

    /* 文字颜色：确保在深色容器上清晰可读 */
    nodeGroup
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d: HierarchyNode) => (d.children ? -20 : 20))
      .attr("text-anchor", (d: HierarchyNode) =>
        d.children ? "end" : "start",
      )
      .attr("font-size", "12px")
      .attr("font-weight", (d: HierarchyNode) =>
        d.data.node_type === "decision" ? "600" : "400",
      )
      .attr("fill", (d: HierarchyNode) =>
        d.data.node_type === "decision" ? "#ffffff" : "#cbd5e1"
      )
      .text((d: HierarchyNode) => {
        const maxLen = d.data.node_type === "event" ? 30 : 20;
        return d.data.label.length > maxLen
          ? d.data.label.slice(0, maxLen) + "…"
          : d.data.label;
      });
  }, [tree]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div className="dark relative w-full rounded-xl border border-slate-800/60 overflow-hidden backdrop-blur-sm" style={{ background: "hsl(222 47% 7% / 0.95)" }}>
      <h3 className="absolute top-4 left-6 text-sm font-semibold tracking-wider text-slate-200 z-10 select-none">
        {t("results.decision_tree_title")}
      </h3>
      <div className="w-full h-full overflow-auto" ref={containerRef}>
        <svg ref={svgRef} className="select-none" />
      </div>
      {selected && (
        <div className="absolute right-4 top-4 w-72 bg-slate-900 border border-[#0ff]/30 shadow-[0_0_30px_rgba(0,255,255,0.05)] rounded-lg p-5 z-20 backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-1">
            <span
              className="w-3 h-3 rounded-full drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]"
              style={{ background: "#0ff" }}
            />
            <strong className="text-[#0ff] font-medium tracking-wide flex-1">{selected.label}</strong>
            <button
              className="text-slate-400 hover:text-white transition-colors"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          {selected.detail && (
            <p className="mt-4 text-sm text-slate-200 leading-relaxed">{selected.detail}</p>
          )}
          {selected.emotion && (
            <span className="inline-block mt-4 text-xs px-2 py-1 bg-slate-800 rounded text-slate-300 border border-slate-700">
              {selected.emotion === "positive"
                ? "🟢 " + t("results.emotion_positive")
                : selected.emotion === "negative"
                  ? "🔴 " + t("results.emotion_negative")
                  : "🔵 " + t("results.emotion_neutral")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

