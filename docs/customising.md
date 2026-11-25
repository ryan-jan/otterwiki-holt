# Customising

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
`holt.css`, and can be overridden the same way. The rich text editor uses the same variables.

## Browser caching

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
