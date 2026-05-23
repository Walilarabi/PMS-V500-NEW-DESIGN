import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => { window.__BYPASS_AUTH__ = true; });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim().toUpperCase() === 'REVENUE')?.click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).find((e) => (e.textContent || '').trim() === 'Marché & Concurrence')?.click());
await new Promise((r) => setTimeout(r, 3000));

// Cherche les barres recharts
const bars = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.recharts-bar-rectangle')).map((b, i) => {
    const r = b.getBoundingClientRect();
    return { i, x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height };
  });
});
console.log(`${bars.length} barres recharts trouvées`);
if (bars.length > 0) console.log('Sample:', JSON.stringify(bars[3] || bars[0]));

// Click la 3e barre
if (bars[3]) {
  await page.mouse.move(bars[3].x, bars[3].y);
  await new Promise((r) => setTimeout(r, 300));
  await page.mouse.click(bars[3].x, bars[3].y);
  await new Promise((r) => setTimeout(r, 1000));

  const overlayInfo = await page.evaluate(() => {
    const overlays = document.querySelectorAll('.fixed');
    return Array.from(overlays).map((o) => ({
      classes: o.className.slice(0, 100),
      text: (o.textContent || '').slice(0, 300),
    }));
  });
  console.log('\nOverlays détectés:', overlayInfo.length);
  overlayInfo.forEach((o, i) => {
    if (o.text.length > 20) {
      console.log(`Overlay ${i}:`, o.text.replace(/\s+/g, ' ').slice(0, 250));
    }
  });
  await page.screenshot({ path: '/tmp/test-modal-click.png', fullPage: true });
  console.log('Screenshot: /tmp/test-modal-click.png');
}
await browser.close();
