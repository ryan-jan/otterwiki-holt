import { test as base, expect } from '@playwright/test';

import { startWiki } from './wiki.mjs';

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

  baseURL: async ({ wiki }, use) => use(wiki.baseURL),

  // Every test starts from the seeded wiki and fails if Holt throws. Errors from Otter Wiki's own
  // scripts, such as MathJax on some older releases, aren't Holt's to fix.
  page: async ({ page, wiki }, use) => {
    wiki.reset();
    const errors = [];
    page.on('pageerror', (error) => {
      if (/\/static\/custom\/holt/.test(error.stack ?? '')) errors.push(error.message);
    });
    await use(page);
    expect(errors, 'script errors on the page').toEqual([]);
  },
});

export { expect };

// The end of the current line. On a Mac, End scrolls the page instead.
export const END = process.platform === 'darwin' ? 'Meta+ArrowRight' : 'End';

export async function openEditor(page, path) {
  await page.goto(`/${path}/edit`);
  await expect(page.locator('body')).toHaveClass(/holt-editor-settled/);
}

// The Markdown in Otter Wiki's editor, once the rich editor has written its changes back.
export const markdown = (page) => page.evaluate(() => window.cm_editor.state.doc.toString());

export async function save(page, message = 'Test edit') {
  await page.locator('#save-page-btn').click();
  await page.locator('#commit-message').fill(message);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.endsWith('/edit')),
    page.locator('#modal-commit input[type="submit"]').click(),
  ]);
}
