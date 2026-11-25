import { expect, test } from './support/test.mjs';

const dialog = (page) => page.locator('.holt-search-dialog');
const input = (page) => page.locator('.holt-search-dialog #search-query');
const result = (page, text) => page.locator('.holt-search-item', { hasText: text });
const group = (page, label) => page.locator('.holt-search-group', { hasText: label });

async function search(page, query) {
  await page.goto('/Home');
  await page.locator('.holt-search-button').click();
  await input(page).fill(query);
}

test.describe('@search', () => {
  test('turns the search box into a button', async ({ page }) => {
    await page.goto('/Home');
    await expect(page.locator('.holt-search-button')).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await page.locator('.holt-search-button').click();
    await expect(dialog(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
  });

  for (const key of ['/', 'ControlOrMeta+k']) {
    test(`opens with ${key}`, async ({ page }) => {
      await page.goto('/Home');
      await page.keyboard.press(key);
      await expect(dialog(page)).toBeVisible();
      await expect(input(page)).toBeFocused();
    });
  }

  test('closes with Escape and returns focus', async ({ page }) => {
    await page.goto('/Home');
    await page.locator('.holt-search-button').focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(page.locator('.holt-search-button')).toBeFocused();
  });

  test('closes on a click outside the dialog', async ({ page }) => {
    await page.goto('/Home');
    await page.keyboard.press('/');
    await page.mouse.click(10, 400);
    await expect(dialog(page)).toBeHidden();
  });

  test('ignores / while typing in a field', async ({ page }) => {
    await page.goto('/-/create');
    const field = page.locator('#column-main input[type="text"]').first();
    await field.click();
    await page.keyboard.type('a/b');
    await expect(field).toHaveValue('a/b');
    await expect(dialog(page)).toBeHidden();
  });

  test('finds pages by name as you type', async ({ page }) => {
    await search(page, 'outl');
    await expect(group(page, 'Pages')).toBeVisible();
    await expect(result(page, 'Outline').first()).toHaveAttribute('href', '/Outline');
  });

  test('finds pages by folder', async ({ page }) => {
    await search(page, 'roundtrip');
    for (const name of ['Basics', 'Tables']) await expect(result(page, name).first()).toBeVisible();
  });

  test('finds headings as sections', async ({ page }) => {
    await search(page, 'meters');
    await expect(group(page, 'Sections')).toBeVisible();
    await expect(result(page, 'Meters').first()).toHaveAttribute('href', /\/Outline#meters$/);
  });

  test('finds matches in page text', async ({ page }) => {
    await search(page, 'consumer unit');
    await expect(group(page, 'In page text')).toBeVisible();
    await expect(result(page, 'Outline').first()).toContainText('consumer unit');
  });

  test('moves through results with the arrow keys and opens one with Enter', async ({ page }) => {
    await search(page, 'roundtrip');
    const items = page.locator('.holt-search-item');
    await expect(items.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toHaveAttribute('aria-selected', 'true');
    const href = await items.nth(1).getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('ends with a row that opens the full search', async ({ page }) => {
    await search(page, 'boiler');
    const all = page.locator('.holt-search-item').last();
    await expect(all).toHaveText('Search all pages for “boiler”');
    await all.click();
    await expect(page).toHaveURL(/\/-\/search/);
    await expect(page.locator('#column-main')).toContainText('Outline');
  });
});
