import type { ApiClient } from '@filmfile/contracts/client';
import { useQueryClient } from '@tanstack/react-query';
import { navigate } from '../routing.tsx';
import { ArchiveForm } from './archive-form.tsx';
import type { ReadArchive } from './use-archive.ts';

/** The archive's author and copyright, changed after first run; saving goes back to the rolls. */
export function SettingsPage({
  api,
  read,
}: {
  readonly api: ApiClient;
  readonly read: ReadArchive;
}) {
  const queryClient = useQueryClient();

  return (
    <section className="settings">
      <h1>Settings</h1>
      <ArchiveForm
        label="Settings"
        initial={read.archive}
        submit="Save"
        save={async (details) => {
          const { data, response } = await api.PATCH('/api/archive', {
            params: { header: { 'if-match': read.etag } },
            body: details,
          });
          if (response.status === 409) {
            return 'The settings changed since you opened them. Reload the page.';
          }
          if (data === undefined) {
            return "Couldn't save them. Is the service running?";
          }
          queryClient.setQueryData<ReadArchive>(['archive'], {
            archive: data,
            etag: response.headers.get('ETag') ?? read.etag,
          });
          navigate('/');
          return undefined;
        }}
      />
    </section>
  );
}
