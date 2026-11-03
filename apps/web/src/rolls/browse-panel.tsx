import type { Roll } from '@filmfile/contracts/rolls';

/** The years rolls were shot in, newest first, with how many rolls each has. */
function yearsOf(rolls: readonly Roll[]): { year: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const roll of rolls) {
    const year = roll.roll.slice(0, 4);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, count]) => ({ year, count }));
}

/**
 * Ways into the rolls: all of them, or those from one year. More sections
 * (events, cameras, film stocks) arrive with their data.
 */
export function BrowsePanel({
  rolls,
  year,
  choose,
}: {
  readonly rolls: readonly Roll[];
  readonly year: string | undefined;
  readonly choose: (year: string | undefined) => void;
}) {
  return (
    <aside id="browse" className="browse" aria-label="Browse rolls">
      <button
        type="button"
        aria-pressed={year === undefined}
        onClick={() => {
          choose(undefined);
        }}
      >
        <span>All rolls</span>
        <span className="muted">{rolls.length}</span>
      </button>
      <section>
        <h2>Years</h2>
        {yearsOf(rolls).map((option) => (
          <button
            key={option.year}
            type="button"
            aria-pressed={year === option.year}
            onClick={() => {
              choose(option.year);
            }}
          >
            <span>{option.year}</span>
            <span className="muted">{option.count}</span>
          </button>
        ))}
      </section>
    </aside>
  );
}
