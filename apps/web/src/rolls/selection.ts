/** The frames selected on a roll's contact sheet, and the last one clicked, which a shift-click runs from. */
export interface Selection {
  readonly selected: ReadonlySet<string>;
  readonly anchor: string | undefined;
}

export const noSelection: Selection = {
  selected: new Set(),
  anchor: undefined,
};

/** Every frame in `order` selected. */
export function selectAll(order: readonly string[]): Selection {
  return { selected: new Set(order), anchor: undefined };
}

/**
 * A frame clicked. Alone, it's selected or unselected; with shift, every
 * frame from the last one clicked to this one (in `order`, the order shown)
 * becomes as this one does.
 */
export function toggle(
  selection: Selection,
  order: readonly string[],
  id: string,
  shift: boolean,
): Selection {
  const select = !selection.selected.has(id);
  const from =
    selection.anchor === undefined ? -1 : order.indexOf(selection.anchor);
  const to = order.indexOf(id);
  const run =
    shift && from !== -1 && to !== -1
      ? order.slice(Math.min(from, to), Math.max(from, to) + 1)
      : [id];
  const selected = new Set(selection.selected);
  for (const each of run) {
    if (select) {
      selected.add(each);
    } else {
      selected.delete(each);
    }
  }
  return { selected, anchor: id };
}

/** How many frames are selected, in words: "4 frames selected". */
export function selectionCount(selection: Selection): string {
  const count = selection.selected.size;
  if (count === 0) {
    return 'No frames selected';
  }
  return count === 1 ? '1 frame selected' : `${String(count)} frames selected`;
}
