import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and (table_name ilike '%payment%' or table_name ilike '%refund%' or table_name ilike '%invoice%' or table_name ilike '%billing%' or table_name ilike '%folio%')
    order by table_name
  `;
  console.log('payment/refund/invoice tables:', tables);
  for (const t of tables) {
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema='public' and table_name=${t.table_name}
      order by ordinal_position
    `;
    console.log(`-- ${t.table_name}:`, cols.map(c => c.column_name).join(', '));
  }
} finally { await sql.end(); }
