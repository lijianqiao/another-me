/**
 * 历史记录 API 封装
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
