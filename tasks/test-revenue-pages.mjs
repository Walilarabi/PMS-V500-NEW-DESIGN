import puppeteer from 'puppeteer';

const BASE = process.env.URL || 'http://localhost:3000';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errors = [];
const warnings = [];
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error') errors.push(msg.text().slice(0, 200));
  if (t === 'warning') warnings.push(msg.text().slice(0, 200));
});
page.on('pageerror', (e) => errors.push(`[FATAL] ${e.message.slice(0, 200)}`));

async function go(path, name) {
  console.log(`\n=== ${name} (${path}) ===`);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 15_000 });
  await new Promise((r) => setTimeout(r, 1500));
  const titleText = await page.evaluate(() => document.title);
  const visibleText = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log(`Title: ${titleText}`);
  console.log(`Visible text: ${visibleText.replace(/\n/g, ' | ')}`);
  await page.screenshot({ path: `/tmp/${name}.png`, fullPage: false });
  console.log(`Screenshot: /tmp/${name}.png`);
}

async function click(selector, name) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `/tmp/${name}.png` });
    console.log(`Clicked ${selector} → ${name}.png`);
  } catch (e) {
    console.log(`❌ click ${selector}: ${e.message.slice(0, 80)}`);
  }
}

// ─── 1. Home
await go('/', '01-home');

// ─── 2. Cherche le module Revenue dans le sidebar
console.log('\n=== Navigation Revenue ===');
const sidebarRev = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('button, a'));
  return links
    .map((l, i) => ({ idx: i, text: (l.textContent || '').trim().slice(0, 50), tag: l.tagName }))
    .filter((l) => /revenue|automatisation|alert|calendrier|pricing|veille|marché/i.test(l.text))
    .slice(0, 20);
});
console.log('Liens Revenue détectés :');
sidebarRev.forEach((l) => console.log(`  [${l.idx}] <${l.tag}> ${l.text}`));

// ─── 3. Clic sur "REVENUE" topbar (si présent)
const revenueBtn = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button, [role="button"], a, [class*="nav"]'));
  const match = btns.find((b) => (b.textContent || '').toUpperCase().includes('REVENUE'));
  if (match) {
    match.scrollIntoView();
    return { found: true, text: match.textContent };
  }
  return { found: false };
});
console.log(`Bouton REVENUE: ${JSON.stringify(revenueBtn)}`);

if (revenueBtn.found) {
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, [role="button"], a'));
    const match = btns.find((b) => (b.textContent || '').toUpperCase().includes('REVENUE'));
    if (match) match.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: '/tmp/02-revenue.png' });
  console.log('→ /tmp/02-revenue.png');
}

// ─── 4. Vérifie présence "Règles tactiques" / "Automatisation"
const automationVisible = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    hasReglesTactiques: text.includes('Règles tactiques'),
    hasAutomatisation: text.includes('Automatisation'),
    hasAlertes: text.includes('Alertes'),
    hasCalendrier: text.includes('Calendrier tarifaire'),
  };
});
console.log('Sidebar Revenue:', JSON.stringify(automationVisible));

console.log('\n=== ERREURS CONSOLE (top 10) ===');
errors.slice(0, 10).forEach((e) => console.log(`✗ ${e}`));
console.log(`\nTotal: ${errors.length} erreurs, ${warnings.length} warnings`);

await browser.close();
