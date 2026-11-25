// Otter Wiki's Markdown dialect, as far as the rich editor needs to know it. The block patterns
// mirror the mistune plugins in otterwiki/renderer_plugins.py (2.27.0).
//
// Block syntax Milkdown has no schema for is wrapped in a fenced code block tagged RAW_LANG before
// Milkdown parses the page, and unwrapped again after it serialises it, so it survives verbatim.

export const RAW_LANG = 'otterwiki-raw';

const ALERTS = 'NOTE|TIP|IMPORTANT|WARNING|CAUTION';

const isFence = (line) => /^ {0,3}(`{3,}|~{3,})/.exec(line);
const isBlank = (line) => line.trim() === '';

// Each scanner gets the lines and a start index, and returns the end index (exclusive) of the block
// starting there, or null.
const scanners = [
  {
    kind: 'frontmatter',
    scan(lines, i) {
      if (i !== 0 || lines[0] !== '---') return null;
      const end = lines.indexOf('---', 1);
      return end === -1 ? null : end + 1;
    },
  },
  {
    kind: 'fancy',
    scan(lines, i) {
      if (!/^ {0,3}:{3,}/.test(lines[i])) return null;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^ {0,3}(:{3,}|~{3,})[~:]* *$/.test(lines[j])) return j + 1;
      }
      return lines.length;
    },
  },
  {
    kind: 'math',
    scan(lines, i) {
      const m = /^\s*\$\$/.exec(lines[i]);
      if (!m) return null;
      if (lines[i].indexOf('$$', m[0].length) !== -1) return i + 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].includes('$$')) return j + 1;
      }
      return null;
    },
  },
  { kind: 'spoiler', scan: (lines, i) => scanPrefixed(lines, i, /^ {0,3}>!/, /^ {0,3}>!/) },
  { kind: 'fold', scan: (lines, i) => scanPrefixed(lines, i, /^ {0,3}>\|/, /^ {0,3}>\|/) },
  {
    kind: 'alert',
    scan: (lines, i) =>
      scanPrefixed(lines, i, new RegExp(`^ {0,3}>\\s*\\[!(${ALERTS})\\]`, 'i'), /^ {0,3}>/),
  },
  {
    kind: 'footnote',
    scan(lines, i) {
      if (!/^ {0,3}\[\^[^\]]+\]:/.test(lines[i])) return null;
      let end = i + 1;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^ {1,4}\S/.test(lines[j])) end = j + 1;
        else if (!isBlank(lines[j])) break;
      }
      return end;
    },
  },
  { kind: 'abbr', scan: (lines, i) => scanPrefixed(lines, i, /^\*\[[^\]]+\]:/, /^\*\[[^\]]+\]:/) },
  {
    kind: 'embedding',
    scan(lines, i) {
      if (!/^\{\{\w/.test(lines[i])) return null;
      for (let j = i; j < lines.length; j++) {
        if (/\}\}\s*$/.test(lines[j])) return j + 1;
      }
      return null;
    },
  },
];

function scanPrefixed(lines, i, first, rest) {
  if (!first.test(lines[i])) return null;
  let j = i + 1;
  while (j < lines.length && rest.test(lines[j])) j++;
  return j;
}

// Splits a page into {kind, text} segments, where kind is 'markdown' or one of the raw kinds.
export function segment(md) {
  const lines = md.split('\n');
  const segments = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) segments.push({ kind: 'markdown', text: buffer.join('\n') });
    buffer = [];
  };

  let i = 0;
  while (i < lines.length) {
    const fence = isFence(lines[i]);
    if (fence) {
      const marker = fence[1];
      const close = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
      let j = i + 1;
      while (j < lines.length && !close.test(lines[j])) j++;
      buffer.push(...lines.slice(i, Math.min(j + 1, lines.length)));
      i = j + 1;
      continue;
    }
    let matched = false;
    for (const { kind, scan } of scanners) {
      const end = scan(lines, i);
      if (end !== null && end > i) {
        flush();
        segments.push({ kind, text: lines.slice(i, end).join('\n') });
        i = end;
        matched = true;
        break;
      }
    }
    if (!matched) buffer.push(lines[i++]);
  }
  flush();
  return segments;
}

function fenceFor(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
  return '`'.repeat(Math.max(3, longest + 1));
}

export function protect(md) {
  return segment(md)
    .map(({ kind, text }) => {
      if (kind === 'markdown') return text;
      const fence = fenceFor(text);
      // Blank lines either side, so the wrapper never runs into a neighbouring paragraph.
      return `\n${fence}${RAW_LANG}\n${text}\n${fence}\n`;
    })
    .join('\n');
}

const RAW_BLOCK = new RegExp(
  `^([ \\t]*)(\`{3,}|~{3,})${RAW_LANG}[ \\t]*\\n(?:([\\s\\S]*?)\\n)?\\1\\2[ \\t]*$`,
  'gm',
);

export function unprotect(md) {
  return md.replace(RAW_BLOCK, (_, indent, _fence, body = '') =>
    body
      .split('\n')
      .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
      .join('\n'),
  );
}

// A raw block is only safe to write back if it still scans as exactly one block of Otter syntax.
// Otherwise an unclosed ::: or $$ would swallow the rest of the page.
export function validateRaw(text) {
  const trimmed = text.replace(/\n+$/, '');
  const segments = segment(trimmed);
  if (segments.length === 1 && segments[0].kind === 'fancy') {
    // Otter lets an unclosed ::: run to the end of the page, which here would swallow the rest.
    const lines = trimmed.split('\n');
    const closed = lines.length > 1 && /^ {0,3}(:{3,}|~{3,})[~:]* *$/.test(lines.at(-1));
    return closed ? null : 'This block needs a closing ::: line.';
  }
  if (segments.length === 1 && segments[0].kind !== 'markdown') return null;
  if (segments.every((s) => s.kind === 'markdown')) {
    return 'This is no longer Otter Wiki block syntax. Fix it, or delete the block.';
  }
  return 'This block must contain exactly one Otter Wiki block, with nothing before or after it.';
}

// Inline syntax with no Milkdown equivalent, kept as atoms holding the original text. Order
// matters, because $$...$$ has to win over $...$.
export const INLINE_KINDS = [
  { kind: 'wikilink', pattern: /\[\[[^\]\n]+\]\]/ },
  { kind: 'math', pattern: /\$\$(?:\\\$|[^$\n])+\$\$/ },
  { kind: 'math', pattern: /\$(?=[^\s$])(?:\\\$|[^$\n])*?[^\s$\\]\$|\$[^\s$]\$/ },
  { kind: 'footnote', pattern: /\[\^[^\]\s]+\]/ },
  { kind: 'embedding', pattern: /\{\{[^}\n]+\}\}/ },
];

export const INLINE_PATTERN = new RegExp(
  INLINE_KINDS.map(({ pattern }) => `(${pattern.source})`).join('|'),
  'g',
);

export const MARK_PATTERN = /==(?=[^\s=])((?:\\=|[^=\n])*?[^\s=\\])==|==([^\s=])==/g;

export function inlineKind(raw) {
  const found = INLINE_KINDS.find(({ pattern }) => new RegExp(`^(?:${pattern.source})$`).test(raw));
  return found ? found.kind : null;
}

// [[Page]], [[Text|Page]] and [[Page#Section]], in Otter's default TEXTLINK style.
export function parseWikilink(raw) {
  const inner = raw.slice(2, -2);
  const bar = inner.indexOf('|');
  if (bar === -1) return { text: inner, target: inner };
  return { text: inner.slice(0, bar), target: inner.slice(bar + 1) };
}

export function formatWikilink(text, target) {
  return text && text !== target ? `[[${text}|${target}]]` : `[[${target}]]`;
}
