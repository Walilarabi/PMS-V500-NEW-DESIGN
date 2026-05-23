import React from 'react';
import type { PageId } from '@/src/types';
import { SettingsLayout } from '@/src/pages/settings/SettingsLayout';

interface SettingsViewProps {
  activePage?: PageId;
  onNavigate: (page: PageId) => void;
}

/**
 * SettingsView — point d'entrée du module Paramètres.
 *
 * Délègue à SettingsLayout qui fournit toute la chrome interne :
 *   • barre horizontale des 10 domaines ;
 *   • sub-nav verticale contextuelle ;
 *   • contenu (Control Center ou détail catalogue).
 */
export const SettingsView: React.FC<SettingsViewProps> = ({ activePage = 'settings', onNavigate }) => (
  <SettingsLayout activePage={activePage} onNavigate={onNavigate} />
);
