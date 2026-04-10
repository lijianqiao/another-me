/**
 * 将长叙事拆成可读段落：保留已有换行；否则在句末标点后换行。
 */
export function splitNarrativeParagraphs(text: string): string[] {
  const t = text.trim();
  if (!t) return [];

  if (/\n{2,}/.test(t) || t.includes("\n")) {
    return t
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const chunks: string[] = [];
  let buf = "";
  for (const ch of t) {
    buf += ch;
    if ("。！？…!?".includes(ch)) {
      const s = buf.trim();
      if (s) chunks.push(s);
      buf = "";
    }
  }
  const rest = buf.trim();
  if (rest) chunks.push(rest);
  return chunks.length > 0 ? chunks : [t];
}
