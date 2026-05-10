import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  // Trigger an audit by updating a dispute's auto_send_paused
  const d = await sql`select id from public.ota_disputes limit 1`;
  if (d.length > 0) {
    const id = d[0].id;
    await sql`update public.ota_disputes set auto_send_paused = not auto_send_paused where id = ${id}`;
    await sql`update public.ota_disputes set auto_send_paused = not auto_send_paused where id = ${id}`;
    console.log('Toggled twice on dispute', id);
  }
  const cnt = await sql`select count(*)::int as n from public.audit_logs`;
  console.log('audit_logs count:', cnt);
  const recent = await sql`
    select entity, action, entity_id, actor_user_id, payload, created_at
    from public.audit_logs order by created_at desc limit 5
  `;
  console.log('recent:', JSON.stringify(recent, null, 2));
} finally { await sql.end(); }
