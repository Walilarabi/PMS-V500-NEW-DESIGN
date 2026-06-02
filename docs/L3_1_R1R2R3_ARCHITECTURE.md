# R1 + R2 + R3 — Architecture de conformité documentaire (conception)

> **Conception détaillée — AUCUNE implémentation avant validation.**
> Prérequis obligatoires avant tout stockage de documents d'identité.
> Ancré sur le réel : rôles Flowtym, infra RGPD existante (`gdpr_consent_log`,
> `gdpr_requests`, `crm_gdpr_erase_guest` analysée ci-dessous).

---

# R1 — Audit d'accès documentaire

## 1. Schéma SQL
```sql
CREATE TABLE public.attachment_access_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  attachment_id  uuid REFERENCES public.communication_attachments(id) ON DELETE SET NULL, -- log conservé même après suppression du doc
  guest_id       uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,   -- QUI
  action         text NOT NULL CHECK (action IN ('create','view','download','delete')),
  ip_address     inet,
  user_agent     text,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attach_access_hotel_idx   ON public.attachment_access_log (hotel_id, occurred_at DESC);
CREATE INDEX attach_access_doc_idx     ON public.attachment_access_log (attachment_id);
CREATE INDEX attach_access_guest_idx   ON public.attachment_access_log (guest_id);
CREATE INDEX attach_access_user_idx    ON public.attachment_access_log (user_id, occurred_at DESC);
```
**Immuabilité** (réutilise le motif `audit_logs`) : triggers `BEFORE UPDATE/DELETE`
→ `RAISE EXCEPTION` (journal infalsifiable).

**Écriture** : uniquement via `SECURITY DEFINER` / `service_role` (porte de
téléchargement, `register_attachment`, `delete_attachment`). Jamais en direct.

**Requête type** (« qui a vu quoi, combien de fois ») :
```sql
SELECT user_id, attachment_id, count(*) FILTER (WHERE action IN ('view','download'))
FROM attachment_access_log WHERE guest_id = $1 GROUP BY 1,2;
```

## 2. RLS
```sql
ALTER TABLE public.attachment_access_log ENABLE ROW LEVEL SECURITY;
-- Lecture RESTREINTE au management (le journal d'accès est lui-même sensible)
CREATE POLICY attach_access_select ON public.attachment_access_log
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
         AND public.current_user_role() IN ('owner','direction','admin'));
-- Pas de policy INSERT/UPDATE/DELETE pour authenticated → écriture définer-only, immuable.
```

## 3. Impact performances
- **+1 INSERT** par accès document (négligeable, table append-only indexée).
- Lecture (reporting) : rare, indexée par hotel/guest/user.
- Croissance volumétrique → prévoir une **rétention du journal** (ex. 1-3 ans),
  purgée par le même mécanisme que R3.

## 4. Impact RGPD
- **Positif** : satisfait l'exigence d'**accountability** (prouver qui a accédé
  aux pièces d'identité).
- Le journal est lui-même un traitement (logs du personnel) → base légale =
  intérêt légitime / obligation de sécurité ; accès réservé au management ;
  rétention bornée.

## 5. Plan de migration
- Migration additive `R1_attachment_access_log.sql` (table + index + triggers + RLS).
- **Pré-requis fonctionnel** : la **porte de téléchargement auditée** (edge
  function) qui écrit dans ce journal et la **fermeture de la signature directe**
  (cf. R1 dans P3-A). Étapes : (a) déployer la table ; (b) déployer l'edge
  function `attachment-access` ; (c) basculer le frontend ; (d) **retirer** la
  policy `comm_attach_read` du rôle `authenticated`.

---

# R2 — Permissions documentaires

## 1. Schéma SQL (table de droits configurable + helpers)
```sql
-- Rôle de l'utilisateur courant
CREATE FUNCTION public.current_user_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1 $$;

-- Référentiel de permissions (global, surchargé par défaut)
CREATE TABLE public.document_role_permissions (
  role         text NOT NULL,
  kind         text NOT NULL,  -- id_doc | contract | invoice | quote | other
  can_view     boolean NOT NULL DEFAULT false,
  can_download boolean NOT NULL DEFAULT false,
  can_delete   boolean NOT NULL DEFAULT false,
  can_upload   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, kind)
);

CREATE FUNCTION public.can_access_document(p_kind text, p_action text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT COALESCE((
     SELECT CASE p_action
       WHEN 'view' THEN can_view WHEN 'download' THEN can_download
       WHEN 'delete' THEN can_delete WHEN 'upload' THEN can_upload ELSE false END
     FROM public.document_role_permissions
     WHERE role = public.current_user_role() AND kind = COALESCE(p_kind,'other')
   ), false) $$;
```

## 2. Seed (matrice validée en P3-B)
| role | id_doc | contract | invoice | quote | other |
|------|--------|----------|---------|-------|-------|
| owner / direction / admin | V D U Del | V D U Del | V D U Del | V D U Del | V D U Del |
| reception | V D U | V D U | V D | V D U | V D U |
| accountant | — | V D | V D U Del | V D | V D |
| housekeeping | — | — | — | — | — |
| rms | — | — | — | — | — |

(V=view, D=download, U=upload, Del=delete)

## 3. Application (RLS + RPC)
```sql
-- communication_attachments : lecture filtrée par rôle
DROP POLICY communication_attachments_select ON public.communication_attachments;
CREATE POLICY communication_attachments_select ON public.communication_attachments
  FOR SELECT TO authenticated
  USING (hotel_id = public.get_user_hotel_id()
         AND public.can_access_document(kind, 'view'));
```
- Porte de téléchargement (R1) : vérifie `can_access_document(kind,'download')`.
- `delete_attachment` : vérifie `can_access_document(kind,'delete')`.
- `register_attachment` : vérifie `can_access_document(kind,'upload')`.
- `communication_timeline_v2` : filtre les pièces jointes selon `can_access_document(kind,'view')`.

## 4. Impacts / RLS
- RLS appelle `can_access_document` par ligne pièce jointe (fonction `STABLE`,
  coût négligeable ; peu de pièces jointes par timeline).
- Configurable (table) → ajustable sans redeploy.

## 5. Plan de migration
- `R2_document_permissions.sql` : table + seed + fonctions + remplacement de la
  policy SELECT + checks dans register/delete + filtre timeline.
- **Risque clé** : une RLS trop restrictive bloque un accès légitime → seed testé
  + recette par rôle avant bascule.

---

# R3 — Droit à l'oubli (extension)

## Analyse de `crm_gdpr_erase_guest` (réel)
**Déjà supprimé/anonymisé** : la ligne `guests` (first_name→'Anonymisé',
last_name→'ANON-xxxx', email/phone/date_of_birth/passport/address/photo_url/
nationality/whatsapp/visa/doc_expiry/notes/tags/… → nullifiés), `gdpr_consent=false`,
log dans `gdpr_consent_log`.

**NON traité (reste — fuite de données personnelles)** :
| Donnée résiduelle | Table | Contenu sensible |
|-------------------|-------|------------------|
| **Documents (scans passeport, etc.)** | `communication_attachments` + **objets Storage** | **Critique** |
| Notes internes | `communication_internal_notes.body` | nom, infos client |
| Messages | `conversation_messages` / `communication_logs` (`body`, `to_address`, `from_address`) | email, téléphone, contenu |
| Incidents | `guest_incidents.description` | infos client |
| Badges (historique) | `guest_badge_history` | peu sensible |
| **Journal d'audit** | `audit_logs.payload` (immuable) | données client dans `after`/`diff` |

## Plan d'effacement complet proposé

**Orchestration par edge function `gdpr-erase-guest`** (le Storage ne se supprime
pas en SQL pur) :
1. **SQL** `crm_gdpr_erase_guest(p_guest_id)` (existant, inchangé) → anonymise `guests`.
2. **SQL nouveau** `crm_gdpr_purge_guest_documents(p_guest_id)` (SECURITY DEFINER) :
   - collecte les `storage_path` des `communication_attachments` du client ;
   - **supprime** ces lignes ;
   - purge le contenu personnel : `communication_internal_notes.body → '[effacé]'`,
     `conversation_messages.body/to_address/from_address → NULL`, idem
     `communication_logs`, `guest_incidents.description → '[effacé]'` ;
   - **RETURNS** le tableau des `storage_path` à supprimer.
3. **Edge function** : reçoit les chemins → `storage.remove(paths)` (service_role)
   → supprime les blobs réels.
4. **Log** : `gdpr_consent_log` (channel='erasure') + `attachment_access_log`
   (action='delete', motif) pour chaque document.
5. **`audit_logs`** (immuable) : **ne peut pas être supprimé** (par conception).
   → **Décision requise** : (a) conserver sous obligation légale/accountability
   (recommandé, documenté au registre) ; ou (b) processus privilégié de
   *redaction* du `payload` (rompt l'immuabilité — déconseillé).

**Garantie** : suppression client **+** documents **+** Storage **+** métadonnées,
avec trace d'effacement conservée.

---

# Risques

| Risque | Phase | Gravité | Mitigation |
|--------|-------|---------|-----------|
| RLS par rôle trop restrictive (bloque la réception sur `id_doc`) | R2 | Moyenne | Seed testé + recette par rôle avant bascule |
| Fermeture de la signature directe casse le téléchargement actuel | R1 | Moyenne | Déployer la porte AVANT de retirer la policy ; tester |
| Effacement irréversible / mauvais client | R3 | **Élevée** | Filtrage strict `guest_id + hotel_id` ; test sur client de test ; confirmation UI |
| Orphelins Storage (métadonnée supprimée mais blob restant, ou inverse) | R3 | Moyenne | Supprimer les blobs AVANT/transactionnellement avec les métadonnées ; file de reprise |
| `audit_logs` non effaçable (données résiduelles) | R3 | Moyenne (RGPD) | Documenter la base légale de rétention ; décision client |
| Journal d'accès volumineux | R1 | Faible | Index + rétention |

# Impacts

| Couche | R1 | R2 | R3 |
|--------|----|----|----|
| **BDD** | table `attachment_access_log` + triggers + RLS | table `document_role_permissions` + seed + 2 fonctions + RLS attachments + checks RPC | fonction `crm_gdpr_purge_guest_documents` |
| **Backend/Edge** | edge `attachment-access` (signe + log) | — | edge `gdpr-erase-guest` (orchestre purge + Storage) |
| **Frontend** | `getAttachmentUrl` → porte auditée ; UI journal d'accès (direction) | affichage conditionnel par rôle | bouton effacement RGPD (déjà via gdpr_requests) étendu |
| **Sécurité** | retrait policy signature directe | RLS durcie par rôle | purge complète |

---

# Plan de déploiement

Ordre (chaque étape additive et validable indépendamment) :
1. **R1** : table `attachment_access_log` (+ triggers, RLS) → edge `attachment-access`
   → bascule frontend téléchargement → **retrait** policy `comm_attach_read` directe.
2. **R2** : `document_role_permissions` (+ seed, fonctions) → recette par rôle →
   bascule RLS `communication_attachments` + checks RPC + filtre timeline.
3. **R3** : `crm_gdpr_purge_guest_documents` → edge `gdpr-erase-guest` →
   branchement sur le flux `gdpr_requests` existant.
4. Mise à jour des fichiers **dépôt** (migrations + rollback) en miroir de la prod.

> Le **stockage de pièces d'identité réelles n'est autorisé qu'après R1+R2+R3
> déployées et recettées.**

# Plan de rollback

| Phase | Rollback | Sûreté |
|-------|----------|--------|
| **R1** | `DROP TABLE attachment_access_log CASCADE` + recréer la policy `comm_attach_read` directe + rebasculer le frontend | Additif → sûr (aucune donnée legacy touchée) |
| **R2** | Restaurer la policy `communication_attachments_select` (hôtel seul) ; `DROP` `document_role_permissions`, `can_access_document`, `current_user_role` ; retirer les checks RPC | Sûr (revert de policy documenté) |
| **R3** | `DROP FUNCTION crm_gdpr_purge_guest_documents` ; retirer l'edge `gdpr-erase-guest` ; `crm_gdpr_erase_guest` (existant) **non modifié** → inchangé | Sûr (la fonction existante n'est pas altérée) ; **mais** un effacement déjà exécuté reste irréversible (nature du droit à l'oubli) |

Fichiers rollback fournis **hors** `migrations/` (comme les lots précédents).

---

> **Aucune modification appliquée.** En attente de votre validation de ces
> architectures (R1, R2, R3) pour démarrer l'implémentation, dans l'ordre proposé
> ou celui que vous choisirez.
