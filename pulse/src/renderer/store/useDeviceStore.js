import { create } from 'zustand';

export const useDeviceStore = create((set, get) => ({
  // Transport state
  transport: { connected: false, type: 'NONE', latencyMs: 0, address: null },

  // Last 10 motor commands for HeadbandVisualizer
  recentCommands: [],

  setTransportStatus: (status) =>
    set({ transport: { ...get().transport, ...status } }),

  addCommand: (command) =>
    set((state) => ({
      recentCommands: [command, ...state.recentCommands].slice(0, 10),
    })),

  clearCommands: () => set({ recentCommands: [] }),
}));
