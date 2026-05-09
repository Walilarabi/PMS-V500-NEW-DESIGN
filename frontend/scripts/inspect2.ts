import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });

try {
  console.log('=== get_user_hotel_id ===');
  const a = await sql`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_user_hotel_id'`;
  for (const r of a) console.log(r.def);

  console.log('\n=== get_user_role ===');
  const b = await sql`select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_user_role'`;
  for (const r of b) console.log(r.def);

  console.log('\n=== users / profiles tables ===');
  const t = await sql`
    select table_name from information_schema.tables
    where table_schema='public' and (table_name like '%user%' or table_name like '%profile%' or table_name='members')
  `;
  for (const r of t) console.log(' -', r.table_name);

  console.log('\n=== existing policies ===');
  const p = await sql`select schemaname, tablename, policyname from pg_policies where schemaname='public' order by 1,2,3`;
  for (const r of p) console.log(` ${r.schemaname}.${r.tablename}: ${r.policyname}`);

  console.log('\n=== auth.users count ===');
  const u = await sql`select count(*)::int as c from auth.users`;
  console.log('count =', u[0].c);

  const hotels = await sql`select id, name, country, currency, created_at from public.hotels order by created_at`;
  console.log('\n=== hotels rows ===');
  for (const h of hotels) console.log(' -', h.id, '|', h.name, '|', h.country, h.currency);
} finally {
  await sql.end();
}
