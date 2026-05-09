/**
 * FLOWTYM — One-shot: provision walilarabi@gmail.com as direction of
 * "Mas Provencal Aix" + set a known password via Supabase Admin API.
 *
 * Usage:
 *   DATABASE_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     ADMIN_PASSWORD='…' yarn tsx scripts/seed-admin.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PASSWORD = process.env.ADMIN_PASSWORD;
  const EMAIL = process.env.ADMIN_EMAIL || 'walilarabi@gmail.com';
  const HOTEL_ID = process.env.HOTEL_ID || '00000000-0000-0000-0000-000000000001';
  const FULL_NAME = process.env.ADMIN_FULL_NAME || 'Wali Larabi';
  const ROLE = process.env.ADMIN_ROLE || 'direction';

  if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE || !PASSWORD) {
    console.error('Missing env: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD');
    process.exit(1);
  }

  // 1. Find auth user id
  const sql = postgres(DATABASE_URL, { ssl: 'require', prepare: false, max: 1 });
  let authUserId: string | null = null;
  try {
    const rows = await sql<{ id: string }[]>`select id from auth.users where email = ${EMAIL} limit 1`;
    if (rows[0]) authUserId = rows[0].id;
  } finally {
    await sql.end();
  }

  if (!authUserId) {
    // Create user via admin API
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apiKey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: FULL_NAME },
      }),
    });
    if (!r.ok) throw new Error(`Failed to create auth user: ${r.status} ${await r.text()}`);
    const j = (await r.json()) as { id: string };
    authUserId = j.id;
    console.log(`✓ auth user created: ${authUserId}`);
  } else {
    // Update password
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUserId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apiKey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
    });
    if (!r.ok) throw new Error(`Failed to update auth user password: ${r.status} ${await r.text()}`);
    console.log(`✓ auth user password updated: ${authUserId}`);
  }

  // 2. Provision in public.users via RPC
  const sql2 = postgres(DATABASE_URL, { ssl: 'require', prepare: false, max: 1 });
  try {
    const r = await sql2<{ provision_user_for_hotel: string }[]>`
      select public.provision_user_for_hotel(
        ${authUserId}::uuid,
        ${EMAIL},
        ${FULL_NAME},
        ${HOTEL_ID}::uuid,
        ${ROLE}::admin_user_role
      ) as provision_user_for_hotel
    `;
    console.log(`✓ public.users provisioned: ${r[0].provision_user_for_hotel}`);
  } finally {
    await sql2.end();
  }

  console.log('\nDone. You can now log in with:');
  console.log(`   email:    ${EMAIL}`);
  console.log(`   password: ${PASSWORD}`);
  console.log(`   hotel:    ${HOTEL_ID} (${ROLE})`);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
