import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import {
  addElement,
  browserIssues,
  openApp,
  savedRecords,
  seedRecords,
  waitForSaved,
} from './helpers';

test('exports, clears and restores a complete backup, rejecting invalid imports without changing data', async ({
  page,
}) => {
  const issues = browserIssues(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await waitForSaved(page);
  await page.getByRole('button', { name: 'Open Settings' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const file = await (await downloading).path();
  if (file === null) throw new Error('Backup download is missing');
  const backup = await readFile(file, 'utf8');
  const before = await savedRecords(page);
  await page.getByRole('button', { name: 'Paste backup', exact: true }).click();
  for (const invalid of [
    '{invalid',
    JSON.stringify({ ...JSON.parse(backup), schemaVersion: 999 }),
  ]) {
    await page.getByLabel('D-Score Gymnastics backup JSON').fill(invalid);
    await page.getByRole('button', { name: 'Validate and restore' }).click();
    await expect(page.getByText(/not a valid backup/)).toBeVisible();
    expect(await savedRecords(page)).toEqual(before);
  }
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file', exact: true }).click();
  await (
    await choosing
  ).setFiles({
    name: 'oversized-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(8_000_001, 'x'),
  });
  await expect(page.getByText(/backup file is too large/)).toBeVisible();
  expect(await savedRecords(page)).toEqual(before);
  await page.getByRole('button', { name: 'Clear local routine data', exact: true }).click();
  await page.getByRole('button', { name: 'Clear everything', exact: true }).click();
  await page.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await page.getByRole('button', { name: 'Paste backup', exact: true }).click();
  await page.getByLabel('D-Score Gymnastics backup JSON').fill(backup);
  await page.getByRole('button', { name: 'Validate and restore' }).click();
  await expect.poll(async () => (await savedRecords(page)).workbench).toEqual(before.workbench);
  await expect(page.getByRole('button', { name: 'Continue editing' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByText('1/8', { exact: true })).toBeVisible();
  expect(issues).toEqual([]);
});

for (const full of [false, true]) {
  test(`legacy conflicting snapshots ${full ? 'preserve a full library in session-only mode' : 'recover both versions'}`, async ({
    page,
  }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
    await addElement(page);
    await waitForSaved(page);
    const records = await savedRecords(page);
    const library = records.library as {
      activeAllAroundId: string;
      items: { id: string; name: string; state: { routines: Record<string, unknown[]> } }[];
    };
    const original = library.items[0];
    if (original === undefined) throw new Error('Seed workspace is missing');
    original.state.routines['floor-exercise'] = [];
    if (full)
      library.items = Array.from({ length: 100 }, (_, i) => ({
        ...original,
        id: `legacy-${i}`,
        name: `Legacy ${i}`,
      }));
    const first = library.items[0];
    if (first === undefined) throw new Error('Seed workspace is missing');
    library.activeAllAroundId = first.id;
    await seedRecords(page, records);
    await page.reload();
    await expect(
      page.getByText(full ? /Recovery needs space/ : 'Recovered workbench', { exact: !full }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue editing' }).click();
    await expect(page.getByText('1/8', { exact: true })).toBeVisible();
    if (full) {
      await expect(page.getByText('AUTOSAVED', { exact: true })).toBeHidden();
      expect(await savedRecords(page)).toEqual(records);
    } else {
      await waitForSaved(page);
      const after = (await savedRecords(page)).library as typeof library;
      expect(after.items).toHaveLength(2);
      expect(
        after.items.find((item) => item.id === original.id)?.state.routines['floor-exercise'],
      ).toHaveLength(0);
      expect(
        after.items.find((item) => item.name === 'Recovered workbench')?.state.routines[
          'floor-exercise'
        ],
      ).toHaveLength(1);
    }
  });
}

test('failed database opens preserve the usable session and never report durable deletion', async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Unavailable', 'UnknownError');
    };
  });
  await openApp(page);
  await expect(page.getByText(/Your work is temporary/)).toBeVisible();
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await page.getByRole('button', { name: 'Open Settings' }).click();
  await expect(
    page.getByRole('button', { name: 'Clear local routine data', exact: true }),
  ).toBeDisabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  await download;
});

test('storage unavailable allows calculation and backup export without claiming autosave', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'indexedDB', { get: () => undefined }),
  );
  await openApp(page);
  await expect(page.getByText(/Your work is temporary/)).toBeVisible();
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await expect(page.getByText('SAVE ERROR', { exact: true })).toBeVisible();
  await expect(page.getByText('AUTOSAVED', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Open Settings' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  await download;
});

test('a synchronous failed write aborts the complete transaction and preserves old records', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await waitForSaved(page);
  const before = await savedRecords(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.name === 'routine-library') throw new DOMException('Full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await addElement(page, 'Double front tuck');
  await expect(page.getByText('SAVE ERROR', { exact: true })).toBeVisible();
  expect(await savedRecords(page)).toEqual(before);
});
