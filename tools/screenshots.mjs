// Captures the screenshots in screenshots/. Runs Otter Wiki in Docker twice, once with Holt
// loaded from the working tree and once without for the "before" shot, both seeded with the
// household wiki in tools/screenshots/wiki.
//
//   node tools/screenshots.mjs

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WIKI = fileURLToPath(new URL('./screenshots/wiki', import.meta.url));
const OUT = `${ROOT}screenshots`;
const VERSION = process.env.OTTERWIKI_VERSION ?? '2.27.0';
const HOLT_FILES = ['holt.css', 'holt.js', 'holt-editor.css', 'holt-editor.js', 'holt-emoji.json'];
const REPOSITORY = '/app-data/repository';

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();

async function startWiki(name, holt) {
  try {
    docker('rm', '-f', name);
  } catch {
    // Not left over from an earlier run.
  }
  const extra = holt
    ? [
        '-e', 'HTML_EXTRA_HEAD=<link rel="stylesheet" href="/static/custom/holt.css">',
        '-e', 'HTML_EXTRA_BODY=<script src="/static/custom/holt.js"></script>',
        ...HOLT_FILES.flatMap((file) => ['-v', `${ROOT}${file}:/app/otterwiki/static/custom/${file}:ro`]),
      ]
    : [];
  docker('run', '-d', '--rm', '--name', name, '-p', '127.0.0.1::80', '-e', 'SITE_NAME=Our Wiki', ...extra,
    `redimp/otterwiki:${VERSION}`);
  const baseURL = `http://${docker('port', name, '80/tcp').split('\n')[0]}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(baseURL)).ok) break;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  docker('cp', `${WIKI}/.`, `${name}:${REPOSITORY}/`);
  docker('exec', name, 'chown', '-R', 'www-data:www-data', REPOSITORY);
  docker('exec', '-u', 'www-data', name, 'git', '-C', REPOSITORY, 'add', '-A');
  docker('exec', '-u', 'www-data', name, 'git', '-C', REPOSITORY, '-c', 'user.name=Holt',
    '-c', 'user.email=holt@example.com', 'commit', '-q', '-m', 'Seed the wiki');
  return baseURL;
}

const holt = await startWiki('holt-screenshots', true);
const plain = await startWiki('holt-screenshots-plain', false);
const browser = await chromium.launch();

async function open(baseURL, path, device = DESKTOP, colorScheme = 'light') {
  const context = await browser.newContext({ ...device, colorScheme, baseURL });
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  return page;
}

// Lets transitions finish before the capture.
async function capture(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.context().close();
}

try {
  await capture(await open(plain, '/Home'), 'before');
  await capture(await open(holt, '/Home'), 'light');
  await capture(await open(holt, '/Home', DESKTOP, 'dark'), 'dark');
  await capture(await open(holt, '/Recipes/Focaccia', PHONE), 'phone');
  await capture(await open(holt, '/Recipes/Focaccia', PHONE, 'dark'), 'phone-dark');

  let page = await open(holt, '/Recipes/Focaccia');
  await page.locator('.holt-search-button').click();
  await page.locator('.holt-search-dialog #search-query').fill('foc');
  await page.locator('.holt-search-item', { hasText: 'Home' }).waitFor();
  await capture(page, 'search');

  page = await open(holt, '/Recipes/Focaccia');
  await page.locator('#holt-page-menu-btn').click();
  await capture(page, 'page-menu');

  page = await open(holt, '/House Manual');
  await page.locator('.holt-toc').hover();
  await page.locator('.holt-toc-panel a', { hasText: 'Fuse box' }).waitFor();
  await capture(page, 'outline');

  // The / menu open on a new line, with the pointer over the note so its handles show.
  page = await open(holt, '/Recipes/Focaccia/edit');
  await page.locator('body.holt-rich-mode').waitFor();
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowRight' : 'End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  await page.waitForTimeout(500);
  const note = await page.locator('.ProseMirror > *', { hasText: 'Rosemary' }).first().boundingBox();
  await page.mouse.move(note.x + note.width / 2, note.y + note.height / 2);
  await capture(page, 'editor');
} finally {
  await browser.close();
  docker('rm', '-f', 'holt-screenshots');
  docker('rm', '-f', 'holt-screenshots-plain');
}
