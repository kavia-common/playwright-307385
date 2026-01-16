# Flask Todo E2E tests (Playwright)

These Playwright end-to-end tests target the **external** Flask app (Flask-Todo-List-307385).

## Prerequisites

1. Start the Flask app separately and keep it running:

- Base URL: `http://localhost:5000`

2. From this repository root, install dependencies if you have not already:

```bash
npm ci
```

## Run the tests

Run with the dedicated config:

```bash
npx playwright test -c playwright.flask-todo.config.ts
```

HTML report will be generated automatically. To open it after a run:

```bash
npx playwright show-report
```

## Notes

- The Flask app is assumed to use in-memory storage, so tests create **unique usernames** and **unique task titles**.
- Tests attempt best-effort cleanup by completing/deleting tasks via the UI checkbox where available.
- There is a session behavior check: after logout, navigating to `/` should redirect to `/login`.
