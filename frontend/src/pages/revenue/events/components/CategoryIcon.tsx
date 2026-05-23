/**
 * Icone catégorique premium pour les événements RMS.
 */
import React from 'react';
import {
  Trophy, Music2, Briefcase, Sparkles, Theater, Shirt, PartyPopper,
  Flag, GraduationCap, Sun, Church, Megaphone, Building2, Pencil, Calendar,
  Mic, Disc3, Radio, Headphones, Star, Guitar, Globe2,
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
  // ─── Mega Entertainment ───────────────────────────────────────────────
  mega_concert: Star,
  pop_concert: Mic,
  rap_concert: Headphones,
  kpop_concert: Disc3,
  electro_concert: Radio,
  metal_concert: Guitar,
  world_tour: Globe2,
  other: Calendar,
};
