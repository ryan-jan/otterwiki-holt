import { END, expect, markdown, markdownWhen, openRichEditor, placeCursor, test } from './support/test.mjs';

const prose = (page) => page.locator('.ProseMirror');
const slashMenu = (page) => page.locator('.milkdown-slash-menu');
const handle = (page, n) => page.locator('.milkdown-block-handle .operation-item').nth(n);

// A new empty paragraph after the page's first paragraph, with the cursor in it.
async function newParagraph(page) {
  await prose(page).locator('> p').first().click();
  await page.keyboard.press(END);
  await page.keyboard.press('Enter');
}

async function hoverBlock(page, locator) {
  await locator.hover();
  await expect(page.locator('.milkdown-block-handle')).toBeVisible();
}

test.describe('@editor-blocks', () => {
  test('opens the / menu and filters it as you type', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await newParagraph(page);
    await page.keyboard.type('/');
    await expect(slashMenu(page)).toHaveAttribute('data-show', 'true');
    await page.keyboard.type('heading 2');
    await expect(slashMenu(page).locator('li[data-index]')).toHaveText(['Heading 2']);
    await page.keyboard.press('Enter');
    await page.keyboard.type('From the menu');
    await markdownWhen(page, (md) => md.includes('## From the menu'));
  });

  test('lists Otter Wiki blocks in the / menu', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await newParagraph(page);
    await page.keyboard.type('/');
    for (const item of ['Emoji', 'Wiki link', 'Attachment', 'Info box', 'Alert', 'Spoiler', 'Folded section', 'Maths']) {
      await expect(slashMenu(page).locator('li[data-index]', { hasText: item })).toHaveCount(1);
    }
  });

  test('explains the + handle in a tooltip', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await hoverBlock(page, prose(page).locator('> p').first());
    await handle(page, 0).hover();
    await expect(page.locator('.holt-block-tooltip')).toHaveText(/Click to add below.*-click to add above/s);
  });

  test('adds a block below with + and opens the / menu on it', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    const first = prose(page).locator('> p').first();
    await hoverBlock(page, first);
    await handle(page, 0).click();
    await expect(prose(page).locator('> p').nth(1)).toHaveText('/');
    await expect(slashMenu(page)).toHaveAttribute('data-show', 'true');
  });

  test('adds a block above with Option-click or Alt-click on +', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    const lists = prose(page).locator('> h2', { hasText: 'Lists' });
    await hoverBlock(page, lists);
    await handle(page, 0).click({ modifiers: ['Alt'] });
    await expect(lists.locator('xpath=preceding-sibling::*[1]')).toHaveText('/');
  });

  test('turns a block into another kind from the ⋮⋮ menu', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await hoverBlock(page, prose(page).locator('> p').first());
    await handle(page, 1).click();
    await expect(page.locator('.holt-block-menu-item[aria-current="true"]')).toHaveText('Text');
    await page.locator('.holt-block-menu-item', { hasText: 'Heading 2' }).click();
    await markdownWhen(page, (md) => md.includes('## A paragraph with'));
  });

  test('duplicates and deletes a block from the ⋮⋮ menu', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    const code = prose(page).locator('> h2', { hasText: 'Code' });
    await hoverBlock(page, code);
    await handle(page, 1).click();
    await page.locator('.holt-block-menu-item', { hasText: 'Duplicate' }).click();
    await markdownWhen(page, (md) => md.match(/## Code/g)?.length === 2);

    await hoverBlock(page, code.first());
    await handle(page, 1).click();
    await page.locator('.holt-block-menu-item', { hasText: 'Delete' }).click();
    await markdownWhen(page, (md) => md.match(/## Code/g)?.length === 1);
  });

  test('closes the ⋮⋮ menu with Escape', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await hoverBlock(page, prose(page).locator('> p').first());
    await handle(page, 1).click();
    await expect(page.locator('.holt-block-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.holt-block-menu')).toHaveCount(0);
  });

  test('moves blocks with the keyboard', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await placeCursor(prose(page).locator('> h2', { hasText: 'Code' }));
    await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
    let md = await markdownWhen(page, (text) => text.indexOf('## Code') < text.indexOf('---'));
    await page.keyboard.press('ControlOrMeta+Shift+ArrowDown');
    md = await markdownWhen(page, (text) => text.indexOf('## Code') > text.indexOf('---'));
    expect(md).toContain('## Code');
  });

  test('moves list items within their list', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await placeCursor(prose(page).locator('li', { hasText: 'Three' }));
    await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
    await markdownWhen(page, (md) => md.indexOf('Three') < md.indexOf('Two'));
  });

  test('duplicates a block with the keyboard and moves into the copy', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await placeCursor(prose(page).locator('> h2', { hasText: 'Lists' }));
    await page.keyboard.press(END);
    await page.keyboard.press('ControlOrMeta+d');
    await page.keyboard.type(' again');
    const md = await markdownWhen(page, (text) => text.includes('## Lists again'));
    expect(md).toContain('## Lists\n');
  });

  test('links a page with [[', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await newParagraph(page);
    await page.keyboard.type('See [[Outl');
    const picker = page.locator('.holt-page-link');
    await expect(picker.locator('.holt-page-link-option').first()).toContainText('Outline');
    await page.keyboard.press('Enter');
    await expect(picker).toHaveCount(0);
    await markdownWhen(page, (md) => md.includes('See [[Outline]]'));
  });

  test('offers to link a page that doesn\'t exist yet', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await newParagraph(page);
    await page.keyboard.type('[[Garden shed');
    await page.locator('.holt-page-link-option', { hasText: 'Link to “Garden shed”' }).click();
    await markdownWhen(page, (md) => md.includes('[[Garden shed]]'));
  });

  test('leaves [[ as typed after Escape', async ({ page }) => {
    await openRichEditor(page, 'Roundtrip/Basics');
    await newParagraph(page);
    await page.keyboard.type('[[Outl');
    await page.keyboard.press('Escape');
    await expect(page.locator('.holt-page-link')).toHaveCount(0);
    await expect(prose(page)).toContainText('[[Outl');
  });

  test.describe('attachments', () => {
    async function openPicker(page) {
      await openRichEditor(page, 'Files');
      await newParagraph(page);
      await page.keyboard.type('/attach');
      await expect(slashMenu(page).locator('li[data-index]')).toHaveText(['Attachment']);
      await page.keyboard.press('Enter');
      await expect(page.locator('.otter-dialog')).toBeVisible();
    }

    test('lists the page\'s attachments, with thumbnails for images', async ({ page }) => {
      await openPicker(page);
      const items = page.locator('.otter-attachment');
      await expect(items).toHaveText(['notes.txt', 'photo.png'].map((name) => new RegExp(name)));
      await expect(items.filter({ hasText: 'photo.png' }).locator('img')).toHaveCount(1);
    });

    test('inserts an image attachment as an image', async ({ page }) => {
      await openPicker(page);
      await page.locator('.otter-attachment', { hasText: 'photo.png' }).click();
      await markdownWhen(page, (md) => md.includes('![photo.png](./photo.png)'));
      await expect(prose(page).locator('img[src="./photo.png"]')).toBeVisible();
    });

    test('inserts any other attachment as a link', async ({ page }) => {
      await openPicker(page);
      await page.locator('.otter-attachment', { hasText: 'notes.txt' }).click();
      await markdownWhen(page, (md) => md.includes('[notes.txt](./notes.txt)'));
    });

    test('uploads a new attachment', async ({ page, wiki }) => {
      await openPicker(page);
      page.on('dialog', (dialog) => dialog.accept('recipe.txt'));
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('.otter-dialog button', { hasText: 'Upload a file' }).click(),
      ]);
      await chooser.setFiles({ name: 'upload.txt', mimeType: 'text/plain', buffer: Buffer.from('Flour.\n') });
      await markdownWhen(page, (md) => md.includes('[recipe.txt](./recipe.txt)'));
      expect(wiki.read('files/recipe.txt')).toBe('Flour.\n');
      expect(await markdown(page)).toContain('A page with attachments.');
    });
  });
});
