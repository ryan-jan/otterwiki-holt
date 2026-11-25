import { PHONE, column, expect, test } from './support/test.mjs';

// Nothing wider than the window, so the page never scrolls sideways.
const overflow = (page) =>
  page.evaluate(() => {
    const content = document.getElementById('content-wrapper');
    return Math.max(content.scrollWidth - content.clientWidth, document.documentElement.scrollWidth - innerWidth);
  });

const luminance = (page, selector, property) =>
  page.evaluate(
    ([selector, property]) => {
      const [r, g, b] = getComputedStyle(document.querySelector(selector))[property].match(/\d+/g).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    },
    [selector, property],
  );

test.describe('@theme', () => {
  test('loads its stylesheet and script', async ({ page }) => {
    await page.goto('/Home');
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--holt-accent-dark').trim(),
    );
    expect(accent).not.toBe('');
    await expect(page.locator('.holt-pagebar')).toBeVisible();
  });

  test('centres the reading column, with or without an outline', async ({ page }) => {
    await page.goto('/Home');
    const plain = await column(page);
    expect(Math.abs(plain.centre - plain.wrapperCentre)).toBeLessThan(2);

    await page.goto('/Outline');
    const outlined = await column(page);
    expect(outlined.width).toBeCloseTo(plain.width, 0);
    expect(Math.abs(outlined.centre - outlined.wrapperCentre)).toBeLessThan(2);
  });

  test('scrolls long code inside the page instead of widening it', async ({ page }) => {
    await page.goto('/Wide');
    const code = page.locator('.page pre').first();
    expect(await code.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await code.evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(
      await page.locator('#column-main > .content').evaluate((el) => el.getBoundingClientRect().right),
    );
  });

  test('scrolls wide tables inside the page instead of widening it', async ({ page }) => {
    await page.goto('/Wide');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('has a dark mode', async ({ page }) => {
    await page.goto('/Home');
    expect(await luminance(page, '#content-wrapper', 'backgroundColor')).toBeGreaterThan(0.8);
    await page.evaluate(() => window.halfmoon.toggleDarkMode());
    expect(await luminance(page, '#content-wrapper', 'backgroundColor')).toBeLessThan(0.2);
    expect(await luminance(page, '.page h1', 'color')).toBeGreaterThan(0.7);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE });

    for (const path of ['Home', 'Outline', 'Wide', 'Home/history', 'Roundtrip/Tables', '-/index']) {
      test(`fits ${path} to the screen`, async ({ page }) => {
        await page.goto(`/${path}`);
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      });
    }
  });
});
