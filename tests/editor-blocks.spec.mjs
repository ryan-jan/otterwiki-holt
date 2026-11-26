import { END, expect, markdown, markdownWhen, openRichEditor, PHONE, placeCursor, test } from './support/test.mjs';

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
    for (const item of ['Emoji', 'Wiki link', 'Attachment', 'Spoiler', 'Folded section', 'Maths', 'Info box', 'Danger box', 'Note alert', 'Caution alert']) {
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

  // A touch screen has no hover, so the handle follows the cursor instead.
  test.describe('on a touch screen', () => {
    test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

    test('shows the ⋮⋮ beside the block you tap, inside the screen, until you type', async ({ page }) => {
      await openRichEditor(page, 'Roundtrip/Basics');
      const block = page.locator('.milkdown-block-handle');
      await prose(page).locator('> h2', { hasText: 'Lists' }).tap();
      await expect(block).toHaveAttribute('data-show', 'true');
      await expect(handle(page, 0)).toBeHidden();
      const box = await handle(page, 1).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      await page.keyboard.type('x');
      await expect(block).toHaveAttribute('data-show', 'false');
    });

    test('adds and moves blocks from the ⋮⋮ menu', async ({ page }) => {
      await openRichEditor(page, 'Roundtrip/Basics');
      await prose(page).locator('li', { hasText: 'Three' }).tap();
      await handle(page, 1).tap();
      await page.locator('.holt-block-menu-item', { hasText: 'Move up' }).tap();
      await markdownWhen(page, (md) => md.indexOf('Three') < md.indexOf('Two'));
      await expect(page.locator('.milkdown-block-handle')).toHaveAttribute('data-show', 'true');

      await handle(page, 1).tap();
      await page.locator('.holt-block-menu-item', { hasText: 'Add below' }).tap();
      await markdownWhen(page, (md) => /Three\n\d\. *\n/.test(md));

      await prose(page).locator('> p').first().tap();
      await handle(page, 1).tap();
      await page.locator('.holt-block-menu-item', { hasText: 'Add below' }).tap();
      await expect(slashMenu(page)).toHaveAttribute('data-show', 'true');
    });
  });

  test.describe('Otter Wiki blocks', () => {
    async function insert(page, item) {
      await openRichEditor(page, 'Roundtrip/Basics');
      await newParagraph(page);
      await page.keyboard.type(`/${item}`);
      await expect(slashMenu(page).locator('li[data-index]').first()).toHaveText(new RegExp(item, 'i'));
      await page.keyboard.press('Enter');
    }

    test('inserts an info box and edits its content as text', async ({ page }) => {
      await insert(page, 'Info box');
      await page.keyboard.type('Check the boiler ');
      await page.keyboard.press('ControlOrMeta+b');
      await page.keyboard.type('first');
      await markdownWhen(page, (md) => md.includes('::: info\nCheck the boiler **first**\n:::'));
    });

    test('adds a heading to an info box above its content', async ({ page }) => {
      await insert(page, 'Info box');
      await page.keyboard.type('Text');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.type('Heads up');
      await markdownWhen(page, (md) => md.includes('::: info\n# Heads up\nText\n:::'));
    });

    test('inserts each type of alert straight from the / menu', async ({ page }) => {
      await insert(page, 'Caution');
      await page.keyboard.type('Hot surface.');
      await markdownWhen(page, (md) => md.includes('> [!CAUTION]\n> Hot surface.'));
    });

    test('offers a warning as either an info box or an alert', async ({ page }) => {
      await openRichEditor(page, 'Roundtrip/Basics');
      await newParagraph(page);
      await page.keyboard.type('/warning');
      await expect(slashMenu(page).locator('li[data-index]')).toHaveText(['Warning box', 'Warning alert']);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Wet paint.');
      await markdownWhen(page, (md) => md.includes('> [!WARNING]\n> Wet paint.'));
    });

    test('changes the type of an info box', async ({ page }) => {
      await openRichEditor(page, 'Roundtrip/Otter-blocks');
      await prose(page).locator('.otter-fancy').hover();
      await prose(page).locator('.otter-fancy .otter-block-type').selectOption('warning');
      await expect(prose(page).locator('.otter-fancy')).toHaveClass(/alert-secondary/);
      await markdownWhen(page, (md) => md.includes('::: warning\n# Tip\nInfo boxes have an optional heading.\n:::'));
    });

    test('inserts an alert and changes its type', async ({ page }) => {
      await insert(page, 'Alert');
      await page.keyboard.type('Mind the step.');
      await prose(page).locator('.otter-alert .otter-block-type').last().selectOption('TIP');
      await markdownWhen(page, (md) => md.includes('> [!TIP]\n> Mind the step.'));
    });

    test('inserts a folded section, summary first', async ({ page }) => {
      await insert(page, 'Folded section');
      await page.keyboard.type('Spare keys');
      await page.keyboard.press('Enter');
      await page.keyboard.type('In the blue tin.');
      await markdownWhen(page, (md) => md.includes('>| # Spare keys\n>| In the blue tin.'));
    });

    test('folds and unfolds a folded section while editing', async ({ page }) => {
      await openRichEditor(page, 'Roundtrip/Otter-blocks');
      const fold = prose(page).locator('.otter-fold');
      await fold.locator('.otter-fold-toggle').click();
      await expect(fold.locator('p', { hasText: 'With hidden details.' })).toBeHidden();
      await fold.locator('.otter-fold-toggle').click();
      await expect(fold.locator('p', { hasText: 'With hidden details.' })).toBeVisible();
    });

    test('inserts a spoiler', async ({ page }) => {
      await insert(page, 'Spoiler');
      await page.keyboard.type('The butler did it.');
      await markdownWhen(page, (md) => md.includes('>! The butler did it.'));
    });

    test('leaves a block with Enter on an empty last line', async ({ page }) => {
      await insert(page, 'Alert');
      await page.keyboard.type('Inside.');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Outside.');
      await markdownWhen(page, (md) => md.includes('> [!NOTE]\n> Inside.\n\nOutside.'));
    });

    for (const item of ['Spoiler', 'Alert', 'Info box']) {
      test(`turns an empty ${item.toLowerCase()} back into text with Backspace`, async ({ page }) => {
        await insert(page, item);
        await expect(prose(page).locator('.otter-block')).toHaveCount(1);
        if (item === 'Info box') await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await expect(prose(page).locator('.otter-block')).toHaveCount(0);
        await page.keyboard.type('Text again');
        await expect(prose(page).locator('> p', { hasText: 'Text again' })).toHaveCount(1);
      });
    }

    test('keeps a block it can\'t edit as text as a raw block', async ({ page }) => {
      await openRichEditor(page, 'Roundtrip/Otter-blocks-nested');
      await expect(prose(page).locator('.otter-raw')).toHaveCount(2);
      await expect(prose(page).locator('.otter-raw', { hasText: 'A heading inside an info box' })).toHaveCount(1);
      await expect(prose(page).locator('.otter-fold .otter-alert')).toHaveCount(1);
    });

    // The cursor is one element Crepe positions over the page, so a positioned block can hide it.
    test('shows the cursor inside blocks', async ({ page }) => {
      const cursorShows = () =>
        page.evaluate(() => {
          const cursor = document.querySelector('.prosemirror-virtual-cursor');
          if (!cursor) return false;
          cursor.style.pointerEvents = 'auto';
          const box = cursor.getBoundingClientRect();
          const shown = document.elementFromPoint(box.left + 1.5, box.top + box.height / 2) === cursor;
          cursor.style.pointerEvents = '';
          return shown;
        });
      await openRichEditor(page, 'Roundtrip/Otter-blocks-nested');
      for (const selector of ['.otter-spoiler .otter-block-content', '.otter-alert p', '.otter-fancy p', '.otter-fold p']) {
        // Clicks in quick succession would count as a double-click and select a word.
        await page.waitForTimeout(600);
        await placeCursor(prose(page).locator(selector).first());
        await expect.poll(cursorShows, selector).toBe(true);
      }
    });

    test('refuses to save a heading inside an info box', async ({ page }) => {
      await insert(page, 'Info box');
      await page.keyboard.type('## Not a heading');
      await page.locator('#save-page-btn').click();
      await expect(page.locator('.sticky-alerts')).toContainText('Info boxes can’t hold headings');
    });
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
