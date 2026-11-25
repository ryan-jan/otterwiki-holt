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

## Releasing

Every push to `main` runs [semantic-release](https://semantic-release.gitbook.io), which reads the
[Conventional Commits](https://www.conventionalcommits.org) since the last tag. A `fix:` releases a
patch and a `feat:` releases a minor version. It tags the release, attaches the files for
self-hosting and updates the versions in the install snippets in the README and these docs.
