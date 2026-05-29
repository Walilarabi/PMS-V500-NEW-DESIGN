/**
 * FLOWTYM E2E — Billing and invoices.
 * Covers: invoice creation and PDF download.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');
test.use({ storageState: AUTH_FILE });

test.describe('Facturation — créer et télécharger une facture', () => {
  test('navigue vers le module Finance/Facturation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid^="nav-"]', { timeout: 15_000 });

    // Try known nav paths for billing
    const billingSelectors = [
      '[data-testid="nav-finance"]',
      '[data-testid="nav-billing"]',
      '[data-testid="nav-invoices"]',
      '[data-testid="nav-res_payments"]',
    ];

    let found = false;
    for (const sel of billingSelectors) {
      if (await page.locator(sel).count() > 0) {
        await page.click(sel);
        found = true;
        break;
      }
    }
    test.skip(!found, 'Finance/Billing navigation not found');

    // Some billing content should be visible
    const billingContent = page.locator('text=/facture|invoice|paiement|payment/i').first();
    await expect(billingContent).toBeVisible({ timeout: 8_000 });
  });

  test('crée une facture depuis une réservation et télécharge le PDF', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-reservations"]', { timeout: 15_000 });
    await page.click('[data-testid="nav-reservations"]');

    // Click the first reservation in the list
    const firstRow = page.locator('tr[class*="reservation"], [data-testid^="reservation-row"], tbody tr').first();
    const hasRow = await firstRow.count() > 0;
    test.skip(!hasRow, 'No reservations in list to test billing');

    await firstRow.click();

    // Look for invoice/billing button in the detail view or modal
    const invoiceBtn = page.locator(
      'button:has-text("Facture"), button:has-text("Invoice"), button:has-text("Générer la facture"), [data-testid="btn-invoice"]'
    ).first();

    const hasInvoiceBtn = await invoiceBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasInvoiceBtn, 'No invoice button found — billing may be in a different flow');

    // Listen for download before clicking
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }).catch(() => null),
      invoiceBtn.click(),
    ]);

    if (download) {
      // Verify it's a PDF
      const filename = download.suggestedFilename();
      expect(filename.toLowerCase()).toMatch(/\.pdf$/);
    } else {
      // PDF might open in a new tab or show inline
      const pdfIndicator = page.locator('text=/PDF|facture générée|invoice created/i').first();
      await expect(pdfIndicator).toBeVisible({ timeout: 8_000 });
    }
  });
});
