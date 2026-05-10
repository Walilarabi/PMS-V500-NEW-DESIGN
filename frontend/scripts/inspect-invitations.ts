import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const cols = await sql`
    select column_name, data_type, is_nullable
    from information_schema.columns where table_schema='public' and table_name='user_invitations'
    order by ordinal_position
  `;
  console.log('user_invitations cols:', cols);
  const policies = await sql`
    select policyname, cmd, qual::text from pg_policies where schemaname='public' and tablename='user_invitations'
  `;
  console.log('user_invitations policies:', policies);
  const sample = await sql`select * from public.user_invitations limit 3`;
  console.log('sample:', sample);
} finally { await sql.end(); }
