const { expect } = require('@playwright/test');

function captureRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(new URL(page.url() || 'http://127.0.0.1').origin) && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function assertNoRuntimeErrors(errors) {
  expect(errors, 'browser exceptions or failed local resources').toEqual([]);
}

async function assertLocalAssetsAndLinks(page) {
  const origin = new URL(page.url()).origin;
  const refs = await page.locator('script[src], link[rel="stylesheet"][href], img[src], source[src]').evaluateAll(nodes =>
    nodes.map(node => node.src || node.href).filter(Boolean));
  for (const raw of refs) {
    const url = new URL(raw, page.url());
    if (url.origin !== origin) continue;
    const response = await page.request.get(url.href);
    expect(response.ok(), `local asset unavailable: ${url.pathname}`).toBeTruthy();
  }
  const hrefs = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')).filter(Boolean));
  for (const href of hrefs) {
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    const url = new URL(href, page.url());
    if (url.origin !== origin) continue;
    const response = await page.request.get(url.href.split('#')[0]);
    expect(response.ok(), `local link unavailable: ${href}`).toBeTruthy();
    if (url.hash && url.pathname === new URL(page.url()).pathname) {
      await expect(page.locator(url.hash)).toHaveCount(1);
    }
  }
}

async function assertResponsive(page, path) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await expect(page.locator('body')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not overflow horizontally at a 390px viewport').toBeLessThanOrEqual(1);
}

module.exports = { captureRuntimeErrors, assertNoRuntimeErrors, assertLocalAssetsAndLinks, assertResponsive };
