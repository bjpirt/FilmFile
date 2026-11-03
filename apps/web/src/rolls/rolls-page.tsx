import type { ApiClient } from '@filmfile/contracts/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { RollCard } from './roll-card.tsx';

export function RollsPage({ api }: { readonly api: ApiClient }) {
  const queryClient = useQueryClient();
  // The roll number being typed, while New roll is open.
  const [newRoll, setNewRoll] = useState<string | undefined>(undefined);

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

  const createRoll = useMutation({
    mutationFn: async (roll: string) => {
      const { data, response } = await api.POST('/api/rolls', {
        body: { roll },
      });
      if (data !== undefined) {
        return data;
      }
      switch (response.status) {
        case 409:
          throw new Error(`Roll ${roll} already exists.`);
        case 422:
          throw new Error(
            'Enter a roll number like 2026-014: the year it was shot, then three digits.',
          );
        default:
          throw new Error("Couldn't create the roll. Is the service running?");
      }
    },
    onSuccess: async () => {
      setNewRoll(undefined);
      await queryClient.invalidateQueries({ queryKey: ['rolls'] });
    },
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    createRoll.mutate((newRoll ?? '').trim());
  }

  return (
    <section>
      <div className="page-heading">
        <h1>Rolls</h1>
        {newRoll === undefined && (
          <button
            type="button"
            className="primary"
            onClick={() => {
              setNewRoll('');
            }}
          >
            New roll
          </button>
        )}
      </div>

      {newRoll !== undefined && (
        <form className="new-roll" onSubmit={submit}>
          <label htmlFor="roll-number">Roll number</label>
          <input
            id="roll-number"
            value={newRoll}
            placeholder="2026-014"
            autoFocus
            onChange={(event) => {
              setNewRoll(event.target.value);
            }}
          />
          <button
            type="submit"
            className="primary"
            disabled={createRoll.isPending}
          >
            Create roll
          </button>
          <button
            type="button"
            onClick={() => {
              createRoll.reset();
              setNewRoll(undefined);
            }}
          >
            Cancel
          </button>
          {createRoll.isError && <p role="alert">{createRoll.error.message}</p>}
        </form>
      )}

      {rolls.isPending && <p>Loading rolls…</p>}
      {rolls.isError && <p>Couldn't load the rolls. Is the service running?</p>}
      {rolls.data?.unreadable.map(({ folder, problem }) => (
        <p key={folder} role="alert">
          Roll {folder} can't be read: {problem}. Fix or replace its roll.json
          in the archive.
        </p>
      ))}
      {rolls.data?.rolls.length === 0 && <p>No rolls yet.</p>}
      {rolls.data !== undefined && rolls.data.rolls.length > 0 && (
        <ul className="roll-grid">
          {rolls.data.rolls.map((roll) => (
            <RollCard key={roll.id} roll={roll} />
          ))}
        </ul>
      )}
    </section>
  );
}
