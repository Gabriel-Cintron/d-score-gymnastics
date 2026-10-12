import { expect, type Page } from '@playwright/test';

export function browserIssues(page: Page): string[] {
  const issues: string[] = [];
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method()) && /^https?:/u.test(request.url())) {
      issues.push(`Unexpected data upload: ${request.method()} ${new URL(request.url()).origin}`);
    }
  });
  return issues;
}

export async function openApp(page: Page, url = '/app/') {
  await page.goto(url);
  await expect(
    page.getByRole('button', { name: 'Start a new Floor Exercise routine' }),
  ).toBeEnabled();
  const skip = page.getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible()) await skip.click();
}

export async function addElement(page: Page, query = 'Manna') {
  await page
    .getByRole('button', { name: /Add element in slot/ })
    .first()
    .click();
  await page.getByLabel('Search elements').fill(query);
  const row = page.getByRole('button', { name: /^Add element:/ }).first();
  const label = await row.getAttribute('aria-label');
  await row.click();
  await expect(page.getByLabel('Search elements')).toBeHidden();
  return label?.replace(/^Add element: /, '') ?? '';
}

export async function savedRecords(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easyscore', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = database.transaction(['workbench', 'routine-library', 'app-preferences']);
      const read = (name: string) =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const request = tx.objectStore(name).get('current');
          request.onsuccess = () => resolve(request.result as Record<string, unknown>);
          request.onerror = () => reject(request.error);
        });
      const [workbench, library, preferences] = await Promise.all([
        read('workbench'),
        read('routine-library'),
        read('app-preferences'),
      ]);
      return { workbench, library, preferences };
    } finally {
      database.close();
    }
  });
}

export async function waitForSaved(page: Page) {
  await expect(page.getByText('AUTOSAVED', { exact: true })).toBeVisible();
}

export async function seedRecords(page: Page, records: Awaited<ReturnType<typeof savedRecords>>) {
  await page.evaluate(async (data) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easyscore', 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(
          ['workbench', 'routine-library', 'app-preferences'],
          'readwrite',
        );
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.objectStore('workbench').put(data.workbench, 'current');
        tx.objectStore('routine-library').put(data.library, 'current');
        tx.objectStore('app-preferences').put(data.preferences, 'current');
      });
    } finally {
      database.close();
    }
  }, records);
}
