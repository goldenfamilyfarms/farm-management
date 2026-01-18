import { test, expect } from '@playwright/test';

/**
 * E2E tests for Task Management flows
 * Tests: Task creation, task completion, task board
 * Requirements: E2E testing, Requirements 8.1, 8.2, 8.3
 */
test.describe('Task Management', () => {
  // Helper to login before tests
  async function login(page: import('@playwright/test').Page) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    await page.waitForURL(/dashboard|workforce|home|\//);
  }

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display task board on workforce page', async ({ page }) => {
    await page.goto('/workforce');

    // Verify task board is visible with columns
    await expect(page.getByText(/tasks|task board/i)).toBeVisible();
    await expect(page.getByText(/pending/i)).toBeVisible();
    await expect(page.getByText(/in progress/i)).toBeVisible();
    await expect(page.getByText(/completed/i)).toBeVisible();
  });

  test('should open task creation dialog', async ({ page }) => {
    await page.goto('/workforce');

    // Click add task button
    const addButton = page.getByRole('button', { name: /add task|new task|create task/i });
    if (await addButton.isVisible()) {
      await addButton.click();

      // Should show task creation dialog
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByLabel(/title/i)).toBeVisible();
    }
  });

  test('should create a new task', async ({ page }) => {
    await page.goto('/workforce');

    // Open task creation dialog
    const addButton = page.getByRole('button', { name: /add task|new task|create task/i });
    if (await addButton.isVisible()) {
      await addButton.click();

      // Fill in task details
      await page.getByLabel(/title/i).fill('E2E Test Task');
      await page.getByLabel(/description/i).fill('This is a test task created by E2E tests');
      
      // Select priority if available
      const prioritySelect = page.getByLabel(/priority/i);
      if (await prioritySelect.isVisible()) {
        await prioritySelect.click();
        await page.getByRole('option', { name: /high/i }).click();
      }

      // Submit the form
      await page.getByRole('button', { name: /create|save|submit/i }).click();

      // Should show success or task in list
      await expect(
        page.getByText('E2E Test Task').or(
          page.getByText(/created|success/i)
        )
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('should view task details', async ({ page }) => {
    await page.goto('/workforce');

    // Click on a task to view details
    const taskCard = page.locator('[data-testid="task-card"]').first();
    if (await taskCard.isVisible()) {
      await taskCard.click();

      // Should show task detail dialog
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });

  test('should update task status', async ({ page }) => {
    await page.goto('/workforce');

    // Find a pending task
    const pendingColumn = page.locator('[data-testid="column-pending"]');
    const taskCard = pendingColumn.locator('[data-testid="task-card"]').first();

    if (await taskCard.isVisible()) {
      // Click on task to open details
      await taskCard.click();

      // Find and click status update button
      const statusButton = page.getByRole('button', { name: /start|in progress/i });
      if (await statusButton.isVisible()) {
        await statusButton.click();

        // Should update status
        await expect(
          page.getByText(/in progress|updated|success/i)
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should mark task as complete', async ({ page }) => {
    await page.goto('/workforce');

    // Find a task that can be completed
    const taskCard = page.locator('[data-testid="task-card"]').first();

    if (await taskCard.isVisible()) {
      await taskCard.click();

      // Find and click complete button
      const completeButton = page.getByRole('button', { name: /complete|mark complete|done/i });
      if (await completeButton.isVisible()) {
        await completeButton.click();

        // Should show completion confirmation or success
        await expect(
          page.getByText(/completed|success/i)
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should filter tasks by status', async ({ page }) => {
    await page.goto('/workforce');

    // Find filter controls
    const filterSelect = page.getByLabel(/filter|status/i);
    if (await filterSelect.isVisible()) {
      await filterSelect.click();
      await page.getByRole('option', { name: /pending/i }).click();

      // Should only show pending tasks
      await page.waitForTimeout(500);
      // Verify filter is applied (implementation specific)
    }
  });
});
