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

interface HierarchyNode extends d3.HierarchyPointNode<TreeNode> {}

const MARGIN = { top: 20, right: 140, bottom: 20, left: 120 };
const NODE_RADIUS = 8;
const ROW_HEIGHT = 36;

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
    const height = Math.max(300, leafCount * ROW_HEIGHT + MARGIN.top + MARGIN.bottom);
    const width = Math.max(containerWidth, 600);

    const treeLayout = d3
      .tree<TreeNode>()
      .size([
        height - MARGIN.top - MARGIN.bottom,
        width - MARGIN.left - MARGIN.right,
      ]);

    const rootNode = treeLayout(root);

    svg.attr("width", width).attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // links
    g.selectAll(".dtree-link")
      .data(rootNode.links())
      .enter()
      .append("path")
      .attr("class", "dtree-link")
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 1.5)
      .attr(
        "d",
        d3
          .linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
          .x((d) => d.y)
          .y((d) => d.x) as any,
      );

    // nodes
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

    nodeGroup
      .append("circle")
      .attr("r", (d: HierarchyNode) =>
        d.data.node_type === "decision" ? NODE_RADIUS + 3 : NODE_RADIUS,
      )
      .attr("fill", (d: HierarchyNode) => d.data.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    nodeGroup
      .append("text")
      .attr("dy", "0.32em")
      .attr("x", (d: HierarchyNode) => (d.children ? -14 : 14))
      .attr("text-anchor", (d: HierarchyNode) =>
        d.children ? "end" : "start",
      )
      .attr("font-size", "12px")
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
