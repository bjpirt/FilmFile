import { Link } from '../routing.tsx';
import { formatShot } from './format-shot.ts';
import type { ImportResult } from './import-rolls.ts';

export function frameCount(count: number): string {
  return count === 1 ? '1 frame' : `${String(count)} frames`;
}

export function rollCount(count: number): string {
  return count === 1 ? '1 roll' : `${String(count)} rolls`;
}

/** What to say of a result, and whether it needs a look: a mark, the words, and the class that colours them. */
function statusOf(result: ImportResult): {
  readonly mark: string;
  readonly className: string;
  readonly text: string;
} {
  switch (result.kind) {
    case 'failed':
      return {
        mark: '✗',
        className: 'import-bad',
        text: `Couldn't be made: ${result.reason}`,
      };
    case 'not-started':
      return {
        mark: '–',
        className: 'muted',
        text: 'Not imported (cancelled)',
      };
    case 'imported': {
      const { report } = result;
      const notes: string[] = [];
      if (report.failed.length > 0) {
        notes.push(
          `Not added: ${report.failed.map((f) => `${f.file} (${f.reason})`).join(', ')}`,
        );
      }
      if (report.notTried > 0) {
        notes.push(`${frameCount(report.notTried)} not added (cancelled)`);
      }
      if (result.placeholder) {
        notes.push('Set its date or event, then choose Number rolls…');
      }
      return notes.length === 0
        ? { mark: '✓', className: 'import-ok', text: 'Added' }
        : { mark: '⚠', className: 'import-warn', text: notes.join('. ') };
    }
  }
}

/**
 * What an import did (FF-154, D90): the counts, then a row for each folder
 * in the order given, with a status that says if it needs a look.
 */
export function ImportSummary({
  results,
}: {
  readonly results: readonly ImportResult[];
}) {
  const imported = results.flatMap((r) => (r.kind === 'imported' ? [r] : []));
  const frames = imported.reduce((sum, r) => sum + r.report.uploaded, 0);
  const notStarted = results.filter((r) => r.kind === 'not-started').length;
  return (
    <>
      <p role="status">
        Imported {rollCount(imported.length)}, {frameCount(frames)}.
        {notStarted > 0 && ` Cancelled: ${rollCount(notStarted)} not imported.`}
      </p>
      <table className="import-summary" aria-label="Imported rolls">
        <thead>
          <tr>
            <th scope="col">Number</th>
            <th scope="col">Name</th>
            <th scope="col">Date</th>
            <th scope="col">Frames</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, i) => {
            const status = statusOf(result);
            return (
              <tr key={`${String(i)}-${result.name}`}>
                {result.kind === 'imported' ? (
                  <>
                    <td className="numbers">
                      <Link to={`/rolls/${result.id}`}>{result.number}</Link>
                    </td>
                    <td>{result.name}</td>
                    <td>{formatShot(result.shot)}</td>
                    <td>{result.report.uploaded}</td>
                  </>
                ) : (
                  <>
                    <td className="muted">—</td>
                    <td>{result.name}</td>
                    <td className="muted">—</td>
                    <td className="muted">—</td>
                  </>
                )}
                <td className={status.className}>
                  <span aria-hidden="true">{status.mark}</span> {status.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        <Link to="/" className="button">
          All rolls
        </Link>
      </p>
    </>
  );
}
