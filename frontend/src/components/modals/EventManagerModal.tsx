import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Zap, Trash2, Edit2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { useCreateEvent, useDeleteEvent, useEvents } from '@/src/domains/planning/hooks';
import type { PlanningEventImpact } from '@/src/domains/planning/schemas';
import { useToast } from '@/src/hooks/use-toast';
import { cn } from '@/src/lib/utils';

interface EventManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

type EventImpact = PlanningEventImpact;

const IMPACT_OPTIONS: { label: string, value: EventImpact, color: string }[] = [
  { label: 'Faible', value: 'low', color: 'bg-blue-500' },
  { label: 'Moyen', value: 'medium', color: 'bg-orange-500' },
  { label: 'Fort', value: 'high', color: 'bg-rose-500' },
  { label: 'Critique', value: 'critical', color: 'bg-red-700' },
];

export const EventManagerModal: React.FC<EventManagerModalProps> = ({ isOpen, onClose, initialDate }) => {
  const eventsQ = useEvents();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const { toast } = useToast();
  const events = eventsQ.data ?? [];
  const [formData, setFormData] = useState({
    name: '',
    startDate: initialDate || new Date().toISOString().split('T')[0],
    endDate: initialDate || new Date().toISOString().split('T')[0],
    impact: 'medium' as EventImpact,
    description: '',
    source: '',
    location: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEvent.mutateAsync({
        name: formData.name,
        start_date: formData.startDate,
        end_date: formData.endDate,
        impact: formData.impact,
        description: formData.description || null,
        source: formData.source || null,
        location: formData.location || null,
      });
      toast({ title: 'Événement enregistré', variant: 'success' });
      setFormData({
        name: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        impact: 'medium',
        description: '',
        source: '',
        location: ''
      });
    } catch (err) {
      toast({ title: 'Échec', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent.mutateAsync(id);
      toast({ title: 'Événement supprimé', variant: 'success' });
    } catch (err) {
      toast({ title: 'Échec', description: err instanceof Error ? err.message : '', variant: 'destructive' });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="bg-[#8B5CF6] p-8 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                        <Zap size={24} className="text-white" fill="white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Console Événementielle</h2>
                        <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mt-0.5">Gestion des pics d'activité</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div className="bg-gray-50/50 border border-gray-100 rounded-[32px] p-8 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Saisie Manuelle</h3>
                        <Button variant="outline" size="sm" className="rounded-2xl gap-2 font-bold text-[11px] bg-white">
                            <Download size={14} /> Importer RMS
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Désignation Événement*</label>
                                <input 
                                    className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all"
                                    placeholder="Ex: Fashion Week, Salon Auto..."
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Lieux publics impactés</label>
                                <input 
                                    className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all"
                                    placeholder="Ex: Parc des Expos, centre ville"
                                    value={formData.location}
                                    onChange={e => setFormData({...formData, location: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Début*</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input 
                                        type="date"
                                        className="w-full bg-white border border-gray-100 rounded-2xl p-4 pl-12 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all"
                                        required
                                        value={formData.startDate}
                                        onChange={e => setFormData({...formData, startDate: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Fin</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input 
                                        type="date"
                                        className="w-full bg-white border border-gray-100 rounded-2xl p-4 pl-12 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all"
                                        value={formData.endDate}
                                        onChange={e => setFormData({...formData, endDate: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Impact</label>
                                <select 
                                    className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all"
                                    value={formData.impact}
                                    onChange={e => setFormData({...formData, impact: e.target.value as EventImpact})}
                                >
                                    {IMPACT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Descriptif</label>
                            <textarea 
                                className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all h-24 resize-none"
                                placeholder="Description de l'événement"
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Source (site web)</label>
                            <input 
                                className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-bold text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all"
                                placeholder="Ex: maison-objet.com"
                                value={formData.source}
                                onChange={e => setFormData({...formData, source: e.target.value})}
                            />
                        </div>

                            <div className="flex gap-4 pt-4">
                                <Button type="submit" data-testid="event-create-submit" disabled={createEvent.isPending} className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-2xl px-10 h-14 font-black uppercase text-xs tracking-widest shadow-xl shadow-[#8B5CF6]/20 disabled:opacity-50">
                                    {createEvent.isPending ? 'Enregistrement…' : "Enregistrer l'événement"}
                                </Button>
                            <Button type="button" variant="outline" onClick={onClose} className="rounded-2xl px-10 h-14 font-black uppercase text-xs tracking-widest border-gray-100">
                                Annuler
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Events List Table */}
                <div className="mt-12 space-y-6">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-xl font-black text-gray-900">Événements enregistrés</h3>
                        <Badge variant="neutral" className="bg-gray-100 text-gray-400">{events.length} au total</Badge>
                    </div>

                    <div className="bg-gray-50/30 border border-gray-100 rounded-[32px] overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Événement</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Dates</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Lieu</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Impact</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Descriptif</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Source</th>
                                    <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {events.map(event => (
                                    <tr key={event.id} className="hover:bg-white transition-colors" data-testid={`event-row-${event.id}`}>
                                        <td className="p-6">
                                            <span className="text-sm font-black text-gray-900">{event.name}</span>
                                        </td>
                                        <td className="p-6 text-xs font-bold text-gray-600">
                                            {event.start_date} {event.end_date !== event.start_date && ` - ${event.end_date}`}
                                        </td>
                                        <td className="p-6 text-xs text-gray-500 font-bold italic">
                                            {event.location || '-'}
                                        </td>
                                        <td className="p-6 text-center">
                                            {IMPACT_OPTIONS.filter(i => i.value === event.impact).map(opt => (
                                                <Badge key={opt.value} className={cn("text-[8px] font-black px-2 py-1 uppercase rounded-lg border-none text-white", opt.color)}>
                                                    {opt.label}
                                                </Badge>
                                            ))}
                                        </td>
                                        <td className="p-6">
                                            <p className="text-xs text-gray-500 font-medium line-clamp-1 max-w-[150px]">{event.description || '-'}</p>
                                        </td>
                                        <td className="p-6">
                                            {event.source && <span className="text-[10px] font-black text-[#8B5CF6] hover:underline cursor-pointer">{event.source}</span>}
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-blue-500 transition-all"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDelete(event.id)} data-testid={`event-delete-${event.id}`} className="p-2 hover:bg-rose-50 rounded-xl text-gray-400 hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
