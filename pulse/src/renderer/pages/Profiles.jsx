import React, { useEffect, useState } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import PrioritySlider from '../components/PrioritySlider';

const EMPTY_PROFILE = {
  id: '',
  name: '',
  process: '',
  hfThreshold: 0.65,
  priorityMap: { GUNSHOT: 1, EXPLOSION: 1, FOOTSTEP: 2, ABILITY: 2, RELOAD: 4, ALERT: 3, UNKNOWN: 4 },
  enabledCats: ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'ABILITY', 'RELOAD', 'ALERT'],
  patterns: {},
};

const ALL_CATEGORIES = ['GUNSHOT', 'FOOTSTEP', 'EXPLOSION', 'ABILITY', 'RELOAD', 'ALERT', 'UNKNOWN'];

export default function Profiles() {
  const { profiles, communityProfiles, loadProfiles, saveProfile, deleteProfile } = useProfileStore();
  const [modal, setModal] = useState(null); // null | 'new' | profile object

  useEffect(() => { loadProfiles(); }, []);

  const openNew = () => setModal({ ...EMPTY_PROFILE, id: `profile-${Date.now()}`, createdAt: Date.now() });
  const openEdit = (p) => setModal({ ...p });
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!modal.name || !modal.process) return;
    await saveProfile(modal);
    closeModal();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this profile?')) await deleteProfile(id);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Game Profiles</h1>
        <button onClick={openNew} className="bg-accent text-white px-4 py-2 rounded-lg text-sm hover:bg-accent/80">
          + New Profile
        </button>
      </div>

      {/* User profiles */}
      <div className="mb-6">
        <div className="text-xs text-text-muted uppercase tracking-wider mb-3">Your Profiles</div>
        {profiles.length === 0 && (
          <div className="text-text-muted text-sm">No profiles yet. Create one above.</div>
        )}
        <div className="grid grid-cols-1 gap-3">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} onEdit={() => openEdit(p)} onDelete={() => handleDelete(p.id)} />
          ))}
        </div>
      </div>

      {/* Community profiles */}
      <div>
        <div className="text-xs text-text-muted uppercase tracking-wider mb-3">
          Community Profiles — <span className="normal-case font-normal">pre-tuned settings for popular games. Click Use to add to your profiles.</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {communityProfiles.map((p) => (
            <ProfileCard key={p.id} profile={p} community
              onUse={() => saveProfile({ ...p, id: `profile-${Date.now()}`, community: false, createdAt: Date.now() })} />
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface border border-muted rounded-xl p-6 w-[520px] max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{modal.createdAt && !profiles.find(p => p.id === modal.id) ? 'New Profile' : 'Edit Profile'}</h2>

            <div className="flex flex-col gap-3 mb-4">
              <label className="text-sm text-text-muted">Game Name
                <input className="mt-1 w-full bg-muted border border-muted rounded px-3 py-2 text-text text-sm outline-none focus:border-accent"
                  value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="e.g. CS2" />
              </label>
              <label className="text-sm text-text-muted">Process Name
                <input className="mt-1 w-full bg-muted border border-muted rounded px-3 py-2 text-text text-sm outline-none focus:border-accent"
                  value={modal.process} onChange={(e) => setModal({ ...modal, process: e.target.value })} placeholder="e.g. cs2.exe" />
              </label>
              <label className="text-sm text-text-muted">
                HF Threshold ({modal.hfThreshold?.toFixed(2)})
                <input type="range" min={0} max={1} step={0.01} value={modal.hfThreshold}
                  onChange={(e) => setModal({ ...modal, hfThreshold: Number(e.target.value) })}
                  className="w-full mt-1 accent-accent" />
              </label>
            </div>

            <div className="text-xs text-text-muted mb-2">Priority Map</div>
            {ALL_CATEGORIES.map((cat) => (
              <PrioritySlider key={cat} category={cat}
                value={modal.priorityMap?.[cat] || 4}
                onChange={(v) => setModal({ ...modal, priorityMap: { ...modal.priorityMap, [cat]: v } })} />
            ))}

            <div className="text-xs text-text-muted mt-4 mb-2">Enabled Categories</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {ALL_CATEGORIES.map((cat) => {
                const enabled = (modal.enabledCats || []).includes(cat);
                return (
                  <button key={cat}
                    className={`px-2 py-1 rounded text-xs ${enabled ? 'bg-accent text-white' : 'bg-muted text-text-muted'}`}
                    onClick={() => {
                      const cats = enabled
                        ? modal.enabledCats.filter((c) => c !== cat)
                        : [...(modal.enabledCats || []), cat];
                      setModal({ ...modal, enabledCats: cats });
                    }}>{cat}</button>
                );
              })}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={closeModal} className="px-4 py-2 rounded bg-muted text-sm hover:bg-muted/70">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 rounded bg-accent text-white text-sm hover:bg-accent/80">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileCard({ profile, onEdit, onDelete, onUse, community }) {
  const lastUsed = profile.updatedAt ? new Date(profile.updatedAt).toLocaleDateString() : '—';
  return (
    <div className="bg-surface border border-muted rounded-lg px-4 py-3 flex items-center justify-between">
      <div>
        <div className="font-semibold text-text">{profile.name}</div>
        <div className="text-xs text-text-muted">{profile.process}</div>
        {!community && <div className="text-xs text-text-muted">Last used: {lastUsed}</div>}
        {community && <div className="text-xs text-accent">Community</div>}
      </div>
      <div className="flex gap-2">
        {community && (
          <button onClick={onUse} className="text-xs text-accent hover:underline">Use</button>
        )}
        {!community && (
          <>
            <button onClick={onEdit} className="text-xs text-accent hover:underline">Edit</button>
            <button onClick={onDelete} className="text-xs text-danger hover:underline">Delete</button>
          </>
        )}
      </div>
    </div>
  );
}
