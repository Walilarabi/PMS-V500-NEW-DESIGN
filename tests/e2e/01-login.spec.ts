/**
 * FLOWTYM E2E — Login flow.
 * Runs without stored auth so it exercises the full login UX.
 */
import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test('affiche la page de connexion pour un utilisateur non-authentifié', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('rejette des identifiants invalides et affiche une erreur', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="login-email"]', 'invalid@nowhere.invalid');
    await page.fill('[data-testid="login-password"]', 'wrongpassword');
    await page.click('[data-testid="login-submit"]');

    // Should show an error message — any element containing error-related text
    const errorMsg = page.locator('text=/erreur|incorrect|invalide|incorrect|failed/i');
    await expect(errorMsg).toBeVisible({ timeout: 8_000 });
  });

  test('connecte un utilisateur valide et affiche le tableau de bord', async ({ page }) => {
    const email = process.env.FLOWTYM_E2E_EMAIL ?? '';
    const password = process.env.FLOWTYM_E2E_PASSWORD ?? '';
    test.skip(!email || !password, 'FLOWTYM_E2E_EMAIL / FLOWTYM_E2E_PASSWORD not set');

    await page.goto('/');
    await page.fill('[data-testid="login-email"]', email);
    await page.fill('[data-testid="login-password"]', password);
    await page.click('[data-testid="login-submit"]');

    // Auth loading spinner disappears
    await expect(page.locator('[data-testid="auth-loading"]')).toBeHidden({ timeout: 15_000 });
    // Login form is gone
    await expect(page.locator('[data-testid="login-submit"]')).toBeHidden();
    // App navigation is visible
    await expect(page.locator('[data-testid="nav-planning"]')).toBeVisible({ timeout: 10_000 });
  });
});
