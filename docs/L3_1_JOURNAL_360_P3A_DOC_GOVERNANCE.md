# P3-A/B/C — Gouvernance documentaire & conformité RGPD (conception)

> **Conception uniquement — aucune implémentation avant validation.**
> Ancré sur la réalité de la production : rôles Flowtym réels, infrastructure
> RGPD **existante** (`gdpr_consent_log`, `gdpr_requests`, `crm_gdpr_erase_guest`,
> `crm_gdpr_export_guest`, `crm_set_gdpr_consent`…) à laquelle ces propositions
> **s'intègrent** (sans réinventer). Objectif : stocker passeports / CNI / contrats
> dans un cadre **conforme, traçable et cloisonné**.

---

## P3-A — Architecture d'audit des accès documentaires

### Problème de fond
Aujourd'hui le téléchargement passe par `storage.createSignedUrl()` **côté client**
(policy `comm_attach_read` ouverte au rôle `authenticated`). Conséquence :
**impossible de journaliser** qui consulte quoi (l'app génère l'URL sans passer
par un point serveur). Pour un audit RGPD fiable, il faut **fermer la signature
directe** et router tout téléchargement par une **porte serveur auditée**.

### Architecture proposée

**1. Table `attachment_access_log` (append-only, immuable comme `audit_logs`)**
```
id              uuid PK
hotel_id        uuid  -- isolation
attachment_id   uuid  -- document concerné
guest_id        uuid  -- client (dénormalisé pour reporting RGPD)
reservation_id  uuid
user_id         uuid  -- QUI (users.id)
action          text  -- 'create' | 'view' | 'download' | 'delete'
occurred_at     timestamptz default now()
ip_address      inet   (optionnel)
user_agent      text   (optionnel)
```
- RLS lecture : hôtel **+ rôle** (seuls `owner/direction/admin` lisent le journal d'accès).
- Triggers `no_update`/`no_delete` (immuabilité, comme `audit_logs`).
- Permet : « qui a consulté quel document, quand, combien de fois » (agrégat `count(*) … group by attachment_id, user_id`).

**2. Edge function `attachment-access` (porte de téléchargement auditée)**
- Entrée : `attachment_id`.
- Étapes : (a) vérifier appartenance hôtel + **permission de rôle** (P3-B) ;
  (b) **journaliser** l'accès (`download`/`view`) dans `attachment_access_log` ;
  (c) générer l'URL signée **côté serveur** (service_role) avec **TTL court**
  (ex. 5 min) ; (d) renvoyer l'URL.
- Le frontend remplace `getAttachmentUrl()` (client) par un appel à cette function.

**3. Fermeture de la signature directe**
- **Retirer** la policy `comm_attach_read` du rôle `authenticated` → seul
  `service_role` (la function) peut signer. Les clients ne peuvent plus
  auto-signer → tout passe par la porte auditée. (La policy INSERT pour l'upload
  reste, ou l'upload passe aussi par une function — cf. impacts.)

**4. Journalisation des autres actions**
- **création** : `register_attachment` insère aussi une ligne `action='create'`.
- **suppression** : `delete_attachment` insère `action='delete'` (avant suppression).
- **consultation/téléchargement** : via la porte (point 2).

> Alternative légère : réutiliser `audit_logs` (entity='attachment'). Recommandé :
> table dédiée `attachment_access_log` (reporting RGPD ciblé, volumétrie d'accès
> isolée de l'audit métier).

---

## P3-B — Matrice des permissions documentaires

### Rôles Flowtym réels
`owner`, `direction`, `admin`, `reception`, `housekeeping`, `accountant`, `rms`.

### Types de documents
`id_doc` (passeport / CNI / permis), `contract`, `invoice`, `quote`, `other` (documents clients divers).

### Matrice proposée (V = Voir/Télécharger · U = Uploader · D = Supprimer · — = Aucun accès)

| Rôle \ Document | Pièce d'identité (`id_doc`) | Contrat | Facture | Devis | Document client (`other`) |
|----------------|:---:|:---:|:---:|:---:|:---:|
| **owner** | V U D | V U D | V U D | V U D | V U D |
| **direction** | V U D | V U D | V U D | V U D | V U D |
| **admin** | V U D | V U D | V U D | V U D | V U D |
| **reception** | **V U** | V U | V | V U | V U |
| **accountant** | — | V | **V U D** | V | V |
| **housekeeping** | — | — | — | — | — |
| **rms** | — | — | — | — | — |

**Principes** :
- **Pièces d'identité** : visibles uniquement par `owner/direction/admin/reception`
  (la réception en a besoin au check-in). **Jamais** housekeeping/rms/accountant.
- **Suppression** des documents sensibles : réservée à `owner/direction/admin`
  (la réception ne supprime pas ; l'accountant gère uniquement les factures).
- **Housekeeping / rms** : **aucun** accès aux documents clients (pas de besoin métier).
- « Gérer » (configurer rétention, voir le journal d'accès) : `owner/direction/admin`.

### Mécanisme proposé
- Ajouter une notion de **sensibilité** portée par `communication_attachments.kind`
  (déjà présent : `id_doc|contract|invoice|quote|other`).
- Fonction `can_access_document(p_kind text, p_action text) returns boolean`
  (SECURITY DEFINER) lisant le **rôle** de l'utilisateur courant (`users.role`)
  et appliquant la matrice.
- **RLS enrichie** sur `communication_attachments` (SELECT) : `hotel_id = … AND
  can_access_document(kind, 'view')`. Idem côté porte de téléchargement (P3-A) et
  agrégation timeline (la RPC `communication_timeline_v2` filtrerait les pièces
  jointes selon le rôle).

---

## P3-C — Analyse RGPD

### Données sensibles identifiées
| Donnée | Localisation | Catégorie |
|--------|--------------|-----------|
| Passeport / CNI / permis (scan) | Storage + `communication_attachments` (`id_doc`) | **Identité — sensible** |
| N° passeport, date de naissance, nationalité | `guests.passport`, `date_of_birth`, `nationality` | Identité |
| Photo client | `guests.photo_url` | Identité (biométrie potentielle) |
| Contrats / factures | Storage + table | Données personnelles + financières |

### Conformité — état & mécanismes proposés

| Exigence RGPD | État actuel | Mécanisme proposé |
|---------------|-------------|-------------------|
| **Base légale / consentement** | `guests.gdpr_consent` + `gdpr_consent_log` existent | **Bloquer** l'upload d'`id_doc` si pas de base légale/consentement ; tracer le motif (check-in légal vs consentement) |
| **Traçabilité (accountability)** | **Aucun audit d'accès** | `attachment_access_log` (P3-A) |
| **Minimisation / accès restreint** | RLS hôtel seulement | Matrice par rôle (P3-B) |
| **Durée de conservation** | **Aucune** | Table `document_retention_policy(kind, duree)` + **purge planifiée** (pg_cron) ; ex. `id_doc` supprimé X jours après check-out (paramétrable, défaut court) |
| **Droit à l'effacement** | `crm_gdpr_erase_guest` existe **mais ne couvre PAS les documents** (table récente) | **Étendre** `crm_gdpr_erase_guest` : supprimer `communication_attachments` du client **+ objets Storage** ; conserver une trace anonymisée dans `attachment_access_log` |
| **Droit d'accès / portabilité** | `crm_gdpr_export_guest` existe | **Étendre** pour lister/inclure les documents du client |
| **Anonymisation** | — | À l'effacement : purge des blobs + métadonnées ; le journal d'accès conserve `user_id/action/date` mais plus le contenu |
| **Sécurité du transport** | URL signée TTL **1 h** | Réduire à **5 min** + porte auditée (P3-A) |
| **Chiffrement at-rest** | Oui (Supabase/S3) | Acter dans le **DPA** ; envisager chiffrement applicatif des `id_doc` |
| **Localisation** | UE (`eu-central-1`) | OK |
| **Registre des traitements** | — | Documenter ce traitement « documents d'identité clients » |

---

## Impacts techniques

| Élément | Impact |
|---------|--------|
| **Base de données** | +1 table `attachment_access_log` (+ triggers immuabilité) ; +1 table `document_retention_policy` ; +1 fonction `can_access_document` ; RLS enrichie sur `communication_attachments` ; extension de `crm_gdpr_erase_guest` / `crm_gdpr_export_guest` ; job `pg_cron` de purge. |
| **Backend / Edge** | +1 edge function `attachment-access` (signe + journalise) ; éventuellement upload via function pour validation serveur. |
| **Frontend** | `getAttachmentUrl()` → appel à la porte auditée ; affichage conditionnel des pièces jointes selon le rôle ; UI de configuration rétention + consultation du journal d'accès (direction). |
| **Sécurité** | Retrait de la policy de signature directe `authenticated` → tout téléchargement gated. |

---

## Risques

| Risque | Gravité | Note |
|--------|---------|------|
| **Sans audit d'accès**, impossible de prouver qui a vu un passeport | **Élevée** (RGPD) | Bloquant pour stocker des `id_doc` |
| **Sans restriction par rôle**, tout staff voit les documents sensibles | **Élevée** | Idem |
| **Sans rétention**, conservation illimitée de pièces d'identité | Moyenne-Élevée | Non-conformité « limitation de conservation » |
| **Effacement incomplet** (documents non purgés au droit à l'oubli) | Élevée | `crm_gdpr_erase_guest` à étendre **avant** tout stockage d'`id_doc` |
| Fermeture de la signature directe | Moyenne (technique) | Change le flux de téléchargement (régression possible si mal testé) |
| TTL URL trop long | Faible | Réduire à 5 min |

---

## Recommandations (ordre proposé — à valider)

1. **Prérequis avant de stocker des pièces d'identité** :
   - **R1** : `attachment_access_log` + porte de téléchargement auditée (P3-A).
   - **R2** : matrice de permissions par rôle (P3-B) + `can_access_document`.
   - **R3** : étendre `crm_gdpr_erase_guest` (purge documents + Storage) et
     `crm_gdpr_export_guest` (inclure documents).
2. **Conformité conservation** :
   - **R4** : `document_retention_policy` + purge planifiée (`pg_cron`).
   - **R5** : réduire le TTL des URL signées (5 min).
3. **Renforcements complémentaires** (issus de P3) :
   - **R6** : durcir `register_attachment` (préfixe chemin + appartenance) — V1.
   - **R7** : `file_size_limit` + `allowed_mime_types` sur le bucket — V2/V3.
4. **Gouvernance** : registre des traitements, DPA, politique interne d'accès aux documents.

> **Conclusion** : l'architecture actuelle est **cloisonnée et chiffrée** mais
> **pas encore conforme** pour des pièces d'identité (manque audit d'accès,
> contrôle par rôle, rétention, effacement complet). Les briques R1→R3 sont
> **prérequises** avant tout stockage de documents d'identité réels.
>
> **Aucune modification appliquée.** En attente de votre validation pour décider
> quelles briques implémenter et dans quel ordre.
