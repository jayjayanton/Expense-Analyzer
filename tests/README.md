# Browser smoke tests

These repository-local Playwright tests run against the static GitHub Pages files using a small local HTTP server. They check the main navigation, local assets and links, mobile-width overflow, browser exceptions, and the critical interactions for this project.

## Run locally

Use Node.js 22 or newer:

```sh
npm ci
npx playwright install chromium
npm test
```

If a locally installed Chromium executable should be used instead of Playwright's downloaded browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its absolute path.

The GitHub Actions workflow runs on pushes, pull requests, and manual dispatch. It installs Chromium and runs the same suite. Expense Analyzer's CSV checks use inline synthetic rows only; no real statements or account data are stored in the repository.
