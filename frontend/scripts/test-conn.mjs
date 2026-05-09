import postgres from 'postgres';
const PWD = 'Flowtym0667830249$';
const sql = postgres({
  host: 'aws-1-eu-central-1.pooler.supabase.com',
  port: 6543,
  user: 'postgres.hzrzkvdebaadditvbqis',
  password: PWD,
  database: 'postgres',
  ssl: 'require',
  prepare: false,
  max: 1,
  connect_timeout: 8,
});
try {
  const r = await sql`select current_user, current_database(), version() limit 1`;
  console.log('OK:', r[0].current_user, '/', r[0].current_database);
} catch (e) {
  console.log('FAIL:', e.code || e.message?.slice(0,100));
} finally {
  await sql.end();
}
