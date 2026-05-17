import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateRange: Date[];
  roomsByCategory: {
    category: string;
    totalRooms: number;
    occupiedByDate: Record<string, number>;
  }[];
}

/**
 * Modal d'affichage des disponibilités par catégorie de chambre.
 * Affiche une ligne par catégorie avec disponibilité détaillée par date.
 */
export const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
  isOpen,
  onClose,
  dateRange,
  roomsByCategory
}) => {
  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('fr-FR', { month: 'short' });
    return `${day} ${month}`;
  };

  const getDayName = (date: Date) => {
    return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()];
  };

  const toLocalISODate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculer totaux par date
  const totalsByDate: Record<string, { total: number; occupied: number }> = {};
  
  dateRange.forEach(date => {
    const dateKey = toLocalISODate(date);
    let totalRooms = 0;
    let totalOccupied = 0;
    
    roomsByCategory.forEach(cat => {
      totalRooms += cat.totalRooms;
      totalOccupied += (cat.occupiedByDate[dateKey] || 0);
    });
    
    totalsByDate[dateKey] = { total: totalRooms, occupied: totalOccupied };
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Disponibilités par catégorie</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            {/* Date header row */}
            <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
              <div className="flex">
                <div className="w-48 shrink-0 px-4 py-3 font-semibold text-sm text-gray-700 border-r border-gray-200">
                  Catégorie
                </div>
                {dateRange.map((date, idx) => {
                  const dateKey = toLocalISODate(date);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  
                  return (
                    <div 
                      key={idx}
                      className={cn(
                        "w-24 shrink-0 px-2 py-3 text-center border-r border-gray-100",
                        isWeekend && "bg-orange-50/30"
                      )}
                    >
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-wide mb-0.5",
                        isWeekend ? "text-orange-400" : "text-gray-400"
                      )}>
                        {getDayName(date)}
                      </div>
                      <div className={cn(
                        "text-sm font-bold",
                        isWeekend ? "text-orange-600" : "text-gray-900"
                      )}>
                        {formatDate(date)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total row */}
            <div className="bg-indigo-50 border-b border-indigo-100">
              <div className="flex">
                <div className="w-48 shrink-0 px-4 py-3 font-bold text-sm text-indigo-900 border-r border-indigo-100">
                  TOTAL
                </div>
                {dateRange.map((date, idx) => {
                  const dateKey = toLocalISODate(date);
                  const { total, occupied } = totalsByDate[dateKey] || { total: 0, occupied: 0 };
                  const available = total - occupied;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  
                  return (
                    <div 
                      key={idx}
                      className={cn(
                        "w-24 shrink-0 px-2 py-3 text-center border-r border-indigo-100",
                        isWeekend && "bg-orange-50/20"
                      )}
                    >
                      <div className="text-lg font-black text-indigo-600">
                        {available}
                      </div>
                      <div className="text-[10px] text-indigo-400 font-semibold">
                        / {total}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category rows */}
            {roomsByCategory.map((category, catIdx) => (
              <div 
                key={catIdx}
                className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex">
                  <div className="w-48 shrink-0 px-4 py-3 text-sm font-semibold text-gray-700 border-r border-gray-100">
                    {category.category}
                    <div className="text-xs text-gray-400 font-normal mt-0.5">
                      {category.totalRooms} chambres
                    </div>
                  </div>
                  {dateRange.map((date, idx) => {
                    const dateKey = toLocalISODate(date);
                    const occupied = category.occupiedByDate[dateKey] || 0;
                    const available = category.totalRooms - occupied;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isFull = available === 0;
                    
                    return (
                      <div 
                        key={idx}
                        className={cn(
                          "w-24 shrink-0 px-2 py-3 text-center border-r border-gray-100",
                          isWeekend && "bg-gray-50/30",
                          isFull && "bg-rose-50"
                        )}
                      >
                        <div className={cn(
                          "text-base font-bold",
                          isFull ? "text-rose-600" : available <= 2 ? "text-orange-600" : "text-emerald-600"
                        )}>
                          {available}
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium">
                          / {category.totalRooms}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Légende : 
            <span className="ml-3 text-emerald-600 font-semibold">Vert = Disponible</span>
            <span className="ml-3 text-orange-600 font-semibold">Orange = Peu de dispo</span>
            <span className="ml-3 text-rose-600 font-semibold">Rouge = Complet</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
