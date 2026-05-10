import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  await sql`select public.odms_dispatch_reminders()`;
  console.log('Dispatched. Waiting 4s for async http_post…');
  await new Promise((r) => setTimeout(r, 4000));
  const r = await sql`select id, status, sent_at, dispatch_locked_at from public.ota_dispute_reminders order by created_at desc limit 3`;
  console.log(r);
} finally { await sql.end(); }
