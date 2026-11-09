const { test, expect } = require('@playwright/test');
const { captureRuntimeErrors, assertNoRuntimeErrors, assertLocalAssetsAndLinks, assertResponsive } = require('./helpers');

const syntheticCsv = [
  'Date,Description,Amount',
  '2026-10-02,SYNTHETIC TEST GROCERY,42.50',
  '2026-10-03,SYNTHETIC TEST DINNER,18.25',
  '2026-10-04,SYNTHETIC TEST SUBSCRIPTION,9.99',
].join('\n');

test('application scripts and local assets load', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Expense Analyzer' })).toBeVisible();
  await assertLocalAssetsAndLinks(page);
  await assertNoRuntimeErrors(errors);
});

test('synthetic CSV is processed and its transactions can be exported', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.locator('#file').setInputFiles({ name: 'synthetic-test.csv', mimeType: 'text/csv', buffer: Buffer.from(syntheticCsv) });
  await page.locator('#cardName').fill('SYNTHETIC-TEST-CARD');
  await page.locator('#upload').click();
  await expect(page.locator('#error')).toBeEmpty({ timeout: 120_000 });
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('#count')).toHaveText('3');
  await expect(page.locator('#total')).toContainText('70.74');
  await expect(page.locator('#tbody')).toContainText('SYNTHETIC TEST GROCERY');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('SYNTHETIC-TEST-CARD');
  const file = await download.path();
  const fs = require('node:fs/promises');
  const csv = await fs.readFile(file, 'utf8');
  expect(csv).toContain('SYNTHETIC TEST GROCERY');
  expect(csv).toContain('Total expenses');
  expect(csv).toContain('$70.74');
  await assertNoRuntimeErrors(errors);
});

test('dashboard shell fits a mobile viewport', async ({ page }) => {
  await assertResponsive(page, '/');
  await expect(page.locator('#upload')).toBeVisible();
});
