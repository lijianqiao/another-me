/**
 * 推演结果页
 * 展示时间线卡片 + 未来来信
 */
import { useNavigate } from "react-router-dom";

import TimelineCard from "../components/results/TimelineCard";
import FutureLetter from "../components/results/FutureLetter";
import { useSimulationStore } from "../store";

export default function ResultsPage() {
  const navigate = useNavigate();
  const result = useSimulationStore((s) => s.fullResult);
  const reset = useSimulationStore((s) => s.reset);

  if (!result) {
    return (
      <section className="results-page">
        <p>没有推演结果。</p>
        <button className="btn btn--primary" onClick={() => navigate("/simulate")}>
          去推演
        </button>
      </section>
    );
  }

  const {
    timelines,
    letter,
    dark_content_warning,
    emotional_recovery_needed,
  } = result;

  return (
    <section className="results-page">
      <div className="results-page__header">
        <h2>推演结果</h2>
        <button
          className="btn"
          onClick={() => {
            reset();
            navigate("/simulate");
          }}
        >
          再来一次
        </button>
      </div>

      {dark_content_warning && (
        <div className="results-page__warning">
          ⚠️ 本次推演包含较为沉重的内容。这只是众多可能性中的一种，不代表实际的未来。
        </div>
      )}

      {emotional_recovery_needed && (
        <div className="results-page__recovery">
          💙 推演中检测到多个情绪维度偏低。
          记住，真实的人生总有转机，AI 推演只是一种参考。
          如果你感到不安，可以和朋友聊聊。
        </div>
      )}

      <div className="results-page__timelines">
        {timelines.map((tl, i) => (
          <TimelineCard key={tl.id} timeline={tl} index={i} />
        ))}
      </div>

      {letter && (
        <FutureLetter letter={letter} />
      )}
    </section>
  );
}
