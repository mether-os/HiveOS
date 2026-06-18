import { create } from "zustand";
import { CanvasMode } from "../types";

interface CanvasState {
  activeMode: CanvasMode;
  setActiveMode: (mode: CanvasMode) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  activeMode: "Brainstorm",
  setActiveMode: (mode) => set({ activeMode: mode }),
}));
