import type { ApiClient } from '@filmfile/contracts/client';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsForm } from './settings-form.tsx';

/**
 * First run (D43): shown in place of every page until FilmFile is set up.
 * Once it is, the page that was asked for appears.
 */
export function SetUpPage({ api }: { readonly api: ApiClient }) {
  const queryClient = useQueryClient();

  return (
    <section className="set-up">
      <h1>Set up FilmFile</h1>
      <p>
        Say who the photographs are by. You can change it later in Settings.
      </p>
      <SettingsForm
        label="Set up FilmFile"
        initial={{ author: '', copyright: null }}
        submit="Set up"
        save={async (details) => {
          const { response } = await api.POST('/api/settings', {
            body: {
              author: details.author,
              ...(details.copyright === null
                ? {}
                : { copyright: details.copyright }),
            },
          });
          if (!response.ok && response.status !== 409) {
            return "Couldn't set it up. Is the service running?";
          }
          // Set up here or, after a 409, elsewhere: either way it now is.
          await queryClient.invalidateQueries({ queryKey: ['settings'] });
          return undefined;
        }}
      />
    </section>
  );
}
