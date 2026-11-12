import type { Site } from '@filmfile/contracts/sites';

type Presentation = Site['presentation'];
type Caption = Presentation['captions'][number];

const captionChoices: readonly { value: Caption; label: string }[] = [
  { value: 'title', label: 'Title' },
  { value: 'shot', label: 'Date shot' },
  { value: 'camera', label: 'Camera' },
  { value: 'lens', label: 'Lens' },
  { value: 'film', label: 'Film stock' },
];

const groupings = [
  { value: 'nothing', label: 'Nothing' },
  { value: 'roll', label: 'Roll' },
  { value: 'event', label: 'Event' },
] as const;

/**
 * How a site is shown when it's built: what the photos are grouped by, and
 * which details are in the captions; its title is its name (FF-179). A
 * choice is saved at once.
 */
export function PresentationFields({
  presentation,
  change,
}: {
  readonly presentation: Presentation;
  readonly change: (presentation: Presentation) => void;
}) {
  return (
    <section className="presentation" aria-label="How the site looks">
      <label>
        <span>Group by</span>
        <select
          value={presentation.groupBy}
          onChange={(event) => {
            const groupBy = groupings.find(
              (choice) => choice.value === event.target.value,
            );
            if (groupBy !== undefined) {
              change({ ...presentation, groupBy: groupBy.value });
            }
          }}
        >
          {groupings.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="rule-choices">
        <legend>Captions</legend>
        {captionChoices.map((choice) => (
          <label key={choice.value}>
            <input
              type="checkbox"
              checked={presentation.captions.includes(choice.value)}
              onChange={(event) => {
                const others = presentation.captions.filter(
                  (caption) => caption !== choice.value,
                );
                change({
                  ...presentation,
                  captions: event.target.checked
                    ? [...others, choice.value]
                    : others,
                });
              }}
            />
            {choice.label}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
