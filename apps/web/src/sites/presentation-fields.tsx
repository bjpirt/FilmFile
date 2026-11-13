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

/**
 * How a site is shown when it's built: which details are in the captions.
 * Its title is its name (FF-179) and it's always organised by event (D107).
 * A choice is saved at once.
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
