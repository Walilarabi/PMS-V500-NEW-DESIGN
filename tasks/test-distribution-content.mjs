import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Distribution & OTA')?.click());
await new Promise((r) => setTimeout(r, 4000));

const visible = await page.evaluate(() => ({
  text: document.body.innerText.slice(0, 2000),
  hasMix: document.body.innerText.includes('Mix distribution'),
  hasTopChannels: document.body.innerText.includes('Booking.com'),
  hasAlerts: document.body.innerText.includes('alerte') || document.body.innerText.includes('Alerte'),
  hasError: /Cannot assign|Une erreur est survenue/.test(document.body.innerText),
}));
console.log('hasError:', visible.hasError);
console.log('hasMix:', visible.hasMix);
console.log('hasTopChannels:', visible.hasTopChannels);
console.log('hasAlerts:', visible.hasAlerts);
console.log('\nExtrait:', visible.text.replace(/\n/g, ' | ').slice(0, 800));
await browser.close();
