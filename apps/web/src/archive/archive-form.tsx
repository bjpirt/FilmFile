import { useState, type SubmitEvent } from 'react';
import { RequiredMarker } from '../forms/required-marker.tsx';

/** The archive's details as the form saves them; blank ones are null. */
export interface ArchiveDetails {
  readonly name: string;
  readonly author: string | null;
  readonly copyright: string | null;
}

function textOrNull(text: string): string | null {
  return text.trim() === '' ? null : text.trim();
}

/** The archive's name, author and copyright, to set up or change. */
export function ArchiveForm({
  label,
  initial,
  submit,
  save,
}: {
  /** The form's name, for screen readers, e.g. "Settings". */
  readonly label: string;
  readonly initial: ArchiveDetails;
  /** The submit button's text. */
  readonly submit: string;
  /** Saves the details, giving what to tell the person if they weren't saved. */
  readonly save: (details: ArchiveDetails) => Promise<string | undefined>;
}) {
  const [name, setName] = useState(initial.name);
  const [author, setAuthor] = useState(initial.author ?? '');
  const [copyright, setCopyright] = useState(initial.copyright ?? '');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  async function send(event: SubmitEvent) {
    event.preventDefault();
    setSaved(false);
    if (name.trim() === '') {
      setProblem('Enter a name for the archive.');
      return;
    }
    setProblem(undefined);
    setSaving(true);
    const notSaved = await save({
      name: name.trim(),
      author: textOrNull(author),
      copyright: textOrNull(copyright),
    });
    setSaving(false);
    setProblem(notSaved);
    setSaved(notSaved === undefined);
  }

  return (
    // noValidate: the form's own message explains a missing name.
    <form
      className="roll-details archive-form"
      aria-label={label}
      noValidate
      onSubmit={(event) => void send(event)}
    >
      <label>
        <span>
          Name <RequiredMarker />
        </span>
        <input
          value={name}
          placeholder="Ben’s film archive"
          maxLength={100}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </label>
      <label>
        Author
        <input
          value={author}
          placeholder="Ben Pirt"
          maxLength={100}
          onChange={(event) => {
            setAuthor(event.target.value);
          }}
        />
      </label>
      <label>
        Copyright
        <input
          value={copyright}
          placeholder="© Ben Pirt. All rights reserved."
          maxLength={200}
          onChange={(event) => {
            setCopyright(event.target.value);
          }}
        />
      </label>
      <p className="muted">
        Your photographs carry the author and copyright, unless a roll or frame
        says otherwise.
      </p>
      {problem !== undefined && <p role="alert">{problem}</p>}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          {submit}
        </button>
        {saved && <p role="status">Saved.</p>}
      </div>
    </form>
  );
}
