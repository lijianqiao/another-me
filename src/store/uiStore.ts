/**
 * UI 全局状态：Toast、Modal、侧栏展开状态等。
 * Sprint 1 仅实现 Toast 基础设施。
 */

import { create } from "zustand";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  createdAt: number;
  action?: ToastAction;
}

interface UiState {
  sidebarOpen: boolean;
  toasts: Toast[];

  toggleSidebar: () => void;
  pushToast: (
    kind: ToastKind,
    message: string,
    action?: ToastAction,
  ) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  toasts: [],

  toggleSidebar: () =>
    set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  pushToast: (kind, message, action) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
          id: ++toastSeq,
          kind,
          message,
          createdAt: Date.now(),
          action,
        },
      ],
    })),

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
