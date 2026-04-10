"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: clustering.py
@DateTime: 2026-04-10
@Docs: TF-IDF + 余弦相似度聚类 — Farthest-First Traversal 多样性选取
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def cluster_narratives_tfidf(narratives: list[str], k: int = 3) -> list[int]:
    """
    将 narratives 聚类为 k 个类别，返回每个类别的代表性 narrative 索引。

    策略：
    1. TF-IDF 向量化所有 narrative
    2. 计算余弦相似度矩阵
    3. 选最中心的（与整体平均相似度最高）作为第一个代表
    4. Farthest-First Traversal：后续每次选与已选集合相似度最低的（最不同质）

    Args:
        narratives: 待聚类的叙事列表（通常 5 条）
        k: 最终归纳的时间线数量（默认 3）

    Returns:
        代表性 narrative 的索引列表，长度为 min(k, len(narratives))
    """
    n = len(narratives)

    if n <= k:
        return list(range(n))

    if n == 0:
        return []

    # 过滤空文本
    valid_indices = [i for i, text in enumerate(narratives) if text.strip()]
    if len(valid_indices) <= k:
        return valid_indices[:k]

    valid_texts = [narratives[i] for i in valid_indices]

    # Step 1: TF-IDF 向量化
    vectorizer = TfidfVectorizer(
        max_features=500,
        ngram_range=(1, 2),
        sublinear_tf=True,
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(valid_texts)
    except ValueError:
        # 所有文本都是停用词或为空 — 返回经 valid_indices 映射后的索引
        return valid_indices[:k]

    # Step 2: 余弦相似度矩阵
    sim_matrix = cosine_similarity(tfidf_matrix)

    # Step 3: 第一个代表 — 与整体平均相似度最高的（最中心）
    avg_sim = sim_matrix.mean(axis=1)
    first_idx = int(np.argmax(avg_sim))

    selected_local = [first_idx]
    remaining = set(range(len(valid_texts))) - {first_idx}

    # Step 4: Farthest-First Traversal — 每次选与已选集合最不相似的
    while len(selected_local) < k and remaining:
        max_distance = -1.0
        farthest_idx = -1

        for candidate in remaining:
            # 该候选与所有已选代表的最大相似度
            max_sim_to_selected = max(
                sim_matrix[candidate][s] for s in selected_local
            )
            # 取距离（1 - 相似度）最大的
            distance = 1.0 - max_sim_to_selected
            if distance > max_distance:
                max_distance = distance
                farthest_idx = candidate

        if farthest_idx >= 0:
            selected_local.append(farthest_idx)
            remaining.discard(farthest_idx)
        else:
            break

    # 映射回原始索引
    return [valid_indices[i] for i in selected_local]
