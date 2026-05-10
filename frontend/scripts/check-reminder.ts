import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const r = await sql`select id, status, sent_at, step from public.ota_dispute_reminders where id = 'cdd1cc34-cd6e-4036-9999-8f38e43a97f5'`;
  console.log(r);
} finally { await sql.end(); }
