/**
 * 应用设置状态
 */

import { create } from "zustand";

import { settingsApi } from "../api";
import type { AppSettings, AppSettingsPatch } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  language: "zh",
  drama_level: 1,
  black_swan_enabled: false,
  safety_valve_enabled: true,
  active_model_id: "qwen3.5:4b",
  active_provider: "ollama",
  update_check_frequency: "weekly",
  last_update_check: null,
  audio_enabled: false,
  daily_simulation_count: 0,
  last_simulation_date: null,
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  error: string | null;

  load: () => Promise<void>;
  update: (patch: AppSettingsPatch) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  error: null,

  load: async () => {
    try {
      const settings = await settingsApi.getSettings();
      set({ settings, loaded: true });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  update: async (patch) => {
    try {
      const settings = await settingsApi.updateSettings(patch);
      set({ settings });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },
}));
