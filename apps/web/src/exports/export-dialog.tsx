import type { ApiClient } from '@filmfile/contracts/client';
import type { Frame, Roll } from '@filmfile/contracts/rolls';
import { useState, type SubmitEvent } from 'react';
import {
  isQuality,
  metadataChoices,
  type Metadata,
  rememberedExportChoices,
  rememberExportChoices,
  sizes,
} from './export-choices.ts';

const fullSize = 'full';

/** Starts a download of the address as the browser does any, without leaving the page. */
function startDownload(address: string): void {
  const link = document.createElement('a');
  link.href = address;
  link.download = '';
  document.body.append(link);
  link.click();
  link.remove();
}

/** What stops a frame being exported, if anything. */
function whyNot(frame: Frame): string | undefined {
  if (frame.hidden) {
    return 'Unhide this frame to export it.';
  }
  return frame.versions.length === 0
    ? 'This frame has no scan to export.'
    : undefined;
}

/**
 * The Export dialog (D97): what's being exported, how it's made (size and
 * quality) and what to do with it. For now one frame, downloaded as a JPEG
 * (D95); the service makes it and the browser saves it, so nothing is held
 * in the page.
 */
export function ExportDialog({
  api,
  roll,
  frame,
  close,
}: {
  readonly api: ApiClient;
  readonly roll: Roll;
  readonly frame: Frame;
  readonly close: () => void;
}) {
  const initial = rememberedExportChoices();
  const [size, setSize] = useState(
    initial.size === null ? fullSize : String(initial.size),
  );
  const [quality, setQuality] = useState(String(initial.quality));
  const [metadata, setMetadata] = useState<Metadata>(initial.metadata);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const name = frame.number ?? 'with no number';
  const cannot = whyNot(frame);

  async function download(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosenQuality = Number(quality);
    if (!isQuality(chosenQuality)) {
      setProblem('Quality must be a whole number from 1 to 100.');
      return;
    }
    const chosenSize = size === fullSize ? null : Number(size);
    setProblem(undefined);
    setBusy(true);
    try {
      const { data, response } = await api.POST('/api/exports/quick', {
        body: {
          frames: [{ rollId: roll.id, frameId: frame.id }],
          size: chosenSize,
          quality: chosenQuality,
          metadata,
        },
      });
      if (data === undefined) {
        setProblem(
          response.status === 404
            ? "That frame isn't there any more. Reload the page."
            : "Couldn't make the export. Check the frame has a scan and isn't hidden.",
        );
        return;
      }
      rememberExportChoices({
        size: chosenSize,
        quality: chosenQuality,
        metadata,
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
      aria-label={`Export frame ${name}`}
      onSubmit={(event) => void download(event)}
    >
      <p>
        <strong>Frames</strong> This frame: {frame.number ?? 'no number'} of
        roll {roll.roll}
      </p>
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
