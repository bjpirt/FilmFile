// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { MenuButton } from './menu-button.tsx';

afterEach(cleanup);

function renderMenu() {
  const chosen: string[] = [];
  render(
    <>
      <MenuButton
        label="Actions"
        items={[
          { label: 'Edit details', select: () => chosen.push('edit') },
          { label: 'Add scans', select: () => chosen.push('add') },
          {
            label: 'Delete roll…',
            select: () => chosen.push('delete'),
            danger: true,
            setApart: true,
          },
        ]}
      />
      <p>Elsewhere</p>
    </>,
  );
  return chosen;
}

test('opens a menu of the actions, focusing the first', () => {
  renderMenu();
  const button = screen.getByRole('button', { name: 'Actions' });
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('menu')).toBeNull();

  fireEvent.click(button);

  expect(button.getAttribute('aria-expanded')).toBe('true');
  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent),
  ).toEqual(['Edit details', 'Add scans', 'Delete roll…']);
  expect(document.activeElement?.textContent).toBe('Edit details');
});

test('does the action chosen, and closes', () => {
  const chosen = renderMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Actions' }));

  fireEvent.click(screen.getByRole('menuitem', { name: 'Add scans' }));

  expect(chosen).toEqual(['add']);
  expect(screen.queryByRole('menu')).toBeNull();
});

test('moves through the actions with the arrow keys, round from the ends', () => {
  renderMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
  const menu = screen.getByRole('menu');

  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(document.activeElement?.textContent).toBe('Add scans');
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(document.activeElement?.textContent).toBe('Edit details');
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(document.activeElement?.textContent).toBe('Delete roll…');
  fireEvent.keyDown(menu, { key: 'Home' });
  expect(document.activeElement?.textContent).toBe('Edit details');
});

test('closes on Esc, back on its button, doing nothing', () => {
  const chosen = renderMenu();
  const button = screen.getByRole('button', { name: 'Actions' });
  fireEvent.click(button);

  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(button);
  expect(chosen).toEqual([]);
});

test('closes on a click elsewhere', () => {
  renderMenu();
  fireEvent.click(screen.getByRole('button', { name: 'Actions' }));

  fireEvent.pointerDown(screen.getByText('Elsewhere'));

  expect(screen.queryByRole('menu')).toBeNull();
});
