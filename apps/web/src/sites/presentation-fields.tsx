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

/** A text field saved when you leave it, if it changed. */
function TextField({
  label,
  value,
  save,
}: {
  readonly label: string;
  readonly value: string;
  readonly save: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // Follows the value when it arrives later, such as the archive's copyright.
  if (value !== shown) {
    setShown(value);
    setText(value);
  }
  return (
    <label>
      <span>{label}</span>
      <input
        value={text}
        placeholder="None"
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={() => {
          if (text.trim() !== value) {
            save(text.trim());
          }
        }}
      />
    </label>
  );
}

/**
 * How a site is shown when it's built: its title (apart from its name, blank
 * for none) and copyright notice (the archive's until changed, blank for
 * none, D108), and which details a frame's page shows ("Details to show":
 * the title and date under the photo, the rest behind its icon, D107). A
 * choice is saved at once; a text field when you leave it.
 */
export function PresentationFields({
  presentation,
  archiveCopyright,
  change,
}: {
  readonly presentation: Presentation;
  /** The copyright in Settings, which a site shows until it has its own. */
  readonly archiveCopyright: string | null;
  readonly change: (presentation: Presentation) => void;
}) {
  return (
    <section className="presentation" aria-label="How the site looks">
      <TextField
        label="Site title"
        value={presentation.title}
        save={(title) => {
          change({ ...presentation, title });
        }}
      />
      <TextField
        label="Copyright notice"
        value={presentation.copyright ?? archiveCopyright ?? ''}
        save={(copyright) => {
          change({ ...presentation, copyright });
        }}
      />
      <fieldset className="rule-choices">
        <legend>Details to show</legend>
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
