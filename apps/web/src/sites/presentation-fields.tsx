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

const organisations = [
  { value: 'events', label: 'Events' },
  { value: 'rolls', label: 'Rolls' },
  { value: 'both', label: 'Both' },
] as const;

/**
 * How a site is shown when it's built: whether it's cards of its events, its
 * rolls or both (D104), and which details are in the captions; its title is
 * its name (FF-179). A choice is saved at once.
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
        <span>Organise by</span>
        <select
          value={presentation.organiseBy}
          onChange={(event) => {
            const organiseBy = organisations.find(
              (choice) => choice.value === event.target.value,
            );
            if (organiseBy !== undefined) {
              change({ ...presentation, organiseBy: organiseBy.value });
            }
          }}
        >
          {organisations.map((choice) => (
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
