import { create } from 'zustand';
import type { TerminalLine, Problem, GenerationStep } from '@/types';
import type { SSEAgentEvent } from '@/agent/harnessClient';

interface TerminalState {
  lines: TerminalLine[];
  problems: Problem[];
  generationSteps: GenerationStep[];
  agentEvents: SSEAgentEvent[];
  isGenerating: boolean;
  /** A general question is being answered — no code pipeline, no preview takeover. */
  isAnswering: boolean;
  /** Which pipeline UI is active: full creation ('create') or targeted fix ('fix'). */
  runMode: 'create' | 'fix' | null;
  isBuilding: boolean;
  buildLogs: string[];
  currentPhase: string | null;
  generationError: string | null;
  /** Real file paths the running agent has produced (drives the
      center progress view — never placeholder chips). */
  liveFiles: string[];

  addLine: (line: Omit<TerminalLine, 'id' | 'timestamp'>) => void;
  clearLines: () => void;
  addProblem: (problem: Omit<Problem, 'id'>) => void;
  clearProblems: () => void;
  setGenerationSteps: (steps: GenerationStep[]) => void;
  updateStep: (id: string, update: Partial<GenerationStep>) => void;
  addAgentEvent: (event: SSEAgentEvent) => void;
  clearAgentEvents: () => void;
  setGenerating: (generating: boolean) => void;
  setAnswering: (answering: boolean) => void;
  setRunMode: (mode: 'create' | 'fix' | null) => void;
  setBuilding: (building: boolean) => void;
  addBuildLog: (log: string) => void;
  clearBuildLogs: () => void;
  setCurrentPhase: (phase: string | null) => void;
  setGenerationError: (error: string | null) => void;
  addLiveFile: (path: string) => void;
  clearLiveFiles: () => void;
}

// Execution/Build logs are append-only during long sessions — cap them so
// the log panels (and their DOM) don't grow without bound.
const MAX_LINES = 300;
const MAX_BUILD_LOGS = 300;
const MAX_AGENT_EVENTS = 200;

export const useTerminalStore = create<TerminalState>((set) => ({
  lines: [],
  problems: [],
  generationSteps: [],
  agentEvents: [],
  isGenerating: false,
  isAnswering: false,
  runMode: null,
  isBuilding: false,
  buildLogs: [],
  currentPhase: null,
  generationError: null,
  liveFiles: [],

  addLine: (line) => set((s) => {
    const next = [...s.lines, { ...line, id: crypto.randomUUID(), timestamp: Date.now() }];
    return { lines: next.length > MAX_LINES ? next.slice(-MAX_LINES) : next };
  }),
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
  addAgentEvent: (event) => set((s) => {
    const next = [...s.agentEvents, event];
    return { agentEvents: next.length > MAX_AGENT_EVENTS ? next.slice(-MAX_AGENT_EVENTS) : next };
  }),
  clearAgentEvents: () => set({ agentEvents: [] }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setAnswering: (answering) => set({ isAnswering: answering }),
  setRunMode: (mode) => set({ runMode: mode }),
  setBuilding: (building) => set({ isBuilding: building }),
  addBuildLog: (log) => set((s) => {
    const next = [...s.buildLogs, log];
    return { buildLogs: next.length > MAX_BUILD_LOGS ? next.slice(-MAX_BUILD_LOGS) : next };
  }),
  clearBuildLogs: () => set({ buildLogs: [] }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setGenerationError: (error) => set({ generationError: error }),
  addLiveFile: (path) => set((s) => (s.liveFiles.includes(path) ? s : { liveFiles: [...s.liveFiles, path] })),
  clearLiveFiles: () => set({ liveFiles: [] }),
}));
