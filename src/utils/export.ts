/**
 * 前端导出工具
 * Sprint 9：JSON 下载 + DOM 截图
 */

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

export async function exportElementAsPng(
  selector: string,
  filename: string,
): Promise<void> {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);

  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(element as HTMLElement, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
  });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
