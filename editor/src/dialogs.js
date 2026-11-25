// Small modal dialogs, built on <dialog> so focus and Escape behave.

import { wikiPages } from './otter.js';

function field(label, value, list) {
  const wrapper = document.createElement('label');
  wrapper.className = 'otter-dialog-field';
  wrapper.append(label);
  const input = document.createElement('input');
  input.className = 'form-control';
  input.value = value ?? '';
  if (list) input.setAttribute('list', list);
  wrapper.append(input);
  return { wrapper, input };
}

export function askWikilink({ text = '', target = '' } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'otter-dialog';

    const listId = 'otter-dialog-pages';
    const datalist = document.createElement('datalist');
    datalist.id = listId;
    for (const page of wikiPages()) datalist.append(new Option(page));

    const page = field('Page', target, listId);
    const label = field('Link text (optional)', text === target ? '' : text);

    const form = document.createElement('form');
    form.method = 'dialog';
    const buttons = document.createElement('div');
    buttons.className = 'otter-dialog-buttons';
    buttons.innerHTML =
      '<button class="btn" value="cancel" formnovalidate>Cancel</button>' +
      '<button class="btn btn-primary" value="ok">Insert link</button>';
    page.input.required = true;
    form.append(page.wrapper, label.wrapper, datalist, buttons);
    dialog.append(form);
    document.body.append(dialog);

    dialog.addEventListener('close', () => {
      const ok = dialog.returnValue === 'ok' && page.input.value.trim();
      const targetValue = page.input.value.trim();
      resolve(ok ? { target: targetValue, text: label.input.value.trim() || targetValue } : null);
      dialog.remove();
    });
    dialog.showModal();
    page.input.focus();
  });
}
