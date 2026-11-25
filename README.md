# Holt

Holt is a Notion-style theme for [An Otter Wiki](https://otterwiki.com). It gives Otter Wiki a calm
reading column, quiet controls, Lucide icons and a search box that finds pages as you type. It's
one stylesheet and one script, added through two Otter Wiki settings, with no changes to Otter Wiki
itself.

A holt is an otter's den.

![Holt in light mode](screenshots/light.png)

| Before | After |
| --- | --- |
| ![Otter Wiki's default look](screenshots/before.png) | ![The same page with Holt](screenshots/light.png) |

## What it changes

- **Reading.** Pages sit in a centred column with Notion's type sizes, warm text, soft tables and
  tinted callouts. Long code and tables scroll inside themselves instead of widening the page.
- **Page bar.** Edit and the page menu (attachments, history, blame, rename and delete) move out of
  the top bar into a row beside the breadcrumbs, where Notion and Confluence put them. Edit is a
  quiet pencil, and `e` still opens the editor.
- **Search.** The search box becomes a button that opens a centred search dialog, as in Notion,
  from a click, `/` or ⌘K / Ctrl+K. It lists matching pages and headings as you type, then matches
  in page text a moment later. Arrow keys and Enter work, and the last row opens Otter Wiki's full
  search.
- **Outline.** On wide screens "On this page" becomes Notion's floating outline, a short line per
  heading at the page's right edge that opens into the full outline on hover. It highlights the
  section you're reading and keeps a clicked section highlighted. On smaller screens it stays in
  the sidebar, which closes on phones once you pick a section.
- **Full width.** Each page's menu has a Full width switch, as in Notion, remembered per page in
  each browser.
- **Rich text editing.** The editor gains a rich text mode, built on
  [Milkdown](https://milkdown.dev), where the page looks as it does when it's read. See
  [Rich text editor](#rich-text-editor).
- **Icons.** Every Font Awesome icon Otter Wiki draws is replaced with its
  [Lucide](https://lucide.dev) outline equivalent.
- **Otter Wiki's own pages.** History, changelog, blame, diffs, search results, the A–Z index and
  the forms for creating, renaming and deleting pages, settings and login all match the theme.
  Diffs use GitHub's colours, and on phones blame puts each commit above its lines.
- **Dark mode and phones.** Everything has a dark version, and every page is checked at phone width.

![Search as you type](screenshots/search.png)

| Dark mode | Page menu |
| --- | --- |
| ![Dark mode](screenshots/dark.png) | ![The page menu beside the breadcrumbs](screenshots/page-menu.png) |

| Phone | Phone, dark mode |
| --- | --- |
| ![On a phone](screenshots/phone.png) | ![On a phone in dark mode](screenshots/phone-dark.png) |

## Installing

Holt needs Otter Wiki 2.27.0. It may work on other versions, but see
[Compatibility](#compatibility).

Holt is two files, `holt.css` and `holt.js`. Otter Wiki's `HTML_EXTRA_HEAD` and `HTML_EXTRA_BODY`
settings add HTML to every page, and Holt uses them to load its files. The icons are embedded in
`holt.css`. On edit pages `holt.js` also loads the rich text editor, `holt-editor.js`,
`holt-editor.css` and `holt-emoji.json`, from wherever `holt.js` came from.

### From jsDelivr

[jsDelivr](https://www.jsdelivr.com) serves each tagged release of this repository. Add the two
settings to Otter Wiki's environment. With Docker Compose:

```yaml
services:
  otterwiki:
    image: redimp/otterwiki:2.27.0
    environment:
      HTML_EXTRA_HEAD: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ryan-jan/otterwiki-holt@v0.3.0/holt.css">'
      HTML_EXTRA_BODY: '<script src="https://cdn.jsdelivr.net/gh/ryan-jan/otterwiki-holt@v0.3.0/holt.js"></script>'
```

To upgrade, change the version in both URLs. A new URL means browsers can't show a stale copy.

Each viewer's browser fetches the files from jsDelivr. If jsDelivr can't be reached, the wiki
still works, but with Otter Wiki's default look.

### Self-hosted

Download `holt.css`, `holt.js`, `holt-editor.js`, `holt-editor.css` and `holt-emoji.json` from a
[release](https://github.com/ryan-jan/otterwiki-holt/releases) into a folder mounted at `/app/otterwiki/static/custom`, which is where Otter Wiki keeps its
`custom.css` and `custom.js`. Then point the two settings at them:

```yaml
services:
  otterwiki:
    image: redimp/otterwiki:2.27.0
    volumes:
      - ./custom:/app/otterwiki/static/custom:ro
    environment:
      HTML_EXTRA_HEAD: '<link rel="stylesheet" href="/static/custom/holt.css?v=0.3.0">'
      HTML_EXTRA_BODY: '<script src="/static/custom/holt.js?v=0.3.0"></script>'
```

Otter Wiki ignores the `?v=`, but browsers treat it as part of the address. Change it when you
upgrade, so they fetch the new files. Nothing in Holt contacts any other server.

## Rich text editor

The editor opens in rich text mode, where the page sits in its reading column with Holt's
typography, so it looks as it will once saved. Like Notion:

- Type `/` for headings, lists, quotes, tables, code, emoji, wiki links and Otter Wiki's own blocks.
- Hover over a block for its handle. Click `+` to add a block below, or Option-click (Alt-click
  elsewhere) to add one above. Drag `⋮⋮` to move the block, or click it to turn the block into
  another kind, duplicate it or delete it.
- Type `[[` to link to a page, picked from the wiki's pages as you type.
- Select text for bold, italic, links, highlight and the other formatting.
- On wide screens the floating outline lists the page's headings as you edit them.

The `</>` button beside Save switches to Otter Wiki's Markdown editor, and the wand switches back.
Holt remembers if you prefer Markdown, in each browser. The preview buttons and Otter Wiki's
attachment and wiki link panels only appear in the Markdown editor, since rich mode shows the page
as it will look and has its own ways to add links and images.

The page's Markdown is always the master copy. The rich editor writes its changes back into Otter
Wiki's editor, so saving, drafts, the preview and the attachment panel work as before. A page only
opens in rich mode if Otter Wiki renders it exactly the same after a round trip through the rich
editor, so it can't change a page you didn't edit. Anything else opens in the Markdown editor, and
the wand explains why. Otter Wiki syntax the rich editor doesn't understand, like info boxes,
alerts and maths, shows as Otter Wiki renders it, and its source opens in place to edit.

Once you change something, the rich editor writes out the whole page in its own style. The page
renders the same, but some Markdown may be laid out differently, such as padded table columns, so
the diff can include lines you didn't touch.

The editor is about 1.2 MB, but only edit pages load it. To keep only the Markdown editor, add
`data-editor="off"` to Holt's script tag:

```yaml
      HTML_EXTRA_BODY: '<script src="https://cdn.jsdelivr.net/gh/ryan-jan/otterwiki-holt@v0.3.0/holt.js" data-editor="off"></script>'
```

## Colours

The default accent is a soft Notion blue. To change it, add a `:root` block for light mode and a
`.dark-mode` block for dark mode to your `custom.css`. Holt declares its colours with `:where()`,
which carries no weight in CSS's priority rules, so yours win even though Holt loads after
`custom.css`. This example is a green:

```css
:root {
    --holt-accent-light: #d7ecdc;
    --holt-accent-mid: #93cda2;
    --holt-accent-dark: #22613a;
    --holt-selected-bg: #e9f5ec;
    --holt-selection: rgba(68, 131, 97, 0.28);
    --holt-accent-ring: rgba(34, 97, 58, 0.2);
    --holt-link-underline: rgba(34, 97, 58, 0.35);
}

.dark-mode {
    --holt-selected-bg: #1e3226;
    --holt-selection: #264534;
    --holt-accent-ring: rgba(147, 205, 162, 0.3);
    --holt-link-underline: rgba(147, 205, 162, 0.4);
}
```

The three accent colours are used in both modes:

- `--holt-accent-light` fills main buttons, like Save.
- `--holt-accent-mid` is their hover colour and the focus ring, and the accent in dark mode.
- `--holt-accent-dark` is the text on main buttons, and the accent in light mode.

The others are the selected sidebar item (`--holt-selected-bg`), selected text
(`--holt-selection`), the focus ring (`--holt-accent-ring`) and link underlines
(`--holt-link-underline`). Each needs a light and a dark value.

Every other colour, like the text, callouts and diffs, is a `--holt-*` variable at the top of
`holt.css`, and can be overridden the same way.

### Browser caching

Otter Wiki links `custom.css` without a version in its address, so after you change it, browsers
can keep the old copy for hours. Safari on iOS is the worst for this, and has no hard refresh. If a
change doesn't show up, clear the site's data in the browser.

To fix it for good, have your reverse proxy tell browsers to check for a new copy on every load.
When nothing has changed, the check is a tiny "not modified" reply. With nginx:

```nginx
location /static/custom/ {
    proxy_pass http://127.0.0.1:8080;
    add_header Cache-Control "no-cache" always;
}
```

With Caddy:

```caddy
wiki.example.com {
    header /static/custom/* Cache-Control "no-cache"
    reverse_proxy 127.0.0.1:8080
}
```

## Compatibility

Holt is tested on Otter Wiki 2.27.0, in Chrome on desktop and phone widths and in Safari on iOS. It
uses modern CSS such as `:has()`, so it needs a browser from 2024 or later.

Most of it is CSS over Otter Wiki's own variables and classes, which changes little between
releases. Some of it depends on Otter Wiki's HTML, and a release could break those parts:

- The page bar moves Otter Wiki's Edit button and the page tools at the top of its menu. If the
  menu changes, the tools stay where they were.
- Search as you type reads page and heading names from the A–Z index at `/-/index`, and page text
  from Otter Wiki's `/-/search`. Both are read from their HTML.
- The styling of history, blame, the forms and the other built-in pages assumes their current
  layout.
- A new Font Awesome icon in an Otter Wiki release keeps its old look until it's added to the map
  in `holt.css`.
- The rich text editor hooks into Otter Wiki's CodeMirror editor and its toolbar buttons. If those
  change, the wand may not appear, and the Markdown editor carries on as normal.

Please open an issue if something breaks on a newer Otter Wiki.

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

## Licence

MIT. See [LICENSE](LICENSE). The embedded [Lucide](https://lucide.dev) icons are under the ISC
licence. See [LICENSE-lucide](LICENSE-lucide). The rich text editor bundles Milkdown, ProseMirror
and other open source libraries, whose licences are listed in `holt-editor.js.LEGAL.txt`.
