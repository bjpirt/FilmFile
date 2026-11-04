import { useState, type SubmitEvent } from 'react';
import { RequiredMarker } from '../forms/required-marker.tsx';

/** The archive's details as the form saves them; a blank copyright is null. */
export interface ArchiveDetails {
  readonly author: string;
  readonly copyright: string | null;
}

/** The copyright notice an author gets unless they write their own. */
export function copyrightFor(author: string): string {
  return author.trim() === '' ? '' : `© ${author.trim()}. All rights reserved.`;
}

/**
 * The archive's author and copyright, to set up or change. The copyright
 * follows the author as it's typed, for as long as it's the one made from
 * the author; once changed by hand, it's left alone.
 */
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
  const [author, setAuthor] = useState(initial.author);
  const [copyright, setCopyright] = useState(initial.copyright ?? '');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  async function send(event: SubmitEvent) {
    event.preventDefault();
    if (author.trim() === '') {
      setProblem('Enter who the photographs are by.');
      return;
    }
    setProblem(undefined);
    setSaving(true);
    const notSaved = await save({
      author: author.trim(),
      copyright: copyright.trim() === '' ? null : copyright.trim(),
    });
    // Once saved, the page moves on.
    setSaving(false);
    setProblem(notSaved);
  }

  return (
    // noValidate: the form's own message explains a missing author.
    <form
      className="roll-details archive-form"
      aria-label={label}
      noValidate
      onSubmit={(event) => void send(event)}
    >
      <label>
        <span>
          Author <RequiredMarker />
        </span>
        <input
          value={author}
          placeholder="Ben Pirt"
          maxLength={100}
          autoFocus
          onChange={(event) => {
            const typed = event.target.value;
            if (copyright === copyrightFor(author)) {
              setCopyright(copyrightFor(typed));
            }
            setAuthor(typed);
          }}
        />
      </label>
      <label>
        Copyright
        <input
          value={copyright}
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
      </div>
    </form>
  );
}
