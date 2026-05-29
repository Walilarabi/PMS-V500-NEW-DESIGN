-- ═══════════════════════════════════════════════════════════════════
-- FLOWTYM — room_types table
--
-- Source de vérité pour les typologies de chambres dans Settings.
-- Le calendrier tarifaire lit désormais ici en priorité.
-- Seedé à partir de public.rooms (rooms groupés par room_type_code).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.room_types (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id                    UUID        NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_type_code              TEXT        NOT NULL,
  room_type_name              TEXT        NOT NULL,
  capacity                    INTEGER     NOT NULL DEFAULT 2,
  bathroom                    TEXT        NOT NULL DEFAULT 'Douche',
  equipment                   JSONB       NOT NULL DEFAULT '[]',
  view                        TEXT,
  description                 TEXT,
  is_reference                BOOLEAN     NOT NULL DEFAULT false,
  is_active                   BOOLEAN     NOT NULL DEFAULT true,
  diff_from_ref               NUMERIC(8,2) NOT NULL DEFAULT 0,
  diff_type                   TEXT        NOT NULL DEFAULT 'fixed'
                                          CHECK (diff_type IN ('fixed', 'percent')),
  partner_ids                 JSONB       NOT NULL DEFAULT '[]',
  is_virtual                  BOOLEAN     NOT NULL DEFAULT false,
  virtual_kind                TEXT,
  virtual_component_ids       TEXT[],
  virtual_components_required TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, room_type_code)
);

CREATE INDEX IF NOT EXISTS idx_room_types_hotel
  ON public.room_types(hotel_id);

ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY room_types_tenant_select ON public.room_types
  FOR SELECT USING (hotel_id = get_user_hotel_id());

CREATE POLICY room_types_tenant_insert ON public.room_types
  FOR INSERT WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY room_types_tenant_update ON public.room_types
  FOR UPDATE
  USING  (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

CREATE POLICY room_types_tenant_delete ON public.room_types
  FOR DELETE USING (hotel_id = get_user_hotel_id());

-- Seed from existing rooms data
INSERT INTO public.room_types (
  hotel_id, room_type_code, room_type_name,
  capacity, is_reference, is_active, created_at, updated_at
)
SELECT
  r.hotel_id,
  r.room_type_code,
  MAX(COALESCE(r.type, r.room_type_code))  AS room_type_name,
  COUNT(*)::INTEGER                         AS capacity,
  false                                     AS is_reference,
  true                                      AS is_active,
  now(),
  now()
FROM public.rooms r
WHERE r.room_type_code IS NOT NULL
  AND r.hotel_id IS NOT NULL
GROUP BY r.hotel_id, r.room_type_code
ON CONFLICT (hotel_id, room_type_code) DO NOTHING;
