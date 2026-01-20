import { test, expect } from '@playwright/test';

/**
 * Playwright API test (HTTP requests only) for the Flask Todo List app.
 *
 * How to run (server must already be running on http://localhost:3002):
 *   npx playwright test tests/flask-todo-api.spec.ts
 */
test.describe('Flask Todo List - API (request) flow', () => {
  test('creates a todo via form POST and shows it on the main page', async ({ playwright }) => {
    // Create a fresh isolated request context so cookies (Flask session) persist between calls.
    const request = await playwright.request.newContext({
      baseURL: 'http://localhost:3002',
    });

    // Unique username per run to avoid collisions.
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const username = `pw_api_${uniqueSuffix}`;
    const password = `pw_api_${uniqueSuffix}_pass`;

    // 1) Signup via JSON API
    const signupResponse = await request.post('/api/signup', {
      data: { username, password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(
      signupResponse.status(),
      `Expected /api/signup to succeed; got status=${signupResponse.status()} body=${await signupResponse.text()}`
    ).toBeGreaterThanOrEqual(200);
    expect(signupResponse.status()).toBeLessThan(400);

    // 1b) Login via JSON API to establish the session cookie.
    const loginResponse = await request.post('/api/login', {
      data: { username, password },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(
      loginResponse.status(),
      `Expected /api/login to succeed; got status=${loginResponse.status()} body=${await loginResponse.text()}`
    ).toBeGreaterThanOrEqual(200);
    expect(loginResponse.status()).toBeLessThan(400);

    // 2) Create a todo using the HTML form endpoint (x-www-form-urlencoded)
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const createTodoResponse = await request.post('/', {
      form: {
        newItem: 'Buy milk',
        duedate: dueDate,
      },
      // Playwright will set appropriate form encoding when using `form`.
      maxRedirects: 0, // capture redirect status if server redirects after POST
    });

    // 3) Verify success or redirect (accept 200, 302, 303).
    const createStatus = createTodoResponse.status();
    expect([200, 302, 303]).toContain(createStatus);

    // If redirected, follow it (optional but helps ensure cookies & flow works).
    if (createStatus === 302 || createStatus === 303) {
      const location = createTodoResponse.headers()['location'];
      expect(location, 'Expected redirect Location header after POST /').toBeTruthy();

      const followResponse = await request.get(location!, { maxRedirects: 5 });
      expect(followResponse.status()).toBeGreaterThanOrEqual(200);
      expect(followResponse.status()).toBeLessThan(400);
    }

    // 4) Fetch the main page HTML with the same request context (cookies preserved).
    const homeResponse = await request.get('/');
    expect(homeResponse.status()).toBe(200);

    const html = await homeResponse.text();

    // 5) Assert HTML contains the new todo title.
    expect(html).toContain('Buy milk');

    await request.dispose();
  });
});
