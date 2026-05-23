import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errs = [];
page.on('pageerror', (e) => errs.push(`[FATAL] ${e.message.slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errs.push(`[err] ${m.text().slice(0, 200)}`); });

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE');
  if (t) t.click();
});
await new Promise((r) => setTimeout(r, 1000));

async function gotoAndCheck(label, name, expectedTexts = []) {
  console.log(`\n══════ ${label} ══════`);
  const before = errs.length;
  const clicked = await page.evaluate((lbl) => {
    // Match exact ou avec un badge collé ("Alertes4" → "Alertes")
    const els = Array.from(document.querySelectorAll('button, a'));
    const t = els.find((e) => {
      const txt = (e.textContent || '').trim();
      return txt === lbl || txt.startsWith(lbl);
    });
    if (t) { t.click(); return true; }
    return false;
  }, label);
  if (!clicked) { console.log('❌ pas cliqué'); return; }

  await new Promise((r) => setTimeout(r, 4500));
  // Trouve le contenu principal en excluant le sidebar
  const contentInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const main = document.querySelector('main') || document.querySelector('[class*="flex-1"]');
    let text = '';
    if (main) {
      text = main.innerText || main.textContent || '';
    } else {
      // Exclure le sidebar manuellement
      const all = document.body.innerText;
      const asideText = aside ? aside.innerText : '';
      text = all.replace(asideText, '');
    }
    return {
      mainTextLength: text.length,
      mainText: text.slice(0, 600),
      hasSpinner: !!document.querySelector('[class*="animate-spin"]'),
      hasMessageErr: /Une erreur est survenue|removeChild|crash/.test(document.body.innerText),
    };
  });

  console.log(`Spinner: ${contentInfo.hasSpinner} | Error msg: ${contentInfo.hasMessageErr}`);
  console.log(`Main length: ${contentInfo.mainTextLength}`);
  console.log(`Main extract: ${contentInfo.mainText.slice(0, 500).replace(/\n+/g, ' | ')}`);

  for (const expected of expectedTexts) {
    const found = contentInfo.mainText.includes(expected);
    console.log(`  ${found ? '✅' : '❌'} contient "${expected}"`);
  }

  const newErrs = errs.slice(before);
  if (newErrs.length > 0) {
    console.log(`Erreurs (${newErrs.length}):`);
    newErrs.slice(0, 3).forEach((e) => console.log('   ' + e));
  }
  await page.screenshot({ path: `/tmp/page-${name}.png` });
}

await gotoAndCheck('Calendrier tarifaire', 'calendrier', ['Calendrier tarifaire', 'Canaux de distribution']);
await gotoAndCheck('Alertes', 'alertes', ['Alertes', 'opportunité']);
await gotoAndCheck('Marché & Concurrence', 'veille', ['7 jours', 'Veille', 'Comparaison']);
await gotoAndCheck('Automatisation', 'automatisation', ['Règles tactiques', 'Garde-fous']);
await gotoAndCheck('Pricing & Recommandations', 'pricing', ['Lead time', 'Pickup', 'Recommandation']);
await gotoAndCheck('Autopilote RMS', 'autopilote', ['Autopilote', 'Forecast']);
await gotoAndCheck('Simulation', 'simulation', ['Simulation', 'scénario']);
await gotoAndCheck('Stratégies', 'strategies', ['Stratégie']);

console.log(`\n=== RÉCAP ERREURS ===\nTotal hors CERT: ${errs.length}`);
await browser.close();
