// Code blocks, including the RAW_LANG blocks that carry Otter Wiki block syntax. Raw blocks show
// what Otter Wiki renders for them, and their source is edited in place.

import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import { $view } from '@milkdown/kit/utils';

import { RAW_LANG, validateRaw } from './dialect.js';
import { renderMarkdown } from './otter.js';

// Blocks inserted after the page loads open with their source showing.
let pageLoaded = false;
export const markPageLoaded = () => {
  pageLoaded = true;
};

export const isRaw = (node) => node.type.name === 'code_block' && node.attrs.language === RAW_LANG;

function codeView(node, view, getPos) {
  const dom = document.createElement('div');
  dom.className = 'otter-code';
  const language = document.createElement('input');
  language.className = 'otter-code-language';
  language.placeholder = 'language';
  language.value = node.attrs.language;
  language.addEventListener('change', () => {
    const pos = getPos();
    if (pos === undefined) return;
    view.dispatch(view.state.tr.setNodeAttribute(pos, 'language', language.value.trim()));
  });
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.append(code);
  dom.append(language, pre);
  return {
    dom,
    contentDOM: code,
    update(updated) {
      if (updated.type !== node.type || isRaw(updated)) return false;
      node = updated;
      if (document.activeElement !== language) language.value = node.attrs.language;
      return true;
    },
    stopEvent: (event) => event.target === language,
    ignoreMutation: (mutation) => !code.contains(mutation.target),
  };
}

function rawView(node) {
  const dom = document.createElement('div');
  dom.className = 'otter-raw';
  const bar = document.createElement('div');
  bar.className = 'otter-raw-bar';
  bar.contentEditable = 'false';
  const title = document.createElement('span');
  title.textContent = 'Otter Wiki block';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-sm';
  bar.append(title, toggle);

  const rendered = document.createElement('div');
  rendered.className = 'otter-raw-rendered';
  rendered.contentEditable = 'false';
  const error = document.createElement('div');
  error.className = 'otter-raw-error';
  error.contentEditable = 'false';
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.append(code);
  dom.append(bar, rendered, error, pre);

  let editing = pageLoaded;
  let renderTimer = null;
  let renderedText = null;

  const render = () => {
    const text = node.textContent;
    const problem = validateRaw(text);
    error.textContent = problem ?? '';
    dom.classList.toggle('otter-raw-invalid', Boolean(problem));
    if (problem || text === renderedText) return;
    renderedText = text;
    renderMarkdown(text)
      .then((html) => {
        if (renderedText !== text) return;
        rendered.innerHTML = html;
        // Footnote and abbreviation definitions render as nothing on their own, so show the source.
        dom.classList.toggle('otter-raw-invisible', rendered.textContent.trim() === '');
        window.MathJax?.typesetPromise?.([rendered]).catch(() => {});
      })
      .catch(() => {
        rendered.textContent = 'Otter Wiki could not render this block.';
      });
  };
  const setEditing = (value) => {
    editing = value;
    dom.classList.toggle('otter-raw-editing', editing);
    toggle.textContent = editing ? 'Done' : 'Edit source';
  };
  toggle.addEventListener('click', () => setEditing(!editing));
  rendered.addEventListener('dblclick', () => setEditing(true));

  setEditing(editing);
  render();

  return {
    dom,
    contentDOM: code,
    update(updated) {
      if (!isRaw(updated)) return false;
      node = updated;
      clearTimeout(renderTimer);
      renderTimer = setTimeout(render, 400);
      return true;
    },
    stopEvent: (event) => bar.contains(event.target) || rendered.contains(event.target),
    ignoreMutation: (mutation) => !code.contains(mutation.target),
    destroy: () => clearTimeout(renderTimer),
  };
}

export const codeBlockView = $view(codeBlockSchema.node, () => (node, view, getPos) =>
  isRaw(node) ? rawView(node) : codeView(node, view, getPos),
);

// Returns the problems with raw blocks in the document, so a save can be refused.
export function invalidRawBlocks(doc) {
  const problems = [];
  doc.descendants((node) => {
    if (isRaw(node)) {
      const problem = validateRaw(node.textContent);
      if (problem) problems.push(problem);
      return false;
    }
    return true;
  });
  return problems;
}
