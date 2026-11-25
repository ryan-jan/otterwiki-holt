// Holt's rich text mode for Otter Wiki's editor. holt.js loads it on edit pages.
//
// Otter Wiki's CodeMirror editor stays the source of truth. Saving, drafts, the preview and the
// unsaved-changes warning all read it, so the rich editor writes its Markdown back into CodeMirror
// and everything else keeps working unchanged.
//
// A page only opens in rich mode if Otter Wiki renders it identically after a round trip through
// Milkdown. Anything else stays in the Markdown editor, so the rich editor can't damage it.

import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import '@milkdown/crepe/theme/common/prosemirror.css';
import '@milkdown/crepe/theme/common/block-edit.css';
import '@milkdown/crepe/theme/common/cursor.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';
import '@milkdown/crepe/theme/common/list-item.css';
import '@milkdown/crepe/theme/common/placeholder.css';
import '@milkdown/crepe/theme/common/toolbar.css';
import '@milkdown/crepe/theme/common/table.css';
import { commandsCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/kit/core';
import { uploadConfig } from '@milkdown/kit/plugin/upload';
import {
  addBlockTypeCommand,
  clearTextInCurrentBlockCommand,
  codeBlockSchema,
  remarkPreserveEmptyLinePlugin,
} from '@milkdown/kit/preset/commonmark';
import { replaceAll } from '@milkdown/kit/utils';

import { RAW_LANG, formatWikilink, protect, unprotect } from './dialect.js';
import { askAttachment, askWikilink } from './dialogs.js';
import { openEmojiPicker } from './emoji.js';
import { attachmentUrl, renderMarkdown, uploadAttachment } from './otter.js';
import {
  otterInlineSchema,
  otterMarkSchema,
  otterPlugins,
  otterStringify,
  toggleOtterMarkCommand,
} from './plugins.js';
import { holtBlockHandle } from './block-handle.js';
import { blockKeys } from './block-keys.js';
import { createOutline } from './outline.js';
import { pageLinkPicker } from './page-link.js';
import { codeBlockView, invalidRawBlocks, markPageLoaded } from './raw-block.js';
import './editor.css';

const BASE_URL = new URL('.', document.currentScript.src);
const EMOJI_DATA = new URL('holt-emoji.json', BASE_URL).href;
// Rich mode is the default. This only records choosing the Markdown editor instead.
const PREFERENCE = 'holt-rich-editor';

const icon = (path) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="${path}"/></svg>`;
const ICONS = {
  emoji: icon('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-3.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 17.5a5.5 5.5 0 0 1-4.9-3h9.8a5.5 5.5 0 0 1-4.9 3Z'),
  wikilink: icon('M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0Zm-2.8 5.7a4 4 0 0 1-2.9-6.8l2.1-2.1a1 1 0 1 1 1.4 1.4l-2.1 2.1a2 2 0 1 0 2.9 2.9l2.1-2.1a1 1 0 1 1 1.4 1.4l-2.1 2.1a4 4 0 0 1-2.8 1.1Zm7.8-5.6a1 1 0 0 1-.7-1.7l2.1-2.1a2 2 0 0 0-2.9-2.9L12 8.9a1 1 0 0 1-1.4-1.4l2.1-2.1a4 4 0 0 1 5.7 5.7l-2.1 2.1a1 1 0 0 1-.7.3Z'),
  highlight: icon('M15.2 3.3 20.7 8.8a1 1 0 0 1 0 1.4l-8.5 8.5H5.4l-2.1-2.1a1 1 0 0 1 0-1.4l10.5-10.5a1 1 0 0 1 1.4 0ZM3 20h18v2H3Z'),
  info: icon('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2Zm0-8h-2V7h2Z'),
  alert: icon('M1 21h22L12 2Zm12-3h-2v-2h2Zm0-4h-2v-4h2Z'),
  spoiler: icon('M12 5c-5 0-9 4-10 7 1 3 5 7 10 7s9-4 10-7c-1-3-5-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z'),
  fold: icon('M7 10l5 5 5-5Z'),
  maths: icon('M4 4h16v2H8l6 6-6 6h12v2H4v-2l6-6-6-6Z'),
  attachment: icon('M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6Z'),
};

const RAW_TEMPLATES = {
  info: { label: 'Info box', text: '::: info\n# Heading\nText\n:::' },
  alert: { label: 'Alert', text: '> [!NOTE]\n> Text' },
  spoiler: { label: 'Spoiler', text: '>! Hidden text' },
  fold: { label: 'Folded section', text: '>| # Summary\n>| Details' },
  maths: { label: 'Maths', text: '$$\na^2+b^2=c^2\n$$' },
};

const cm = () => window.cm_editor;
const cmText = () => cm().state.doc.toString();

let crepe = null;
let container = null;
let loadedDoc = null;
let loadedMarkdown = null;
// The CodeMirror text the rich editor last wrote or loaded, to tell its own changes from others.
let lastSynced = null;
let syncTimer = null;
let outline = null;
let outlineTimer = null;
let button = null;

function notify(content, title = 'Rich text editor') {
  if (window.halfmoon?.initStickyAlert) {
    window.halfmoon.initStickyAlert({
      content,
      title,
      alertType: 'alert-secondary',
      fillType: 'filled',
      timeShown: 15000,
    });
  } else {
    window.alert(content);
  }
}

function remember(rich) {
  try {
    if (rich) localStorage.removeItem(PREFERENCE);
    else localStorage.setItem(PREFERENCE, 'markdown');
  } catch {
    // Private windows can refuse storage. The preference is only a convenience.
  }
}

function prefersMarkdown() {
  try {
    return localStorage.getItem(PREFERENCE) === 'markdown';
  } catch {
    return false;
  }
}

// holt.css shows a spinner in place of the Markdown editor until rich or Markdown mode is settled.
function settle() {
  document.body.classList.add('holt-editor-settled');
}

// Rich mode replaces the preview and the live preview, so leave either before hiding their
// buttons, the same way a click on them would.
function leavePreviews() {
  if (document.getElementById('editor_split')?.classList.contains('split')) {
    document.getElementById('split_btn')?.click();
  }
  const edit = document.getElementById('editor_btn');
  if (edit && edit.style.display !== 'none') edit.click();
}

// The button shows the mode it switches to.
function showMode(rich, title) {
  button.setAttribute('aria-pressed', String(rich));
  button.title = title ?? (rich ? 'Edit as Markdown' : 'Edit as rich text');
  button.innerHTML = rich ? '<i class="fas fa-code"></i>' : '<i class="fas fa-magic"></i>';
}

const view = () => crepe.editor.ctx.get(editorViewCtx);

// Otter Wiki keeps a trailing newline on pages, and Milkdown doesn't guarantee one.
const withNewline = (md) => md.replace(/\n*$/, '\n');

function richMarkdown() {
  return withNewline(unprotect(crepe.getMarkdown()));
}

function pushToCodeMirror(markdown) {
  lastSynced = markdown;
  if (markdown === cmText()) return;
  cm().dispatch({ changes: { from: 0, to: cm().state.doc.length, insert: markdown } });
}

// Writes the rich document back into CodeMirror. An untouched document writes back the original
// text, so opening a page in rich mode never reformats it by itself.
function flush() {
  clearTimeout(syncTimer);
  if (!crepe) return;
  const doc = view().state.doc;
  pushToCodeMirror(doc.eq(loadedDoc) ? loadedMarkdown : richMarkdown());
}

const normaliseHtml = (html) => html.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

async function survivesRoundTrip(original) {
  const roundTripped = richMarkdown();
  if (roundTripped === withNewline(original)) return true;
  const [before, after] = await Promise.all([
    renderMarkdown(original),
    renderMarkdown(roundTripped),
  ]);
  if (normaliseHtml(before) === normaliseHtml(after)) return true;
  console.groupCollapsed('Rich text editor: round trip changes how this page renders');
  console.log('Original Markdown:\n' + original);
  console.log('Round-tripped Markdown:\n' + roundTripped);
  console.groupEnd();
  return false;
}

function insertRawBlock(ctx, text) {
  const commands = ctx.get(commandsCtx);
  commands.call(clearTextInCurrentBlockCommand.key);
  commands.call(addBlockTypeCommand.key, {
    nodeType: codeBlockSchema.type(ctx),
    attrs: { language: RAW_LANG },
  });
  const editorView = ctx.get(editorViewCtx);
  editorView.dispatch(editorView.state.tr.insertText(text));
}

async function insertWikilink(ctx, { clearBlock }) {
  const editorView = ctx.get(editorViewCtx);
  if (clearBlock) ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
  const { from, to } = editorView.state.selection;
  const selected = editorView.state.doc.textBetween(from, to);
  const result = await askWikilink({ text: selected, target: selected });
  if (!result) {
    editorView.focus();
    return;
  }
  const node = otterInlineSchema.type(ctx).create({ raw: formatWikilink(result.text, result.target) });
  editorView.dispatch(editorView.state.tr.replaceRangeWith(from, to, node));
  editorView.focus();
}

function chooseFiles() {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', multiple: true });
    input.addEventListener('change', () => resolve([...input.files]));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

async function insertAttachment(ctx) {
  const editorView = ctx.get(editorViewCtx);
  ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
  const choice = await askAttachment();
  const { schema } = editorView.state;
  let nodes = [];
  if (choice === 'upload') {
    nodes = await uploader(await chooseFiles(), schema);
  } else if (choice) {
    const url = attachmentUrl(choice.filename);
    nodes = [
      choice.thumbnail
        ? schema.nodes.image.createAndFill({ src: url, alt: choice.filename })
        : schema.text(choice.filename, [schema.marks.link.create({ href: url })]),
    ];
  }
  if (nodes.length) {
    const { from, to } = editorView.state.selection;
    editorView.dispatch(editorView.state.tr.replaceWith(from, to, nodes).scrollIntoView());
  }
  editorView.focus();
}

function emoji(ctx, { clearBlock }) {
  if (clearBlock) ctx.get(commandsCtx).call(clearTextInCurrentBlockCommand.key);
  openEmojiPicker(ctx.get(editorViewCtx), EMOJI_DATA);
}

async function uploader(files, schema) {
  const nodes = [];
  for (const file of files) {
    const name = window.prompt('Enter filename for the attachment:', file.name);
    if (!name) continue;
    try {
      const filename = await uploadAttachment(file, name);
      const url = attachmentUrl(filename);
      if (file.type.startsWith('image/')) {
        nodes.push(schema.nodes.image.createAndFill({ src: url, alt: filename }));
      } else {
        nodes.push(schema.text(filename, [schema.marks.link.create({ href: url })]));
      }
    } catch (error) {
      notify(`${name} could not be uploaded. ${error.message}`);
    }
  }
  return nodes;
}

// Built feature by feature, because Crepe's all-in-one class bundles maths and CodeMirror even
// when they're switched off. Otter Wiki's own maths and code syntax are handled by the raw blocks.
function createCrepe(root, markdown) {
  const instance = new CrepeBuilder({ root, defaultValue: protect(markdown) })
    .addFeature(cursor)
    .addFeature(listItem)
    .addFeature(linkTooltip)
    .addFeature(table)
    .addFeature(placeholder, { text: 'Type / for blocks, emoji and wiki links' })
    .addFeature(blockEdit, {
      buildMenu: (builder) => {
        const group = builder.addGroup('otterwiki', 'Otter Wiki');
        group.addItem('emoji', {
          label: 'Emoji',
          icon: ICONS.emoji,
          onRun: (ctx) => emoji(ctx, { clearBlock: true }),
        });
        group.addItem('wikilink', {
          label: 'Wiki link',
          icon: ICONS.wikilink,
          onRun: (ctx) => insertWikilink(ctx, { clearBlock: true }),
        });
        group.addItem('attachment', {
          label: 'Attachment',
          icon: ICONS.attachment,
          onRun: (ctx) => insertAttachment(ctx),
        });
        for (const [key, { label, text }] of Object.entries(RAW_TEMPLATES)) {
          group.addItem(key, { label, icon: ICONS[key], onRun: (ctx) => insertRawBlock(ctx, text) });
        }
      },
    })
    .addFeature(toolbar, {
      buildToolbar: (builder) => {
        builder
          .addGroup('otterwiki', 'Otter Wiki')
          .addItem('highlight', {
            icon: ICONS.highlight,
            label: 'Highlight',
            active: (ctx) => {
              const { state } = ctx.get(editorViewCtx);
              const { from, to } = state.selection;
              return state.doc.rangeHasMark(from, to, otterMarkSchema.type(ctx));
            },
            onRun: (ctx) => ctx.get(commandsCtx).call(toggleOtterMarkCommand.key),
          })
          .addItem('wikilink', {
            icon: ICONS.wikilink,
            label: 'Wiki link',
            active: () => false,
            onRun: (ctx) => insertWikilink(ctx, { clearBlock: false }),
          })
          .addItem('emoji', {
            icon: ICONS.emoji,
            label: 'Emoji',
            active: () => false,
            onRun: (ctx) => emoji(ctx, { clearBlock: false }),
          });
      },
    });
  instance.editor
    // Holt's page typography, so the page looks the same while it's edited. Crepe's own reset.css,
    // which would restyle the text, isn't loaded.
    .config((ctx) =>
      ctx.update(editorViewOptionsCtx, (prev) => ({ ...prev, attributes: { class: 'page' } })),
    )
    .config(otterStringify)
    .config((ctx) => ctx.update(uploadConfig.key, (prev) => ({ ...prev, uploader })))
    // After the features, so it replaces Crepe's own block handle.
    .config(holtBlockHandle)
    .use(otterPlugins)
    .use(pageLinkPicker)
    .use(blockKeys)
    .use(codeBlockView);
  instance.on((listener) => {
    listener.updated(() => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(flush, 250);
      clearTimeout(outlineTimer);
      outlineTimer = setTimeout(() => outline?.refresh(), 200);
    });
  });
  return instance;
}

async function enterRich({ quiet = false } = {}) {
  if (crepe) return;
  const markdown = cmText();
  container = document.createElement('div');
  container.id = 'holt-rich-editor';
  container.hidden = true;
  cm().dom.after(container);
  button.disabled = true;
  leavePreviews();

  crepe = createCrepe(container, markdown);
  try {
    // Milkdown writes empty paragraphs as <br />, which would leave stray HTML in the page.
    await crepe.editor.remove(remarkPreserveEmptyLinePlugin);
    await crepe.create();
    loadedDoc = view().state.doc;
    loadedMarkdown = markdown;
    lastSynced = markdown;
    if (!(await survivesRoundTrip(markdown))) {
      await discardRich();
      showMode(false, 'This page can only be edited as Markdown. Click to see why.');
      if (!quiet) {
        notify(
          'This page uses Markdown the rich text editor can’t reproduce exactly, so it stays in the ' +
            'Markdown editor. The details are in the browser console.',
        );
      }
      return;
    }
  } catch (error) {
    await discardRich();
    notify(`The rich text editor could not start. ${error.message}`);
    return;
  } finally {
    button.disabled = false;
    if (!crepe) settle();
  }

  markPageLoaded();
  document.body.classList.add('holt-rich-mode');
  container.hidden = false;
  settle();
  outline = createOutline(view);
  showMode(true);
  if (!quiet) remember(true);
  view().focus();
}

async function discardRich() {
  clearTimeout(syncTimer);
  clearTimeout(outlineTimer);
  outline?.destroy();
  outline = null;
  const instance = crepe;
  crepe = null;
  loadedDoc = null;
  await instance?.destroy();
  container?.remove();
  container = null;
}

async function leaveRich() {
  flush();
  await discardRich();
  document.body.classList.remove('holt-rich-mode');
  showMode(false);
  remember(false);
  cm().focus();
}

// The attachment and wiki link panels in the sidebar insert into CodeMirror, so pick up changes
// that didn't come from the rich editor.
async function reloadFromCodeMirror() {
  if (!crepe || cmText() === lastSynced) return;
  const markdown = cmText();
  crepe.editor.action(replaceAll(protect(markdown), true));
  loadedDoc = view().state.doc;
  loadedMarkdown = markdown;
  lastSynced = markdown;
  if (!(await survivesRoundTrip(markdown))) {
    await leaveRich();
    notify('That change can’t be shown in the rich text editor, so it switched to Markdown.');
  }
}

function guardSave(event) {
  if (!crepe) return;
  const problems = invalidRawBlocks(view().state.doc);
  if (problems.length) {
    event.preventDefault();
    event.stopImmediatePropagation();
    notify(`Fix the Otter Wiki block marked in red before saving. ${problems[0]}`, 'Not saved');
    return;
  }
  flush();
}

function install() {
  const split = document.getElementById('split_btn');
  if (!split || !cm()) {
    settle();
    return;
  }

  button = document.createElement('button');
  button.id = 'holt-rich-btn';
  button.type = 'button';
  button.className = 'btn mr-5';
  showMode(false);
  button.addEventListener('click', () => (crepe ? leaveRich() : enterRich()));
  split.after(button);

  // Capturing listeners run before Otter Wiki's own handlers read CodeMirror.
  for (const form of document.querySelectorAll('form#saveform')) {
    form.addEventListener('submit', guardSave, true);
  }
  // The save button opens the commit dialog, so warn before it does.
  document.getElementById('save-page-btn')?.addEventListener('click', guardSave, true);
  for (const id of ['preview_btn', 'split_btn']) {
    document.getElementById(id)?.addEventListener('click', flush, true);
  }
  window.addEventListener('pagehide', flush, true);
  document.addEventListener(
    'visibilitychange',
    () => document.visibilityState === 'hidden' && flush(),
    true,
  );
  cm().dom.addEventListener('cm6change', reloadFromCodeMirror);
  // Otter Wiki's ⌘P or Ctrl+P switches to the preview, whose buttons rich mode hides.
  window.addEventListener(
    'keydown',
    (event) => {
      const command = event.metaKey || event.ctrlKey;
      if (crepe && command && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  if (prefersMarkdown()) settle();
  else enterRich({ quiet: true });
}

if (document.readyState === 'complete') install();
else window.addEventListener('load', install);
