import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const all = await sql`
    select table_schema, table_name, table_type
    from information_schema.tables
    where table_name='users' or table_name like '%user%'
    order by 1,2
  `;
  console.log('=== users-like tables (all schemas) ===');
  for (const r of all) console.log(` ${r.table_schema}.${r.table_name} [${r.table_type}]`);

  console.log('\n=== columns of users (any schema where it exists) ===');
  const cols = await sql`
    select table_schema, column_name, data_type
    from information_schema.columns
    where table_name='users'
    order by table_schema, ordinal_position
  `;
  let prev = '';
  for (const c of cols) {
    if (c.table_schema !== prev) { console.log(`\n--- ${c.table_schema}.users ---`); prev = c.table_schema; }
    console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`);
  }

  console.log('\n=== custom enums ===');
  const enums = await sql`
    select n.nspname as schema, t.typname as name,
           array_agg(e.enumlabel order by e.enumsortorder) as values
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname in ('public') group by 1,2 order by 1,2
  `;
  for (const r of enums) console.log(` ${r.schema}.${r.name}: ${r.values.join(', ')}`);
} finally { await sql.end(); }
