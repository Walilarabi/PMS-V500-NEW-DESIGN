import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const channels = await sql`select code, name, color, position from public.planning_channels order by position`;
  console.log('CHANNELS:', channels);
  const events = await sql`select name, start_date, end_date, impact, source from public.planning_events order by start_date`;
  console.log('EVENTS:', events);
} finally {
  await sql.end({ timeout: 5 });
}
