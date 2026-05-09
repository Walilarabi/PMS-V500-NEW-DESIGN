/**
 * FLOWTYM — Apply SQL migrations on Supabase Postgres.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... yarn db:migrate
 *
 * Reads files in ./supabase/migrations/*.sql alphabetically and runs them in
 * a transaction. Tracks applied migrations in `app.schema_migrations`.
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL env var is required (Supabase Transaction Pooler URI).');
  process.exit(1);
}

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    prepare: false,
    max: 1,
  });

  try {
    await sql`create schema if not exists app`;
    await sql`
      create table if not exists app.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const applied = new Set(
      (await sql<{ version: string }[]>`select version from app.schema_migrations`).map(
        (r) => r.version,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    let appliedCount = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) {
        console.log(`✓ ${version} (already applied)`);
        continue;
      }
      const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`→ Applying ${version}…`);
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`insert into app.schema_migrations (version) values (${version})`;
      });
      console.log(`✓ ${version} applied`);
      appliedCount += 1;
    }

    console.log(`\nDone. ${appliedCount} new migration(s) applied.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
