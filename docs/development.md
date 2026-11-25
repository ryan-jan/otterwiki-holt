# Development

## Updating the icons

The Lucide icons are SVGs embedded in `holt.css`, each followed by a comment naming it, like
`/* lucide house */`. `tools/inline-icons.py` fetches every named icon from `lucide-static` at the
version set in the script and rewrites them. To change an icon, change its name in the comment and
run the script.

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
suite is tagged by feature, such as `@search` or `@editor-roundtrip`, so `-g` runs one of them:

```sh
OTTERWIKI_VERSION=2.26.0 npm run test:integration -- -g @editor-roundtrip
```

`@editor-roundtrip` checks the rich editor's promise not to change pages. Each fixture page in
`roundtrip/` must open in rich mode with its Markdown untouched, and must render the same after an
edit apart from the edit itself. Each page in `fallback/` must open in Markdown mode. To cover a new
piece of syntax, add a page to the matching folder and to the list at the top of the spec.

## Releasing

Every push to `main` runs [semantic-release](https://semantic-release.gitbook.io), which reads the
[Conventional Commits](https://www.conventionalcommits.org) since the last tag. A `fix:` releases a
patch and a `feat:` releases a minor version. It tags the release, attaches the files for
self-hosting and updates the versions in the install snippets in the README and these docs.
