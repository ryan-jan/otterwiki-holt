// The rich editor's promise that it never changes a page you didn't edit. Pages it can round trip
// open in rich mode with their Markdown untouched, and pages it can't open in Markdown mode.

import { fixture } from './support/wiki.mjs';
import { END, expect, markdown, openEditor, save, test } from './support/test.mjs';

const RICH = {
  'Roundtrip/Basics': 'roundtrip/basics.md',
  'Roundtrip/Tables': 'roundtrip/tables.md',
  'Roundtrip/Wiki-links': 'roundtrip/wiki-links.md',
  'Roundtrip/Otter-blocks': 'roundtrip/otter-blocks.md',
};

const MARKDOWN_ONLY = {
  'Fallback/Escaped-wiki-link': 'fallback/escaped-wiki-link.md',
};

// The rich editor writes back to CodeMirror shortly after a change.
const SYNC = 600;

// The page as Otter Wiki renders it, before any script such as MathJax changes it.
const rendered = (page, path) =>
  page.evaluate(async (url) => {
    const html = await (await fetch(url)).text();
    return new DOMParser().parseFromString(html, 'text/html').querySelector('.page').innerHTML;
  }, `/${path}`);

test.describe('@editor-roundtrip', () => {
  for (const [path, file] of Object.entries(RICH)) {
    test(`opens ${path} in rich mode without changing its Markdown`, async ({ page }) => {
      await openEditor(page, path);
      await expect(page.locator('body')).toHaveClass(/holt-rich-mode/);
      await page.waitForTimeout(SYNC);
      expect(await markdown(page)).toBe(fixture(file));
    });
  }

  for (const [path, file] of Object.entries(MARKDOWN_ONLY)) {
    test(`opens ${path} in Markdown mode and says why`, async ({ page }) => {
      await openEditor(page, path);
      await expect(page.locator('body')).not.toHaveClass(/holt-rich-mode/);
      await expect(page.locator('#holt-rich-btn')).toHaveAttribute('title', /can only be edited as Markdown/);
      expect(await markdown(page)).toBe(fixture(file));
    });
  }

  test('saving an untouched page leaves its Markdown unchanged', async ({ page, wiki }) => {
    const file = RICH['Roundtrip/Otter-blocks'];
    await openEditor(page, 'Roundtrip/Otter-blocks');
    await expect(page.locator('body')).toHaveClass(/holt-rich-mode/);
    await page.waitForTimeout(SYNC);
    await save(page);
    expect(wiki.read(file)).toBe(fixture(file));
  });

  // Once something changes, the rich editor writes out the whole page in its own style. However it
  // lays out the Markdown, the page must render exactly as before apart from the edit.
  for (const path of Object.keys(RICH)) {
    test(`an edit to ${path} changes nothing else in how it renders`, async ({ page }) => {
      await openEditor(page, path);
      const before = await rendered(page, path);

      await page.locator('.ProseMirror > p').first().click();
      await page.keyboard.press(END);
      await page.keyboard.type(' Edited.');
      await page.waitForTimeout(SYNC);
      await save(page);

      const after = await rendered(page, path);
      expect(after).toContain(' Edited.');
      const normalise = (html) => html.replace(' Edited.', '').replace(/>\s+</g, '><').replace(/\s+/g, ' ');
      expect(normalise(after)).toBe(normalise(before));
    });
  }
});
