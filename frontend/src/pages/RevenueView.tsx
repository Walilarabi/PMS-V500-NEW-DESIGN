/**
 * FLOWTYM Revenue — Module router
 *
 * Lightweight dispatcher that renders the correct Revenue page based on
 * `activePage`. The sub-menu is owned by the global Sidebar — no internal
 * ModuleSidebar anymore (the old RevenueView had both, causing duplication).
 *
 * All Revenue pages live under @/src/pages/revenue/ and are loaded directly
 * by App.tsx via PageId routing. This file is kept as a backward-compat
 * shim and forwards to RevenueDashboard.
 */
import React from 'react';
import { RevenueDashboard } from './revenue/RevenueDashboard';

export const RevenueView: React.FC = () => <RevenueDashboard />;
