-- FLOWTYM — Missing tables migration
-- Creates all tables referenced by frontend services that had no migration:
--   rms_settings, salon_events,
--   analysis_alert_watchers, analysis_alert_triggers,
--   analysis_user_favorites, analysis_user_recent, analysis_saved_views,
--   hk_staff, hk_tasks, maintenance_tickets,
--   tva_snapshots, debtors_aged, closure_workflow, proforma_quotes
--
-- RLS uses get_user_hotel_id() (never the hotel_users subquery anti-pattern).

-- ─────────────────────────────────────────────────────────────────────────────
-- rms_settings — per-hotel RMS push markup configuration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rms_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  push_markup_percent NUMERIC(5,2) NOT NULL DEFAULT 5,
  auto_push_enabled   BOOLEAN NOT NULL DEFAULT true,
  min_markup_percent  NUMERIC(5,2) NOT NULL DEFAULT -50,
  max_markup_percent  NUMERIC(5,2) NOT NULL DEFAULT 100,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES auth.users(id),
  CONSTRAINT rms_settings_hotel_unique UNIQUE (hotel_id),
  CONSTRAINT rms_settings_markup_range CHECK (min_markup_percent <= max_markup_percent)
);

CREATE INDEX IF NOT EXISTS idx_rms_settings_hotel ON public.rms_settings(hotel_id);

ALTER TABLE public.rms_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY rms_settings_select_own ON public.rms_settings
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_settings_insert_own ON public.rms_settings
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY rms_settings_update_own ON public.rms_settings
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- salon_events — hotel event catalog (trade shows, exhibitions, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.salon_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_name       TEXT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  location         TEXT,
  impact           TEXT,
  source           TEXT NOT NULL DEFAULT 'excel_import',
  source_file_name TEXT,
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by      UUID REFERENCES auth.users(id),
  CONSTRAINT salon_events_natural_key UNIQUE (hotel_id, event_name, start_date),
  CONSTRAINT salon_events_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_salon_events_hotel_date  ON public.salon_events(hotel_id, start_date);
CREATE INDEX IF NOT EXISTS idx_salon_events_hotel_range ON public.salon_events(hotel_id, end_date, start_date);

ALTER TABLE public.salon_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY salon_events_select_own ON public.salon_events
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY salon_events_insert_own ON public.salon_events
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY salon_events_update_future_own ON public.salon_events
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id() AND end_date >= CURRENT_DATE)
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY salon_events_delete_own ON public.salon_events
  FOR DELETE USING (hotel_id = public.get_user_hotel_id() AND end_date >= CURRENT_DATE);

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_alert_watchers — KPI threshold monitors
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_alert_watchers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  metric              TEXT NOT NULL,
  operator            TEXT NOT NULL CHECK (operator IN ('<','<=','>','>=','=')),
  threshold           NUMERIC NOT NULL,
  period              TEXT NOT NULL CHECK (period IN ('today','last_7d','last_30d')),
  severity            TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  enabled             BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  last_evaluated_at   TIMESTAMPTZ,
  last_triggered_at   TIMESTAMPTZ,
  last_value          NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_watchers_hotel   ON public.analysis_alert_watchers(hotel_id);
CREATE INDEX IF NOT EXISTS idx_alert_watchers_enabled ON public.analysis_alert_watchers(hotel_id, enabled);

ALTER TABLE public.analysis_alert_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_watchers_select_own ON public.analysis_alert_watchers
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_watchers_insert_own ON public.analysis_alert_watchers
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_watchers_update_own ON public.analysis_alert_watchers
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_watchers_delete_own ON public.analysis_alert_watchers
  FOR DELETE USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_alert_triggers — alert trigger history (append-only inbox)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_alert_triggers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watcher_id       UUID NOT NULL REFERENCES public.analysis_alert_watchers(id) ON DELETE CASCADE,
  hotel_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  value            NUMERIC NOT NULL,
  threshold        NUMERIC NOT NULL,
  message          TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  acknowledged     BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_hotel        ON public.analysis_alert_triggers(hotel_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_watcher      ON public.analysis_alert_triggers(watcher_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_unacknowledged ON public.analysis_alert_triggers(hotel_id, acknowledged) WHERE acknowledged = false;

ALTER TABLE public.analysis_alert_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_triggers_select_own ON public.analysis_alert_triggers
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_triggers_insert_own ON public.analysis_alert_triggers
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY alert_triggers_update_own ON public.analysis_alert_triggers
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_user_favorites — per-user report favorites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_user_favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analysis_user_favorites_unique UNIQUE (user_id, hotel_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user  ON public.analysis_user_favorites(user_id, hotel_id);

ALTER TABLE public.analysis_user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_favorites_own ON public.analysis_user_favorites
  FOR ALL
  USING (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id())
  WITH CHECK (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_user_recent — per-user recent report visits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_user_recent (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id   TEXT NOT NULL,
  visited_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analysis_user_recent_unique UNIQUE (user_id, hotel_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_user_recent_user ON public.analysis_user_recent(user_id, hotel_id, visited_at DESC);

ALTER TABLE public.analysis_user_recent ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_recent_own ON public.analysis_user_recent
  FOR ALL
  USING (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id())
  WITH CHECK (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id());

-- RPC: upsert + truncate to MAX_RECENT=10 (called fire-and-forget by pushRecent)
CREATE OR REPLACE FUNCTION public.push_user_recent(p_report_id TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_hotel_id UUID := public.get_user_hotel_id();
BEGIN
  IF v_user_id IS NULL OR v_hotel_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.analysis_user_recent (user_id, hotel_id, report_id, visited_at)
  VALUES (v_user_id, v_hotel_id, p_report_id, now())
  ON CONFLICT (user_id, hotel_id, report_id) DO UPDATE SET visited_at = now();

  -- Keep only the 10 most recent
  DELETE FROM public.analysis_user_recent
  WHERE user_id = v_user_id AND hotel_id = v_hotel_id
    AND id NOT IN (
      SELECT id FROM public.analysis_user_recent
      WHERE user_id = v_user_id AND hotel_id = v_hotel_id
      ORDER BY visited_at DESC
      LIMIT 10
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.push_user_recent(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.push_user_recent(TEXT) FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- analysis_saved_views — saved filter/view configurations per user+hotel
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_saved_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  filters    JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user   ON public.analysis_saved_views(user_id, hotel_id, report_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_updated ON public.analysis_saved_views(hotel_id, updated_at DESC);

ALTER TABLE public.analysis_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_views_own ON public.analysis_saved_views
  FOR ALL
  USING (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id())
  WITH CHECK (user_id = auth.uid() AND hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- hk_staff — housekeeping team members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hk_staff (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'housekeeper'
               CHECK (role IN ('housekeeper','supervisor','inspector')),
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','inactive','on_leave')),
  color      TEXT NOT NULL DEFAULT '#6366f1',
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_staff_hotel  ON public.hk_staff(hotel_id);
CREATE INDEX IF NOT EXISTS idx_hk_staff_active ON public.hk_staff(hotel_id, status);

ALTER TABLE public.hk_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY hk_staff_select_own ON public.hk_staff
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY hk_staff_insert_own ON public.hk_staff
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY hk_staff_update_own ON public.hk_staff
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY hk_staff_delete_own ON public.hk_staff
  FOR DELETE USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- hk_tasks — housekeeping task assignments
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hk_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  room_id        UUID,
  room_number    TEXT NOT NULL,
  task_type      TEXT NOT NULL DEFAULT 'cleaning'
                   CHECK (task_type IN ('cleaning','inspection','turndown','deep_clean','checkout')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_progress','done','validated','skipped')),
  priority       TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to    UUID REFERENCES public.hk_staff(id) ON DELETE SET NULL,
  notes          TEXT,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  validated_at   TIMESTAMPTZ,
  scheduled_for  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_hotel_date    ON public.hk_tasks(hotel_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned      ON public.hk_tasks(assigned_to, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status        ON public.hk_tasks(hotel_id, status, scheduled_for);

ALTER TABLE public.hk_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY hk_tasks_select_own ON public.hk_tasks
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY hk_tasks_insert_own ON public.hk_tasks
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY hk_tasks_update_own ON public.hk_tasks
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY hk_tasks_delete_own ON public.hk_tasks
  FOR DELETE USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- maintenance_tickets — facility/room maintenance requests
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  room_id        UUID,
  room_number    TEXT,
  title          TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL DEFAULT 'general'
                   CHECK (category IN ('plumbing','electrical','hvac','furniture','equipment','cleaning','safety','general')),
  priority       TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','high','urgent','critical')),
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','in_progress','pending_parts','resolved','closed','cancelled')),
  assigned_to    UUID REFERENCES public.hk_staff(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  estimated_cost NUMERIC(10,2),
  actual_cost    NUMERIC(10,2),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maint_hotel_status ON public.maintenance_tickets(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_maint_hotel_date   ON public.maintenance_tickets(hotel_id, created_at DESC);

ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY maint_select_own ON public.maintenance_tickets
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY maint_insert_own ON public.maintenance_tickets
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY maint_update_own ON public.maintenance_tickets
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY maint_delete_own ON public.maintenance_tickets
  FOR DELETE USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- tva_snapshots — monthly TVA period snapshots (fiscal audit trail)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tva_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_year    SMALLINT NOT NULL,
  period_month   SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  encours_debut  NUMERIC(14,2) NOT NULL DEFAULT 0,
  encours_fin    NUMERIC(14,2) NOT NULL DEFAULT 0,
  ca_debits      NUMERIC(14,2) NOT NULL DEFAULT 0,
  ca_taxable     NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_10        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tva_10         NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_55        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tva_55         NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_20        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tva_20         NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_21        NUMERIC(14,2) NOT NULL DEFAULT 0,
  tva_21         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_tva      NUMERIC(14,2) NOT NULL DEFAULT 0,
  fiscal_stamp   TEXT NOT NULL DEFAULT '',
  payload_hash   TEXT NOT NULL DEFAULT '',
  locked         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tva_snapshots_period_unique UNIQUE (hotel_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_tva_snapshots_hotel ON public.tva_snapshots(hotel_id, period_year DESC, period_month DESC);

ALTER TABLE public.tva_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY tva_snapshots_select_own ON public.tva_snapshots
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY tva_snapshots_insert_own ON public.tva_snapshots
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id() AND NOT locked);

CREATE POLICY tva_snapshots_update_own ON public.tva_snapshots
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id() AND NOT locked)
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- debtors_aged — aged debtor tracking
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.debtors_aged (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reservation_id   UUID,
  guest_name       TEXT NOT NULL,
  guest_email      TEXT,
  guest_phone      TEXT,
  company_name     TEXT,
  reference        TEXT,
  amount_due       NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance          NUMERIC(10,2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
  due_date         DATE NOT NULL,
  days_overdue     INTEGER GENERATED ALWAYS AS (GREATEST(0, CURRENT_DATE - due_date)) STORED,
  aging_bucket     TEXT NOT NULL DEFAULT 'current'
                     CHECK (aging_bucket IN ('paid','current','overdue_30','overdue_60','overdue_90','overdue_90_plus')),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','partial','paid','written_off','disputed')),
  last_reminder_at TIMESTAMPTZ,
  reminder_count   SMALLINT NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debtors_hotel        ON public.debtors_aged(hotel_id);
CREATE INDEX IF NOT EXISTS idx_debtors_hotel_status ON public.debtors_aged(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_debtors_overdue      ON public.debtors_aged(hotel_id, aging_bucket) WHERE status NOT IN ('paid','written_off');

ALTER TABLE public.debtors_aged ENABLE ROW LEVEL SECURITY;

CREATE POLICY debtors_select_own ON public.debtors_aged
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY debtors_insert_own ON public.debtors_aged
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY debtors_update_own ON public.debtors_aged
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY debtors_delete_own ON public.debtors_aged
  FOR DELETE USING (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- closure_workflow — night-audit closure state machine
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.closure_workflow (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  closure_date   DATE NOT NULL,
  state          TEXT NOT NULL DEFAULT 'pending'
                   CHECK (state IN ('pending','in_progress','completed','failed','rolled_back')),
  step_current   SMALLINT NOT NULL DEFAULT 0,
  steps_done     JSONB NOT NULL DEFAULT '[]',
  steps_errors   JSONB NOT NULL DEFAULT '{}',
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  duration_ms    INTEGER,
  initiated_by   UUID REFERENCES auth.users(id),
  notes          TEXT,
  CONSTRAINT closure_workflow_date_unique UNIQUE (hotel_id, closure_date)
);

CREATE INDEX IF NOT EXISTS idx_closure_hotel_date ON public.closure_workflow(hotel_id, closure_date DESC);
CREATE INDEX IF NOT EXISTS idx_closure_state      ON public.closure_workflow(hotel_id, state) WHERE state NOT IN ('completed','rolled_back');

ALTER TABLE public.closure_workflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY closure_select_own ON public.closure_workflow
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY closure_insert_own ON public.closure_workflow
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY closure_update_own ON public.closure_workflow
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- proforma_quotes — proforma/quote documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proforma_quotes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_number          TEXT NOT NULL,
  reservation_id        UUID,
  guest_name            TEXT NOT NULL,
  guest_email           TEXT,
  company_name          TEXT,
  company_siret         TEXT,
  issue_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until           DATE NOT NULL,
  total_ht              NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_tva             NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_ttc             NUMERIC(10,2) NOT NULL DEFAULT 0,
  lines                 JSONB NOT NULL DEFAULT '[]',
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','sent','accepted','expired','converted','cancelled')),
  converted_invoice_id  UUID,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT proforma_quotes_number_unique UNIQUE (hotel_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_proforma_hotel_date   ON public.proforma_quotes(hotel_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_proforma_hotel_status ON public.proforma_quotes(hotel_id, status);

ALTER TABLE public.proforma_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY proforma_select_own ON public.proforma_quotes
  FOR SELECT USING (hotel_id = public.get_user_hotel_id());

CREATE POLICY proforma_insert_own ON public.proforma_quotes
  FOR INSERT WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY proforma_update_own ON public.proforma_quotes
  FOR UPDATE
  USING (hotel_id = public.get_user_hotel_id())
  WITH CHECK (hotel_id = public.get_user_hotel_id());

CREATE POLICY proforma_delete_own ON public.proforma_quotes
  FOR DELETE USING (hotel_id = public.get_user_hotel_id() AND status = 'draft');

-- ─────────────────────────────────────────────────────────────────────────────
-- evaluate_alert_watchers RPC — called by alerts.service.ts
-- Evaluates all active watchers for the current hotel and inserts triggers.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.evaluate_alert_watchers()
RETURNS TABLE(
  watcher_id UUID,
  metric     TEXT,
  value      NUMERIC,
  threshold  NUMERIC,
  triggered  BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hotel_id UUID := public.get_user_hotel_id();
  v_watcher  RECORD;
  v_value    NUMERIC;
  v_triggered BOOLEAN;
  v_today    DATE := CURRENT_DATE;
BEGIN
  IF v_hotel_id IS NULL THEN RETURN; END IF;

  FOR v_watcher IN
    SELECT * FROM public.analysis_alert_watchers
    WHERE hotel_id = v_hotel_id AND enabled = true
  LOOP
    -- Compute metric value based on period and metric type
    v_value := NULL;

    BEGIN
      CASE v_watcher.metric
        WHEN 'occupancy' THEN
          SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE r.status NOT IN ('cancelled'))
            / NULLIF((SELECT COUNT(*) FROM public.rooms WHERE hotel_id = v_hotel_id), 0),
            2
          )
          INTO v_value
          FROM public.reservations r
          WHERE r.hotel_id = v_hotel_id
            AND CASE v_watcher.period
                  WHEN 'today' THEN v_today BETWEEN r.check_in AND r.check_out - INTERVAL '1 day'
                  WHEN 'last_7d' THEN r.check_in >= v_today - INTERVAL '7 days' AND r.check_in <= v_today
                  WHEN 'last_30d' THEN r.check_in >= v_today - INTERVAL '30 days' AND r.check_in <= v_today
                END;
        WHEN 'adr' THEN
          SELECT ROUND(AVG(r.total_amount / NULLIF(r.nights, 0)), 2)
          INTO v_value
          FROM public.reservations r
          WHERE r.hotel_id = v_hotel_id AND r.status NOT IN ('cancelled')
            AND CASE v_watcher.period
                  WHEN 'today' THEN v_today BETWEEN r.check_in AND r.check_out - INTERVAL '1 day'
                  WHEN 'last_7d' THEN r.check_in >= v_today - INTERVAL '7 days'
                  WHEN 'last_30d' THEN r.check_in >= v_today - INTERVAL '30 days'
                END;
        WHEN 'sold_rooms' THEN
          SELECT COUNT(*)
          INTO v_value
          FROM public.reservations r
          WHERE r.hotel_id = v_hotel_id AND r.status NOT IN ('cancelled')
            AND CASE v_watcher.period
                  WHEN 'today' THEN v_today BETWEEN r.check_in AND r.check_out - INTERVAL '1 day'
                  WHEN 'last_7d' THEN r.check_in >= v_today - INTERVAL '7 days'
                  WHEN 'last_30d' THEN r.check_in >= v_today - INTERVAL '30 days'
                END;
        ELSE
          v_value := 0;
      END CASE;
    EXCEPTION WHEN OTHERS THEN
      v_value := 0;
    END;

    v_value := COALESCE(v_value, 0);

    -- Evaluate operator
    v_triggered := CASE v_watcher.operator
      WHEN '<'  THEN v_value <  v_watcher.threshold
      WHEN '<=' THEN v_value <= v_watcher.threshold
      WHEN '>'  THEN v_value >  v_watcher.threshold
      WHEN '>=' THEN v_value >= v_watcher.threshold
      WHEN '='  THEN v_value =  v_watcher.threshold
      ELSE false
    END;

    -- Update last_evaluated_at and last_value
    UPDATE public.analysis_alert_watchers
    SET last_evaluated_at = now(),
        last_value = v_value,
        last_triggered_at = CASE WHEN v_triggered THEN now() ELSE last_triggered_at END
    WHERE id = v_watcher.id;

    -- Insert trigger record when fired
    IF v_triggered THEN
      INSERT INTO public.analysis_alert_triggers (
        watcher_id, hotel_id, triggered_at, value, threshold, message, severity
      ) VALUES (
        v_watcher.id,
        v_hotel_id,
        now(),
        v_value,
        v_watcher.threshold,
        v_watcher.name || ' : ' || v_watcher.metric || ' ' || v_watcher.operator || ' ' || v_watcher.threshold::text || ' (valeur: ' || v_value::text || ')',
        v_watcher.severity
      );
    END IF;

    RETURN QUERY SELECT v_watcher.id, v_watcher.metric, v_value, v_watcher.threshold, v_triggered;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_alert_watchers() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_alert_watchers() FROM anon;
