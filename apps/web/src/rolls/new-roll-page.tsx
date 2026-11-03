import type { ApiClient } from '@filmfile/contracts/client';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link, navigate } from '../routing.tsx';
import { describeUpload } from './describe-upload.ts';
import { droppedFiles } from './dropped-files.ts';
import { shotFrom, type ShotFields } from './shot-fields.ts';
import { uploadScans, type UploadReport } from './upload-scans.ts';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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

  function changeShot(change: Partial<ShotFields>) {
    const next = { ...shot, ...change };
    // Each part needs the one before it.
    setShot({
      ...next,
      day: next.month === '' ? '' : next.day,
      time: next.month === '' || next.day === '' ? '' : next.time,
    });
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
    const { data, response, error } = await api.POST('/api/rolls', {
      body: {
        roll,
        ...(name.trim() === '' ? {} : { name: name.trim() }),
        ...(description.trim() === ''
          ? {}
          : { description: description.trim() }),
        shot: shotDate,
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

        <fieldset className="date-shot">
          <legend>Date shot</legend>
          <label>
            <span>
              Year{' '}
              <span className="required" aria-hidden="true">
                *
              </span>
            </span>
            <input
              required
              className="numbers"
              inputMode="numeric"
              size={4}
              maxLength={4}
              value={shot.year}
              onChange={(event) => {
                setYearChanged(true);
                changeShot({ year: event.target.value });
              }}
            />
          </label>
          <label>
            Month
            <select
              value={shot.month}
              onChange={(event) => {
                changeShot({ month: event.target.value });
              }}
            >
              <option value="">—</option>
              {months.map((month, i) => (
                <option key={month} value={String(i + 1).padStart(2, '0')}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day
            <select
              value={shot.day}
              disabled={shot.month === ''}
              onChange={(event) => {
                changeShot({ day: event.target.value });
              }}
            >
              <option value="">—</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map(
                (day) => (
                  <option key={day} value={day.padStart(2, '0')}>
                    {day}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Time
            <input
              type="time"
              value={shot.time}
              disabled={shot.day === ''}
              onChange={(event) => {
                changeShot({ time: event.target.value });
              }}
            />
          </label>
        </fieldset>

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
