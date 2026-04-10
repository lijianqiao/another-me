/**
 * 未来来信展示组件
 * 信件全文 + 闪光点
 */
import ShinePoints from "../common/ShinePoints";

interface LetterData {
  content: string;
  tone_type: string;
  shine_points: string[];
}

interface Props {
  letter: LetterData;
}

const TONE_EMOJI: Record<string, string> = {
  "疲惫感慨型": "🌙",
  "沉默疏离型": "🌫️",
  "温暖鼓励型": "☀️",
  "平静叙述型": "📖",
  "黑色幽默型": "🃏",
};

export default function FutureLetter({ letter }: Props) {
  const { content, tone_type, shine_points } = letter;
  const emoji = TONE_EMOJI[tone_type] ?? "✉️";

  return (
    <div className="future-letter">
      <div className="future-letter__header">
        <span className="future-letter__icon">{emoji}</span>
        <h3 className="future-letter__title">来自未来的信</h3>
        <span className="future-letter__tone">{tone_type}</span>
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
