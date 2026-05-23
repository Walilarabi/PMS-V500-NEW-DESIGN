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

console.log('═══ TEST #3 Règles tactiques layout Enterprise ═══');
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Automatisation')?.click());
await new Promise((r) => setTimeout(r, 3500));
const automation = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 1200),
  hasError: /Une erreur est survenue/.test(document.body.innerText),
  hasSidebar: document.body.innerText.includes('Catégories') && document.body.innerText.includes('Templates'),
  hasHeader: document.body.innerText.includes('Moteur RMS Enterprise'),
  hasRightPanel: document.body.innerText.includes('Détail règle') || document.body.innerText.includes('Sélectionnez une règle'),
}));
console.log('hasError:', automation.hasError);
console.log('hasSidebar (Catégories + Templates):', automation.hasSidebar);
console.log('hasHeader (Moteur Enterprise):', automation.hasHeader);
console.log('hasRightPanel (panneau droit):', automation.hasRightPanel);
console.log('Extrait:', automation.text.replace(/\n/g, ' | ').slice(0, 700));
await page.screenshot({ path: '/tmp/test-reserve-3-rules.png', fullPage: false });
console.log('→ /tmp/test-reserve-3-rules.png\n');

console.log('═══ TEST #2 Veille — tooltip + panel ═══');
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Marché & Concurrence')?.click());
await new Promise((r) => setTimeout(r, 3000));
const veille = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 600),
  hasError: /Une erreur est survenue/.test(document.body.innerText),
}));
console.log('hasError:', veille.hasError);
console.log('Extrait:', veille.text.replace(/\n/g, ' | ').slice(0, 500));

// Survol d'une barre du graphique pour vérifier la tooltip
const barRects = await page.evaluate(() => {
  const bars = Array.from(document.querySelectorAll('.recharts-bar-rectangle, .recharts-rectangle'));
  return bars.slice(0, 3).map((b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
  });
});
console.log('Barres trouvées:', barRects.length);
if (barRects.length > 0) {
  await page.mouse.move(barRects[1].x, barRects[1].y);
  await new Promise((r) => setTimeout(r, 800));
  const tooltipVisible = await page.evaluate(() => {
    // Cherche notre tooltip personnalisée
    const tt = document.querySelector('.recharts-tooltip-wrapper');
    return tt ? (tt.textContent || '').slice(0, 400) : null;
  });
  console.log('Tooltip au hover:', tooltipVisible?.slice(0, 250) ?? 'aucune');
  await page.screenshot({ path: '/tmp/test-reserve-2-veille-hover.png' });
}

console.log('\n=== ERREURS ===');
errs.slice(0, 10).forEach((e) => console.log(e));
console.log(`Total: ${errs.length}`);
await browser.close();
