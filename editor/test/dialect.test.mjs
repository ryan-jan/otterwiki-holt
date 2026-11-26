import { test } from 'node:test';
import assert from 'node:assert/strict';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';

import {
  CONTAINER_KINDS,
  MARK_PATTERN,
  RAW_LANG,
  formatContainer,
  inlineKind,
  liftContainers,
  otterContainerToMarkdown,
  parseContainer,
  protect,
  segment,
  unprotect,
  validateRaw,
} from '../src/dialect.js';

const page = `---
title: Example
---

# Heading

Some text.
::: info
# Head
With _formatted_ content.
:::

>! Spoiler line one
>! line two

>| # Folded
>| details

> [!NOTE]
> Useful.

> plain quote

$$
a^2+b^2=c^2
$$

\`\`\`python
::: not a block, it's code
\`\`\`

Footnote[^1].

[^1]: A note.
    Continued.

*[HTML]: Hyper Text Markup Language

{{datatable
options
}}
`;

test('segments every block construct', () => {
  const kinds = segment(page).filter((s) => s.kind !== 'markdown').map((s) => s.kind);
  assert.deepEqual(kinds, ['frontmatter', 'fancy', 'spoiler', 'fold', 'alert', 'math', 'footnote', 'abbr', 'embedding']);
});

test('protect then unprotect restores every raw block verbatim', () => {
  const restored = unprotect(protect(page));
  for (const s of segment(page).filter((s) => s.kind !== 'markdown' && !CONTAINER_KINDS.has(s.kind))) {
    assert.ok(restored.includes(s.text), s.kind);
  }
});

test('code blocks are not scanned', () => {
  assert.ok(!segment(page).some((s) => s.kind === 'fancy' && s.text.includes('not a block')));
});

test('raw fences outgrow backticks in the block', () => {
  const md = '$$\n```\n$$';
  assert.equal(unprotect(protect(md)).trim(), md);
});

test('validateRaw rejects broken and spilled blocks', () => {
  assert.equal(validateRaw('::: info\nx\n:::'), null);
  assert.ok(validateRaw('just text'));
  assert.ok(validateRaw('::: info\nx\n:::\nafter'));
});

test('inline kinds', () => {
  assert.equal(inlineKind('[[Page]]'), 'wikilink');
  assert.equal(inlineKind('[[Text|Page]]'), 'wikilink');
  assert.equal(inlineKind('$a^2$'), 'math');
  assert.equal(inlineKind('$$x$$'), 'math');
  assert.equal(inlineKind('[^1]'), 'footnote');
  assert.equal(inlineKind('$ 5$'), null);
  assert.deepEqual([...'a ==b== c ==d e== f'.matchAll(MARK_PATTERN)].map((m) => m[1] ?? m[2]), ['b', 'd e']);
});

test('validateRaw requires fancy blocks to be closed', () => {
  assert.ok(validateRaw('::: info\nx'));
  assert.ok(validateRaw('::: info\nx::'));
  assert.equal(validateRaw('::: info\nx\n:::\n'), null);
});

// The parts of Milkdown's pipeline that handle these blocks: remark, the marker transform and the
// stringify handler.
const processor = unified()
  .use(remarkParse)
  .use(() => liftContainers)
  .use(remarkStringify, { bullet: '-', fence: '`', handlers: { otterContainer: otterContainerToMarkdown } });

function lift(md) {
  return processor.runSync(processor.parse(protect(md)));
}

function roundTrip(md) {
  return unprotect(processor.stringify(lift(md))).trim();
}

const only = (md) => {
  const { children } = lift(md);
  assert.equal(children.length, 1, md);
  return children[0];
};

test('parses each kind with its attributes, as Otter Wiki does', () => {
  const cases = [
    ['::: info\n# Tip\nText\n:::', 'fancy', { family: 'info', title: 'Tip' }],
    [':::Warning\nText\n:::', 'fancy', { family: 'warning', title: null }],
    ['::: danger  \n#Heading\nText\n:::', 'fancy', { family: 'danger', title: 'Heading' }],
    ['> [!note]\n> Text', 'alert', { type: 'NOTE' }],
    ['> [!CAUTION] First line\n> Text', 'alert', { type: 'CAUTION' }],
    ['>| # Summary\n>| Text', 'fold', { title: 'Summary' }],
    ['>|#Summary\n>|Text', 'fold', { title: 'Summary' }],
    ['>| Text only', 'fold', { title: null }],
    ['>! Hidden\n>! text', 'spoiler', {}],
  ];
  for (const [md, kind, attrs] of cases) {
    const node = only(md);
    assert.equal(node.type, 'otterContainer', md);
    assert.equal(node.kind, kind, md);
    assert.deepEqual(node.attrs, attrs, md);
  }
});

test('parses the content as Markdown', () => {
  const node = only('>| # Keys\n>| In the **blue** tin.\n>|\n>| - one\n>| - two');
  assert.deepEqual(node.children.map((c) => c.type), ['paragraph', 'list']);
  assert.equal(only('> [!TIP] Same line\n> next line').children[0].children[0].value, 'Same line\nnext line');
});

test('writes each kind back as the syntax it came from', () => {
  for (const md of [
    '::: info\n# Tip\nInfo boxes have an optional heading.\n:::',
    '::: warning\nNo heading.\n\n- a list\n- inside\n:::',
    '> [!NOTE]\n> An alert.',
    '> [!WARNING]\n> Two\n>\n> paragraphs.',
    '>| # A folded section\n>| With hidden details.',
    '>| No heading.',
    '>! A spoiler.',
  ]) {
    assert.equal(roundTrip(md), md);
  }
});

test('writes unusual spacing back in a form Otter Wiki reads the same', () => {
  for (const md of [':::info\nText\n:::', '> [!tip] Same line\n> next', '>|#Summary\n>|Text', '>!Hidden']) {
    const out = roundTrip(md);
    const [before] = segment(md);
    const [after] = segment(out);
    assert.equal(after.kind, before.kind, out);
    assert.deepEqual(parseContainer(after.kind, out).attrs, parseContainer(before.kind, md).attrs, out);
    assert.equal(roundTrip(out), out, 'stable once written');
  }
});

test('nests blocks, and raw blocks inside them', () => {
  const md = '>| # Spare keys\n>| Text\n>|\n>| > [!NOTE]\n>| > Inside a fold.\n>|\n>| $$\n>| x^2\n>| $$';
  const node = only(md);
  assert.deepEqual(node.children.map((c) => c.kind ?? c.lang ?? c.type), ['paragraph', 'alert', RAW_LANG]);
  assert.equal(roundTrip(md), md);
  assert.equal(roundTrip('> [!NOTE]\n> > A quote.'), '> [!NOTE]\n> > A quote.');
});

test('keeps blocks the editor can\'t represent as raw blocks', () => {
  for (const md of [
    '::: info\n# Head\n## A heading Otter Wiki shows as text\n:::',
    '::: info\nText\n===\n:::',
    '>! Two\n>!\n>! paragraphs',
    '>! - a list',
    '> [!NOTE]',
    '::: info\n```\nunclosed\n:::',
    '::: info\n<pre>\nunclosed\n:::',
    ':::: info\nOpened with four colons, closed with three.\n:::',
  ]) {
    const node = only(md);
    assert.equal(node.type, 'code', md);
    assert.equal(node.lang, RAW_LANG, md);
    assert.equal(roundTrip(md), md);
  }
});

test('a heading with no content keeps the blank line Otter Wiki needs to read it', () => {
  const md = formatContainer('fancy', { family: 'info', title: 'Only a heading' }, '');
  assert.equal(md, '::: info\n# Only a heading\n\n:::');
  assert.equal(parseContainer('fancy', md).attrs.title, 'Only a heading');
});

test('an empty title is left out', () => {
  assert.equal(formatContainer('fold', { title: '  ' }, 'Text'), '>| Text');
  assert.equal(formatContainer('alert', { type: 'TIP' }, ''), '> [!TIP]\n>');
  assert.equal(formatContainer('spoiler', {}, ''), '>!');
});
