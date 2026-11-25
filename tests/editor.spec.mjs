import { END, expect, markdownWhen, openEditor, openRichEditor, test } from './support/test.mjs';

const toggle = (page) => page.locator('#holt-rich-btn');
const codeMirror = (page) => page.locator('#editor_block > .cm-editor');

test.describe('@editor', () => {
  test('opens in rich mode and hides what only Markdown mode needs', async ({ page }) => {
    await openRichEditor(page, 'Home');
    await expect(page.locator('#holt-rich-editor .ProseMirror')).toBeVisible();
    await expect(codeMirror(page)).toBeHidden();
    for (const button of ['#preview_btn', '#editor_btn', '#split_btn']) {
      await expect(page.locator(button)).toBeHidden();
    }
    await expect(page.locator('#column-extra')).toBeHidden();
  });

  test('switches to Markdown mode and remembers it', async ({ page }) => {
    await openRichEditor(page, 'Home');
    await toggle(page).click();
    await expect(page.locator('body')).not.toHaveClass(/holt-rich-mode/);
    await expect(codeMirror(page)).toBeVisible();
    await expect(page.locator('#preview_btn')).toBeVisible();
    await expect(page.locator('#extranav-attachments')).toBeVisible();
    await expect(toggle(page)).toHaveAttribute('title', 'Edit as rich text');

    await page.reload();
    await expect(page.locator('body')).toHaveClass(/holt-editor-settled/);
    await expect(page.locator('body')).not.toHaveClass(/holt-rich-mode/);

    await toggle(page).click();
    await expect(page.locator('body')).toHaveClass(/holt-rich-mode/);
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/holt-rich-mode/);
  });

  test('carries edits between the two modes', async ({ page }) => {
    await openRichEditor(page, 'Home');
    await page.locator('.ProseMirror > p').first().click();
    await page.keyboard.press(END);
    await page.keyboard.type(' From rich mode.');
    await markdownWhen(page, (md) => md.includes('From rich mode.'));

    await toggle(page).click();
    await expect(codeMirror(page)).toContainText('From rich mode.');
    await page.evaluate(() => {
      const view = window.cm_editor;
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\nFrom Markdown mode.\n' } });
    });
    await toggle(page).click();
    await expect(page.locator('.ProseMirror')).toContainText('From Markdown mode.');
  });

  test('blocks the preview shortcut in rich mode', async ({ page }) => {
    await openRichEditor(page, 'Home');
    await page.locator('.ProseMirror > p').first().click();
    await page.keyboard.press('ControlOrMeta+p');
    await expect(page.locator('#holt-rich-editor .ProseMirror')).toBeVisible();
    await expect(page.locator('#preview_block')).toBeHidden();
  });

  test('shows a spinner until the editor has loaded', async ({ page }) => {
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route('**/holt-editor.js*', async (route) => {
      await held;
      await route.continue();
    });
    // The load event waits for the held script, so don't wait for it.
    await page.goto('/Home/edit', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toHaveClass(/holt-editor-settled/);
    await expect(codeMirror(page)).toBeHidden();
    release();
    await expect(page.locator('body')).toHaveClass(/holt-rich-mode/);
  });

  test('falls back to Markdown mode if the editor fails to load', async ({ page }) => {
    await page.route('**/holt-editor.js*', (route) => route.abort());
    await openEditor(page, 'Home');
    await expect(page.locator('body')).not.toHaveClass(/holt-rich-mode/);
    await expect(codeMirror(page)).toBeVisible();
  });

  test('stays out of the way with data-editor="off"', async ({ page }) => {
    await page.route('**/Home/edit', async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('holt.js"></script>', 'holt.js" data-editor="off"></script>');
      await route.fulfill({ response, body });
    });
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    await openEditor(page, 'Home');
    await expect(codeMirror(page)).toBeVisible();
    await expect(toggle(page)).toHaveCount(0);
    expect(requests.filter((url) => url.includes('holt-editor'))).toEqual([]);
  });

  test('floats the outline and keeps it up to date', async ({ page }) => {
    await openRichEditor(page, 'Outline');
    const links = page.locator('.holt-toc a.sidebar-link');
    await expect(links).toHaveText(['Outline', 'Boiler', 'Meters', 'Electricity', 'Gas', 'Fuse box']);
    await page.locator('.ProseMirror > p').last().click();
    await page.keyboard.press(END);
    await page.keyboard.press('Enter');
    await page.keyboard.type('## Water');
    await expect(links.last()).toHaveText('Water');
  });
});
