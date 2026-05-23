import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3000';
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const logs = [];
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error' || t === 'warning') logs.push(`[${t}] ${msg.text().slice(0, 250)}`);
});
page.on('pageerror', (e) => logs.push(`[FATAL] ${e.message.slice(0, 250)}`));

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 15000 });
await new Promise((r) => setTimeout(r, 2000));

console.log('Step 1: clic sur REVENUE');
await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('button, a'));
  const t = els.find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE');
  if (t) t.click();
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: '/tmp/step1-revenue.png' });

const sidebar = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button, a'))
    .map((b) => (b.textContent || '').trim())
    .filter((t) => t && t.length < 60 && t.length > 2)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 30);
});
console.log('Sidebar:', sidebar);

console.log('\nStep 2: clic sur Calendrier tarifaire');
const found = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('button, a'));
  const t = els.find((e) => (e.textContent || '').trim() === 'Calendrier tarifaire');
  if (t) { t.click(); return true; }
  return false;
});
console.log('Calendrier cliqué:', found);

if (found) {
  await new Promise((r) => setTimeout(r, 3000));
  console.log('\n⏳ Attente 15s pour observer…');
  await new Promise((r) => setTimeout(r, 15000));
  const after = await page.evaluate(() => ({
    text: document.body.innerText.slice(0, 800),
    hasSpinner: !!document.querySelector('[class*="animate-spin"]'),
    hasError: document.body.innerText.includes('Impossible de charger'),
    hasEmpty: document.body.innerText.includes('Aucun type de chambre'),
    hasGrid: !!document.querySelector('table'),
  }));
  console.log('\nÉtat après 15s:');
  console.log('  Spinner:', after.hasSpinner);
  console.log('  Fallback erreur:', after.hasError);
  console.log('  Empty state:', after.hasEmpty);
  console.log('  Grid:', after.hasGrid);
  console.log('  Texte:', after.text.replace(/\n/g, ' | ').slice(0, 400));
  await page.screenshot({ path: '/tmp/step3-calendar.png', fullPage: false });
}

console.log('\n=== LOGS CONSOLE ===');
logs.slice(0, 30).forEach((l) => console.log(l));
console.log(`Total: ${logs.length}`);

await browser.close();
