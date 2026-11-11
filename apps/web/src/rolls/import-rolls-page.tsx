import { rollsLink } from './rolls-address.ts';
import type { ApiClient } from '@filmfile/contracts/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from '../routing.tsx';
import { DateShotFields } from './date-shot-fields.tsx';
import {
  foldersFromDrop,
  foldersFromPicker,
  type FoundFolders,
} from './import-folders.ts';
import {
  importRolls,
  type ImportResult,
  type RollToImport,
} from './import-rolls.ts';
import { ImportSummary, rollCount } from './import-summary.tsx';
import { planned, rowsFor, type ImportRow } from './import-plan.ts';
import { occupiedLabels, whatIsMissing } from './roll-number-pattern.ts';
import { useRollNumberPattern } from './use-roll-number-pattern.ts';

type Stage =
  | { readonly kind: 'choosing' }
  | { readonly kind: 'importing'; readonly roll: number; readonly done: number }
  | { readonly kind: 'finished'; readonly results: readonly ImportResult[] };

/**
 * Many rolls at once (FF-154, D90): a folder of roll folders is chosen or
 * dropped, each folder with scans is previewed as a roll named after it,
 * dated from its name and numbered from the pattern, then they're made and
 * their scans added, one after another.
 */
export function ImportRollsPage({ api }: { readonly api: ApiClient }) {
  const queryClient = useQueryClient();
  const pattern = useRollNumberPattern(api);
  const rolls = useQuery({
    queryKey: ['rolls'],
    queryFn: async () => {
      const { data } = await api.GET('/api/rolls');
      if (data === undefined) {
        throw new Error("Couldn't load the rolls.");
      }
      return data;
    },
  });
  const [found, setFound] = useState<FoundFolders | undefined>(undefined);
  const [rows, setRows] = useState<readonly ImportRow[]>([]);
  const [stage, setStage] = useState<Stage>({ kind: 'choosing' });
  const cancelled = useRef(false);

  function choose(chosen: FoundFolders) {
    setFound(chosen);
    setRows(rowsFor(chosen.folders, String(new Date().getFullYear())));
  }

  const occupied = occupiedLabels(
    (rolls.data?.rolls ?? []).map((r) => r.roll),
    (rolls.data?.unreadable ?? []).map((u) => u.folder),
  );
  const plan = planned(rows, pattern, occupied);
  const included = plan.filter((row) => row.included);
  const ready =
    rolls.data !== undefined &&
    included.length > 0 &&
    included.every((row) => row.number !== undefined);
  const placeholders = included.some(
    (row) =>
      row.shotDate !== undefined &&
      whatIsMissing(pattern, { shot: row.shotDate, event: null }) !== undefined,
  );

  async function start() {
    const toImport: RollToImport[] = [];
    for (const row of included) {
      if (row.number !== undefined && row.shotDate !== undefined) {
        toImport.push({
          folder: row.folder,
          number: row.number,
          shot: row.shotDate,
          placeholder:
            whatIsMissing(pattern, { shot: row.shotDate, event: null }) !==
            undefined,
        });
      }
    }
    cancelled.current = false;
    setStage({ kind: 'importing', roll: 0, done: 0 });
    const results = await importRolls(
      api,
      toImport,
      pattern,
      (roll, done) => {
        setStage({ kind: 'importing', roll, done });
      },
      () => cancelled.current,
    );
    setStage({ kind: 'finished', results });
    // The rolls list follows in its own time; the summary needn't wait for it.
    void queryClient.invalidateQueries({ queryKey: ['rolls'] });
  }

  const heading = (
    <div className="roll-title">
      <Link to={rollsLink()} className="breadcrumb">
        Rolls
      </Link>
      <span className="breadcrumb-separator" aria-hidden="true">
        /
      </span>
      <h1>Bulk import rolls</h1>
    </div>
  );

  if (stage.kind === 'finished') {
    return (
      <section>
        {heading}
        <ImportSummary results={stage.results} />
      </section>
    );
  }

  const busy = stage.kind === 'importing';
  return (
    <section>
      {heading}
      <div
        className="drop-zone"
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          void foldersFromDrop(event.dataTransfer).then(choose);
        }}
      >
        <p>Drop a folder of roll folders, or several roll folders, here</p>
        <label>
          Choose folder
          <input
            type="file"
            disabled={busy}
            ref={(input) => {
              input?.setAttribute('webkitdirectory', '');
            }}
            onChange={(event) => {
              choose(foldersFromPicker(Array.from(event.target.files ?? [])));
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {found?.folders.length === 0 && (
        <p role="alert">There are no roll folders with scans in it.</p>
      )}
      {found?.skipped.map((name) => (
        <p key={name} className="muted">
          Skipped: {name} (no scans)
        </p>
      ))}

      {plan.length > 0 && (
        <>
          <table className="import-rolls" aria-label="Rolls to import">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Import</span>
                </th>
                <th scope="col">Folder</th>
                <th scope="col">Frames</th>
                <th scope="col">Date shot</th>
                <th scope="col">Number</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((row, i) => (
                <tr key={`${String(i)}-${row.folder.name}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.included}
                      disabled={busy}
                      aria-label={`Import ${row.folder.name}`}
                      onChange={(event) => {
                        setRows(
                          rows.map((r, j) =>
                            j === i
                              ? { ...r, included: event.target.checked }
                              : r,
                          ),
                        );
                      }}
                    />
                  </td>
                  <td>{row.folder.name}</td>
                  <td>{row.folder.scans.length}</td>
                  <td>
                    <DateShotFields
                      legend={`Date shot of ${row.folder.name}`}
                      withTime={false}
                      compact
                      shot={row.shot}
                      change={(shot) => {
                        setRows(
                          rows.map((r, j) => (j === i ? { ...r, shot } : r)),
                        );
                      }}
                    />
                  </td>
                  <td className="numbers">
                    {row.included &&
                      (row.number ??
                        'Enter the year as four digits, like 2026.')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {placeholders && (
            <p>
              Numbers with MM, DD or event need those details: set them on each
              roll, then choose Re-number rolls…
            </p>
          )}
          {stage.kind === 'importing' && (
            <p role="status">
              Importing roll {stage.roll + 1} of {included.length}: frame{' '}
              {stage.done} of {included[stage.roll]?.folder.scans.length ?? 0}
            </p>
          )}
          <div className="form-actions">
            {stage.kind === 'importing' ? (
              <button
                type="button"
                onClick={() => {
                  cancelled.current = true;
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={!ready}
                onClick={() => {
                  void start();
                }}
              >
                Import {rollCount(included.length)}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
