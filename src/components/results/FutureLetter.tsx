/**
 * 未来来信展示组件
 * 信件全文 + 闪光点 + 复制按钮
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

import ShinePoints from "../common/ShinePoints";

interface LetterData {
  content: string;
  tone_type: string;
  shine_points: string[];
}

interface Props {
  letter: LetterData;
}

/** Backend tone keys (Chinese canonical) → emoji + i18n lookup key */
const TONE_META: Record<string, { emoji: string; key: string }> = {
  "疲惫感慨型": { emoji: "🌙", key: "letter.tone_tired" },
  "沉默疏离型": { emoji: "🌫️", key: "letter.tone_silent" },
  "温暖鼓励型": { emoji: "☀️", key: "letter.tone_warm" },
  "平静叙述型": { emoji: "📖", key: "letter.tone_calm" },
  "黑色幽默型": { emoji: "🃏", key: "letter.tone_dark" },
};

/** Normalize literal escaped newlines from JSON (\\n) into real newlines */
function normalizeContent(raw: string): string {
  let text = raw;
  try {
    text = text.replace(/^\s*\`\`\`json\s*\n/im, '').replace(/\n\s*\`\`\`\s*$/im, '').trim();
    if (text.startsWith('{') && text.endsWith('}')) {
      const parsed = JSON.parse(text);
      const contentKeys = ['信件内容', 'content', 'letter', 'message'];
      let foundKey = Object.keys(parsed).find(k => contentKeys.some(pk => k.includes(pk))) || Object.keys(parsed)[0];
      if (foundKey && typeof parsed[foundKey] === 'string') {
        text = parsed[foundKey];
      }
    } else if (text.startsWith('{') && text.includes('"信件内容"')) {
      const match = text.match(/"信件内容"\s*:\s*"([\s\S]*?)"\s*\}/);
      if (match) text = match[1];
    }
  } catch (e) {}
  return text.replace(/\\n/g, '\n').trim();
}

export default function FutureLetter({ letter }: Props) {
  const { t } = useTranslation();
  const { content, tone_type, shine_points } = letter;
  const meta = TONE_META[tone_type];
  const emoji = meta?.emoji ?? "✉️";
  const toneLabel = meta ? t(meta.key) : tone_type;

  const normalized = normalizeContent(content);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: ignore */
    }
  };

  return (
    <div className="future-letter">
      <div className="future-letter__header">
        <span className="future-letter__icon">{emoji}</span>
        <h3 className="future-letter__title">{t("letter.title")}</h3>
        <span className="future-letter__tone">{toneLabel}</span>
        <button
          className="future-letter__copy"
          onClick={handleCopy}
          title={t("letter.copy")}
        >
          {copied ? "✓" : "📋"}
        </button>
      </div>

      <div className="future-letter__content">
        {normalized.split("\n").map((line, i) => (
          <p key={i} className={line.trim() === "" ? "future-letter__break" : ""}>
            {line}
          </p>
        ))}
      </div>

      {shine_points.length > 0 && <ShinePoints points={shine_points} />}
    </div>
  );
}
