// Small modal dialogs, built on <dialog> so focus and Escape behave.

import { pageAttachments, wikiPages } from './otter.js';

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

// Resolves to the chosen attachment, 'upload' to upload a new file, or null.
export function askAttachment() {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'otter-dialog';
    let choice = null;

    const heading = document.createElement('h2');
    heading.className = 'otter-dialog-title';
    heading.textContent = 'Insert an attachment';
    const list = document.createElement('div');
    list.className = 'otter-attachment-list';
    const files = pageAttachments();
    for (const file of files) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'otter-attachment';
      const preview = document.createElement('span');
      preview.className = 'otter-attachment-preview';
      if (file.thumbnail) {
        const image = document.createElement('img');
        image.src = file.thumbnail;
        image.alt = '';
        preview.append(image);
      } else {
        preview.textContent = file.filename.includes('.') ? file.filename.split('.').pop() : '';
      }
      const name = document.createElement('span');
      name.className = 'otter-attachment-name';
      name.textContent = file.filename;
      option.append(preview, name);
      option.addEventListener('click', () => {
        choice = file;
        dialog.close();
      });
      list.append(option);
    }
    if (!files.length) {
      list.className = 'otter-attachment-empty';
      list.textContent = 'This page has no attachments yet.';
    }

    const buttons = document.createElement('div');
    buttons.className = 'otter-dialog-buttons';
    const upload = Object.assign(document.createElement('button'), { type: 'button', className: 'btn' });
    upload.textContent = 'Upload a file';
    upload.addEventListener('click', () => {
      choice = 'upload';
      dialog.close();
    });
    const cancel = Object.assign(document.createElement('button'), { type: 'button', className: 'btn' });
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => dialog.close());
    buttons.append(upload, cancel);

    dialog.append(heading, list, buttons);
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      resolve(choice);
      dialog.remove();
    });
    dialog.showModal();
    (list.querySelector('button') ?? upload).focus();
  });
}
