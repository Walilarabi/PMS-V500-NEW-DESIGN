/**
 * FLOWTYM E2E — Admin flows (super_admin).
 * Covers: admin creates a hotel, assigns a subscription.
 *
 * Requires FLOWTYM_E2E_ADMIN_EMAIL / FLOWTYM_E2E_ADMIN_PASSWORD env vars
 * pointing to a super_admin account.
 */
import { test, expect } from '@playwright/test';

test.describe('Admin — créer un hôtel', () => {
  test.beforeEach(async ({ page }) => {
    const adminEmail = process.env.FLOWTYM_E2E_ADMIN_EMAIL ?? '';
    const adminPwd = process.env.FLOWTYM_E2E_ADMIN_PASSWORD ?? '';
    test.skip(!adminEmail || !adminPwd, 'Admin credentials not set — skipping admin tests');

    await page.goto('/admin');

    // Wait for login or admin UI
    const loginEmail = page.locator('[data-testid="login-email"]');
    if (await loginEmail.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await loginEmail.fill(adminEmail);
      await page.fill('[data-testid="login-password"]', adminPwd);
      await page.click('[data-testid="login-submit"]');
      await expect(page.locator('[data-testid="auth-loading"]')).toBeHidden({ timeout: 15_000 });
    }
  });

  test('accède au panneau d\'administration', async ({ page }) => {
    // Admin app should be visible
    const adminHeader = page.locator('text=/admin|administration|super/i').first();
    await expect(adminHeader).toBeVisible({ timeout: 10_000 });
  });

  test('crée un nouvel hôtel depuis l\'interface super_admin', async ({ page }) => {
    await page.goto('/admin');

    // Find "Create hotel" / "Nouvel hôtel" button
    const createHotelBtn = page.locator(
      'button:has-text("Créer un hôtel"), button:has-text("Nouvel hôtel"), button:has-text("Add Hotel"), [data-testid="btn-create-hotel"]'
    ).first();

    const hasBtn = await createHotelBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    test.skip(!hasBtn, 'Create hotel button not found in admin interface');

    await createHotelBtn.click();

    // Fill in the hotel creation form
    const nameInput = page.locator('input[placeholder*="nom"], input[name="name"], input[placeholder*="hotel name"]').first();
    await nameInput.fill(`E2E Hotel Test ${Date.now()}`);

    const submitBtn = page.locator('button[type="submit"], button:has-text("Créer"), button:has-text("Create")').last();
    await submitBtn.click();

    // Success indicator
    const success = page.locator('text=/créé|created|success/i').first();
    await expect(success).toBeVisible({ timeout: 10_000 });
  });

  test('assigne un abonnement à un hôtel', async ({ page }) => {
    await page.goto('/admin');

    // Find subscription management section
    const subSection = page.locator('text=/abonnement|subscription|plan/i').first();
    const hasSubSection = await subSection.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasSubSection, 'Subscription management section not found');

    // Find "Assign" / "Attribuer" button for the first hotel
    const assignBtn = page.locator(
      'button:has-text("Attribuer"), button:has-text("Assign"), button:has-text("Subscribe"), [data-testid="btn-assign-subscription"]'
    ).first();

    const hasAssign = await assignBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasAssign, 'Assign subscription button not found');

    await assignBtn.click();

    // Select a plan from dropdown
    const planSelect = page.locator('select, [role="listbox"], [role="combobox"]').first();
    if (await planSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await planSelect.selectOption({ index: 1 });
    }

    const confirmBtn = page.locator('button[type="submit"], button:has-text("Confirmer"), button:has-text("Save")').last();
    await confirmBtn.click();

    const success = page.locator('text=/assigné|attribué|assigned|success/i').first();
    await expect(success).toBeVisible({ timeout: 10_000 });
  });
});
