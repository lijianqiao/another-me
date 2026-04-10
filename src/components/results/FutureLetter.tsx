/**
 * 未来来信展示组件
 * 信件全文 + 闪光点
 */
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

export default function FutureLetter({ letter }: Props) {
  const { t } = useTranslation();
  const { content, tone_type, shine_points } = letter;
  const meta = TONE_META[tone_type];
  const emoji = meta?.emoji ?? "✉️";
  const toneLabel = meta ? t(meta.key) : tone_type;

  return (
    <div className="future-letter">
      <div className="future-letter__header">
        <span className="future-letter__icon">{emoji}</span>
        <h3 className="future-letter__title">{t("letter.title")}</h3>
        <span className="future-letter__tone">{toneLabel}</span>
      </div>

      <div className="future-letter__content">
        {content.split("\n").map((line, i) => (
          <p key={i} className={line.trim() === "" ? "future-letter__break" : ""}>
            {line}
          </p>
        ))}
      </div>

      {shine_points.length > 0 && <ShinePoints points={shine_points} />}
    </div>
  );
}
