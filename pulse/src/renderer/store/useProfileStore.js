import { create } from 'zustand';

const COMMUNITY_PROFILES = [
  {
    id: 'community-cs2',
    name: 'CS2',
    process: 'cs2.exe',
    hfThreshold: 0.65,
    priorityMap: { GUNSHOT: 1, EXPLOSION: 1, FOOTSTEP: 2, ABILITY: 2, RELOAD: 4, ALERT: 3, UNKNOWN: 4 },
    enabledCats: ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'RELOAD'],
    patterns: {},
    community: true,
  },
  {
    id: 'community-valorant',
    name: 'Valorant',
    process: 'VALORANT-Win64-Shipping.exe',
    hfThreshold: 0.6,
    priorityMap: { GUNSHOT: 1, EXPLOSION: 1, FOOTSTEP: 2, ABILITY: 1, RELOAD: 4, ALERT: 3, UNKNOWN: 4 },
    enabledCats: ['GUNSHOT', 'FOOTSTEP', 'ABILITY', 'EXPLOSION'],
    patterns: {},
    community: true,
  },
  {
    id: 'community-apex',
    name: 'Apex Legends',
    process: 'r5apex.exe',
    hfThreshold: 0.62,
    priorityMap: { GUNSHOT: 1, EXPLOSION: 2, FOOTSTEP: 2, ABILITY: 2, RELOAD: 4, ALERT: 3, UNKNOWN: 4 },
    enabledCats: ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'ABILITY'],
    patterns: {},
    community: true,
  },
  {
    id: 'community-overwatch',
    name: 'Overwatch 2',
    process: 'Overwatch.exe',
    hfThreshold: 0.68,
    priorityMap: { GUNSHOT: 1, EXPLOSION: 1, FOOTSTEP: 3, ABILITY: 2, RELOAD: 4, ALERT: 2, UNKNOWN: 4 },
    enabledCats: ['GUNSHOT', 'ABILITY', 'ALERT', 'EXPLOSION'],
    patterns: {},
    community: true,
  },
];

export const useProfileStore = create((set, get) => ({
  profiles: [],
  communityProfiles: COMMUNITY_PROFILES,
  activeProfileId: null,

  setProfiles: (profiles) => set({ profiles }),

  setActiveProfile: (id) => set({ activeProfileId: id }),

  loadProfiles: async () => {
    if (!window.electronAPI) return;
    const profiles = await window.electronAPI.profiles.list();
    set({ profiles });
  },

  saveProfile: async (profile) => {
    if (!window.electronAPI) return { ok: false };
    const result = await window.electronAPI.profiles.save(profile);
    if (result.ok) await get().loadProfiles();
    return result;
  },

  deleteProfile: async (id) => {
    if (!window.electronAPI) return { ok: false };
    const result = await window.electronAPI.profiles.delete(id);
    if (result.ok) await get().loadProfiles();
    return result;
  },
}));
