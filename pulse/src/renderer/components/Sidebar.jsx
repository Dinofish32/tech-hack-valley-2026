import React from 'react';
import { NavLink } from 'react-router-dom';
import { useDeviceStore } from '../store/useDeviceStore';
import ConnectionBadge from './ConnectionBadge';

const NAV = [
  { to: '/dashboard',   label: 'Dashboard'      },
  { to: '/profiles',    label: 'Profiles'        },
  { to: '/calibration', label: 'Calibration'     },
  { to: '/eventlog',    label: 'Event Log'       },
  { to: '/settings',    label: 'Settings'        },
];

export default function Sidebar() {
  const transport = useDeviceStore((s) => s.transport);

  return (
    <aside className="flex flex-col w-[220px] min-w-[220px] h-screen bg-surface border-r border-muted">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-muted">
        <span className="text-xl font-bold tracking-widest text-accent">PULSE8</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `block px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-accent bg-accent/10 border-l-2 border-accent'
                  : 'text-text-muted hover:text-text hover:bg-muted/40'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Connection badge at bottom */}
      <div className="px-4 py-4 border-t border-muted">
        <ConnectionBadge transport={transport} />
      </div>
    </aside>
  );
}
