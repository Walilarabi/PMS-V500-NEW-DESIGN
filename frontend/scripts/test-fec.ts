import 'dotenv/config';
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false, max: 1 });
try {
  const rows = await sql`select "JournalCode","EcritureNum","EcritureDate","CompteNum","CompteLib","PieceRef","EcritureLib","Debit","Credit" from public.v_fec_entries order by "EcritureNum", sub_order`;
  console.log(`${rows.length} FEC rows:`);
  for (const r of rows) {
    console.log(`  ${r.EcritureNum} | ${r.EcritureDate} | ${r.CompteNum} ${r.CompteLib.padEnd(22)} | D=${(r.Debit||'').padStart(10)} C=${(r.Credit||'').padStart(10)} | ${r.EcritureLib}`);
  }
  // Verify balance per ecriture
  const balance = await sql`
    select "EcritureNum",
           sum(replace("Debit", ',', '.')::numeric) as total_debit,
           sum(replace("Credit", ',', '.')::numeric) as total_credit
    from public.v_fec_entries
    group by "EcritureNum"
    having sum(replace("Debit", ',', '.')::numeric) <> sum(replace("Credit", ',', '.')::numeric)
  `;
  if (balance.length === 0) {
    console.log('\n✓ All ecritures balanced (Debit = Credit)');
  } else {
    console.log('\n✗ UNBALANCED ecritures:', balance);
  }
} finally { await sql.end(); }
