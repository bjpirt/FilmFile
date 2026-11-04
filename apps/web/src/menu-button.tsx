import { useEffect, useId, useRef, useState } from 'react';

/** One thing a menu does. */
export interface MenuItem {
  readonly label: string;
  readonly select: () => void;
  /** Shown as destructive, e.g. Delete roll…. */
  readonly danger?: boolean;
  /** Set apart from the items before it by a line. */
  readonly setApart?: boolean;
}

/**
 * A button that opens a menu of actions: the first is focused, the arrow
 * keys (and Home and End) move between them, Enter or a click does one and
 * closes the menu, and Esc, Tab or a click elsewhere closes it doing nothing.
 */
export function MenuButton({
  label,
  items,
  disabled = false,
}: {
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const whole = useRef<HTMLDivElement>(null);

  function entries(): HTMLButtonElement[] {
    return Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ??
        [],
    );
  }

  function close(focusButton: boolean) {
    setOpen(false);
    if (focusButton) {
      button.current?.focus();
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    entries()[0]?.focus();
    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !whole.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    const all = entries();
    const at = all.findIndex((entry) => entry === document.activeElement);
    const go = (index: number) => {
      all[(index + all.length) % all.length]?.focus();
      event.preventDefault();
    };
    switch (event.key) {
      case 'ArrowDown':
        go(at + 1);
        break;
      case 'ArrowUp':
        go(at - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(all.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        // Only the menu closes, not what it's in (a dialog, Select mode).
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  }

  return (
    <div className="menu-button" ref={whole}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          className="menu"
          onKeyDown={onKeyDown}
        >
          {items.map((item) => (
            <li
              key={item.label}
              role="none"
              className={item.setApart === true ? 'set-apart' : undefined}
            >
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={item.danger === true ? 'danger-text' : undefined}
                onClick={() => {
                  close(false);
                  item.select();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
