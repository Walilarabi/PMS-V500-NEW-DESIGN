# R1 / R2 / R3 — Résultats & preuves (implémentation + recette en production)

> Implémenté **en production** (`flowtym-housekeeping`) + **dépôt aligné**.
> Recettes réelles exécutées (impersonation), données de test **nettoyées**.

## R1 — Audit d'accès documentaire — ✅ VALIDÉ
**Livré** : table immuable `attachment_access_log` ; `current_user_role()` ;
journalisation `create`/`view`/`download`/`delete` (register/delete/
request_attachment_download) ; **edge function `attachment-access`** (signe côté
serveur, TTL 5 min) ; **fermeture de la signature directe** (policy
`comm_attach_read` retirée) ; frontend `getAttachmentUrl` → porte auditée.

**Preuves** : les 4 actions journalisées avec acteur (Wali Larabi) + horodatage ;
**immuabilité confirmée** (UPDATE de falsification → `attachment_access_log est
immuable`).

**Anomalie corrigée en recette** : FK `ON DELETE SET NULL` incompatible avec
l'immuabilité (la cascade déclenchait un UPDATE bloqué) → **uuid nus** (comme
`audit_logs.entity_id`) ; le log survit volontairement aux suppressions.

## R2 — Permissions documentaires — ✅ VALIDÉ
**Livré** : `document_role_permissions` (seedée) + `can_access_document()` ;
RLS `communication_attachments` par rôle ; gardes upload/delete/download dans
register/delete/request_attachment_download ; filtrage des pièces jointes par
rôle dans `communication_timeline_v2`.

**Anomalie majeure découverte** : l'enum DB `admin_user_role` =
{reception, gouvernante, femme_de_chambre, maintenance, breakfast, direction}
**≠ rôles frontend** (owner/admin/accountant/rms/housekeeping). Seed **réaligné
sur les vrais rôles** (prod = vérité). *Incohérence frontend↔DB à réconcilier
séparément (hors périmètre R).*

**Preuve (matrice enforcée, téléchargement pièce d'identité)** :
| Rôle | Téléch. pièce ID | Téléch. facture | Suppr. pièce ID |
|------|:---:|:---:|:---:|
| direction | ✅ | ✅ | ✅ |
| reception | ✅ | ✅ | ❌ |
| gouvernante / femme_de_chambre / maintenance / breakfast | ❌ | ❌ | ❌ |

Rôle de test restauré (`direction`).

## R3 — Droit à l'oubli — ✅ VALIDÉ
**Livré** : `crm_gdpr_purge_guest_documents()` (suppr. métadonnées + purge
contenu résiduel notes/messages/logs/incidents + trace immuable + renvoi des
chemins Storage) ; **edge function `gdpr-erase-guest`** (orchestre purge →
`storage.remove(blobs)` → anonymisation). Réservé à la direction.

**Anomalie pré-existante corrigée** : `crm_gdpr_erase_guest` plantait
(`tags='[]'::jsonb` alors que `guests.tags` est `text[]`) → **l'effacement RGPD
n'avait jamais fonctionné**. Corrigé (`tags='{}'::text[]`).

**Preuves (effacement d'un client de test avec documents)** :
| Vérification | Résultat |
|---|---|
| Chemins Storage renvoyés (suppression blobs) | 2 |
| Client anonymisé (passeport/tél/email) | Anonymisé · NULL · ANON-…@erased |
| Documents (métadonnées) restants | 0 |
| Note interne / Incident après | « [Données effacées — RGPD] » |
| Log communication (corps + email) | NULL |
| Trace d'effacement (journal immuable) | 2 conservées |

## Impact production
- Migrations appliquées : `r1_attachment_access_log` (+ correctif FK),
  `r2_document_permissions` (+ filtre timeline + re-seed rôles réels),
  `r3_gdpr_purge_documents` (+ correctif `crm_gdpr_erase_guest`).
- Edge functions déployées : `attachment-access`, `gdpr-erase-guest`.
- **Le téléchargement direct est fermé** : le frontend doit utiliser la porte
  auditée (déjà câblé dans `attachments.service.ts`).
- Dépôt aligné (migrations 20260633/34/35 + rollbacks).

## Conformité — feu vert documents sensibles
✅ R1 (traçabilité) + R2 (permissions par rôle) + R3 (effacement complet) sont
**implémentés et validés en production**. Le **stockage de documents d'identité
réels est désormais techniquement autorisé**, sous réserve de la gouvernance
(durées de conservation / base légale — cf. `AUDIT_LOGS_VS_RGPD.md`, décision
direction/DPO) et des durcissements complémentaires (V2/V3 : limites bucket,
allowlist MIME) si souhaités.
