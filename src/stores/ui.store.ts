import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  theme: "light" | "dark";
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark") => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  theme: "light",
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
}));
