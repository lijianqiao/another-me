/**
 * 推演状态管理
 *
 * Sprint 6：增加 setHistoricalResult 和 decision_tree 支持
 */

import { create } from "zustand";

import type { SimulateInput } from "../types";
import type { TreeNode } from "../api/history";
import {
  simulateDecision,
  type FullSimulationResult,
} from "../api/simulate";

export interface EnrichedResult extends FullSimulationResult {
  decision_tree?: TreeNode;
}

interface SimulationState {
  running: boolean;
  fullResult: EnrichedResult | null;
  error: string | null;

  startSimulation: (input: SimulateInput) => Promise<void>;
  setHistoricalResult: (result: EnrichedResult) => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  running: false,
  fullResult: null,
  error: null,

  startSimulation: async (input) => {
    set({ running: true, error: null, fullResult: null });
    try {
      const result = await simulateDecision(input);
      set({ running: false, fullResult: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ running: false, error: msg });
      throw err;
    }
  },

  setHistoricalResult: (result) =>
    set({ running: false, fullResult: result, error: null }),

  reset: () =>
    set({
      running: false,
      fullResult: null,
      error: null,
    }),
}));
