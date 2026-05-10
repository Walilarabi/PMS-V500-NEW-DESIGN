import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  // Update a planning_event to trigger an audit
  const ev = await sql`select id from public.planning_events limit 1`;
  if (ev.length > 0) {
    await sql`update public.planning_events set description = coalesce(description, '') || ' [audit2]' where id = ${ev[0].id}`;
  }
  const recent = await sql`
    select entity, action, actor_user_id, actor_label, created_at
    from public.audit_logs
    order by created_at desc
    limit 3
  `;
  console.log(JSON.stringify(recent, null, 2));
} finally { await sql.end(); }
