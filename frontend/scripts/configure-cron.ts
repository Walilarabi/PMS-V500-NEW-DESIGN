import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });

const BACKEND_URL = process.argv[2];
const CRON_SECRET = process.argv[3];

if (!BACKEND_URL || !CRON_SECRET) {
  console.error('Usage: yarn tsx scripts/configure-cron.ts <BACKEND_URL> <CRON_SECRET>');
  process.exit(1);
}

try {
  // Insert/update secrets in the private `_odms_cron_config` table.
  // Only service_role can write here (RLS on public/anon/authenticated).
  await sql`
    insert into public._odms_cron_config (key, value, updated_at) values
      ('backend_url', ${BACKEND_URL}, now()),
      ('cron_secret', ${CRON_SECRET}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
  console.log('Secrets stored in _odms_cron_config.');

  const jobs = await sql`select jobid, jobname, schedule, command, active from cron.job where jobname = 'odms_dispatch_reminders'`;
  console.log('Job:', jobs);
} finally {
  await sql.end({ timeout: 5 });
}
