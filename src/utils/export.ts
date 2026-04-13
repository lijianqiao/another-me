/**
 * 前端导出工具
 * Sprint 9：JSON 下载 + 数据驱动 PDF 导出
 */

import type { Timeline } from "../types";
import type { TreeNode } from "../api/history";
import { readSystemFont } from "../api/system";

export function downloadAsFile(
  content: string,
  filename: string,
  mimeType = "application/json",
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// PDF Export — data-driven, no screenshots
// ============================================================================

interface LetterData {
  content: string;
  tone_type: string;
  shine_points: string[];
}

export interface PdfExportData {
  title: string;
  timelines: Timeline[];
  decisionTree?: TreeNode | null;
  letter?: LetterData | null;
  labels: {
    timeline: string;
    typeReality: string;
    typeParallel: string;
    typeExtreme: string;
    keyEvents: string;
    emotionSection: string;
    emotionEnergy: string;
    emotionSatisfaction: string;
    emotionRegret: string;
    emotionHope: string;
    emotionLoneliness: string;
    blackSwanLabel: string;
    decisionTreeTitle: string;
    letterTitle: string;
    letterTone: string;
    shinePoints: string;
    chartTitle: string;
    dimCareer: string;
    dimFinancial: string;
    dimHealth: string;
    dimRelationship: string;
    dimSatisfaction: string;
  };
}

const TYPE_LABEL_MAP: Record<string, keyof PdfExportData["labels"]> = {
  reality: "typeReality",
  parallel: "typeParallel",
  extreme: "typeExtreme",
};

const EMOTION_ICON: Record<string, string> = {
  positive: "[+]",
  neutral: "[o]",
  negative: "[-]",
};

const TIMELINE_COLORS: Record<string, [number, number, number]> = {
  reality: [59, 130, 246],   // blue
  parallel: [168, 85, 247],  // purple
  extreme: [244, 63, 94],    // rose
};

type Dimension = "career" | "financial" | "health" | "relationship" | "satisfaction";

const DIMENSIONS: Dimension[] = ["career", "financial", "health", "relationship", "satisfaction"];

const DIM_LABEL_MAP: Record<Dimension, keyof PdfExportData["labels"]> = {
  career: "dimCareer",
  financial: "dimFinancial",
  health: "dimHealth",
  relationship: "dimRelationship",
  satisfaction: "dimSatisfaction",
};

export async function exportResultsAsPdf(
  data: PdfExportData,
  filename: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  // Load system Chinese font via Tauri command
  try {
    const fontResult = await readSystemFont();
    const vfsName = `${fontResult.name}.ttf`;
    pdf.addFileToVFS(vfsName, fontResult.base64);
    pdf.addFont(vfsName, fontResult.name, "normal");
    pdf.setFont(fontResult.name);
  } catch {
    // fallback: default font (CJK may not render)
  }

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginL = 50;
  const marginR = 50;
  const contentW = pageW - marginL - marginR;
  let y = 50;

  // ---- helpers ----
  function ensureSpace(needed: number) {
    if (y + needed > pageH - 50) {
      pdf.addPage();
      y = 50;
    }
  }

  function drawTitle(text: string, size: number, color: [number, number, number] = [30, 30, 30]) {
    ensureSpace(size + 20);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(text, marginL, y);
    y += size + 8;
  }

  function drawText(text: string, size = 11, color: [number, number, number] = [50, 50, 50], indent = 0) {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentW - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      pdf.text(line, marginL + indent, y);
      y += size + 4;
    }
  }

  function drawSeparator() {
    ensureSpace(20);
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(marginL, y, pageW - marginR, y);
    y += 15;
  }

  // ---- 1. Title ----
  drawTitle(data.title, 22, [20, 20, 20]);
  y += 10;
  drawSeparator();

  // ---- 2. Timelines ----
  data.timelines.forEach((tl, i) => {
    const typeKey = TYPE_LABEL_MAP[tl.timeline_type];
    const typeLabel = typeKey ? data.labels[typeKey] : tl.timeline_type;

    drawTitle(`${data.labels.timeline} ${i + 1}  --  ${typeLabel}`, 14, [40, 40, 120]);
    y += 4;

    // Narrative
    const narrative = tl.narrative.replace(/\\n/g, "\n").trim();
    drawText(narrative, 11, [50, 50, 50], 10);
    y += 8;

    // Key events
    if (tl.key_events && tl.key_events.length > 0) {
      drawTitle(data.labels.keyEvents, 12, [60, 60, 60]);
      for (const evt of tl.key_events) {
        const icon = EMOTION_ICON[evt.emotion] ?? "[o]";
        drawText(`${evt.year}  ${icon}  ${evt.event}`, 10, [70, 70, 70], 15);
      }
      y += 4;
    }

    // Emotion dimensions
    if (tl.emotion) {
      drawTitle(data.labels.emotionSection, 12, [60, 60, 60]);
      const dims = [
        [data.labels.emotionEnergy, tl.emotion.energy],
        [data.labels.emotionSatisfaction, tl.emotion.satisfaction],
        [data.labels.emotionRegret, tl.emotion.regret],
        [data.labels.emotionHope, tl.emotion.hope],
        [data.labels.emotionLoneliness, tl.emotion.loneliness],
      ] as [string, number][];

      for (const [label, val] of dims) {
        ensureSpace(18);
        pdf.setFontSize(10);
        pdf.setTextColor(80, 80, 80);
        pdf.text(`${label}: `, marginL + 15, y);

        // mini bar
        const barX = marginL + 140;
        const barW = 150;
        const barH = 8;
        pdf.setFillColor(230, 230, 230);
        pdf.rect(barX, y - barH + 2, barW, barH, "F");
        pdf.setFillColor(80, 130, 220);
        pdf.rect(barX, y - barH + 2, barW * Math.max(0, Math.min(1, val)), barH, "F");

        pdf.setFontSize(9);
        pdf.text(`${Math.round(val * 100)}%`, barX + barW + 8, y);
        y += 14;
      }
      y += 4;
    }

    // Black swan
    if (tl.black_swan_event) {
      drawText(`[${data.labels.blackSwanLabel}] ${tl.black_swan_event}`, 10, [140, 100, 20], 10);
      y += 4;
    }

    drawSeparator();
  });

  // ---- 3. Decision tree (SVG → image) ----
  if (data.decisionTree) {
    const svgEl = document.querySelector(".decision-tree svg") as SVGSVGElement | null;
    if (svgEl) {
      ensureSpace(60);
      drawTitle(data.labels.decisionTreeTitle, 14, [40, 40, 120]);
      y += 4;

      try {
        const imgData = await svgToDataUrl(svgEl);
        const svgW = svgEl.getAttribute("width");
        const svgH = svgEl.getAttribute("height");
        const origW = svgW ? parseFloat(svgW) : 800;
        const origH = svgH ? parseFloat(svgH) : 400;
        const scale = Math.min(contentW / origW, (pageH - 100) / origH, 1);
        const imgW = origW * scale;
        const imgH = origH * scale;

        ensureSpace(imgH + 10);
        pdf.addImage(imgData, "PNG", marginL, y, imgW, imgH);
        y += imgH + 15;
      } catch {
        drawText("[Decision tree image could not be rendered]", 10, [150, 50, 50]);
      }
      drawSeparator();
    }
  }

  // ---- 4. Life charts — all 5 dimensions ----
  const hasChartData = data.timelines.some((tl) => tl.dimension_scores.length > 0);
  if (hasChartData) {
    drawTitle(data.labels.chartTitle, 16, [40, 40, 120]);
    y += 4;

    for (const dim of DIMENSIONS) {
      const dimLabel = data.labels[DIM_LABEL_MAP[dim]];
      drawDimensionChart(pdf, data.timelines, dim, dimLabel, marginL, contentW);
    }

    drawSeparator();
  }

  // ---- 5. Future letter ----
  if (data.letter) {
    drawTitle(data.labels.letterTitle, 14, [40, 40, 120]);
    y += 4;

    if (data.letter.tone_type) {
      drawText(`${data.labels.letterTone}: ${data.letter.tone_type}`, 10, [100, 100, 100]);
      y += 4;
    }

    const letterContent = data.letter.content.replace(/\\n/g, "\n").trim();
    drawText(letterContent, 11, [50, 50, 50], 10);
    y += 8;

    if (data.letter.shine_points && data.letter.shine_points.length > 0) {
      drawTitle(data.labels.shinePoints, 12, [60, 60, 60]);
      for (const sp of data.letter.shine_points) {
        drawText(`* ${sp}`, 10, [80, 80, 80], 15);
      }
    }
  }

  pdf.save(filename);

  // ---- chart drawing helper (uses closure over pdf/y) ----
  function drawDimensionChart(
    doc: InstanceType<typeof jsPDF>,
    timelines: Timeline[],
    dimension: Dimension,
    label: string,
    mL: number,
    cW: number,
  ) {
    const chartH = 130;
    const chartW = cW - 40;
    const chartLeft = mL + 30;
    const legendH = 20;

    ensureSpace(chartH + 60 + legendH);

    // Sub-title
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(label, mL, y);
    y += 16;

    const chartTop = y;

    // Collect all data points
    const yearSet = new Set<number>();
    timelines.forEach((tl) => {
      for (const s of tl.dimension_scores) yearSet.add(s.year);
    });
    const years = Array.from(yearSet).sort((a, b) => a - b);
    if (years.length < 2) {
      y += chartH + 10;
      return;
    }

    const minYear = years[0];
    const maxYear = years[years.length - 1];

    // Axes
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    // Y-axis
    doc.line(chartLeft, chartTop, chartLeft, chartTop + chartH);
    // X-axis
    doc.line(chartLeft, chartTop + chartH, chartLeft + chartW, chartTop + chartH);

    // Y-axis labels (0 to 100)
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    for (let v = 0; v <= 100; v += 25) {
      const yPos = chartTop + chartH - (v / 100) * chartH;
      doc.text(String(v), mL + 5, yPos + 3);
      if (v > 0 && v < 100) {
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.3);
        doc.line(chartLeft + 1, yPos, chartLeft + chartW, yPos);
      }
    }

    // X-axis labels
    const xStep = chartW / (years.length - 1);
    for (let i = 0; i < years.length; i++) {
      const xPos = chartLeft + i * xStep;
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text(String(years[i]), xPos - 8, chartTop + chartH + 12);
    }

    // Draw lines for each timeline
    timelines.forEach((tl) => {
      const color = TIMELINE_COLORS[tl.timeline_type] ?? [100, 100, 100];
      doc.setDrawColor(...color);
      doc.setLineWidth(1.2);

      const scores = tl.dimension_scores
        .filter((s) => yearSet.has(s.year))
        .sort((a, b) => a.year - b.year);

      for (let i = 1; i < scores.length; i++) {
        const prev = scores[i - 1];
        const curr = scores[i];
        const x1 = chartLeft + ((prev.year - minYear) / (maxYear - minYear)) * chartW;
        const y1 = chartTop + chartH - (prev[dimension] / 100) * chartH;
        const x2 = chartLeft + ((curr.year - minYear) / (maxYear - minYear)) * chartW;
        const y2 = chartTop + chartH - (curr[dimension] / 100) * chartH;
        doc.line(x1, y1, x2, y2);
      }

      // Data points
      for (const s of scores) {
        const cx = chartLeft + ((s.year - minYear) / (maxYear - minYear)) * chartW;
        const cy = chartTop + chartH - (s[dimension] / 100) * chartH;
        doc.setFillColor(...color);
        doc.circle(cx, cy, 2, "F");
      }
    });

    y = chartTop + chartH + 20;

    // Legend
    let legendX = chartLeft;
    timelines.forEach((tl) => {
      const color = TIMELINE_COLORS[tl.timeline_type] ?? [100, 100, 100];
      doc.setFillColor(...color);
      doc.rect(legendX, y - 5, 10, 5, "F");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const typeKey = TYPE_LABEL_MAP[tl.timeline_type];
      const typeLabel = typeKey ? data.labels[typeKey] : tl.timeline_type;
      doc.text(typeLabel, legendX + 14, y);
      legendX += doc.getTextWidth(typeLabel) + 30;
    });

    y += 20;
  }
}

/** Convert an SVG element to a PNG data URL via canvas */
async function svgToDataUrl(svgEl: SVGSVGElement): Promise<string> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG to image conversion failed"));
    };
    img.src = url;
  });
}
