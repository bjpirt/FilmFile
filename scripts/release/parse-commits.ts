/** A commit, as a changelog entry needs it. */
export interface Commit {
  readonly hash: string;
  readonly subject: string;
  readonly body: string;
}

/**
 * `git log`'s `--format` for `parseCommits`: the short hash, subject and body,
 * between characters that can't appear in them.
 */
export const commitLogFormat = '%h%x1f%s%x1f%b%x1e';

/** The commits in `git log --format=<commitLogFormat>` output. */
export function parseCommits(log: string): Commit[] {
  return log
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record !== '')
    .map((record) => {
      const [hash = '', subject = '', body = ''] = record.split('\x1f');
      return { hash, subject, body: body.trim() };
    });
}
