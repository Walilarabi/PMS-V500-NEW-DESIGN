import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Automatisation')?.click());
await new Promise((r) => setTimeout(r, 3000));

const sidebarText = await page.evaluate(() => {
  const aside = document.querySelectorAll('aside');
  return Array.from(aside).map((a) => (a.textContent || '').slice(0, 400));
});
console.log('Asides trouvés:', sidebarText.length);
sidebarText.forEach((t, i) => console.log(`Aside ${i}:`, t.replace(/\s+/g, ' ').slice(0, 350)));

await page.screenshot({ path: '/tmp/test-rules-enterprise-full.png', fullPage: true });
console.log('Screenshot complet sauvé');
await browser.close();
