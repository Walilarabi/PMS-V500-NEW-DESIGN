# FLOWTYM PMS — Test credentials

## Application admin (linked to "Mas Provencal Aix")

| Field    | Value                          |
| -------- | ------------------------------ |
| Email    | walilarabi@gmail.com           |
| Password | Flowtym2026!                   |
| Role     | direction                      |
| Hotel    | Mas Provencal Aix (Aix-en-Provence, France) |
| Hotel ID | 00000000-0000-0000-0000-000000000001 |

The user is provisioned via `provision_user_for_hotel` RPC and exists in `public.users` with `auth_id = 7afa461c-71a9-4a89-bca0-9de08e405bc7`.
JWT `app_metadata` contains `{ hotel_id, role }` consumed by RLS policies.

## Supabase project

| Field                 | Value |
| --------------------- | ----- |
| Project ref           | hzrzkvdebaadditvbqis |
| URL                   | https://hzrzkvdebaadditvbqis.supabase.co |
| Database password     | Flowtym0667830249$ (URL-encoded as `%24` in DSN) |
| Transaction Pooler    | `postgresql://postgres.hzrzkvdebaadditvbqis:Flowtym0667830249%24@aws-1-eu-central-1.pooler.supabase.com:6543/postgres` |

## How to reset / re-provision

```bash
cd /app/frontend
export DATABASE_URL='postgresql://postgres.hzrzkvdebaadditvbqis:Flowtym0667830249%24@aws-1-eu-central-1.pooler.supabase.com:6543/postgres'
export SUPABASE_URL='https://hzrzkvdebaadditvbqis.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<from /app/backend/.env>'
export ADMIN_EMAIL='walilarabi@gmail.com'
export ADMIN_PASSWORD='Flowtym2026!'
export ADMIN_FULL_NAME='Wali Larabi'
export ADMIN_ROLE='direction'
export HOTEL_ID='00000000-0000-0000-0000-000000000001'
yarn tsx scripts/seed-admin.ts
```
