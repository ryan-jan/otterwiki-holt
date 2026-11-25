// Typing [[ opens a page picker, like Notion's @ and [[ links. It filters the wiki's pages as you
// type, and picking one inserts the same wiki link as the wiki link dialog. The last row links to
// exactly what was typed, which Otter Wiki treats as a link to a new page.

import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

import { formatWikilink } from './dialect.js';
import * as icons from './icons.js';
import { wikiPages } from './otter.js';
import { otterInlineSchema } from './plugins.js';

const TRIGGER = /\[\[([^\][|\n]*)$/;
const MAX = 8;

export const pageLinkPicker = $prose((ctx) => {
  let popup = null;
  let options = [];
  let active = 0;
  let range = null;
  // Escape leaves the [[ as typed. It stays closed until the trigger moves or goes.
  let dismissed = null;
  let pages = null;

  const close = () => {
    popup?.remove();
    popup = null;
    range = null;
  };

  const choose = (view, target) => {
    if (!range) return;
    const node = otterInlineSchema.type(ctx).create({ raw: formatWikilink(target, target) });
    view.dispatch(view.state.tr.replaceWith(range.from, range.to, node));
    close();
    view.focus();
  };

  const select = (i) => {
    active = (i + options.length) % options.length;
    options.forEach((option, j) => option.setAttribute('aria-selected', String(j === active)));
    options[active]?.scrollIntoView({ block: 'nearest' });
  };

  const matches = (query) => {
    pages ??= wikiPages();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const lower = query.toLowerCase().trim();
    return pages
      .filter((page) => terms.every((term) => page.toLowerCase().includes(term)))
      .sort((a, b) => Number(b.toLowerCase().startsWith(lower)) - Number(a.toLowerCase().startsWith(lower)) || a.localeCompare(b))
      .slice(0, MAX);
  };

  const row = (view, icon, label, detail, target) => {
    const option = document.createElement('div');
    option.className = 'holt-page-link-option';
    option.setAttribute('role', 'option');
    option.innerHTML = `<span class="milkdown-icon">${icon}</span>`;
    const text = document.createElement('span');
    text.className = 'holt-page-link-label';
    text.textContent = label;
    option.append(text);
    if (detail) {
      const sub = document.createElement('span');
      sub.className = 'holt-page-link-detail';
      sub.textContent = detail;
      option.append(sub);
    }
    // Keep the editor's focus and selection while clicking.
    option.addEventListener('mousedown', (event) => event.preventDefault());
    option.addEventListener('click', () => choose(view, target));
    return option;
  };

  const render = (view, query) => {
    popup ??= Object.assign(document.createElement('div'), { className: 'holt-page-link' });
    popup.setAttribute('role', 'listbox');
    popup.replaceChildren();
    const heading = Object.assign(document.createElement('div'), { className: 'holt-page-link-heading' });
    heading.textContent = 'Link to page';
    popup.append(heading);
    const found = matches(query);
    options = found.map((page) => {
      const parts = page.split('/');
      return row(view, icons.text, parts.at(-1), parts.slice(0, -1).join(' / '), page);
    });
    const name = query.trim();
    if (name && !found.some((page) => page.toLowerCase() === name.toLowerCase())) {
      options.push(row(view, icons.plus, `Link to “${name}”`, found.length ? '' : 'No page has that name yet', name));
    }
    if (!options.length) {
      const empty = Object.assign(document.createElement('div'), { className: 'holt-page-link-empty' });
      empty.textContent = 'Type a page name';
      popup.append(empty);
    }
    popup.append(...options);
    active = Math.min(active, Math.max(options.length - 1, 0));
    select(active);
    if (!popup.isConnected) document.body.append(popup);

    const caret = view.coordsAtPos(range.from);
    const left = Math.min(caret.left, window.innerWidth - popup.offsetWidth - 8);
    const below = caret.bottom + 6;
    const top = below + popup.offsetHeight > window.innerHeight ? caret.top - popup.offsetHeight - 6 : below;
    popup.style.left = `${Math.max(8, left)}px`;
    popup.style.top = `${Math.max(8, top)}px`;
  };

  return new Plugin({
    key: new PluginKey('holt-page-link'),
    view: () => ({
      update(view) {
        const { selection } = view.state;
        const { $from } = selection;
        if (!selection.empty || $from.parent.type.spec.code) {
          close();
          return;
        }
        const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 100), $from.parentOffset, undefined, '￼');
        const match = TRIGGER.exec(before);
        const from = match && $from.pos - match[0].length;
        if (!match || from === dismissed) {
          if (!match) dismissed = null;
          close();
          return;
        }
        if (range?.from !== from) active = 0;
        range = { from, to: $from.pos };
        render(view, match[1]);
      },
      destroy: close,
    }),
    props: {
      handleKeyDown(view, event) {
        if (!popup) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          select(active + (event.key === 'ArrowDown' ? 1 : -1));
          return true;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && options.length) {
          options[active].click();
          return true;
        }
        if (event.key === 'Escape') {
          dismissed = range.from;
          close();
          return true;
        }
        return false;
      },
    },
  });
});
