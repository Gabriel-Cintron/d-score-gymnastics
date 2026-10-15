import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  addElement,
  browserIssues,
  openApp,
  savedRecords,
  seedRecords,
  waitForSaved,
} from './helpers';

const fig = { id: 'fig-mag-2025-2028', revision: '1.0.0' };
const unavailable = { id: 'future-profile', revision: '9.0.0' };
const allAroundControl = /^All-around default ruleset:/;
const routineControl = /^Routine ruleset:/;

test('ruleset selectors default to FIG, require explicit Apply, and disable incomplete profiles', async ({
  page,
}) => {
  const issues = browserIssues(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await waitForSaved(page);
  const before = await savedRecords(page);
  await page.getByRole('button', { name: routineControl }).click();
  await expect(
    page.getByRole('radio', { name: 'Use all-around default', exact: false }),
  ).toBeChecked();
  const drafts = page.getByRole('radio', { name: /USAG/ });
  await expect(drafts).toHaveCount(6);
  for (const draft of await drafts.all()) await expect(draft).toBeDisabled();
  const choice = page.getByRole('radio', { name: 'FIG MAG 2025–2028', exact: true });
  await choice.focus();
  await page.keyboard.press('Space');
  await expect(choice).toBeChecked();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await savedRecords(page)).toEqual(before);
  await page.getByRole('button', { name: routineControl }).click();
  await page.getByRole('radio', { name: 'FIG MAG 2025–2028', exact: true }).click();
  await page.getByRole('button', { name: 'Apply to this routine', exact: true }).click();
  await waitForSaved(page);
  expect((await savedRecords(page)).workbench.routineScoringOverrides).toEqual({});
  await expect(page.getByText('From all-around default', { exact: true })).toBeVisible();
  expect(issues).toEqual([]);
});

test('unsupported saved revisions preserve inputs and bulk reapplying FIG resets all six overrides atomically', async ({
  page,
}) => {
  const issues = browserIssues(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await waitForSaved(page);
  const records = await savedRecords(page);
  const overrides = Object.fromEntries(
    [
      'floor-exercise',
      'pommel-horse',
      'still-rings',
      'vault',
      'parallel-bars',
      'horizontal-bar',
    ].map((a) => [a, unavailable]),
  );
  records.workbench.routineScoringOverrides = overrides;
  const library = records.library as {
    activeAllAroundId: string;
    items: { id: string; state: Record<string, unknown> }[];
  };
  const active = library.items.find((item) => item.id === library.activeAllAroundId);
  if (!active) throw new Error('Missing active all-around');
  active.state.routineScoringOverrides = overrides;
  await seedRecords(page, records);
  await page.reload();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Scoring is unavailable' })).toBeVisible();
  await expect(page.getByText('1/32', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: allAroundControl }).click();
  await expect(
    page.getByText('Applies to all six routines and replaces individual overrides.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await savedRecords(page)).workbench.routineScoringOverrides).toEqual(overrides);
  await page.getByRole('button', { name: allAroundControl }).click();
  await page.getByRole('button', { name: 'Apply to all six', exact: true }).click();
  await waitForSaved(page);
  const after = await savedRecords(page);
  expect(after.workbench.defaultScoringProfile).toEqual(fig);
  expect(after.workbench.routineScoringOverrides).toEqual({});
  expect(after.workbench.routines).toEqual(records.workbench.routines);
  const persistedLibrary = after.library as typeof library;
  expect(
    persistedLibrary.items.find((item) => item.id === library.activeAllAroundId)?.state
      .routineScoringOverrides,
  ).toEqual({});
  await expect(page.getByText('1/8', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByText('From all-around default', { exact: true })).toBeVisible();
  expect((await savedRecords(page)).workbench.routineScoringOverrides).toEqual({});
  expect(issues).toEqual([]);
});

test('routine selector remains accessible and within narrow layouts in both themes', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('button', { name: routineControl }).click();
      await expect(
        page.getByRole('dialog', { name: 'Routine ruleset', exact: true }),
      ).toBeVisible();
      const axe = await new AxeBuilder({ page }).analyze();
      expect(
        axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
  }
});
