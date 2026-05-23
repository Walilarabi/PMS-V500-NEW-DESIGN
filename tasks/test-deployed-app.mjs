/**
 * Test la page Revenue Automatisation déployée sur Vercel
 * Capture l'écran + les erreurs console + lance les fixes des 9 réserves.
 */
import puppeteer from 'puppeteer';

const BASE_URL = process.env.URL ||
  'https://pms-v500-new-design-git-claude-c-d1c9f7-walis-projects-e22749ce.vercel.app';

async function main() {
  console.log(`▶ Test de ${BASE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
    ],
    ignoreHTTPSErrors: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleErrors.push(`[${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });

  console.log('1️⃣  Chargement page d\'accueil...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30_000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: '/tmp/01-home.png', fullPage: false });
  console.log('   → /tmp/01-home.png');

  // Cherche l'iframe Vercel SSO si présent (auth requis pour SAML org)
  const hasAuthGate = await page.evaluate(() =>
    !!document.querySelector('input[type="email"]') ||
    document.title.toLowerCase().includes('vercel') ||
    document.title.toLowerCase().includes('login')
  );
  if (hasAuthGate) {
    console.log('⚠️  Auth gate détecté — l\'URL n\'est pas accessible sans login Vercel.');
    console.log('   (C\'est probablement pourquoi le user voit "toujours pareil")');
    const title = await page.title();
    console.log(`   Title de la page: ${title}`);
    await browser.close();
    return;
  }

  // Navigation : module Revenue → Automatisation
  console.log('\n2️⃣  Clic sur le module Revenue...');
  // Le sidebar a normalement le label "Revenue" — on attend qu'il apparaisse
  try {
    await page.waitForSelector('body', { timeout: 5000 });
    const html = await page.content();
    console.log(`   HTML length: ${html.length} bytes`);
    console.log(`   Has "Revenue" text: ${html.includes('Revenue')}`);
    console.log(`   Has "Automatisation" text: ${html.includes('Automatisation')}`);
    console.log(`   Has "Règles tactiques" text: ${html.includes('Règles tactiques')}`);
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
  }

  console.log('\n=== ERREURS CONSOLE ===');
  if (consoleErrors.length === 0) console.log('Aucune erreur 🎉');
  else consoleErrors.slice(0, 30).forEach((e) => console.log(e));

  await browser.close();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
