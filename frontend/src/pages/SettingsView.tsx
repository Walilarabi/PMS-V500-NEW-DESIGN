import React from 'react';
import type { PageId } from '@/src/types';
import { SettingsModule } from '@/src/domains/settings/SettingsModule';
import { SettingsControlCenter } from '@/src/pages/settings/SettingsControlCenter';

interface SettingsViewProps {
  activePage?: PageId;
}

/**
 * Routeur du module Paramètres :
 *   - 'settings' (vue d'ensemble) → Control Center (cockpit vivant)
 *   - 'settings_xxx' (sous-pages) → SettingsModule legacy avec catalogue
 */
export const SettingsView: React.FC<SettingsViewProps> = ({ activePage = 'settings' }) => {
  if (activePage === 'settings') return <SettingsControlCenter />;
  return <SettingsModule activePage={activePage} />;
};
