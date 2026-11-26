import { PHONE, expect, test } from './support/test.mjs';

const wrapper = (page) => page.locator('#page-wrapper');
const sidebar = (page) => page.locator('#page-wrapper > .sidebar');
const folder = (page) => page.locator('.sidebar .sidebarmenu details').filter({ hasText: 'Roundtrip' }).first();
const folderLink = (page) => folder(page).locator('> summary > a');

// Swipes across the drawer with touch events, as Playwright can only tap.
const swipe = (page, dx) =>
  page.evaluate((dx) => {
    const target = document.querySelector('#page-wrapper > .sidebar');
    const fire = (type, x) => {
      const touch = new Touch({ identifier: 1, target, clientX: x, clientY: 400 });
      const touches = type === 'touchend' ? [] : [touch];
      target.dispatchEvent(new TouchEvent(type, { touches, changedTouches: [touch], bubbles: true, cancelable: true }));
    };
    fire('touchstart', 300);
    for (let step = 1; step <= 5; step++) fire('touchmove', 300 + (dx * step) / 5);
    fire('touchend', 300 + dx);
  }, dx);

test.describe('@sidebar', () => {
  test('is as wide as Notion\'s', async ({ page }) => {
    await page.goto('/Home');
    expect((await sidebar(page).boundingBox()).width).toBeCloseTo(240, 0);
  });

  test('marks the shortcut for the page being viewed', async ({ page }) => {
    const home = page.locator('.sidebar-menu > a.sidebar-link', { hasText: 'Home' });
    const index = page.locator('.sidebar-menu > a.sidebar-link', { hasText: 'A - Z' });
    for (const path of ['/', '/Home']) {
      await page.goto(path);
      await expect(home).toHaveAttribute('aria-current', 'page');
    }
    await page.goto('/-/index');
    await expect(index).toHaveAttribute('aria-current', 'page');
    await expect(home).not.toHaveAttribute('aria-current');
  });

  test('opens and closes a folder from left of its title', async ({ page }) => {
    await page.goto('/Roundtrip/Basics');
    await expect(folder(page)).toHaveAttribute('open');
    await folderLink(page).click({ position: { x: 2, y: 8 } });
    await expect(folder(page)).not.toHaveAttribute('open');
    await expect(page).toHaveURL(/\/Roundtrip\/Basics$/);
    await folderLink(page).click({ position: { x: 2, y: 8 } });
    await expect(folder(page)).toHaveAttribute('open');

    await folderLink(page).getByText('Roundtrip').click();
    await expect(page).toHaveURL(/\/Roundtrip$/);
  });

  test('keeps the otter at its foot while the menu scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 400 });
    await page.goto('/Roundtrip/Basics');
    const menu = page.locator('.sidebar-menu');
    expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const otter = await page.locator('.sidebar-otter').boundingBox();
    const box = await sidebar(page).boundingBox();
    expect(otter.y + otter.height).toBeCloseTo(box.y + box.height, 0);
  });

  test('peeks out when closed and the pointer reaches the window edge', async ({ page }) => {
    await page.goto('/Home');
    await page.locator('#toggle-sidebar-btn').click();
    await expect(wrapper(page)).toHaveAttribute('data-sidebar-hidden', 'hidden');
    await expect.poll(async () => (await sidebar(page).boundingBox()).x).toBeLessThan(-240);

    await page.mouse.move(1, 450);
    await expect(wrapper(page)).toHaveClass(/holt-sidebar-peek/);
    await expect.poll(async () => (await sidebar(page).boundingBox()).x).toBeCloseTo(0, 0);

    await page.mouse.move(800, 450);
    await expect(wrapper(page)).not.toHaveClass(/holt-sidebar-peek/);

    // Clicking the menu button while it peeks opens it for good.
    await page.mouse.move(1, 450);
    await expect(wrapper(page)).toHaveClass(/holt-sidebar-peek/);
    await page.locator('#toggle-sidebar-btn').click();
    await expect(wrapper(page)).not.toHaveAttribute('data-sidebar-hidden');
    await expect(wrapper(page)).not.toHaveClass(/holt-sidebar-peek/);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: PHONE, hasTouch: true });

    test('opens every page with the drawer closed', async ({ page }) => {
      await page.goto('/Home');
      await expect(wrapper(page)).toHaveAttribute('data-sidebar-hidden', 'hidden');
      await page.locator('#toggle-sidebar-btn').tap();
      await expect(wrapper(page)).not.toHaveAttribute('data-sidebar-hidden');
      await page.goto('/Outline');
      await expect(wrapper(page)).toHaveAttribute('data-sidebar-hidden', 'hidden');
    });

    test('leaves the desktop sidebar cookie alone', async ({ page }) => {
      await page.goto('/Home');
      const before = await page.evaluate(() => document.cookie);
      await page.locator('#toggle-sidebar-btn').tap();
      await expect(wrapper(page)).not.toHaveAttribute('data-sidebar-hidden');
      expect(await page.evaluate(() => document.cookie)).toBe(before);
    });

    test('closes the drawer when a link in it is tapped', async ({ page }) => {
      // A 204 keeps the current page, as the next page would open with the drawer closed anyway.
      await page.route('**/-/index', (route) => route.fulfill({ status: 204 }));
      await page.goto('/Roundtrip/Basics');
      await page.locator('#toggle-sidebar-btn').tap();
      await expect(wrapper(page)).not.toHaveAttribute('data-sidebar-hidden');
      await page.locator('.sidebar-menu > a.sidebar-link', { hasText: 'A - Z' }).tap();
      await expect(wrapper(page)).toHaveAttribute('data-sidebar-hidden', 'hidden');
    });

    test('toggles a folder without closing the drawer', async ({ page }) => {
      await page.goto('/Roundtrip/Basics');
      await page.locator('#toggle-sidebar-btn').tap();
      await expect(folder(page)).toHaveAttribute('open');
      await folderLink(page).tap({ position: { x: 2, y: 8 } });
      await expect(folder(page)).not.toHaveAttribute('open');
      await expect(wrapper(page)).not.toHaveAttribute('data-sidebar-hidden');
      await expect(page).toHaveURL(/\/Roundtrip\/Basics$/);
    });

    test('closes the drawer on a left swipe, and springs back from a short one', async ({ page }) => {
      await page.goto('/Home');
      await page.locator('#toggle-sidebar-btn').tap();
      await expect(wrapper(page)).not.toHaveAttribute('data-sidebar-hidden');

      await swipe(page, -20);
      await expect.poll(() => sidebar(page).evaluate((el) => el.style.transform)).toBe('');
      await expect(wrapper(page)).not.toHaveAttribute('data-sidebar-hidden');

      await swipe(page, -200);
      await expect(wrapper(page)).toHaveAttribute('data-sidebar-hidden', 'hidden');
      await expect.poll(() => sidebar(page).evaluate((el) => el.style.transform)).toBe('');
    });
  });
});
