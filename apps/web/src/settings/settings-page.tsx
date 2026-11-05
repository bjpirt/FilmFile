import type { ApiClient } from '@filmfile/contracts/client';
import { useQueryClient } from '@tanstack/react-query';
import { navigate } from '../routing.tsx';
import { SettingsForm } from './settings-form.tsx';
import type { ReadSettings } from './use-settings.ts';

/**
 * The author and copyright, changed after first run (saving goes back to the
 * rolls), and where the FilmFile folder is, which can't be changed here
 * (D64).
 */
export function SettingsPage({
  api,
  read,
}: {
  readonly api: ApiClient;
  readonly read: ReadSettings;
}) {
  const queryClient = useQueryClient();

  return (
    <section className="settings">
      <h1>Settings</h1>
      <SettingsForm
        label="Settings"
        initial={read.settings}
        submit="Save"
        save={async (details) => {
          const { data, response } = await api.PATCH('/api/settings', {
            params: { header: { 'if-match': read.etag } },
            body: details,
          });
          if (response.status === 409) {
            return 'The settings changed since you opened them. Reload the page.';
          }
          if (data === undefined) {
            return "Couldn't save them. Is the service running?";
          }
          queryClient.setQueryData<ReadSettings>(['settings'], {
            settings: data,
            etag: response.headers.get('ETag') ?? read.etag,
          });
          navigate('/');
          return undefined;
        }}
      />
      <h2>FilmFile folder</h2>
      <p className="folder-path">{read.settings.folder}</p>
      <p className="muted">
        Change it in the app with File › Open FilmFile Folder…, or set
        FILMFILE_FOLDER and restart.
      </p>
    </section>
  );
}
