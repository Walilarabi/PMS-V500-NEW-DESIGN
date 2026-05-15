import React, { useState } from 'react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface ModuleSidebarProps {
  items: SidebarItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const ModuleSidebar: React.FC<ModuleSidebarProps> = ({ items, activeTab, setActiveTab }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isCollapsed ? 88 : 288 }}
      className="bg-white border-r border-[#E8EDF5] shrink-0 flex flex-col relative z-20"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-2 mt-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            title={isCollapsed ? item.label : undefined}
            className={cn(
              "w-full py-3.5 rounded-2xl flex items-center transition-all relative group",
              isCollapsed ? "justify-center px-0" : "px-4 gap-3",
              activeTab === item.id
                ? "bg-[#F5F3FF] text-[#8B5CF6] shadow-sm"
                : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <item.icon
              size={20}
              strokeWidth={activeTab === item.id ? 2.5 : 2}
              className={cn("shrink-0 transition-colors", activeTab === item.id ? "text-[#8B5CF6]" : "text-slate-300 group-hover:text-slate-400")}
            />
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.span 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-['Inter'] text-[14px] font-medium tracking-wide whitespace-nowrap overflow-hidden text-left flex-1"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {activeTab === item.id && (
              <motion.div 
                layoutId="tab-indicator" 
                className={cn(
                  "w-1 h-4 bg-[#8B5CF6] rounded-full absolute",
                  isCollapsed ? "right-1" : "right-4"
                )} 
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 border-t border-slate-100 flex justify-center">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </motion.aside>
  );
};
