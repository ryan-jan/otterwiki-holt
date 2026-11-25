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
- **Search as you type.** The search box lists matching pages and headings straight away, then
  matches in page text a moment later. Arrow keys and Enter work, and the last row opens Otter
  Wiki's full search.
- **Outline.** "On this page" highlights the section you're reading, keeps a clicked section
  highlighted, and on phones closes the sidebar once you pick one.
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
`holt.css`, so either way of installing gets everything.

### From jsDelivr

[jsDelivr](https://www.jsdelivr.com) serves each tagged release of this repository. Add the two
settings to Otter Wiki's environment. With Docker Compose:

```yaml
services:
  otterwiki:
    image: redimp/otterwiki:2.27.0
    environment:
      HTML_EXTRA_HEAD: '<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ryan-jan/otterwiki-holt@v0.1.0/holt.css">'
      HTML_EXTRA_BODY: '<script src="https://cdn.jsdelivr.net/gh/ryan-jan/otterwiki-holt@v0.1.0/holt.js"></script>'
```

To upgrade, change the version in both URLs. A new URL means browsers can't show a stale copy.

Each viewer's browser fetches the two files from jsDelivr. If jsDelivr can't be reached, the wiki
still works, but with Otter Wiki's default look.

### Self-hosted

Download `holt.css` and `holt.js` from a [release](https://github.com/ryan-jan/otterwiki-holt/releases)
into a folder mounted at `/app/otterwiki/static/custom`, which is where Otter Wiki keeps its
`custom.css` and `custom.js`. Then point the two settings at them:

```yaml
services:
  otterwiki:
    image: redimp/otterwiki:2.27.0
    volumes:
      - ./custom:/app/otterwiki/static/custom:ro
    environment:
      HTML_EXTRA_HEAD: '<link rel="stylesheet" href="/static/custom/holt.css?v=0.1.0">'
      HTML_EXTRA_BODY: '<script src="/static/custom/holt.js?v=0.1.0"></script>'
```

Otter Wiki ignores the `?v=`, but browsers treat it as part of the address. Change it when you
upgrade, so they fetch the new files. Nothing in Holt contacts any other server.

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

Please open an issue if something breaks on a newer Otter Wiki.

## Updating the icons

The Lucide icons are SVGs embedded in `holt.css`, each followed by a comment naming it, like
`/* lucide house */`. `tools/inline-icons.py` fetches every named icon from `lucide-static` at the
version set in the script and rewrites them. To change an icon, change its name in the comment and
run the script.

## Licence

MIT. See [LICENSE](LICENSE). The embedded [Lucide](https://lucide.dev) icons are under the ISC
licence. See [LICENSE-lucide](LICENSE-lucide).
