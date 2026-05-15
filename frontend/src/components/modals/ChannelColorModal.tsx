import React, { useState } from 'react';
import { X, Plus, RotateCcw, Palette, Zap, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useConfigStore } from '@/src/store/configStore';
import { Button } from '@/src/components/ui/Button';

interface ChannelColorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChannelColorModal = ({ isOpen, onClose }: ChannelColorModalProps) => {
  const { channels, updateChannels } = useConfigStore();
  const [localChannels, setLocalChannels] = useState(channels);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleUpdateColor = (id: string, color: string) => {
    setLocalChannels(prev => prev.map(c => c.id === id ? { ...c, color } : c));
  };

  const handleUpdateName = (id: string, name: string) => {
    setLocalChannels(prev => prev.map(c => c.id === id ? { ...c, name: name.toUpperCase() } : c));
  };

  const handleAddChannel = () => {
    const newId = (localChannels.length + 1).toString();
    setLocalChannels([...localChannels, { id: newId, name: 'NOUVEAU', color: '#CBD5E1' }]);
  };

  const handleSave = () => {
    updateChannels(localChannels);
    onClose();
  };

  const handleReset = () => {
    setLocalChannels(channels);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Palette size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Configuration Couleurs</h2>
              <p className="text-xs font-bold text-indigo-100 uppercase tracking-widest opacity-80">Personnalisez vos canaux</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-gray-50/30">
          <div className="grid grid-cols-2 gap-4">
            {localChannels.map((channel) => (
              <div 
                key={channel.id} 
                className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="relative group/picker">
                    <input 
                      type="color" 
                      value={channel.color}
                      onChange={(e) => handleUpdateColor(channel.id, e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div 
                      className="w-10 h-10 rounded-xl shadow-inner border border-gray-100 flex items-center justify-center"
                      style={{ backgroundColor: channel.color }}
                    >
                       <div className="w-2 h-2 rounded-full bg-white/50 opacity-0 group-hover/picker:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <input 
                      value={channel.name}
                      onChange={(e) => handleUpdateName(channel.id, e.target.value)}
                      className="text-[11px] font-black text-gray-400 uppercase tracking-widest bg-transparent border-none p-0 focus:ring-0 w-24"
                    />
                    <span className="text-[12px] font-black text-gray-700 font-mono tracking-tight">{channel.color.toUpperCase()}</span>
                  </div>
                </div>
                
                <button className="px-4 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all opacity-0 group-hover:opacity-100">
                  Aperçu
                </button>
              </div>
            ))}
          </div>

          <div className="p-6 bg-indigo-50/50 rounded-[24px] border border-indigo-100 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
              <Zap size={18} />
            </div>
            <div>
              <h4 className="text-[12px] font-black text-indigo-900 uppercase tracking-widest mb-1">Impact Visuel</h4>
              <p className="text-[11px] font-bold text-indigo-700/70 italic leading-relaxed">
                Les couleurs modifiées sont appliquées instantanément à tout le planning. L'interface calcule automatiquement le contraste idéal pour garantir la lisibilité du texte.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-white border-t border-gray-100 flex items-center justify-between">
          <button 
            onClick={handleAddChannel}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl border border-indigo-100 text-indigo-600 hover:bg-indigo-50 transition-all group"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={18} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Ajouter un partenaire</span>
          </button>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleReset}
              className="px-6 py-3 rounded-2xl bg-gray-50 text-gray-500 text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Reset
            </button>
            <button 
              onClick={handleSave}
              className="px-8 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 flex items-center gap-2"
            >
              <Check size={16} />
              Enregistrer
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
