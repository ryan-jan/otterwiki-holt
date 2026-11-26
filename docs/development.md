# Development

## Updating the icons

The Lucide icons are SVGs embedded in `holt.css`, each followed by a comment naming it, like
`/* lucide house */`. `tools/inline-icons.py` fetches every named icon from `lucide-static` at the
version set in the script and rewrites them. To change an icon, change its name in the comment and
run the script.

## Updating the screenshots

`tools/screenshots.mjs` retakes every image in `screenshots/`. It starts Otter Wiki in Docker with
Holt loaded from the working tree, and again without it for the "before" shot. Both are seeded with
the household wiki in `tools/screenshots/wiki`. It needs Docker running and the Playwright setup
from the integration tests.

```sh
node tools/screenshots.mjs
```

## Building the editor

The rich text editor's source is in `editor/`, an npm project that bundles Milkdown with esbuild.
Its built files are committed at the top of the repository, because jsDelivr serves them from
there. After changing the source, run:

```sh
cd editor
npm ci
npm test
npm run build
```

Then commit the source and the rebuilt `holt-editor.*` and `holt-emoji.json` together.

## Integration tests

The tests in `tests/` drive a real Otter Wiki with [Playwright](https://playwright.dev). Each test
worker starts Otter Wiki in Docker, loads Holt from the working tree and seeds the wiki with the
pages in `tests/fixtures/wiki`. Every test starts from that seed. They need Docker running.

```sh
npm ci
npx playwright install chromium
npm run test:integration
```

`OTTERWIKI_VERSION` picks the Otter Wiki release to test against, and defaults to 2.27.0. Each
suite is tagged by the feature it covers, so `-g` runs one of them. The tags are `@theme`,
`@icons`, `@page-bar`, `@search`, `@outline`, `@sidebar`, `@pages`, `@editor`, `@editor-blocks` and
`@editor-roundtrip`.

```sh
OTTERWIKI_VERSION=2.26.0 npm run test:integration -- -g @editor-roundtrip
```

`@icons` fails when an Otter Wiki page draws a Font Awesome icon with no Lucide icon mapped in
`holt.css`, and names the icon. `@pages` checks that Otter Wiki's own pages, including the admin
pages, sit in the same centred column as a wiki page.

`@editor-roundtrip` checks the rich editor's promise not to change pages. Each fixture page in
`roundtrip/` must open in rich mode with its Markdown untouched, and must render the same after an
edit apart from the edit itself. Each page in `fallback/` must open in Markdown mode. To cover a new
piece of syntax, add a page to the matching folder and to the list at the top of the spec.

### On GitHub Actions

`.github/workflows/test.yml` runs the tests on every pull request, and the release workflow runs
them before every release, against Otter Wiki 2.27.0. A failed run uploads Playwright's traces,
which `npx playwright show-trace` opens. On CI each failing test gets one retry.

`.github/workflows/daily.yml` runs them every morning against Otter Wiki's `latest` image, so a new
Otter Wiki release that breaks Holt shows up within a day. A failing run opens an issue named after
the release, or comments on it if it's already open. GitHub turns scheduled workflows off after 60
days without activity in the repository. Turn it back on from the Actions tab.

### Sweeping Otter Wiki releases

`tests/sweep.mjs` runs the integration tests against a range of Otter Wiki releases and reports,
for each feature, the oldest release from which it works in every release since. With no arguments
it tests every 2.x release on Docker Hub, which takes a few hours. `--minors` tests only the
latest patch of each minor release, which is usually enough to find where a feature starts.

```sh
node tests/sweep.mjs --minors
node tests/sweep.mjs 2.26.0 2.27.0
```

It saves one result file per release in `tests/sweep-results`, so an interrupted sweep carries on
where it stopped, and writes the tables to `tests/sweep-results/summary.md`. Each image is removed
after its run.

## Releasing

Every push to `main` runs the integration tests and then
[semantic-release](https://semantic-release.gitbook.io), which reads the
[Conventional Commits](https://www.conventionalcommits.org) since the last tag. A `fix:` releases a
patch and a `feat:` releases a minor version. It tags the release, attaches the files for
self-hosting and updates the versions in the install snippets in the README and these docs.
