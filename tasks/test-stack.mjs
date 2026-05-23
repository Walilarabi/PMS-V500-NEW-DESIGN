import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push({ msg: e.message, stack: e.stack || '' }));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('RESOLVED')) errs.push({ msg: m.text(), stack: '' }); });

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Distribution & OTA')?.click());
await new Promise((r) => setTimeout(r, 4000));

console.log('\n=== STACK TRACES ===');
errs.slice(0, 8).forEach((e, i) => {
  console.log(`\n--- ${i+1} ---`);
  console.log(e.msg.slice(0, 250));
  if (e.stack) {
    console.log(e.stack.split('\n').slice(0, 25).join('\n'));
  }
});
await browser.close();
