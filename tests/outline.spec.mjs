import { PHONE, expect, test } from './support/test.mjs';

const outline = (page) => page.locator('.holt-toc');
const active = (page) => page.locator('.holt-toc .sidebar-link.sidebar-active');

test.describe('@outline', () => {
  test('only floats an outline when a page has more than one heading', async ({ page }) => {
    await page.goto('/Home');
    await expect(outline(page)).toHaveCount(0);
  });

  test('lines its first rung up with the page title', async ({ page }) => {
    await page.goto('/Outline');
    const [rung, title] = await page.evaluate(() => {
      const middle = (el) => {
        const box = el.getBoundingClientRect();
        return box.top + box.height / 2;
      };
      return [middle(document.querySelector('.holt-toc-rung')), middle(document.querySelector('.page h1'))];
    });
    expect(Math.abs(rung - title)).toBeLessThan(3);
  });

  // holt.js loads last, so long pages paint before it has moved the outline out of its column.
  test('hides the outline column before holt.js runs', async ({ page }) => {
    await page.route('**/holt.js*', (route) => route.abort());
    await page.goto('/Outline');
    await expect(page.locator('#column-extra')).toBeHidden();
  });

  test('opens into the full outline on hover', async ({ page }) => {
    await page.goto('/Outline');
    const link = page.locator('.holt-toc-panel a', { hasText: 'Fuse box' });
    await expect(link).toBeHidden();
    await outline(page).hover();
    await expect(link).toBeVisible();
  });

  test('highlights the section being read', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 400 });
    await page.goto('/Outline');
    await expect(active(page)).toHaveText('Outline');
    await page.locator('#content-wrapper').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(active(page)).toHaveText('Fuse box');
  });

  test('keeps a clicked section highlighted', async ({ page }) => {
    await page.goto('/Outline');
    await outline(page).hover();
    await page.locator('.holt-toc-panel a', { hasText: 'Gas' }).click();
    await expect(active(page)).toHaveText('Gas');
    await expect(page.locator('.holt-toc-rung-active')).toHaveCount(1);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE });

    test('keeps the outline in the sidebar and closes it after a pick', async ({ page }) => {
      await page.goto('/Outline');
      await expect(outline(page)).toBeHidden();
      await page.locator('#toggle-sidebar-btn').click();
      const wrapper = page.locator('#page-wrapper');
      await expect(wrapper).not.toHaveAttribute('data-sidebar-hidden', 'hidden');
      await page.locator('.sidebar a.sidebar-link', { hasText: 'Gas' }).click();
      await expect(wrapper).toHaveAttribute('data-sidebar-hidden', 'hidden');
    });
  });
});
