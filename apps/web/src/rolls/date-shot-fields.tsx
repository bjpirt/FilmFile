import type { ShotFields } from './shot-fields.ts';

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

/**
 * The date a roll was shot: a year, then optionally a month, day and time,
 * each offered once the one before it is given.
 */
export function DateShotFields({
  shot,
  change,
}: {
  readonly shot: ShotFields;
  readonly change: (shot: ShotFields) => void;
}) {
  function changePart(part: Partial<ShotFields>) {
    const next = { ...shot, ...part };
    // Each part needs the one before it.
    change({
      ...next,
      day: next.month === '' ? '' : next.day,
      time: next.month === '' || next.day === '' ? '' : next.time,
    });
  }

  return (
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
            changePart({ year: event.target.value });
          }}
        />
      </label>
      <label>
        Month
        <select
          value={shot.month}
          onChange={(event) => {
            changePart({ month: event.target.value });
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
            changePart({ day: event.target.value });
          }}
        >
          <option value="">—</option>
          {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((day) => (
            <option key={day} value={day.padStart(2, '0')}>
              {day}
            </option>
          ))}
        </select>
      </label>
      <label>
        Time
        <input
          type="time"
          value={shot.time}
          disabled={shot.day === ''}
          onChange={(event) => {
            changePart({ time: event.target.value });
          }}
        />
      </label>
    </fieldset>
  );
}
