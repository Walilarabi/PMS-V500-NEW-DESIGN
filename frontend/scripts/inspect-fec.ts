import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  for (const t of ['hotels', 'invoices', 'payments']) {
    const cols = await sql`select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name=${t} order by ordinal_position`;
    console.log(`\n=== ${t} (${cols.length} cols) ===`);
    for (const c of cols) console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}${c.is_nullable === 'YES' ? ' NULL' : ''}`);
  }
  // counts
  for (const t of ['invoices', 'payments']) {
    const cnt = await sql.unsafe(`select count(*)::int as n from public.${t}`);
    console.log(`${t}: ${cnt[0].n} rows`);
  }
  // hotels sample
  const h = await sql`select * from public.hotels limit 1`;
  console.log('hotel sample:', h);
} finally { await sql.end(); }
