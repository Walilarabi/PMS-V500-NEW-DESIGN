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

export interface AuthSession {
  userId: string;
  email: string;
  tenantId: string | null;
  role: string | null;
  fullName: string | null;
}
