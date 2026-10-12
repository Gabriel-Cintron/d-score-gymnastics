import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const rawDirectory = resolve(import.meta.dirname, '../../../release/app-store/screenshots/raw');

async function openFreshApp(page: Page): Promise<void> {
  await page.goto('/app/');
  const onboarding = page.getByText('WELCOME TO D-SCORE');
  await expect(onboarding).toBeVisible();
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(onboarding).toBeHidden();
  await expect(page.getByText('Build routines. Know the score.')).toBeVisible();
}

async function capture(page: Page, name: string): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.waitForTimeout(250);
  await page.screenshot({
    animations: 'disabled',
    path: resolve(rawDirectory, name),
  });
}

async function startRoutine(page: Page, apparatus: string): Promise<void> {
  const start = page.getByRole('button', { name: `Start a new ${apparatus} routine` });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByText(`${apparatus} routine`, { exact: true })).toBeVisible();
}

async function addElement(page: Page, search: string): Promise<void> {
  const nextSlot = page.getByRole('button', { name: /Add element in slot/ }).first();
  await nextSlot.click();
  const query = page.getByLabel('Search elements');
  await query.fill(search);
  const result = page.getByRole('button', { name: /^Add element:/ }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByText('ADD ELEMENT', { exact: true })).toBeHidden();
}

test.describe.configure({ mode: 'serial' });

test('01 — Home and Quick Start', async ({ page }) => {
  await openFreshApp(page);
  await expect(page.getByTestId('quick-start-grid')).toBeVisible();
  await capture(page, '01-home.png');
});

test('02 — searchable Floor Exercise catalogue', async ({ page }) => {
  await openFreshApp(page);
  await startRoutine(page, 'Floor Exercise');
  await page.getByRole('button', { name: 'Add element in slot 1' }).click();
  await page.getByLabel('Search elements').fill('Arabian double');
  await expect(page.getByText(/best matches first/)).toBeVisible();
  await capture(page, '02-build-floor.png');
});

test('03 — live explained Floor Exercise score', async ({ page }) => {
  await openFreshApp(page);
  await startRoutine(page, 'Floor Exercise');
  await addElement(page, 'Manna 2-second hold then press');
  await addElement(page, 'Double front tuck');
  await addElement(page, 'Double somersault backward tucked');
  await addElement(page, 'Somersault backward straight plus 3/2');

  await page.getByText('LIVE D-SCORE ESTIMATE').evaluate((element) => {
    element.scrollIntoView({ block: 'start' });
  });
  await expect(page.getByText('Element groups')).toBeVisible();
  await capture(page, '03-score-breakdown.png');
});

test('04 — valid Pommel Horse Flop builder', async ({ page }) => {
  await openFreshApp(page);
  await startRoutine(page, 'Pommel Horse');
  await page.getByRole('button', { name: 'Add element in slot 1' }).click();
  await page.getByRole('tab', { name: 'Build a flop' }).click();

  const query = page.getByLabel('Search valid flop parts');
  await query.fill('Direct Stöckli B');
  const dsb = page.getByRole('button', { name: /Add to flop: .*Direct Stöckli B/ });
  await dsb.click();
  await dsb.click();
  await query.fill('Direct Stöckli A');
  await page.getByRole('button', { name: /Add to flop: .*Direct Stöckli A/ }).click();

  await expect(page.getByText('D Stöckli flop')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add D Stöckli flop to routine' })).toBeVisible();
  await capture(page, '04-pommel-flops.png');
});

test('05 — local-first Settings in dark mode', async ({ page }) => {
  await openFreshApp(page);
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await expect(page.getByText('APP PREFERENCES')).toBeVisible();
  await expect(page.getByText('Local data', { exact: true })).toBeVisible();
  await capture(page, '05-save-and-settings.png');
});
