/**
 * FLOWTYM E2E — Auth setup.
 * Logs in once and saves auth state to be reused across tests.
 * Requires FLOWTYM_E2E_EMAIL and FLOWTYM_E2E_PASSWORD env vars.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

export const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.FLOWTYM_E2E_EMAIL ?? '';
  const password = process.env.FLOWTYM_E2E_PASSWORD ?? '';

  if (!email || !password) {
    throw new Error(
      'Missing FLOWTYM_E2E_EMAIL / FLOWTYM_E2E_PASSWORD env vars. ' +
      'Set them before running E2E tests.',
    );
  }

  await page.goto('/');
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 10_000 });

  await page.fill('[data-testid="login-email"]', email);
  await page.fill('[data-testid="login-password"]', password);
  await page.click('[data-testid="login-submit"]');

  // Wait for app to load (auth-loading disappears → main app renders)
  await expect(page.locator('[data-testid="auth-loading"]')).toBeHidden({ timeout: 15_000 });
  // Verify we are past the login page
  await expect(page.locator('[data-testid="login-submit"]')).toBeHidden({ timeout: 5_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
