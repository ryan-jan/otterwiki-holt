# Rich text editor

The editor opens in rich text mode, with the page in its reading column and Holt's typography, so
it looks as it will once saved. It works much like Notion's editor.

- Type `/` for headings, lists, quotes, tables, code, emoji, wiki links, attachments and Otter Wiki's
  own blocks. Attachment lists the page's attachments, and can upload a new one.
- Hover over a block for its handle. Click `+` to add a block below, or Option-click (Alt-click
  elsewhere) to add one above. Drag `⋮⋮` to move the block, or click it to turn the block into
  another kind, duplicate it or delete it.
- On a touch screen, tap into a block for its `⋮⋮`. Its menu also adds a block above or below and
  moves the block up or down.
- Press ⌘⇧↑ or ⌘⇧↓ (Ctrl+Shift+↑ or ↓ elsewhere) to move the block you're in, and ⌘D (Ctrl+D) to
  duplicate it. In a list, these move or duplicate the list item.
- Type `[[` to link to a page, picked from the wiki's pages as you type.
- Select text for bold, italic, links, highlight and the other formatting.
- On wide screens the floating outline follows the headings as you edit them.

![The rich text editor with the / menu open](../screenshots/editor.png)

## Otter Wiki blocks

Info boxes, alerts, folded sections and spoilers are edited as text, like Notion's callouts and
toggles. Their content can hold formatting, lists, links, quotes, code and other blocks.

- The `/` menu has an item for each type, named for its kind, such as Danger box or Caution alert.
  Type `/caution` for a caution alert, or `/warning` to choose between a warning box and a warning
  alert.
- Change the type of an info box (info, warning, danger or success) from the label in its corner,
  and the type of an alert (note, tip, important, warning or caution) from its header.
- An info box's heading shows while you're in the box. Leave it empty for a box with no heading.
- A folded section's first line is its summary. The arrow folds it while you edit, and it's always
  folded on the page.
- Press Enter on an empty last line to leave a block, and Backspace in an empty block to turn it
  back into text.

Maths, footnotes, abbreviations and the rest of Otter Wiki's syntax show as they'll render, and
their source opens in place to edit. So does any info box, alert, fold or spoiler the editor can't
show as text exactly as Otter Wiki renders it, such as an info box with a heading inside its
content, which Otter Wiki shows as plain text. Saving is refused, with the reason, if an edit would
make Otter Wiki read a block differently, for example a heading added inside an info box.

## Markdown mode

The `</>` button beside Save switches to the Markdown editor, and the wand switches back. Holt
remembers which you prefer, in each browser. Markdown mode has the preview buttons and the
attachment and wiki link panels. Rich mode shows the page as it will look, and inserts wiki links and
attachments from the `/` menu.

## How it keeps pages safe

The page's Markdown is always the master copy. The rich editor keeps it up to date as you type, so
saving, drafts and attachments all work from the Markdown.

A page only opens in rich mode if Otter Wiki renders it exactly the same after a round trip through
the rich editor, so the editor can't change a page you didn't edit. Any other page opens in Markdown
mode, and the wand explains why.

Once you change something, the rich editor writes out the whole page in its own style. The page
renders the same, but some Markdown may be laid out differently, such as padded table columns, so
the diff can include lines you didn't touch.

## Turning it off

The editor is about 850 KB, or 270 KB compressed, and only edit pages load it. The emoji data loads
the first time the emoji picker opens. To use only the Markdown editor, add `data-editor="off"` to
Holt's script tag:

```yaml
      HTML_EXTRA_BODY: '<script src="https://cdn.jsdelivr.net/gh/ryan-jan/otterwiki-holt@v0.7.0/holt.js" data-editor="off"></script>'
```
