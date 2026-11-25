// Every Font Awesome icon Otter Wiki draws should have a Lucide icon in holt.css. A release that
// adds a new icon fails here, naming the icon to map.

import { expect, test } from './support/test.mjs';

const PAGES = [
  'Home', 'Outline', 'Home/edit', 'Home/history', 'Home/blame', 'Home/rename', 'Home/delete',
  'Files/attachments', '-/changelog', '-/index', '-/search/boiler', '-/create', '-/about', '-/syntax',
  '-/help', '-/login', '-/register',
];

const ADMIN_PAGES = [
  '-/settings', '-/admin', '-/admin/permissions_and_registration', '-/admin/user_management',
  '-/admin/sidebar_preferences', '-/admin/content_and_editing', '-/admin/repository_management',
  '-/admin/mail_preferences',
];

const unmapped = (page) =>
  page.evaluate(() => {
    const missing = new Set();
    for (const icon of document.querySelectorAll('i[class*="fa-"]')) {
      const style = getComputedStyle(icon);
      if ((style.maskImage || style.webkitMaskImage) === 'none') {
        missing.add([...icon.classList].find((name) => /^fa-(?!fw$|lg$|\dx$)/.test(name)));
      }
    }
    return [...missing].sort();
  });

test.describe('@icons', () => {
  for (const path of PAGES) {
    test(`maps every icon on ${path} to Lucide`, async ({ page }) => {
      await page.goto(`/${path}`);
      expect(await unmapped(page)).toEqual([]);
    });
  }

  for (const path of ADMIN_PAGES) {
    test(`maps every icon on ${path} to Lucide`, async ({ adminPage }) => {
      await adminPage.goto(`/${path}`);
      expect(await unmapped(adminPage)).toEqual([]);
    });
  }
});
