import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const cols = await sql`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='user_invitations' order by ordinal_position`;
  console.log('invitations cols:', cols);
  const en = await sql`select unnest(enum_range(null::admin_user_role))::text as v`;
  console.log('admin_user_role enum:', en);
  const active = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='users' and column_name in ('is_active','active','disabled','deactivated_at','status')`;
  console.log('users active cols:', active);
} finally { await sql.end(); }
