# E2E Tests with Playwright

This directory contains end-to-end tests for the Farm Management Platform web application.

## Prerequisites

1. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

2. Ensure the API server is running with a test database
3. Create a test user in the database:
   - Email: `test@example.com`
   - Password: `TestPassword123!`

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode (interactive)
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Coverage

### Authentication (`auth.spec.ts`)
- Display login page
- Validation errors for empty form
- Error for invalid credentials
- Redirect to login for protected routes
- Successful login with valid credentials

### Time Clock (`time-clock.spec.ts`)
- Display time clock widget
- Show clock in button when not clocked in
- Clock in successfully
- Clock out successfully
- Display current shift information
- Display recent time cards

### Task Management (`tasks.spec.ts`)
- Display task board with columns
- Open task creation dialog
- Create a new task
- View task details
- Update task status
- Mark task as complete
- Filter tasks by status

### Map Interactions (`map.spec.ts`)
- Display map on fields page
- Display layer controls
- Toggle field layer visibility
- Display drawing toolbar
- Open field creation dialog
- Display field information on click
- Zoom and pan the map
- Display equipment markers
- Display zone overlays

## Configuration

The Playwright configuration is in `playwright.config.ts`. Key settings:

- **Base URL**: `http://localhost:5173` (or `BASE_URL` env var)
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome
- **Web Server**: Automatically starts `pnpm dev` before tests
- **Screenshots**: Captured on failure
- **Traces**: Collected on first retry

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e` directory
2. Import test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Use the login helper for authenticated tests:
   ```typescript
   async function login(page) {
     await page.goto('/login');
     await page.getByLabel(/email/i).fill('test@example.com');
     await page.getByLabel(/password/i).fill('TestPassword123!');
     await page.getByRole('button', { name: /login|sign in/i }).click();
     await page.waitForURL(/dashboard|home|\//);
   }
   ```

## Debugging

- Use `--debug` flag to step through tests
- Use `--headed` to see the browser
- Use `test.only()` to run a single test
- Check `playwright-report/` for HTML reports after test runs
