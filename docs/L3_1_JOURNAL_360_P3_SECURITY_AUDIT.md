# P3 — Audit de sécurité documentaire du Journal 360°

> Audit mené **sur la production réelle** (`flowtym-housekeeping`) : config bucket,
> policies Storage, RPC, RLS inspectées en base + **tests d'isolation exécutés**
> (preuves). **Aucune modification appliquée** — rapport en attente de validation.
> Objectif : traiter les pièces jointes comme si elles contenaient **demain les
> passeports et pièces d'identité** des clients des hôtels Boudaa.

---

## P3.1 — Audit complet de la chaîne documentaire

| Composant | État réel constaté | Verdict |
|-----------|--------------------|---------|
| **Bucket Storage** `communication-attachments` | `public = false` ✅ ; **`file_size_limit = NULL`** ; **`allowed_mime_types = NULL`** | Privé ✅ / **aucune limite serveur** ⚠️ |
| **Policies `storage.objects`** | SELECT/INSERT/DELETE, rôle `authenticated`, condition `foldername[1] = get_user_hotel_id()` ; **pas de policy UPDATE** (pas d'écrasement) | **Cloisonnement correct** ✅ |
| **RLS `communication_attachments`** | SELECT `hotel_id = get_user_hotel_id()` ; écriture via RPC `SECURITY DEFINER` uniquement | ✅ |
| **`register_attachment`** | `SECURITY DEFINER` ; `hotel_id` **forcé** à `get_user_hotel_id()` (non falsifiable) ; **MAIS** `storage_path`, `guest_id`, `reservation_id`, `message_id` **non validés** | Faille **intégrité** ⚠️ (V1) |
| **`delete_attachment`** | `DELETE … WHERE id = p_id AND hotel_id = get_user_hotel_id()` → suppression cross-hôtel **impossible** | ✅ |
| **URL signées (`getAttachmentUrl`)** | `createSignedUrl(path, 3600)` = **TTL 1 h** ; respecte la RLS Storage à la génération | Correct, mais lien partageable 1 h ⚠️ (V6) |
| **Upload (`uploadAttachment`)** | chemin `{hotel_id}/{scope}/{uuid}/{nom}` (hotel_id issu de `get_user_hotel_id`) ; `upsert:false` ; **taille 25 Mo vérifiée côté client uniquement** ; **aucun allowlist MIME/extension** ; `mime`/`size` = valeurs **client** | Plusieurs gaps ⚠️ (V2-V4) |
| **Permissions RPC** | `REVOKE … FROM public, anon` ; `GRANT … TO authenticated` | ✅ |
| **Chiffrement at-rest** | Supabase Storage (S3) — chiffré au repos par défaut | ✅ (à confirmer contractuellement) |

---

## P3.2 — Tests d'isolation (preuves exécutées)

Utilisateur impersonné = hôtel `02b9eb0e` ; cible = hôtel `00000000-…-001`.

| Test | Méthode | Résultat | Verdict |
|------|---------|----------|---------|
| **Forge `hotel_id`** | RPC `register_attachment` (aucun param hotel_id) | `hotel_id` **forcé** à `02b9eb0e` | ✅ Impossible de forger |
| **Forge chemin étranger** | `p_storage_path = '0000…001/evil/passport-vole.pdf'` | **Ligne créée** (chemin étranger accepté) | ❌ **V1** (intégrité) |
| **Forge guest étranger** | `p_guest_id = '0000…012'` (client de l'hôtel 001) | **Accepté** (non validé) | ❌ **V1** (intégrité) |
| **Lecture cross-hôtel (table)** | la ligne forgée porte `hotel_id = 02b9eb0e` | un autre hôtel **ne la voit pas** (RLS) | ✅ Pas de fuite |
| **Téléchargement chemin étranger** | `createSignedUrl('0000…001/…')` | **bloqué** : policy Storage `foldername[1] = mon hôtel` ≠ `001` | ✅ Pas de fuite |
| **Upload vers dossier étranger** | `storage.upload('0000…001/…')` | **bloqué** : INSERT WITH CHECK `foldername[1] = mon hôtel` | ✅ |
| **Suppression cross-hôtel** | `delete_attachment(id d'un autre hôtel)` | **bloqué** : `WHERE hotel_id = mon hôtel` | ✅ |
| **Accès anonyme** | rôle `anon` | RPC `REVOKE` + bucket privé + policies `authenticated` | ✅ |

**Conclusion P3.2** : **la confidentialité multi-hôtels est préservée** — aucun
hôtel ne peut lire, télécharger, uploader ou supprimer les documents d'un autre.
La seule faille est d'**intégrité** (V1) : on peut créer des métadonnées forgées
(chemin/guest étranger) **inexploitables en lecture** (le téléchargement reste
bloqué par la policy Storage). Ligne de test supprimée.

---

## P3.3 — Validation des fichiers (risques)

| Contrôle | État | Risque |
|----------|------|--------|
| Taille maximale | Client : 25 Mo. **Serveur : aucune** (`file_size_limit = NULL`) → contournable par appel Storage direct | **DoS / saturation stockage** (V2) |
| Extensions autorisées | **Aucune** allowlist | Upload de types dangereux (V3) |
| MIME types | **Aucune** allowlist ; `mime` = valeur **client** (spoofable) ; `contentType` = client | MIME falsifié, HTML/SVG (V3) |
| Double extension | Non gérée (`passport.pdf.exe` conservé) | Masquage de type (V3) |
| Fichier vide | Non vérifié (size 0 accepté) | Données corrompues (V5) |
| Fichier corrompu / malveillant | **Aucun** antivirus / scan | Malware stocké (V5) |
| Taille/MIME enregistrés | Valeurs **client**, non vérifiées vs objet réel | Métadonnées mensongères (V4) |

> Atténuation existante : bucket **privé** + fichiers servis par **URL signée**
> (téléchargement, pas exécution inline sur le domaine de l'app) → le risque XSS
> est limité au domaine `*.supabase.co`, pas au domaine Flowtym. Mais HTML/SVG
> ouverts via URL signée peuvent exécuter du JS dans le contexte storage.

---

## P3.4 — Pièces d'identité & RGPD

L'architecture est **structurellement compatible** (bucket privé, RLS hôtel,
chiffrement at-rest). **Risques RGPD spécifiques aux documents sensibles** :

| Risque RGPD | État actuel | Gravité |
|-------------|-------------|---------|
| **Traçabilité des accès** (qui a consulté/téléchargé un passeport ?) | **Aucun audit** des `createSignedUrl` / accès | **Élevée** |
| **Minimisation / contrôle d'accès par rôle** | **Tout** le personnel de l'hôtel peut voir tous les documents (RLS = hôtel, pas de rôle) | **Élevée** |
| **Rétention / droit à l'effacement** | Suppression manuelle possible (`delete_attachment` + objet), mais **aucune purge/rétention automatique** | Moyenne |
| **URL signées partageables** | TTL 1 h ; un lien fuité = accès 1 h par quiconque | Moyenne |
| **Lien consentement** | Aucun rattachement au consentement RGPD du client | Moyenne |
| **Chiffrement at-rest** | Oui (Supabase/S3) | OK (à acter dans le DPA) |
| **Localisation des données** | Région `eu-central-1` (UE) | OK |

---

## P3.5 — Livrable : vulnérabilités, gravité, risque métier, correctifs

| Réf | Vulnérabilité | Gravité | Risque métier | Correctif recommandé | Impact du correctif |
|-----|---------------|---------|---------------|----------------------|---------------------|
| **V1** | `register_attachment` ne valide ni le préfixe `storage_path` (= `hotel_id/`) ni l'appartenance `guest_id`/`reservation_id`/`message_id` à l'hôtel | **Moyenne** (intégrité ; pas de fuite) | Métadonnées forgées / orphelines, liens cassés | Dans la RPC : exiger `storage_path` commençant par `hotel_id||'/'` ; vérifier que guest/réservation/message appartiennent à l'hôtel | Faible (checks dans la RPC) |
| **V2** | Aucune limite de taille **serveur** (`file_size_limit` NULL) | **Moyenne** | Saturation stockage / coûts / DoS | `ALTER BUCKET … file_size_limit` (ex. 15-25 Mo) | Très faible (config) |
| **V3** | Aucun allowlist MIME/extension ; double extension ; MIME spoofable | **Moyenne** | Stockage de types dangereux (HTML/SVG/exe), masquage | `allowed_mime_types` sur le bucket (pdf/jpg/png/…) + validation serveur + normalisation extension | Faible-Moyen |
| **V4** | `mime`/`size` enregistrés = valeurs **client** non vérifiées | Faible-Moyenne | Métadonnées mensongères | Lire taille/MIME réels depuis `storage.objects` après upload | Moyen |
| **V5** | Pas de détection fichier vide / corrompu / antivirus | Faible | Malware / fichiers inutilisables | `size > 0` ; scan AV (edge function / service externe) à terme | Variable |
| **V6a** | **Aucun audit d'accès** aux documents (RGPD) | **Élevée** (pour pièces d'identité) | Non-conformité RGPD, impossible de prouver qui a vu un passeport | Table `attachment_access_log` + journaliser chaque génération d'URL signée | Moyen |
| **V6b** | **Pas de restriction par rôle** pour documents sensibles | **Élevée** | Tout staff voit les passeports | Champ `sensitivity` + RLS/role (ex. seuls réception/direction voient `id_doc`) | Moyen |
| **V6c** | Pas de rétention/purge ; TTL URL 1 h ; pas de lien consentement | Moyenne | Conservation excessive, fuite par lien | Politique de rétention + purge ; réduire TTL (ex. 5 min) ; rattacher au consentement | Moyen |

**Aucune vulnérabilité Critique** (pas de brèche de confidentialité cross-hôtel).

### Points forts confirmés
- ✅ Cloisonnement multi-hôtels **solide** (RLS table + Storage), prouvé par tests.
- ✅ `hotel_id` non falsifiable ; suppression/upload/lecture cross-hôtel bloqués.
- ✅ Bucket privé, pas d'écrasement, RPC interdites à `anon`.
- ✅ Chiffrement at-rest, région UE.

### Priorisation recommandée (à valider avant toute implémentation)
1. **V6a + V6b** (Élevée, RGPD pièces d'identité) — audit d'accès + restriction par rôle.
2. **V1** (intégrité) — durcir `register_attachment`.
3. **V2 + V3** (limite taille + allowlist MIME) — config bucket + validation.
4. **V4 + V5 + V6c** — fiabilisation + rétention.

> **Aucune modification appliquée.** Données de test nettoyées. En attente de
> votre validation de ce rapport pour décider quels correctifs implémenter.
