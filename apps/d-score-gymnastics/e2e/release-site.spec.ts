import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('introduces the product and opens the calculator in one action', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/D-Score Gymnastics/);
  await expect(
    page.getByRole('heading', { name: 'Build routines. Know the D-score.' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: /Open the calculator/ })
    .first()
    .click();

  await expect(page).toHaveURL(/\/app\/$/);
  await expect(page.getByText('Build routines. Know the score.')).toBeVisible();
});

test('publishes direct support, privacy, and about routes', async ({ page }) => {
  const routes = [
    ['/about/', 'Scoring logic you can inspect.'],
    ['/support/', 'How can we help?'],
    ['/privacy/', 'Your routines stay yours.'],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  await page.goto('/about/');
  await expect(
    page.getByRole('link', { name: 'official World Gymnastics rules page' }),
  ).toHaveAttribute('href', 'https://www.gymnastics.sport/site/rules/');
  await expect(page.locator('.callout')).toContainText(
    'not affiliated with, endorsed by, or officially authorized',
  );
});

test('has no serious or critical accessibility violations on the public landing page', async ({
  page,
}) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();

  expect(
    results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious'),
  ).toEqual([]);
});
