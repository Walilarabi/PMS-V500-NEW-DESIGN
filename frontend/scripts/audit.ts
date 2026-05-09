/**
 * FLOWTYM — Audit live Supabase schema.
 *
 * Lists tables, RLS state, policies and counts in the public schema.
 * Useful before/after running migrations.
 *
 * Usage: DATABASE_URL=postgresql://... yarn db:audit
 */
import 'dotenv/config';
import process from 'node:process';

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var is required.');
  process.exit(1);
}

interface TableInfo {
  schema: string;
  name: string;
  rls_enabled: boolean;
  policy_count: number;
}

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, { ssl: 'require', prepare: false, max: 1 });
  try {
    const rows = await sql<TableInfo[]>`
      select
        n.nspname  as schema,
        c.relname  as name,
        c.relrowsecurity as rls_enabled,
        coalesce((select count(*) from pg_policies p
                  where p.schemaname = n.nspname and p.tablename = c.relname), 0)::int
                  as policy_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname in ('public', 'app')
      order by n.nspname, c.relname
    `;

    console.log('FLOWTYM — Supabase audit');
    console.log('========================');
    console.log(`schema | table | rls | policies`);
    console.log('-------+-------+-----+---------');
    for (const r of rows) {
      console.log(
        `${r.schema.padEnd(7)}| ${r.name.padEnd(22)}| ${
          r.rls_enabled ? 'ON ' : 'off'
        } | ${r.policy_count}`,
      );
    }

    const fns = await sql<{ name: string }[]>`
      select p.proname as name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public','app')
      order by 1
    `;
    console.log('\nFunctions:');
    for (const f of fns) console.log(' -', f.name);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
