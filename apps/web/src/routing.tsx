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

export function navigate(to: string): void {
  window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(navigated));
}

export function Link({
  to,
  children,
}: {
  readonly to: string;
  readonly children: ReactNode;
}) {
  return (
    <a
      href={to}
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
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
