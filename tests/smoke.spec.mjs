// Quick checks that each part of Holt is there at all. The feature suites check how each behaves.

import { expect, openEditor, test } from './support/test.mjs';

test.describe('@theme', () => {
  test('loads its stylesheet and script on a page', async ({ page }) => {
    await page.goto('/Home');
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--holt-accent-dark').trim(),
    );
    expect(accent).not.toBe('');
    await expect(page.locator('#holt-page-menu-btn')).toBeVisible();
  });
});

test.describe('@search', () => {
  test('opens the search dialog with / and finds a page', async ({ page }) => {
    await page.goto('/Home');
    await page.keyboard.press('/');
    await expect(page.locator('.holt-search-dialog')).toBeVisible();
    await page.keyboard.type('outl');
    await expect(page.locator('.holt-search-item', { hasText: 'Outline' }).first()).toBeVisible();
  });
});

test.describe('@outline', () => {
  test('floats the outline at the right edge on wide screens', async ({ page }) => {
    await page.goto('/Outline');
    const outline = page.locator('.holt-toc');
    await expect(outline).toBeVisible();
    await expect(outline.locator('a.sidebar-link')).toHaveText([
      'Outline', 'Boiler', 'Meters', 'Electricity', 'Gas', 'Fuse box',
    ]);
  });
});

test.describe('@editor', () => {
  test('opens edit pages in rich mode', async ({ page }) => {
    await openEditor(page, 'Home');
    await expect(page.locator('body')).toHaveClass(/holt-rich-mode/);
    await expect(page.locator('#holt-rich-editor .ProseMirror')).toBeVisible();
    await expect(page.locator('#holt-rich-btn')).toHaveAttribute('title', 'Edit as Markdown');
  });
});
