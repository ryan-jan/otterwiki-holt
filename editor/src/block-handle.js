// Holt's block handle, in place of Crepe's, with Notion's behaviour. The + adds a block below, or
// above with Option or Alt, and opens the / menu. The ⋮⋮ drags, and a click opens a menu to
// turn the block into another kind, duplicate it or delete it. Each has Notion's tooltip.
//
// A touch screen has no hover, and no room beside the text for both buttons. There the ⋮⋮ alone
// shows beside the block you tap into, and its menu also adds and moves blocks.

import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { block, BlockProvider } from '@milkdown/kit/plugin/block';
import {
  createCodeBlockCommand,
  paragraphSchema,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';

import { currentBlock, move } from './block-keys.js';
import * as icons from './icons.js';

const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const ALT = mac ? 'Option' : 'Alt';
const DUPLICATE_KEY = mac ? '⌘D' : 'Ctrl+D';
const touch = () => window.matchMedia('(hover: none)').matches;

let tooltip = null;

function showTooltip(anchor, lines) {
  hideTooltip();
  if (touch()) return;
  tooltip = document.createElement('div');
  tooltip.className = 'holt-block-tooltip';
  for (const [key, rest] of lines) {
    const line = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = key;
    line.append(strong, ` ${rest}`);
    tooltip.append(line);
  }
  document.body.append(tooltip);
  const box = anchor.getBoundingClientRect();
  tooltip.style.left = `${Math.max(8, box.left + box.width / 2 - tooltip.offsetWidth / 2)}px`;
  tooltip.style.top = `${box.top - tooltip.offsetHeight - 6}px`;
}

function hideTooltip() {
  tooltip?.remove();
  tooltip = null;
}

function item(icon, title) {
  const element = document.createElement('div');
  element.className = 'operation-item';
  element.innerHTML = `<span class="milkdown-icon">${icon}</span>`;
  element.setAttribute('aria-label', title);
  return element;
}

// Turning into another kind works on text blocks. Lists, quotes, tables and Otter Wiki blocks can
// still be duplicated and deleted.
const TURN_INTO = [
  { label: 'Text', icon: icons.text, run: (c) => c.call(turnIntoTextCommand.key), is: (n) => n.type.name === 'paragraph' },
  ...[1, 2, 3].map((level) => ({
    label: `Heading ${level}`,
    icon: icons[`h${level}`],
    run: (c) => c.call(wrapInHeadingCommand.key, level),
    is: (n) => n.type.name === 'heading' && n.attrs.level === level,
  })),
  { label: 'Bulleted list', icon: icons.bulletList, run: (c) => c.call(wrapInBulletListCommand.key) },
  { label: 'Numbered list', icon: icons.orderedList, run: (c) => c.call(wrapInOrderedListCommand.key) },
  { label: 'Quote', icon: icons.quote, run: (c) => c.call(wrapInBlockquoteCommand.key) },
  { label: 'Code', icon: icons.code, run: (c) => c.call(createCodeBlockCommand.key) },
];

class HoltBlockHandle {
  #ctx;
  #provider;
  #content;
  #menu = null;
  // The block the handle was last hovered for, in case the provider has let go of it by the click.
  #target = null;

  constructor(ctx) {
    this.#ctx = ctx;
    const content = document.createElement('div');
    content.className = 'milkdown-block-handle';
    const add = item(icons.plus, 'Add a block');
    const drag = item(icons.drag, 'Drag to move, or click for the block menu');
    content.append(add, drag);
    this.#content = content;

    // Pointer events stop the block plugin starting a drag from the +.
    add.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      add.classList.add('active');
    });
    add.addEventListener('pointerup', (event) => {
      event.preventDefault();
      event.stopPropagation();
      add.classList.remove('active');
      hideTooltip();
      this.#add(event.altKey);
    });
    add.addEventListener('mouseenter', () =>
      showTooltip(add, [['Click', 'to add below'], [`${ALT}-click`, 'to add above']]),
    );
    drag.addEventListener('mouseenter', () =>
      showTooltip(drag, [['Drag', 'to move'], ['Click', 'to open menu']]),
    );
    for (const element of [add, drag]) {
      element.addEventListener('mouseenter', () => {
        this.#target = this.#provider.active ?? this.#target;
      });
      element.addEventListener('mouseleave', hideTooltip);
    }
    drag.addEventListener('dragstart', hideTooltip);
    drag.addEventListener('click', () => {
      hideTooltip();
      this.#openMenu(drag);
    });

    this.#provider = new BlockProvider({
      ctx,
      content,
      getOffset: () => (touch() ? 2 : 16),
      // As Crepe places it: level with the first line of a tall block, centred on a short one.
      getPlacement: ({ active, blockDom }) => {
        if (active.node.type.name === 'heading' || touch()) return 'left';
        let descendants = 0;
        active.node.descendants((node) => {
          descendants += node.childCount;
        });
        const style = getComputedStyle(active.el);
        const height =
          active.el.getBoundingClientRect().height -
          (parseInt(style.paddingTop, 10) || 0) -
          (parseInt(style.paddingBottom, 10) || 0);
        return descendants > 2 || blockDom.getBoundingClientRect().height < height ? 'left-start' : 'left';
      },
    });
    this.update();

    // A finger moving over the page would show the handle for whatever is under it, as a mouse
    // does, so only a mouse drives the block plugin's hover.
    requestAnimationFrame(() => {
      ctx.get(editorViewCtx).dom.parentElement?.addEventListener(
        'pointermove',
        (event) => {
          if (event.pointerType !== 'mouse') event.stopPropagation();
        },
        true,
      );
    });

    // The block plugin hides the handle on any keydown, so holding Option or Alt to add above would
    // take the + away from under the pointer. A modifier key on its own does nothing in the editor.
    requestAnimationFrame(() => {
      ctx.get(editorViewCtx).dom.parentElement?.addEventListener(
        'keydown',
        (event) => {
          if (['Alt', 'Shift', 'Meta', 'Control'].includes(event.key)) event.stopPropagation();
        },
        true,
      );
    });
  }

  update = (view, prevState) => {
    this.#provider.update();
    if (touch() && view && prevState) this.#followCursor(view, prevState);
  };

  #moved = false;

  // On a touch screen the handle shows beside the block with the cursor, once the cursor moves
  // there, and hides while you type.
  #followCursor(view, prevState) {
    // Moving a block from the menu keeps the handle beside it, ready to move it again.
    const moved = this.#moved;
    this.#moved = false;
    if (!moved && !view.state.doc.eq(prevState.doc)) {
      this.#provider.hide();
      return;
    }
    if (!moved && (view.state.selection.eq(prevState.selection) || !view.hasFocus())) return;
    const block = currentBlock(view.state);
    const el = block && view.nodeDOM(block.pos);
    if (!(el instanceof HTMLElement)) {
      this.#provider.hide();
      return;
    }
    this.#target = { node: block.node, $pos: view.state.doc.resolve(block.pos), el };
    this.#provider.show(this.#target);
  }

  destroy = () => {
    this.#closeMenu();
    hideTooltip();
    this.#provider.destroy();
    this.#content.remove();
  };

  // Like Notion, the new block starts with a / so the block menu opens on it.
  #add(above, active = this.#provider.active ?? this.#target) {
    if (!active) return;
    const view = this.#ctx.get(editorViewCtx);
    const pos = above ? active.$pos.pos : active.$pos.pos + active.node.nodeSize;
    // Beside a list item, the new block is another item in the list. Crepe has no / menu in lists,
    // so it starts empty.
    const listItem = active.node.type.name === 'list_item';
    const paragraph = paragraphSchema.type(this.#ctx).create(null, listItem ? null : view.state.schema.text('/'));
    const block = listItem ? active.node.type.create(null, paragraph) : paragraph;
    let tr = view.state.tr.insert(pos, block);
    tr = tr.setSelection(TextSelection.create(tr.doc, pos + 2));
    view.focus();
    view.dispatch(tr.scrollIntoView());
    this.#provider.hide();
  }

  #openMenu(anchor) {
    this.#closeMenu();
    const active = this.#provider.active ?? this.#target;
    if (!active) return;
    const view = this.#ctx.get(editorViewCtx);
    const { node } = active;
    const pos = active.$pos.pos;

    const menu = document.createElement('div');
    menu.className = 'holt-block-menu';
    menu.setAttribute('role', 'menu');
    const button = (icon, label, run, current = false, shortcut = '') => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'holt-block-menu-item';
      element.setAttribute('role', 'menuitem');
      element.innerHTML = `<span class="milkdown-icon">${icon}</span>`;
      element.append(label);
      if (shortcut) {
        const hint = Object.assign(document.createElement('kbd'), { className: 'holt-block-menu-shortcut' });
        hint.textContent = shortcut;
        element.append(hint);
      }
      if (current) element.setAttribute('aria-current', 'true');
      element.addEventListener('click', () => {
        this.#closeMenu();
        run();
        view.focus();
      });
      menu.append(element);
    };
    const heading = (label) => {
      const element = document.createElement('div');
      element.className = 'holt-block-menu-heading';
      element.textContent = label;
      menu.append(element);
    };

    if (node.isTextblock && node.type !== view.state.schema.nodes.code_block) {
      heading('Turn into');
      for (const option of TURN_INTO) {
        button(option.icon, option.label, () => {
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1, pos + node.nodeSize - 1)));
          option.run(this.#ctx.get(commandsCtx));
        }, option.is?.(node) ?? false);
      }
      menu.append(Object.assign(document.createElement('div'), { className: 'holt-block-menu-divider' }));
    }
    if (touch()) {
      button(icons.plus, 'Add below', () => this.#add(false, active));
      button(icons.plus, 'Add above', () => this.#add(true, active));
      const moveBlock = (up) => () => {
        view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos + 1))));
        this.#moved = true;
        move(up)(view.state, view.dispatch);
      };
      button(icons.arrowUp, 'Move up', moveBlock(true));
      button(icons.arrowDown, 'Move down', moveBlock(false));
    }
    button(icons.copy, 'Duplicate', () => {
      const tr = view.state.tr.insert(pos + node.nodeSize, node);
      view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos + node.nodeSize)));
    }, false, touch() ? '' : DUPLICATE_KEY);
    button(icons.remove, 'Delete', () => view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize)));

    document.body.append(menu);
    const box = anchor.getBoundingClientRect();
    const top = Math.min(box.bottom + 4, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(8, box.left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    this.#menu = menu;
    menu.querySelector('button')?.focus();

    this.#dismiss = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && menu.contains(event.target)) return;
      this.#closeMenu();
      if (event.type === 'keydown') view.focus();
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', this.#dismiss, true);
      document.addEventListener('keydown', this.#dismiss, true);
    });
  }

  #dismiss = null;

  #closeMenu() {
    this.#menu?.remove();
    this.#menu = null;
    if (this.#dismiss) {
      document.removeEventListener('pointerdown', this.#dismiss, true);
      document.removeEventListener('keydown', this.#dismiss, true);
    }
  }
}

// Replaces the view Crepe's block-edit feature gives the block plugin, so it must be configured
// after the editor's features.
export const holtBlockHandle = (ctx) => {
  ctx.set(block.key, { view: () => new HoltBlockHandle(ctx) });
};

