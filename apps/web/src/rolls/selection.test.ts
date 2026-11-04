import { describe, expect, test } from 'vitest';
import { noSelection, selectAll, selectionCount, toggle } from './selection.ts';

const order = ['a', 'b', 'c', 'd', 'e'];

function picked(selection: ReturnType<typeof toggle>): string[] {
  return order.filter((id) => selection.selected.has(id));
}

describe('toggling frames', () => {
  test('selects a frame, then unselects it', () => {
    const once = toggle(noSelection, order, 'b', false);
    expect(picked(once)).toEqual(['b']);

    expect(picked(toggle(once, order, 'b', false))).toEqual([]);
  });

  test('with shift, selects the run from the last frame clicked, either way', () => {
    const started = toggle(noSelection, order, 'b', false);

    expect(picked(toggle(started, order, 'd', true))).toEqual(['b', 'c', 'd']);
    const back = toggle(
      toggle(noSelection, order, 'd', false),
      order,
      'b',
      true,
    );
    expect(picked(back)).toEqual(['b', 'c', 'd']);
  });

  test('with shift, unselects the run when the frame clicked was selected', () => {
    const all = toggle(selectAll(order), order, 'b', false);
    // b is now unselected; shift-clicking d unselects b to d.
    expect(picked(toggle(all, order, 'd', true))).toEqual(['a', 'e']);
  });

  test('with shift but nothing clicked yet, toggles the one frame', () => {
    expect(picked(toggle(noSelection, order, 'c', true))).toEqual(['c']);
  });
});

test('selects every frame, and nothing', () => {
  expect(picked(selectAll(order))).toEqual(order);
  expect(picked(noSelection)).toEqual([]);
});

test.each([
  [[], 'No frames selected'],
  [['a'], '1 frame selected'],
  [['a', 'b', 'c', 'd'], '4 frames selected'],
])('counts %j as "%s"', (ids, text) => {
  expect(selectionCount(selectAll(ids))).toBe(text);
});
