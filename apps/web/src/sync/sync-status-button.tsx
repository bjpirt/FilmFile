import type { ApiClient } from '@filmfile/contracts/client';
import type { SyncStatus } from '@filmfile/contracts/sync';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '../routing.tsx';
import { publishedTime } from '../sites/published-time.ts';
import { SyncControls } from './sync-controls.tsx';
import { syncedAgo } from './synced-ago.ts';
import { useSyncStatus } from './use-sync-status.ts';

/** The time now, moving on every minute, so "5 min ago" keeps up. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return now;
}

/** What the header says, and whether it's a warning. */
function wordsFor(
  status: SyncStatus,
  now: Date,
): { readonly words: string; readonly warning: boolean } {
  const { run, lastSyncedAt } = status;
  if (run?.state === 'running') {
    const percent =
      run.bytesTotal === 0
        ? 0
        : Math.floor((run.bytesDone / run.bytesTotal) * 100);
    return { words: `Syncing ${String(percent)}%`, warning: false };
  }
  if (run?.state === 'failed') {
    return { words: "Sync didn't finish", warning: true };
  }
  // A cancelled sync was the person's choice: the last finished one stands.
  return {
    words:
      lastSyncedAt === null
        ? 'Not synced yet'
        : `Synced ${syncedAgo(lastSyncedAt, now)}`,
    warning: false,
  };
}

function CloudIcon({ warning }: { readonly warning: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5Z" />
      {warning && <path d="M12 10.5v3M12 16v.01" />}
    </svg>
  );
}

/**
 * How the backup stands, at the header's right end (FF-226), once sync is
 * set up: "Not synced yet", "Synced 2 h ago" (the full time on hover),
 * "Syncing 34%" or "Sync didn't finish". It opens a panel with "Sync", its
 * progress and "Cancel", and a link to the Sync settings.
 */
export function SyncStatusButton({ api }: { readonly api: ApiClient }) {
  const status = useSyncStatus(api);
  const now = useNow();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const whole = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    panel.current?.focus();
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

  if (status.data?.ready !== true) {
    return null;
  }
  const { words, warning } = wordsFor(status.data, now);
  const { lastSyncedAt } = status.data;
  return (
    <div className="sync-status" ref={whole}>
      <button
        ref={button}
        type="button"
        className={warning ? 'warning' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={words}
        {...(lastSyncedAt === null
          ? {}
          : { title: publishedTime(lastSyncedAt) })}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <CloudIcon warning={warning} />
        <span className="sync-status-words" aria-hidden="true">
          {words}
        </span>
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label="Sync"
          className="sync-panel"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              button.current?.focus();
            }
          }}
          onClick={(event) => {
            // "Sync settings" goes to Settings, so the panel closes.
            if (
              event.target instanceof Element &&
              event.target.closest('a') !== null
            ) {
              setOpen(false);
            }
          }}
        >
          <SyncControls api={api} ready lastSyncedAt={lastSyncedAt} />
          <Link to="/settings" className="sync-settings-link">
            Sync settings
          </Link>
        </div>
      )}
    </div>
  );
}
