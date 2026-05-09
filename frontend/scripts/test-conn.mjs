import postgres from 'postgres';
const variants = [
  'postgresql://postgres.hzrzkvdebaadditvbqis:WxzrvqxfF0PQGKy5@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.hzrzkvdebaadditvbqis:WxzrvqxfF0PQGKy5@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.hzrzkvdebaadditvbqis:WxzrvqxfF0PQGKy5@aws-1-eu-central-1.pooler.supabase.com:5432/postgres',
];
for (const url of variants) {
  const sql = postgres(url, { ssl: 'require', prepare: false, max: 1, connect_timeout: 8 });
  try {
    const r = await sql`select current_user, current_database(), version() limit 1`;
    console.log('OK:', url.split('@')[1], '→', r[0].current_user, r[0].current_database);
    await sql.end();
    process.exit(0);
  } catch (e) {
    console.log('FAIL:', url.split('@')[1], '→', e.code || e.message?.slice(0,80));
    try { await sql.end(); } catch {}
  }
}
