// Releases are cut from Conventional Commits on main. Each release attaches holt.css, holt.js and
// the rich text editor's files for self-hosting, and updates the version in the install snippets
// in the README and docs.
export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        // Holt is still 0.x, so breaking changes bump the minor version instead of releasing 1.0.0.
        // Remove this rule when it's ready for 1.0.
        releaseRules: [{ breaking: true, release: 'minor' }],
      },
    ],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    [
      '@semantic-release/exec',
      {
        prepareCmd:
          "sed -i -E 's/(otterwiki-holt@v|holt\\.(css|js)\\?v=)[0-9]+\\.[0-9]+\\.[0-9]+/\\1${nextRelease.version}/g' README.md docs/*.md",
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['README.md', 'docs/*.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          { path: 'holt.css', label: 'holt.css' },
          { path: 'holt.js', label: 'holt.js' },
          { path: 'holt-editor.js', label: 'holt-editor.js' },
          { path: 'holt-editor.css', label: 'holt-editor.css' },
          { path: 'holt-emoji.json', label: 'holt-emoji.json' },
          { path: 'holt-editor.js.LEGAL.txt', label: 'holt-editor.js.LEGAL.txt' },
        ],
      },
    ],
  ],
};
