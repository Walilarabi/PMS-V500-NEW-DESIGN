# PROTOCOLE UAT FLOWTYM — Validation utilisateur réel
À exécuter sur les domaines de production. Notez pour chaque étape : ✅ OK / ❌ KO + capture.
Pré-requis : SMTP custom configuré (sinon utiliser le secours « lien copiable / WhatsApp »).

## 0. Préparation
- [ ] Vider le Service Worker : DevTools → Application → Service Workers → **Unregister** sur `rh.flowtym.com` (sinon risque d'ancien cache sur /salarie).
- [ ] Tester de préférence en **navigation privée**.
- [ ] Disposer de 2 hôtels actifs (ex. Hôtel A, Hôtel B) et de 2 boîtes mail réelles distinctes.

## 1. Super Admin (app.flowtym.com/admin)
- [ ] Se connecter avec le compte super_admin sur `app.flowtym.com`.
- [ ] Aller sur `app.flowtym.com/admin` → l'interface Admin s'affiche (plus « Accès refusé »). *(valide le correctif #1)*
- [ ] Menu **Hôtels** : créer un hôtel, le passer actif/inactif → vérifier en base.
- [ ] Menu **Équipe** : ajouter un membre (super_admin/billing/support) → reçoit l'email d'invitation. *(nécessite le déploiement invite-platform-admin)*
- [ ] Déconnexion → redirige vers login.

## 2. Admin Hôtel / RH Manager (= rôle direction/admin_hotel)
- [ ] Depuis l'app RH (`rh.flowtym.com`), connecté en direction d'Hôtel A : inviter un **manager** (rôle direction/admin_hotel) sur Hôtel A.
- [ ] Le manager reçoit l'email → clique le lien → arrive sur `/auth/callback` → **définit son mot de passe**.
- [ ] Le manager se connecte → voit **uniquement Hôtel A**.

## 3. Manager (réception / gouvernante / etc.)
- [ ] Inviter un manager opérationnel sur Hôtel A.
- [ ] Connexion → vérifier que les menus correspondent au rôle (droits restreints).
- [ ] Vérifier qu'il ne peut PAS voir les données d'Hôtel B (sélecteur d'hôtel absent ou limité).

## 4. Salarié (rh.flowtym.com/salarie)
- [ ] Côté Manager RH : créer une fiche **employé** (Hôtel A) avec email, puis **Inviter au portail**.
- [ ] L'URL `rh.flowtym.com/salarie` affiche bien **« Mon espace »** (PWA salarié), PAS le Manager.
- [ ] Le salarié reçoit l'email → `/salarie/auth/callback` → définit son mot de passe.
- [ ] Connexion salarié → voit **uniquement sa fiche / son planning / ses absences** (pas ceux des collègues, pas d'autre hôtel).

## 5. Reset mot de passe
- [ ] Sur l'écran de login (PMS, RH, et portail), « Mot de passe oublié » → email de récupération reçu → nouveau mot de passe → reconnexion OK.

## 6. Isolation multi-hôtel (croisé)
- [ ] Créer/affecter un utilisateur U-A confiné à Hôtel A et U-B confiné à Hôtel B.
- [ ] U-A : aucune donnée d'Hôtel B visible (réservations, clients, factures, employés, plannings, absences, contrats). 
- [ ] U-B : symétrique.
- [ ] Utilisateur multi-hôtel : le sélecteur d'hôtel bascule le contexte ; chaque contexte ne montre que l'hôtel actif (tables PMS) / les hôtels membres (tables RH).

## 7. Logout / sessions
- [ ] Après logout, l'accès direct à une URL protégée renvoie au login (pas de contenu mis en cache).
- [ ] La session survit à un refresh (autoRefreshToken) mais expire correctement après déconnexion.

> Rappels d'isolation déjà PROUVÉS automatiquement (lecture seule, prod) : voir `audit/rls_isolation_tests.sql` — Hôtel B ne voit aucune donnée d'Hôtel A, deny-by-default OK, multi-hôtel OK.
