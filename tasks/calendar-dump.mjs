import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(`[err] ${m.text()}`); });

await p.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE');
  if (t) t.click();
});
await new Promise((r) => setTimeout(r, 1000));
await p.evaluate(() => {
  const t = Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Calendrier tarifaire');
  if (t) t.click();
});
await new Promise((r) => setTimeout(r, 18000));

const mainArea = await p.evaluate(() => {
  const main = document.querySelector('main, [class*="flex-1"]:not(aside):not(nav)');
  return {
    html: main ? main.outerHTML.slice(0, 1500) : 'no main found',
    bodyText: document.body.innerText.slice(0, 1500),
  };
});

console.log('=== Main area HTML ===');
console.log(mainArea.html);
console.log('\n=== Body text ===');
console.log(mainArea.bodyText);
console.log('\n=== Errors ===');
errs.slice(0, 15).forEach((e) => console.log(e.slice(0, 200)));

await p.screenshot({ path: '/tmp/calendar-dump.png', fullPage: true });
console.log('\n→ /tmp/calendar-dump.png');
await b.close();
