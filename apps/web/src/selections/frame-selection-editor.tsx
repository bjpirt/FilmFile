import type { ApiClient } from '@filmfile/contracts/client';
import type { FrameSelection } from '@filmfile/contracts/selections';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  rememberPreviewBy,
  rememberedPreviewBy,
  type PreviewBy,
} from './preview-by-preference.ts';
import { RuleEditor } from './rule-editor.tsx';
import { SelectionGroups } from './selection-groups.tsx';
import { MatchCount, type FoundFrame } from './selection-grid.tsx';
import { useFrameSearch } from './use-frame-search.ts';

const previewChoices: readonly { value: PreviewBy; label: string }[] = [
  { value: 'roll', label: 'Roll' },
  { value: 'event', label: 'Event' },
];

/**
 * A selection of frames, to hold in a page's own state: its rules to edit,
 * how many frames match and the frames themselves under each roll or event
 * ("Preview by"), updating as the rules do and saving nothing. The page puts
 * its own actions on each frame.
 */
export function FrameSelectionEditor({
  api,
  selection,
  change,
  frameActions,
}: {
  readonly api: ApiClient;
  readonly selection: FrameSelection;
  readonly change: (selection: FrameSelection) => void;
  readonly frameActions?: (frame: FoundFrame, name: string) => ReactNode;
}) {
  const [previewBy, setPreviewBy] = useState(rememberedPreviewBy);
  const { found, failed } = useFrameSearch(api, selection, previewBy);
  const rolls = useQuery({
    queryKey: ['rolls'],
    queryFn: async () => {
      const { data } = await api.GET('/api/rolls');
      if (data === undefined) {
        throw new Error("Couldn't load the rolls.");
      }
      return data;
    },
  });
  return (
    <div className="frame-selection">
      <RuleEditor
        api={api}
        rules={selection.rules}
        change={(rules) => {
          change({ ...selection, rules: [...rules] });
        }}
      />
      {failed && (
        <p role="alert">Couldn't find the frames. Is the service running?</p>
      )}
      <div className="selection-bar">
        {found !== undefined && (
          <MatchCount
            count={found.count}
            excluded={found.frames.filter((frame) => frame.excluded).length}
          />
        )}
        <fieldset className="preview-by">
          <legend>Preview by</legend>
          {previewChoices.map((choice) => (
            <label key={choice.value}>
              <input
                type="radio"
                name="preview-by"
                checked={previewBy === choice.value}
                onChange={() => {
                  setPreviewBy(choice.value);
                  rememberPreviewBy(choice.value);
                }}
              />
              {choice.label}
            </label>
          ))}
        </fieldset>
      </div>
      {found?.groups !== undefined && rolls.data !== undefined && (
        <SelectionGroups
          rolls={rolls.data.rolls}
          groups={found.groups}
          {...(frameActions === undefined ? {} : { actions: frameActions })}
        />
      )}
    </div>
  );
}
