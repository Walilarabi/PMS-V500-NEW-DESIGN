import React from 'react';
import { 
  Building2, Users, Bed, CreditCard, 
  MapPin, Phone, Mail, Stars, Shield
} from 'lucide-react';
import { ConfigCard, ConfigInput } from './ConfigUtils';
import { useConfigStore } from '@/src/store/configStore';

export const ConfigSections1to7: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { hotel, updateHotel, taxes, updateTaxes, users } = useConfigStore();

  if (activeTab === 'hotel') {
    return (
      <div className="space-y-6">
        <ConfigCard title="Profil de l'hôtel" subtitle="Informations publiques et identité" icon={<Building2 />}>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-8">
              <ConfigInput 
                label="Nom de l'établissement" 
                icon={Building2} 
                value={hotel.name}
                onChange={(e: any) => updateHotel({ name: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ConfigInput 
                label="Étoiles" 
                icon={Stars} 
                type="number" 
                value={hotel.stars}
                onChange={(e: any) => updateHotel({ stars: parseInt(e.target.value) })}
              />
            </div>
            <div className="col-span-12">
              <ConfigInput 
                label="Adresse complète" 
                icon={MapPin} 
                value={hotel.address}
                onChange={(e: any) => updateHotel({ address: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <ConfigInput 
                label="Ville" 
                icon={MapPin} 
                value={hotel.city}
                onChange={(e: any) => updateHotel({ city: e.target.value })}
              />
            </div>
            <div className="col-span-12 md:col-span-6">
              <ConfigInput 
                label="Téléphone" 
                icon={Phone} 
                value={hotel.phone}
                onChange={(e: any) => updateHotel({ phone: e.target.value })}
              />
            </div>
          </div>
        </ConfigCard>

        <ConfigCard title="Fiscalité" subtitle="Taxes et frais de séjour" icon={<CreditCard />}>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-4">
              <ConfigInput 
                label="TVA Hébergement (%)" 
                icon={Shield} 
                type="number" 
                value={taxes.hebergement}
                onChange={(e: any) => updateTaxes({ hebergement: parseFloat(e.target.value) })}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ConfigInput 
                label="TVA Restauration (%)" 
                icon={Shield} 
                type="number" 
                value={taxes.fb}
                onChange={(e: any) => updateTaxes({ fb: parseFloat(e.target.value) })}
              />
            </div>
            <div className="col-span-12 md:col-span-4">
              <ConfigInput 
                label="Taxe de séjour (€ / nuit)" 
                icon={Shield} 
                type="number" 
                value={taxes.sejour}
                onChange={(e: any) => updateTaxes({ sejour: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </ConfigCard>
      </div>
    );
  }

  if (activeTab === 'users') {
    return (
      <ConfigCard title="Gestion des Utilisateurs" subtitle="Accès et permissions" icon={<Users />}>
        <div className="divide-y divide-[#F5F7FA]">
          {users.map(user => (
            <div key={user.id} className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-[#8B5CF6] font-bold text-sm">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{user.name}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${
                   user.role === 'admin' ? 'bg-violet-50 text-[#8B5CF6] border-violet-100' : 'bg-blue-50 text-blue-500 border-blue-100'
                 }`}>
                   {user.role}
                 </span>
                 <button className="text-[10px] font-black text-[#8B5CF6] uppercase tracking-widest hover:underline">Modifier</button>
              </div>
            </div>
          ))}
          <button className="w-full mt-4 py-3 bg-[#F5F3FF] border border-dashed border-[#8B5CF6]/30 rounded-xl text-[#8B5CF6] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-violet-50 transition-colors">
            <Users size={14} /> Ajouter un utilisateur
          </button>
        </div>
      </ConfigCard>
    );
  }

  return null;
};
