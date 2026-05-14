import React, { useState } from 'react';
import { Mail, Sparkles, Send, FileText, ChevronRight, Eye } from 'lucide-react';
import { ConfigCard, ConfigInput } from './ConfigUtils';

export const ConfigTemplates: React.FC<{ toast: any }> = ({ toast }) => {
  const [subject, setSubject] = useState('Confirmation de votre séjour à Flowtym');
  const [content, setContent] = useState('Bonjour {{guest_name}},\n\nNous sommes ravis de confirmer votre réservation...');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAI = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setContent('Bonjour {{guest_name}},\n\nC\'est avec un immense plaisir que nous confirmons votre réservation à {{hotel_name}}...\n\nDates : {{arrival}} au {{departure}}\nChambre : {{room_number}}\n\nÀ très vite !');
      setIsGenerating(false);
      toast('Template généré par IA ✨', 'success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <ConfigCard title="Modèles d'emails" subtitle="Communications clients automatisées" icon={<Mail />}>
        <div className="grid grid-cols-12 gap-6">
           <div className="col-span-12 md:col-span-4 space-y-2">
              {['Confirmation', 'Pré-séjour', 'Post-séjour', 'Annulation'].map(tpl => (
                <button 
                  key={tpl} 
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all group ${
                    tpl === 'Confirmation' ? 'bg-[#F5F3FF] border border-[#DDD6FE] text-[#8B5CF6]' : 'bg-white border border-[#E8EDF5] text-gray-500 hover:border-violet-200'
                  }`}
                >
                  <span className="text-[12px] font-bold uppercase tracking-tight">{tpl}</span>
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100" />
                </button>
              ))}
           </div>
           <div className="col-span-12 md:col-span-8 space-y-4">
              <ConfigInput 
                label="Objet du mail" 
                icon={FileText} 
                value={subject} 
                onChange={(e: any) => setSubject(e.target.value)} 
              />
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Corps du message</label>
                 <div className="relative">
                    <textarea 
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      className="w-full bg-[#F5F7FA] border border-[#E8EDF5] rounded-2xl p-6 text-sm font-medium text-gray-700 min-h-[300px] outline-none focus:border-[#8B5CF6] transition-all"
                    />
                    <button 
                      onClick={handleGenerateAI}
                      disabled={isGenerating}
                      className="absolute bottom-4 right-4 bg-white border border-violet-200 shadow-sm px-4 py-2 rounded-xl flex items-center gap-2 text-[#8B5CF6] text-[11px] font-black uppercase hover:bg-violet-50 transition-all"
                    >
                      <Sparkles size={14} className={isGenerating ? 'animate-spin' : ''} />
                      {isGenerating ? 'Génération...' : 'Améliorer par IA'}
                    </button>
                 </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 italic">
                 <Sparkles size={12} className="text-[#8B5CF6]" />
                 Utilisez des tags : &#123;&#123;guest_name&#125;&#125;, &#123;&#123;arrival&#125;&#125;, &#123;&#123;hotel_name&#125;&#125;
              </div>
           </div>
        </div>
      </ConfigCard>

      <div className="flex justify-end gap-3">
         <button className="px-6 py-3 bg-white border border-[#E8EDF5] rounded-xl text-[12px] font-black uppercase text-gray-400 hover:text-gray-900 transition-all flex items-center gap-2">
            <Eye size={16} /> Aperçu réel
         </button>
         <button className="px-8 py-3 bg-[#8B5CF6] text-white rounded-xl text-[12px] font-black uppercase tracking-widest shadow-lg shadow-[#8B5CF6]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
            <Send size={16} /> Enregistrer le modèle
         </button>
      </div>
    </div>
  );
};
