# FLOWTYM — Vérifier un domaine personnalisé Resend

> Tant que `SENDER_EMAIL=onboarding@resend.dev` (sandbox), les emails ODMS
> partent mais avec un déliverabilité limitée et un branding `resend.dev`.
> Pour passer en production, vérifier un domaine custom (ex: `flowtym.com`).

## Étapes

### 1. Créer le domaine dans Resend
1. Aller sur https://resend.com/domains
2. Cliquer **Add Domain** → saisir `flowtym.com` (ou un sous-domaine dédié comme `mail.flowtym.com`)
3. Choisir la région (EU recommandée pour RGPD)

Resend affiche alors 3 enregistrements DNS à créer.

### 2. Ajouter les enregistrements DNS

Chez le registrar / DNS provider (OVH, Cloudflare, Gandi, etc.), créer :

| Type  | Hôte                         | Valeur                                                              | TTL  |
|-------|------------------------------|---------------------------------------------------------------------|------|
| MX    | `send.flowtym.com`           | `10 feedback-smtp.eu-west-1.amazonses.com`                          | 3600 |
| TXT   | `send.flowtym.com`           | `v=spf1 include:amazonses.com ~all`                                 | 3600 |
| TXT   | `resend._domainkey.flowtym.com` | (clé DKIM fournie par Resend, ~400 caractères, commence par `p=`)| 3600 |

*Optionnel mais recommandé* : un enregistrement DMARC pour la politique d'authentification :

| Type | Hôte                  | Valeur                                                  |
|------|-----------------------|---------------------------------------------------------|
| TXT  | `_dmarc.flowtym.com`  | `v=DMARC1; p=quarantine; rua=mailto:dmarc@flowtym.com`  |

### 3. Vérifier dans Resend
Une fois propagation DNS faite (5 min à 24 h selon TTL), cliquer **Verify DNS Records** sur la page Resend du domaine. Les 3 lignes doivent passer en `Verified`.

### 4. Mettre à jour FLOWTYM
Dans `/app/backend/.env`, remplacer :
```diff
- SENDER_EMAIL=onboarding@resend.dev
+ SENDER_EMAIL=disputes@flowtym.com
- SENDER_NAME=FLOWTYM ODMS
+ SENDER_NAME=FLOWTYM Litiges OTA
```

Puis :
```bash
sudo supervisorctl restart backend
```

### 5. Test smoke
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)
JWT=$(...) # cf scripts/seed-test-reminder.ts
curl -X POST "$API_URL/api/odms/send-reminder" \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"reminder_id":"<id>"}'
```

L'email reçu doit afficher `disputes@flowtym.com` comme expéditeur et passer
SPF + DKIM (visible dans les en-têtes Gmail / Outlook).

## Sécurité

- Ne jamais commit la clé DKIM brute (Resend la conserve dans son dashboard).
- DMARC `p=quarantine` la première semaine, puis `p=reject` une fois la stabilité confirmée.
- Configurer une alerte sur les rapports DMARC pour détecter les spoof.
