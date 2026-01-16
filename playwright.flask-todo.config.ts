import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for exercising the external Flask-Todo-List-307385 app.
 *
 * Assumptions:
 * - The Flask app is started by tooling (e.g., `make test-flask-e2e`) or separately by the user.
 * - When `BASE_URL` is provided, it overrides the default localhost:5000.
 */
const baseURL = process.env.BASE_URL || 'http://localhost:5000';

export default defineConfig({
  testDir: './tests/e2e-flask-todo',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false, // avoid accidental state collisions in the target app
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
