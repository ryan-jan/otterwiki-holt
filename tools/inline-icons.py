#!/usr/bin/env python3
"""Embed Lucide icons in holt.css as data URIs, so the theme needs no other files.

Each icon in holt.css is followed by a comment naming it, like `url("data:...") /* lucide house */`.
This script fetches every named icon from lucide-static at the version below and rewrites its data
URI. To change an icon, change the name in its comment and run the script again.

    tools/inline-icons.py
"""

import re
import urllib.parse
import urllib.request
from pathlib import Path

LUCIDE_VERSION = "1.70.0"
SOURCE = "https://cdn.jsdelivr.net/npm/lucide-static@{version}/icons/{name}.svg"
CSS = Path(__file__).resolve().parent.parent / "holt.css"

# A data URI, or a lucide-static URL from before the icons were embedded, then the naming comment.
ICON = re.compile(r'url\("(?:data:image/svg\+xml,[^"]*|https://cdn\.jsdelivr\.net/npm/lucide-static@[^/]+/icons/[a-z0-9-]+\.svg)"\)(?P<rest>[^\n]*?)/\* lucide (?P<name>[a-z0-9-]+) \*/')


def data_uri(svg: str) -> str:
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    svg = re.sub(r'\s*class="[^"]*"', "", svg)
    svg = re.sub(r"\s+", " ", svg).replace("> <", "><").strip().replace('"', "'")
    return "data:image/svg+xml," + urllib.parse.quote(svg, safe=" '=/:;,.-")


def main() -> None:
    css = CSS.read_text()
    cache: dict[str, str] = {}

    def fetch(name: str) -> str:
        if name not in cache:
            url = SOURCE.format(version=LUCIDE_VERSION, name=name)
            with urllib.request.urlopen(url) as response:
                cache[name] = data_uri(response.read().decode())
        return cache[name]

    css, count = ICON.subn(lambda m: f'url("{fetch(m["name"])}"){m["rest"]}/* lucide {m["name"]} */', css)
    CSS.write_text(css)
    print(f"Embedded {count} icons ({len(cache)} distinct) from lucide-static {LUCIDE_VERSION}.")


if __name__ == "__main__":
    main()
