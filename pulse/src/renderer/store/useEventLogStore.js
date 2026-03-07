import { create } from 'zustand';

const MAX_EVENTS = 5000;

export const useEventLogStore = create((set, get) => ({
  events: [],
  paused: false,
  filters: {
    category: '',
    direction: '',
    minConfidence: 0,
    transmittedOnly: false,
  },

  addEvent: (event) => {
    if (get().paused) return;
    set((state) => ({
      events: [event, ...state.events].slice(0, MAX_EVENTS),
    }));
  },

  clearEvents: () => set({ events: [] }),

  setPaused: (paused) => set({ paused }),

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),

  getFilteredEvents: () => {
    const { events, filters } = get();
    return events.filter((e) => {
      if (filters.category && e.category !== filters.category) return false;
      if (filters.direction && e.direction !== filters.direction) return false;
      if (filters.minConfidence && e.confidence < filters.minConfidence) return false;
      if (filters.transmittedOnly && !e.transmitted) return false;
      return true;
    });
  },
}));
