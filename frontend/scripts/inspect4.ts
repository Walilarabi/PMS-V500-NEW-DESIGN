import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
  try {
    const exists = await sql`select to_regclass('public.users') as t, to_regclass('public.audit_logs') as a, to_regclass('public.app_users') as au`;
    console.log('public.users =', exists[0].t);
    console.log('public.audit_logs =', exists[0].a);
    console.log('public.app_users =', exists[0].au);

    console.log('\nauth.users sample:');
    const u = await sql`select id, email, raw_app_meta_data, created_at from auth.users order by created_at limit 10`;
    for (const r of u) console.log(' -', r.id, '|', r.email, '| meta=', JSON.stringify(r.raw_app_meta_data));

    console.log('\nrate plans, rooms count per hotel:');
    const c = await sql`
      select h.name, h.id::text as hid,
        (select count(*)::int from rooms where hotel_id=h.id) as rooms,
        (select count(*)::int from reservations where hotel_id=h.id) as resa
      from hotels h order by h.created_at`;
    for (const r of c) console.log(' -', r.name.padEnd(28), '| rooms=', r.rooms, '| resa=', r.resa, '| id=', r.hid);
  } finally { await sql.end(); }
}
main();
