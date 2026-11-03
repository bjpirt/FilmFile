import type { Roll } from '@filmfile/contracts/rolls';
import { Link } from '../routing.tsx';
import { thumbnailUrl } from './thumbnail-url.ts';

/** The rolls as a compact table: roll number, a strip of the first scans and the frame count. */
export function RollTable({ rolls }: { readonly rolls: readonly Roll[] }) {
  return (
    <div className="table-scroll">
      <table className="roll-table">
        <thead>
          <tr>
            <th scope="col">Roll</th>
            <th scope="col">Strip</th>
            <th scope="col" className="number">
              Frames
            </th>
          </tr>
        </thead>
        <tbody>
          {rolls.map((roll) => (
            <tr key={roll.id}>
              <td>
                <Link to={`/rolls/${roll.id}`} className="roll-number">
                  {roll.roll}
                </Link>
              </td>
              <td>
                <div className="strip" aria-hidden="true">
                  {roll.frames.slice(0, 4).flatMap((frame) => {
                    const src = thumbnailUrl(roll.id, frame);
                    return src === undefined
                      ? []
                      : [<img key={frame.id} src={src} alt="" />];
                  })}
                </div>
              </td>
              <td className="number muted">
                {roll.frames.length === 0 ? '—' : roll.frames.length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
