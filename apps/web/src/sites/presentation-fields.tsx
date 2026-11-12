import type { Site } from '@filmfile/contracts/sites';
import { useState } from 'react';

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
 * How a site is shown when it's built: its title (its name unless changed),
 * an intro, what the photos are grouped by, and which details are in the
 * captions. A choice is saved at once; text is saved when you leave it.
 */
export function PresentationFields({
  presentation,
  siteName,
  change,
}: {
  readonly presentation: Presentation;
  readonly siteName: string;
  readonly change: (presentation: Presentation) => void;
}) {
  const [title, setTitle] = useState(presentation.title ?? '');
  const [intro, setIntro] = useState(presentation.intro);

  function saveTitle() {
    const wanted = title.trim() === '' ? null : title.trim();
    if (wanted !== presentation.title) {
      change({ ...presentation, title: wanted });
    }
  }

  function saveIntro() {
    if (intro !== presentation.intro) {
      change({ ...presentation, intro });
    }
  }

  return (
    <section className="presentation" aria-label="How it looks">
      <h2>How it looks</h2>
      <label>
        <span>Page title</span>
        <input
          value={title}
          placeholder={siteName}
          maxLength={100}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          onBlur={saveTitle}
        />
      </label>
      <label>
        <span>Intro</span>
        <textarea
          value={intro}
          rows={3}
          maxLength={5000}
          onChange={(event) => {
            setIntro(event.target.value);
          }}
          onBlur={saveIntro}
        />
      </label>
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
