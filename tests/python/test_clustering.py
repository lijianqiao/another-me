"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: test_clustering.py
@DateTime: 2026-04-10
@Docs: TF-IDF 聚类算法测试
"""

import sys
from pathlib import Path

# 将 python/ 目录加入路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from another_me.nlp.clustering import cluster_narratives_tfidf


def test_basic_clustering():
    """5 条叙事聚类为 3 条"""
    narratives = [
        "他辞职创业，经历了艰难的起步期，最终公司上市。",
        "她选择继续深造，读完博士后在高校找到了教职。",
        "他在原公司稳步升迁，成为部门主管，生活平稳。",
        "她辞职创业，虽然初期困难重重，但最终找到了方向。",
        "他选择出国留学，在国外获得了学位后定居。",
    ]
    indices = cluster_narratives_tfidf(narratives, k=3)

    assert len(indices) == 3, f"应返回 3 个索引，实际 {len(indices)}"
    assert len(set(indices)) == 3, "索引不应重复"
    assert all(0 <= idx < 5 for idx in indices), "索引应在有效范围内"
    print(f"  聚类索引: {indices}")


def test_few_narratives():
    """少于 k 条时直接返回全部"""
    narratives = ["叙事A", "叙事B"]
    indices = cluster_narratives_tfidf(narratives, k=3)
    assert indices == [0, 1], f"少于 k 条应返回全部，实际 {indices}"


def test_single_narrative():
    """只有一条叙事"""
    indices = cluster_narratives_tfidf(["唯一叙事"], k=3)
    assert indices == [0]


def test_empty():
    """空列表"""
    indices = cluster_narratives_tfidf([], k=3)
    assert indices == []


def test_diversity():
    """验证 Farthest-First Traversal 产生多样性"""
    # 3 条相似 + 2 条不同
    narratives = [
        "他继续在公司工作，稳步升迁，生活平稳安定。",
        "他继续在公司工作，逐步升迁，生活安稳幸福。",
        "他继续在公司工作，慢慢升职，日子过得平淡。",
        "她辞职创业，经历了大起大落，最终成功上市。",
        "他出国留学，在异国他乡经历了文化冲击和成长。",
    ]
    indices = cluster_narratives_tfidf(narratives, k=3)

    assert len(indices) == 3
    # 前 3 条非常相似，FFT 应该最多选其中 1 条
    similar_selected = sum(1 for i in indices if i < 3)
    assert similar_selected <= 2, f"3 条相似叙事中选了 {similar_selected} 条，多样性不足"
    print(f"  多样性聚类索引: {indices}")


def test_identical_narratives():
    """完全相同的叙事"""
    narratives = ["同一段话"] * 5
    indices = cluster_narratives_tfidf(narratives, k=3)
    assert len(indices) == 3


if __name__ == "__main__":
    tests = [
        test_basic_clustering,
        test_few_narratives,
        test_single_narrative,
        test_empty,
        test_diversity,
        test_identical_narratives,
    ]

    passed = 0
    failed = 0
    for test in tests:
        name = test.__name__
        try:
            test()
            print(f"  PASS {name}")
            passed += 1
        except Exception as e:
            print(f"  FAIL {name}: {e}")
            failed += 1

    print(f"\n结果: {passed} 通过, {failed} 失败")
    sys.exit(1 if failed > 0 else 0)
