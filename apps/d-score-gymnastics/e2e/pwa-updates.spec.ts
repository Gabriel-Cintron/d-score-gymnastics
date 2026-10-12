import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, relative, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { addElement, browserIssues, openApp, savedRecords, waitForSaved } from './helpers';

// Isolated servers serve two HTML revisions of the real export and real generated Workbox worker.
// The shared release artifact is never edited, so other browser projects cannot observe test builds.
test('waiting update, save-before-reload, failed-save blocking and rollback preserve routines', async ({
  page,
}) => {
  const issues = browserIssues(page);
  const root = resolve(import.meta.dirname, '../dist');
  let build = 'A';
  const baseHtml = await readFile(resolve(root, 'app/index.html'), 'utf8');
  const worker = await readFile(resolve(root, 'sw.js'), 'utf8');
  const html = () => baseHtml.replace('<html ', `<html data-release-test="${build}" `);
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const path = resolve(
        root,
        `.${decodeURIComponent(url.pathname)}${url.pathname.endsWith('/') ? 'index.html' : ''}`,
      );
      if (relative(root, path).startsWith('..')) {
        response.writeHead(404).end();
        return;
      }
      let body: string | Buffer;
      if (url.pathname === '/app/' || url.pathname === '/app/index.html') body = html();
      else if (url.pathname === '/sw.js') {
        const revision = createHash('md5').update(html()).digest('hex');
        body = worker.replace(
          /(url:"app\/index.html",revision:")[^"]+"/u,
          (_, prefix: string) => `${prefix}${revision}"`,
        );
      } else body = await readFile(path);
      response.writeHead(200, {
        'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      response.end(body);
    })().catch(() => response.writeHead(404).end());
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Test server unavailable');
  try {
    await openApp(page, `http://127.0.0.1:${address.port}/app/`);
    await expect
      .poll(async () => {
        const { preferences } = await savedRecords(page);
        return preferences?.onboardingComplete;
      })
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state;
        }),
      )
      .toBe('activated');
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await addElement(page);
    await waitForSaved(page);
    build = 'B';
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await expect(page.getByText('D-Score Gymnastics update available')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-release-test', 'A');
    await page.getByRole('button', { name: 'Later', exact: true }).click();
    await expect(page.getByText('D-Score Gymnastics update available')).toBeHidden();
    await page.reload();
    await expect(page.getByText('D-Score Gymnastics update available')).toBeVisible();
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await addElement(page, 'Double front tuck');
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-release-test', 'B');
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await expect(page.getByText('2/8', { exact: true })).toBeVisible();
    build = 'A';
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await expect(page.getByText('D-Score Gymnastics update available')).toBeVisible();
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = () => {
        throw new DOMException('Full', 'QuotaExceededError');
      };
    });
    await addElement(page, 'Double somersault backward tucked');
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(page.getByText(/update could not be applied/)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-release-test', 'B');
    // Reload the old active page to restore the browser API, then accept the waiting rollback.
    await page.reload();
    await page.getByRole('button', { name: 'Reload', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-release-test', 'A');
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await expect(page.getByText('2/8', { exact: true })).toBeVisible();
  } finally {
    if (!page.isClosed()) await page.goto('about:blank').catch(() => undefined);
    server.closeAllConnections();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
  expect(issues).toEqual([]);
});
