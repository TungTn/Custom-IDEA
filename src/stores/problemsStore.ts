import { create } from 'zustand';
import { ProblemItem } from '../types';

export interface ProblemsState {
  diagnosticsMap: Map<string, ProblemItem[]>;
  inspectionProblems: ProblemItem[];
  isInspecting: boolean;

  setFileDiagnostics: (filePath: string, items: ProblemItem[]) => void;
  removeFileDiagnostics: (filePath: string) => void;
  setInspectionProblems: (problems: ProblemItem[]) => void;
  setIsInspecting: (inspecting: boolean) => void;
  getProblems: () => ProblemItem[];
}

export const useProblemsStore = create<ProblemsState>((set, get) => ({
  diagnosticsMap: new Map(),
  inspectionProblems: [],
  isInspecting: false,

  setFileDiagnostics: (filePath, items) =>
    set((state) => {
      const next = new Map(state.diagnosticsMap);
      if (items.length > 0) {
        next.set(filePath, items);
      } else {
        next.delete(filePath);
      }
      return { diagnosticsMap: next };
    }),

  removeFileDiagnostics: (filePath) =>
    set((state) => {
      const next = new Map(state.diagnosticsMap);
      next.delete(filePath);
      return { diagnosticsMap: next };
    }),

  setInspectionProblems: (problems) => set({ inspectionProblems: problems }),
  setIsInspecting: (isInspecting) => set({ isInspecting }),

  getProblems: () => {
    const { diagnosticsMap, inspectionProblems } = get();
    const combined: ProblemItem[] = [];
    const seen = new Set<string>();

    for (const items of diagnosticsMap.values()) {
      for (const item of items) {
        const key = `${item.filePath}:${item.line}:${item.column}:${item.message}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }
    }

    for (const item of inspectionProblems) {
      const key = `${item.filePath}:${item.line}:${item.column}:${item.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    return combined;
  },
}));
