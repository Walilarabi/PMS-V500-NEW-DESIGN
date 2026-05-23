import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errs = [];
page.on('pageerror', (e) => errs.push({ msg: e.message, stack: e.stack }));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('CERT')) {
    errs.push({ msg: m.text(), stack: '' });
  }
});

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE');
  if (t) t.click();
});
await new Promise((r) => setTimeout(r, 1000));
const clicked = await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Distribution & OTA');
  if (t) { t.click(); return true; }
  return false;
});
console.log('Distribution & OTA cliqué:', clicked);
await new Promise((r) => setTimeout(r, 4000));

const visible = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 600),
  hasError: /Cannot assign|Une erreur est survenue/.test(document.body.innerText),
}));
console.log('hasError:', visible.hasError);
console.log('text:', visible.text.replace(/\n/g, ' | ').slice(0, 300));
await page.screenshot({ path: '/tmp/distribution-ota.png', fullPage: true });

console.log('\n=== ERREURS ===');
errs.slice(0, 5).forEach((e, i) => {
  console.log(`\n--- Erreur ${i+1} ---`);
  console.log(e.msg.slice(0, 400));
  if (e.stack) {
    console.log('Stack:');
    console.log(e.stack.split('\n').slice(0, 10).join('\n'));
  }
});

await browser.close();
