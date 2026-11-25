// An emoji picker that inserts the emoji itself. Otter Wiki has no :shortcode: syntax.

import { Picker } from 'emoji-picker-element';

let picker = null;
let popover = null;

function close() {
  popover?.remove();
  popover = null;
}

export function openEmojiPicker(view, dataSource) {
  close();
  picker ??= new Picker({ dataSource, locale: 'en' });
  picker.className = document.body.classList.contains('dark-mode') ? 'dark' : 'light';

  popover = document.createElement('div');
  popover.className = 'otter-emoji-popover';
  popover.append(picker);
  document.body.append(popover);

  const { from } = view.state.selection;
  const coords = view.coordsAtPos(from);
  const top = Math.min(coords.bottom + 6, window.innerHeight - popover.offsetHeight - 8);
  const left = Math.min(coords.left, window.innerWidth - popover.offsetWidth - 8);
  popover.style.top = `${Math.max(8, top)}px`;
  popover.style.left = `${Math.max(8, left)}px`;

  const onPick = (event) => {
    view.dispatch(view.state.tr.insertText(event.detail.unicode, from, view.state.selection.to));
    view.focus();
    cleanup();
  };
  const onOutside = (event) => {
    if (!popover?.contains(event.target)) cleanup();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      cleanup();
      view.focus();
    }
  };
  const cleanup = () => {
    picker.removeEventListener('emoji-click', onPick);
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    close();
  };
  picker.addEventListener('emoji-click', onPick);
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
  picker.shadowRoot?.querySelector('input')?.focus();
}
