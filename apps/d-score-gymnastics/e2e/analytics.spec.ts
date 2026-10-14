import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {
  dashboardHtml,
  dashboardCss,
  dashboardJs,
} from '../../../services/analytics/src/dashboard';
import { aliasScript } from '../../../services/analytics/src/aliases';
import { openApp } from './helpers';
test.use({ serviceWorkers: 'block' });

test('preview analytics stays disabled and outside routine backups', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('analytics.d-score.app')) sent.push(r.url());
  });
  await openApp(page);
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await expect(page.getByText('Help improve D-Score', { exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Share basic usage/ })).toBeDisabled();
  await expect(page.getByRole('switch', { name: /Share search terms/ })).toBeDisabled();
  await expect(page.getByRole('switch', { name: /Share basic usage/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(sent).toEqual([]);
});
test('private dashboard renders usage/search and downloads a proposal without changing a catalog', async ({
  page,
}) => {
  const today = new Date().toISOString().slice(0, 10),
    version = '1.0.0@' + 'a'.repeat(40);
  const usage = {
    totals: { users: 1234, sessions: 5000, start: Date.now(), aggregated: Date.now() },
    active: { dau: 12, wau: 60, mau: 180, new_users: 30, returning_users: 150 },
    peak: { mau: 220, day: today },
    best: { users: 200, month: today.slice(0, 7) },
    history: [{ day: today, dau: 12, wau: 60, mau: 180, new_users: 30 }],
    counts: { searches: 100, selected: 70 },
    versions: [{ version }],
    acquisition: [],
    gaps: [],
    definition: 'Consenting browser profiles/installations; not exact people.',
  };
  const search = {
    terms: [{ term: 'peache', searches: 6, zeros: 6, no_match: 6, selected: 0, contributors: 3 }],
    filters: [{ kind: 'group', count: 3 }],
    reviews: [],
    evidence: [{ term: 'peache', target: 'pb:mag-0001', contributors: 3, reformulations: 4 }],
    catalog: [{ id: 'pb:mag-0001', name: 'Peach', aliases: [] }],
  };
  const proposals: unknown[] = [];
  await page.route('http://127.0.0.1:4173/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const text =
      path === '/analytics-preview/'
        ? dashboardHtml
        : path === '/dashboard.js'
          ? dashboardJs
          : path === '/aliases.js'
            ? aliasScript
            : path === '/dashboard.css'
              ? dashboardCss
              : undefined;
    if (text !== undefined) {
      await route.fulfill({
        body: text,
        headers:
          path === '/analytics-preview/'
            ? {
                'Content-Security-Policy':
                  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
              }
            : {},
        contentType: path.endsWith('.js')
          ? 'text/javascript'
          : path.endsWith('.css')
            ? 'text/css'
            : 'text/html',
      });
      return;
    }
    if (path === '/v1/summary') {
      await route.fulfill({ json: usage });
      return;
    }
    if (path === '/v1/search') {
      await route.fulfill({ json: search });
      return;
    }
    if (path === '/v1/review') {
      const proposal = route.request().postDataJSON();
      proposals.push(proposal);
      await route.fulfill({ json: { proposal } });
      return;
    }
    await route.abort();
  });
  await page.goto('/analytics-preview/');
  await expect(page.getByText('Total users observed', { exact: true })).toBeVisible();
  await expect(page.getByText('1,234', { exact: true })).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export usage CSV' }).click();
  const csvDownload = await csv;
  expect(csvDownload.suggestedFilename()).toMatch(/dscore-usage/);
  const csvPath = await csvDownload.path();
  expect(csvPath).not.toBeNull();
  if (csvPath) {
    const text = await readFile(csvPath, 'utf8');
    expect(text.split('\n').length).toBeGreaterThan(5);
    expect(text).toContain('Highest MAU ever');
  }
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByText(/peache · repeated/).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'accepted', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('alias-proposal.json');
  expect(proposals).toEqual([{ term: 'peache', target: 'pb:mag-0001', status: 'accepted' }]);
  expect(search.catalog[0]?.aliases).toEqual([]);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );
});

test('production-origin fixture sends only permitted usage/search data and erases both identities', async ({
  page,
}) => {
  const uploads: { events: Record<string, unknown>[] }[] = [],
    deletions: unknown[] = [];
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'webdriver', { get: () => false }),
  );
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'analytics.d-score.app') {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': 'https://d-score.app',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST',
          },
        });
        return;
      }
      const body = route.request().postDataJSON();
      if (url.pathname === '/v1/delete') deletions.push(body);
      else uploads.push(body);
      await route.fulfill({
        json:
          url.pathname === '/v1/delete'
            ? { deleted: true }
            : { accepted: body.events.map((e: { id: string }) => e.id) },
        headers: { 'Access-Control-Allow-Origin': 'https://d-score.app' },
      });
      return;
    }
    if (url.hostname === 'd-score.app') {
      const response = await route.fetch({
        url: 'http://127.0.0.1:4173' + url.pathname + url.search,
      });
      await route.fulfill({ response });
      return;
    }
    await route.abort();
  });
  await openApp(page, 'https://d-score.app/app/');
  expect(uploads).toEqual([]);
  await page.getByRole('button', { name: 'Allow basic usage', exact: true }).click();
  await expect.poll(() => uploads.length).toBe(1);
  expect(uploads[0]?.events[0]?.type).toBe('usage');
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await page
    .getByRole('button', { name: /Add element in slot/ })
    .first()
    .click();
  await page.getByLabel('Search elements').fill('Manna');
  await page.waitForTimeout(900);
  await page
    .getByRole('button', { name: /^Add element:/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await page.getByRole('switch', { name: /Share search terms/ }).click();
  await expect
    .poll(() => uploads.flatMap((b) => b.events).filter((e) => e.type === 'search').length)
    .toBe(1);
  expect(uploads.flatMap((b) => b.events).some((e) => 'query' in e || 'target' in e)).toBe(false);
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await page
    .getByRole('button', { name: /Add element in slot/ })
    .first()
    .click();
  await page.getByLabel('Search elements').fill('double front');
  await page.waitForTimeout(900);
  await page
    .getByRole('button', { name: /^Add element:/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Open Settings', exact: true }).click();
  await page.getByRole('switch', { name: /Share basic usage/ }).click();
  await expect
    .poll(() => uploads.flatMap((b) => b.events).filter((e) => 'query' in e).length)
    .toBe(1);
  expect(
    uploads
      .flatMap((b) => b.events)
      .some((e) => 'routine' in e || 'score' in e || 'apparatus' in e),
  ).toBe(false);
  await page.getByRole('button', { name: 'Stop collection and delete linked analytics' }).click();
  await expect.poll(() => deletions.length).toBe(2);
  await expect(page.getByRole('switch', { name: /Share search terms/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});
