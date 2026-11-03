import type { ApiClient } from '@filmfile/contracts/client';
import { useQueryClient } from '@tanstack/react-query';
import { ArchiveForm } from './archive-form.tsx';

/**
 * First run (D43): shown in place of every page until the archive has a
 * name. Once it's set up, the page that was asked for appears.
 */
export function SetUpPage({ api }: { readonly api: ApiClient }) {
  const queryClient = useQueryClient();

  return (
    <section className="set-up">
      <h1>Set up your archive</h1>
      <p>
        Give your archive a name, and say who the photographs are by. You can
        change these later in Settings.
      </p>
      <ArchiveForm
        label="Set up your archive"
        initial={{ name: '', author: null, copyright: null }}
        submit="Set up archive"
        save={async (details) => {
          const { response } = await api.POST('/api/archive', {
            body: {
              name: details.name,
              ...(details.author === null ? {} : { author: details.author }),
              ...(details.copyright === null
                ? {}
                : { copyright: details.copyright }),
            },
          });
          if (!response.ok && response.status !== 409) {
            return "Couldn't set it up. Is the service running?";
          }
          // Set up here or, after a 409, elsewhere: either way it now is.
          await queryClient.invalidateQueries({ queryKey: ['archive'] });
          return undefined;
        }}
      />
    </section>
  );
}
