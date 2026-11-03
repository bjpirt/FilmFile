import { useSyncExternalStore, type ReactNode } from 'react';

// Just enough routing for a few pages: the browser's history, and links that
// change it without reloading the page.

const navigated = 'filmfile:navigate';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(navigated, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(navigated, onChange);
  };
}

/** The current path, e.g. `/rolls/01M6E…`, re-rendering when it changes. */
export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

/** The query part of the address, e.g. `?view=list&year=2026`, re-rendering when it changes. */
export function useSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search);
}

/** Goes to `to`, as a new history entry, or in place of the current one with `replace`. */
export function navigate(
  to: string,
  { replace = false }: { readonly replace?: boolean } = {},
): void {
  if (replace) {
    window.history.replaceState(null, '', to);
  } else {
    window.history.pushState(null, '', to);
  }
  window.dispatchEvent(new Event(navigated));
}

export function Link({
  to,
  children,
  className,
  current = false,
  replace = false,
  'aria-label': label,
  'aria-current': marked,
}: {
  readonly to: string;
  readonly children: ReactNode;
  readonly className?: string;
  /** Marks the link as the current section, e.g. in the main navigation. */
  readonly current?: boolean;
  /** Goes there in place of the current history entry, as stepping through frames does. */
  readonly replace?: boolean;
  readonly 'aria-label'?: string;
  readonly 'aria-current'?: 'true';
}) {
  return (
    <a
      href={to}
      className={className}
      aria-current={current ? 'page' : marked}
      aria-label={label}
      onClick={(event) => {
        // Let the browser handle new-tab and new-window clicks.
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        navigate(to, { replace });
      }}
    >
      {children}
    </a>
  );
}
