import type { ApiClient } from '@filmfile/contracts/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { Link } from '../routing.tsx';

function frameCount(frames: number): string {
  return frames === 1 ? '1 frame' : `${String(frames)} frames`;
}

export function RollsPage({ api }: { readonly api: ApiClient }) {
  const queryClient = useQueryClient();
  const [rollId, setRollId] = useState('');

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
      setRollId('');
      await queryClient.invalidateQueries({ queryKey: ['rolls'] });
    },
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    createRoll.mutate(rollId.trim());
  }

  return (
    <section>
      <h2>Rolls</h2>

      <form onSubmit={submit}>
        <label htmlFor="roll-number">Roll number</label>
        <input
          id="roll-number"
          value={rollId}
          placeholder="2026-014"
          onChange={(event) => {
            setRollId(event.target.value);
          }}
        />
        <button type="submit" disabled={createRoll.isPending}>
          Create roll
        </button>
        {createRoll.isError && <p role="alert">{createRoll.error.message}</p>}
      </form>

      {rolls.isPending && <p>Loading rolls…</p>}
      {rolls.isError && <p>Couldn't load the rolls. Is the service running?</p>}
      {rolls.data?.length === 0 && <p>No rolls yet.</p>}
      {rolls.data !== undefined && rolls.data.length > 0 && (
        <ul>
          {rolls.data.map((roll) => (
            <li key={roll.id}>
              <Link to={`/rolls/${roll.id}`}>{roll.roll}</Link>{' '}
              <span>{frameCount(roll.frames.length)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
