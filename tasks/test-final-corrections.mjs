import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errs = [];
page.on('pageerror', (e) => errs.push(`[FATAL] ${e.message.slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('RESOLVED')) errs.push(`[err] ${m.text().slice(0, 200)}`); });

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));

console.log('═══ #3 Règles tactiques — retour ancien layout ═══');
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Automatisation')?.click());
await new Promise((r) => setTimeout(r, 2500));
const auto = await page.evaluate(() => ({
  hasTabs: document.body.innerText.includes('Règles Automatiques') && document.body.innerText.includes('Garde-fous RMS') && document.body.innerText.includes('Priorités & Conflits'),
  hasSidebar: !!document.querySelector('aside h4')?.textContent?.includes('Catégories'),
  hasError: /Une erreur est survenue/.test(document.body.innerText),
  text: document.body.innerText.slice(0, 400),
}));
console.log('hasError:', auto.hasError);
console.log('hasTabs (3 onglets visibles):', auto.hasTabs);
console.log('hasSidebar (enterprise removed):', auto.hasSidebar, '← false attendu');
console.log('Extrait:', auto.text.replace(/\n/g, ' | ').slice(0, 300));
await page.screenshot({ path: '/tmp/test-rules-restored.png' });
console.log('→ /tmp/test-rules-restored.png\n');

console.log('═══ #1 + #2 Veille — tooltip clair + modale clic ═══');
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Marché & Concurrence')?.click());
await new Promise((r) => setTimeout(r, 2500));

// Survol d'une barre
const bars = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('.recharts-bar-rectangle, .recharts-rectangle'));
  return all.slice(0, 5).map((b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  });
});
console.log('Barres détectées:', bars.length);
if (bars.length > 1) {
  await page.mouse.move(bars[2].x, bars[2].y);
  await new Promise((r) => setTimeout(r, 600));
  const tt = await page.evaluate(() => {
    const w = document.querySelector('.recharts-tooltip-wrapper');
    if (!w) return null;
    const div = w.querySelector('div');
    return {
      classes: div?.className ?? '',
      bg: div ? getComputedStyle(div).backgroundColor : '',
      text: (w.textContent || '').slice(0, 250),
    };
  });
  console.log('Tooltip hover:');
  console.log('  classes:', tt?.classes.slice(0, 80));
  console.log('  bg-color:', tt?.bg);
  console.log('  contenu:', tt?.text?.replace(/\s+/g, ' '));
  await page.screenshot({ path: '/tmp/test-veille-tooltip.png' });

  // Clic sur une barre → modale
  await page.mouse.click(bars[2].x, bars[2].y);
  await new Promise((r) => setTimeout(r, 800));
  const modal = await page.evaluate(() => {
    const overlay = document.querySelector('.fixed.inset-0');
    if (!overlay) return null;
    return {
      visible: true,
      text: (overlay.textContent || '').slice(0, 400),
      hasCompset: (overlay.textContent || '').includes('Compset analysé'),
      hasRecommandation: (overlay.textContent || '').includes('Tarif recommandé'),
      has3Actions: (overlay.textContent || '').includes('Accepter') &&
                   (overlay.textContent || '').includes('Refuser') &&
                   (overlay.textContent || '').includes('Maintenir'),
    };
  });
  console.log('\nModale au clic:');
  console.log('  visible:', !!modal);
  if (modal) {
    console.log('  hasCompset:', modal.hasCompset);
    console.log('  hasRecommandation:', modal.hasRecommandation);
    console.log('  has3Actions:', modal.has3Actions);
    console.log('  extrait:', modal.text.replace(/\s+/g, ' ').slice(0, 280));
  }
  await page.screenshot({ path: '/tmp/test-veille-modal.png' });
}

console.log('\n=== Erreurs ===');
errs.slice(0, 8).forEach((e) => console.log(e));
console.log('Total:', errs.length);
await browser.close();
