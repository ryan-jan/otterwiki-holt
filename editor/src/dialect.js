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

// Splits a page into {kind, text} segments, where kind is 'markdown' or one of the raw kinds. Inside
// another block a page can't have frontmatter, so `nested` leaves it out.
export function segment(md, { nested = false } = {}) {
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
      if (nested && kind === 'frontmatter') continue;
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

// Info boxes, alerts, folds and spoilers are edited as text. Each is split into its attributes and
// its Markdown content exactly as Otter Wiki's renderer splits it, so the content means the same to
// Milkdown as it does to Otter Wiki.

export const ALERT_TYPES = ALERTS.split('|');
export const FANCY_FAMILIES = ['info', 'warning', 'danger', 'success'];

const HEADER = /^#{1,5}\s*(.*)\n+/;
const FANCY_OPEN = /^ {0,3}(:{3,}|~{3,})([^:\n]*)$/;
const FOLD_LEADING = /^ *>\|/gm;
const SPOILER_LEADING = /^ *>!/gm;
const ALERT_LEADING = new RegExp(`^ *>(\\s*\\[!(${ALERTS})\\])?`, 'gim');

function takeHeader(text) {
  const match = HEADER.exec(text);
  if (!match) return { title: null, content: text };
  return { title: match[1], content: text.replace(HEADER, '') };
}

// Returns {kind, attrs, content} for a block of one of these kinds, or null if it should stay raw.
export function parseContainer(kind, text) {
  const lines = text.split('\n');
  if (kind === 'fancy') {
    const open = FANCY_OPEN.exec(lines[0]);
    if (!open || lines.length < 2) return null;
    // Otter Wiki only closes the block on a line that starts with the opening marker.
    const close = new RegExp(`^ {0,3}${open[1]}[~:]* *$`);
    if (!close.test(lines.at(-1))) return null;
    const { title, content } = takeHeader(lines.slice(1, -1).join('\n'));
    return { kind, attrs: { family: open[2].trim().toLowerCase(), title }, content };
  }
  if (kind === 'fold') {
    const { title, content } = takeHeader(text.replace(FOLD_LEADING, '').trim());
    return { kind, attrs: { title }, content };
  }
  if (kind === 'spoiler') {
    return { kind, attrs: {}, content: text.replace(SPOILER_LEADING, '') };
  }
  if (kind === 'alert') {
    // A lone [!NOTE] line is a plain quote to Otter Wiki.
    if (lines.length < 2) return null;
    const type = new RegExp(`^ {0,3}>\\s*\\[!(${ALERTS})\\]`, 'i').exec(text)[1].toUpperCase();
    return { kind, attrs: { type }, content: text.replace(ALERT_LEADING, '') };
  }
  return null;
}

const prefixLines = (lines, prefix) =>
  lines.map((line) => (line ? `${prefix} ${line}` : prefix)).join('\n');

// The Markdown for a block, given its attributes and its content already written as Markdown.
export function formatContainer(kind, { family, title, type }, content) {
  const heading = title?.trim() ? `# ${title.trim()}` : null;
  const lines = content ? content.split('\n') : [];
  if (kind === 'fancy') {
    // Otter Wiki only reads the heading if a newline follows it.
    if (heading && !lines.length) lines.push('');
    return [`:::${family ? ` ${family}` : ''}`, ...(heading ? [heading] : []), ...lines, ':::'].join('\n');
  }
  if (kind === 'fold') return prefixLines(heading ? [heading, ...lines] : lines.length ? lines : [''], '>|');
  if (kind === 'spoiler') return prefixLines(lines.length ? lines : [''], '>!');
  if (kind === 'alert') return `> [!${type}]\n${prefixLines(lines.length ? lines : [''], '>')}`;
  throw new Error(`Unknown Otter Wiki block ${kind}`);
}

export const CONTAINER_KINDS = new Set(['fancy', 'alert', 'fold', 'spoiler']);

// Milkdown parses the page with remark, so each block reaches it as its content between two HTML
// comments. liftContainers turns those back into one otterContainer node.
const OPEN_MARKER = /^<!--holt-block (\S+)-->$/;
const CLOSE_MARKER = '<!--/holt-block-->';

// Content that could run past the closing marker stays raw. That's an unclosed fence, or an HTML
// block that only ends at its closing tag.
function containable(content) {
  if (/^ {0,3}<(script|pre|style|textarea|!|\?)/im.test(content)) return false;
  const lines = content.split('\n');
  let fence = null;
  for (const line of lines) {
    const match = isFence(line);
    if (!fence && match) fence = match[1];
    else if (fence && new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = null;
  }
  return fence === null;
}

// Otter Wiki leaves the space after a line's >| (or >! or >) in the content. The editor writes it
// back with the prefix, so a raw block inside drops it here, or it would gain a space every save.
// It's dropped from every line or none, so the lines keep their indents relative to each other.
const dropPrefixSpace = (text) =>
  text.split('\n').every((line) => line === '' || line.startsWith(' '))
    ? text.replace(/^ /gm, '')
    : text;

function protectSegment(kind, text, { prefixed = false } = {}) {
  const block = CONTAINER_KINDS.has(kind) ? parseContainer(kind, text) : null;
  if (block && containable(block.content)) {
    const data = encodeURIComponent(JSON.stringify({ kind, ...block.attrs, raw: text }));
    const inner = protect(block.content, { nested: true, prefixed: kind !== 'fancy' });
    return `\n<!--holt-block ${data}-->\n\n${inner}\n\n${CLOSE_MARKER}\n`;
  }
  if (prefixed) text = dropPrefixSpace(text);
  const fence = fenceFor(text);
  // Blank lines either side, so the wrapper never runs into a neighbouring paragraph.
  return `\n${fence}${RAW_LANG}\n${text}\n${fence}\n`;
}

export function protect(md, { nested = false, prefixed = false } = {}) {
  return segment(md, { nested })
    .map(({ kind, text }) => (kind === 'markdown' ? text : protectSegment(kind, text, { prefixed })))
    .join('\n');
}

// Milkdown wraps HTML at the top level in a paragraph, so a marker can arrive either way.
function markerText(node) {
  if (node.type === 'html') return node.value.trim();
  if (node.type === 'paragraph' && node.children?.length === 1 && node.children[0].type === 'html') {
    return node.children[0].value.trim();
  }
  return null;
}

const hasDescendant = (node, test) =>
  (node.children ?? []).some((child) => test(child) || hasDescendant(child, test));

// What each kind of node can hold. Anything else stays a raw block.
function representable(kind, children) {
  if (kind === 'spoiler') return children.length === 0 || (children.length === 1 && children[0].type === 'paragraph');
  if (kind === 'fancy') {
    // Otter Wiki renders headings in an info box as plain text, and can't nest info boxes.
    return !hasDescendant(
      { children },
      (node) => node.type === 'heading' || (node.type === 'otterContainer' && node.kind === 'fancy'),
    );
  }
  return true;
}

// The remark transform that pairs up the markers. A block whose content Milkdown can't represent
// goes back to being a raw block.
export function liftContainers(tree) {
  if (!tree.children) return;
  const out = [];
  const stack = [];
  for (const child of tree.children) {
    const marker = markerText(child);
    const open = marker && OPEN_MARKER.exec(marker);
    if (open) {
      stack.push({ data: JSON.parse(decodeURIComponent(open[1])), children: [] });
      continue;
    }
    if (marker === CLOSE_MARKER && stack.length) {
      const { data, children } = stack.pop();
      const { kind, raw, ...attrs } = data;
      const node = representable(kind, children)
        ? { type: 'otterContainer', kind, attrs, children }
        : { type: 'code', lang: RAW_LANG, value: raw };
      (stack.at(-1)?.children ?? out).push(node);
      continue;
    }
    liftContainers(child);
    (stack.at(-1)?.children ?? out).push(child);
  }
  // A marker left open means the page didn't parse as expected. Its content is kept, and the round
  // trip check then keeps the page in the Markdown editor.
  tree.children = out.concat(stack.flatMap(({ children }) => children));
}

// remark-stringify's handler for otterContainer. Raw blocks inside are unwrapped here, because the
// line prefixes would stop unprotect finding them later.
export function otterContainerToMarkdown(node, _parent, state, info) {
  const content = unprotect(state.containerFlow(node, info));
  return formatContainer(node.kind, node.attrs, content);
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
    // An unclosed ::: still scans as one block, running to the end, so it needs its own check.
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
