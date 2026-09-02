import { create } from 'zustand';
import type { TerminalLine, Problem, GenerationStep } from '@/types';

interface TerminalState {
  lines: TerminalLine[];
  problems: Problem[];
  generationSteps: GenerationStep[];
  isGenerating: boolean;
  isBuilding: boolean;
  buildLogs: string[];
  currentPhase: string | null;
  generationError: string | null;

  addLine: (line: Omit<TerminalLine, 'id' | 'timestamp'>) => void;
  clearLines: () => void;
  addProblem: (problem: Omit<Problem, 'id'>) => void;
  clearProblems: () => void;
  setGenerationSteps: (steps: GenerationStep[]) => void;
  updateStep: (id: string, update: Partial<GenerationStep>) => void;
  setGenerating: (generating: boolean) => void;
  setBuilding: (building: boolean) => void;
  addBuildLog: (log: string) => void;
  clearBuildLogs: () => void;
  setCurrentPhase: (phase: string | null) => void;
  setGenerationError: (error: string | null) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  lines: [],
  problems: [],
  generationSteps: [],
  isGenerating: false,
  isBuilding: false,
  buildLogs: [],
  currentPhase: null,
  generationError: null,

  addLine: (line) => set((s) => ({
    lines: [...s.lines, { ...line, id: crypto.randomUUID(), timestamp: Date.now() }],
  })),
  clearLines: () => set({ lines: [] }),
  addProblem: (problem) => set((s) => ({
    problems: [...s.problems, { ...problem, id: crypto.randomUUID() }],
  })),
  clearProblems: () => set({ problems: [] }),
  setGenerationSteps: (steps) => set({ generationSteps: steps }),
  updateStep: (id, update) => set((s) => ({
    generationSteps: s.generationSteps.map((step) =>
      step.id === id ? { ...step, ...update } : step
    ),
  })),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setBuilding: (building) => set({ isBuilding: building }),
  addBuildLog: (log) => set((s) => ({ buildLogs: [...s.buildLogs, log] })),
  clearBuildLogs: () => set({ buildLogs: [] }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setGenerationError: (error) => set({ generationError: error }),
}));
