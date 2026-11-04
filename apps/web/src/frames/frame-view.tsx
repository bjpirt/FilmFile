import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useEffect, useRef, useState } from 'react';
import { BinIcon } from '../bin-icon.tsx';
import { MenuButton } from '../menu-button.tsx';
import { Thumbnail } from '../rolls/thumbnail.tsx';
import { Link, navigate } from '../routing.tsx';
import {
  rememberDetailsOpen,
  rememberedDetailsOpen,
} from './details-preference.ts';
import { FrameDetails } from './frame-details.tsx';
import { shownVersion } from '../rolls/shown-version.ts';
import { useSaveFrame, type QuarterTurn } from './use-save-frame.ts';

/** A frame in the collection being stepped through, with the roll it's on. */
export interface CollectionFrame {
  readonly roll: Roll;
  readonly frame: Frame;
}

/** Whether a key press was meant for a field rather than for the frame view. */
function typing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

const quarterTurns: readonly QuarterTurn[] = [0, 90, 180, 270];

/** A curved arrow, turning one way or the other. */
function TurnIcon({ clockwise }: { readonly clockwise: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* The clockwise arrow is the anticlockwise one, mirrored. */}
      <g transform={clockwise ? 'translate(24 0) scale(-1 1)' : undefined}>
        <path d="M4 12a8 8 0 1 0 2.5-5.8" />
        <path d="M4 3v5h5" />
      </g>
    </svg>
  );
}

/** A version's file name, as it was added: 12340001.jpg, edit-2.png. */
function fileNameOf(version: CollectionFrame['frame']['versions'][number]) {
  return version.file.split('/').at(-1) ?? version.file;
}

/** Adds an image to the frame as another version (U34): a "+". */
function AddVersionButton({
  add,
  className,
}: {
  readonly add: () => void;
  readonly className: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label="Add a version"
      title="Add a version"
      onClick={add}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

/** Shows and hides the frame's details: an "i" in a circle, named for what it will do. */
function DetailsToggle({
  open,
  toggle,
}: {
  readonly open: boolean;
  readonly toggle: () => void;
}) {
  const label = open ? 'Hide details' : 'Show details';
  return (
    <button
      type="button"
      className="icon-button details-toggle"
      aria-label={label}
      title={label}
      aria-expanded={open}
      aria-controls="frame-details"
      onClick={toggle}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="11" x2="12" y2="16.5" />
        <circle cx="12" cy="7.75" r="0.6" fill="currentColor" />
      </svg>
    </button>
  );
}

/**
 * One frame, large, with a filmstrip of the collection it was opened from
 * (a roll, or an event's frames) to step through: by the arrows on screen,
 * the ← and → keys, or a click on the filmstrip. Esc goes back, and the 1 to
 * 5 keys rate the frame, 0 clearing its rating (D39).
 */
export function FrameView({
  api,
  frames,
  current,
  back,
  addressOf,
  labelOf,
}: {
  readonly api: ApiClient;
  readonly frames: readonly CollectionFrame[];
  /** The index of the frame shown. */
  readonly current: number;
  /** Where the frame was opened from, to go back to. */
  readonly back: { readonly to: string; readonly label: string };
  /** A frame's own address in this collection. */
  readonly addressOf: (frame: CollectionFrame) => string;
  /** A frame as the filmstrip names it, e.g. "Frame 12". */
  readonly labelOf: (frame: CollectionFrame) => string;
}) {
  const shown = frames[current];
  const previous = frames[current - 1];
  const next = frames[current + 1];
  const currentInStrip = useRef<HTMLLIElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(rememberedDetailsOpen);
  const { save, turn, remove, addVersion, deleteVersion, problem } =
    useSaveFrame(api, shown);
  const chooseVersion = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<
    { readonly frameId: string; readonly versionId: string } | undefined
  >(undefined);
  // The version looked at here, for this frame only: the one shown everywhere
  // until another is clicked in the versions column (U61). It's the one turned.
  const inView =
    shown === undefined
      ? undefined
      : (shown.frame.versions.find(
          (version) =>
            viewing?.frameId === shown.frame.id &&
            version.id === viewing.versionId,
        ) ?? shownVersion(shown.frame));
  const turning = inView;

  /** Turns the version shown a quarter turn: 90 clockwise, -90 anticlockwise. */
  function turnBy(degrees: 90 | -90) {
    if (turning === undefined) {
      return;
    }
    const turned = quarterTurns.find(
      (t) => t === (turning.rotate + degrees + 360) % 360,
    );
    if (turned !== undefined) {
      void turn(turning.id, turned);
    }
  }
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The version being asked about, "Delete this version?" (U28b).
  const [confirmingVersion, setConfirmingVersion] = useState<
    string | undefined
  >(undefined);

  /** Deletes the frame shown, then shows the next, the previous, or where it was opened from. */
  function deleteShown() {
    const after = next ?? previous;
    void remove(() => {
      navigate(after === undefined ? back.to : addressOf(after), {
        replace: true,
      });
    });
  }

  useEffect(() => {
    // happy-dom, which the page tests run in, has no scrollIntoView, though
    // its types say every element does.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    currentInStrip.current?.scrollIntoView?.({
      block: 'nearest',
      inline: 'center',
    });
  }, [current]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        typing(event.target)
      ) {
        return;
      }
      if (confirmingDelete || confirmingVersion !== undefined) {
        // Esc answers the question, rather than leaving the frame view.
        if (event.key === 'Escape') {
          setConfirmingDelete(false);
          setConfirmingVersion(undefined);
          event.preventDefault();
        }
        return;
      }
      // Stepping replaces the address, so Back still leaves the frame view.
      if (event.key === 'ArrowLeft' && previous !== undefined) {
        navigate(addressOf(previous), { replace: true });
      } else if (event.key === 'ArrowRight' && next !== undefined) {
        navigate(addressOf(next), { replace: true });
      } else if (event.key === 'Escape') {
        navigate(back.to);
      } else if (/^[0-5]$/.test(event.key)) {
        void save({ rating: event.key === '0' ? null : Number(event.key) });
      } else {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [
    previous,
    next,
    back.to,
    addressOf,
    save,
    confirmingDelete,
    confirmingVersion,
  ]);

  if (shown === undefined) {
    return (
      <p>
        There is no such frame. <Link to={back.to}>{back.label}</Link>
      </p>
    );
  }

  const manyVersions = shown.frame.versions.length > 1;
  const everywhere = shownVersion(shown.frame);

  return (
    <section className="frame-view">
      <div className="frame-view-bar">
        <Link to={back.to} className="breadcrumb">
          {back.label}
        </Link>
        <span className="breadcrumb-separator" aria-hidden="true">
          /
        </span>
        <h1>Frame {shown.frame.number ?? 'with no number'}</h1>
        {shown.frame.rating !== null && (
          <span
            className="rating"
            aria-label={`Rated ${String(shown.frame.rating)} of 5`}
          >
            {'★'.repeat(shown.frame.rating)}
          </span>
        )}
        <span className="muted">
          {current + 1} of {frames.length}
        </span>
        <span className="frame-view-actions">
          {/* At the foot of the versions column once there's more than one (U61). */}
          {!manyVersions && (
            <AddVersionButton
              add={() => chooseVersion.current?.click()}
              className="icon-button"
            />
          )}
          <input
            ref={chooseVersion}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Image to add as a version"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file !== undefined) {
                void addVersion(file);
              }
            }}
          />
          {turning !== undefined && (
            <>
              <button
                type="button"
                className="icon-button"
                aria-label="Rotate anticlockwise"
                title="Rotate anticlockwise"
                onClick={() => {
                  turnBy(-90);
                }}
              >
                <TurnIcon clockwise={false} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Rotate clockwise"
                title="Rotate clockwise"
                onClick={() => {
                  turnBy(90);
                }}
              >
                <TurnIcon clockwise />
              </button>
            </>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label="Delete frame"
            title="Delete frame"
            onClick={() => {
              setConfirmingDelete(true);
            }}
          >
            <BinIcon size={20} />
          </button>
          <DetailsToggle
            open={detailsOpen}
            toggle={() => {
              rememberDetailsOpen(!detailsOpen);
              setDetailsOpen(!detailsOpen);
            }}
          />
        </span>
      </div>
      {shown.frame.title !== null && (
        <p className="frame-title">{shown.frame.title}</p>
      )}

      <div
        className={
          detailsOpen ? 'frame-view-body with-details' : 'frame-view-body'
        }
      >
        <div className="frame-view-stage">
          {manyVersions && (
            <div role="group" aria-label="Versions" className="versions-column">
              {shown.frame.versions.map((version, i) => {
                const name = fileNameOf(version);
                // What's shown everywhere once this one goes: the next, or the one before.
                const instead = shown.frame.versions[i === 0 ? 1 : 0];
                return (
                  <div key={version.id} className="version-item">
                    {confirmingVersion === version.id ? (
                      // In the thumbnail's place: the column's too narrow to cover it.
                      <div
                        role="alertdialog"
                        aria-label={`Delete ${name}`}
                        className="confirm-version"
                      >
                        <p className="confirm-question">
                          Delete this version?
                          {version.id === everywhere?.id &&
                            instead !== undefined &&
                            ` ${fileNameOf(instead)} will be shown instead.`}
                        </p>
                        <div className="confirm-actions">
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setConfirmingVersion(undefined);
                              void deleteVersion(version.id, () => {
                                setViewing(undefined);
                              });
                            }}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            autoFocus
                            onClick={() => {
                              setConfirmingVersion(undefined);
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="version-thumb"
                          aria-label={`Show ${name}`}
                          aria-pressed={version.id === inView?.id}
                          onClick={() => {
                            setViewing({
                              frameId: shown.frame.id,
                              versionId: version.id,
                            });
                          }}
                        >
                          <Thumbnail
                            rollId={shown.roll.id}
                            frame={shown.frame}
                            version={version}
                            decorative
                          />
                          <span className="version-name">{name}</span>
                          {version.id === everywhere?.id && (
                            <span className="version-everywhere">
                              Shown everywhere
                            </span>
                          )}
                        </button>
                        <MenuButton
                          label={`Options for ${name}`}
                          className="version-menu"
                          icon={
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <circle cx="5" cy="12" r="1.8" />
                              <circle cx="12" cy="12" r="1.8" />
                              <circle cx="19" cy="12" r="1.8" />
                            </svg>
                          }
                          items={[
                            {
                              label: 'Delete version…',
                              danger: true,
                              select: () => {
                                setConfirmingVersion(version.id);
                              },
                            },
                          ]}
                        />
                      </>
                    )}
                  </div>
                );
              })}
              <AddVersionButton
                add={() => chooseVersion.current?.click()}
                className="version-add"
              />
            </div>
          )}
          <button
            type="button"
            className="frame-step"
            aria-label="Previous frame"
            disabled={previous === undefined}
            onClick={() => {
              if (previous !== undefined) {
                navigate(addressOf(previous), { replace: true });
              }
            }}
          >
            ‹
          </button>
          <div className="frame-view-image">
            <Thumbnail
              rollId={shown.roll.id}
              frame={shown.frame}
              size="large"
              {...(inView === undefined ? {} : { version: inView })}
            />
            {confirmingDelete && (
              <div
                role="alertdialog"
                aria-label={`Delete frame ${shown.frame.number ?? 'with no number'}`}
                className="confirm-delete over-frame"
              >
                <p className="confirm-question">Delete this frame?</p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      setConfirmingDelete(false);
                      deleteShown();
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      setConfirmingDelete(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="frame-step"
            aria-label="Next frame"
            disabled={next === undefined}
            onClick={() => {
              if (next !== undefined) {
                navigate(addressOf(next), { replace: true });
              }
            }}
          >
            ›
          </button>
        </div>
        {detailsOpen && (
          <FrameDetails
            // A fresh panel for each frame, so a field's text is that frame's.
            key={shown.frame.id}
            api={api}
            roll={shown.roll}
            frame={shown.frame}
            save={save}
          />
        )}
      </div>
      {problem !== undefined && <p role="alert">{problem}</p>}

      <ol className="filmstrip" aria-label="Filmstrip">
        {frames.map((item, i) => (
          <li
            key={`${item.roll.id}-${item.frame.id}`}
            ref={i === current ? currentInStrip : undefined}
          >
            <Link
              to={addressOf(item)}
              replace
              aria-label={labelOf(item)}
              {...(i === current ? { 'aria-current': 'true' } : {})}
            >
              <Thumbnail rollId={item.roll.id} frame={item.frame} decorative />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
