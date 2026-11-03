import type { ApiClient } from '@filmfile/contracts/client';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { CameraField } from '../equipment/camera-field.tsx';
import { chooseCamera } from '../equipment/choose-camera.ts';
import { useCameras } from '../equipment/use-cameras.ts';
import { Link, navigate } from '../routing.tsx';
import { DateShotFields } from './date-shot-fields.tsx';
import { describeUpload } from './describe-upload.ts';
import { droppedFiles } from './dropped-files.ts';
import { shotFrom, type ShotFields } from './shot-fields.ts';
import { uploadScans, type UploadReport } from './upload-scans.ts';

type Progress =
  | { readonly kind: 'editing' }
  | { readonly kind: 'creating' }
  | {
      readonly kind: 'uploading';
      readonly done: number;
      readonly total: number;
    }
  // Some scans weren't added: say what happened before opening the roll.
  | {
      readonly kind: 'finished';
      readonly rollId: string;
      readonly report: UploadReport;
    };

/**
 * A new roll: its details, and optionally its scans, gathered on one page.
 * Create roll saves the roll, adds the scans, and opens it.
 */
export function NewRollPage({ api }: { readonly api: ApiClient }) {
  const queryClient = useQueryClient();
  const cameras = useCameras(api);
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [camera, setCamera] = useState('');
  const [shot, setShot] = useState<ShotFields>({
    year: '',
    month: '',
    day: '',
    time: '',
  });
  // The year follows the roll number until it's changed by hand (D27).
  const [yearChanged, setYearChanged] = useState(false);
  const [scans, setScans] = useState<readonly File[]>([]);
  const [progress, setProgress] = useState<Progress>({ kind: 'editing' });
  const [problem, setProblem] = useState<string | undefined>(undefined);

  function changeRollNumber(value: string) {
    setRollNumber(value);
    const year = /^\d{4}/.exec(value)?.[0];
    if (!yearChanged && year !== undefined) {
      setShot({ ...shot, year });
    }
  }

  function changeShot(next: ShotFields) {
    if (next.year !== shot.year) {
      setYearChanged(true);
    }
    setShot(next);
  }

  async function create(event: SubmitEvent) {
    event.preventDefault();
    const roll = rollNumber.trim();
    if (roll === '') {
      setProblem('Enter a roll number like 2026-014.');
      return;
    }
    const entered = shotFrom(shot);
    // A roll needs at least the year it was shot.
    if (!entered.valid || entered.shot === undefined) {
      setProblem('Enter the year as four digits, like 2026.');
      return;
    }
    const shotDate = entered.shot;
    setProblem(undefined);
    setProgress({ kind: 'creating' });
    const chosen = await chooseCamera(api, cameras, camera);
    if (!chosen.ok) {
      setProgress({ kind: 'editing' });
      setProblem(chosen.problem);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['cameras'] });
    const { data, response, error } = await api.POST('/api/rolls', {
      body: {
        roll,
        ...(name.trim() === '' ? {} : { name: name.trim() }),
        ...(description.trim() === ''
          ? {}
          : { description: description.trim() }),
        shot: shotDate,
        ...(chosen.slug === null ? {} : { camera: chosen.slug }),
      },
    });
    if (data === undefined) {
      setProgress({ kind: 'editing' });
      const aboutDate =
        'issues' in error && error.issues.some((i) => i.path[0] === 'shot');
      setProblem(
        response.status === 409
          ? `Roll ${roll} already exists.`
          : response.status !== 422
            ? "Couldn't create the roll. Is the service running?"
            : aboutDate
              ? "That date doesn't exist. Check the day and month."
              : 'Enter a roll number like 2026-014: the year it was shot, then three digits.',
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['rolls'] });

    if (scans.length > 0) {
      const total = scans.length;
      setProgress({ kind: 'uploading', done: 0, total });
      const report = await uploadScans(api, data, scans, (done) => {
        setProgress({ kind: 'uploading', done, total });
      });
      if (report.failed.length > 0 || report.alreadyInRoll > 0) {
        setProgress({ kind: 'finished', rollId: data.id, report });
        return;
      }
    }
    navigate(`/rolls/${data.id}`);
  }

  if (progress.kind === 'finished') {
    return (
      <section>
        <h1>New roll</h1>
        <p role="status">{describeUpload(progress.report)}</p>
        <Link to={`/rolls/${progress.rollId}`}>
          Open roll {rollNumber.trim()}
        </Link>
      </section>
    );
  }

  const busy = progress.kind !== 'editing';
  return (
    <section>
      <div className="roll-title">
        <Link to="/">All rolls</Link>
        <span className="muted" aria-hidden="true">
          /
        </span>
        <h1>New roll</h1>
      </div>

      {/* noValidate: the page's own messages explain a missing field. */}
      <form
        className="roll-details"
        noValidate
        onSubmit={(event) => void create(event)}
      >
        <label>
          <span>
            Roll number{' '}
            <span className="required" aria-hidden="true">
              *
            </span>
          </span>
          <input
            className="numbers"
            value={rollNumber}
            placeholder="2026-014"
            required
            autoFocus
            onChange={(event) => {
              changeRollNumber(event.target.value);
            }}
          />
        </label>
        <label>
          Name
          <input
            value={name}
            placeholder="Iceland, first day"
            maxLength={100}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            rows={3}
            maxLength={5000}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
          />
        </label>

        <DateShotFields shot={shot} change={changeShot} />
        <CameraField cameras={cameras} value={camera} change={setCamera} />

        <div
          className="drop-zone"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            void droppedFiles(event.dataTransfer).then((files) => {
              setScans([...scans, ...files]);
            });
          }}
        >
          <p>Drop individual scans here</p>
          <label>
            Choose scans
            <input
              type="file"
              accept="image/jpeg"
              multiple
              disabled={busy}
              onChange={(event) => {
                setScans([...scans, ...Array.from(event.target.files ?? [])]);
                event.target.value = '';
              }}
            />
          </label>
          {scans.length > 0 && (
            <p>
              {scans.length === 1 ? '1 scan' : `${String(scans.length)} scans`}{' '}
              ready to add{' '}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setScans([]);
                }}
              >
                Clear
              </button>
            </p>
          )}
        </div>

        {problem !== undefined && <p role="alert">{problem}</p>}
        {progress.kind === 'creating' && (
          <p role="status">Creating the roll…</p>
        )}
        {progress.kind === 'uploading' && (
          <p role="status">
            Adding scan {Math.min(progress.done + 1, progress.total)} of{' '}
            {progress.total}…
          </p>
        )}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={busy}>
            Create roll
          </button>
          <Link to="/">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
