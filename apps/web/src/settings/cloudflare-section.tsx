import { useState, type SubmitEvent } from 'react';
import { cloudflareGuide } from './cloudflare-guide.ts';

const dashboard = 'https://dash.cloudflare.com/?to=/:account/r2/overview';
const apiTokens = 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens';

/**
 * The Cloudflare account sites are published in (D119): its ID, saved on its
 * own, whether this computer has the keys, and what to do in Cloudflare's
 * dashboard to set it all up. The keys are never shown: they stay in
 * `~/.aws/credentials`.
 */
export function CloudflareSection({
  saved,
  keysFound,
  save,
}: {
  /** The account ID in the settings, or null. */
  readonly saved: string | null;
  /** Whether this computer's `[filmfile]` profile has both keys. */
  readonly keysFound: boolean;
  /** Saves the ID (blank takes it away), giving what to tell the person if it wasn't saved. */
  readonly save: (accountId: string | null) => Promise<string | undefined>;
}) {
  const [accountId, setAccountId] = useState(saved ?? '');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [justSaved, setJustSaved] = useState(false);
  const wanted = accountId.trim();
  const changed = wanted !== (saved ?? '');

  async function send(event: SubmitEvent) {
    event.preventDefault();
    setProblem(undefined);
    setSaving(true);
    const notSaved = await save(wanted === '' ? null : wanted);
    setSaving(false);
    setProblem(notSaved);
    setJustSaved(notSaved === undefined);
  }

  return (
    <form
      className="roll-details settings-form cloudflare"
      aria-label="Cloudflare"
      noValidate
      onSubmit={(event) => void send(event)}
    >
      <h2>Cloudflare</h2>
      <label>
        Account ID
        <input
          className="account-id"
          value={accountId}
          maxLength={100}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setAccountId(event.target.value);
            setJustSaved(false);
          }}
        />
      </label>
      {problem !== undefined && <p role="alert">{problem}</p>}
      {justSaved && <p role="status">Saved the account ID.</p>}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving || !changed}>
          Save
        </button>
      </div>
      <p className="cloudflare-keys">
        {keysFound
          ? 'Keys: found in the [filmfile] profile of ~/.aws/credentials'
          : 'Keys: no [filmfile] profile in ~/.aws/credentials yet'}
      </p>
      <p className="muted">
        To publish sites to Cloudflare R2, and back the library up to it:
      </p>
      <ol className="cloudflare-steps">
        <li>
          In the{' '}
          <a href={dashboard} target="_blank" rel="noreferrer">
            Cloudflare dashboard
          </a>
          , click the user menu at the top right of the page, then “Copy account
          ID”, and paste it into the field above.
        </li>
        <li>
          Create a bucket for each site. Use it only for that site: files the
          site doesn’t have are removed from it.
        </li>
        <li>
          Under R2,{' '}
          <a href={apiTokens} target="_blank" rel="noreferrer">
            Manage API tokens
          </a>
          , create a token with Object Read &amp; Write on those buckets.
        </li>
        <li>
          Put its Access Key ID and Secret Access Key in ~/.aws/credentials:
          <pre>
            {'[filmfile]\naws_access_key_id = …\naws_secret_access_key = …'}
          </pre>
        </li>
        <li>
          Give each bucket a custom domain, and add a rewrite rule from / to
          /index.html.
        </li>
        <li>Then set the bucket and address on each site’s page.</li>
      </ol>
      <p>
        <a href={cloudflareGuide} target="_blank" rel="noreferrer">
          How to set up Cloudflare
        </a>
        , step by step.
      </p>
    </form>
  );
}
