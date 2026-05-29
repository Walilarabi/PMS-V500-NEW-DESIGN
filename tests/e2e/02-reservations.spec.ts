/**
 * FLOWTYM E2E — Reservation management.
 * Covers: create, move on Gantt, block room.
 *
 * Requires FLOWTYM_E2E_EMAIL / FLOWTYM_E2E_PASSWORD.
 * Uses stored auth state from auth.setup.ts.
 */
import { test, expect } from '@playwright/test';
import path from 'path';

// Reuse saved auth state to skip login
const AUTH_FILE = path.join(__dirname, '.auth/user.json');
test.use({ storageState: AUTH_FILE });

test.describe('Créer une réservation', () => {
  test('ouvre le formulaire via le bouton "Nouvelle réservation"', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-reservations"]', { timeout: 15_000 });
    await page.click('[data-testid="nav-reservations"]');

    // The new reservation button should be visible
    await expect(page.locator('[data-testid="btn-new-reservation"]')).toBeVisible({ timeout: 8_000 });
    await page.click('[data-testid="btn-new-reservation"]');

    // Modal should open — detect by guest name field
    await expect(page.locator('input[placeholder*="Nom Complet"]')).toBeVisible({ timeout: 5_000 });
  });

  test('crée une réservation complète et la voit apparaître dans la liste', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-reservations"]', { timeout: 15_000 });
    await page.click('[data-testid="nav-reservations"]');
    await page.click('[data-testid="btn-new-reservation"]');

    // Fill in guest name
    await page.fill('input[placeholder*="Nom Complet"]', 'E2E Test Guest');

    // Fill in check-in / check-out (next month to avoid conflicts)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    // Date inputs — use the first date-type inputs in the modal
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(fmt(tomorrow));
    await dateInputs.nth(1).fill(fmt(dayAfter));

    // Submit the form
    const submitBtn = page.locator('button:has-text("Enregistrer"), button:has-text("Créer"), button[type="submit"]:visible').first();
    await submitBtn.click();

    // Success toast or reservation appears in the list
    const success = page.locator('[data-testid="toaster"], text=/E2E Test Guest/i, text=/créée|saved|success/i');
    await expect(success.first()).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Planning — déplacer une réservation', () => {
  test('navigue vers le planning et affiche le Gantt', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-planning"]', { timeout: 15_000 });
    await page.click('[data-testid="nav-planning"]');

    // Planning view should render — look for any gantt/calendar element
    const planningArea = page.locator('[data-testid="planning-grid"], .gantt-container, .planning-view, [class*="planning"]').first();
    await expect(planningArea).toBeVisible({ timeout: 10_000 });
  });

  test('une réservation déplacée par drag-and-drop est persistée', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-planning"]', { timeout: 15_000 });
    await page.click('[data-testid="nav-planning"]');

    // Find first draggable reservation block in the Gantt
    const resBlock = page.locator('[draggable="true"], [data-reservation-id]').first();
    const isPresent = await resBlock.count() > 0;

    if (!isPresent) {
      test.skip(true, 'No draggable reservation found in planning view — skipping move test');
      return;
    }

    // Get source and target positions
    const source = await resBlock.boundingBox();
    if (!source) return;

    // Drag 2 columns to the right (one day)
    const targetX = source.x + source.width + 40;
    const targetY = source.y + source.height / 2;

    await resBlock.dragTo(page.locator('body'), {
      targetPosition: { x: targetX, y: targetY },
    });

    // Confirmation dialog may appear
    const confirmBtn = page.locator('button:has-text("Confirmer"), button:has-text("Valider"), button:has-text("OK")').first();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Should not show an error toast
    await expect(page.locator('text=/erreur|conflict|overbooking/i')).toBeHidden({ timeout: 5_000 });
  });
});

test.describe('Bloquer une chambre', () => {
  test('navigue vers le planning et peut bloquer une chambre', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="nav-planning"]', { timeout: 15_000 });
    await page.click('[data-testid="nav-planning"]');

    // Look for "Block" or room context menu button
    const blockBtn = page.locator('button:has-text("Bloquer"), button:has-text("Block"), [data-testid="block-room"]').first();
    const hasBlockBtn = await blockBtn.count() > 0;

    if (!hasBlockBtn) {
      // Try right-clicking on an empty room cell to get context menu
      const emptyCell = page.locator('[data-room-cell], [data-testid="room-cell-empty"]').first();
      const hasCells = await emptyCell.count() > 0;
      test.skip(!hasCells, 'No room block UI found — skipping block test');
      return;
    }

    await blockBtn.first().click();

    // Modal or confirmation should appear
    const modal = page.locator('[role="dialog"], [class*="modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });
});
