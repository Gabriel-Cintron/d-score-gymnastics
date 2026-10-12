import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addElement, browserIssues, openApp, savedRecords, waitForSaved } from './helpers';

test('edits and atomically persists a Floor routine, then reuses and renames its catalogue copy', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page, 'Manna 2-second hold then press');
  await addElement(page, 'Double front tuck');
  await waitForSaved(page);
  const records = await savedRecords(page);
  const library = records.library as {
    activeAllAroundId: string;
    items: { id: string; state: unknown }[];
  };
  expect(library.items.find((item) => item.id === library.activeAllAroundId)?.state).toEqual(
    Object.fromEntries(
      Object.entries(records.workbench).filter(
        ([key]) => !['schemaVersion', 'ruleset'].includes(key),
      ),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByText('2/8', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open routine catalogue/ }).click();
  await page.getByLabel('Routine catalogue name').fill('Training floor');
  await page.getByRole('button', { name: 'Save to catalogue', exact: true }).click();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Rename Training floor').fill('Competition floor');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Competition floor', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use routine', exact: true }).click();
  await page.getByRole('button', { name: 'Use routine', exact: true }).last().click();
  await expect(page.getByText('2/8', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Open routine catalogue/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.getByText('Competition floor', { exact: true })).toBeHidden();
  await expect
    .poll(async () => {
      const library = (await savedRecords(page)).library as { items: { name: string }[] };
      return library.items.some((item) => item.name === 'Competition floor');
    })
    .toBe(false);
});

test('Save before switching retains named routines and both all-arounds', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await page.getByRole('button', { name: /New all-around/ }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Floor Exercise routine name').fill('Saved on switch');
  await page.getByRole('button', { name: 'Save routines & switch', exact: true }).click();
  await expect(page.getByText('Untitled All-Around 2', { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const library = (await savedRecords(page)).library as { items: { name: string }[] };
      return library.items.map((item) => item.name).sort();
    })
    .toEqual(['Saved on switch', 'Untitled All-Around', 'Untitled All-Around 2']);
  await page.reload();
  await expect(page.getByText('Untitled All-Around 2', { exact: true })).toBeVisible();
});

test('the Floor apparatus fixture scores 2.8 with connection and landing, and ordering survives reload', async ({
  page,
}) => {
  const rules = JSON.parse(
    await readFile(
      new URL('../../../packages/rulesets/generated/fig-mag-2025-2028.json', import.meta.url),
      'utf8',
    ),
  ) as { elements: { id: string; name: string }[] };
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  for (const id of [
    'fx:mag-0003',
    'fx:mag-0007',
    'fx:mag-0024',
    'fx:mag-0051',
    'fx:mag-0054',
    'fx:mag-0056',
  ]) {
    const element = rules.elements.find((element) => element.id === id);
    if (element === undefined) throw new Error(`Fixture element is missing: ${id}`);
    const name = element.name;
    await page
      .getByRole('button', { name: /Add element in slot/ })
      .first()
      .click();
    await page.getByLabel('Search elements').fill(name);
    await page.getByRole('button', { name: `Add element: ${name}`, exact: true }).click();
    await expect(page.getByLabel('Search elements')).toBeHidden();
  }
  await page.getByRole('switch', { name: 'Add direct connection between slots 4 and 5' }).click();
  await page.getByRole('switch', { name: 'Stuck landing' }).click();
  await expect(page.getByText('2.8', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Move earlier', exact: true }).nth(2).click();
  await waitForSaved(page);
  const before = await savedRecords(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByText('2.8', { exact: true })).toBeVisible();
  expect((await savedRecords(page)).workbench).toEqual(before.workbench);
});

test('Home, editor and Settings fit required widths in both themes', async ({ page }) => {
  await openApp(page);
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      const toggle = page.getByRole('button', {
        name: `Switch to ${dark ? 'dark' : 'light'} mode`,
      });
      if (await toggle.isVisible()) await toggle.click();
      for (const screen of ['home', 'editor', 'settings']) {
        if (screen === 'editor')
          await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
        if (screen === 'settings')
          await page.getByRole('button', { name: 'Open Settings' }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      }
      await page.getByRole('button', { name: 'Back to Home' }).click();
    }
  }
});

test('essential dialogs are accessible and close with Escape', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  for (const open of [/Add element in slot 1/, /Open routine catalogue/]) {
    await page.getByRole('button', { name: open }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await page.getByRole('button', { name: 'Open Settings' }).click();
  for (const name of ['Paste backup', 'Clear all local data']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  }
});

test('Pommel flop fixture and Russian location persist through reload', async ({ page }) => {
  const rules = JSON.parse(
    await readFile(
      new URL('../../../packages/rulesets/generated/fig-mag-2025-2028.json', import.meta.url),
      'utf8',
    ),
  ) as { elements: { id: string; name: string }[] };
  const nameOf = (id: string) => {
    const element = rules.elements.find((item) => item.id === id);
    if (element === undefined) throw new Error(`Missing fixture element ${id}`);
    return element.name;
  };
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Pommel Horse routine' }).click();
  await page.getByRole('button', { name: 'Add element in slot 1' }).click();
  await page.getByRole('tab', { name: 'Build a flop', exact: true }).click();
  for (const id of ['ph:mag-0033', 'ph:mag-0033', 'ph:mag-0031']) {
    const name = nameOf(id);
    await page.getByLabel('Search valid flop parts').fill(name);
    await page.getByRole('button', { name: `Add to flop: ${name}`, exact: true }).click();
  }
  await page.getByRole('button', { name: /Add .* to routine/ }).click();
  await expect(page.getByLabel('Search valid flop parts')).toBeHidden();
  await page
    .getByRole('button', { name: /Add element in slot/ })
    .first()
    .click();
  const dismount = nameOf('ph:mag-0100');
  await page.getByLabel('Search elements').fill(dismount);
  await page.getByRole('button', { name: `Add element: ${dismount}`, exact: true }).click();
  await expect(page.getByLabel('Search elements')).toBeHidden();
  await expect(page.getByText('1.5', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /Add element in slot/ })
    .first()
    .click();
  const russian = nameOf('ph:mag-0059');
  await page.getByLabel('Search elements').fill(russian);
  await page.getByRole('button', { name: `Add element: ${russian}`, exact: true }).click();
  await page.getByRole('radio', { name: 'Between the pommels', exact: true }).click();
  await page.getByRole('button', { name: 'Add element', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await waitForSaved(page);
  const before = await savedRecords(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByText('Between the pommels', { exact: true })).toBeVisible();
  expect((await savedRecords(page)).workbench).toEqual(before.workbench);
});

test('switches workspaces immediately after editing without dropping either workspace', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  await addElement(page);
  await page.getByRole('button', { name: 'Back to Home' }).click();
  await page.getByRole('button', { name: /New all-around/ }).click();
  await expect(page.getByText('Save these routines before switching?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: /New all-around/ }).click();
  await page.getByRole('button', { name: "Don't save", exact: true }).click();
  await waitForSaved(page);
  await page.reload();
  await expect(page.getByText('Untitled All-Around 2', { exact: true })).toBeVisible();
  const records = await savedRecords(page);
  const library = records.library as {
    items: { name: string; state: { routines: Record<string, unknown[]> } }[];
  };
  expect(
    library.items.find((item) => item.name === 'Untitled All-Around')?.state.routines[
      'floor-exercise'
    ],
  ).toHaveLength(1);
  expect(
    library.items.find((item) => item.name === 'Untitled All-Around 2')?.state.routines[
      'floor-exercise'
    ],
  ).toHaveLength(0);
});

test('every apparatus remains editable and the editor is accessible', async ({ page }) => {
  const issues = browserIssues(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Start a new Floor Exercise routine' }).click();
  for (const apparatus of [
    'Floor Exercise',
    'Pommel Horse',
    'Still Rings',
    'Parallel Bars',
    'Horizontal Bar',
  ]) {
    await page.getByRole('button', { name: `Select ${apparatus}`, exact: true }).click();
    await addElement(page, apparatus === 'Floor Exercise' ? 'Manna' : '');
    await expect(page.getByText('1/8', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Select Vault', exact: true }).click();
  await page.getByRole('button', { name: 'Choose a Vault', exact: true }).click();
  await page
    .getByRole('button', { name: /^Add element:/ })
    .first()
    .click();
  await expect(page.getByLabel('Search elements')).toBeHidden();
  await expect(page.getByText('1/1', { exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
  ).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  expect(issues).toEqual([]);
});
