/**
 * FLOWTYM — Auth domain Zod schemas.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
  fullName: z.string().min(2, 'Nom requis'),
  tenantSlug: z
    .string()
    .min(3, 'Slug requis')
    .regex(/^[a-z0-9-]+$/, 'Lettres minuscules, chiffres et tirets uniquement'),
  hotelName: z.string().min(2, "Nom de l'hôtel requis"),
});
export type SignUpInput = z.infer<typeof signupSchema>;

/**
 * One hotel an authenticated user has access to.
 * Source of truth: public.user_hotels (joined with public.hotels).
 */
export interface AccessibleHotel {
  hotelId: string;
  name: string;
  city: string | null;
  country: string | null;
  role: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface AuthSession {
  userId: string;
  email: string;
  /**
   * Hôtel actif (sélectionné). Égal à `accessibleHotels.find(h => h.isActive).hotelId`.
   * NULL si l'utilisateur n'a pas encore de profil ou aucun hôtel.
   */
  tenantId: string | null;
  role: string | null;
  fullName: string | null;
  /**
   * Liste des hôtels accessibles à cet utilisateur, alimentée au login via
   * la RPC public.list_user_hotels().
   * Vide si l'utilisateur n'a pas encore de profil dans public.users.
   */
  accessibleHotels: AccessibleHotel[];
}
