import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });

try {
  // Find or create a test dispute
  let disputes = await sql`select id from public.ota_disputes where hotel_id = '00000000-0000-0000-0000-000000000001'::uuid limit 1`;
  if (disputes.length === 0) {
    console.log('No dispute found — skipping reminder creation. Create one via UI first.');
    process.exit(0);
  }
  const disputeId = disputes[0].id;
  console.log('Dispute:', disputeId);

  // Insert a PENDING reminder with email_payload pointing to walilarabi
  const payload = {
    subject: '[TEST] FLOWTYM ODMS — Test Resend integration',
    body_text: 'Ceci est un email de test envoyé via Resend depuis FLOWTYM ODMS.\n\nMerci.',
    html: '<h1>FLOWTYM ODMS — Test Resend</h1><p>Ceci est un email de test envoyé via <strong>Resend</strong> depuis FLOWTYM ODMS.</p>',
    to: ['walilarabi@gmail.com'],
  };
  const inserted = await sql`
    insert into public.ota_dispute_reminders (
      hotel_id, dispute_id, step, due_at, status, email_payload
    ) values (
      '00000000-0000-0000-0000-000000000001'::uuid,
      ${disputeId},
      1,
      now() - interval '1 minute',
      'PENDING',
      ${sql.json(payload as never)}
    )
    returning id
  `;
  console.log('Reminder created:', inserted[0].id);
} finally {
  await sql.end({ timeout: 5 });
}
