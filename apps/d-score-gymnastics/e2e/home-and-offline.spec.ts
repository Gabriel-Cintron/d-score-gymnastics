import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addElement, openApp, waitForSaved } from './helpers';
import { staticReleaseServer } from './static-server';

async function dismissOnboarding(page: Page): Promise<void> {
  await expect(
    page.getByRole('button', { name: 'Start a new Floor Exercise routine' }),
  ).toBeEnabled();
  const skip = page.getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible()) {
    await skip.click();
    await expect(skip).toBeHidden();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/app/');
  await dismissOnboarding(page);
  await expect(page.getByText('Build routines. Know the score.')).toBeVisible();
});

test('keeps Quick Start in three equal pairs without colliding with recent work', async ({
  page,
}) => {
  const pairs = [
    ['Floor Exercise', 'Pommel Horse'],
    ['Still Rings', 'Vault'],
    ['Parallel Bars', 'Horizontal Bar'],
  ] as const;

  for (const [first, second] of pairs) {
    const firstBox = await page
      .getByRole('button', { name: `Start a new ${first} routine` })
      .boundingBox();
    const secondBox = await page
      .getByRole('button', { name: `Start a new ${second} routine` })
      .boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(Math.abs((firstBox?.y ?? 0) - (secondBox?.y ?? 0))).toBeLessThan(2);
    expect(Math.abs((firstBox?.width ?? 0) - (secondBox?.width ?? 0))).toBeLessThan(2);
  }

  const viewport = page.viewportSize();
  if ((viewport?.width ?? 0) < 860) {
    const quickStart = await page.getByTestId('quick-start-grid').boundingBox();
    const recentWork = await page.getByTestId('recent-work-column').boundingBox();
    expect(quickStart).not.toBeNull();
    expect(recentWork).not.toBeNull();
    expect(recentWork?.y ?? 0).toBeGreaterThanOrEqual(
      (quickStart?.y ?? 0) + (quickStart?.height ?? 0),
    );
  }
});

test('keeps the active workspace card consistent with light and dark themes', async ({ page }) => {
  const card = page.getByTestId('continue-workspace-card');
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(card).toHaveCSS('background-color', 'rgb(17, 24, 39)');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('shows the independence notice and authoritative rules action in Settings', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open Settings' }).click();

  await expect(
    page
      .getByText(
        'D-Score Gymnastics is an independent project. It is not affiliated with, endorsed by, or officially authorized by World Gymnastics or the Fédération Internationale de Gymnastique (FIG).',
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open official rules' })).toBeVisible();
  await expect(page.getByText('Source cutoff').locator('..')).toContainText('2026-08-10');
});

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious'),
  ).toEqual([]);
});

test('restores local work and reloads offline after the first successful load', async ({
  context,
  page,
  browserName,
}) => {
  const origin = await staticReleaseServer();
  try {
    await openApp(page, origin.url);
    await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
    await addElement(page);
    await waitForSaved(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    // No network server remains reachable. WebKit's offline-emulation API also prevents worker
    // navigations on Windows and Linux, so it uses the actual server outage without that API.
    await origin.stop();
    if (browserName !== 'webkit') await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await expect(page.getByText('1/8', { exact: true })).toBeVisible();
    await addElement(page, 'Double front tuck');
    await waitForSaved(page);
    await origin.restart();
    await context.setOffline(false);
    await page.reload();
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await expect(page.getByText('2/8', { exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
    if (!page.isClosed()) await page.goto('about:blank').catch(() => undefined);
    await origin.stop();
  }
});
