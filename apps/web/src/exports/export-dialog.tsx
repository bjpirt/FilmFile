import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useState, type SubmitEvent } from 'react';
import {
  defaultFileNames,
  isQuality,
  layoutChoices,
  metadataChoices,
  rememberedExportChoices,
  rememberExportChoices,
  sizes,
  type Layout,
  type Metadata,
} from './export-choices.ts';

const fullSize = 'full';

/** A frame to export, with the roll it's from. */
export interface ExportItem {
  readonly roll: Roll;
  readonly frame: Frame;
}

/** Starts a download of the address as the browser does any, without leaving the page. */
function startDownload(address: string): void {
  const link = document.createElement('a');
  link.href = address;
  link.download = '';
  document.body.append(link);
  link.click();
  link.remove();
}

/** What stops a single frame being exported, if anything. */
function whyNot(frame: Frame): string | undefined {
  if (frame.hidden) {
    return 'Unhide this frame to export it.';
  }
  return frame.versions.length === 0
    ? 'This frame has no scan to export.'
    : undefined;
}

function frames(count: number): string {
  return count === 1 ? '1 frame' : `${String(count)} frames`;
}

function itemName({ roll, frame }: ExportItem): string {
  return `frame ${frame.number ?? 'with no number'} of roll ${roll.roll}`;
}

/**
 * The Export dialog (D97): what's being exported, how it's made (size,
 * quality and metadata) and what to do with it. One frame is a JPEG; the
 * frames selected on a page are a zip, with a layout and file names too
 * (D95). The service makes the files and the browser saves them, so nothing
 * is held in the page.
 */
export function ExportDialog({
  api,
  items,
  single = false,
  zipName,
  close,
}: {
  readonly api: ApiClient;
  /** The frames to export, with their rolls. */
  readonly items: readonly ExportItem[];
  /** Whether it's the one frame being looked at, as a JPEG, rather than a selection as a zip. */
  readonly single?: boolean;
  /** What to call the zip, e.g. the event's name; otherwise it's named for the roll. */
  readonly zipName?: string;
  readonly close: () => void;
}) {
  const initial = rememberedExportChoices();
  const [size, setSize] = useState(
    initial.size === null ? fullSize : String(initial.size),
  );
  const [quality, setQuality] = useState(String(initial.quality));
  const [metadata, setMetadata] = useState<Metadata>(initial.metadata);
  const [layout, setLayout] = useState<Layout>(initial.layout);
  const [fileNames, setFileNames] = useState(initial.fileNames);
  const [reviewing, setReviewing] = useState(false);
  // Frames taken out in the dialog, by their ID.
  const [takenOut, setTakenOut] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const kept = items.filter(({ frame }) => !takenOut.has(frame.id));
  const noScan = kept.filter(({ frame }) => frame.versions.length === 0).length;
  const [only] = items;
  const name =
    single && only !== undefined ? (only.frame.number ?? 'with no number') : '';
  // A single frame can't be exported if it has nothing to make a file from;
  // for a selection, the zip says which were left out.
  const cannot =
    single && only !== undefined
      ? whyNot(only.frame)
      : kept.length - noScan === 0
        ? 'There are no frames with a scan to export.'
        : undefined;

  async function download(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosenQuality = Number(quality);
    if (!isQuality(chosenQuality)) {
      setProblem('Quality must be a whole number from 1 to 100.');
      return;
    }
    if (!single && fileNames.trim() === '') {
      setProblem('File names must not be empty.');
      return;
    }
    const chosenSize = size === fullSize ? null : Number(size);
    const names = single ? defaultFileNames : fileNames.trim();
    setProblem(undefined);
    setBusy(true);
    try {
      const { data, response } = await api.POST('/api/exports/quick', {
        body: {
          frames: kept.map(({ roll, frame }) => ({
            rollId: roll.id,
            frameId: frame.id,
          })),
          output: single ? 'jpeg' : 'zip',
          ...(zipName === undefined || single ? {} : { name: zipName }),
          layout: single ? 'flat' : layout,
          fileNames: names,
          size: chosenSize,
          quality: chosenQuality,
          metadata,
        },
      });
      if (data === undefined) {
        setProblem(
          response.status === 404
            ? "A frame isn't there any more. Reload the page."
            : response.status === 422 && !single
              ? "Couldn't make the export. Check the file names only use {roll}, {frame}, {title}, {year} and {original}."
              : "Couldn't make the export. Check the frame has a scan and isn't hidden.",
        );
        return;
      }
      rememberExportChoices({
        size: chosenSize,
        quality: chosenQuality,
        metadata,
        layout,
        fileNames: single ? initial.fileNames : names,
      });
      startDownload(data.url);
      close();
    } catch {
      setProblem("Couldn't make the export. Is the service running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="export-dialog"
      role="dialog"
      noValidate
      aria-label={
        single ? `Export frame ${name}` : `Export ${frames(kept.length)}`
      }
      onSubmit={(event) => void download(event)}
    >
      {single && only !== undefined ? (
        <p>
          <strong>Frames</strong> This frame: {only.frame.number ?? 'no number'}{' '}
          of roll {only.roll.roll}
        </p>
      ) : (
        <div className="export-frames">
          <p>
            <strong>Frames</strong> {kept.length} selected{' '}
            {kept.length === 1 ? 'frame' : 'frames'}{' '}
            <button
              type="button"
              aria-expanded={reviewing}
              onClick={() => {
                setReviewing(!reviewing);
              }}
            >
              Review
            </button>
          </p>
          {reviewing && (
            <ul aria-label="Frames to export">
              {kept.map((item) => (
                <li key={item.frame.id}>
                  {itemName(item)}{' '}
                  <button
                    type="button"
                    aria-label={`Take out ${itemName(item)}`}
                    onClick={() => {
                      setTakenOut(new Set([...takenOut, item.frame.id]));
                    }}
                  >
                    Take out
                  </button>
                </li>
              ))}
            </ul>
          )}
          {noScan > 0 && (
            <p role="status">
              {frames(noScan)} {noScan === 1 ? 'has' : 'have'} no scan and will
              be left out
            </p>
          )}
        </div>
      )}
      <label>
        Size
        <select
          value={size}
          onChange={(event) => {
            setSize(event.target.value);
          }}
        >
          <option value={fullSize}>Full size</option>
          {sizes.map((pixels) => (
            <option key={pixels} value={pixels}>
              {pixels} px
            </option>
          ))}
        </select>
      </label>
      <label>
        Quality
        <input
          type="number"
          min={1}
          max={100}
          value={quality}
          onChange={(event) => {
            setQuality(event.target.value);
          }}
        />
      </label>
      <label>
        Metadata
        <select
          value={metadata}
          onChange={(event) => {
            const chosen = metadataChoices.find(
              (choice) => choice.value === event.target.value,
            );
            if (chosen !== undefined) {
              setMetadata(chosen.value);
            }
          }}
        >
          {metadataChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      {!single && (
        <>
          <label>
            Layout
            <select
              value={layout}
              onChange={(event) => {
                const chosen = layoutChoices.find(
                  (choice) => choice.value === event.target.value,
                );
                if (chosen !== undefined) {
                  setLayout(chosen.value);
                }
              }}
            >
              {layoutChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            File names
            <input
              type="text"
              value={fileNames}
              onChange={(event) => {
                setFileNames(event.target.value);
              }}
            />
          </label>
          <p className="muted">
            Use {'{roll}'}, {'{frame}'}, {'{title}'}, {'{year}'} and{' '}
            {'{original}'}.
          </p>
        </>
      )}
      {cannot !== undefined && <p role="alert">{cannot}</p>}
      {problem !== undefined && <p role="alert">{problem}</p>}
      <div className="form-actions">
        <button
          type="submit"
          className="primary"
          disabled={cannot !== undefined || busy}
        >
          Download
        </button>
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
