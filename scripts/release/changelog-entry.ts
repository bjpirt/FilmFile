import type { Commit } from './parse-commits.ts';

const commitLink = 'https://github.com/bjpirt/FilmFile/commit/';

// type(scope)!: subject, as in "feat(sync)!: keys kept in the keychain".
const conventional =
  /^(?<type>[a-z]+)(?:\([^)]*\))?(?<breaking>!)?: (?<text>.+)$/;

/**
 * A release's entry in CHANGELOG.md (FF-243): the breaking changes, then the
 * `feat:` and `fix:` commits since the last release, each the commit's
 * subject without its prefix, capitalised, with its hash linked. Other
 * commits are left out, and so is a heading with nothing under it.
 */
export function changelogEntry(
  version: string,
  commits: readonly Commit[] | 'first',
): string {
  const heading = `## ${version}\n\n`;
  if (commits === 'first') {
    return `${heading}The first release.\n`;
  }
  const changed: string[] = [];
  const added: string[] = [];
  const fixed: string[] = [];
  for (const commit of commits) {
    const parts = conventional.exec(commit.subject)?.groups;
    if (parts?.type === undefined || parts.text === undefined) {
      continue;
    }
    const line = `- ${parts.text.charAt(0).toUpperCase()}${parts.text.slice(1)} ([${commit.hash}](${commitLink}${commit.hash}))`;
    if (
      parts.breaking !== undefined ||
      /^BREAKING[ -]CHANGE: /m.test(commit.body)
    ) {
      changed.push(line);
    } else if (parts.type === 'feat') {
      added.push(line);
    } else if (parts.type === 'fix') {
      fixed.push(line);
    }
  }
  const sections = [
    ['Changed', changed],
    ['Added', added],
    ['Fixed', fixed],
  ] as const;
  const body = sections
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `### ${title}\n\n${lines.join('\n')}\n`)
    .join('\n');
  return `${heading}${body === '' ? 'Maintenance: dependencies and tidying.\n' : body}`;
}
