# FLOWTYM — Supabase Runbook

Comment appliquer les migrations + déployer les Edge Functions du module
Paramètres en environnement réel.

## 1. Migrations à appliquer

Ordre chronologique des migrations Phase 5–7 (toutes idempotentes) :

```bash
supabase db push
```

Migrations concernées :

| Fichier | Description |
|---|---|
| `20260524_settings_phase2.sql` | 5 tables RBAC + audit_log + virtual_rooms |
| `20260525_rate_calendar_dedup.sql` | Purge doublons rate_plans + UNIQUE constraints |
| `20260526_settings_config_blobs.sql` | Table générique key/value JSON |
| `20260527_settings_backends.sql` | api_keys + settings_backups_log |

Après push, vérifier :

```sql
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name LIKE 'settings_%' OR table_name = 'api_keys';
```

Doit lister 8 tables : `settings_virtual_rooms`, `settings_event_sources`,
`settings_custom_partners`, `settings_imported_rate_plans`,
`settings_permissions_matrix`, `settings_audit_log`, `settings_config_blobs`,
`settings_backups_log` + `api_keys`.

## 2. Edge Functions à déployer

```bash
supabase functions deploy trigger-backup
supabase functions deploy revoke-session
supabase functions deploy api-key-create
```

Variables d'env requises sur le projet :

| Variable | Source |
|---|---|
| `SUPABASE_URL` | Auto-injectée |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role secret |
| `SUPABASE_ANON_KEY` | Settings → API → anon public |

## 3. Vérification

```bash
# Test trigger-backup
curl -X POST "$SUPABASE_URL/functions/v1/trigger-backup" \
  -H "Authorization: Bearer <user_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"scope":"daily"}'

# Test api-key-create
curl -X POST "$SUPABASE_URL/functions/v1/api-key-create" \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"label":"Test","scopes":["read"]}'
```

## 4. Worker async (Phase production)

Les Edge Functions ci-dessus enregistrent uniquement l'intention dans
les tables d'audit. Pour exécuter réellement les backups :

```sql
-- Cron pg_cron toutes les 5 minutes : drain les backups 'scheduled'
SELECT cron.schedule(
  'flowtym-backup-worker',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://your-worker.example.com/run-backup',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.worker_token')),
    body := (SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT run_id, hotel_id, scope FROM settings_backups_log
       WHERE status = 'scheduled' LIMIT 10
    ) t)::text
  )$$
);
```

Le worker externe gère le pg_dump tenant-scoped + upload S3 + update du
statut dans `settings_backups_log`.

## 5. Rollback

```bash
# Annuler la dernière migration
supabase db reset --linked

# Désactiver une Edge Function sans la supprimer
supabase functions delete trigger-backup
```
