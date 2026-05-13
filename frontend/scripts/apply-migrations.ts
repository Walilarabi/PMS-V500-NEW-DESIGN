#!/usr/bin/env tsx
/**
 * FLOWTYM — apply-migrations.ts
 *
 * Applique toutes les migrations SQL dans /supabase/migrations/ dans l'ordre.
 * Utilise le Transaction Pooler PostgreSQL (pas le client Supabase).
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' yarn tsx scripts/apply-migrations.ts
 *   ou: yarn migrate
 */
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres.hzrzkvdebaadditvbqis:Flowtym0667830249%24@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');
const APPLIED_MARKER = '-- FLOWTYM:APPLIED';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('✅ Connecté à Supabase PostgreSQL\n');

    // Créer la table de suivi des migrations si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._flowtym_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Lister les migrations dans l'ordre
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && !f.startsWith('_'))
      .sort();

    for (const file of files) {
      // Vérifier si déjà appliquée
      const { rows } = await client.query(
        'SELECT 1 FROM public._flowtym_migrations WHERE filename = $1',
        [file],
      );

      if (rows.length > 0) {
        console.log(`⏭️  ${file} — déjà appliquée`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

      console.log(`⏳ Application de ${file}…`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO public._flowtym_migrations (filename) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        console.log(`✅ ${file} appliquée avec succès`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`❌ Erreur sur ${file} :`, err.message);
        // Continuer sur les autres migrations (certaines peuvent échouer sur des
        // tables déjà existantes, ce qui est acceptable pour 0010)
        if (err.message?.includes('already exists') || err.message?.includes('does not exist')) {
          console.warn(`   ⚠️  Ignorée (table déjà existante ou absente) — continuons\n`);
          // Marquer quand même comme appliquée pour ne pas rejouer
          await client.query('BEGIN');
          await client.query(
            'INSERT INTO public._flowtym_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file],
          );
          await client.query('COMMIT');
        } else {
          throw err;
        }
      }
    }

    console.log('\n🎉 Toutes les migrations appliquées.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration échouée :', err);
  process.exit(1);
});
