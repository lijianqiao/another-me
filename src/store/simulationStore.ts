/**
 * 推演状态管理
 *
 * Sprint 2：simulate_once 单次推演
 * Sprint 5：simulate_decision 5 次并发 + 聚类
 */

import { create } from "zustand";

import type { SimulateInput, SimulationResult } from "../types";
import { simulateOnce, type SimulationCandidate } from "../api/simulate";

interface SimulationProgress {
  current: number;
  total: number;
  message: string;
}

interface SimulationState {
  running: boolean;
  progress: SimulationProgress | null;
  result: SimulationResult | null;
  candidate: SimulationCandidate | null;
  error: string | null;

  startSimulation: (input: SimulateInput) => Promise<void>;
  runOnce: (input: SimulateInput) => Promise<void>;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  running: false,
  progress: null,
  result: null,
  candidate: null,
  error: null,

  startSimulation: async (_input) => {
    set({
      running: false,
      error: "simulate_decision 尚未实现（Sprint 5）",
    });
  },

  runOnce: async (input) => {
    set({ running: true, error: null, candidate: null });
    try {
      const candidate = await simulateOnce(input);
      set({ running: false, candidate });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ running: false, error: msg });
    }
  },

  reset: () =>
    set({
      running: false,
      progress: null,
      result: null,
      candidate: null,
      error: null,
    }),
}));
