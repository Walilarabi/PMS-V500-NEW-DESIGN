import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const cols = await sql`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns where table_schema='public' and table_name='users'
    order by ordinal_position
  `;
  console.log('users cols:', cols);
  const sample = await sql`select id, auth_id, email, full_name, hotel_id, role, created_at from public.users limit 10`;
  console.log('users sample:', sample);
  const invs = await sql`
    select table_name from information_schema.tables
    where table_schema='public' and (table_name ilike '%invit%')
    order by table_name
  `;
  console.log('invitation tables:', invs);
  const policies = await sql`
    select policyname, cmd, qual::text, with_check::text from pg_policies where schemaname = 'public' and tablename = 'users'
  `;
  console.log('users policies:', policies);
} finally { await sql.end(); }
