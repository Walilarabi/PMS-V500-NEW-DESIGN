-- ═══════════════════════════════════════════════════════════════════════════
-- FLOWTYM Settings — Backends réels (Phase 7)
--
-- Tables pour brancher les Edge Functions :
--   - api_keys             : clés API hashées par tenant (clair jamais stocké)
--   - settings_backups_log : journal des runs de backup
--
-- Le détail des sessions Supabase reste géré par auth.sessions natif.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── api_keys ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  label TEXT NOT NULL,
  prefix TEXT NOT NULL,                          -- 12 chars pour ID visuel
  secret_hash TEXT NOT NULL,                     -- SHA-256 du secret en clair
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],

  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),

  last_used_at TIMESTAMPTZ,
  uses_count BIGINT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE (hotel_id, prefix)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hotel ON api_keys(hotel_id, revoked);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix) WHERE revoked = FALSE;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- SELECT : tout user du tenant peut lire (mais jamais le secret_hash via le client)
CREATE POLICY api_keys_select_own
  ON api_keys FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- INSERT/UPDATE/DELETE : réservé aux admins (l'Edge Function utilise le
-- service-role qui bypass RLS, donc cette policy garde-fou les appels directs)
CREATE POLICY api_keys_admin_only
  ON api_keys FOR ALL
  USING (
    hotel_id IN (
      SELECT hu.hotel_id FROM hotel_users hu
       WHERE hu.user_id = auth.uid() AND hu.role = 'admin'
    )
  )
  WITH CHECK (
    hotel_id IN (
      SELECT hu.hotel_id FROM hotel_users hu
       WHERE hu.user_id = auth.uid() AND hu.role = 'admin'
    )
  );

-- ─── settings_backups_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings_backups_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  run_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('full', 'daily', 'critical')),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'running', 'success', 'failed')),

  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  size_bytes BIGINT,
  artifact_url TEXT,                             -- S3 URL signée
  error_message TEXT,

  triggered_by UUID REFERENCES auth.users(id),
  triggered_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (triggered_source IN ('manual', 'cron', 'api'))
);

CREATE INDEX IF NOT EXISTS idx_settings_backups_log_hotel ON settings_backups_log(hotel_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_backups_log_status ON settings_backups_log(hotel_id, status);

ALTER TABLE settings_backups_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_backups_log_select_own
  ON settings_backups_log FOR SELECT
  USING (hotel_id IN (SELECT hotel_id FROM hotel_users WHERE user_id = auth.uid()));

-- Insert/update via Edge Function uniquement (service-role bypass RLS)

-- ═══════════════════════════════════════════════════════════════════════════
-- FIN MIGRATION 20260527_settings_backends.sql
-- ═══════════════════════════════════════════════════════════════════════════
