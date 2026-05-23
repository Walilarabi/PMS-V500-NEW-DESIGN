import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 2200 }); // tall viewport pour voir le chart sans scroll

const errs = [];
page.on('pageerror', (e) => errs.push(`[FATAL] ${e.message.slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('RESOLVED')) errs.push(`[err] ${m.text().slice(0, 200)}`); });

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Marché & Concurrence')?.click());
await new Promise((r) => setTimeout(r, 3500));

// Recherche les barres recharts
const bars = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('.recharts-bar-rectangle'));
  return all.map((b, i) => {
    const r = b.getBoundingClientRect();
    return { i, x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height, visible: r.top < window.innerHeight && r.bottom > 0 };
  });
});
console.log(`${bars.length} barres trouvées, ${bars.filter(b => b.visible).length} visibles dans le viewport`);

// Trouve une barre visible
const target = bars.find((b) => b.visible && b.w > 0 && b.h > 0);
if (!target) { console.log('AUCUNE barre visible'); await browser.close(); process.exit(1); }
console.log('Cible:', JSON.stringify(target));

// Clic sur la barre
await page.mouse.click(target.x, target.y);
await new Promise((r) => setTimeout(r, 800));

const modalInfo = await page.evaluate(() => {
  // Cherche n'importe quel overlay fixed avec contenu
  const fixedEls = Array.from(document.querySelectorAll('.fixed'));
  const overlay = fixedEls.find((el) => {
    const txt = (el.textContent || '');
    return txt.includes('Décision RM') || txt.includes('Compset analysé') || txt.includes('Tarif recommandé');
  });
  if (!overlay) return { found: false, fixedCount: fixedEls.length };
  return {
    found: true,
    text: (overlay.textContent || '').replace(/\s+/g, ' ').slice(0, 400),
    has3actions: ['Accepter','Refuser','Maintenir'].every((a) => (overlay.textContent || '').includes(a)),
    hasCompset: (overlay.textContent || '').includes('Compset analysé'),
  };
});
console.log('\n=== MODALE AU CLIC ===');
console.log('Trouvée:', modalInfo.found);
if (modalInfo.found) {
  console.log('Has 3 actions:', modalInfo.has3actions);
  console.log('Has compset:', modalInfo.hasCompset);
  console.log('Texte extrait:', modalInfo.text.slice(0, 300));
}
await page.screenshot({ path: '/tmp/test-modal-open.png', fullPage: false });

console.log('\nErreurs console:', errs.length);
errs.slice(0, 3).forEach((e) => console.log(e));
await browser.close();
