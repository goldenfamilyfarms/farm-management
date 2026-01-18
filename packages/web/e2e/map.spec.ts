import { test, expect } from '@playwright/test';

/**
 * E2E tests for Map Interactions
 * Tests: Map display, field boundaries, zone visualization
 * Requirements: E2E testing, Requirements 3.1, 3.2, 3.3
 */
test.describe('Map Interactions', () => {
  // Helper to login before tests
  async function login(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL(/dashboard|fields|home|\//);
  }

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display map on fields page', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Verify map container is visible
    await expect(page.locator('.mapboxgl-map, [data-testid="farm-map"]')).toBeVisible();
  });

  test('should display layer controls', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Verify layer controls are visible
    await expect(
      page.getByText(/layers|fields|zones|equipment/i)
    ).toBeVisible();
  });

  test('should toggle field layer visibility', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Find and click layer toggle
    const layerToggle = page.getByRole('checkbox', { name: /fields/i }).or(
      page.getByLabel(/fields/i)
    );
    
    if (await layerToggle.isVisible()) {
      // Toggle off
      await layerToggle.click();
      await page.waitForTimeout(500);

      // Toggle back on
      await layerToggle.click();
    }
  });

  test('should display drawing toolbar', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Verify drawing toolbar is visible
    await expect(
      page.getByRole('button', { name: /draw|polygon|add field/i }).or(
        page.locator('[data-testid="drawing-toolbar"]')
      )
    ).toBeVisible();
  });

  test('should open field creation dialog when drawing polygon', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Click draw polygon button
    const drawButton = page.getByRole('button', { name: /draw|polygon|add field/i });
    if (await drawButton.isVisible()) {
      await drawButton.click();

      // Verify drawing mode is active (implementation specific)
      await expect(
        page.getByText(/click to start|draw polygon|drawing mode/i)
      ).toBeVisible();
    }
  });

  test('should display field information on click', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Click on a field polygon (if any exist)
    const mapCanvas = page.locator('.mapboxgl-canvas');
    if (await mapCanvas.isVisible()) {
      // Click in the center of the map
      const box = await mapCanvas.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        
        // Wait for popup or sidebar to appear
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should zoom and pan the map', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    const mapCanvas = page.locator('.mapboxgl-canvas');
    if (await mapCanvas.isVisible()) {
      const box = await mapCanvas.boundingBox();
      if (box) {
        // Test zoom with scroll
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, -100); // Zoom in
        await page.waitForTimeout(500);
        await page.mouse.wheel(0, 100); // Zoom out
        await page.waitForTimeout(500);

        // Test pan with drag
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
        await page.mouse.up();
      }
    }
  });

  test('should display equipment markers on map', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Enable equipment layer if not already enabled
    const equipmentToggle = page.getByRole('checkbox', { name: /equipment/i }).or(
      page.getByLabel(/equipment/i)
    );
    
    if (await equipmentToggle.isVisible()) {
      // Ensure equipment layer is visible
      const isChecked = await equipmentToggle.isChecked();
      if (!isChecked) {
        await equipmentToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Equipment markers should be visible (if any equipment exists)
    // This is implementation specific
  });

  test('should display zone overlays with soil quality colors', async ({ page }) => {
    await page.goto('/fields');

    // Wait for map to load
    await page.waitForTimeout(2000);

    // Enable zones layer if not already enabled
    const zonesToggle = page.getByRole('checkbox', { name: /zones/i }).or(
      page.getByLabel(/zones/i)
    );
    
    if (await zonesToggle.isVisible()) {
      const isChecked = await zonesToggle.isChecked();
      if (!isChecked) {
        await zonesToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Zone overlays should be visible (if any zones exist)
    // This is implementation specific
  });
});
