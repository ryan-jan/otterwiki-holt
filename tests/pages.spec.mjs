// Otter Wiki's own pages sit in the same centred column as a wiki page.

import { column, expect, test } from './support/test.mjs';

const PAGES = [
  'Home/history', 'Home/blame', 'Home/rename', 'Home/delete', 'Files/attachments', '-/changelog',
  '-/index', '-/search/boiler', '-/create', '-/about', '-/login', '-/register',
];

const ADMIN_PAGES = [
  '-/settings', '-/admin', '-/admin/permissions_and_registration', '-/admin/user_management',
  '-/admin/sidebar_preferences', '-/admin/content_and_editing', '-/admin/repository_management',
  '-/admin/mail_preferences',
];

async function expectReadingColumn(page, path) {
  await page.goto('/Home');
  const reference = await column(page);
  await page.goto(`/${path}`);
  const actual = await column(page);
  expect(actual.width, 'column width').toBeCloseTo(reference.width, 0);
  expect(Math.abs(actual.centre - actual.wrapperCentre), 'distance from centre').toBeLessThan(2);
}

test.describe('@pages', () => {
  for (const path of PAGES) {
    test(`shows ${path} in the reading column`, async ({ page }) => expectReadingColumn(page, path));
  }

  for (const path of ADMIN_PAGES) {
    test(`shows ${path} in the reading column`, async ({ adminPage }) => expectReadingColumn(adminPage, path));
  }

  // Otter Wiki's diff template leaves a div open, which once pushed the column off centre.
  test('shows a diff in the reading column', async ({ page, wiki }) => {
    wiki.write('home.md', `${wiki.read('home.md')}\nA new paragraph.\n`);
    const [newer, older] = wiki.revisions('home.md');
    await expectReadingColumn(page, `Home/diff/${older}/${newer}`);
    await expect(page.locator('#column-main')).toContainText('A new paragraph.');
  });

  test('makes form fields as wide as their form', async ({ page }) => {
    await page.goto('/Home/rename');
    const [field, form] = await page.evaluate(() => {
      const input = document.querySelector('#column-main form input[type="text"]');
      return [input.getBoundingClientRect().width, input.closest('form').getBoundingClientRect().width];
    });
    expect(field).toBeGreaterThan(form * 0.9);
  });
});
