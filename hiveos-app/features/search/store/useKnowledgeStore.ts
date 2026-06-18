import { create } from "zustand";

export type EntityType = "node" | "document" | "activity" | "mutation";

export interface SelectedEntity {
  id: string;
  type: EntityType;
  title: string;
}

interface KnowledgeState {
  selectedEntity: SelectedEntity | null;
  inspectorOpen: boolean;
  commandPaletteOpen: boolean;
  
  // Actions
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setInspectorOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  
  // High-level triggers
  inspectEntity: (id: string, type: EntityType, title: string) => void;
  clearSelection: () => void;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  selectedEntity: null,
  inspectorOpen: false,
  commandPaletteOpen: false,

  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  inspectEntity: (id, type, title) =>
    set({
      selectedEntity: { id, type, title },
      inspectorOpen: true,
    }),

  clearSelection: () =>
    set({
      selectedEntity: null,
      inspectorOpen: false,
    }),
}));
