import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, LogOut, Settings, User, Shield } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/domains/auth/AuthContext';

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  onNavigateSettings?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ onNavigateSettings }) => {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initials = getInitials(session?.fullName ?? null);
  const activeHotel =
    session?.accessibleHotels?.find((h) => h.isActive) ??
    session?.accessibleHotels?.[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!session) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu utilisateur"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all duration-150',
          open
            ? 'bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/20'
            : 'hover:bg-gray-50',
        )}
      >
        <div className="w-7 h-7 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white text-[11px] font-black leading-none shrink-0 shadow-sm shadow-[#8B5CF6]/30">
          {initials}
        </div>
        <div className="hidden sm:block min-w-0 text-left">
          <p className="text-[12px] font-semibold text-gray-800 leading-none truncate max-w-[120px]">
            {session.fullName ?? session.email.split('@')[0]}
          </p>
        </div>
        <ChevronDown
          size={13}
          className={cn(
            'text-gray-400 transition-transform duration-150 shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl shadow-xl ring-1 ring-gray-100 overflow-hidden"
          role="menu"
          aria-label="Menu utilisateur"
        >
          {/* Header profil */}
          <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-50 bg-gradient-to-br from-[#8B5CF6]/[0.06] to-transparent">
            <div className="w-10 h-10 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white text-[15px] font-black shrink-0 shadow-md shadow-[#8B5CF6]/25">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-gray-900 leading-tight truncate">
                {session.fullName ?? 'Utilisateur'}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{session.email}</p>
              {session.role && (
                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-[#8B5CF6]/10 text-[10px] font-semibold text-[#8B5CF6]">
                  <Shield size={9} />
                  {session.role}
                </span>
              )}
            </div>
          </div>

          {/* Hôtel actif */}
          {activeHotel && (
            <div className="px-4 py-2.5 border-b border-gray-50">
              <p className="text-[9.5px] font-black uppercase tracking-wider text-gray-400 mb-1.5">
                Établissement actif
              </p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
                  <Building2 size={11} className="text-[#8B5CF6]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-800 truncate leading-tight">
                    {activeHotel.name}
                  </p>
                  {(activeHotel.city || activeHotel.country) && (
                    <p className="text-[10px] text-gray-400 truncate leading-tight">
                      {[activeHotel.city, activeHotel.country].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="py-1.5 px-2">
            {onNavigateSettings && (
              <>
                <button
                  role="menuitem"
                  onClick={() => { onNavigateSettings(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <User size={14} className="text-gray-400 shrink-0" />
                  Mon profil
                </button>
                <button
                  role="menuitem"
                  onClick={() => { onNavigateSettings(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <Settings size={14} className="text-gray-400 shrink-0" />
                  Préférences
                </button>
              </>
            )}
          </div>

          {/* Déconnexion */}
          <div className="border-t border-gray-50 px-2 py-1.5">
            <button
              role="menuitem"
              onClick={() => { logout(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut size={14} className="shrink-0" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
