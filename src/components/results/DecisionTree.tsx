/**
 * 决策树可视化（D3.js 树形布局）
 *
 * 节点按类型着色：决策（珊瑚）、时间线（靛蓝/紫/琥珀）、事件（绿/灰/红）
 * 点击节点展开详情面板
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
      .attr("dy", 1)
      .attr("stdDeviation", 2)
      .attr("flood-color", "rgba(0,0,0,0.12)");

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    /* -------- links: smooth curves -------- */
    g.selectAll(".dtree-link")
      .data(rootNode.links())
      .enter()
      .append("path")
      .attr("class", "dtree-link")
      .attr("fill", "none")
      .attr("stroke", (d) => {
        const c = d3.color(d.target.data.color);
        return c ? c.copy({ opacity: 0.35 }).formatRgb() : "#cbd5e1";
      })
      .attr("stroke-width", 2)
      .attr(
        "d",
        d3
          .linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
          .x((d) => d.y)
          .y((d) => d.x) as any,
      );

    /* -------- nodes -------- */
    const nodeGroup = g
      .selectAll<SVGGElement, HierarchyNode>(".dtree-node")
      .data(rootNode.descendants())
      .enter()
      .append("g")
      .attr("class", "dtree-node")
      .attr("transform", (d: HierarchyNode) => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .on("click", (_evt: MouseEvent, d: HierarchyNode) => {
        setSelected(d.data);
      });

    /* outer glow ring for decision node */
    nodeGroup
      .filter((d: HierarchyNode) => d.data.node_type === "decision")
      .append("circle")
      .attr("r", NODE_RADIUS + 6)
      .attr("fill", "none")
      .attr("stroke", (d: HierarchyNode) => d.data.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0.5);

    nodeGroup
      .append("circle")
      .attr("r", (d: HierarchyNode) =>
        d.data.node_type === "decision" ? NODE_RADIUS + 4 : NODE_RADIUS,
      )
      .attr("fill", (d: HierarchyNode) => d.data.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2.5)
      .attr("filter", "url(#dtree-shadow)");

    nodeGroup
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d: HierarchyNode) => (d.children ? -16 : 16))
      .attr("text-anchor", (d: HierarchyNode) =>
        d.children ? "end" : "start",
      )
      .attr("font-size", "12px")
      .attr("font-weight", (d: HierarchyNode) =>
        d.data.node_type === "decision" ? "600" : "400",
      )
      .attr("fill", "#334155")
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
    <div className="decision-tree">
      <h3 className="decision-tree__title">
        {t("results.decision_tree_title")}
      </h3>
      <div className="decision-tree__container" ref={containerRef}>
        <svg ref={svgRef} />
      </div>
      {selected && (
        <div className="decision-tree__detail">
          <div className="decision-tree__detail-header">
            <span
              className="decision-tree__detail-dot"
              style={{ background: selected.color }}
            />
            <strong>{selected.label}</strong>
            <button
              className="decision-tree__detail-close"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
          </div>
          {selected.detail && (
            <p className="decision-tree__detail-text">{selected.detail}</p>
          )}
          {selected.emotion && (
            <span className="decision-tree__detail-emotion">
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
