# V12 — Activation `auth_leaked_password_protection` (Supabase dashboard)

## Contexte

Supabase Advisors a remonté un WARN `auth_leaked_password_protection` désactivé.
Quand activé, Supabase Auth vérifie chaque mot de passe contre la base
HaveIBeenPwned.org au moment de la création/réinitialisation, et refuse les
mots de passe connus dans des fuites publiques.

## Pourquoi ce n'est pas dans la migration SQL

Cette protection est un setting **côté Supabase Auth Service**, pas une
ligne en base. Il n'existe pas de SQL pour l'activer — il faut un toggle
sur le dashboard Supabase OU un appel à l'API Management.

## Procédure manuelle (5 minutes)

1. Ouvrir https://supabase.com/dashboard/project/hzrzkvdebaadditvbqis/auth/providers
2. Onglet **Auth → Settings**
3. Section **Password security**
4. Activer **Leaked password protection (HaveIBeenPwned)**
5. Sauver

## Procédure automatisée alternative

Via Supabase Management API :

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/hzrzkvdebaadditvbqis/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password_hibp_enabled": true}'
```

(Nécessite `SUPABASE_ACCESS_TOKEN` du compte propriétaire, non disponible
dans l'environnement Edge Function / migration SQL.)

## Validation après activation

Re-exécuter `mcp_get_advisors(security)` et vérifier que le finding
`auth_leaked_password_protection` a disparu.

## Effort réel

5 minutes via dashboard, à faire **avant le pilote hôtelier**.
Sans ce toggle, un user peut créer un compte avec « password123 » et le
système n'émet aucune alerte.
