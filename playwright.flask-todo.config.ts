import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for exercising the external Flask-Todo-List-307385 app.
 *
 * Assumptions:
 * - The Flask app is started separately by the user at http://localhost:5000
 * - These tests do NOT start/stop the Flask server.
 */
export default defineConfig({
  testDir: './tests/e2e-flask-todo',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false, // avoid accidental state collisions in the target app
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5000',
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
