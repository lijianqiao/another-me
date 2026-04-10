/**
 * 画像状态
 *
 * - `profile`: 当前画像；null 表示尚未 Onboarding
 * - `status`: 异步加载状态
 * - `load()`: 启动时调用，决定是否跳 Onboarding
 * - `save(draft)`: 保存画像（upsert）
 */

import { create } from "zustand";

import { profileApi } from "../api";
import type { UserProfile, UserProfileDraft } from "../types";

type Status = "idle" | "loading" | "ready" | "error";

interface ProfileState {
  profile: UserProfile | null;
  status: Status;
  error: string | null;

  load: () => Promise<void>;
  save: (input: UserProfile | UserProfileDraft) => Promise<UserProfile>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  status: "idle",
  error: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const profile = await profileApi.getProfile();
      set({ profile, status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },

  save: async (input) => {
    set({ status: "loading", error: null });
    try {
      const profile = await profileApi.saveProfile(input);
      set({ profile, status: "ready" });
      return profile;
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
      throw err;
    }
  },

  reset: () => set({ profile: null, status: "idle", error: null }),
}));
