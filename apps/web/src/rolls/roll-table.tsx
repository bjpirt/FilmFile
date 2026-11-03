import type { Camera, FilmStock } from '@filmfile/contracts/equipment';
import type { Roll } from '@filmfile/contracts/rolls';
import { cameraName } from '../equipment/use-cameras.ts';
import { filmStockName } from '../equipment/use-film-stocks.ts';
import { Link } from '../routing.tsx';
import { formatShot } from './format-shot.ts';
import { thumbnailUrl } from './thumbnail-url.ts';

/** The rolls as a compact table: roll number, a strip of the first scans, details and the frame count. */
export function RollTable({
  rolls,
  cameras,
  films,
}: {
  readonly rolls: readonly Roll[];
  readonly cameras: readonly Camera[];
  readonly films: readonly FilmStock[];
}) {
  return (
    <div className="table-scroll">
      <table className="roll-table">
        <thead>
          <tr>
            <th scope="col">Roll</th>
            <th scope="col">Strip</th>
            <th scope="col">Name</th>
            <th scope="col">Camera</th>
            <th scope="col">Film stock</th>
            <th scope="col">Shot</th>
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
              <td>{roll.name}</td>
              <td>{cameraName(cameras, roll.camera)}</td>
              <td>{filmStockName(films, roll.film)}</td>
              <td className="muted">
                {roll.shot === null ? '—' : formatShot(roll.shot)}
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
