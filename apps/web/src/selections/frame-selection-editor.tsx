import type { ApiClient } from '@filmfile/contracts/client';
import type { FrameSelection } from '@filmfile/contracts/selections';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RuleEditor } from './rule-editor.tsx';
import {
  MatchCount,
  SelectionGrid,
  type FoundFrame,
} from './selection-grid.tsx';
import { useFrameSearch } from './use-frame-search.ts';

/**
 * A selection of frames, to hold in a page's own state: its rules to edit,
 * how many frames match and the frames themselves, updating as the rules do
 * and saving nothing. The page puts its own actions on each frame.
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
  const { found, failed } = useFrameSearch(api, selection);
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
      {found !== undefined && <MatchCount count={found.count} />}
      {found !== undefined && rolls.data !== undefined && (
        <SelectionGrid
          rolls={rolls.data.rolls}
          frames={found.frames}
          {...(frameActions === undefined ? {} : { actions: frameActions })}
        />
      )}
    </div>
  );
}
