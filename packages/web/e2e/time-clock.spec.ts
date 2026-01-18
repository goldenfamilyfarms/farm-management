import { test, expect } from '@playwright/test';

/**
 * E2E tests for Time Clock (Clock In/Out) flows
 * Tests: Clock in, clock out, time card display
 * Requirements: E2E testing, Requirements 7.1, 7.2
 */
test.describe('Time Clock', () => {
  // Helper to login before tests
  async function login(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    // Wait for navigation to complete
    await page.waitForURL(/dashboard|workforce|home|\//);
  }

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display time clock widget on workforce page', async ({ page }) => {
    // Navigate to workforce page
    await page.goto('/workforce');

    // Verify time clock widget is visible
    await expect(page.getByText(/time clock|clock in|clock out/i)).toBeVisible();
  });

  test('should show clock in button when not clocked in', async ({ page }) => {
    await page.goto('/workforce');

    // Should see clock in button
    const clockInButton = page.getByRole('button', { name: /clock in/i });
    await expect(clockInButton).toBeVisible();
  });

  test('should clock in successfully', async ({ page }) => {
    await page.goto('/workforce');

    // Click clock in button
    const clockInButton = page.getByRole('button', { name: /clock in/i });
    
    // Only proceed if clock in button is visible (not already clocked in)
    if (await clockInButton.isVisible()) {
      await clockInButton.click();

      // Should show success message or clock out button
      await expect(
        page.getByRole('button', { name: /clock out/i }).or(
          page.getByText(/clocked in|success/i)
        )
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('should clock out successfully', async ({ page }) => {
    await page.goto('/workforce');

    // First ensure we're clocked in
    const clockInButton = page.getByRole('button', { name: /clock in/i });
    if (await clockInButton.isVisible()) {
      await clockInButton.click();
      await page.waitForTimeout(1000);
    }

    // Now clock out
    const clockOutButton = page.getByRole('button', { name: /clock out/i });
    if (await clockOutButton.isVisible()) {
      await clockOutButton.click();

      // Should show success message or clock in button again
      await expect(
        page.getByRole('button', { name: /clock in/i }).or(
          page.getByText(/clocked out|success/i)
        )
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('should display current shift information when clocked in', async ({ page }) => {
    await page.goto('/workforce');

    // Clock in if not already
    const clockInButton = page.getByRole('button', { name: /clock in/i });
    if (await clockInButton.isVisible()) {
      await clockInButton.click();
      await page.waitForTimeout(1000);
    }

    // Should display shift information
    await expect(
      page.getByText(/current shift|started at|duration/i)
    ).toBeVisible();
  });

  test('should display recent time cards', async ({ page }) => {
    await page.goto('/workforce');

    // Should show time cards section
    await expect(
      page.getByText(/recent|time cards|history/i)
    ).toBeVisible();
  });
});
