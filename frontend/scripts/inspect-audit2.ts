import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const cnt = await sql`select count(*)::int as n, count(distinct entity) as nb_entities from public.audit_logs`;
  console.log('audit_logs counts:', cnt);
  const samples = await sql`
    select entity, action, count(*)::int as n
    from public.audit_logs group by entity, action order by n desc limit 20
  `;
  console.log('top (entity, action):', samples);
  const recent = await sql`
    select id, entity, entity_id, action, actor_user_id, created_at, jsonb_typeof(payload) as ptype
    from public.audit_logs order by created_at desc limit 5
  `;
  console.log('recent:', recent);
  const triggers = await sql`
    select event_object_table, trigger_name, action_timing, event_manipulation
    from information_schema.triggers
    where trigger_schema = 'public' and trigger_name ilike '%audit%'
    order by event_object_table
  `;
  console.log('audit triggers:', triggers);
  // Check RLS policies
  const policies = await sql`
    select policyname, cmd, qual::text from pg_policies where schemaname = 'public' and tablename = 'audit_logs'
  `;
  console.log('audit_logs policies:', policies);
} finally { await sql.end(); }
