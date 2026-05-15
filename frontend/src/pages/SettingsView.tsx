import React from 'react';
import type { PageId } from '@/src/types';
import { SettingsModule } from '@/src/domains/settings/SettingsModule';

interface SettingsViewProps {
  activePage?: PageId;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ activePage = 'settings' }) => {
  return <SettingsModule activePage={activePage} />;
};
