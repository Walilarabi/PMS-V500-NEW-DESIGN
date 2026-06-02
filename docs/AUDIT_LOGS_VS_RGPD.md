# Audit Logs vs RGPD — analyse (aucune décision automatique)

> Document d'aide à la décision. Les journaux **immuables** conservent par
> conception des données après l'effacement d'un client. Aucune action n'est
> prise automatiquement : la **décision (durées, base légale) revient à la
> direction / au DPO**.

## Journaux concernés & données conservées

| Journal | Immuable | Données personnelles conservées | Contenu sensible ? |
|---------|:---:|----------------------------------|--------------------|
| `audit_logs` (entity='reservation') | Oui | `entity_id`=réservation, `payload` (statut, montants, dates, `room_id`, `guest_id` dans certains diffs), `actor_user_id` (auteur) | Pseudonyme : pointe vers un client **déjà anonymisé** après effacement. Pas de nom/email/passeport (ceux-ci sont sur `guests`, anonymisés ; les corps de messages/notes/incidents sont purgés par R3). |
| `attachment_access_log` (R1) | Oui | `user_id` (personnel), `guest_id`, `attachment_id`, `action`, horodatage | **Pas de contenu de document.** Données de traçabilité d'accès + données RH (qui a consulté). |
| `gdpr_consent_log` | Append-only | `guest_id`, consentement, motif d'effacement | Preuve de conformité. |

> Après un effacement R3 : les **identifiants directs** (nom, email, téléphone,
> passeport, corps des messages/notes/incidents, documents + blobs Storage) sont
> **supprimés/anonymisés**. Ne subsistent dans les journaux immuables que des
> **références pseudonymes** (`guest_id`) et des métadonnées (montants, dates,
> actions, auteur).

## Durées de conservation recommandées (à valider)

| Journal | Durée recommandée | Justification |
|---------|-------------------|---------------|
| `audit_logs` (financier/réservation) | **6 à 10 ans** | Obligations comptables/fiscales (FR) + anti-fraude. Le caractère immuable répond à l'exigence d'intégrité de la piste d'audit. |
| `attachment_access_log` | **1 à 3 ans** puis purge | Traçabilité de sécurité / accountability ; pas d'intérêt à conserver au-delà. |
| `gdpr_consent_log` | **3 à 5 ans** après la fin de la relation | Preuve du consentement / des demandes (prescription). |

## Base légale

- **`audit_logs`** : obligation légale (art. 6.1.c — comptabilité, fiscalité) +
  intérêt légitime (art. 6.1.f — intégrité, sécurité, lutte anti-fraude).
  L'impossibilité d'effacer relève de l'**exemption art. 17.3.b** (obligation
  légale) et **17.3.e** (constatation/exercice/défense de droits en justice).
- **`attachment_access_log`** : intérêt légitime + **obligation de sécurité
  (art. 32)** et **accountability (art. 5.2)** — prouver qui a accédé aux
  documents sensibles.
- **`gdpr_consent_log`** : obligation de démontrer la conformité (art. 7.1, 5.2).

## Risques

| Risque | Niveau | Détail |
|--------|--------|--------|
| Tension immuabilité ↔ droit à l'oubli (art. 17) | Moyen | Les logs ne peuvent pas être effacés → à couvrir par les exemptions légales documentées. |
| Ré-identification via `guest_id` résiduel | Faible | Après anonymisation du client, `guest_id` ne pointe plus vers des identifiants directs ; ré-identification improbable. |
| `payload` d'audit contenant d'éventuelles PII directes | À vérifier | Le `payload` `created`/`deleted` = `to_jsonb(reservation)` (réf. `guest_id`, dates, montants) — **pas** de nom/email. À confirmer au cas par cas si le schéma `reservations` évolue. |
| Données RH dans `attachment_access_log` | Faible | `user_id` du personnel → information les concernant ; durée bornée + accès management. |

## Recommandations (aucune décision automatique)

1. **Documenter au registre des traitements** : pour chaque journal, finalité,
   base légale, durée, accès.
2. **Définir des durées** (proposées ci-dessus) et, pour `attachment_access_log`,
   une **purge planifiée** au-delà de la rétention (cohérent avec R3).
3. **Conserver `audit_logs`** sous exemption légale (ne pas supprimer) — décision
   et base légale à acter par le DPO.
4. **Vérifier périodiquement** que le `payload` d'audit ne contient pas de PII
   directes (sinon prévoir une pseudonymisation ciblée — opération privilégiée,
   hors flux normal, car elle touche un journal immuable).
5. **Information** : mentionner ces conservations dans la politique de
   confidentialité fournie aux clients.

> **Aucune implémentation, aucune décision automatique** : ce document sert de
> base à l'arbitrage de la direction / du DPO sur les durées et bases légales.
