/**
 * 推演状态管理
 *
 * Sprint 3：simulate_decision 完整流程
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

  reset: () =>
    set({
      running: false,
      fullResult: null,
      error: null,
    }),
}));
