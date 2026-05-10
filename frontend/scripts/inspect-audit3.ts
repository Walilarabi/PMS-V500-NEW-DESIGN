import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const r = await sql`select * from public.audit_logs order by created_at desc limit 3`;
  console.log(JSON.stringify(r, null, 2));
} finally { await sql.end(); }
