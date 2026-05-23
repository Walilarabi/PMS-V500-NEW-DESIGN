import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
const errs = [];
page.on('console', async (m) => {
  if (m.type() === 'error' && (m.text().includes('Maximum') || m.text().includes('ErrorBoundary'))) {
    const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '<unstr>')));
    errs.push({ text: m.text(), args });
  }
});

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Distribution & OTA')?.click());
await new Promise((r) => setTimeout(r, 4000));

for (const e of errs.slice(0, 2)) {
  console.log('\n--- text ---');
  console.log(e.text.slice(0, 200));
  console.log('--- args ---');
  for (const a of e.args) {
    const s = typeof a === 'string' ? a : JSON.stringify(a, null, 2);
    console.log(s.slice(0, 2000));
    console.log('-----');
  }
}
await browser.close();
