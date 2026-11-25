// Notion's block shortcuts. ⌘⇧↑ and ⌘⇧↓ (Ctrl+Shift elsewhere) move the block at the cursor, and
// ⌘D or Ctrl+D duplicates it. In a list the block is the list item, so items move within their list.

import { keymap } from '@milkdown/kit/prose/keymap';
import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

function currentBlock(state) {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.isBlock) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 1; depth--) {
    if ($from.node(depth).type.name === 'list_item') return { pos: $from.before(depth), node: $from.node(depth) };
  }
  return $from.depth ? { pos: $from.before(1), node: $from.node(1) } : null;
}

// Puts the selection back where it was inside the block, now that the block starts at `start`.
function follow(tr, selection, oldStart, start) {
  if (selection instanceof NodeSelection) return tr.setSelection(NodeSelection.create(tr.doc, start));
  const shift = (pos) => pos - oldStart + start;
  return tr.setSelection(TextSelection.create(tr.doc, shift(selection.anchor), shift(selection.head)));
}

const move = (up) => (state, dispatch) => {
  const block = currentBlock(state);
  if (!block) return false;
  const $pos = state.doc.resolve(block.pos);
  const index = $pos.index();
  // At either end the shortcut does nothing, rather than falling through to selecting text.
  if (up ? index === 0 : index === $pos.parent.childCount - 1) return true;
  const neighbour = $pos.parent.child(up ? index - 1 : index + 1);
  const start = up ? block.pos - neighbour.nodeSize : block.pos + neighbour.nodeSize;
  const tr = state.tr.delete(block.pos, block.pos + block.node.nodeSize).insert(start, block.node);
  dispatch?.(follow(tr, state.selection, block.pos, start).scrollIntoView());
  return true;
};

const duplicate = (state, dispatch) => {
  const block = currentBlock(state);
  if (!block) return false;
  const start = block.pos + block.node.nodeSize;
  const tr = state.tr.insert(start, block.node);
  dispatch?.(follow(tr, state.selection, block.pos, start).scrollIntoView());
  return true;
};

export const blockKeys = $prose(() =>
  keymap({
    'Mod-Shift-ArrowUp': move(true),
    'Mod-Shift-ArrowDown': move(false),
    'Mod-d': duplicate,
  }),
);
