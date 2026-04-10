import type { UserProfile, UserProfileDraft } from "../types";
import { invokeCommand } from "./tauri";

export async function getProfile(): Promise<UserProfile | null> {
  return invokeCommand<UserProfile | null>("get_profile");
}

export async function saveProfile(
  input: UserProfile | UserProfileDraft,
): Promise<UserProfile> {
  return invokeCommand<UserProfile>("save_profile", { input });
}
