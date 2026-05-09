import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('need DATABASE_URL'); process.exit(1); }

const sql = postgres(DATABASE_URL, { ssl: 'require', prepare: false, max: 1 });

const tablesToInspect = [
  'hotels', 'rooms', 'reservations', 'guests', 'invoices', 'payments',
  'staff_members', 'rate_plans', 'maintenance_tasks',
];

try {
  for (const t of tablesToInspect) {
    console.log(`\n=== ${t} ===`);
    const cols = await sql`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema='public' and table_name=${t}
      order by ordinal_position
    `;
    for (const c of cols) {
      console.log(`  ${c.column_name.padEnd(28)} ${c.data_type.padEnd(28)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }
  }
  // FKs
  console.log('\n=== Foreign Keys ===');
  const fks = await sql`
    select tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu using (constraint_name, table_schema)
    join information_schema.constraint_column_usage ccu using (constraint_name, table_schema)
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
    order by tc.table_name, kcu.column_name
  `;
  for (const fk of fks) console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.ref_table}.${fk.ref_column}`);
} finally {
  await sql.end();
}
