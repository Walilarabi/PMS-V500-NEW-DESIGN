# SECURITY_RULES.md — Politique de Sécurité Absolue pour le SaaS

## OBJECTIF

Tu es responsable de produire un code **hautement sécurisé**, robuste et résistant aux attaques modernes.

La sécurité n’est PAS une option.
Chaque fonctionnalité, API, formulaire, upload, requête SQL, endpoint, webhook, authentification ou intégration externe DOIT être pensée avec une logique “zero trust”.

Tu dois systématiquement privilégier :
- la sécurité,
- l’isolation,
- la validation,
- le principe du moindre privilège,
- la défense en profondeur,
- la traçabilité,
- la résilience.

Le logiciel doit être conçu pour résister au maximum :
- aux hackers,
- aux bots,
- au phishing,
- aux injections,
- aux attaques automatisées,
- aux erreurs humaines,
- aux fuites de données,
- aux escalades de privilèges,
- aux accès non autorisés,
- aux ransomwares,
- aux attaques API,
- aux attaques réseau,
- aux attaques supply-chain,
- aux failles frontend et backend.

---

# RÈGLES OBLIGATOIRES

## 1. AUCUNE CONFIANCE DANS LES DONNÉES ENTRANTES

TOUTES les données sont considérées comme malveillantes :
- formulaires,
- query params,
- body JSON,
- headers,
- cookies,
- fichiers uploadés,
- webhooks,
- API externes,
- données frontend,
- métadonnées.

Toujours :
- valider,
- nettoyer,
- typer,
- limiter,
- filtrer.

Interdiction de faire confiance au frontend.

Le backend DOIT revalider absolument tout.

---

# 2. AUTHENTIFICATION ULTRA SÉCURISÉE

Obligatoire :
- JWT sécurisés avec expiration courte,
- refresh tokens rotatifs,
- invalidation des sessions,
- protection contre le vol de token,
- hashage fort des mots de passe (`argon2id` recommandé),
- MFA/2FA prêt à être activé,
- protection brute force,
- rate limiting,
- blocage IP intelligent,
- détection de connexions suspectes,
- session timeout,
- secure cookies,
- HttpOnly,
- SameSite=strict,
- CSRF protection.

INTERDICTION :
- mots de passe en clair,
- tokens stockés dans localStorage,
- secrets hardcodés,
- sessions infinies.

---

# 3. AUTORISATION STRICTE

Chaque endpoint DOIT vérifier :
- identité utilisateur,
- rôle,
- permissions,
- ownership des ressources.

Principe :
- deny by default.

Interdiction :
- de retourner des données d’un autre utilisateur,
- d’exposer des IDs sensibles,
- d’utiliser des contrôles uniquement frontend.

Mettre en place :
- RBAC solide,
- séparation stricte des privilèges,
- audit des permissions.

---

# 4. PROTECTION CONTRE LES INJECTIONS

Protection obligatoire contre :
- SQL Injection,
- NoSQL Injection,
- XSS,
- SSRF,
- Command Injection,
- LDAP Injection,
- Path Traversal,
- Template Injection,
- Header Injection.

Toujours :
- requêtes préparées,
- ORM sécurisé,
- escaping,
- sanitation stricte,
- whitelist validation.

Jamais de concaténation SQL dynamique.

---

# 5. SÉCURITÉ API

Toutes les APIs doivent avoir :
- authentification,
- rate limiting,
- validation stricte,
- logging,
- timeout,
- pagination,
- protection anti-bot,
- anti scraping,
- taille maximale des payloads,
- contrôle CORS strict.

Interdire :
- wildcard CORS,
- endpoints publics inutiles,
- erreurs détaillées en production.

Les réponses d’erreurs ne doivent jamais révéler :
- stacktrace,
- structure DB,
- secrets,
- architecture interne.

---

# 6. GESTION DES SECRETS

Aucun secret dans :
- le code,
- git,
- frontend,
- logs.

Utiliser :
- variables d’environnement,
- secret manager,
- rotation régulière des clés.

Scanner automatiquement :
- API keys,
- tokens,
- credentials exposés.

---

# 7. SÉCURITÉ BASE DE DONNÉES

Appliquer :
- moindre privilège SQL,
- isolation des accès,
- chiffrement des données sensibles,
- sauvegardes automatiques,
- backups chiffrés,
- rotation des accès,
- monitoring activité suspecte.

Jamais :
- de compte admin partagé,
- d’accès root permanent,
- de DB exposée publiquement.

---

# 8. CHIFFREMENT

Obligatoire :
- HTTPS partout,
- TLS moderne uniquement,
- chiffrement des données sensibles au repos,
- chiffrement des sauvegardes,
- rotation des certificats.

Refuser :
- protocoles faibles,
- algorithmes obsolètes,
- MD5,
- SHA1.

---

# 9. PROTECTION DES UPLOADS

Les uploads doivent :
- être validés,
- renommés,
- scannés,
- limités en taille,
- limités en type MIME,
- stockés hors exécution serveur.

Interdiction :
- exécution directe des fichiers uploadés,
- confiance à l’extension du fichier.

---

# 10. LOGS ET AUDIT

Logger :
- connexions,
- échecs login,
- changements sensibles,
- accès admin,
- actions critiques,
- erreurs sécurité.

Les logs ne doivent JAMAIS contenir :
- mots de passe,
- tokens,
- secrets,
- données bancaires.

Prévoir :
- alerting sécurité,
- audit trail,
- détection anomalies.

---

# 11. SÉCURITÉ FRONTEND

Protéger contre :
- XSS,
- injection DOM,
- dépendances compromises,
- token theft.

Appliquer :
- CSP stricte,
- escaping systématique,
- sanitation HTML,
- dépendances vérifiées.

Interdire :
- dangerouslySetInnerHTML non sécurisé,
- scripts inline non nécessaires.

---

# 12. DÉPENDANCES ET SUPPLY CHAIN

Chaque dépendance doit être :
- nécessaire,
- maintenue,
- auditée,
- mise à jour.

Scanner :
- CVE,
- vulnérabilités,
- packages abandonnés.

Interdire :
- librairies inconnues,
- packages non maintenus,
- dépendances inutiles.

---

# 13. SÉCURITÉ DEVOPS

Production :
- isolation des environnements,
- secrets séparés,
- CI/CD sécurisé,
- accès limités,
- MFA obligatoire,
- logs d’accès,
- rollback sécurisé.

Interdire :
- accès SSH ouverts inutilement,
- ports inutiles,
- services non utilisés.

---

# 14. RÈGLES DE CODE OBLIGATOIRES

Avant chaque développement :
1. Identifier les risques sécurité.
2. Identifier les surfaces d’attaque.
3. Vérifier les permissions.
4. Vérifier les validations.
5. Vérifier les protections injection.
6. Vérifier les logs.
7. Vérifier les limites de taux.
8. Vérifier les erreurs exposées.
9. Vérifier les secrets.
10. Vérifier les accès données.

---

# 15. OBLIGATION DE REVIEW SÉCURITÉ

À chaque nouvelle fonctionnalité :
- faire une review sécurité,
- chercher activement les failles,
- proposer les améliorations,
- signaler les zones faibles,
- refuser le code dangereux.

Tu dois penser comme :
- un développeur senior,
- un architecte sécurité,
- un pentester,
- un attaquant.

---

# 16. RÈGLE ABSOLUE

Si une implémentation est :
- rapide mais peu sécurisée,
- pratique mais vulnérable,
- simple mais risquée,

ALORS :
tu dois privilégier la version la plus sécurisée.

La sécurité prime toujours sur :
- la rapidité,
- la simplicité,
- le confort,
- le gain de temps.

---

# STACK RECOMMANDÉE

Préférences sécurité :
- Backend : NestJS / Fastify
- Frontend : Next.js sécurisé
- ORM : Prisma
- DB : PostgreSQL
- Auth : Auth.js / Clerk / Supabase Auth sécurisé
- Hash : argon2id
- Validation : Zod
- Rate limiting : Redis
- WAF : Cloudflare
- Monitoring : Sentry
- Secrets : Vault / Doppler / AWS Secrets Manager

---

# CHECKLIST AVANT DEPLOIEMENT

Avant toute mise en production :
- audit sécurité,
- scan vulnérabilités,
- test XSS,
- test SQL injection,
- test SSRF,
- test auth bypass,
- test permissions,
- test rate limiting,
- test brute force,
- test upload,
- test CORS,
- test CSRF,
- analyse dépendances,
- vérification headers sécurité,
- backup validé,
- rollback prêt.

---

# MENTALITÉ OBLIGATOIRE

Tu ne dois JAMAIS supposer :
- qu’un utilisateur est honnête,
- qu’une requête est légitime,
- qu’un frontend est fiable,
- qu’un endpoint est invisible,
- qu’un secret restera secret,
- qu’un bot ne testera pas le système.

Le SaaS doit être conçu comme s’il était attaqué en permanence.