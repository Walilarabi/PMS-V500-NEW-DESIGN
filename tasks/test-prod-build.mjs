import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(`[FATAL] ${e.message.slice(0, 250)}`));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT') && !m.text().includes('RESOLVED')) errs.push(`[err] ${m.text().slice(0, 250)}`); });

await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:4173', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Distribution & OTA')?.click());
await new Promise((r) => setTimeout(r, 5000));

const visible = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 700),
  hasError: /Cannot assign|Une erreur est survenue|Maximum update/.test(document.body.innerText),
}));
console.log('hasError:', visible.hasError);
console.log('Text:', visible.text.replace(/\n/g, ' | ').slice(0, 500));
console.log('\n=== Errors (first 5) ===');
errs.slice(0, 5).forEach((e) => console.log(e));
await page.screenshot({ path: '/tmp/prod-distribution.png', fullPage: false });
await browser.close();
