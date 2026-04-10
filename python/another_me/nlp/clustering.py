"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: clustering.py
@DateTime: 2026-04-10
@Docs: TF-IDF + 余弦相似度聚类 — Sprint 5 完整实现，当前为骨架
"""


def cluster_narratives_tfidf(narratives: list[str], k: int = 3) -> list[int]:
    """
    将 narratives 聚类为 k 个类别，返回每个类别的代表性 narrative 索引。

    Args:
        narratives: 待聚类的叙事列表
        k: 目标类别数

    Returns:
        代表性 narrative 的索引列表
    """
    if len(narratives) <= k:
        return list(range(len(narratives)))

    # Sprint 5 实现完整 TF-IDF + Farthest-First Traversal
    # 当前简单返回前 k 个索引
    return list(range(k))
