/**
 * 历史记录 + 锚定 + 人生地图 API 封装
 */

import { invokeCommand } from "./tauri";

export interface DecisionSummary {
  id: string;
  created_at: string;
  decision_text: string;
  time_horizon: string;
  drama_level: number;
  black_swan_enabled: boolean;
  is_anchored: boolean;
}

export interface TreeNode {
  id: string;
  label: string;
  node_type: string;
  color: string;
  emotion?: string | null;
  detail?: string | null;
  children: TreeNode[];
}

export interface HistoricalDecision {
  id: string;
  created_at: string;
  decision_text: string;
  time_horizon: string;
  context?: string | null;
  drama_level: number;
  black_swan_enabled: boolean;
  is_anchored: boolean;
  result: {
    decision_id: string;
    timelines: import("../types").Timeline[];
    letter?: string | null;
    decision_tree?: TreeNode | null;
    life_chart?: unknown;
  };
}

export interface LifeMapNode {
  id: string;
  profile_id: string;
  decision_id: string;
  node_date: string;
  node_label: string;
  node_type: string;
  outcome_summary: string;
  personality_changes: string[];
}

// 决策历史
export async function listDecisions(): Promise<DecisionSummary[]> {
  return invokeCommand<DecisionSummary[]>("list_decisions");
}

export async function getDecision(
  decisionId: string,
): Promise<HistoricalDecision> {
  return invokeCommand<HistoricalDecision>("get_decision", {
    decisionId,
  });
}

// 锚定时间线
export async function setAnchorTimeline(decisionId: string): Promise<void> {
  return invokeCommand("set_anchor_timeline", { decisionId });
}

export async function clearAnchor(decisionId: string): Promise<void> {
  return invokeCommand("clear_anchor", { decisionId });
}

export async function getAnchorTimeline(): Promise<string | null> {
  return invokeCommand<string | null>("get_anchor_timeline");
}

// 人生地图
export async function getLifeMap(): Promise<LifeMapNode[]> {
  return invokeCommand<LifeMapNode[]>("get_life_map");
}
