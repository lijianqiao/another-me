"""
@Author: li
@Email: lijianqiao2906@live.com
@FileName: test_realism_factor.py
@DateTime: 2026-04-10
@Docs: 现实主义因子计算测试
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "python"))

from another_me.nlp.realism_factor import check_realism


def test_balanced_narrative():
    """正负比例均衡的叙事"""
    text = (
        "他辞职创业，起初很顺利，获得了第一笔融资。"
        "但半年后市场下行，公司陷入困境。"
        "好在团队齐心协力，艰难度过危机。"
        "两年后公司开始盈利，但他感到身体疲惫。"
        "最终他学会了平衡工作和生活。"
    )
    result = check_realism(text)
    assert "status" in result, f"缺少 status 字段: {result}"
    print(f"  均衡叙事: status={result['status']}, ratio={result.get('positivity_ratio', 'N/A')}")


def test_too_positive():
    """过于正面的叙事"""
    text = (
        "他一切都很顺利，升职加薪，买房买车。"
        "遇到了完美的伴侣，婚姻幸福美满。"
        "事业蒸蒸日上，成为行业领袖。"
        "家庭和睦，孩子成绩优异。"
        "生活完美无缺，人人羡慕。"
    )
    result = check_realism(text)
    assert "status" in result
    print(f"  正面叙事: status={result['status']}, ratio={result.get('positivity_ratio', 'N/A')}")


def test_too_negative():
    """过于负面的叙事"""
    text = (
        "失业后找不到工作，积蓄耗尽。"
        "感情破裂，朋友疏远。"
        "健康出了问题，看病花光积蓄。"
        "整日焦虑失眠，精神状态很差。"
        "看不到任何希望，前路一片灰暗。"
    )
    result = check_realism(text)
    assert "status" in result
    print(f"  负面叙事: status={result['status']}, ratio={result.get('positivity_ratio', 'N/A')}")


def test_empty_narrative():
    """空叙事"""
    result = check_realism("")
    assert "status" in result
    print(f"  空叙事: status={result['status']}")


if __name__ == "__main__":
    tests = [
        test_balanced_narrative,
        test_too_positive,
        test_too_negative,
        test_empty_narrative,
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
