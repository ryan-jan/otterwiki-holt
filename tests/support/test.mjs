import { test as base, expect } from '@playwright/test';

import { startWiki } from './wiki.mjs';

export const ADMIN = { email: 'admin@example.com', password: 'correcthorse1', name: 'Admin' };

// Fails the test if Holt throws. Errors from Otter Wiki's own scripts, such as MathJax on some
// older releases, aren't Holt's to fix.
function watchForErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    if (/\/static\/custom\/holt/.test(error.stack ?? '')) errors.push(error.message);
  });
  return () => expect(errors, 'script errors from Holt').toEqual([]);
}

export const test = base.extend({
  // One wiki per worker, since starting one takes a few seconds.
  wiki: [
    async ({}, use, workerInfo) => {
      const wiki = await startWiki(workerInfo.workerIndex);
      await use(wiki);
      wiki.stop();
    },
    { scope: 'worker' },
  ],

  // The first account registered on a wiki becomes its admin. Users outlive the resets between
  // tests, so each worker registers once and reuses the login.
  adminState: [
    async ({ browser, wiki }, use) => {
      const context = await browser.newContext({ baseURL: wiki.baseURL });
      const page = await context.newPage();
      await page.goto('/-/register');
      await page.fill('#email', ADMIN.email);
      await page.fill('#name', ADMIN.name);
      await page.fill('#password1', ADMIN.password);
      await page.fill('#password2', ADMIN.password);
      await page.locator('form button[type="submit"], form input[type="submit"]').last().click();
      await page.goto('/-/login');
      if (await page.locator('#password').count()) {
        await page.fill('#email', ADMIN.email);
        await page.fill('#password', ADMIN.password);
        await page.locator('form button[type="submit"], form input[type="submit"]').last().click();
      }
      await page.goto('/-/admin');
      await expect(page.locator('#column-main')).toContainText(/Application Preferences|Preferences/);
      const state = await context.storageState();
      await context.close();
      await use(state);
    },
    { scope: 'worker' },
  ],

  baseURL: async ({ wiki }, use) => use(wiki.baseURL),

  // Every test starts from the seeded wiki.
  page: async ({ page, wiki }, use) => {
    wiki.reset();
    const check = watchForErrors(page);
    await use(page);
    check();
  },

  adminPage: async ({ browser, adminState, wiki, viewport }, use) => {
    wiki.reset();
    const context = await browser.newContext({ storageState: adminState, baseURL: wiki.baseURL, viewport });
    const page = await context.newPage();
    const check = watchForErrors(page);
    await use(page);
    check();
    await context.close();
  },
});

export { expect };

// The end of the current line. On a Mac, End scrolls the page instead.
export const END = process.platform === 'darwin' ? 'Meta+ArrowRight' : 'End';
export const PHONE = { width: 390, height: 844 };

export async function openEditor(page, path) {
  await page.goto(`/${path}/edit`);
  await expect(page.locator('body')).toHaveClass(/holt-editor-settled/);
}

export async function openRichEditor(page, path) {
  await openEditor(page, path);
  await expect(page.locator('body')).toHaveClass(/holt-rich-mode/);
}

// Clicks into the rich editor and waits for the cursor to land, so a shortcut pressed next acts there.
export async function placeCursor(locator) {
  await locator.click();
  await expect.poll(() => locator.evaluate((el) => el.contains(getSelection().anchorNode))).toBe(true);
}

// The Markdown in Otter Wiki's editor, once the rich editor has written its changes back.
export const markdown = (page) => page.evaluate(() => window.cm_editor.state.doc.toString());

// Waits for the rich editor to write a change back, and returns the Markdown.
export async function markdownWhen(page, predicate) {
  await expect.poll(async () => predicate(await markdown(page))).toBe(true);
  return markdown(page);
}

export async function save(page, message = 'Test edit') {
  await page.locator('#save-page-btn').click();
  await page.locator('#commit-message').fill(message);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/edit')),
    page.locator('#modal-commit input[type="submit"]').click(),
  ]);
}

// The page's reading column and the space it's centred in, in pixels.
export const column = (page) =>
  page.evaluate(() => {
    const box = (el) => el.getBoundingClientRect();
    const content = box(document.querySelector('#column-main > .content'));
    const wrapper = box(document.getElementById('content-wrapper'));
    return {
      width: content.width,
      centre: content.left + content.width / 2,
      wrapperCentre: wrapper.left + wrapper.width / 2,
    };
  });
