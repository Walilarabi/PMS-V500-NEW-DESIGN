# Flowday — Actions « ⋮ » : Email, WhatsApp, Badge

Finalisation des 3 actions opérationnelles du menu « ⋮ » de Flowday / Vue du jour :
**Envoyer un email**, **Envoyer un WhatsApp**, **Modifier le badge client**.

---

## 1. Audit de l'existant (avant)

| Action | État avant | Verdict |
|---|---|---|
| **Email** | `handleMessageSent()` affichait seulement un toast `"Email envoyé"`. La modal montrait un email/téléphone **en dur** (`arathew.smith@email.com`, `+33 6 12 34 56 78`). | ❌ Bouton mort (UI only) |
| **WhatsApp** | Idem — simple toast, aucune API Meta. | ❌ Bouton mort (UI only) |
| **Badge** | `handleBadgesSave()` → `updateRoom()` mettait à jour le **state React local uniquement**. Aucune persistance, aucun historique. Rechargement = perdu. | ⚠️ Partiellement câblé |

Architecture réutilisée : Supabase + RLS + isolation `hotel_id` via `get_user_hotel_id()`,
edge functions Deno (pattern `send-dispute-email`), table `guests` réelle, adaptateur
Flowday réel (`useFlowdayDataset`) exposant `reservationUuid` (et désormais `guestId`).

---

## 2. Base de données — `supabase/migrations/20260627_communication_and_badges.sql`

Tables créées (toutes en RLS, isolées par `hotel_id`) :

- **`hotel_email_settings`** — config email par hôtel (provider, from_email/name, SMTP, OAuth account, statut). **Sans secret.**
- **`hotel_whatsapp_settings`** — config WhatsApp Business par hôtel (Meta Business ID, WABA ID, Phone Number ID, numéro affiché, statut). **Sans secret.**
- **`communication_templates`** — modèles email/WhatsApp par hôtel et par `kind`.
- **`communication_logs`** — journal de tous les envois (canal, statut, provider, message id, erreur, rattaché `guest_id` + `reservation_id`). Inséré par les edge functions.
- **`guest_badge_history`** — audit des changements de badge (qui, quand, ancien, nouveau).
- **`_hotel_communication_secrets`** — table **privée** (RLS sans policy + `REVOKE`/`GRANT service_role`) : tokens Meta, mot de passe SMTP, refresh tokens OAuth. **Jamais lisible par le frontend.**
- Colonne **`guests.badges text[]`** (+ `guests.vip` garantie) — source de vérité affichée partout.

RPC (SECURITY DEFINER, isolation `hotel_id` validée côté serveur) :

- `set_communication_secret(channel, key, value)` — écrit un secret (jamais relu côté front).
- `has_communication_secret(channel, key)` → `boolean` — statut « présent : oui/non ».
- `set_guest_badges(guest_id, badges, reservation_id, source)` — met à jour `guests.badges`,
  dérive `vip`/`blacklisted`, et historise dans `guest_badge_history`.

> Application : `git`-tracké uniquement (pas appliqué sur la base live). À déployer via votre
> pipeline de migrations habituel (`supabase db push` ou CI).

---

## 3. Edge functions (Deno) — `frontend/supabase/functions/`

- **`send-email/`** — envoie depuis l'adresse de l'hôtel. Dispatch provider :
  `resend` | `smtp` (denomailer) | `gmail_oauth` (Gmail API + refresh) | `microsoft_graph`
  (Graph `sendMail` + refresh). `hotel_id` dérivé du JWT appelant → isolation. Journalise dans
  `communication_logs`. Erreurs explicites (`email_not_configured`, token expiré, etc.).
- **`send-whatsapp/`** — WhatsApp Business **Cloud API** officielle, par hôtel. Valide le numéro
  (E.164), supporte texte libre (fenêtre 24h) et templates approuvés (hors fenêtre). Mappe les
  codes d'erreur Meta (190 = token expiré, 131047/131051 = template requis). Journalise.

Déploiement :
```bash
supabase functions deploy send-email
supabase functions deploy send-whatsapp
```
Secrets optionnels (refresh OAuth) : voir `.env.example`.

---

## 4. Services frontend — `frontend/src/services/communication/`

- **`badges.ts`** — catalogue canonique (8 badges : VIP, habitué, corporate, attention, PMR,
  blacklisté, litige, préférence) + `normalizeBadges()` (mappe le legacy, dédoublonne).
- **`badgeService.ts`** — `setGuestBadges()` (RPC) + `listBadgeHistory()`.
- **`templates.ts`** — modèles par défaut + `fillTemplate()` + `fetchTemplates()` (override hôtel).
- **`communicationService.ts`** — `sendEmail()` / `sendWhatsApp()` (edge functions) + `listCommunicationLogs()`.
- **`communicationSettings.service.ts`** — get/save config email & WhatsApp, `setSecret`/`hasSecret`
  (RPC), `testEmail`/`testWhatsApp`.

---

## 5. UI

- **Paramètres > Réservations > Communication (Email / WhatsApp)** —
  `src/pages/settings/pages/CommunicationSettingsPage.tsx` : config par hôtel, secrets en
  écriture seule, statut de connexion, **bouton tester l'envoi**, note Meta sur les frais WhatsApp.
- **Flowday → modal Communication** (`CommunicationModal.tsx`) — contact **réel** du client,
  modèles sélectionnables, aperçu éditable, envoi réel, statut envoyé/erreur, et renvoi vers
  Paramètres si non configuré ou contact manquant.
- **Flowday → modal Badges** (`BadgesModal.tsx`) — 8 badges, persistance réelle (RPC),
  historique consultable. Le badge remonte partout car lu depuis `guests.badges`.

---

## 6. Sécurité

- Isolation stricte par `hotel_id` (RLS sur toutes les tables, `get_user_hotel_id()` côté serveur).
- Secrets jamais exposés au frontend (table privée service_role + RPC d'écriture seule).
- `hotel_id` toujours dérivé du JWT côté edge function (jamais du body).
- Aucun mock, aucune donnée fake, aucun secret en `localStorage`.

---

## 7. Tests — `frontend/src/services/communication/*.test.ts`

`badges.test.ts`, `templates.test.ts`, `communicationService.test.ts`, `badgeService.test.ts` —
**26 tests, tous verts**. Couvrent : normalisation badges + alias legacy, remplissage de
modèles, extraction des codes/messages d'erreur des edge functions, appel RPC badges + historique.

Validation : `npm run lint` → **0 nouvelle erreur** TypeScript (baseline inchangé).
Suite complète : aucune régression introduite (les échecs préexistants sont liés à l'absence
de `.env.local` dans le container et sont indépendants de ce travail).

---

## 8. Reste à faire (hors périmètre de cette itération)

- Flux de **consentement OAuth** Gmail/Microsoft (écran d'autorisation) → nécessite les
  credentials d'app OAuth de l'hôtel ; l'infrastructure de stockage/refresh des tokens est prête.
- Webhook entrant WhatsApp (messages reçus → `communication_logs` direction `inbound`).
- Éditeur de templates personnalisés par hôtel dans l'UI Paramètres.
