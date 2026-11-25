import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protect, unprotect, segment, validateRaw, inlineKind, MARK_PATTERN } from '../src/dialect.js';

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
  for (const s of segment(page).filter((s) => s.kind !== 'markdown')) {
    assert.ok(restored.includes(s.text), s.kind);
  }
});

test('code blocks are not scanned', () => {
  assert.ok(!segment(page).some((s) => s.kind === 'fancy' && s.text.includes('not a block')));
});

test('raw fences outgrow backticks in the block', () => {
  const md = '::: info\n```\ncode\n```\n:::';
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
