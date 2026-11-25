// Runs An Otter Wiki in Docker with Holt loaded from the working tree, seeded with the pages in
// tests/fixtures/wiki. OTTERWIKI_VERSION picks the image tag, so the same tests run against any
// release.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures/wiki', import.meta.url));
const HOLT_FILES = ['holt.css', 'holt.js', 'holt-editor.css', 'holt-editor.js', 'holt-emoji.json'];
const REPOSITORY = '/app-data/repository';

export const VERSION = process.env.OTTERWIKI_VERSION ?? '2.27.0';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const dockerInput = (input, ...args) => execFileSync('docker', args, { encoding: 'utf8', input }).trim();
// Otter Wiki runs as www-data, so the repository has to be written as www-data too.
const exec = (name, ...args) => docker('exec', '-u', 'www-data', name, ...args);

async function waitUntilUp(baseURL) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(baseURL)).ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Otter Wiki ${VERSION} didn't start at ${baseURL}`);
}

export async function startWiki(id) {
  const name = `holt-test-${VERSION.replace(/\W/g, '-')}-${process.pid}-${id}`;
  const mounts = HOLT_FILES.flatMap((file) => [
    '-v',
    `${ROOT}${file}:/app/otterwiki/static/custom/${file}:ro`,
  ]);
  docker(
    'run', '-d', '--rm', '--name', name, '--label', 'holt-test',
    '-p', '127.0.0.1::80',
    '-e', 'SITE_NAME=Holt Test',
    '-e', 'HTML_EXTRA_HEAD=<link rel="stylesheet" href="/static/custom/holt.css">',
    '-e', 'HTML_EXTRA_BODY=<script src="/static/custom/holt.js"></script>',
    ...mounts,
    `redimp/otterwiki:${VERSION}`,
  );
  const baseURL = `http://${docker('port', name, '80/tcp').split('\n')[0]}`;
  await waitUntilUp(baseURL);

  docker('cp', `${FIXTURES}/.`, `${name}:${REPOSITORY}/`);
  docker('exec', name, 'chown', '-R', 'www-data:www-data', REPOSITORY);
  exec(name, 'git', '-C', REPOSITORY, 'add', '-A');
  exec(name, 'git', '-C', REPOSITORY, '-c', 'user.name=Holt Test', '-c', 'user.email=test@example.com',
    'commit', '-q', '-m', 'Seed the test wiki');
  const seed = exec(name, 'git', '-C', REPOSITORY, 'rev-parse', 'HEAD');

  return {
    name,
    baseURL,
    // Puts the repository back to the seed and forgets drafts, so each test starts the same.
    reset() {
      exec(name, 'git', '-C', REPOSITORY, 'reset', '-q', '--hard', seed);
      exec(name, 'git', '-C', REPOSITORY, 'clean', '-qfd');
      // Releases before drafts have no table to clear.
      exec(name, 'python3', '-c',
        "import sqlite3; c = sqlite3.connect('/app-data/db.sqlite')\n" +
        "try: c.execute('DELETE FROM drafts'); c.commit()\nexcept sqlite3.OperationalError: pass");
    },
    // A page's Markdown as it is in the wiki's repository now.
    read(file) {
      return exec(name, 'cat', `${REPOSITORY}/${file}`) + '\n';
    },
    // Changes a page as a new commit, as if someone had saved it.
    write(file, content, message = 'Change a page') {
      dockerInput(content, 'exec', '-i', '-u', 'www-data', name, 'sh', '-c', `cat > "${REPOSITORY}/${file}"`);
      exec(name, 'git', '-C', REPOSITORY, 'add', '-A');
      exec(name, 'git', '-C', REPOSITORY, '-c', 'user.name=Holt Test', '-c', 'user.email=test@example.com',
        'commit', '-q', '-m', message);
    },
    // A page's recent revisions, newest first, as Otter Wiki abbreviates them.
    revisions(file) {
      return exec(name, 'git', '-C', REPOSITORY, 'log', '--format=%h', '--abbrev=6', '--', file).split('\n');
    },
    commits() {
      return Number(exec(name, 'git', '-C', REPOSITORY, 'rev-list', '--count', 'HEAD'));
    },
    stop() {
      docker('rm', '-f', name);
    },
  };
}

// A fixture page's Markdown as seeded.
export const fixture = (file) => readFileSync(`${FIXTURES}/${file}`, 'utf8');
