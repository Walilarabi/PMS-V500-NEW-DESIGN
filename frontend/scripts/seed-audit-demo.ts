import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  // Create a fake bank statement, update it, delete it -> 3 audit events
  const inserted = await sql`
    insert into public.bank_statements (hotel_id, source, external_reference, description, amount, currency, posted_at, status)
    values ('00000000-0000-0000-0000-000000000001', 'BOOKING', 'AUDIT-DEMO-001', 'Audit demo seed', 100.00, 'EUR', now(), 'UNMATCHED')
    returning id
  `;
  const id = inserted[0].id;
  console.log('Created bank_statement:', id);
  await sql`update public.bank_statements set description = 'Audit demo seed (modified)', amount = 150.00 where id = ${id}`;
  await sql`update public.bank_statements set status = 'IGNORED' where id = ${id}`;
  await sql`delete from public.bank_statements where id = ${id}`;
  console.log('Done updating + deleting');

  // Also update one planning_event
  const ev = await sql`select id from public.planning_events limit 1`;
  if (ev.length > 0) {
    await sql`update public.planning_events set description = coalesce(description, '') || ' [audit-test]' where id = ${ev[0].id}`;
    console.log('Touched planning_event:', ev[0].id);
  }

  const cnt = await sql`select count(*)::int as n from public.audit_logs`;
  console.log('audit_logs total now:', cnt);
} finally { await sql.end(); }
