import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and (table_name like '%audit%' or table_name like '%log%' or table_name like '%history%' or table_name like '%event%')
    order by table_name
  `;
  console.log('Audit/log/history tables:', tables);
  // For one of them, show schema if exists
  for (const t of tables) {
    const cols = await sql`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public' and table_name = ${t.table_name}
      order by ordinal_position
    `;
    console.log(`-- ${t.table_name}:`, cols);
  }
} finally { await sql.end(); }
