/**
 * Icone catégorique premium pour les événements RMS.
 */
import React from 'react';
import {
  Trophy, Music2, Briefcase, Sparkles, Theater, Shirt, PartyPopper,
  Flag, GraduationCap, Sun, Church, Megaphone, Building2, Pencil, Calendar,
} from 'lucide-react';
import type { EventCategory } from '@/src/types/events';

export const CATEGORY_ICON: Record<EventCategory, React.ComponentType<{ className?: string; size?: number }>> = {
  sport: Trophy,
  concert: Music2,
  congress: Briefcase,
  salon: Sparkles,
  culture: Theater,
  fashion: Shirt,
  festival: PartyPopper,
  holiday: Flag,
  school_break: GraduationCap,
  tourism_peak: Sun,
  religious: Church,
  political: Megaphone,
  internal: Building2,
  manual: Pencil,
  other: Calendar,
};
