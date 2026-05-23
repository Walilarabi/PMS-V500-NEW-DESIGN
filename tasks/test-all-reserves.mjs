import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errs = [];
page.on('pageerror', (e) => errs.push(`[FATAL] ${e.message.slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error') errs.push(`[err] ${m.text().slice(0, 200)}`); });

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE');
  if (t) t.click();
});
await new Promise((r) => setTimeout(r, 1000));

async function clickAndTest(label, name, waitMs = 4000) {
  console.log(`\n────── ${label} ──────`);
  const before = errs.length;
  const clicked = await page.evaluate((lbl) => {
    const t = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === lbl);
    if (t) { t.click(); return true; }
    return false;
  }, label);
  console.log(`Clic: ${clicked}`);
  if (!clicked) return;
  await new Promise((r) => setTimeout(r, waitMs));
  const state = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 600),
    hasSpinner: !!document.querySelector('[class*="animate-spin"]'),
    hasError: /Erreur|Impossible|crash|#185/.test(document.body.innerText),
  }));
  console.log(`Spinner: ${state.hasSpinner}, ErrorMsg: ${state.hasError}`);
  console.log(`Visible (extrait): ${state.text.split('\n').filter(t => t && !['F','FLOWTYM','FLOWDAY','SAS','RÉSERVATIONS','CLIENTS','REVENUE','FINANCE','ANALYSE','PARAMÈTRES','Déconnexion','PILOTAGE','AUTOMATISATION','DISTRIBUTION','CONTRÔLE'].includes(t.trim())).slice(0, 8).join(' | ')}`);
  const newErrs = errs.slice(before);
  if (newErrs.length > 0) {
    console.log(`Nouvelles erreurs (${newErrs.length}):`);
    newErrs.slice(0, 5).forEach((e) => console.log('  ' + e));
  }
  await page.screenshot({ path: `/tmp/test-${name}.png` });
}

await clickAndTest('Alertes', '02-alertes', 5000);
await clickAndTest('Calendrier tarifaire', '03-calendrier', 5000);
await clickAndTest('Marché & Concurrence', '04-veille', 5000);
await clickAndTest('Automatisation', '05-automatisation', 5000);
await clickAndTest('Pricing & Recommandations', '06-pricing', 5000);
await clickAndTest('Autopilote RMS', '07-autopilote', 5000);
await clickAndTest('Simulation', '08-simulation', 5000);
await clickAndTest('Stratégies', '09-strategies', 5000);

console.log('\n=== TOTAL ERREURS ===');
console.log(errs.length);
console.log('\n=== Échantillon ===');
errs.slice(0, 10).forEach((e) => console.log(e));
await browser.close();
