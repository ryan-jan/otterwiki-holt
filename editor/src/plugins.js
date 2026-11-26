// Milkdown plugins that teach the editor Otter Wiki's inline syntax and stop plain text from
// turning into syntax by accident.

import { remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { markRule } from '@milkdown/kit/prose';
import { $command, $inputRule, $markSchema, $nodeSchema, $remark, $view } from '@milkdown/kit/utils';

import {
  INLINE_PATTERN,
  MARK_PATTERN,
  formatWikilink,
  inlineKind,
  liftContainers,
  otterContainerToMarkdown,
  parseWikilink,
} from './dialect.js';
import { askWikilink } from './dialogs.js';

// mdast doesn't descend into these, so their text is never syntax.
const LITERAL_PARENTS = new Set(['inlineCode', 'code', 'html', 'link', 'linkReference']);

function splitText(tree, pattern, build) {
  const visit = (node) => {
    if (!node.children || LITERAL_PARENTS.has(node.type)) return;
    const children = [];
    for (const child of node.children) {
      if (child.type !== 'text') {
        visit(child);
        children.push(child);
        continue;
      }
      let last = 0;
      for (const match of child.value.matchAll(pattern)) {
        if (match.index > last) children.push({ type: 'text', value: child.value.slice(last, match.index) });
        children.push(build(match));
        last = match.index + match[0].length;
      }
      if (last < child.value.length) children.push({ type: 'text', value: child.value.slice(last) });
    }
    node.children = children;
  };
  visit(tree);
}

// Text such as [[Page]] reaches remark as plain text, so it's lifted into its own nodes here.
// Escaped text (\[\[Page]]) arrives unescaped too, which the round-trip check catches.
export const otterRemark = $remark('otterRemark', () => function () {
  const data = this.data();
  (data.toMarkdownExtensions ??= []).push({
    handlers: {
      otterMark: (node, _, state, info) => `==${state.containerPhrasing(node, info)}==`,
      otterContainer: otterContainerToMarkdown,
    },
    // Characters that would start Otter syntax if written out unescaped. Text typed in the rich
    // editor can then never become a fancy block, a highlight, maths or a wiki link by accident.
    unsafe: [
      { character: ':', atBreak: true, after: '::' },
      { character: '~', atBreak: true, after: '~~' },
      { character: '=', after: '=' },
      { character: '$' },
      { character: '[', after: '[\\[\\^]' },
      { character: '{', after: '\\{' },
      { character: '*', atBreak: true, after: '\\[' },
    ],
  });
  return (tree) => {
    liftContainers(tree);
    splitText(tree, INLINE_PATTERN, (m) => ({ type: 'otterInline', value: m[0] }));
    splitText(tree, MARK_PATTERN, (m) => ({
      type: 'otterMark',
      children: [{ type: 'text', value: m[1] ?? m[2] }],
    }));
  };
});

export const otterStringify = (ctx) =>
  ctx.update(remarkStringifyOptionsCtx, (prev) => ({
    ...prev,
    bullet: '-',
    emphasis: '*',
    strong: '*',
    fence: '`',
    rule: '-',
    listItemIndent: 'one',
  }));

export const otterMarkSchema = $markSchema('otter_mark', () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', 0],
  parseMarkdown: {
    match: (node) => node.type === 'otterMark',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'otter_mark',
    runner: (state, mark) => {
      state.withMark(mark, 'otterMark');
    },
  },
}));

export const toggleOtterMarkCommand = $command('ToggleOtterMark', (ctx) => () =>
  toggleMark(otterMarkSchema.type(ctx)),
);

export const otterMarkInputRule = $inputRule((ctx) =>
  // markRule takes the last group as the marked text.
  markRule(/(?<![=\\])==([^\s=](?:[^=]*[^\s=])?)==$/, otterMarkSchema.type(ctx)),
);

// Inline syntax kept verbatim. It's written back as an mdast html node, which remark-stringify
// outputs untouched.
export const otterInlineSchema = $nodeSchema('otter_inline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: { raw: { default: '' } },
  parseDOM: [{ tag: 'span[data-otter-raw]', getAttrs: (dom) => ({ raw: dom.dataset.otterRaw }) }],
  toDOM: (node) => ['span', { 'data-otter-raw': node.attrs.raw }, node.attrs.raw],
  parseMarkdown: {
    match: (node) => node.type === 'otterInline',
    runner: (state, node, type) => {
      state.addNode(type, { raw: node.value });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'otter_inline',
    runner: (state, node) => {
      state.addNode('html', undefined, node.attrs.raw);
    },
  },
}));

export const wikilinkInputRule = $inputRule(
  (ctx) =>
    new InputRule(/\[\[([^\]\n]+)\]\]$/, (state, match, start, end) =>
      state.tr.replaceWith(start, end, otterInlineSchema.type(ctx).create({ raw: match[0] })),
    ),
);

const KIND_LABELS = { math: 'Maths', footnote: 'Footnote', embedding: 'Embedding' };

export const otterInlineView = $view(otterInlineSchema.node, () => (node, view, getPos) => {
  const dom = document.createElement('span');
  dom.contentEditable = 'false';

  const render = (raw) => {
    const kind = inlineKind(raw);
    dom.className = `otter-inline otter-inline-${kind ?? 'invalid'}`;
    if (kind === 'wikilink') {
      const { text, target } = parseWikilink(raw);
      dom.textContent = text;
      dom.title = `Wiki link to ${target}. Double-click to change it.`;
    } else {
      dom.textContent = raw;
      dom.title = `${KIND_LABELS[kind] ?? 'Otter Wiki syntax'}. Double-click to edit the source.`;
    }
  };
  render(node.attrs.raw);

  const replace = (raw) => {
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { raw }));
    view.focus();
  };

  dom.addEventListener('dblclick', async (event) => {
    event.preventDefault();
    const raw = node.attrs.raw;
    if (inlineKind(raw) === 'wikilink') {
      const result = await askWikilink(parseWikilink(raw));
      if (result) replace(formatWikilink(result.text, result.target));
      return;
    }
    const edited = window.prompt('Edit the Otter Wiki syntax', raw);
    if (edited === null || edited === raw) return;
    if (inlineKind(edited) === null) {
      window.alert('That isn’t valid inline Otter Wiki syntax, so nothing was changed.');
      return;
    }
    replace(edited);
  });

  return {
    dom,
    update(updated) {
      if (updated.type !== node.type) return false;
      node = updated;
      render(node.attrs.raw);
      return true;
    },
    ignoreMutation: () => true,
    stopEvent: (event) => event.type === 'dblclick',
  };
});

export const otterPlugins = [
  otterRemark,
  otterMarkSchema,
  toggleOtterMarkCommand,
  otterMarkInputRule,
  otterInlineSchema,
  otterInlineView,
  wikilinkInputRule,
].flat();
