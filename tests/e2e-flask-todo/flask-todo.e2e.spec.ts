import { test, expect, type Page, type Locator } from '@playwright/test';

function uniqueId(prefix: string) {
  const now = Date.now();
  const rand = Math.random().toString(16).slice(2);
  return `${prefix}-${now}-${rand}`;
}

function yyyyMmDd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function gotoLogin(page: Page) {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
}

/**
 * Attempt to logout in a robust way:
 * - Prefer clicking a "Logout" link/button if present
 * - Otherwise navigate to /logout endpoint and accept redirects
 */
async function logout(page: Page) {
  const logoutLink = page.getByRole('link', { name: /logout/i });
  const logoutButton = page.getByRole('button', { name: /logout/i });

  if (await logoutLink.count()) {
    await logoutLink.first().click();
  } else if (await logoutButton.count()) {
    await logoutButton.first().click();
  } else {
    await page.goto('/logout');
  }

  // Usually ends at /login, but some apps may redirect to /.
  await expect(page).toHaveURL(/\/login|\/$/);
}

async function signup(page: Page, username: string, password: string) {
  await page.goto('/signup');
  await expect(page).toHaveURL(/\/signup/);

  // Common Flask patterns: input name="username"/"password"
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);

  // Submit using a visible button
  const submit = page.getByRole('button', { name: /sign up|signup|register|create/i });
  if (await submit.count()) {
    await submit.first().click();
  } else {
    await page.locator('form').first().evaluate((form: HTMLFormElement) => form.submit());
  }
}

async function login(page: Page, username: string, password: string) {
  await gotoLogin(page);

  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);

  const submit = page.getByRole('button', { name: /log in|login|sign in/i });
  if (await submit.count()) {
    await submit.first().click();
  } else {
    await page.locator('form').first().evaluate((form: HTMLFormElement) => form.submit());
  }

  // Successful login should end at main page; allow either "/" or "/index".
  await expect(page).toHaveURL(/\/($|index)/);
}

function taskRowByTitle(page: Page, title: string): Locator {
  // Heuristic: tasks usually live in list items or rows and contain the title text.
  // We anchor to the title text and then climb to an <li> or <tr> container.
  const titleText = page.getByText(title, { exact: true });
  return titleText.locator('xpath=ancestor-or-self::li[1] | xpath=ancestor-or-self::tr[1]');
}

async function addTask(page: Page, title: string, dueDateYYYYMMDD: string) {
  // Common patterns:
  // - input name="task" or "title"
  // - input type="date" name="due_date" / "due" / "date"
  const titleInput =
    page.locator('input[name="task"], input[name="title"], input[name="todo"], input[type="text"]').first();
  await expect(titleInput).toBeVisible();
  await titleInput.fill(title);

  const dateInput = page.locator('input[type="date"]').first();
  await expect(dateInput).toBeVisible();
  await dateInput.fill(dueDateYYYYMMDD);

  // Prefer button text "Add"
  const addButton = page.getByRole('button', { name: /add/i });
  if (await addButton.count()) {
    await addButton.first().click();
  } else {
    // Fallback: submit first form
    await page.locator('form').first().evaluate((form: HTMLFormElement) => form.submit());
  }

  // Verify it shows up
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText(dueDateYYYYMMDD)).toBeVisible();
}

test.describe('Flask Todo app E2E', () => {
  test('Signup flow: create user, then access main todo page', async ({ page }) => {
    const username = uniqueId('pwuser');
    const password = 'pw-password-123';

    await signup(page, username, password);

    // Apps often redirect to login after signup; if not, still ensure we can access main page.
    if (/\/signup/.test(page.url())) {
      // Signup might have validation errors; fail early with URL + screenshot.
      await expect(page).not.toHaveURL(/\/signup/);
    }

    // If we landed on login, login now; if we landed on main, this will just pass on URL check.
    if (/\/login/.test(page.url())) {
      await login(page, username, password);
    } else {
      await expect(page).toHaveURL(/\/($|index)/);
    }

    // Session is set: navigating to "/" stays on main page
    await page.goto('/');
    await expect(page).toHaveURL(/\/($|index)/);
  });

  test('Login flow: existing user can login and is redirected to main page', async ({ page }) => {
    const username = uniqueId('pwuser');
    const password = 'pw-password-123';

    // Create user first (in-memory app may not persist users between runs)
    await signup(page, username, password);

    // Ensure we are logged in (either already or by logging in)
    if (/\/login/.test(page.url())) {
      await login(page, username, password);
    } else {
      await expect(page).toHaveURL(/\/($|index)/);
    }

    // Logout + verify / redirects to login afterwards
    await logout(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    // Login again and confirm we get to main page
    await login(page, username, password);
  });

  test('Add task: add a task with a due date and verify it appears', async ({ page }) => {
    const username = uniqueId('pwuser');
    const password = 'pw-password-123';
    await signup(page, username, password);
    if (/\/login/.test(page.url()))
      await login(page, username, password);

    const title = uniqueId('task');
    const due = yyyyMmDd(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)); // +3 days

    await addTask(page, title, due);

    // Cleanup (best-effort): delete/complete the task via checkbox if present
    const row = taskRowByTitle(page, title);
    const checkbox = row.locator('input[type="checkbox"]').first();
    if (await checkbox.count()) {
      await checkbox.check();
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    }
  });

  test('Overdue vs Due: past due task is .overdue (red) and future is .notdue (green)', async ({ page }) => {
    const username = uniqueId('pwuser');
    const password = 'pw-password-123';
    await signup(page, username, password);
    if (/\/login/.test(page.url()))
      await login(page, username, password);

    const pastTitle = uniqueId('past');
    const futureTitle = uniqueId('future');

    const past = yyyyMmDd(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)); // -3 days
    const future = yyyyMmDd(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)); // +3 days

    await addTask(page, pastTitle, past);
    await addTask(page, futureTitle, future);

    const pastRow = taskRowByTitle(page, pastTitle);
    const futureRow = taskRowByTitle(page, futureTitle);

    // Prefer checking for CSS class presence on the row or on a descendant element.
    // Requirement mentions `.overdue` (red) vs `.notdue` (green).
    await expect(pastRow.locator('.overdue').first()).toBeVisible();
    await expect(futureRow.locator('.notdue').first()).toBeVisible();

    // Cleanup: complete/delete tasks via checkbox if present.
    for (const title of [pastTitle, futureTitle]) {
      const row = taskRowByTitle(page, title);
      const checkbox = row.locator('input[type="checkbox"]').first();
      if (await checkbox.count()) {
        await checkbox.check();
        await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      }
    }
  });

  test('Complete/delete task: checking checkbox removes item from list', async ({ page }) => {
    const username = uniqueId('pwuser');
    const password = 'pw-password-123';
    await signup(page, username, password);
    if (/\/login/.test(page.url()))
      await login(page, username, password);

    const title = uniqueId('complete-me');
    const due = yyyyMmDd(new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)); // +1 day

    await addTask(page, title, due);

    const row = taskRowByTitle(page, title);
    const checkbox = row.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible();

    await checkbox.check();

    // Task should be removed after completing
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  });
});
