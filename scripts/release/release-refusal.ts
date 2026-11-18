/** What `pnpm release` finds out before changing anything. */
export interface ReleaseFacts {
  /** Whether GitHub's gh can open the pull request. */
  readonly gh: 'ready' | 'missing' | 'signed-out';
  readonly branch: string;
  readonly uncommitted: boolean;
  /** Commits on GitHub's main that aren't on this one, and the other way round. */
  readonly behind: number;
  readonly ahead: number;
  /** The version in the root package.json, and whether it has a tag. */
  readonly current: string;
  readonly currentReleased: boolean;
  /** Whether any release has been made (a v* tag). */
  readonly anyReleased: boolean;
  readonly next: string;
  /** The link to a release pull request already open, if there is one. */
  readonly openRelease: string | undefined;
  /** Whether release/<next> is already a branch, here or on GitHub. */
  readonly branchExists: boolean;
}

function commits(count: number): string {
  return `${String(count)} ${count === 1 ? 'commit' : 'commits'}`;
}

/** Why a release can't be prepared now, or undefined if it can (FF-243). */
export function releaseRefusal(facts: ReleaseFacts): string | undefined {
  if (facts.gh === 'missing') {
    return "GitHub's gh isn't installed. Install it from https://cli.github.com, then try again.";
  }
  if (facts.gh === 'signed-out') {
    return "GitHub's gh isn't signed in. Run gh auth login, then try again.";
  }
  if (facts.branch !== 'main') {
    return 'Run it on main.';
  }
  if (facts.uncommitted) {
    return 'Commit or put away your changes first.';
  }
  if (facts.behind > 0) {
    return `main is ${commits(facts.behind)} behind GitHub's. Run git pull first.`;
  }
  if (facts.ahead > 0) {
    return `main has ${commits(facts.ahead)} GitHub doesn't. Push it in a pull request first.`;
  }
  if (facts.anyReleased && !facts.currentReleased) {
    return `${facts.current} hasn't been published yet. Run the Release workflow on main to publish it.`;
  }
  if (facts.openRelease !== undefined) {
    return `A release is already open: ${facts.openRelease}. Merge or close it first.`;
  }
  if (facts.branchExists) {
    return `There is already a branch release/${facts.next}. Delete it, or finish the release it holds.`;
  }
  return undefined;
}
