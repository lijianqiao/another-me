/**
 * 未来来信展示组件
 * 信封 + 信纸样式 + 闪光点 + 复制按钮
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

  const today = new Date();
  const dateStr = today.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 信封外壳 */}
      <div className="relative max-w-2xl mx-auto">
        {/* 邮票装饰 */}
        <div className="absolute -top-3 -right-2 z-10 w-16 h-20 border-2 border-dashed border-muted-foreground/30 rounded-sm bg-card flex flex-col items-center justify-center gap-1 rotate-3 shadow-sm">
          <span className="text-2xl leading-none">{emoji}</span>
          <span className="text-[8px] text-muted-foreground font-mono tracking-wider">{t("letter.stamp")}</span>
        </div>

        {/* 信纸主体 */}
        <div
          className="relative rounded-lg shadow-lg overflow-hidden"
          style={{
            background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.95) 100%)",
          }}
        >
          {/* 顶部装饰条 — 信封折痕效果 */}
          <div className="h-1.5 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40" />

          {/* 信纸内容区 */}
          <div
            className="px-8 py-8 sm:px-12 sm:py-10"
            style={{
              backgroundImage:
                "repeating-linear-gradient(transparent, transparent 31px, hsl(var(--border) / 0.3) 31px, hsl(var(--border) / 0.3) 32px)",
              backgroundPositionY: "8px",
            }}
          >
            {/* 信头 */}
            <div className="flex items-start justify-between mb-8 pb-4 border-b border-border/50">
              <div>
                <h3 className="m-0 text-xl font-semibold text-foreground tracking-wide">
                  {t("letter.title")}
                </h3>
                <p className="m-0 mt-1 text-xs text-muted-foreground italic">{t("letter.from_future")}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-xs text-muted-foreground">{dateStr}</span>
                <span className="inline-flex items-center gap-1 mt-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {emoji} {toneLabel}
                </span>
              </div>
            </div>

            {/* 称呼 */}
            <p className="text-base text-foreground font-serif mb-6">{t("letter.greeting")}</p>

            {/* 正文 */}
            <div className="text-base leading-[2.2] text-foreground font-serif tracking-wide">
              {normalized.split("\n").map((line, i) => (
                <p key={i} className={`m-0 mb-3 indent-8 ${line.trim() === "" ? "h-4" : ""}`}>
                  {line}
                </p>
              ))}
            </div>

            {/* 落款 */}
            <div className="mt-12 pt-8 border-t border-border/30 flex items-end justify-between">
              <div className="text-base text-foreground font-serif">
                <p className="m-0 italic text-muted-foreground">{t("letter.closing")}</p>
                <p className="m-0 mt-2 font-bold text-lg">{t("letter.signature")}</p>
              </div>
              <button
                className="inline-flex items-center gap-1.5 border border-border bg-background text-muted-foreground cursor-pointer text-xs px-3 py-1.5 rounded-md transition-colors hover:bg-secondary hover:text-foreground font-sans"
                onClick={handleCopy}
                title={t("letter.copy")}
              >
                {copied ? "✓" : "📋"} {t("letter.copy")}
              </button>
            </div>
          </div>

          {/* 底部装饰条 */}
          <div className="h-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
        </div>

        {/* 信纸阴影装饰 — 层叠效果 */}
        <div className="absolute -bottom-1 left-2 right-2 h-3 rounded-b-lg bg-card/50 border border-t-0 border-border/30 -z-10" />
        <div className="absolute -bottom-2.5 left-4 right-4 h-3 rounded-b-lg bg-card/30 border border-t-0 border-border/20 -z-20" />
      </div>

      {shine_points.length > 0 && (
        <div className="max-w-2xl mx-auto mt-6">
          <ShinePoints points={shine_points} />
        </div>
      )}
    </div>
  );
}

