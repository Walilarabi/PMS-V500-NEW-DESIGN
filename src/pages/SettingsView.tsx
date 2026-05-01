import React, { useState } from 'react';
import { Configuration } from '@/src/components/Configuration';

export const SettingsView = () => {
  const [showFullConfig, setShowFullConfig] = useState(true);

  if (showFullConfig) {
    return <Configuration onBack={() => setShowFullConfig(false)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#F7F6FD]">
      {/* Fallback to simple list if needed, but for now we default to full config */}
      <button 
        onClick={() => setShowFullConfig(true)}
        className="px-6 py-3 bg-[#8B5CF6] text-white rounded-xl font-bold"
      >
        Ouvrir la Configuration Avancée
      </button>
    </div>
  );
};
