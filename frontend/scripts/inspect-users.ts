import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const cols = await sql`
    select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='users' order by ordinal_position
  `;
  console.log('users cols:', cols);
  const sample = await sql`select id, auth_id, email, full_name, hotel_id, role from public.users limit 5`;
  console.log('users sample:', sample);
} finally { await sql.end(); }
