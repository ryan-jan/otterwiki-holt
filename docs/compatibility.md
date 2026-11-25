# Compatibility

Holt needs Otter Wiki 2.26.0 or later. It's tested in Chrome on desktop and phone widths and in
Safari on iOS. It uses modern CSS such as `:has()`, so it needs a browser from 2024 or later.

Most of it is CSS over Otter Wiki's own variables and classes, which changes little between
releases. Some of it depends on Otter Wiki's HTML, and a release could break those parts:

- The page bar moves Otter Wiki's Edit button and the page tools at the top of its menu. If the
  menu changes, the tools stay where they were.
- Search reads page and heading names from the A-Z index at `/-/index`, and page text from Otter
  Wiki's `/-/search`. Both are read from their HTML.
- The outline is built from Otter Wiki's "On this page" list.
- The styling of history, blame, the forms and the other built-in pages assumes their current
  layout.
- An icon added in a new Otter Wiki release has no Lucide equivalent until it's mapped in
  `holt.css`.
- The rich text editor hooks into Otter Wiki's CodeMirror editor and its toolbar buttons. If those
  change, the wand may not appear, and the Markdown editor carries on as normal.

Please open an issue if something breaks on a newer Otter Wiki.
