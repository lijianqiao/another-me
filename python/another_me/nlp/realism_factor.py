"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: realism_factor.py
@DateTime: 2026-04-10
@Docs: 现实主义因子计算 — 确保推演结果既不过于乐观也不过于悲观
"""

from snownlp import SnowNLP
from dataclasses import dataclass
from enum import Enum


class RealismStatus(Enum):
    """现实主义检查状态"""
    BALANCED = "BALANCED"
    TOO_POSITIVE = "TOO_POSITIVE"
    TOO_NEGATIVE = "TOO_NEGATIVE"


@dataclass
class RealismCheckResult:
    """现实主义检查结果"""
    status: RealismStatus
    positivity_ratio: float
    suggestion: str | None


class RealismChecker:
    """
    现实主义因子校验器

    积极:消极 比例应维持在 4:6 到 6:4 之间。
    使用 SnowNLP 对叙事文本做情感分析，统计正负句比例。
    """

    POSITIVITY_MIN = 0.4
    POSITIVITY_MAX = 0.6

    def check(self, narrative: str) -> RealismCheckResult:
        """
        检查叙事文本的正负比例

        Args:
            narrative: 推演叙事文本

        Returns:
            现实主义检查结果
        """
        sentences = SnowNLP(narrative).sentences
        positive_count = 0
        negative_count = 0

        for sent in sentences:
            if len(sent) < 5:
                continue
            sentiment = SnowNLP(sent).sentiments
            if sentiment > 0.6:
                positive_count += 1
            elif sentiment < 0.4:
                negative_count += 1

        total = positive_count + negative_count + 0.001
        positivity_ratio = positive_count / total

        if positivity_ratio > self.POSITIVITY_MAX:
            return RealismCheckResult(
                status=RealismStatus.TOO_POSITIVE,
                positivity_ratio=round(positivity_ratio, 3),
                suggestion="需要注入挫折和低谷",
            )
        elif positivity_ratio < self.POSITIVITY_MIN:
            return RealismCheckResult(
                status=RealismStatus.TOO_NEGATIVE,
                positivity_ratio=round(positivity_ratio, 3),
                suggestion="需要注入希望和高光时刻",
            )
        else:
            return RealismCheckResult(
                status=RealismStatus.BALANCED,
                positivity_ratio=round(positivity_ratio, 3),
                suggestion=None,
            )


def check_realism(narrative: str) -> dict:
    """
    主入口函数（供 Rust subprocess 调用）

    Args:
        narrative: 推演叙事文本

    Returns:
        包含 status / positivity_ratio / suggestion 的字典
    """
    checker = RealismChecker()
    result = checker.check(narrative)
    return {
        "status": result.status.value,
        "positivity_ratio": result.positivity_ratio,
        "suggestion": result.suggestion,
    }
