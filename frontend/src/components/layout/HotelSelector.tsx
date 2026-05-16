/**
 * FLOWTYM — HotelSelector
 *
 * Dropdown placed in the topbar that lets a user pick the active hotel
 * among the ones they have access to. Calls AuthContext.switchHotel().
 *
 * UX:
 *  - If user has 0 hotels → show nothing (session may not be ready, or no access yet)
 *  - If user has 1 hotel  → show name as static label, no dropdown
 *  - If user has 2+ hotels → render the dropdown with all options
 */
import React, { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/domains/auth/AuthContext';

export const HotelSelector: React.FC = () => {
  const { session, switchHotel, isSwitchingHotel } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hotels = session?.accessibleHotels ?? [];
  const activeHotel = hotels.find((h) => h.isActive) ?? hotels.find((h) => h.isDefault) ?? hotels[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (hotels.length === 0) return null;

  // Single hotel: static display
  if (hotels.length === 1) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <Building2 size={11} className="text-gray-400 shrink-0" />
        <p className="text-[9px] text-gray-400 font-medium truncate leading-none">
          {activeHotel?.name ?? 'PMS'}
        </p>
      </div>
    );
  }

  const handleSelect = async (hotelId: string) => {
    setOpen(false);
    if (activeHotel?.hotelId === hotelId) return;
    try {
      await switchHotel(hotelId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[HotelSelector] switchHotel failed', err);
    }
  };

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isSwitchingHotel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 -ml-1.5 rounded-md',
          'text-[9px] font-medium leading-none transition-colors',
          'hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/30',
          isSwitchingHotel && 'opacity-60 cursor-wait',
        )}
        title="Changer d'hôtel"
      >
        {isSwitchingHotel ? (
          <Loader2 size={9} className="text-[#8B5CF6] animate-spin shrink-0" />
        ) : (
          <Building2 size={9} className="text-gray-400 shrink-0" />
        )}
        <span className="text-gray-500 truncate max-w-[110px]">
          {activeHotel?.name ?? 'PMS'}
        </span>
        <ChevronDown
          size={9}
          className={cn('text-gray-300 transition-transform shrink-0', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 top-full mt-1 z-50',
            'min-w-[220px] max-w-[280px]',
            'bg-white rounded-xl shadow-xl ring-1 ring-gray-100 border border-gray-100',
            'py-1 overflow-hidden',
          )}
        >
          <div className="px-3 py-2 border-b border-gray-50">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
              Mes hôtels ({hotels.length})
            </p>
          </div>
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {hotels.map((hotel) => {
              const isActive = hotel.hotelId === activeHotel?.hotelId;
              return (
                <li key={hotel.hotelId}>
                  <button
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(hotel.hotelId)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2',
                      'px-3 py-2 text-left transition-colors',
                      'hover:bg-gray-50 focus:outline-none focus:bg-gray-50',
                      isActive && 'bg-[#8B5CF6]/5',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-xs font-semibold truncate leading-tight',
                          isActive ? 'text-[#8B5CF6]' : 'text-gray-900',
                        )}
                      >
                        {hotel.name}
                      </p>
                      {(hotel.city || hotel.country) && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate leading-tight">
                          {[hotel.city, hotel.country].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <Check size={14} className="text-[#8B5CF6] shrink-0" strokeWidth={2.5} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
