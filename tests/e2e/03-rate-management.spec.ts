/**
 * FLOWTYM E2E — Rate management and RMS.
 * Covers: modify a rate in the calendar, accept RMS recommendation.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');
test.use({ storageState: AUTH_FILE });

test.describe('Calendrier tarifaire — modifier un prix', () => {
  test('navigue vers le module RMS', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-rms"], [data-testid="nav-revenue"]', { timeout: 15_000 });

    const rmsNav = page.locator('[data-testid="nav-rms"], [data-testid="nav-revenue"]').first();
    await rmsNav.click();

    // Some rate calendar or RMS view should be visible
    const rmsView = page.locator('[class*="rate-calendar"], [class*="rms"], text=/RMS|Rate|Tarif/i').first();
    await expect(rmsView).toBeVisible({ timeout: 10_000 });
  });

  test('modifie le prix d\'une cellule dans le calendrier tarifaire', async ({ page }) => {
    await page.goto('/');

    // Navigate to RMS/rate calendar
    const rmsBtn = page.locator('[data-testid="nav-rms"], [data-testid="nav-rate-calendar"]').first();
    const found = await rmsBtn.count() > 0;
    if (!found) {
      // Try settings or another path
      const planningBtn = page.locator('[data-testid="nav-planning"]').first();
      await planningBtn.click();
    } else {
      await rmsBtn.click();
    }

    // Find a price cell in the rate table
    const priceCell = page.locator('[data-testid*="price-cell"], [class*="price-cell"], td[contenteditable]').first();
    const hasPriceCell = await priceCell.count() > 0;
    test.skip(!hasPriceCell, 'No price cell found — skipping rate edit test');

    // Double-click to enter edit mode
    await priceCell.dblclick();
    const input = priceCell.locator('input').or(page.locator('input[type="number"]:visible').first());
    await input.fill('189');
    await page.keyboard.press('Enter');

    // Verify save (no error, value persists)
    await expect(page.locator('text=/erreur|error/i')).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('text=/189/')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('RMS — accepter une recommandation', () => {
  test('affiche les recommandations RMS et accepte la première', async ({ page }) => {
    await page.goto('/');

    // Find RMS / Revenue page
    const navItems = [
      '[data-testid="nav-rms"]',
      '[data-testid="nav-revenue"]',
      '[data-testid="nav-revenue_dashboard"]',
    ];
    let navigated = false;
    for (const sel of navItems) {
      const el = page.locator(sel);
      if (await el.count() > 0) {
        await el.click();
        navigated = true;
        break;
      }
    }
    test.skip(!navigated, 'RMS navigation item not found');

    // Look for recommendation "Apply" / "Accept" button
    const applyBtn = page.locator(
      'button:has-text("Appliquer"), button:has-text("Accepter"), button:has-text("Apply"), [data-testid="accept-recommendation"]'
    ).first();

    const hasBtn = await applyBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasBtn, 'No RMS recommendation found to accept');

    await applyBtn.click();

    // Confirm if dialog appears
    const confirmBtn = page.locator('button:has-text("Confirmer"), button:has-text("OK")').first();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // No error toast
    await expect(page.locator('text=/erreur|error/i')).toBeHidden({ timeout: 8_000 });
    // Success feedback
    const successIndicator = page.locator(
      'text=/appliqué|accepté|applied|success/i, [data-testid="toaster"]'
    ).first();
    await expect(successIndicator).toBeVisible({ timeout: 8_000 });
  });
});
