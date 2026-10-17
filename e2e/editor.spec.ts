import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const rich = (page: Page) => page.locator('.ProseMirror');
const json = (page: Page) => page.getByRole('textbox', { name: 'ADF JSON', exact: true });
const adf = (text: string) => JSON.stringify({ version: 1, type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });

async function draft(page: Page, text: string) {
  await json(page).fill(text);
}
async function apply(page: Page, text: string) {
  await draft(page, text);
  await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
}
async function saved(page: Page) {
  await expect(page.getByTestId('save-status')).toContainText('Saved locally');
}

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = []; runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(rich(page)).toBeVisible();
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });

test('JSON drafts apply explicitly, reject invalid content, and survive rich text edits', async ({ page }) => {
  await rich(page).fill('Original rich text');
  await draft(page, adf('New draft'));
  await expect(rich(page)).toHaveText('Original rich text');
  await rich(page).press('End'); await rich(page).pressSequentially(' plus edit');
  await expect(json(page)).toContainText('New draft');
  await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
  await expect(rich(page)).toHaveText('New draft');
  await draft(page, '{');
  await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
  await expect(page.locator('#json-feedback')).toContainText('Invalid JSON');
  await expect(rich(page)).toHaveText('New draft');
  await apply(page, '{"version":1,"type":"doc","content":[{"type":"unsupportedThing"}]}');
  await expect(page.locator('#json-feedback')).toContainText('Unknown node type');
  await expect(rich(page)).toHaveText('New draft');
  await page.getByRole('button', { name: 'Discard JSON changes' }).click();
  await expect(json(page)).toContainText('New draft');
  await expect(page.getByRole('button', { name: 'Apply JSON', exact: true })).toBeDisabled();
});

test('example supports rich nodes, task interaction, JSON sync, and reload', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
  await expect(rich(page).locator('table')).toBeVisible();
  await expect(rich(page).locator('strong').filter({ hasText: 'Bold text' })).toBeVisible();
  await expect(rich(page).getByRole('img', { name: 'Emoji :rocket:', exact: true })).toBeVisible();
  await expect(rich(page)).toContainText('@Rohan Dhamapurkar');
  const checkbox = rich(page).getByRole('checkbox').first();
  await checkbox.check();
  await page.getByRole('button', { name: 'Copy ADF' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('DONE');
  await saved(page); await page.reload();
  await expect(rich(page).locator('table')).toBeVisible();
  await expect(rich(page).getByRole('checkbox').first()).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('editor-workspace.png') });
});

test('import, format, keyboard apply, export, and clipboard use the applied document', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByLabel('Import ADF file').setInputFiles({ name: 'example.json', mimeType: 'application/json', buffer: Buffer.from(adf('Imported document')) });
  await expect(json(page)).toContainText('Imported document');
  await expect(rich(page)).not.toContainText('Imported document');
  await page.getByRole('button', { name: 'Format JSON' }).click();
  await json(page).press('ControlOrMeta+Enter');
  await expect(rich(page)).toHaveText('Imported document');
  await page.getByRole('button', { name: 'Copy ADF' }).click();
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).content[0].content[0].text).toBe('Imported document');
  await draft(page, adf('Not yet applied'));
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export ADF' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('document.adf.json');
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.content[0].content[0].text).toBe('Imported document');
});

test('local history restores a cleared document and draft recovers independently', async ({ page }) => {
  await apply(page, adf('Keep this version'));
  await draft(page, '{ incomplete draft');
  await saved(page); await page.reload();
  await expect(rich(page)).toHaveText('Keep this version');
  await expect(json(page)).toContainText('incomplete draft');
  await page.getByRole('button', { name: 'Clear document', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(rich(page)).toHaveText('Keep this version');
  await page.getByRole('button', { name: 'Clear document', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(rich(page)).not.toContainText('Keep this version');
  await page.getByText(/Local history \(/).click();
  await page.locator('.history-list li').filter({ hasText: 'Before Clear document' }).getByRole('button', { name: 'Restore' }).click();
  await expect(rich(page)).toHaveText('Keep this version');
  await saved(page); await page.reload();
  await expect(rich(page)).toHaveText('Keep this version');
});

test('markdown formatting, undo, redo, and help still work', async ({ page }) => {
  await rich(page).click(); await page.keyboard.type('**Bold shortcut** ');
  await expect(rich(page).locator('strong')).toHaveText('Bold shortcut');
  await expect(json(page)).toContainText('strong');
  await apply(page, adf('History base'));
  await rich(page).press('ControlOrMeta+End'); await page.keyboard.type(' plus');
  await expect(rich(page)).toHaveText('History base plus');
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(rich(page)).not.toContainText('plus');
  await page.getByRole('button', { name: /^Redo/ }).click();
  await expect(rich(page)).toHaveText('History base plus');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Editor help', exact: true })).toBeVisible();
});

test('storage write failures are visible and editing remains usable', async ({ page }) => {
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    let fail = true;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (fail) { fail = false; throw new DOMException('Full', 'QuotaExceededError'); }
      return put.apply(this, args);
    };
  });
  await rich(page).fill('Still editable');
  await expect(page.getByRole('alert')).toContainText('Could not save locally');
  await expect(rich(page)).toHaveText('Still editable');
  await expect(page.getByRole('button', { name: 'Export ADF' })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry save' }).click();
  await saved(page); await expect(page.getByRole('alert')).toHaveCount(0);
});

test('storage read failure preserves the saved workspace', async ({ page }) => {
  await apply(page, adf('Previously saved'));
  await saved(page);
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let fail = true;
    IDBFactory.prototype.open = function (...args: Parameters<typeof open>) {
      if (fail) { fail = false; throw new DOMException('Unavailable', 'SecurityError'); }
      return open.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Existing saved data has been left untouched');
  await expect(rich(page)).toBeVisible(); await rich(page).fill('Unsaved temporary change');
  await expect(page.getByTestId('save-status')).toContainText('Local saving unavailable');
  const savedDocument = await page.evaluate(async () => new Promise<string>((resolve, reject) => {
    const request = indexedDB.open('adf-editor-state', 1);
    request.onsuccess = () => {
      const db = request.result; const tx = db.transaction('editorState', 'readonly');
      const get = tx.objectStore('editorState').get('latest-adf');
      tx.oncomplete = () => { db.close(); resolve(get.result); }; tx.onerror = () => reject(tx.error);
    };
  }));
  expect(savedDocument).toContain('Previously saved');
});

test('replacing an unapplied draft requires confirmation', async ({ page }) => {
  await draft(page, adf('Keep my draft'));
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(json(page)).toContainText('Keep my draft');
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(json(page)).toContainText('Standalone comment features');
});

test('emoji autoformat inserts a local emoji', async ({ page }) => {
  await rich(page).click(); await page.keyboard.type(':rocket: ');
  await expect(rich(page).getByRole('img', { name: 'Emoji :rocket:', exact: true })).toBeVisible();
  await expect(json(page)).toContainText('emoji');
});

test('find and replace opens one popup from the toolbar and keyboard', async ({ page }, testInfo) => {
  await apply(page, adf('apple apple pear'));
  await page.getByRole('button', { name: /^Find and replace/ }).click();
  await expect(page.getByTestId('find-field')).toHaveCount(1);
  await page.getByTestId('find-field').fill('apple');
  await page.getByTestId('replace-field').fill('orange');
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  await expect(rich(page)).toHaveText('orange orange pear');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('find-field')).toHaveCount(0);
  await rich(page).click(); await page.keyboard.press('ControlOrMeta+f');
  await expect(page.getByTestId('find-field')).toHaveCount(1);
  await page.getByTestId('find-field').fill('pear');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('find-field')).toHaveCount(0);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.getByRole('button', { name: /^Find and replace/ }).click();
  await expect(page.getByTestId('find-field')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('single-find-popup.png') });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('find-field')).toHaveCount(0);
});

test('legacy IndexedDB document migrates without losing content', async ({ page }) => {
  const legacy = adf('Legacy saved document');
  await page.evaluate(async value => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('adf-editor-state', 1);
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction('editorState', 'readwrite');
        tx.objectStore('editorState').delete('workspace-v2'); tx.objectStore('editorState').put(value, 'latest-adf');
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  }, legacy);
  await page.reload();
  await expect(rich(page)).toHaveText('Legacy saved document');
  await expect(json(page)).toContainText('Legacy saved document');
});

test('document tools load while the large rich editor chunk is delayed', async ({ page }) => {
  const manifest = JSON.parse(await readFile(resolve('build/.vite/manifest.json'), 'utf8'));
  const editorChunk = manifest['src/components/RichEditor.tsx'].file;
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/${editorChunk}`, async route => { await wait; await route.continue(); });
  await page.goto('/');
  try {
    await expect(page.getByRole('button', { name: 'Import JSON' })).toBeEnabled();
    await expect(json(page)).toBeVisible();
    await expect(page.getByText('Loading rich text editor… Your document tools are ready.')).toBeVisible();
  } finally { release(); }
  await expect(rich(page)).toBeVisible();
});
