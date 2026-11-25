import { PHONE, expect, test } from './support/test.mjs';

const menu = (page) => page.locator('.holt-pagebar .dropdown-menu');
const fullWidth = (page) => page.locator('.holt-full-width-toggle');

test.describe('@page-bar', () => {
  test('puts Edit and the page menu beside the breadcrumbs', async ({ page }) => {
    await page.goto('/Home');
    const bar = page.locator('.holt-pagebar');
    await expect(bar.locator('nav[aria-label="Breadcrumbs"]')).toBeVisible();
    await expect(bar.locator('#edit-page-btn')).toBeVisible();
    await page.locator('#holt-page-menu-btn').click();
    await expect(menu(page)).toBeVisible();
    for (const item of ['Attachments', 'History', 'Blame', 'Rename', 'Delete', 'Full width']) {
      await expect(menu(page)).toContainText(item);
    }
  });

  test('leaves the page tools out of the site menu', async ({ page }) => {
    await page.goto('/Home');
    const siteMenu = page.locator('.navbar .dropdown-menu');
    await expect(siteMenu.locator('a[href$="/attachments"]')).toHaveCount(0);
    await expect(page.locator('.navbar #edit-page-btn')).toHaveCount(0);
  });

  test('still opens the editor with e', async ({ page }) => {
    await page.goto('/Home');
    await page.keyboard.press('e');
    await expect(page).toHaveURL(/\/Home(\/edit|\?edit)$/);
  });

  test('switches a page to full width and remembers it', async ({ page }) => {
    await page.goto('/Home');
    await page.locator('#holt-page-menu-btn').click();
    const before = await page.locator('#column-main > .content').evaluate((el) => el.offsetWidth);
    await fullWidth(page).click();
    await expect(page.locator('body')).toHaveClass(/holt-full-width/);
    await expect(fullWidth(page)).toHaveAttribute('aria-checked', 'true');
    // The menu stays open so the switch can be seen to change.
    await expect(menu(page)).toBeVisible();
    const after = await page.locator('#column-main > .content').evaluate((el) => el.offsetWidth);
    expect(after).toBeGreaterThan(before);

    await page.reload();
    await expect(page.locator('body')).toHaveClass(/holt-full-width/);
    await page.goto('/Outline');
    await expect(page.locator('body')).not.toHaveClass(/holt-full-width/);
  });

  test('switches full width back off', async ({ page }) => {
    await page.goto('/Home');
    await page.locator('#holt-page-menu-btn').click();
    await fullWidth(page).click();
    await fullWidth(page).click();
    await expect(page.locator('body')).not.toHaveClass(/holt-full-width/);
    await page.reload();
    await expect(page.locator('body')).not.toHaveClass(/holt-full-width/);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE });

    test('hides the full width switch, since the page is already full width', async ({ page }) => {
      await page.goto('/Home');
      await page.locator('#holt-page-menu-btn').click();
      await expect(menu(page)).toContainText('History');
      await expect(fullWidth(page)).toBeHidden();
    });
  });
});
