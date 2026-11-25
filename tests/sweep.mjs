// Runs the integration tests against a range of Otter Wiki releases and reports, for each feature,
// the oldest release from which it works in every release since. It works back from the newest
// release, and a sweep of Docker Hub's releases stops at the first one Holt doesn't load in, since
// nothing older will be any better.
//
//   node tests/sweep.mjs                 every 2.x release on Docker Hub
//   node tests/sweep.mjs --minors        the latest patch of each 2.x minor release
//   node tests/sweep.mjs 2.20.0 2.27.0   just these
//
// Results go in tests/sweep-results, one JSON file per release, so an interrupted sweep picks up
// where it left off. Delete a release's file to test it again. Each image is removed after its run,
// apart from the one the tests use by default.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RESULTS = fileURLToPath(new URL('./sweep-results/', import.meta.url));
const DEFAULT_VERSION = '2.27.0';

const byVersion = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

async function releases() {
  const tags = [];
  let url = 'https://hub.docker.com/v2/repositories/redimp/otterwiki/tags?page_size=100';
  while (url) {
    const page = await (await fetch(url)).json();
    tags.push(...page.results.map((tag) => tag.name));
    url = page.next;
  }
  return tags.filter((tag) => /^2\.\d+\.\d+$/.test(tag)).sort(byVersion);
}

// Each test's feature tag and whether it passed, from Playwright's JSON report.
function outcomes(report) {
  const found = [];
  const walk = (suite, tag) => {
    const own = suite.title?.match(/^@[\w-]+/)?.[0] ?? tag;
    for (const spec of suite.specs ?? []) {
      found.push({ tag: own, title: spec.title, ok: spec.ok });
    }
    for (const child of suite.suites ?? []) walk(child, own);
  };
  for (const suite of report.suites ?? []) walk(suite, null);
  return found;
}

function run(version) {
  const file = `${RESULTS}${version}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));

  const started = Date.now();
  process.stdout.write(`${version} … `);
  const pull = spawnSync('docker', ['pull', '-q', `redimp/otterwiki:${version}`], { encoding: 'utf8' });
  let tests = [];
  let error = null;
  if (pull.status !== 0) {
    error = `docker pull failed: ${pull.stderr.trim()}`;
  } else {
    const result = spawnSync('npx', ['playwright', 'test', '-c', 'tests', '--reporter=json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, OTTERWIKI_VERSION: version, HOLT_SWEEP: '1' },
    });
    try {
      tests = outcomes(JSON.parse(result.stdout));
    } catch {
      error = `no report: ${result.stderr.trim().split('\n').slice(-3).join(' ')}`;
    }
    if (version !== DEFAULT_VERSION) {
      spawnSync('docker', ['rmi', '-f', `redimp/otterwiki:${version}`], { encoding: 'utf8' });
    }
  }

  const record = { version, tests, error, seconds: Math.round((Date.now() - started) / 1000) };
  writeFileSync(file, JSON.stringify(record, null, 2));
  const passed = tests.filter((test) => test.ok).length;
  console.log(error ?? `${passed}/${tests.length} passed in ${record.seconds}s`);
  return record;
}

function summarise(records) {
  const tags = [...new Set(records.flatMap((record) => record.tests.map((test) => test.tag)))].sort();
  const score = (record, tag) => {
    const tests = record.tests.filter((test) => test.tag === tag);
    return { passed: tests.filter((test) => test.ok).length, total: tests.length };
  };

  const lines = ['| Feature | Works since | Partly works in |', '| --- | --- | --- |'];
  for (const tag of tags) {
    let since = null;
    for (const record of [...records].reverse()) {
      const { passed, total } = score(record, tag);
      if (total && passed === total) since = record.version;
      else break;
    }
    const partly = records
      .filter((record) => record.version !== since && byVersion(record.version, since ?? '99.0.0') < 0)
      .map((record) => ({ version: record.version, ...score(record, tag) }))
      .filter(({ passed, total }) => passed > 0 && passed < total)
      .map(({ version, passed, total }) => `${version} (${passed}/${total})`);
    lines.push(`| \`${tag}\` | ${since ?? 'never'} | ${partly.length ? partly.join(', ') : ''} |`);
  }

  const matrix = [
    `| Release | ${tags.map((tag) => `\`${tag}\``).join(' | ')} |`,
    `| --- | ${tags.map(() => '---').join(' | ')} |`,
    ...records.map((record) => {
      if (record.error) return `| ${record.version} | ${tags.map(() => 'error').join(' | ')} |`;
      const cells = tags.map((tag) => {
        const { passed, total } = score(record, tag);
        return passed === total ? 'pass' : `${passed}/${total}`;
      });
      return `| ${record.version} | ${cells.join(' | ')} |`;
    }),
  ];

  return `## By feature\n\n${lines.join('\n')}\n\n## By release\n\n${matrix.join('\n')}\n`;
}

mkdirSync(RESULTS, { recursive: true });
execFileSync('docker', ['info'], { stdio: 'ignore' });
const args = process.argv.slice(2);
const latestPatches = (tags) => tags.filter((tag, i) => tag.split('.')[1] !== tags[i + 1]?.split('.')[1]);
const versions = args.includes('--minors')
  ? latestPatches(await releases())
  : args.length ? args.sort(byVersion) : await releases();
console.log(`Sweeping ${versions.length} releases, ${versions[0]} to ${versions.at(-1)}`);
const loads = (record) => record.tests.some((test) => test.title === 'loads its stylesheet and script' && test.ok);
const records = [];
for (const version of [...versions].reverse()) {
  const record = run(version);
  records.unshift(record);
  if (!args.some((arg) => /^\d/.test(arg)) && !loads(record)) {
    console.log(`Holt doesn't load in ${version}, so older releases are skipped.`);
    break;
  }
}
const summary = summarise(records);
writeFileSync(`${RESULTS}summary.md`, summary);
console.log(`\n${summary}`);
