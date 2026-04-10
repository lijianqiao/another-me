/**
 * 当下闪光点组件
 * 在来信末尾强制展示，提醒用户珍惜当下
 */

interface Props {
  points: string[];
}

export default function ShinePoints({ points }: Props) {
  if (points.length === 0) return null;

  return (
    <div className="shine-points">
      <h4 className="shine-points__title">✨ 当下的闪光点</h4>
      <ul className="shine-points__list">
        {points.map((point, i) => (
          <li key={i} className="shine-points__item">
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
