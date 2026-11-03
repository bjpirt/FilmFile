import type { Lens } from '@filmfile/contracts/equipment';
import { useId } from 'react';
import { EquipmentSelect } from './equipment-select.tsx';
import { blankLens, type LensChoice, type NewLens } from './lens-choice.ts';
import { RequiredMarker } from './required-marker.tsx';
import { lensLabel } from './use-lenses.ts';

/** A lens picked from the archive's, or Add new…, which asks for its details. */
export function LensField({
  lenses,
  choice,
  change,
}: {
  readonly lenses: readonly Lens[];
  readonly choice: LensChoice;
  readonly change: (choice: LensChoice) => void;
}) {
  // Ties the number fields to their labels, which leave out the units.
  const id = useId();

  function changeDetail(details: NewLens, detail: Partial<NewLens>) {
    change({ kind: 'new', details: { ...details, ...detail } });
  }

  return (
    <>
      <EquipmentSelect
        label="Lens"
        options={lenses.map((lens) => ({
          slug: lens.slug,
          label: lensLabel(lens),
        }))}
        choice={choice}
        blank={blankLens}
        change={change}
      />
      {choice.kind === 'new' && (
        <fieldset className="new-equipment">
          <legend>New lens</legend>
          <label>
            <span>
              Make <RequiredMarker />
            </span>
            <input
              value={choice.details.make}
              placeholder="Nikon"
              maxLength={50}
              autoFocus
              onChange={(event) => {
                changeDetail(choice.details, { make: event.target.value });
              }}
            />
          </label>
          <label>
            <span>
              Name <RequiredMarker />
            </span>
            <input
              value={choice.details.name}
              placeholder="Nikkor AI-S"
              maxLength={100}
              onChange={(event) => {
                changeDetail(choice.details, { name: event.target.value });
              }}
            />
          </label>
          <div className="field-with-unit">
            <label htmlFor={`${id}-focal-length`}>Focal length</label>
            <span className="with-unit">
              <input
                id={`${id}-focal-length`}
                className="numbers"
                inputMode="decimal"
                size={5}
                maxLength={6}
                placeholder="50"
                value={choice.details.focalLength}
                onChange={(event) => {
                  changeDetail(choice.details, {
                    focalLength: event.target.value,
                  });
                }}
              />
              <span aria-hidden="true">mm</span>
            </span>
          </div>
          <div className="field-with-unit">
            <label htmlFor={`${id}-max-aperture`}>Max aperture</label>
            <span className="with-unit">
              <span aria-hidden="true">f/</span>
              <input
                id={`${id}-max-aperture`}
                className="numbers"
                inputMode="decimal"
                size={4}
                maxLength={5}
                placeholder="1.8"
                value={choice.details.maxAperture}
                onChange={(event) => {
                  changeDetail(choice.details, {
                    maxAperture: event.target.value,
                  });
                }}
              />
            </span>
          </div>
        </fieldset>
      )}
    </>
  );
}
