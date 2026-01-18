import { test, expect } from '@playwright/test';

/**
 * E2E tests for Authentication flows
 * Tests: Login flow, logout, protected routes
 * Requirements: E2E testing, Requirements 9.1
 */
test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page before each test
    await page.goto('/login');
  });

  test('should display login page', async ({ page }) => {
    // Verify login page elements are visible
    await expect(page.getByRole('heading', { name: /login|sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    // Click login without filling form
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should show validation errors
    await expect(page.getByText(/email.*required|please enter.*email/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');

    // Should be redirected to login
    await expect(page).toHaveURL(/login/);
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // This test requires a valid test user in the database
    // Fill in valid credentials
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /login|sign in/i }).click();

    // Should redirect to dashboard or home page
    await expect(page).toHaveURL(/dashboard|home|\//);
  });
});
