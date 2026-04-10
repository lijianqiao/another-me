/**
 * 推演状态管理
 *
 * Sprint 7：统一 FullSimulationResult（含 decision_tree）
 */

import { create } from "zustand";

import type { SimulateInput } from "../types";
import {
  simulateDecision,
  type FullSimulationResult,
} from "../api/simulate";

interface SimulationState {
  running: boolean;
  fullResult: FullSimulationResult | null;
  error: string | null;

  startSimulation: (input: SimulateInput) => Promise<void>;
  setHistoricalResult: (result: FullSimulationResult) => void;
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
