// Info boxes, alerts, folds and spoilers as Milkdown nodes, so their content is edited like any
// other text. dialect.js turns the Markdown into otterContainer nodes and writes them back.

import { blockContainerTypes } from '@milkdown/kit/preset/commonmark';
import { keymap } from '@milkdown/kit/prose/keymap';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $nodeSchema, $prose, $view } from '@milkdown/kit/utils';

import { ALERT_TYPES, FANCY_FAMILIES, RAW_LANG } from './dialect.js';

// The editable title of an info box or a fold. Otter Wiki writes it out as plain text.
export const otterTitleSchema = $nodeSchema('otter_title', () => ({
  content: 'text*',
  marks: '',
  defining: true,
  parseDOM: [{ tag: 'div.otter-block-title' }],
  toDOM: () => ['div', { class: 'otter-block-title' }, 0],
  // Its block reads and writes it, as the block's title attribute.
  parseMarkdown: { match: () => false, runner: () => {} },
  toMarkdown: { match: () => false, runner: () => {} },
}));

function containerSchema(id, kind, { attrs = {}, titled = false, content }) {
  const textblock = content === 'inline*';
  return $nodeSchema(id, (ctx) => ({
    group: 'block',
    content: titled ? `otter_title ${content}` : content,
    defining: true,
    attrs,
    parseDOM: [
      {
        tag: `div[data-otter-block="${kind}"]`,
        getAttrs: (dom) => JSON.parse(dom.dataset.attrs || '{}'),
      },
    ],
    toDOM: (node) => [
      'div',
      { 'data-otter-block': kind, 'data-attrs': JSON.stringify(node.attrs) },
      0,
    ],
    parseMarkdown: {
      match: (node) => node.type === 'otterContainer' && node.kind === kind,
      runner: (state, node, type) => {
        const { title, ...rest } = node.attrs;
        state.openNode(type, rest);
        if (titled) {
          state.openNode(otterTitleSchema.type(ctx));
          if (title) state.addText(title);
          state.closeNode();
        }
        state.next(textblock ? (node.children[0]?.children ?? []) : node.children);
        state.closeNode();
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === id,
      runner: (state, node) => {
        const blockAttrs = titled ? { ...node.attrs, title: node.firstChild.textContent } : node.attrs;
        state.openNode('otterContainer', undefined, { kind, attrs: blockAttrs });
        if (textblock) {
          state.openNode('paragraph');
          state.next(node.content);
          state.closeNode();
        } else {
          node.forEach((child, _, index) => {
            if (!titled || index > 0) state.next(child);
          });
        }
        state.closeNode();
      },
    },
  }));
}

export const otterFancySchema = containerSchema('otter_fancy', 'fancy', {
  attrs: { family: { default: 'info' } },
  titled: true,
  content: 'block+',
});
export const otterAlertSchema = containerSchema('otter_alert', 'alert', {
  attrs: { type: { default: 'NOTE' } },
  content: 'block+',
});
export const otterFoldSchema = containerSchema('otter_fold', 'fold', { titled: true, content: 'block+' });
export const otterSpoilerSchema = containerSchema('otter_spoiler', 'spoiler', { content: 'inline*' });

const CONTAINERS = new Set(['otter_fancy', 'otter_alert', 'otter_fold', 'otter_spoiler']);
const TITLED = new Set(['otter_fancy', 'otter_fold']);
const isContainer = (node) => CONTAINERS.has(node.type.name);

// The classes Otter Wiki gives each kind, so Holt's page styles apply in the editor too.
function fancyClass(family) {
  const named = { info: 'primary', blue: 'primary', warning: 'secondary', yellow: 'secondary', danger: 'danger', red: 'danger', success: 'success', green: 'success' };
  if (['none', 'empty', ''].includes(family)) return 'alert';
  return `alert alert-${named[family] ?? family}`;
}

const ALERT_ICONS = {
  NOTE: 'fas fa-info-circle',
  TIP: 'far fa-lightbulb',
  IMPORTANT: 'far fa-comment-alt',
  WARNING: 'fas fa-exclamation-triangle',
  CAUTION: 'fas fa-exclamation-circle',
};

const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

function element(tag, className, props = {}) {
  const el = Object.assign(document.createElement(tag), props);
  if (className) el.className = className;
  return el;
}

// A select that changes one attribute of the block, like the language label on code blocks.
function typeSelect(values, current, label, onChange) {
  const select = element('select', 'otter-block-type', { title: label });
  select.setAttribute('aria-label', label);
  const fill = (value) => {
    const options = values.includes(value) ? values : [...values, value];
    select.replaceChildren(
      ...options.map((option) => element('option', '', { value: option, textContent: capitalise(option) || 'None' })),
    );
    select.value = value;
  };
  fill(current);
  select.addEventListener('change', () => onChange(select.value));
  return { select, fill };
}

function blockView(node, view, getPos) {
  const kind = node.type.name;
  const dom = element('div', 'otter-block');
  const controls = element('div', 'otter-block-controls', { contentEditable: 'false' });
  const content = element('div', 'otter-block-content');

  const setAttr = (name, value) => {
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.setNodeAttribute(pos, name, value));
    view.focus();
  };

  // The type's classes are swapped on their own, because ProseMirror adds otter-block-active.
  let typeClasses = [];
  const setTypeClasses = (classes) => {
    dom.classList.remove(...typeClasses);
    typeClasses = classes.split(' ');
    dom.classList.add(...typeClasses);
  };

  let refresh = () => {};
  if (kind === 'otter_fancy') {
    const { select, fill } = typeSelect(FANCY_FAMILIES, node.attrs.family, 'Info box type', (value) => setAttr('family', value));
    controls.append(select);
    dom.classList.add('mb-20', 'otter-fancy');
    refresh = () => {
      setTypeClasses(fancyClass(node.attrs.family));
      if (document.activeElement !== select) fill(node.attrs.family);
    };
  } else if (kind === 'otter_alert') {
    const icon = element('i', '');
    const { select, fill } = typeSelect(ALERT_TYPES, node.attrs.type, 'Alert type', (value) => setAttr('type', value));
    controls.classList.add('quote-alert-header');
    controls.append(icon, select);
    dom.classList.add('otter-alert');
    refresh = () => {
      setTypeClasses(`quote-alert quote-alert-${node.attrs.type.toLowerCase()}`);
      icon.className = ALERT_ICONS[node.attrs.type] ?? '';
      if (document.activeElement !== select) fill(node.attrs.type);
    };
  } else if (kind === 'otter_fold') {
    const toggle = element('button', 'otter-fold-toggle', { type: 'button', title: 'Fold or unfold' });
    toggle.addEventListener('click', () => dom.classList.toggle('otter-fold-closed'));
    controls.append(toggle);
    dom.classList.add('collapse-panel', 'otter-fold');
  } else {
    controls.append(element('i', 'far fa-eye', { title: 'Spoiler' }));
    dom.classList.add('spoiler', 'otter-spoiler');
  }

  const titled = TITLED.has(kind);
  const update = () => {
    refresh();
    if (titled) dom.classList.toggle('otter-block-untitled', node.firstChild.content.size === 0);
  };
  dom.append(controls, content);
  update();

  return {
    dom,
    contentDOM: content,
    update(updated) {
      if (updated.type !== node.type) return false;
      node = updated;
      update();
      return true;
    },
    stopEvent: (event) => controls.contains(event.target),
    ignoreMutation: (mutation) => !content.contains(mutation.target),
  };
}

export const otterBlockViews = [otterFancySchema, otterAlertSchema, otterFoldSchema, otterSpoilerSchema].map(
  (schema) => $view(schema.node, () => blockView),
);

// Marks the blocks around the cursor, so an info box shows its empty heading only while it's
// being edited.
const activeBlocks = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const { $from } = state.selection;
          const decorations = [];
          for (let depth = $from.depth; depth > 0; depth--) {
            if (isContainer($from.node(depth))) {
              decorations.push(Decoration.node($from.before(depth), $from.after(depth), { class: 'otter-block-active' }));
            }
          }
          return DecorationSet.create(state.doc, decorations);
        },
      },
    }),
);

const unwrap = (state, dispatch, depth) => {
  const { $from } = state.selection;
  const paragraph = state.schema.nodes.paragraph.create();
  const start = $from.before(depth);
  const tr = state.tr.replaceWith(start, $from.after(depth), paragraph);
  dispatch?.(tr.setSelection(TextSelection.create(tr.doc, start + 1)).scrollIntoView());
  return true;
};

// Only an empty title and empty paragraphs, so removing the block loses nothing.
const isBlank = (container) => {
  let blank = true;
  container.forEach((child) => {
    if (child.content.size > 0 || !['otter_title', 'paragraph'].includes(child.type.name)) blank = false;
  });
  return blank;
};

// Backspace at the start of a block's content goes to its title instead of merging into it, and
// empties out of the block. Otherwise ProseMirror would split or lift the block.
const backspace = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset > 0 || $from.depth < 1) return false;
  const parent = $from.parent;
  if (parent.type.name === 'otter_spoiler') {
    dispatch?.(state.tr.setBlockType($from.pos, $from.pos, state.schema.nodes.paragraph));
    return true;
  }
  if (parent.type.name === 'otter_title') {
    if (isBlank($from.node(-1))) return unwrap(state, dispatch, $from.depth - 1);
    return true;
  }
  if ($from.depth < 2) return false;
  const container = $from.node(-1);
  if (!isContainer(container)) return false;
  const first = TITLED.has(container.type.name) ? 1 : 0;
  if ($from.index(-1) !== first) return false;
  if (first) {
    const titleEnd = $from.before() - 1;
    dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, titleEnd)));
    return true;
  }
  if (container.childCount === 1 && parent.content.size === 0) return unwrap(state, dispatch, $from.depth - 1);
  return true;
};

// Enter on an empty last line leaves the block, as in a list. Enter in an empty spoiler turns it
// into text.
const enter = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth < 1) return false;
  const parent = $from.parent;
  if (parent.type.name === 'otter_spoiler') {
    if (parent.content.size > 0) return false;
    dispatch?.(state.tr.setBlockType($from.pos, $from.pos, state.schema.nodes.paragraph));
    return true;
  }
  if ($from.depth < 2 || parent.type.name !== 'paragraph' || parent.content.size > 0) return false;
  const container = $from.node(-1);
  if (!isContainer(container)) return false;
  const first = TITLED.has(container.type.name) ? 1 : 0;
  if ($from.index(-1) !== container.childCount - 1 || container.childCount - first < 2) return false;
  const tr = state.tr.delete($from.before(), $from.after());
  const after = tr.mapping.map($from.after(-1));
  tr.insert(after, state.schema.nodes.paragraph.create());
  dispatch?.(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
  return true;
};

// ArrowUp from the first line of a block's content goes to its title, which the browser can skip
// over while the title is empty.
const arrowUp = (state, dispatch, view) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.depth < 2 || !view?.endOfTextblock('up')) return false;
  const container = $from.node(-1);
  if (!TITLED.has(container.type.name) || $from.index(-1) !== 1) return false;
  dispatch?.(state.tr.setSelection(TextSelection.create(state.doc, $from.before() - 1)).scrollIntoView());
  return true;
};

const otterBlockKeys = $prose(() => keymap({ Backspace: backspace, Enter: enter, ArrowUp: arrowUp }));

// HTML inside these blocks is wrapped in a paragraph, as it is at the top level. It's config, so it
// goes to the editor's .config() rather than .use().
export const otterBlocksConfig = (ctx) =>
  ctx.update(blockContainerTypes.key, (prev) => [...prev, 'otterContainer']);

// A new block from the / menu, in place of the empty paragraph at the cursor.
export function insertOtterBlock(view, kind, attrs = {}) {
  const { schema, selection } = view.state;
  const { $from } = selection;
  const title = () => schema.nodes.otter_title.create();
  const paragraph = () => schema.nodes.paragraph.create();
  const blocks = {
    info: [schema.nodes.otter_fancy.create({ family: 'info', ...attrs }, [title(), paragraph()]), 4],
    alert: [schema.nodes.otter_alert.create({ type: 'NOTE', ...attrs }, [paragraph()]), 2],
    fold: [schema.nodes.otter_fold.create(null, [title(), paragraph()]), 2],
    spoiler: [schema.nodes.otter_spoiler.create(), 1],
  };
  const [node, offset] = blocks[kind];
  // A table cell only holds text.
  if (!$from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), node.type)) return;
  const start = $from.before();
  const tr = view.state.tr.replaceWith(start, $from.after(), node);
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, start + offset)).scrollIntoView());
  view.focus();
}

// Content Otter Wiki would read differently from how the editor shows it. A save is refused until
// it's fixed, like a broken raw block.
const CLOSES_FANCY = /^\s*(:{3,}|~{3,})[~:]* *$/m;
const PREFIXED = new Set(['otter_alert', 'otter_fold', 'otter_spoiler', 'blockquote']);

function fancyProblems(fancy) {
  const problems = [];
  const visit = (node) =>
    node.forEach((child) => {
      if (PREFIXED.has(child.type.name)) return;
      if (child.type.name === 'heading') {
        problems.push('Info boxes can’t hold headings. Otter Wiki shows them as plain text.');
      } else if (child.type.name === 'otter_fancy') {
        problems.push('An info box can’t hold another info box.');
      } else if (child.type.name === 'code_block' && CLOSES_FANCY.test(child.textContent)) {
        problems.push(
          child.attrs.language === RAW_LANG
            ? 'An info box can’t hold another info box.'
            : 'Code in an info box can’t have a line of only ::: or ~~~, which would end the box.',
        );
      } else {
        visit(child);
      }
    });
  visit(fancy);
  return problems;
}

export function invalidOtterBlocks(doc) {
  const problems = [];
  doc.descendants((node) => {
    if (node.type.name === 'otter_fancy') problems.push(...fancyProblems(node));
    if (node.type.name === 'otter_fold' && node.firstChild.content.size > 0) {
      let empty = true;
      node.forEach((child, _, index) => {
        if (index > 0 && !(child.type.name === 'paragraph' && child.content.size === 0)) empty = false;
      });
      if (empty) problems.push('A folded section with a summary needs some text inside it.');
    }
    return true;
  });
  return [...new Set(problems)];
}

export const otterBlocks = [
  otterTitleSchema,
  otterFancySchema,
  otterAlertSchema,
  otterFoldSchema,
  otterSpoilerSchema,
  otterBlockViews,
  activeBlocks,
  otterBlockKeys,
].flat();
